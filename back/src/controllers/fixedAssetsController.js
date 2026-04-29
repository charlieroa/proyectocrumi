const db = require('../config/db');
const {
    ensureAccountExists,
    insertJournalEntry,
    getDefaultAccountName,
} = require('../services/accountingCoreService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const calcMonthlyDep = (asset) => {
    const cost = Number(asset.acquisition_cost || 0);
    const salvage = Number(asset.salvage_value || 0);
    const life = Number(asset.useful_life_months || 0);
    if (life <= 0) return 0;
    return Math.round(((cost - salvage) / life) * 100) / 100;
};

const enrichAsset = (a) => {
    const cost = Number(a.acquisition_cost || 0);
    const acc = Number(a.accumulated_depreciation || 0);
    const monthly = calcMonthlyDep(a);
    const bookValue = Math.max(0, Math.round((cost - acc) * 100) / 100);
    const monthsRemaining = monthly > 0
        ? Math.max(0, Math.ceil((cost - Number(a.salvage_value || 0) - acc) / monthly))
        : 0;
    return {
        ...a,
        book_value: bookValue,
        monthly_depreciation: monthly,
        months_remaining: monthsRemaining,
    };
};

const listFixedAssets = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const result = await db.query(
            `SELECT * FROM fixed_assets WHERE tenant_id = $1 ORDER BY created_at DESC`,
            [tenantId]
        );
        const assets = result.rows.map(enrichAsset);
        res.json({ success: true, assets });
    } catch (error) {
        console.error('[FixedAssets] list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAsset = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const result = await db.query(
            `SELECT * FROM fixed_assets WHERE tenant_id = $1 AND id = $2`,
            [tenantId, id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'No encontrado' });
        res.json({ success: true, asset: enrichAsset(result.rows[0]) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createFixedAsset = async (req, res) => {
    const client = await db.getClient();
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const {
            code, name, description, category,
            acquisition_date, acquisition_cost,
            useful_life_months, salvage_value = 0,
            asset_account_code, dep_accumulated_account_code, dep_expense_account_code,
            notes,
        } = req.body || {};

        if (!name || !acquisition_date || !acquisition_cost) {
            return res.status(400).json({ success: false, error: 'Nombre, fecha de adquisición y costo son obligatorios' });
        }
        if (!Number(useful_life_months) || Number(useful_life_months) <= 0) {
            return res.status(400).json({ success: false, error: 'La vida útil en meses debe ser mayor que cero' });
        }
        if (!asset_account_code || !dep_accumulated_account_code || !dep_expense_account_code) {
            return res.status(400).json({ success: false, error: 'Las tres cuentas PUC son obligatorias' });
        }

        await client.query('BEGIN');
        await ensureAccountExists(client, tenantId, asset_account_code);
        await ensureAccountExists(client, tenantId, dep_accumulated_account_code);
        await ensureAccountExists(client, tenantId, dep_expense_account_code);

        const result = await client.query(
            `INSERT INTO fixed_assets (
                tenant_id, code, name, description, category,
                acquisition_date, acquisition_cost, useful_life_months, depreciation_method,
                salvage_value, accumulated_depreciation,
                asset_account_code, dep_accumulated_account_code, dep_expense_account_code,
                status, notes, created_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'LINEAR',$9,0,$10,$11,$12,'ACTIVO',$13,$14)
             RETURNING *`,
            [
                tenantId, code || null, name, description || null, category || 'OTRO',
                acquisition_date, acquisition_cost, useful_life_months,
                salvage_value || 0,
                asset_account_code, dep_accumulated_account_code, dep_expense_account_code,
                notes || null, userId,
            ]
        );
        await client.query('COMMIT');
        res.status(201).json({ success: true, asset: enrichAsset(result.rows[0]) });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[FixedAssets] create error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const updateFixedAsset = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const fields = [
            'code', 'name', 'description', 'category',
            'acquisition_date', 'acquisition_cost', 'useful_life_months', 'salvage_value',
            'asset_account_code', 'dep_accumulated_account_code', 'dep_expense_account_code',
            'notes', 'status',
        ];
        const sets = [];
        const vals = [];
        let i = 1;
        for (const f of fields) {
            if (req.body[f] !== undefined) {
                sets.push(`${f} = $${i++}`);
                vals.push(req.body[f]);
            }
        }
        if (!sets.length) return res.status(400).json({ success: false, error: 'Nada que actualizar' });
        sets.push(`updated_at = NOW()`);
        vals.push(tenantId, id);
        const sql = `UPDATE fixed_assets SET ${sets.join(', ')} WHERE tenant_id = $${i++} AND id = $${i} RETURNING *`;
        const result = await db.query(sql, vals);
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'No encontrado' });
        res.json({ success: true, asset: enrichAsset(result.rows[0]) });
    } catch (error) {
        console.error('[FixedAssets] update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const disposeFixedAsset = async (req, res) => {
    const client = await db.getClient();
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const { id } = req.params;
        const { disposal_date, disposal_value = 0, generate_journal = true } = req.body || {};

        await client.query('BEGIN');
        const r = await client.query(
            `SELECT * FROM fixed_assets WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
            [tenantId, id]
        );
        if (!r.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'No encontrado' });
        }
        const asset = r.rows[0];
        if (asset.status !== 'ACTIVO') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'El activo ya está dado de baja' });
        }

        const cost = Number(asset.acquisition_cost || 0);
        const acc = Number(asset.accumulated_depreciation || 0);
        const bookValue = Math.max(0, Math.round((cost - acc) * 100) / 100);
        const dispVal = Number(disposal_value || 0);
        const loss = Math.max(0, Math.round((bookValue - dispVal) * 100) / 100);

        let journal = null;
        if (generate_journal && cost > 0) {
            const lines = [];
            if (acc > 0) {
                lines.push({
                    account_code: asset.dep_accumulated_account_code,
                    account_name: getDefaultAccountName(asset.dep_accumulated_account_code),
                    description: `Baja activo ${asset.name}`,
                    debit: acc,
                    credit: 0,
                });
            }
            if (loss > 0) {
                lines.push({
                    account_code: '531005',
                    account_name: 'PERDIDA EN VENTA Y RETIRO DE BIENES',
                    description: `Pérdida en baja ${asset.name}`,
                    debit: loss,
                    credit: 0,
                });
            }
            if (dispVal > 0) {
                lines.push({
                    account_code: '110505',
                    account_name: 'CAJA GENERAL',
                    description: `Recuperación por baja ${asset.name}`,
                    debit: dispVal,
                    credit: 0,
                });
            }
            lines.push({
                account_code: asset.asset_account_code,
                account_name: getDefaultAccountName(asset.asset_account_code),
                description: `Baja activo ${asset.name}`,
                debit: 0,
                credit: cost,
            });

            journal = await insertJournalEntry(client, tenantId, {
                description: `Baja de activo fijo: ${asset.name}`,
                documentType: 'BAJA_ACTIVO_FIJO',
                documentId: String(asset.id),
                documentNumber: asset.code || `AF-${asset.id}`,
                entryDate: disposal_date || new Date(),
                lines,
                userId,
            });
        }

        const upd = await client.query(
            `UPDATE fixed_assets SET status = 'DADO_DE_BAJA',
                disposal_date = $1, disposal_value = $2, updated_at = NOW()
             WHERE tenant_id = $3 AND id = $4 RETURNING *`,
            [disposal_date || new Date(), dispVal, tenantId, id]
        );

        await client.query('COMMIT');
        res.json({ success: true, asset: enrichAsset(upd.rows[0]), journal });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[FixedAssets] dispose error:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const depreciateMonth = async (req, res) => {
    const client = await db.getClient();
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const now = new Date();
        const year = Number(req.body?.year) || now.getFullYear();
        const month = Number(req.body?.month) || (now.getMonth() + 1);

        if (month < 1 || month > 12) {
            return res.status(400).json({ success: false, error: 'Mes inválido' });
        }

        await client.query('BEGIN');

        const assetsRes = await client.query(
            `SELECT * FROM fixed_assets
             WHERE tenant_id = $1 AND status = 'ACTIVO'
             ORDER BY id`,
            [tenantId]
        );
        const assets = assetsRes.rows;

        if (!assets.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'No hay activos fijos para depreciar' });
        }

        const existing = await client.query(
            `SELECT asset_id FROM fixed_asset_depreciations
             WHERE tenant_id = $1 AND period_year = $2 AND period_month = $3`,
            [tenantId, year, month]
        );
        const depreciatedSet = new Set(existing.rows.map(r => r.asset_id));

        const toProcess = [];
        for (const a of assets) {
            if (depreciatedSet.has(a.id)) continue;
            const monthly = calcMonthlyDep(a);
            const cost = Number(a.acquisition_cost || 0);
            const salvage = Number(a.salvage_value || 0);
            const acc = Number(a.accumulated_depreciation || 0);
            const remaining = Math.max(0, Math.round((cost - salvage - acc) * 100) / 100);
            const amount = Math.min(monthly, remaining);
            if (amount <= 0) continue;
            toProcess.push({ asset: a, amount: Math.round(amount * 100) / 100 });
        }

        if (!toProcess.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Ya fue depreciado este mes o no hay saldo a depreciar' });
        }

        const groups = new Map();
        for (const { asset, amount } of toProcess) {
            const key = `${asset.dep_expense_account_code}|${asset.dep_accumulated_account_code}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    expense: asset.dep_expense_account_code,
                    accum: asset.dep_accumulated_account_code,
                    total: 0,
                });
            }
            groups.get(key).total += amount;
        }

        const lines = [];
        for (const g of groups.values()) {
            const t = Math.round(g.total * 100) / 100;
            lines.push({
                account_code: g.expense,
                account_name: getDefaultAccountName(g.expense),
                description: `Gasto depreciación ${year}-${String(month).padStart(2, '0')}`,
                debit: t, credit: 0,
            });
        }
        for (const g of groups.values()) {
            const t = Math.round(g.total * 100) / 100;
            lines.push({
                account_code: g.accum,
                account_name: getDefaultAccountName(g.accum),
                description: `Depreciación acumulada ${year}-${String(month).padStart(2, '0')}`,
                debit: 0, credit: t,
            });
        }

        const periodEnd = new Date(year, month, 0);

        const journal = await insertJournalEntry(client, tenantId, {
            description: `Depreciación mensual ${year}-${String(month).padStart(2, '0')}`,
            documentType: 'DEPRECIACION_MENSUAL',
            documentId: `dep-${year}-${month}`,
            documentNumber: `DEP-${year}${String(month).padStart(2, '0')}`,
            entryDate: periodEnd,
            lines,
            userId,
        });

        for (const { asset, amount } of toProcess) {
            await client.query(
                `INSERT INTO fixed_asset_depreciations
                    (tenant_id, asset_id, period_year, period_month, depreciation_amount, journal_entry_id)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [tenantId, asset.id, year, month, amount, journal.id]
            );
            await client.query(
                `UPDATE fixed_assets
                    SET accumulated_depreciation = accumulated_depreciation + $1, updated_at = NOW()
                  WHERE id = $2`,
                [amount, asset.id]
            );
        }

        await client.query('COMMIT');

        const totalAmount = toProcess.reduce((s, x) => s + x.amount, 0);
        res.json({
            success: true,
            year, month,
            assets_processed: toProcess.length,
            total_depreciation: Math.round(totalAmount * 100) / 100,
            journal,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[FixedAssets] depreciate error:', error);
        const code = /Ya fue depreciado/i.test(error.message) ? 400 : 500;
        res.status(code).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const depreciationHistory = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { assetId } = req.query;
        const params = [tenantId];
        let where = `WHERE d.tenant_id = $1`;
        if (assetId) {
            params.push(assetId);
            where += ` AND d.asset_id = $${params.length}`;
        }
        const result = await db.query(
            `SELECT d.*, a.name AS asset_name, a.code AS asset_code,
                    je.entry_number AS journal_entry_number
               FROM fixed_asset_depreciations d
               LEFT JOIN fixed_assets a ON a.id = d.asset_id
               LEFT JOIN journal_entries je ON je.id = d.journal_entry_id
              ${where}
              ORDER BY d.period_year DESC, d.period_month DESC, d.asset_id`,
            params
        );
        res.json({ success: true, depreciations: result.rows });
    } catch (error) {
        console.error('[FixedAssets] history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    listFixedAssets,
    getAsset,
    createFixedAsset,
    updateFixedAsset,
    disposeFixedAsset,
    depreciateMonth,
    depreciationHistory,
};
