// E2E: nota crédito de venta → debe meter kardex IN (devolución) y revertir costo.
require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { pool } = require(path.join(__dirname, 'src', 'config', 'db'));

const log = (l, v) => console.log(`\n=== ${l} ===\n` + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tres = await client.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
    const tenantId = tres.rows[0].id;

    // 1) Producto inventariable
    const prod = (await client.query(`
      INSERT INTO products (tenant_id, name, sku, price, cost, tax_rate, stock, unit, dian_uom_code, is_inventoriable)
      VALUES ($1, 'NC-TEST', 'NC-001', 60000, 40000, 19, 0, '94', '94', true) RETURNING id, name, sku, cost, stock`,
      [tenantId])).rows[0];

    // 2) Inicial: compra de 10
    await client.query(`
      INSERT INTO inventory_movements (tenant_id, product_id, product_code, product_name, movement_date, movement_type, quantity, unit_cost, average_cost, balance_quantity, balance_value, document_type, document_number)
      VALUES ($1, $2, 'NC-001', 'NC-TEST', CURRENT_DATE, 'IN', 10, 40000, 40000, 10, 400000, 'PURCHASE', 'TEST-IN')`,
      [tenantId, prod.id]);
    await client.query(`UPDATE products SET stock = 10 WHERE id = $1`, [prod.id]);

    // 3) Venta de 4: kardex OUT
    await client.query(`
      INSERT INTO inventory_movements (tenant_id, product_id, product_code, product_name, movement_date, movement_type, quantity, unit_cost, average_cost, balance_quantity, balance_value, document_type, document_number)
      VALUES ($1, $2, 'NC-001', 'NC-TEST', CURRENT_DATE, 'OUT', 4, 40000, 40000, 6, 240000, 'INVOICE', 'TEST-FV')`,
      [tenantId, prod.id]);
    await client.query(`UPDATE products SET stock = 6 WHERE id = $1`, [prod.id]);

    // Registrar la factura origen (mínima) para nc.invoice_id
    const inv = (await client.query(`
      INSERT INTO invoices (tenant_id, invoice_number, client_name, date, subtotal, tax_amount, total, dian_status, payment_status)
      VALUES ($1, 'TEST-FV-NC', 'CLIENTE NC', CURRENT_DATE, 240000, 45600, 285600, 'BORRADOR', 'PENDIENTE') RETURNING id`,
      [tenantId])).rows[0];

    log('Setup', { product: prod.id, factura: inv.id, stockTrasVenta: 6, balance_qty_kardex: 6 });

    // 4) Crear nota crédito por DEVOLUCION de 2 unidades (replica patch del controller)
    const ncRes = await client.query(`
      INSERT INTO credit_notes (tenant_id, note_number, invoice_id, invoice_number, client_name, date, subtotal, tax_amount, discount, total, status, dian_status, created_at, updated_at)
      VALUES ($1, 'NC-TEST-001', $2, 'TEST-FV-NC', 'CLIENTE NC', CURRENT_DATE, 120000, 22800, 0, 142800, 'BORRADOR', 'PENDIENTE', NOW(), NOW())
      RETURNING id, note_number, date`,
      [tenantId, inv.id]);
    const nc = ncRes.rows[0];

    const qty = 2;
    const unitPrice = 60000;
    await client.query(`
      INSERT INTO credit_note_items (credit_note_id, product_id, service_id, item_type, unit_cost,
                                     description, quantity, unit_price, tax_rate, tax_amount, discount, subtotal, total, created_at)
      VALUES ($1, $2, NULL, 'product', $3, $4, $5, $6, 19, $7, 0, $8, $9, NOW())`,
      [nc.id, prod.id, prod.cost, prod.name, qty, unitPrice, qty*unitPrice*0.19, qty*unitPrice, qty*unitPrice*1.19]);

    // 5) Replica del patch: kardex IN devolución + restitución stock
    const balRes = await client.query(`
      SELECT balance_quantity, balance_value, average_cost FROM inventory_movements
       WHERE tenant_id = $1 AND product_id = $2 ORDER BY movement_date DESC, id DESC LIMIT 1`,
      [tenantId, prod.id]);
    const cur = balRes.rows[0];
    const avg = Number(cur.average_cost);
    const newQty = Number(cur.balance_quantity) + qty;
    const newVal = Number(cur.balance_value) + qty * avg;

    await client.query(`
      INSERT INTO inventory_movements (tenant_id, product_id, product_code, product_name, movement_date, movement_type, quantity, unit_cost, average_cost, balance_quantity, balance_value, document_type, document_id, document_number, notes)
      VALUES ($1, $2, 'NC-001', 'NC-TEST', CURRENT_DATE, 'IN', $3, $4, $4, $5, $6, 'CREDIT_NOTE', $7, $8, 'Devolución venta')`,
      [tenantId, prod.id, qty, avg, newQty, newVal, nc.id, nc.note_number]);

    await client.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [qty, prod.id]);

    // Verificar
    const kardex = (await client.query(
      `SELECT movement_type, quantity, balance_quantity, document_type, document_number FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2 ORDER BY id`,
      [tenantId, prod.id])).rows;
    log('Kardex completo', kardex);

    const stockNow = (await client.query(`SELECT stock FROM products WHERE id = $1`, [prod.id])).rows[0];
    log('Stock final', stockNow);

    const items = (await client.query(
      `SELECT product_id, item_type, quantity, unit_price FROM credit_note_items WHERE credit_note_id = $1`,
      [nc.id])).rows;
    log('credit_note_items', items);

    // Costo a revertir
    const cogsReversal = qty * avg;
    log('Costo a revertir (Db 1435 / Cr 6135)', cogsReversal);

    const ok = kardex.length === 3 && Number(stockNow.stock) === 8 && items[0].product_id === prod.id;
    console.log(ok ? '\n>>> NOTA CRÉDITO → KARDEX OK <<<' : '\n>>> NO CUADRA <<<');

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
