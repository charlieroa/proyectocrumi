// verify_purchase_kardex_v2_real.js
// E2E: invoca payablesController/createAccountsPayableEntry DIRECTAMENTE.
// Verifica que una FC con producto inventariable:
//  - crea inventory_movements IN con journal_entry_id vinculado
//  - actualiza products.stock + cost (avg)
//  - asiento contable cuadra con líneas Dr 1435 / Dr IVA / Cr 220505
// Cleanup al final.

require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { pool } = require(path.join(__dirname, 'src', 'config', 'db'));
const apService = require(path.join(__dirname, 'src', 'services', 'accountsPayableWriteService'));

const log = (l, v) => console.log(`\n=== ${l} ===\n` + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));

const cleanup = async (client, ctx) => {
  try {
    if (ctx.payableId) {
      await client.query(`DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'CUENTA_POR_PAGAR' AND document_id::text = $2)`,
        [ctx.tenantId, String(ctx.payableId)]);
      await client.query(`DELETE FROM journal_entries WHERE tenant_id = $1 AND document_type = 'CUENTA_POR_PAGAR' AND document_id::text = $2`,
        [ctx.tenantId, String(ctx.payableId)]);
      await client.query(`DELETE FROM inventory_movements WHERE tenant_id = $1 AND document_type = 'FACTURA_PROVEEDOR' AND document_id = $2`, [ctx.tenantId, ctx.payableId]);
      await client.query(`DELETE FROM accounts_payable_lines WHERE accounts_payable_id = $1`, [ctx.payableId]);
      await client.query(`DELETE FROM accounts_payable WHERE id = $1`, [ctx.payableId]);
    }
    if (ctx.productId) {
      await client.query(`DELETE FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2`, [ctx.tenantId, ctx.productId]);
      await client.query(`DELETE FROM products WHERE id = $1`, [ctx.productId]);
    }
    log('CLEANUP', 'OK');
  } catch (e) {
    console.error('[cleanup] ERR:', e.message);
  }
};

(async () => {
  const ctx = {};
  let setupClient = await pool.connect();
  try {
    const t = await setupClient.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
    ctx.tenantId = t.rows[0].id;
    const u = await setupClient.query(`SELECT id FROM users WHERE tenant_id = $1 ORDER BY id LIMIT 1`, [ctx.tenantId]);
    ctx.userId = u.rows[0].id;

    // Producto inventariable, stock 0
    const prod = (await setupClient.query(`
      INSERT INTO products (tenant_id, name, sku, price, cost, tax_rate, stock, unit, dian_uom_code, is_inventoriable)
      VALUES ($1, 'CMP-V2-TEST', 'CMP-V2-001', 80000, 0, 19, 0, '94', '94', true)
      RETURNING id, name, sku`, [ctx.tenantId])).rows[0];
    ctx.productId = prod.id;
    log('1) Producto inventariable creado (stock 0)', prod);
    setupClient.release(); setupClient = null;

    // Llamada al servicio real
    const body = {
      supplierName: 'PROVEEDOR TEST V2',
      supplierDocumentNumber: '900555444',
      supplierDocumentType: 'NIT',
      documentType: 'FACTURA_PROVEEDOR',
      documentNumber: 'FC-V2-001',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      paymentForm: 'Contado',
      isElectronic: false,
      items: [
        {
          line_no: 1,
          concept_name: prod.name,
          description: 'Compra inventario test',
          puc_code: '143505',
          puc_name: 'Inventarios',
          quantity: 10,
          unit_price: 50000,
          iva_pct: 19,
          rf_pct: 0,
          product_id: prod.id,
          item_type: 'product',
        },
      ],
    };

    const result = await apService.createAccountsPayableEntry({ tenantId: ctx.tenantId, userId: ctx.userId, body });
    if (!result?.payable) throw new Error(`createAccountsPayableEntry no devolvió payable: ${JSON.stringify(result)}`);
    ctx.payableId = result.payable.id;
    log('2) Payable creada', { id: ctx.payableId, number: result.payable.document_number });

    // Verificar
    const v = await pool.connect();
    try {
      const movs = (await v.query(
        `SELECT id, movement_type, quantity, unit_cost, average_cost, balance_quantity,
                document_type, document_id, journal_entry_id
         FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2 ORDER BY id`,
        [ctx.tenantId, prod.id])).rows;
      log('3) Kardex', movs);
      if (movs.length !== 1) throw new Error(`Esperaba 1 mov, got ${movs.length}`);
      const m = movs[0];
      if (m.movement_type !== 'IN' || m.document_type !== 'FACTURA_PROVEEDOR') throw new Error(`Tipo/document_type incorrecto`);
      if (Number(m.quantity) !== 10) throw new Error(`Qty esperaba 10, got ${m.quantity}`);
      if (Number(m.unit_cost) !== 50000) throw new Error(`unit_cost esperaba 50000, got ${m.unit_cost}`);
      if (Number(m.balance_quantity) !== 10) throw new Error(`balance_qty esperaba 10, got ${m.balance_quantity}`);
      if (!m.journal_entry_id) throw new Error('mov sin journal_entry_id');

      const stock = (await v.query(`SELECT stock, cost FROM products WHERE id = $1`, [prod.id])).rows[0];
      log('4) Producto tras compra', stock);
      if (Number(stock.stock) !== 10) throw new Error(`stock esperaba 10, got ${stock.stock}`);
      if (Number(stock.cost) !== 50000) throw new Error(`cost (avg) esperaba 50000, got ${stock.cost}`);

      // Asiento
      const jeRows = (await v.query(
        `SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'CUENTA_POR_PAGAR' AND document_id::text = $2`,
        [ctx.tenantId, String(ctx.payableId)])).rows;
      if (!jeRows.length) throw new Error('No hay journal de la FC');
      const jelines = (await v.query(
        `SELECT account_code, debit, credit FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id`,
        [jeRows[0].id])).rows;
      log('5) journal_entry_lines FC', jelines);

      const drInv = jelines.find(l => (l.account_code === '143505' || l.account_code === '1435') && Number(l.debit) > 0);
      const crPay = jelines.find(l => l.account_code === '220505' && Number(l.credit) > 0);
      if (!drInv) throw new Error('No hay línea Dr Inventario');
      if (!crPay) throw new Error('No hay línea Cr CxP 220505');
      if (Math.round(Number(drInv.debit)) !== 500000) throw new Error(`Dr Inventario esperaba 500000, got ${drInv.debit}`);

      const totals = jelines.reduce((a, l) => ({ debit: a.debit + Number(l.debit), credit: a.credit + Number(l.credit) }), { debit: 0, credit: 0 });
      log('6) Totales', totals);
      if (Math.round(totals.debit * 100) !== Math.round(totals.credit * 100)) throw new Error(`Asiento no cuadra`);

      console.log('\n>>> COMPRAS V2 (servicio real) VERIFICADO E2E <<<');
    } finally { v.release(); }

  } catch (e) {
    console.error('\n[ERR]', e.message);
    process.exitCode = 1;
  } finally {
    if (setupClient) try { setupClient.release(); } catch (_) {}
    try { const c = await pool.connect(); try { await cleanup(c, ctx); } finally { c.release(); } } catch (_) {}
    await pool.end();
  }
})();
