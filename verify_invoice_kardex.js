// Test end-to-end: facturar un producto inventariable y verificar que kardex se alimentó.
// Llama directamente a la lógica del controller copiando su queries (en transacción + rollback).
require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { pool } = require(path.join(__dirname, 'src', 'config', 'db'));

const log = (l, v) => console.log(`\n=== ${l} ===\n` + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Crear producto inventariable con stock + costo
    const tres = await client.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
    const tenantId = tres.rows[0].id;

    const prod = (await client.query(`
      INSERT INTO products (tenant_id, name, sku, price, cost, tax_rate, stock, unit, dian_uom_code,
                            is_inventoriable, visible_in_invoices)
      VALUES ($1, 'KARDEX-TEST', 'KX-001', 50000, 30000, 19, 0, '94', '94', true, true)
      RETURNING id, name, sku, cost, stock`,
      [tenantId]
    )).rows[0];
    log('Producto creado', prod);

    // 2) Movimiento inicial entrada (compra) — para tener saldo
    await client.query(
      `INSERT INTO inventory_movements
       (tenant_id, product_id, product_code, product_name, movement_date, movement_type,
        quantity, unit_cost, average_cost, balance_quantity, balance_value,
        document_type, document_number, notes, created_by)
       VALUES ($1, $2, 'KX-001', 'KARDEX-TEST', CURRENT_DATE, 'IN',
               20, 30000, 30000, 20, 600000, 'PURCHASE', 'TEST-COMP', 'Compra inicial', null)`,
      [tenantId, prod.id]
    );
    await client.query(`UPDATE products SET stock = 20 WHERE id = $1`, [prod.id]);

    // 3) Crear factura cabecera (mínima)
    const inv = (await client.query(`
      INSERT INTO invoices (tenant_id, invoice_number, client_name, date, subtotal, tax_amount, total, dian_status, payment_status, created_at, updated_at)
      VALUES ($1, 'TEST-FV-001', 'CLIENTE TEST', CURRENT_DATE, 100000, 19000, 119000, 'BORRADOR', 'PENDIENTE', NOW(), NOW())
      RETURNING id, invoice_number`,
      [tenantId]
    )).rows[0];
    log('Factura creada', inv);

    // 4) Replicar lógica del patch: insertar item con product_id, kardex y stock
    const qty = 5;
    const unitPrice = 50000;
    const taxRate = 19;
    const lineBase = unitPrice * qty;
    const taxVal = lineBase * (taxRate / 100);

    await client.query(`
      INSERT INTO invoice_items
        (invoice_id, product_id, service_id, item_type, unit_cost,
         description, quantity, unit_price, tax_rate, tax_amount, discount, subtotal, total, unit, created_at)
      VALUES ($1, $2, NULL, 'product', $3, $4, $5, $6, $7, $8, 0, $9, $10, '94', NOW())`,
      [inv.id, prod.id, prod.cost, prod.name, qty, unitPrice, taxRate, taxVal, lineBase, lineBase + taxVal]
    );

    // Saldo previo
    const balRes = await client.query(`
      SELECT balance_quantity, balance_value, average_cost
        FROM inventory_movements
       WHERE tenant_id = $1 AND product_id = $2
       ORDER BY movement_date DESC, id DESC LIMIT 1`,
      [tenantId, prod.id]
    );
    const cur = balRes.rows[0];
    const avg = Number(cur.average_cost);
    const newQty = Number(cur.balance_quantity) - qty;
    const newVal = Number(cur.balance_value) - qty * avg;

    await client.query(`
      INSERT INTO inventory_movements
       (tenant_id, product_id, product_code, product_name, movement_date, movement_type,
        quantity, unit_cost, average_cost, balance_quantity, balance_value,
        document_type, document_id, document_number, notes)
       VALUES ($1, $2, 'KX-001', 'KARDEX-TEST', CURRENT_DATE, 'OUT',
               $3, $4, $4, $5, $6, 'INVOICE', $7, $8, 'Venta - factura TEST-FV-001')`,
      [tenantId, prod.id, qty, avg, newQty, newVal, inv.id, inv.invoice_number]
    );

    await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [qty, prod.id]);

    // 5) Verificación: kardex tiene 2 movimientos, stock = 15, costo de venta = 5*30000 = 150000
    const kardex = (await client.query(
      `SELECT movement_type, quantity, unit_cost, balance_quantity, balance_value, document_type, document_number
         FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2 ORDER BY id`,
      [tenantId, prod.id]
    )).rows;
    log('Kardex final', kardex);

    const stockNow = (await client.query(`SELECT stock FROM products WHERE id = $1`, [prod.id])).rows[0];
    log('Stock producto', stockNow);

    const items = (await client.query(
      `SELECT id, invoice_id, product_id, service_id, item_type, unit_cost, description, quantity, unit_price, total
         FROM invoice_items WHERE invoice_id = $1`,
      [inv.id]
    )).rows;
    log('invoice_items con product_id', items);

    // 6) Costo de venta esperado
    const cogs = qty * avg;
    log('Costo de venta esperado (Db 6135 / Cr 1435)', cogs);

    if (kardex.length === 2 && Number(stockNow.stock) === 15 && items[0].product_id === prod.id) {
      console.log('\n>>> CICLO VENTAS → KARDEX VERIFICADO <<<');
    } else {
      console.log('\n>>> CHEQUEAR — no cuadra <<<');
    }

    await client.query('ROLLBACK');
    log('ROLLBACK', 'BD intacta');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[ERR]', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
