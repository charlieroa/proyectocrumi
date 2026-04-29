// verify_creditnote_kardex_v2_real.js
// E2E: invoca creditNoteController.createCreditNote DIRECTAMENTE (post-patch v1).
// Setup: producto + apertura kardex + factura origen (vía invoiceController).
// Verifica:
//  - inventory_movements IN con document_type='CREDIT_NOTE' y journal_entry_id != null
//  - products.stock recuperado
//  - asiento NC tiene Dr 143505 / Cr 613595 (reverso COGS)
//  - asiento cuadra
// Cleanup al final.

require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { pool } = require(path.join(__dirname, 'src', 'config', 'db'));
const invoiceController = require(path.join(__dirname, 'src', 'controllers', 'invoiceController'));
const creditNoteController = require(path.join(__dirname, 'src', 'controllers', 'creditNoteController'));

const log = (l, v) => console.log(`\n=== ${l} ===\n` + (typeof v === 'string' ? v : JSON.stringify(v, null, 2)));

const cleanup = async (client, ctx) => {
  try {
    if (ctx.creditNoteId) {
      await client.query(`DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'NOTA_CREDITO' AND document_id::text = $2)`,
        [ctx.tenantId, String(ctx.creditNoteId)]);
      await client.query(`DELETE FROM journal_entries WHERE tenant_id = $1 AND document_type = 'NOTA_CREDITO' AND document_id::text = $2`,
        [ctx.tenantId, String(ctx.creditNoteId)]);
      await client.query(`DELETE FROM inventory_movements WHERE tenant_id = $1 AND document_type = 'CREDIT_NOTE' AND document_id = $2`, [ctx.tenantId, ctx.creditNoteId]);
      await client.query(`DELETE FROM credit_note_items WHERE credit_note_id = $1`, [ctx.creditNoteId]);
      await client.query(`DELETE FROM credit_notes WHERE id = $1`, [ctx.creditNoteId]);
    }
    if (ctx.invoiceId) {
      await client.query(`DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'FACTURA_VENTA' AND document_id::text = $2)`,
        [ctx.tenantId, String(ctx.invoiceId)]);
      await client.query(`DELETE FROM journal_entries WHERE tenant_id = $1 AND document_type = 'FACTURA_VENTA' AND document_id::text = $2`,
        [ctx.tenantId, String(ctx.invoiceId)]);
      await client.query(`DELETE FROM accounts_receivable WHERE tenant_id = $1 AND invoice_id = $2`, [ctx.tenantId, ctx.invoiceId]);
      await client.query(`DELETE FROM inventory_movements WHERE tenant_id = $1 AND document_type = 'INVOICE' AND document_id = $2`, [ctx.tenantId, ctx.invoiceId]);
      await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [ctx.invoiceId]);
      await client.query(`DELETE FROM invoices WHERE id = $1`, [ctx.invoiceId]);
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

    // Producto + apertura
    const prod = (await setupClient.query(`
      INSERT INTO products (tenant_id, name, sku, price, cost, tax_rate, stock, unit, dian_uom_code, is_inventoriable, visible_in_invoices)
      VALUES ($1, 'NC-V2-TEST', 'NC-V2-001', 60000, 40000, 19, 0, '94', '94', true, true)
      RETURNING id, name, sku, cost`, [ctx.tenantId])).rows[0];
    ctx.productId = prod.id;
    await setupClient.query(`
      INSERT INTO inventory_movements (tenant_id, product_id, product_code, product_name, movement_date, movement_type,
        quantity, unit_cost, average_cost, balance_quantity, balance_value, document_type, document_number)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, 'IN', 10, 40000, 40000, 10, 400000, 'OPENING', 'OPN-NC-V2')`,
      [ctx.tenantId, prod.id, prod.sku, prod.name]);
    await setupClient.query(`UPDATE products SET stock = 10 WHERE id = $1`, [prod.id]);
    log('1) Producto + apertura', { ...prod, stock: 10 });
    setupClient.release(); setupClient = null;

    // 2) Crear FV vía controller (5 unidades) → kardex OUT y asiento con COGS
    const reqFv = {
      body: {
        clientName: 'CLIENTE NC V2',
        clientId: '900111222',
        clientDocType: 'NIT',
        email: 'nc@example.com',
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'Contado',
        paymentMeanCode: '10',
        notes: 'verify creditnote v2',
        items: [{
          productId: prod.id,
          item: prod.name, description: prod.name,
          quantity: 5, unitPrice: 60000, tax: 19, discount: 0, unit: 'und',
        }],
      },
      user: { id: ctx.userId, tenant_id: ctx.tenantId },
      ip: '127.0.0.1', headers: {},
    };
    let fvCap = { status: 200, payload: null };
    const resFv = { status(c){fvCap.status=c;return this;}, json(p){fvCap.payload=p;return this;} };
    await invoiceController.createInvoice(reqFv, resFv);
    if (!fvCap.payload?.invoice) throw new Error(`createInvoice falló: ${JSON.stringify(fvCap.payload)}`);
    ctx.invoiceId = fvCap.payload.invoice.id;
    const invoiceNumber = fvCap.payload.invoice.number;
    log('2) FV creada', { invoiceId: ctx.invoiceId, invoiceNumber });

    // 3) Crear NC de devolución parcial (2 unidades, motivo 1) vía controller
    const reqNc = {
      body: {
        invoiceId: ctx.invoiceId,
        invoiceNumber,
        clientName: 'CLIENTE NC V2',
        clientNit: '900111222',
        clientDocType: 'NIT',
        clientEmail: 'nc@example.com',
        date: new Date().toISOString().slice(0, 10),
        notes: 'Devolución parcial test v2',
        reason: '1', // DIAN concept 1 = devolución
        items: [{
          productId: prod.id,
          description: prod.name,
          quantity: 2,
          unitPrice: 60000,
          taxRate: 19,
          discount: 0,
        }],
      },
      user: { id: ctx.userId, tenant_id: ctx.tenantId },
      ip: '127.0.0.1', headers: {},
    };
    let ncCap = { status: 200, payload: null };
    const resNc = { status(c){ncCap.status=c;return this;}, json(p){ncCap.payload=p;return this;} };
    await creditNoteController.createCreditNote(reqNc, resNc);
    if (!ncCap.payload?.creditNote) throw new Error(`createCreditNote falló: ${JSON.stringify(ncCap.payload)}`);
    ctx.creditNoteId = ncCap.payload.creditNote.id;
    const ncNumber = ncCap.payload.creditNote.number;
    log('3) NC creada', { creditNoteId: ctx.creditNoteId, ncNumber });

    // 4) Verificar kardex tiene 3 movs, último IN con CREDIT_NOTE + journal_entry_id
    const v = await pool.connect();
    try {
      const movs = (await v.query(
        `SELECT id, movement_type, quantity, unit_cost, balance_quantity, document_type, document_id, journal_entry_id
         FROM inventory_movements WHERE tenant_id = $1 AND product_id = $2 ORDER BY id`,
        [ctx.tenantId, prod.id])).rows;
      log('4) Kardex completo', movs);
      if (movs.length !== 3) throw new Error(`Esperaba 3 movs, got ${movs.length}`);
      const ncMov = movs[2];
      if (ncMov.movement_type !== 'IN' || ncMov.document_type !== 'CREDIT_NOTE') throw new Error(`Último mov no es IN CREDIT_NOTE`);
      if (Number(ncMov.quantity) !== 2) throw new Error(`Qty IN esperaba 2, got ${ncMov.quantity}`);
      if (Number(ncMov.balance_quantity) !== 7) throw new Error(`balance_qty esperaba 7 (10-5+2), got ${ncMov.balance_quantity}`);
      if (!ncMov.journal_entry_id) throw new Error(`NC mov sin journal_entry_id`);
      if (Number(ncMov.unit_cost) !== 40000) throw new Error(`unit_cost NC esperaba 40000 (costo de la salida), got ${ncMov.unit_cost}`);

      // 5) products.stock = 7
      const stock = (await v.query(`SELECT stock FROM products WHERE id = $1`, [prod.id])).rows[0];
      if (Number(stock.stock) !== 7) throw new Error(`stock esperaba 7, got ${stock.stock}`);
      log('5) products.stock', stock);

      // 6) Asiento NC: Dr 143505 / Cr 613595 = 80000 (2 * 40000)
      const jeRows = (await v.query(
        `SELECT id FROM journal_entries WHERE tenant_id = $1 AND document_type = 'NOTA_CREDITO' AND document_id::text = $2`,
        [ctx.tenantId, String(ctx.creditNoteId)])).rows;
      if (!jeRows.length) throw new Error('No hay journal de la NC');
      const jelines = (await v.query(
        `SELECT account_code, debit, credit FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id`,
        [jeRows[0].id])).rows;
      log('6) journal_entry_lines NC', jelines);

      const drInv = jelines.find(l => l.account_code === '143505' && Number(l.debit) > 0);
      const crCogs = jelines.find(l => l.account_code === '613595' && Number(l.credit) > 0);
      if (!drInv) throw new Error('No hay línea Dr 143505 (recupera inventario)');
      if (!crCogs) throw new Error('No hay línea Cr 613595 (reverso COGS)');
      if (Math.round(Number(drInv.debit)) !== 80000) throw new Error(`Dr Inventario esperaba 80000, got ${drInv.debit}`);
      if (Math.round(Number(crCogs.credit)) !== 80000) throw new Error(`Cr COGS esperaba 80000, got ${crCogs.credit}`);

      // 7) Cuadre del asiento
      const totals = jelines.reduce((a, l) => ({ debit: a.debit + Number(l.debit), credit: a.credit + Number(l.credit) }), { debit: 0, credit: 0 });
      log('7) Totales asiento NC', totals);
      if (Math.round(totals.debit * 100) !== Math.round(totals.credit * 100)) throw new Error(`Asiento NC no cuadra: Dr ${totals.debit} vs Cr ${totals.credit}`);

      console.log('\n>>> PATCH NC v1 VERIFICADO E2E <<<');
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
