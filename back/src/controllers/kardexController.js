const db = require('../config/db');
const { insertJournalEntry } = require('../services/accountingCoreService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId || req.body?.tenantId;

const DEFAULT_COST_ACCOUNT = '613595';
const DEFAULT_INVENTORY_ACCOUNT = '143505';

const num = (v) => Number(v || 0);
const round2 = (v) => Math.round(num(v) * 100) / 100;
const round4 = (v) => Math.round(num(v) * 10000) / 10000;

const getSettingsAccounts = async (client, tenantId) => {
  let costAccount = DEFAULT_COST_ACCOUNT;
  let inventoryAccount = DEFAULT_INVENTORY_ACCOUNT;
  try {
    const r = await client.query(
      `SELECT cost_account_code,
              COALESCE(
                (SELECT column_name FROM information_schema.columns
                 WHERE table_name='accounting_settings' AND column_name='inventory_account_code' LIMIT 1),
                NULL
              ) AS has_inv
       FROM accounting_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    if (r.rows[0]) {
      if (r.rows[0].cost_account_code) costAccount = r.rows[0].cost_account_code;
      if (r.rows[0].has_inv) {
        const r2 = await client.query(
          `SELECT inventory_account_code FROM accounting_settings WHERE tenant_id = $1`,
          [tenantId]
        );
        if (r2.rows[0]?.inventory_account_code) inventoryAccount = r2.rows[0].inventory_account_code;
      }
    }
  } catch (_) {}
  return { costAccount, inventoryAccount };
};

const getCurrentBalance = async (client, tenantId, productId) => {
  const r = await client.query(
    `SELECT balance_quantity, balance_value, average_cost
       FROM inventory_movements
      WHERE tenant_id = $1 AND product_id = $2
      ORDER BY movement_date DESC, id DESC
      LIMIT 1`,
    [tenantId, productId]
  );
  if (!r.rows[0]) return { qty: 0, value: 0, avg: 0 };
  return {
    qty: num(r.rows[0].balance_quantity),
    value: num(r.rows[0].balance_value),
    avg: num(r.rows[0].average_cost),
  };
};

const computeNewBalances = (current, type, qty, unitCost) => {
  let newQty = current.qty;
  let newValue = current.value;
  let newAvg = current.avg;

  if (type === 'IN') {
    newQty = current.qty + qty;
    newValue = current.value + qty * unitCost;
    newAvg = newQty > 0 ? newValue / newQty : 0;
  } else if (type === 'OUT') {
    newQty = current.qty - qty;
    newAvg = current.avg;
    newValue = newQty * newAvg;
  } else if (type === 'ADJUST') {
    newQty = current.qty + qty;
    if (qty >= 0) {
      const cost = unitCost > 0 ? unitCost : current.avg;
      newValue = current.value + qty * cost;
      newAvg = newQty > 0 ? newValue / newQty : 0;
    } else {
      newAvg = current.avg;
      newValue = newQty * newAvg;
    }
  }
  return {
    qty: round4(newQty),
    value: round2(newValue),
    avg: round4(newAvg),
  };
};

const insertMovement = async (client, tenantId, payload) => {
  const {
    productId, productCode, productName, date, type, quantity, unitCost,
    documentType, documentId, documentNumber, notes, userId
  } = payload;

  if (!productId) throw new Error('productId requerido');
  if (!['IN', 'OUT', 'ADJUST'].includes(type)) throw new Error('type inválido');
  const qty = round4(quantity);
  if (!qty || qty === 0) throw new Error('quantity requerida');

  let pCode = productCode || null;
  let pName = productName || null;
  try {
    const pr = await client.query(
      `SELECT sku, name, cost FROM products WHERE id = $1 AND tenant_id = $2`,
      [productId, tenantId]
    );
    if (pr.rows[0]) {
      pCode = pCode || pr.rows[0].sku;
      pName = pName || pr.rows[0].name;
      if ((type === 'IN' || type === 'ADJUST') && (!unitCost || Number(unitCost) <= 0) && pr.rows[0].cost) {
        payload.unitCost = num(pr.rows[0].cost);
      }
    }
  } catch (_) {}

  const uCost = round4(payload.unitCost);
  const current = await getCurrentBalance(client, tenantId, productId);

  if (type === 'OUT' && current.qty < qty) {
    throw new Error(`Stock insuficiente: saldo ${current.qty}, salida ${qty}`);
  }

  const balances = computeNewBalances(current, type, qty, uCost);
  const movDate = date || new Date().toISOString().slice(0, 10);

  const ins = await client.query(
    `INSERT INTO inventory_movements (
       tenant_id, product_id, product_code, product_name,
       movement_date, movement_type, quantity, unit_cost, average_cost,
       balance_quantity, balance_value,
       document_type, document_id, document_number, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      tenantId, productId, pCode, pName,
      movDate, type, qty, uCost, balances.avg,
      balances.qty, balances.value,
      documentType || null, documentId || null, documentNumber || null,
      notes || null, userId || null
    ]
  );

  return { movement: ins.rows[0], previous: current, balances };
};

exports.getKardex = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { productId, startDate, endDate } = req.query;
    if (!productId) return res.status(400).json({ success: false, error: 'productId requerido' });

    const params = [tenantId, productId];
    let where = `tenant_id = $1 AND product_id = $2`;
    if (startDate) { params.push(startDate); where += ` AND movement_date >= $${params.length}`; }
    if (endDate) { params.push(endDate); where += ` AND movement_date <= $${params.length}`; }

    const r = await db.query(
      `SELECT * FROM inventory_movements
        WHERE ${where}
        ORDER BY movement_date ASC, id ASC`,
      params
    );

    const last = await db.query(
      `SELECT balance_quantity, balance_value, average_cost, movement_date
         FROM inventory_movements
        WHERE tenant_id = $1 AND product_id = $2
        ORDER BY movement_date DESC, id DESC
        LIMIT 1`,
      [tenantId, productId]
    );

    res.json({
      success: true,
      movements: r.rows,
      currentBalance: last.rows[0] || { balance_quantity: 0, balance_value: 0, average_cost: 0 },
    });
  } catch (e) {
    console.error('[Kardex] getKardex error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const r = await db.query(
      `WITH last_mov AS (
         SELECT DISTINCT ON (product_id)
           product_id, balance_quantity, balance_value, average_cost,
           product_code, product_name, movement_date
         FROM inventory_movements
         WHERE tenant_id = $1 AND movement_date <= $2
         ORDER BY product_id, movement_date DESC, id DESC
       )
       SELECT p.id AS product_id,
              COALESCE(p.sku, lm.product_code) AS code,
              COALESCE(p.name, lm.product_name) AS name,
              COALESCE(lm.balance_quantity, 0) AS quantity,
              COALESCE(lm.average_cost, 0) AS average_cost,
              COALESCE(lm.balance_value, 0) AS total_value,
              lm.movement_date AS last_movement_date
         FROM products p
         LEFT JOIN last_mov lm ON lm.product_id = p.id
        WHERE p.tenant_id = $1
        ORDER BY p.name`,
      [tenantId, date]
    );

    let totalValue = 0;
    let totalUnits = 0;
    r.rows.forEach((row) => {
      totalValue += num(row.total_value);
      totalUnits += num(row.quantity);
    });

    res.json({ success: true, items: r.rows, totals: { totalValue: round2(totalValue), totalUnits: round4(totalUnits) }, date });
  } catch (e) {
    console.error('[Kardex] getSummary error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};

// Helper interno (sin BEGIN/COMMIT) para que pueda ser llamado desde otros controllers
// que ya tienen su propia transacción abierta (ej. invoiceController.createInvoice).
const recordMovementInline = async (client, tenantId, payload) => {
  const result = await insertMovement(client, tenantId, payload);
  let journal = null;
  const { costAccount, inventoryAccount } = await getSettingsAccounts(client, tenantId);

  const unitCost = num(payload.unitCost) || num(result.movement.average_cost);
  const qty = num(result.movement.quantity);
  const totalValue = round2(qty * unitCost);

  if (payload.type === 'OUT') {
    const costValue = round2(qty * num(result.movement.average_cost));
    if (costValue > 0) {
      const description = `Costo de venta - ${result.movement.product_name || ('Producto ' + payload.productId)}` +
        (payload.documentNumber ? ` (${payload.documentNumber})` : '');
      journal = await insertJournalEntry(client, tenantId, {
        description,
        documentType: 'KARDEX_OUT',
        documentId: result.movement.id,
        documentNumber: payload.documentNumber || `KX-${result.movement.id}`,
        entryDate: result.movement.movement_date,
        userId: payload.userId,
        lines: [
          { account_code: costAccount, debit: costValue, credit: 0, description },
          { account_code: inventoryAccount, debit: 0, credit: costValue, description },
        ],
      });
    }
  } else if (payload.type === 'IN' && totalValue > 0) {
    // D inventario / C CxP (compra) — contrapartida por defecto: proveedores 220505
    let payableAccount = '220505';
    try {
      const sr = await client.query(
        `SELECT accounts_payable_code FROM accounting_settings WHERE tenant_id = $1`,
        [tenantId]
      );
      if (sr.rows[0]?.accounts_payable_code) payableAccount = sr.rows[0].accounts_payable_code;
    } catch (_) {}

    const description = `Entrada inventario - ${result.movement.product_name || ('Producto ' + payload.productId)}` +
      (payload.documentNumber ? ` (${payload.documentNumber})` : '');
    journal = await insertJournalEntry(client, tenantId, {
      description,
      documentType: 'KARDEX_IN',
      documentId: result.movement.id,
      documentNumber: payload.documentNumber || `KX-${result.movement.id}`,
      entryDate: result.movement.movement_date,
      userId: payload.userId,
      lines: [
        { account_code: inventoryAccount, debit: totalValue, credit: 0, description },
        { account_code: payableAccount, debit: 0, credit: totalValue, description },
      ],
    });
  } else if (payload.type === 'ADJUST' && totalValue !== 0) {
    // Ajuste positivo → D inventario / C ingreso por ajuste
    // Ajuste negativo → D pérdida / C inventario
    const adjustAccount = '429581'; // Ajustes e ingresos diversos
    const lossAccount = '531005';   // Pérdida/ajuste
    const abs = Math.abs(totalValue);
    const description = `Ajuste inventario - ${result.movement.product_name || ('Producto ' + payload.productId)}` +
      (payload.documentNumber ? ` (${payload.documentNumber})` : '');
    const lines = totalValue > 0
      ? [
          { account_code: inventoryAccount, debit: abs, credit: 0, description },
          { account_code: adjustAccount, debit: 0, credit: abs, description },
        ]
      : [
          { account_code: lossAccount, debit: abs, credit: 0, description },
          { account_code: inventoryAccount, debit: 0, credit: abs, description },
        ];
    journal = await insertJournalEntry(client, tenantId, {
      description,
      documentType: 'KARDEX_ADJUST',
      documentId: result.movement.id,
      documentNumber: payload.documentNumber || `KX-${result.movement.id}`,
      entryDate: result.movement.movement_date,
      userId: payload.userId,
      lines,
    });
  }

  if (journal) {
    await client.query(
      `UPDATE inventory_movements SET journal_entry_id = $1 WHERE id = $2`,
      [journal.id, result.movement.id]
    );
  }

  try {
    await client.query(
      `UPDATE products
          SET stock = $1,
              cost = CASE WHEN $2 > 0 THEN $2 ELSE cost END,
              updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4`,
      [Math.round(num(result.balances.qty)), num(result.balances.avg), payload.productId, tenantId]
    );
  } catch (_) {}

  return { movement: result.movement, journal };
};

exports.recordMovementInline = recordMovementInline;

// Variante "raw" que NO crea asiento contable. Sirve para flujos donde el asiento
// ya lo genera otro controlador (ej. accounts_payable al crear/editar/anular FC) y
// sólo necesitamos persistir el movimiento de inventario y refrescar stock/avg.
exports.insertMovementRaw = async (client, tenantId, payload) => {
  const result = await insertMovement(client, tenantId, payload);
  try {
    await client.query(
      `UPDATE products
          SET stock = $1,
              cost = CASE WHEN $2 > 0 THEN $2 ELSE cost END,
              updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4`,
      [Math.round(num(result.balances.qty)), num(result.balances.avg), payload.productId, tenantId]
    );
  } catch (_) { /* ignore */ }
  return result;
};

exports.recordMovement = async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const tenantId = resolveTenantId(req);
    if (!tenantId) throw new Error('Tenant no encontrado');

    const payload = {
      productId: req.body?.productId,
      productCode: req.body?.productCode,
      productName: req.body?.productName,
      date: req.body?.date,
      type: req.body?.type,
      quantity: req.body?.quantity,
      unitCost: req.body?.unitCost,
      documentType: req.body?.documentType,
      documentId: req.body?.documentId,
      documentNumber: req.body?.documentNumber,
      notes: req.body?.notes,
      userId: req.user?.id || null,
    };

    const { movement, journal } = await recordMovementInline(client, tenantId, payload);

    await client.query('COMMIT');
    res.status(201).json({ success: true, movement, journal });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Kardex] recordMovement error:', e);
    const status = /requerid|inválido|insuficiente|cuadrar|periodo/i.test(e.message) ? 400 : 500;
    res.status(status).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
};

exports.physicalCount = async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const tenantId = resolveTenantId(req);
    const { productId, actualQuantity, notes, date } = req.body || {};
    if (!productId) throw new Error('productId requerido');
    if (actualQuantity === undefined || actualQuantity === null) throw new Error('actualQuantity requerida');

    const current = await getCurrentBalance(client, tenantId, productId);
    const diff = round4(num(actualQuantity) - current.qty);

    if (diff === 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: 'Sin diferencia, no se generó ajuste', current });
    }

    // Usamos recordMovementInline para que el ajuste también genere asiento contable
    // (D Inventario / C Ingreso por ajuste, o D Pérdida / C Inventario según signo).
    const { movement, journal } = await recordMovementInline(client, tenantId, {
      productId,
      date: date || new Date().toISOString().slice(0, 10),
      type: 'ADJUST',
      quantity: diff,
      unitCost: current.avg,
      documentType: 'PHYSICAL_COUNT',
      documentNumber: `CONT-${Date.now()}`,
      notes: notes || `Conteo físico: registrado ${current.qty}, contado ${actualQuantity}`,
      userId: req.user?.id || null,
    });

    await client.query('COMMIT');
    res.status(201).json({ success: true, movement, journal, difference: diff });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Kardex] physicalCount error:', e);
    const status = /requerid|inválido|insuficiente/i.test(e.message) ? 400 : 500;
    res.status(status).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
};
