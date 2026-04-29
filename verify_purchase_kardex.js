// E2E: simular compra → verificar kardex IN + stock
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

    // 1) Producto inventariable con stock 0
    const prod = (await client.query(`
      INSERT INTO products (tenant_id, name, sku, price, cost, tax_rate, stock, unit, dian_uom_code, is_inventoriable)
      VALUES ($1, 'COMPRA-TEST', 'CMP-001', 80000, 50000, 19, 0, '94', '94', true)
      RETURNING id, name, sku, cost, stock`,
      [tenantId]
    )).rows[0];
    log('1) Producto', prod);

    // 2) Crear AP cabecera (mínima — schema completo varía por instalación)
    const apCols = (await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='accounts_payable' ORDER BY ordinal_position`
    )).rows.map((x) => x.column_name);
    log('accounts_payable cols', apCols);

    // Insert mínimo según columnas requeridas (asumimos algunas comunes)
    const apRes = await client.query(`
      INSERT INTO accounts_payable (
        tenant_id, document_type, document_number, supplier_name, supplier_document_number, issue_date,
        subtotal_amount, tax_amount, original_amount, balance_amount, paid_amount, status, created_at, updated_at
      ) VALUES (
        $1, 'FACTURA_PROVEEDOR', 'TEST-COMPRA-001', 'PROVEEDOR TEST', '900123456', CURRENT_DATE,
        500000, 95000, 595000, 595000, 0, 'ACTIVO', NOW(), NOW()
      ) RETURNING id, document_number, issue_date`,
      [tenantId]
    );
    const ap = apRes.rows[0];
    log('2) AP creada', ap);

    // 3) Insertar línea con product_id (replica patch)
    const qty = 10;
    const unitCost = 50000;
    await client.query(`
      INSERT INTO accounts_payable_lines (
        tenant_id, accounts_payable_id, line_no, concept_name, description, puc_code, puc_name, cost_center,
        quantity, unit_price, discount_pct, iva_pct, rf_pct,
        subtotal_amount, discount_amount, base_amount, iva_amount, rf_amount, line_total, notes,
        product_id, service_id, item_type
      ) VALUES ($1, $2, 1, 'COMPRA-TEST', 'Compra producto test', '1435', 'Inventarios', '1',
                $3, $4, 0, 19, 0,
                $5, 0, $5, $6, 0, $7, null,
                $8, null, 'product')`,
      [tenantId, ap.id, qty, unitCost, qty * unitCost, qty * unitCost * 0.19, qty * unitCost * 1.19, prod.id]
    );
    log('3) AP line insertada con product_id', { product_id: prod.id, qty, unitCost });

    // 4) Replica del patch: insertar inventory_movements + UPDATE products.stock
    const balRes = await client.query(`
      SELECT balance_quantity, balance_value, average_cost FROM inventory_movements
       WHERE tenant_id = $1 AND product_id = $2 ORDER BY movement_date DESC, id DESC LIMIT 1`,
      [tenantId, prod.id]
    );
    const cur = balRes.rows[0] || { balance_quantity: 0, balance_value: 0, average_cost: 0 };
    const newQty = Number(cur.balance_quantity) + qty;
    const newVal = Number(cur.balance_value) + qty * unitCost;
    const newAvg = newQty > 0 ? newVal / newQty : 0;

    await client.query(`
      INSERT INTO inventory_movements
       (tenant_id, product_id, product_code, product_name, movement_date, movement_type,
        quantity, unit_cost, average_cost, balance_quantity, balance_value,
        document_type, document_id, document_number, notes)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, 'IN',
              $5, $6, $7, $8, $9, 'PURCHASE', $10, $11, 'Compra')`,
      [tenantId, prod.id, prod.sku, prod.name, qty, unitCost, newAvg, newQty, newVal, ap.id, ap.document_number]
    );
    await client.query(`UPDATE products SET stock = stock + $1, cost = $2 WHERE id = $3`, [qty, newAvg, prod.id]);

    // 5) Verificación
    const kardex = (await client.query(
      `SELECT movement_type, quantity, unit_cost, balance_quantity, balance_value, average_cost, document_type, document_number
         FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2 ORDER BY id`,
      [tenantId, prod.id]
    )).rows;
    log('5) Kardex tras compra', kardex);

    const stockNow = (await client.query(`SELECT stock, cost FROM products WHERE id = $1`, [prod.id])).rows[0];
    log('6) Producto tras compra', stockNow);

    const lines = (await client.query(
      `SELECT line_no, product_id, item_type, quantity, unit_price FROM accounts_payable_lines WHERE accounts_payable_id = $1`,
      [ap.id]
    )).rows;
    log('7) AP lines', lines);

    const ok = kardex.length === 1 && Number(stockNow.stock) === qty && lines[0].product_id === prod.id;
    console.log(ok ? '\n>>> COMPRAS → KARDEX OK <<<' : '\n>>> NO CUADRA <<<');

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
