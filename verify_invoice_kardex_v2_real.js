// verify_invoice_kardex_v2_real.js
// E2E: invoca invoiceController.createInvoice DIRECTAMENTE (post-patch v2).
// Verifica: invoice_items con product_id, inventory_movements OUT con journal_entry_id,
// journal_entries con líneas Dr 613595 / Cr 143505.
// Limpia las filas que crea al final.

require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { pool } = require(path.join(__dirname, 'src', 'config', 'db'));
const invoiceController = require(path.join(__dirname, 'src', 'controllers', 'invoiceController'));

const log = (l, v) => console.log(`\n=== ${l} ===\n` + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));

const cleanup = async (client, ctx) => {
  try {
    if (ctx.invoiceId) {
      // Buscar journal_entry y AR de esta invoice
      // journal_entries.document_id es varchar — comparamos como texto
      const je = await client.query(
        `SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'FACTURA_VENTA' AND document_id::text = $2`,
        [ctx.tenantId, String(ctx.invoiceId)]);
      for (const r of je.rows) {
        await client.query(`DELETE FROM journal_entry_lines WHERE journal_entry_id = $1`, [r.id]);
        await client.query(`DELETE FROM journal_entries WHERE id = $1`, [r.id]);
      }
      // accounts_receivable apunta a invoice_id (FK), no source_type/source_id
      await client.query(`DELETE FROM accounts_receivable WHERE tenant_id = $1 AND invoice_id = $2`, [ctx.tenantId, ctx.invoiceId]);
      await client.query(`DELETE FROM inventory_movements WHERE tenant_id = $1 AND document_type = 'INVOICE' AND document_id = $2`, [ctx.tenantId, ctx.invoiceId]);
      await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [ctx.invoiceId]);
      await client.query(`DELETE FROM invoices WHERE id = $1`, [ctx.invoiceId]);
    }
    if (ctx.productId) {
      await client.query(`DELETE FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2`, [ctx.tenantId, ctx.productId]);
      await client.query(`DELETE FROM products WHERE id = $1`, [ctx.productId]);
    }
    if (ctx.thirdPartyId) {
      await client.query(`DELETE FROM third_parties WHERE id = $1`, [ctx.thirdPartyId]);
    }
    log('CLEANUP', 'OK');
  } catch (e) {
    console.error('[cleanup] ERR:', e.message);
  }
};

(async () => {
  const ctx = {};
  const client = await pool.connect();
  try {
    // Tenant + user
    const t = await client.query(`SELECT id FROM tenants ORDER BY id LIMIT 1`);
    ctx.tenantId = t.rows[0].id;
    const u = await client.query(`SELECT id FROM users WHERE tenant_id = $1 ORDER BY id LIMIT 1`, [ctx.tenantId]);
    if (!u.rows[0]) throw new Error(`No hay user para tenant ${ctx.tenantId}`);
    ctx.userId = u.rows[0].id;
    log('Tenant/user', { tenantId: ctx.tenantId, userId: ctx.userId });

    // Producto inventariable con stock previo (vía IN directo)
    const prod = (await client.query(`
      INSERT INTO products (tenant_id, name, sku, price, cost, tax_rate, stock, unit, dian_uom_code, is_inventoriable, visible_in_invoices)
      VALUES ($1, 'KX-V2-TEST', 'KX-V2-001', 50000, 30000, 19, 0, '94', '94', true, true)
      RETURNING id, name, sku, cost`, [ctx.tenantId])).rows[0];
    ctx.productId = prod.id;

    // Sembramos kardex IN (vía SQL directo — apertura)
    await client.query(`
      INSERT INTO inventory_movements (tenant_id, product_id, product_code, product_name, movement_date, movement_type,
        quantity, unit_cost, average_cost, balance_quantity, balance_value, document_type, document_number, notes)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, 'IN', 20, 30000, 30000, 20, 600000, 'OPENING', 'OPN-V2', 'Apertura test')`,
      [ctx.tenantId, prod.id, prod.sku, prod.name]);
    await client.query(`UPDATE products SET stock = 20 WHERE id = $1`, [prod.id]);
    log('Producto + apertura', { ...prod, stock: 20 });

    client.release(); // El controller toma su propio client de pool

    // Mock req / res — body con productId real para forzar flujo kardex
    const body = {
      clientName: 'CLIENTE TEST V2',
      clientId: '900999888',
      clientDocType: 'NIT',
      email: 'test@example.com',
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Contado',
      paymentMeanCode: '10',
      notes: 'verify v2',
      items: [
        {
          productId: prod.id,
          item: prod.name,
          description: prod.name,
          quantity: 5,
          unitPrice: 50000,
          tax: 19,
          discount: 0,
          unit: 'und',
        },
      ],
    };

    const req = {
      body,
      user: { id: ctx.userId, tenant_id: ctx.tenantId },
      ip: '127.0.0.1',
      headers: {},
    };

    let captured = { status: 200, payload: null };
    const res = {
      status(code) { captured.status = code; return this; },
      json(p) { captured.payload = p; return this; },
    };

    await invoiceController.createInvoice(req, res);
    log('Controller respondió', captured);

    if (!captured.payload || !captured.payload.invoice) {
      throw new Error(`Controller no devolvió invoice. status=${captured.status} body=${JSON.stringify(captured.payload)}`);
    }
    ctx.invoiceId = captured.payload.invoice.id;

    // Reabrimos client para verificar
    const v = await pool.connect();
    try {
      // 1) invoice_items con product_id
      const items = (await v.query(
        `SELECT id, invoice_id, product_id, service_id, item_type, unit_cost, quantity, unit_price
         FROM invoice_items WHERE invoice_id = $1`, [ctx.invoiceId])).rows;
      log('1) invoice_items', items);
      if (!items.length || items[0].product_id !== prod.id || items[0].item_type !== 'product') {
        throw new Error('invoice_items no quedó con product_id/item_type correctos');
      }

      // 2) inventory_movements OUT con journal_entry_id != NULL
      const movs = (await v.query(
        `SELECT id, movement_type, quantity, unit_cost, average_cost, balance_quantity, balance_value,
                document_type, document_id, journal_entry_id
         FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2 ORDER BY id`,
        [ctx.tenantId, prod.id])).rows;
      log('2) inventory_movements', movs);
      const outMov = movs.find(m => m.document_type === 'INVOICE' && m.document_id === ctx.invoiceId);
      if (!outMov) throw new Error('No hay inventory_movements OUT para esta factura');
      if (Number(outMov.quantity) !== 5) throw new Error(`OUT qty esperaba 5, got ${outMov.quantity}`);
      if (Number(outMov.balance_quantity) !== 15) throw new Error(`balance_quantity esperaba 15, got ${outMov.balance_quantity}`);
      if (!outMov.journal_entry_id) throw new Error('OUT sin journal_entry_id (vinculación falló)');

      // 3) products.stock = 15
      const stock = (await v.query(`SELECT stock FROM products WHERE id = $1`, [prod.id])).rows[0];
      log('3) products.stock', stock);
      if (Number(stock.stock) !== 15) throw new Error(`stock esperaba 15, got ${stock.stock}`);

      // 4) journal con líneas COGS Dr 613595 / Cr 143505
      const jeRows = (await v.query(
        `SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'FACTURA_VENTA' AND document_id = $2`,
        [ctx.tenantId, ctx.invoiceId])).rows;
      if (!jeRows.length) throw new Error('No hay journal_entries de la FV');
      const jelines = (await v.query(
        `SELECT account_code, debit, credit, description FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id`,
        [jeRows[0].id])).rows;
      log('4) journal_entry_lines', jelines);

      const cogsLine = jelines.find(l => l.account_code === '613595' || l.account_code === '6135');
      const invLine = jelines.find(l => l.account_code === '143505' || l.account_code === '1435');
      if (!cogsLine) throw new Error('No hay línea Dr 613595/6135 (Costo de ventas)');
      if (!invLine) throw new Error('No hay línea Cr 143505/1435 (Inventario)');
      const expectedCv = 5 * 30000;
      if (Math.round(Number(cogsLine.debit)) !== expectedCv) throw new Error(`Dr Costo esperaba ${expectedCv}, got ${cogsLine.debit}`);
      if (Math.round(Number(invLine.credit)) !== expectedCv) throw new Error(`Cr Inventario esperaba ${expectedCv}, got ${invLine.credit}`);

      // 5) Verificar cuadre del journal completo (sum debit == sum credit)
      const totals = jelines.reduce((a, l) => ({ debit: a.debit + Number(l.debit), credit: a.credit + Number(l.credit) }), { debit: 0, credit: 0 });
      log('5) Totales journal', totals);
      if (Math.round(totals.debit * 100) !== Math.round(totals.credit * 100)) {
        throw new Error(`Journal NO cuadra: Dr ${totals.debit} vs Cr ${totals.credit}`);
      }

      console.log('\n>>> PATCH v2 VERIFICADO E2E <<<');
    } finally {
      v.release();
    }

  } catch (e) {
    console.error('\n[ERR]', e.message);
    process.exitCode = 1;
  } finally {
    // Cleanup en client nuevo
    try {
      const c = await pool.connect();
      try { await cleanup(c, ctx); } finally { c.release(); }
    } catch (_) {}
    await pool.end();
  }
})();
