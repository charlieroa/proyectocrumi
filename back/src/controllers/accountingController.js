// src/controllers/accountingController.js
// Controlador del m�dulo de contabilidad

const db = require('../config/db');
const { seedDefaultRules, DEFAULT_RULES } = require('../helpers/classifierEngine');
const {
    ensureAccountingPeriod,
    assertAccountingPeriodOpen,
    listAccountingPeriods,
    getDefaultAccountName,
    getNextManualVoucherNumber,
    insertJournalEntry
} = require('../services/accountingCoreService');
const { logAccountingAudit } = require('../helpers/accountingAuditHelper');
const { recordAccountingAuditEvent, listAccountingAuditEvents } = require('../helpers/accountingAuditHelper');
const { upsertThirdParty } = require('../helpers/thirdPartyHelper');
const {
    getAccountsPayableReportData,
    getAccountsPayablePaymentsReportData,
    getTaxSummaryData
} = require('../services/accountsPayableQueryService');
const {
    createAccountsPayableEntry,
    applyAccountsPayablePaymentEntry
} = require('../services/accountsPayableWriteService');
const {
    getBankTransactionsData,
    getBankReconciliationCandidatesData
} = require('../services/bankingQueryService');
const {
    createBankTransactionEntry,
    reconcileBankTransactionEntry,
    unreconcileBankTransactionLineEntry
} = require('../services/bankingWriteService');
const {
    getAccountsReceivableReportData,
    getThirdPartyLedgerData
} = require('../services/receivablesQueryService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;
const buildAuditContext = (req) => ({
    ip: req.ip,
    userAgent: req.headers?.['user-agent'] || null,
    method: req.method,
    path: req.originalUrl || req.url || null
});

const getAccountingPeriods = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const client = await db.getClient();
        try {
            const { year } = req.query;
            if (year) {
                for (let month = 1; month <= 12; month += 1) {
                    await ensureAccountingPeriod(client, tenantId, new Date(Number(year), month - 1, 1));
                }
            }
            const periods = await listAccountingPeriods(client, tenantId);
            res.json({ success: true, periods });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[Accounting] Error obteniendo periodos contables:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createAccountingPeriod = async (req, res) => {
    const client = await db.getClient();
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const { period_year, period_month } = req.body;
        if (!period_year || !period_month) {
            return res.status(400).json({ success: false, error: 'period_year y period_month son obligatorios' });
        }
        const period = await ensureAccountingPeriod(client, tenantId, new Date(Number(period_year), Number(period_month) - 1, 1));
        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'periodos',
            action: 'period.created',
            entityType: 'accounting_period',
            entityId: period.id,
            entityNumber: `${period.period_year}-${String(period.period_month).padStart(2, '0')}`,
            message: 'Periodo contable creado',
            afterData: period,
            metadata: { source: 'accountingController.createAccountingPeriod' }
        });
        res.status(201).json({ success: true, period });
    } catch (error) {
        console.error('[Accounting] Error creando periodo contable:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const closeAccountingPeriod = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const userId = req.user?.id || null;
        const { notes } = req.body || {};

        const result = await db.query(
            `UPDATE accounting_periods
             SET status = 'CERRADO',
                 closed_at = NOW(),
                 closed_by = $1,
                 notes = COALESCE($2, notes),
                 updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4
             RETURNING *`,
            [userId, notes || null, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Periodo no encontrado' });
        }

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'periodos',
            action: 'period.closed',
            entityType: 'accounting_period',
            entityId: id,
            entityNumber: `${result.rows[0].period_year}-${String(result.rows[0].period_month).padStart(2, '0')}`,
            message: 'Periodo contable cerrado',
            afterData: result.rows[0],
            metadata: { notes: notes || null, source: 'accountingController.closeAccountingPeriod' }
        });

        res.json({ success: true, period: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error cerrando periodo contable:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const reopenAccountingPeriod = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const userId = req.user?.id || null;

        const result = await db.query(
            `UPDATE accounting_periods
             SET status = 'ABIERTO',
                 closed_at = NULL,
                 closed_by = NULL,
                 updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2
             RETURNING *`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Periodo no encontrado' });
        }

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'periodos',
            action: 'period.reopened',
            entityType: 'accounting_period',
            entityId: id,
            entityNumber: `${result.rows[0].period_year}-${String(result.rows[0].period_month).padStart(2, '0')}`,
            message: 'Periodo contable reabierto',
            afterData: result.rows[0],
            metadata: { source: 'accountingController.reopenAccountingPeriod' }
        });

        res.json({ success: true, period: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error reabriendo periodo contable:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// PLAN DE CUENTAS (PUC)
// =============================================

const getChartOfAccounts = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const result = await db.query(
            `SELECT * FROM chart_of_accounts WHERE tenant_id = $1 ORDER BY account_code`,
            [tenantId]
        );
        res.json({ success: true, accounts: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo PUC:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createAccount = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { accountCode, accountName, accountType, parentCode, level } = req.body;

        if (!accountCode || !accountName) {
            return res.status(400).json({ success: false, error: 'Código y nombre de cuenta son obligatorios' });
        }

        const result = await db.query(
            `INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, parent_code, level)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, account_code) DO UPDATE SET
                account_name = EXCLUDED.account_name,
                account_type = COALESCE(EXCLUDED.account_type, chart_of_accounts.account_type),
                parent_code = COALESCE(EXCLUDED.parent_code, chart_of_accounts.parent_code)
             RETURNING *`,
            [tenantId, accountCode, accountName, accountType, parentCode, level || 1]
        );

        res.status(201).json({ success: true, account: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error creando cuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const bulkCreateAccounts = async (req, res) => {
    const client = await db.connect();
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const rows = Array.isArray(req.body?.accounts) ? req.body.accounts : [];
        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Se requiere un array accounts con al menos una fila.' });
        }
        if (rows.length > 5000) {
            return res.status(400).json({ success: false, error: 'Máximo 5000 cuentas por carga.' });
        }

        const levelFromCode = (code) => {
            const len = String(code || '').trim().length;
            if (len <= 1) return 1;
            if (len <= 2) return 2;
            if (len <= 4) return 3;
            if (len <= 6) return 4;
            return 5;
        };
        const parentFromCode = (code) => {
            const c = String(code || '').trim();
            if (c.length <= 1) return null;
            if (c.length <= 2) return c.slice(0, 1);
            if (c.length <= 4) return c.slice(0, 2);
            if (c.length <= 6) return c.slice(0, 4);
            return c.slice(0, 6);
        };

        const VALID_TYPES = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO', 'CUENTAS_ORDEN'];

        const summary = { total: rows.length, created: 0, updated: 0, errors: 0, details: [] };

        await client.query('BEGIN');
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i] || {};
            const code = String(r.accountCode || r.account_code || r.code || '').trim();
            const name = String(r.accountName || r.account_name || r.name || '').trim();
            const rawType = String(r.accountType || r.account_type || r.type || '').trim().toUpperCase();
            const type = VALID_TYPES.includes(rawType) ? rawType : null;
            const explicitParent = r.parentCode ?? r.parent_code ?? null;
            const parent = explicitParent !== null && explicitParent !== '' ? String(explicitParent).trim() : parentFromCode(code);
            const level = r.level || levelFromCode(code);
            const isActive = r.isActive !== undefined ? !!r.isActive
                : (r.is_active !== undefined ? !!r.is_active
                : (r.activa !== undefined ? String(r.activa).toLowerCase() !== 'false' && String(r.activa).toLowerCase() !== 'no' && String(r.activa) !== '0' : true));

            if (!code || !name) {
                summary.errors++;
                summary.details.push({ rowIndex: i, name: name || '(sin nombre)', account_code: code, status: 'error', message: 'Código y nombre son obligatorios' });
                continue;
            }
            if (!/^[0-9]{1,10}$/.test(code)) {
                summary.errors++;
                summary.details.push({ rowIndex: i, name, account_code: code, status: 'error', message: 'Código inválido (solo dígitos, máx 10)' });
                continue;
            }

            try {
                const existing = await client.query(
                    'SELECT id FROM chart_of_accounts WHERE tenant_id = $1 AND account_code = $2 LIMIT 1',
                    [tenantId, code]
                );
                const result = await client.query(
                    `INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, parent_code, level, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (tenant_id, account_code) DO UPDATE SET
                        account_name = EXCLUDED.account_name,
                        account_type = COALESCE(EXCLUDED.account_type, chart_of_accounts.account_type),
                        parent_code = COALESCE(EXCLUDED.parent_code, chart_of_accounts.parent_code),
                        level = EXCLUDED.level,
                        is_active = EXCLUDED.is_active
                     RETURNING id`,
                    [tenantId, code, name, type, parent, level, isActive]
                );
                const wasCreated = existing.rows.length === 0;
                if (wasCreated) summary.created++; else summary.updated++;
                summary.details.push({
                    rowIndex: i,
                    name,
                    account_code: code,
                    status: wasCreated ? 'created' : 'updated',
                    id: result.rows[0]?.id,
                });
            } catch (e) {
                summary.errors++;
                summary.details.push({ rowIndex: i, name, account_code: code, status: 'error', message: e.message });
            }
        }
        await client.query('COMMIT');

        res.json({ success: summary.errors === 0, ...summary });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch {}
        console.error('[Accounting] Error en bulk PUC:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const updateAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const { accountCode, accountName, accountType, parentCode, level, isActive } = req.body;

        const result = await db.query(
            `UPDATE chart_of_accounts SET
                account_code = COALESCE($1, account_code),
                account_name = COALESCE($2, account_name),
                account_type = COALESCE($3, account_type),
                parent_code = COALESCE($4, parent_code),
                level = COALESCE($5, level),
                is_active = COALESCE($6, is_active)
             WHERE id = $7 AND tenant_id = $8
             RETURNING *`,
            [accountCode, accountName, accountType, parentCode, level, isActive, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Cuenta no encontrada' });
        }
        res.json({ success: true, account: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error actualizando cuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const seedPucColombia = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId requerido' });
        const { seedPucForTenant } = require('../helpers/pucColombiaSeed');
        const summary = await seedPucForTenant(db, tenantId);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('[Accounting] Error sembrando PUC:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const used = await db.query(
            `SELECT 1 FROM journal_entry_lines jel
             JOIN chart_of_accounts coa ON coa.id = $1
             WHERE jel.account_code = coa.account_code LIMIT 1`,
            [id]
        );
        if (used.rows.length > 0) {
            const inactive = await db.query(
                `UPDATE chart_of_accounts SET is_active = FALSE WHERE id = $1 AND tenant_id = $2 RETURNING *`,
                [id, tenantId]
            );
            return res.json({ success: true, inactivated: true, account: inactive.rows[0] });
        }
        const result = await db.query(
            `DELETE FROM chart_of_accounts WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenantId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Cuenta no encontrada' });
        res.json({ success: true, deleted: true });
    } catch (error) {
        console.error('[Accounting] Error eliminando cuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// LIBRO DIARIO (Journal Entries)
// =============================================

// Comprobantes no contabilizados: listado de journal entries con status
// distinto de 'ACTIVO' (reversados, borradores, anulados).
const getUnpostedEntries = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate } = req.query;

        let whereClause = "WHERE tenant_id = $1 AND status IS DISTINCT FROM 'ACTIVO'";
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            whereClause += ` AND entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereClause += ` AND entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT id, entry_number,
                    entry_date::date AS entry_date,
                    entry_date::date AS date,
                    description,
                    document_type, document_number,
                    total_debit, total_credit, status,
                    reversed_by_entry_id, reverses_entry_id,
                    created_at
             FROM journal_entries
             ${whereClause}
             ORDER BY entry_date DESC, id DESC`,
            params
        );

        res.json({ success: true, entries: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('[Accounting] Error en no contabilizados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Balance de prueba configurable: filtros por rango de cuentas, rollup a nivel
// específico (agregación por prefijo de código), y opción de mostrar solo cuentas
// con movimiento. Respuesta compatible con el trial-balance existente.
const getTrialBalanceConfigurable = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const {
            startDate,
            endDate,
            accountFrom,
            accountTo,
            level, // 1|2|4|6|8 — trunca el código a esa longitud y agrupa
            onlyWithMovement, // 'true' → descarta cuentas con débito+crédito+saldo = 0
        } = req.query;

        const lvl = parseInt(level, 10);
        const validLvl = [1, 2, 4, 6, 8].includes(lvl) ? lvl : null;

        const params = [tenantId];
        let paramIdx = 2;
        let dateFilter = '';
        if (startDate) { dateFilter += ` AND je.entry_date >= $${paramIdx}`; params.push(startDate); paramIdx++; }
        if (endDate) { dateFilter += ` AND je.entry_date <= $${paramIdx}`; params.push(endDate); paramIdx++; }

        let rangeFilter = '';
        if (accountFrom) { rangeFilter += ` AND jel.account_code >= $${paramIdx}`; params.push(String(accountFrom)); paramIdx++; }
        if (accountTo) { rangeFilter += ` AND jel.account_code <= $${paramIdx}`; params.push(String(accountTo)); paramIdx++; }

        // Si hay nivel, agrupamos por LEFT(account_code, level); si no, por account_code completo.
        const groupExpr = validLvl ? `LEFT(jel.account_code, ${validLvl})` : 'jel.account_code';
        const nameExpr = validLvl
            ? `(SELECT account_name FROM chart_of_accounts
                 WHERE tenant_id = $1 AND account_code = LEFT(jel.account_code, ${validLvl}) LIMIT 1)`
            : 'MAX(jel.account_name)';

        const result = await db.query(
            `SELECT ${groupExpr} AS account_code,
                    ${nameExpr} AS account_name,
                    CASE
                        WHEN ${groupExpr} LIKE '1%' THEN 'ACTIVO'
                        WHEN ${groupExpr} LIKE '2%' THEN 'PASIVO'
                        WHEN ${groupExpr} LIKE '3%' THEN 'PATRIMONIO'
                        WHEN ${groupExpr} LIKE '4%' THEN 'INGRESO'
                        WHEN ${groupExpr} LIKE '5%' THEN 'GASTO'
                        WHEN ${groupExpr} LIKE '6%' THEN 'COSTO_VENTAS'
                        WHEN ${groupExpr} LIKE '7%' THEN 'COSTO_PRODUCCION'
                        ELSE 'OTRO'
                    END AS account_type,
                    COALESCE(SUM(jel.debit), 0)::numeric AS debit,
                    COALESCE(SUM(jel.credit), 0)::numeric AS credit,
                    COALESCE(SUM(jel.debit - jel.credit), 0)::numeric AS balance
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1
               AND (je.status IS NULL OR je.status = 'ACTIVO')
               ${dateFilter}
               ${rangeFilter}
             GROUP BY ${groupExpr}
             ORDER BY ${groupExpr}`,
            params
        );

        let rows = result.rows.map(r => ({
            account_code: r.account_code,
            account_name: r.account_name || '',
            account_type: r.account_type,
            debit: Number(r.debit) || 0,
            credit: Number(r.credit) || 0,
            balance: Number(r.balance) || 0,
        }));

        if (String(onlyWithMovement) === 'true') {
            rows = rows.filter(r => r.debit !== 0 || r.credit !== 0 || r.balance !== 0);
        }

        const totals = rows.reduce(
            (acc, r) => ({
                debit: acc.debit + r.debit,
                credit: acc.credit + r.credit,
                balance: acc.balance + r.balance,
            }),
            { debit: 0, credit: 0, balance: 0 },
        );

        res.json({
            success: true,
            trialBalance: rows,
            totals,
            filters: { startDate, endDate, accountFrom, accountTo, level: validLvl, onlyWithMovement: String(onlyWithMovement) === 'true' },
        });
    } catch (error) {
        console.error('[Accounting] Error en balance configurable:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Balance de prueba por tercero: agrupa débitos/créditos/saldo por tercero
// (document_number + name) en el rango de fechas.
const getTrialBalanceByThirdParty = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate, accountCode } = req.query;

        let whereClause = 'WHERE je.tenant_id = $1 AND jel.third_party_document IS NOT NULL';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            whereClause += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereClause += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }
        if (accountCode) {
            whereClause += ` AND jel.account_code LIKE $${paramIdx}`;
            params.push(`${accountCode}%`);
            paramIdx++;
        }
        // Solo asientos contabilizados
        whereClause += " AND (je.status IS NULL OR je.status = 'ACTIVO')";

        const result = await db.query(
            `SELECT jel.third_party_document AS document_number,
                    COALESCE(MAX(jel.third_party_name), '') AS name,
                    COALESCE(SUM(jel.debit), 0)::numeric AS debit,
                    COALESCE(SUM(jel.credit), 0)::numeric AS credit,
                    COALESCE(SUM(jel.debit - jel.credit), 0)::numeric AS balance,
                    COUNT(*)::int AS lines
             FROM journal_entry_lines jel
             JOIN journal_entries je ON je.id = jel.journal_entry_id
             ${whereClause}
             GROUP BY jel.third_party_document
             ORDER BY name`,
            params
        );

        const totals = result.rows.reduce(
            (acc, r) => ({
                debit: acc.debit + Number(r.debit || 0),
                credit: acc.credit + Number(r.credit || 0),
                balance: acc.balance + Number(r.balance || 0),
            }),
            { debit: 0, credit: 0, balance: 0 },
        );

        res.json({ success: true, trialBalance: result.rows, totals });
    } catch (error) {
        console.error('[Accounting] Error en balance por tercero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Libro diario resumido: agrupa asientos por día con totales y conteo.
// Devuelve { entries: [{ date, count, total_debit, total_credit }], totals }
const getJournalEntriesSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate } = req.query;

        let whereClause = 'WHERE tenant_id = $1';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            whereClause += ` AND entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereClause += ` AND entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT entry_date::date AS date,
                    COUNT(*)::int AS count,
                    COALESCE(SUM(total_debit), 0)::numeric AS total_debit,
                    COALESCE(SUM(total_credit), 0)::numeric AS total_credit
             FROM journal_entries
             ${whereClause}
             GROUP BY entry_date
             ORDER BY entry_date DESC`,
            params
        );

        const totals = result.rows.reduce(
            (acc, r) => ({
                count: acc.count + Number(r.count || 0),
                total_debit: acc.total_debit + Number(r.total_debit || 0),
                total_credit: acc.total_credit + Number(r.total_credit || 0),
            }),
            { count: 0, total_debit: 0, total_credit: 0 },
        );

        res.json({ success: true, entries: result.rows, totals });
    } catch (error) {
        console.error('[Accounting] Error en diario resumido:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getJournalEntries = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate, search, page = 1, limit = 50 } = req.query;

        let whereClause = 'WHERE je.tenant_id = $1';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            whereClause += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereClause += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }
        if (search) {
            whereClause += ` AND (je.entry_number ILIKE $${paramIdx} OR je.description ILIKE $${paramIdx} OR je.document_number ILIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        const offset = (Number(page) - 1) * Number(limit);

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM journal_entries je ${whereClause}`,
            params
        );

        const result = await db.query(
            `SELECT je.*,
                    je.entry_date::date AS date,
                    json_agg(json_build_object(
                        'id', jel.id,
                        'account_code', jel.account_code,
                        'account_name', jel.account_name,
                        'description', jel.description,
                        'line_description', jel.description,
                        'debit', jel.debit,
                        'credit', jel.credit,
                        'third_party_id', jel.third_party_id,
                        'third_party_document', jel.third_party_document,
                        'third_party_name', jel.third_party_name,
                        'base_amount', jel.base_amount,
                        'tax_type', jel.tax_type,
                        'tax_rate', jel.tax_rate,
                        'tax_amount', jel.tax_amount,
                        'tax_treatment', jel.tax_treatment,
                        'dian_concept_code', jel.dian_concept_code
                    ) ORDER BY jel.id) as lines
             FROM journal_entries je
             LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
             ${whereClause}
             GROUP BY je.id
             ORDER BY je.entry_date DESC, je.id DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            [...params, Number(limit), offset]
        );

        res.json({
            success: true,
            entries: result.rows,
            total: parseInt(countResult.rows[0].total),
            page: Number(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / Number(limit))
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo libro diario:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getJournalEntryById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;

        const result = await db.query(
            `SELECT je.*,
                    json_agg(json_build_object(
                        'id', jel.id,
                        'account_code', jel.account_code,
                        'account_name', jel.account_name,
                        'description', jel.description,
                        'debit', jel.debit,
                        'credit', jel.credit,
                        'third_party_id', jel.third_party_id,
                        'third_party_document', jel.third_party_document,
                        'third_party_name', jel.third_party_name,
                        'base_amount', jel.base_amount,
                        'tax_type', jel.tax_type,
                        'tax_rate', jel.tax_rate,
                        'tax_amount', jel.tax_amount,
                        'tax_treatment', jel.tax_treatment,
                        'dian_concept_code', jel.dian_concept_code
                    ) ORDER BY jel.id) as lines
             FROM journal_entries je
             LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
             WHERE je.id = $1 AND je.tenant_id = $2
             GROUP BY je.id`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Asiento no encontrado' });
        }
        res.json({ success: true, entry: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error obteniendo asiento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// LIBRO MAYOR (General Ledger)
// =============================================

const getLedger = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { accountCode, startDate, endDate } = req.query;

        let whereClause = 'WHERE je.tenant_id = $1 AND je.status = \'ACTIVO\'';
        const params = [tenantId];
        let paramIdx = 2;

        if (accountCode) {
            whereClause += ` AND jel.account_code LIKE $${paramIdx}`;
            params.push(`${accountCode}%`);
            paramIdx++;
        }
        if (startDate) {
            whereClause += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereClause += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        // Devolvemos movimiento por línea (no agregado) — el Libro Mayor se usa para
        // ver el detalle de cada movimiento de una cuenta con su saldo corriente.
        const result = await db.query(
            `SELECT
                je.entry_date AS date,
                je.entry_number,
                je.document_type,
                je.document_number,
                je.description AS entry_description,
                jel.account_code,
                jel.account_name,
                jel.description,
                jel.third_party_document,
                jel.third_party_name,
                jel.debit,
                jel.credit,
                SUM(COALESCE(jel.debit,0) - COALESCE(jel.credit,0))
                    OVER (PARTITION BY jel.account_code ORDER BY je.entry_date, je.id, jel.id) AS running_balance
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             ${whereClause}
             ORDER BY jel.account_code, je.entry_date, je.id, jel.id`,
            params
        );

        res.json({ success: true, ledger: result.rows });
    } catch (error) {
        console.error('[Accounting] Error obteniendo libro mayor:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// BALANCE DE PRUEBA
// =============================================

const getTrialBalance = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate } = req.query;

        let dateFilter = '';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            dateFilter += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            dateFilter += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                jel.account_code,
                jel.account_name,
                CASE
                    WHEN jel.account_code LIKE '1%' THEN 'ACTIVO'
                    WHEN jel.account_code LIKE '2%' THEN 'PASIVO'
                    WHEN jel.account_code LIKE '3%' THEN 'PATRIMONIO'
                    WHEN jel.account_code LIKE '4%' THEN 'INGRESO'
                    WHEN jel.account_code LIKE '5%' THEN 'GASTO'
                    WHEN jel.account_code LIKE '6%' THEN 'COSTO'
                    ELSE 'OTRO'
                END as account_type,
                COALESCE(SUM(jel.debit), 0) as total_debit,
                COALESCE(SUM(jel.debit), 0) as debit,
                COALESCE(SUM(jel.credit), 0) as total_credit,
                COALESCE(SUM(jel.credit), 0) as credit,
                COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'${dateFilter}
             GROUP BY jel.account_code, jel.account_name
             ORDER BY jel.account_code`,
            params
        );

        // Totales
        const totals = result.rows.reduce((acc, row) => ({
            totalDebit: acc.totalDebit + Number(row.total_debit),
            totalCredit: acc.totalCredit + Number(row.total_credit)
        }), { totalDebit: 0, totalCredit: 0 });

        res.json({
            success: true,
            // Clave 'trialBalance' que es la que lee el frontend.
            // Se mantiene 'balance' por compatibilidad retro.
            trialBalance: result.rows,
            balance: result.rows,
            totals: {
                ...totals,
                balanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01
            }
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo balance de prueba:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// ESTADO DE RESULTADOS (P&L)
// =============================================

const getIncomeStatement = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { startDate, endDate } = req.query;

        let dateFilter = '';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            dateFilter += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            dateFilter += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                jel.account_code,
                jel.account_name,
                CASE
                    WHEN jel.account_code LIKE '4%' THEN 'INGRESO'
                    WHEN jel.account_code LIKE '5%' THEN 'GASTO'
                    WHEN jel.account_code LIKE '6%' THEN 'COSTO'
                    ELSE 'OTRO'
                END as category,
                -- Para ingresos: crédito natural → positivo. Para gastos/costos: débito natural → positivo.
                CASE
                    WHEN jel.account_code LIKE '4%' THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
                    ELSE COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
                END as balance,
                CASE
                    WHEN jel.account_code LIKE '4%' THEN COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
                    ELSE COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
                END as amount
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND (jel.account_code LIKE '4%' OR jel.account_code LIKE '5%' OR jel.account_code LIKE '6%')
               ${dateFilter}
             GROUP BY jel.account_code, jel.account_name
             ORDER BY jel.account_code`,
            params
        );

        const ingresos = result.rows.filter(r => r.category === 'INGRESO');
        const gastos = result.rows.filter(r => r.category === 'GASTO');
        const costos = result.rows.filter(r => r.category === 'COSTO');

        const totalIngresos = ingresos.reduce((s, r) => s + Number(r.balance), 0);
        const totalGastos = gastos.reduce((s, r) => s + Number(r.balance), 0);
        const totalCostos = costos.reduce((s, r) => s + Number(r.balance), 0);
        const utilidadBruta = totalIngresos - totalCostos;
        // Sin una clasificación fina de gasto administrativo vs ventas vs no-operacional
        // (para eso existe pyg-funcion), utilidadOperacional = bruta - gastos totales.
        const utilidadOperacional = utilidadBruta - totalGastos;
        const utilidadNeta = utilidadOperacional;

        res.json({
            success: true,
            statement: {
                ingresos,
                gastos,
                costos,
                totalIngresos,
                totalGastos,
                totalCostos,
                utilidadBruta,
                utilidadOperacional,
                utilidadNeta
            }
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo estado de resultados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// LIBRO AUXILIAR
// =============================================

const getAuxiliarBook = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const { accountCode, startDate, endDate } = req.query;

        if (!accountCode) {
            return res.status(400).json({ success: false, error: 'Código de cuenta requerido' });
        }

        let dateFilter = '';
        const params = [tenantId, `${accountCode}%`];
        let paramIdx = 3;

        if (startDate) {
            dateFilter += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            dateFilter += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                je.entry_date AS date,
                je.entry_number,
                je.entry_number AS voucher_number,
                je.document_type,
                je.document_number,
                jel.description,
                jel.debit,
                jel.credit,
                jel.account_code,
                jel.account_name,
                jel.third_party_document,
                jel.third_party_name,
                SUM(COALESCE(jel.debit,0) - COALESCE(jel.credit,0)) OVER (ORDER BY je.entry_date, je.id, jel.id) as balance,
                SUM(COALESCE(jel.debit,0) - COALESCE(jel.credit,0)) OVER (ORDER BY je.entry_date, je.id, jel.id) as running_balance
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO' AND jel.account_code LIKE $2
             ${dateFilter}
             ORDER BY je.entry_date, je.id, jel.id`,
            params
        );

        res.json({ success: true, movements: result.rows });
    } catch (error) {
        console.error('[Accounting] Error obteniendo auxiliar:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// BALANCE GENERAL
// =============================================

const getBalanceSheet = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { startDate, endDate } = req.query;

        let dateFilter = '';
        const params = [tenantId];
        let paramIdx = 2;

        if (startDate) {
            dateFilter += ` AND je.entry_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            dateFilter += ` AND je.entry_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                jel.account_code,
                jel.account_name,
                CASE
                    WHEN jel.account_code LIKE '1%' THEN 'ACTIVO'
                    WHEN jel.account_code LIKE '2%' THEN 'PASIVO'
                    WHEN jel.account_code LIKE '3%' THEN 'PATRIMONIO'
                    ELSE 'OTRO'
                END as section,
                COALESCE(SUM(jel.debit), 0) as total_debit,
                COALESCE(SUM(jel.credit), 0) as total_credit,
                CASE
                    WHEN jel.account_code LIKE '1%' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
                    ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
                END as balance
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1
               AND je.status = 'ACTIVO'
               AND (jel.account_code LIKE '1%' OR jel.account_code LIKE '2%' OR jel.account_code LIKE '3%')
               ${dateFilter}
             GROUP BY jel.account_code, jel.account_name
             HAVING ABS(
                CASE
                    WHEN jel.account_code LIKE '1%' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
                    ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
                END
             ) > 0.009
             ORDER BY jel.account_code`,
            params
        );

        const activos = result.rows.filter((row) => row.section === 'ACTIVO');
        const pasivos = result.rows.filter((row) => row.section === 'PASIVO');
        const patrimonio = result.rows.filter((row) => row.section === 'PATRIMONIO');

        const periodResult = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' OR jel.account_code LIKE '6%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS egresos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1
               AND je.status = 'ACTIVO'
               ${dateFilter}`,
            params
        );

        const utilidadPeriodo = Number(periodResult.rows[0]?.ingresos || 0) - Number(periodResult.rows[0]?.egresos || 0);
        if (Math.abs(utilidadPeriodo) > 0.009) {
            patrimonio.push({
                account_code: '360595',
                account_name: 'UTILIDAD DEL EJERCICIO',
                section: 'PATRIMONIO',
                total_debit: '0.00',
                total_credit: String(utilidadPeriodo.toFixed(2)),
                balance: utilidadPeriodo
            });
        }

        const totalActivos = activos.reduce((sum, row) => sum + Number(row.balance), 0);
        const totalPasivos = pasivos.reduce((sum, row) => sum + Number(row.balance), 0);
        const totalPatrimonio = patrimonio.reduce((sum, row) => sum + Number(row.balance), 0);

        res.json({
            success: true,
            balanceSheet: {
                activos,
                pasivos,
                patrimonio,
                totalActivos,
                totalPasivos,
                totalPatrimonio,
                balanced: Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.01
            }
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo balance general:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// CARTERA (CUENTAS POR COBRAR)
// =============================================

// =============================================
// ESTADO DE FLUJO DE EFECTIVO (Método indirecto)
// =============================================
//
// Parte de la utilidad neta del período, suma ajustes no-cash (depreciación,
// amortización, provisiones), suma/resta variación de capital de trabajo
// (CxC, inventarios, CxP), y agrega flujos de inversión (cuentas 15%) y
// financiación (cuentas 21% y 3%). Reconcilia con la variación real de caja
// (cuenta 11%) en el período.
//
// Categorización por grupo PUC:
//   Operación       : utilidad + dep/amort + Δ(13,14,22)
//   Inversión       : Δ(15 = propiedad planta y equipo)
//   Financiación    : Δ(21 obligaciones financieras, 3 patrimonio excepto 36 utilidad)
//
const getCashFlowStatement = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'startDate y endDate son requeridos' });
        }

        // 1. Utilidad neta del período (ingresos - gastos - costos)
        const utilidadRes = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' OR jel.account_code LIKE '6%' OR jel.account_code LIKE '7%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS egresos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3`,
            [tenantId, startDate, endDate]
        );
        const utilidadNeta = Number(utilidadRes.rows[0]?.ingresos || 0) - Number(utilidadRes.rows[0]?.egresos || 0);

        // 2. Ajustes no-cash: depreciación (5160, 5260), amortización (5165, 5265), provisiones (5199, 5299)
        const noCashRes = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5160%' OR jel.account_code LIKE '5260%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS depreciacion,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5165%' OR jel.account_code LIKE '5265%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS amortizacion,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5199%' OR jel.account_code LIKE '5299%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS provisiones
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3`,
            [tenantId, startDate, endDate]
        );
        const depreciacion = Number(noCashRes.rows[0]?.depreciacion || 0);
        const amortizacion = Number(noCashRes.rows[0]?.amortizacion || 0);
        const provisiones = Number(noCashRes.rows[0]?.provisiones || 0);

        // 3. Variación capital de trabajo: CxC (13%), Inventarios (14%), CxP (22%) + impuestos
        // por pagar (24%, sin 2408 IVA descontable por cobrar que es activo) + obligaciones
        // laborales (25%). Δ positivo en CxC/INV = usa efectivo (resta); Δ positivo en pasivos
        // operativos = libera efectivo (suma).
        const workingCapitalRes = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '13%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS delta_cxc,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '14%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS delta_inv,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '22%' OR jel.account_code LIKE '23%' OR jel.account_code LIKE '24%' OR jel.account_code LIKE '25%' OR jel.account_code LIKE '26%' OR jel.account_code LIKE '28%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS delta_cxp
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3`,
            [tenantId, startDate, endDate]
        );
        const deltaCxC = Number(workingCapitalRes.rows[0]?.delta_cxc || 0);
        const deltaInv = Number(workingCapitalRes.rows[0]?.delta_inv || 0);
        const deltaCxP = Number(workingCapitalRes.rows[0]?.delta_cxp || 0);

        const flujoOperacion = utilidadNeta + depreciacion + amortizacion + provisiones - deltaCxC - deltaInv + deltaCxP;

        // 4. Inversión: cuentas 15-18% (PPE, intangibles, inversiones) — aumento = salida de efectivo.
        // Excluimos 159x/169x (depreciación/amortización acumulada) ya que son contra-activos
        // no-cash; su impacto ya fue reflejado sumando depreciación en la sección operativa.
        const inversionRes = await db.query(
            `SELECT
                COALESCE(SUM(jel.debit - jel.credit), 0) AS delta_ppe
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3
               AND (jel.account_code LIKE '15%' OR jel.account_code LIKE '16%' OR jel.account_code LIKE '17%' OR jel.account_code LIKE '18%')
               AND jel.account_code NOT LIKE '159%'
               AND jel.account_code NOT LIKE '169%'`,
            [tenantId, startDate, endDate]
        );
        const flujoInversion = -Number(inversionRes.rows[0]?.delta_ppe || 0);

        // 5. Financiación: 21% obligaciones financieras + 3% patrimonio (excluye 36 resultado del ejercicio)
        const financiacionRes = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '21%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS delta_deuda,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '31%' OR jel.account_code LIKE '32%' OR jel.account_code LIKE '33%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS delta_capital,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '37%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS dividendos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3`,
            [tenantId, startDate, endDate]
        );
        const deltaDeuda = Number(financiacionRes.rows[0]?.delta_deuda || 0);
        const deltaCapital = Number(financiacionRes.rows[0]?.delta_capital || 0);
        const dividendos = Number(financiacionRes.rows[0]?.dividendos || 0);
        const flujoFinanciacion = deltaDeuda + deltaCapital - dividendos;

        // 6. Caja inicial y final (cuenta 11%)
        const cajaInicialRes = await db.query(
            `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS saldo
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date < $2
               AND jel.account_code LIKE '11%'`,
            [tenantId, startDate]
        );
        const cajaFinalRes = await db.query(
            `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS saldo
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date <= $2
               AND jel.account_code LIKE '11%'`,
            [tenantId, endDate]
        );
        const cajaInicial = Number(cajaInicialRes.rows[0]?.saldo || 0);
        const cajaFinal = Number(cajaFinalRes.rows[0]?.saldo || 0);
        const variacionCajaReal = cajaFinal - cajaInicial;
        const flujoNetoCalculado = flujoOperacion + flujoInversion + flujoFinanciacion;
        const diferencia = variacionCajaReal - flujoNetoCalculado;

        res.json({
            success: true,
            cashFlow: {
                periodo: { startDate, endDate },
                operacion: {
                    utilidadNeta,
                    depreciacion,
                    amortizacion,
                    provisiones,
                    deltaCxC: -deltaCxC,
                    deltaInventarios: -deltaInv,
                    deltaCxP,
                    total: flujoOperacion,
                },
                inversion: {
                    adquisicionActivos: flujoInversion,
                    total: flujoInversion,
                },
                financiacion: {
                    deltaDeuda,
                    deltaCapital,
                    dividendos: -dividendos,
                    total: flujoFinanciacion,
                },
                resumen: {
                    flujoNetoCalculado,
                    cajaInicial,
                    cajaFinal,
                    variacionCajaReal,
                    diferencia,
                    conciliado: Math.abs(diferencia) < 1,
                },
            },
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo flujo de efectivo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// ESTADO DE CAMBIOS EN EL PATRIMONIO
// =============================================
//
// Por cada cuenta de patrimonio (clase 3) muestra saldo inicial (antes de
// startDate), débitos, créditos y variación neta en el período, y saldo final.
// Incluye la utilidad del ejercicio calculada desde cuentas 4/5/6/7 como
// fila virtual.
//
const getEquityChangesStatement = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'startDate y endDate son requeridos' });
        }

        // Saldos iniciales por cuenta patrimonial (antes de startDate)
        const iniciales = await db.query(
            `SELECT
                jel.account_code,
                jel.account_name,
                COALESCE(SUM(jel.credit - jel.debit), 0) AS saldo_inicial
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date < $2
               AND jel.account_code LIKE '3%'
             GROUP BY jel.account_code, jel.account_name`,
            [tenantId, startDate]
        );

        // Movimientos durante el período
        const movimientos = await db.query(
            `SELECT
                jel.account_code,
                jel.account_name,
                COALESCE(SUM(jel.debit), 0) AS total_debit,
                COALESCE(SUM(jel.credit), 0) AS total_credit
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3
               AND jel.account_code LIKE '3%'
             GROUP BY jel.account_code, jel.account_name`,
            [tenantId, startDate, endDate]
        );

        const map = new Map();
        iniciales.rows.forEach((r) => {
            map.set(r.account_code, {
                account_code: r.account_code,
                account_name: r.account_name,
                saldo_inicial: Number(r.saldo_inicial || 0),
                debitos: 0,
                creditos: 0,
                variacion: 0,
                saldo_final: Number(r.saldo_inicial || 0),
            });
        });
        movimientos.rows.forEach((r) => {
            const existing = map.get(r.account_code) || {
                account_code: r.account_code,
                account_name: r.account_name,
                saldo_inicial: 0,
                debitos: 0,
                creditos: 0,
                variacion: 0,
                saldo_final: 0,
            };
            existing.account_name = existing.account_name || r.account_name;
            existing.debitos = Number(r.total_debit || 0);
            existing.creditos = Number(r.total_credit || 0);
            existing.variacion = existing.creditos - existing.debitos;
            existing.saldo_final = existing.saldo_inicial + existing.variacion;
            map.set(r.account_code, existing);
        });

        const cuentas = Array.from(map.values())
            .filter((c) => Math.abs(c.saldo_inicial) + Math.abs(c.debitos) + Math.abs(c.creditos) > 0.009)
            .sort((a, b) => a.account_code.localeCompare(b.account_code));

        // Utilidad del ejercicio (fila virtual 3605)
        const utilidadRes = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' OR jel.account_code LIKE '6%' OR jel.account_code LIKE '7%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS egresos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= $2 AND je.entry_date <= $3`,
            [tenantId, startDate, endDate]
        );
        const utilidadPeriodo = Number(utilidadRes.rows[0]?.ingresos || 0) - Number(utilidadRes.rows[0]?.egresos || 0);
        if (Math.abs(utilidadPeriodo) > 0.009) {
            cuentas.push({
                account_code: '360595',
                account_name: 'UTILIDAD DEL EJERCICIO',
                saldo_inicial: 0,
                debitos: utilidadPeriodo < 0 ? Math.abs(utilidadPeriodo) : 0,
                creditos: utilidadPeriodo > 0 ? utilidadPeriodo : 0,
                variacion: utilidadPeriodo,
                saldo_final: utilidadPeriodo,
                virtual: true,
            });
        }

        const totales = cuentas.reduce(
            (acc, c) => ({
                saldo_inicial: acc.saldo_inicial + c.saldo_inicial,
                debitos: acc.debitos + c.debitos,
                creditos: acc.creditos + c.creditos,
                variacion: acc.variacion + c.variacion,
                saldo_final: acc.saldo_final + c.saldo_final,
            }),
            { saldo_inicial: 0, debitos: 0, creditos: 0, variacion: 0, saldo_final: 0 }
        );

        res.json({
            success: true,
            equityChanges: {
                periodo: { startDate, endDate },
                cuentas,
                totales,
            },
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo cambios en patrimonio:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAccountsReceivableReport = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { status, customerSearch } = req.query;

        let whereClause = 'WHERE tenant_id = $1';
        const params = [tenantId];
        let paramIdx = 2;

        if (status && status !== 'TODAS') {
            whereClause += ` AND status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }

        if (customerSearch) {
            whereClause += ` AND (client_name ILIKE $${paramIdx} OR client_document_number ILIKE $${paramIdx})`;
            params.push(`%${customerSearch}%`);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                ar.*,
                GREATEST(CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date), 0) AS days_overdue,
                CASE
                    WHEN ar.balance_amount <= 0.009 THEN 'AL DIA'
                    WHEN CURRENT_DATE <= COALESCE(ar.due_date, ar.issue_date) THEN 'AL DIA'
                    WHEN CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date) BETWEEN 1 AND 30 THEN '1-30'
                    WHEN CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date) BETWEEN 31 AND 60 THEN '31-60'
                    WHEN CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date) BETWEEN 61 AND 90 THEN '61-90'
                    ELSE '90+'
                END AS aging_bucket
             FROM accounts_receivable ar
             ${whereClause}
             ORDER BY COALESCE(ar.due_date, ar.issue_date) ASC, ar.id DESC`,
            params
        );

        const summary = result.rows.reduce((acc, row) => {
            const balance = Number(row.balance_amount || 0);
            acc.totalOriginal += Number(row.original_amount || 0);
            acc.totalPaid += Number(row.paid_amount || 0);
            acc.totalBalance += balance;
            acc.byBucket[row.aging_bucket] = (acc.byBucket[row.aging_bucket] || 0) + balance;
            return acc;
        }, {
            totalOriginal: 0,
            totalPaid: 0,
            totalBalance: 0,
            byBucket: { 'AL DIA': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
        });

        res.json({
            success: true,
            receivables: result.rows,
            summary
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo cartera:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// AUXILIAR POR TERCERO
// =============================================

const getThirdPartyLedger = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { thirdParty, startDate, endDate } = req.query;

        let whereAr = 'WHERE ar.tenant_id = $1';
        let whereApp = 'WHERE ar.tenant_id = $1';
        const params = [tenantId];
        let paramIdx = 2;

        if (thirdParty) {
            whereAr += ` AND (ar.client_name ILIKE $${paramIdx} OR ar.client_document_number ILIKE $${paramIdx})`;
            whereApp += ` AND (ar.client_name ILIKE $${paramIdx} OR ar.client_document_number ILIKE $${paramIdx})`;
            params.push(`%${thirdParty}%`);
            paramIdx++;
        }
        if (startDate) {
            whereAr += ` AND ar.issue_date >= $${paramIdx}`;
            whereApp += ` AND app.application_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereAr += ` AND ar.issue_date <= $${paramIdx}`;
            whereApp += ` AND app.application_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `WITH movements AS (
                SELECT
                    COALESCE(ar.client_document_number, 'SIN-DOC') AS third_party_id,
                    COALESCE(ar.client_name, 'SIN NOMBRE') AS third_party_name,
                    ar.issue_date AS movement_date,
                    ar.document_type,
                    ar.document_number,
                    ar.notes AS description,
                    ar.original_amount AS debit,
                    0::numeric AS credit
                FROM accounts_receivable ar
                ${whereAr}

                UNION ALL

                SELECT
                    COALESCE(ar.client_document_number, 'SIN-DOC') AS third_party_id,
                    COALESCE(ar.client_name, 'SIN NOMBRE') AS third_party_name,
                    app.application_date AS movement_date,
                    app.source_type AS document_type,
                    app.source_number AS document_number,
                    COALESCE(app.notes, 'Aplicacion de cartera') AS description,
                    0::numeric AS debit,
                    app.amount AS credit
                FROM accounts_receivable_applications app
                INNER JOIN accounts_receivable ar ON ar.id = app.accounts_receivable_id
                ${whereApp}
            )
            SELECT
                third_party_id,
                third_party_name,
                movement_date,
                document_type,
                document_number,
                description,
                debit,
                credit,
                SUM(debit - credit) OVER (
                    PARTITION BY third_party_id
                    ORDER BY movement_date, document_number
                ) AS running_balance
            FROM movements
            ORDER BY third_party_name, movement_date, document_number`,
            params
        );

        const summaryMap = new Map();
        for (const row of result.rows) {
            const key = row.third_party_id;
            const current = summaryMap.get(key) || {
                third_party_id: row.third_party_id,
                third_party_name: row.third_party_name,
                total_debit: 0,
                total_credit: 0,
                balance: 0
            };
            current.total_debit += Number(row.debit || 0);
            current.total_credit += Number(row.credit || 0);
            current.balance = current.total_debit - current.total_credit;
            summaryMap.set(key, current);
        }

        res.json({
            success: true,
            movements: result.rows,
            summary: Array.from(summaryMap.values()).sort((a, b) => b.balance - a.balance)
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo auxiliar por tercero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// COMPROBANTES MANUALES
// =============================================

const getManualVouchers = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const result = await db.query(
            `SELECT mv.*,
                    COALESCE(json_agg(json_build_object(
                        'id', mvl.id,
                        'account_code', mvl.account_code,
                        'account_name', mvl.account_name,
                        'line_description', mvl.line_description,
                        'debit', mvl.debit,
                        'credit', mvl.credit,
                        'third_party_name', mvl.third_party_name,
                        'third_party_document', mvl.third_party_document
                    ) ORDER BY mvl.id) FILTER (WHERE mvl.id IS NOT NULL), '[]'::json) AS lines
             FROM manual_vouchers mv
             LEFT JOIN manual_voucher_lines mvl ON mvl.voucher_id = mv.id
             WHERE mv.tenant_id = $1
             GROUP BY mv.id
             ORDER BY mv.voucher_date DESC, mv.id DESC`,
            [tenantId]
        );
        res.json({ success: true, vouchers: result.rows });
    } catch (error) {
        console.error('[Accounting] Error obteniendo comprobantes manuales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createManualVoucher = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const { voucherType = 'AJUSTE_CONTABLE', voucherDate, description, lines = [] } = req.body;

        if (!description || !Array.isArray(lines) || lines.length < 2) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Descripción y al menos dos líneas son obligatorias' });
        }

        const normalizedLines = lines
            .map((line) => ({
                account_code: String(line.account_code || '').trim(),
                account_name: line.account_name || getDefaultAccountName(String(line.account_code || '').trim()),
                description: line.line_description || description,
                debit: Number(line.debit || 0),
                credit: Number(line.credit || 0),
                third_party_name: line.third_party_name || null,
                third_party_document: line.third_party_document || null
            }))
            .filter((line) => line.account_code && (line.debit > 0 || line.credit > 0));

        const totalDebit = normalizedLines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = normalizedLines.reduce((sum, line) => sum + line.credit, 0);

        if (normalizedLines.length < 2 || Math.abs(totalDebit - totalCredit) > 0.01) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'El comprobante debe tener al menos dos líneas y cuadrar' });
        }

        const journal = await insertJournalEntry(client, tenantId, {
            description,
            documentType: voucherType,
            documentId: `manual-${Date.now()}`,
            documentNumber: await getNextManualVoucherNumber(client, tenantId),
            entryDate: voucherDate || new Date(),
            lines: normalizedLines,
            userId
        });

        const voucherResult = await client.query(
            `INSERT INTO manual_vouchers (
                tenant_id, voucher_number, voucher_type, voucher_date, description,
                total_debit, total_credit, status, journal_entry_id, created_by, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVO',$8,$9,NOW(),NOW())
            RETURNING *`,
            [tenantId, journal.entryNumber.replace('AST', 'MC'), voucherType, voucherDate || new Date(), description, totalDebit, totalCredit, journal.id, userId || null]
        );

        for (const line of normalizedLines) {
            await client.query(
                `INSERT INTO manual_voucher_lines (
                    voucher_id, account_code, account_name, line_description, debit, credit,
                    third_party_name, third_party_document, created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
                [voucherResult.rows[0].id, line.account_code, line.account_name, line.description, line.debit, line.credit, line.third_party_name, line.third_party_document]
            );
        }

        await client.query('COMMIT');
        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'manual',
            action: 'voucher.created',
            entityType: 'manual_voucher',
            entityId: voucherResult.rows[0].id,
            entityNumber: voucherResult.rows[0].voucher_number,
            documentType: voucherType,
            documentId: voucherResult.rows[0].id,
            documentNumber: voucherResult.rows[0].voucher_number,
            message: 'Comprobante manual creado',
            afterData: {
                voucher: voucherResult.rows[0],
                journal
            },
            metadata: { source: 'accountingController.createManualVoucher' }
        });
        res.status(201).json({ success: true, voucher: voucherResult.rows[0], journal });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Accounting] Error creando comprobante manual:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

// =============================================
// CUENTAS POR PAGAR
// =============================================

const getAccountsPayableReport = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { status, supplierSearch, documentType } = req.query;

        let whereClause = 'WHERE tenant_id = $1';
        const params = [tenantId];
        let paramIdx = 2;

        if (status && status !== 'TODAS') {
            whereClause += ` AND status = $${paramIdx}`;
            params.push(status);
            paramIdx++;
        }
        if (supplierSearch) {
            whereClause += ` AND (supplier_name ILIKE $${paramIdx} OR supplier_document_number ILIKE $${paramIdx})`;
            params.push(`%${supplierSearch}%`);
            paramIdx++;
        }
        if (documentType) {
            whereClause += ` AND document_type = $${paramIdx}`;
            params.push(documentType);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                ap.*,
                GREATEST(CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date), 0) AS days_overdue,
                CASE
                    WHEN ap.balance_amount <= 0.009 THEN 'AL DIA'
                    WHEN CURRENT_DATE <= COALESCE(ap.due_date, ap.issue_date) THEN 'AL DIA'
                    WHEN CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date) BETWEEN 1 AND 30 THEN '1-30'
                    WHEN CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date) BETWEEN 31 AND 60 THEN '31-60'
                    WHEN CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date) BETWEEN 61 AND 90 THEN '61-90'
                    ELSE '90+'
                END AS aging_bucket
             FROM accounts_payable ap
             ${whereClause}
             ORDER BY COALESCE(ap.due_date, ap.issue_date) ASC, ap.id DESC`,
            params
        );

        const summary = result.rows.reduce((acc, row) => {
            const balance = Number(row.balance_amount || 0);
            acc.totalOriginal += Number(row.original_amount || 0);
            acc.totalPaid += Number(row.paid_amount || 0);
            acc.totalBalance += balance;
            acc.byBucket[row.aging_bucket] = (acc.byBucket[row.aging_bucket] || 0) + balance;
            return acc;
        }, {
            totalOriginal: 0,
            totalPaid: 0,
            totalBalance: 0,
            byBucket: { 'AL DIA': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
        });

        res.json({ success: true, payables: result.rows, summary });
    } catch (error) {
        console.error('[Accounting] Error obteniendo cuentas por pagar:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAccountsPayablePaymentsReport = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { supplierSearch, startDate, endDate } = req.query;

        let whereClause = 'WHERE apa.tenant_id = $1';
        const params = [tenantId];
        let paramIdx = 2;

        if (supplierSearch) {
            whereClause += ` AND (ap.supplier_name ILIKE $${paramIdx} OR COALESCE(ap.supplier_document_number, '') ILIKE $${paramIdx})`;
            params.push(`%${supplierSearch}%`);
            paramIdx++;
        }
        if (startDate) {
            whereClause += ` AND apa.application_date >= $${paramIdx}`;
            params.push(startDate);
            paramIdx++;
        }
        if (endDate) {
            whereClause += ` AND apa.application_date <= $${paramIdx}`;
            params.push(endDate);
            paramIdx++;
        }

        const result = await db.query(
            `SELECT
                apa.id,
                apa.source_type,
                apa.source_number,
                apa.application_date,
                apa.amount,
                apa.notes,
                ap.document_number,
                ap.document_type,
                ap.supplier_name,
                ap.supplier_document_number
             FROM accounts_payable_applications apa
             INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
             ${whereClause}
             ORDER BY apa.application_date DESC, apa.id DESC`,
            params
        );

        const summary = result.rows.reduce((acc, row) => {
            acc.totalPaid += Number(row.amount || 0);
            acc.count += 1;
            return acc;
        }, { totalPaid: 0, count: 0 });

        res.json({ success: true, payments: result.rows, summary });
    } catch (error) {
        console.error('[Accounting] Error obteniendo pagos de proveedores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createAccountsPayable = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const {
            supplierName,
            supplierDocumentType = 'NIT',
            supplierDocumentNumber,
            documentType = 'FACTURA_PROVEEDOR',
            documentNumber,
            issueDate,
            dueDate,
            amount,
            subtotalAmount,
            taxAmount = 0,
            withholdingSourceAmount = 0,
            withholdingIcaAmount = 0,
            withholdingVatAmount = 0,
            expenseAccountCode,
            expenseAccountName,
            taxAccountCode,
            withholdingSourceCode,
            withholdingIcaCode,
            withholdingVatCode,
            notes
        } = req.body;

        if (!supplierName || !documentNumber || !amount || !expenseAccountCode) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Proveedor, documento, monto y cuenta de gasto son obligatorios' });
        }

        const settingsResult = await client.query(`SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
        const settings = settingsResult.rows[0] || {};
        const payableAccountCode = settings.accounts_payable_code || '220505';
        const taxAmountValue = Math.max(Number(taxAmount || 0), 0);
        const withholdingSourceValue = Math.max(Number(withholdingSourceAmount || 0), 0);
        const withholdingIcaValue = Math.max(Number(withholdingIcaAmount || 0), 0);
        const withholdingVatValue = Math.max(Number(withholdingVatAmount || 0), 0);
        const totalWithholdings = withholdingSourceValue + withholdingIcaValue + withholdingVatValue;
        const subtotalValue = subtotalAmount != null && subtotalAmount !== ''
            ? Math.max(Number(subtotalAmount || 0), 0)
            : Math.max(Number(amount || 0) - taxAmountValue + totalWithholdings, 0);
        const totalAmount = Math.max(
            Number(amount != null && amount !== '' ? amount : (subtotalValue + taxAmountValue - totalWithholdings)),
            0
        );
        const resolvedTaxAccountCode = taxAccountCode || settings.vat_deductible_code || '240810';
        const resolvedWithholdingSourceCode = withholdingSourceCode || settings.withholding_source_code || '236540';
        const resolvedWithholdingIcaCode = withholdingIcaCode || settings.withholding_ica_code || '236801';
        const resolvedWithholdingVatCode = withholdingVatCode || settings.withholding_vat_code || '236703';

        if (subtotalValue <= 0 && taxAmountValue <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'La compra debe tener base o impuesto mayor a cero' });
        }

        if (totalAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'El neto por pagar debe ser mayor a cero' });
        }

        const payableResult = await client.query(
            `INSERT INTO accounts_payable (
                tenant_id, supplier_name, supplier_document_type, supplier_document_number,
                document_type, document_number, issue_date, due_date,
                subtotal_amount, tax_amount, withholding_source_amount, withholding_ica_amount, withholding_vat_amount,
                original_amount, paid_amount, balance_amount, status,
                expense_account_code, expense_account_name, payable_account_code, tax_account_code,
                withholding_source_code, withholding_ica_code, withholding_vat_code,
                currency, notes, created_by, created_at, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,$14,'PENDIENTE',$15,$16,$17,$18,$19,$20,$21,'COP',$22,$23,NOW(),NOW()
            )
            RETURNING *`,
            [
                tenantId,
                supplierName,
                supplierDocumentType,
                supplierDocumentNumber || null,
                documentType,
                documentNumber,
                issueDate || new Date(),
                dueDate || issueDate || new Date(),
                subtotalValue,
                taxAmountValue,
                withholdingSourceValue,
                withholdingIcaValue,
                withholdingVatValue,
                totalAmount,
                expenseAccountCode,
                expenseAccountName || getDefaultAccountName(expenseAccountCode),
                payableAccountCode,
                resolvedTaxAccountCode,
                resolvedWithholdingSourceCode,
                resolvedWithholdingIcaCode,
                resolvedWithholdingVatCode,
                notes || null,
                userId || null
            ]
        );

        const payable = payableResult.rows[0];

        await upsertThirdParty(client, {
            tenantId,
            kind: 'SUPPLIER',
            sourceType: 'ACCOUNTS_PAYABLE',
            sourceId: payable.id,
            documentType: supplierDocumentType,
            documentNumber: supplierDocumentNumber || `PROV-${payable.id}`,
            name: supplierName,
            status: 'ACTIVO',
            metadata: {
                payable_document_number: payable.document_number,
                payable_document_type: payable.document_type
            }
        });

        const journal = await insertJournalEntry(client, tenantId, {
            description: `CxP ${documentNumber} - ${supplierName}`,
            documentType: 'CUENTA_POR_PAGAR',
            documentId: payable.id,
            documentNumber,
            entryDate: issueDate || new Date(),
            lines: [
                ...(subtotalValue > 0 ? [{
                    account_code: expenseAccountCode,
                    account_name: expenseAccountName || getDefaultAccountName(expenseAccountCode),
                    description: notes || `Registro gasto proveedor ${supplierName}`,
                    debit: subtotalValue,
                    credit: 0
                }] : []),
                ...(taxAmountValue > 0 ? [{
                    account_code: resolvedTaxAccountCode,
                    account_name: getDefaultAccountName(resolvedTaxAccountCode),
                    description: `IVA descontable ${documentNumber}`,
                    debit: taxAmountValue,
                    credit: 0
                }] : []),
                {
                    account_code: payableAccountCode,
                    account_name: getDefaultAccountName(payableAccountCode),
                    description: `Obligacion con proveedor ${supplierName}`,
                    debit: 0,
                    credit: totalAmount
                },
                ...(withholdingSourceValue > 0 ? [{
                    account_code: resolvedWithholdingSourceCode,
                    account_name: getDefaultAccountName(resolvedWithholdingSourceCode),
                    description: `Retefuente ${documentNumber}`,
                    debit: 0,
                    credit: withholdingSourceValue
                }] : []),
                ...(withholdingIcaValue > 0 ? [{
                    account_code: resolvedWithholdingIcaCode,
                    account_name: getDefaultAccountName(resolvedWithholdingIcaCode),
                    description: `ReteICA ${documentNumber}`,
                    debit: 0,
                    credit: withholdingIcaValue
                }] : []),
                ...(withholdingVatValue > 0 ? [{
                    account_code: resolvedWithholdingVatCode,
                    account_name: getDefaultAccountName(resolvedWithholdingVatCode),
                    description: `ReteIVA ${documentNumber}`,
                    debit: 0,
                    credit: withholdingVatValue
                }] : []),
            ],
            userId
        });

        await client.query('COMMIT');
        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.created',
            entityType: 'accounts_payable',
            entityId: payable.id,
            entityNumber: payable.document_number,
            documentType: payable.document_type,
            documentId: payable.id,
            documentNumber: payable.document_number,
            message: 'Cuenta por pagar creada',
            afterData: { payable, journal },
            metadata: { source: 'accountingController.createAccountsPayable' }
        });
        res.status(201).json({ success: true, payable, journal });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Accounting] Error creando cuenta por pagar:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const applyAccountsPayablePayment = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const { payableId, amount, paymentDate, paymentMethod = 'transferencia', bankAccountCode, notes } = req.body;

        if (!payableId || !amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'payableId y amount son obligatorios' });
        }

        const payableResult = await client.query(
            `SELECT * FROM accounts_payable WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [payableId, tenantId]
        );

        const payable = payableResult.rows[0];
        if (!payable) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Cuenta por pagar no encontrada' });
        }

        const paymentAmount = Math.min(Number(amount || 0), Number(payable.balance_amount || 0));
        if (paymentAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Monto inválido para aplicar' });
        }

        const sourceNumber = `EGR-${Date.now()}`;
        await client.query(
            `INSERT INTO accounts_payable_applications (
                tenant_id, accounts_payable_id, source_type, source_id, source_number,
                application_date, amount, notes, created_by, created_at
            ) VALUES ($1,$2,'PAGO_CXP',NULL,$3,$4,$5,$6,$7,NOW())`,
            [tenantId, payable.id, sourceNumber, paymentDate || new Date(), paymentAmount, notes || null, userId || null]
        );

        const updatedResult = await client.query(
            `UPDATE accounts_payable
             SET paid_amount = ROUND((paid_amount + $1)::numeric, 2),
                 balance_amount = ROUND(GREATEST(original_amount - (paid_amount + $1), 0)::numeric, 2),
                 status = CASE
                    WHEN GREATEST(original_amount - (paid_amount + $1), 0) <= 0.009 THEN 'PAGADA'
                    WHEN (paid_amount + $1) > 0 THEN 'PARCIAL'
                    ELSE status
                 END,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [paymentAmount, payable.id]
        );

        const updated = updatedResult.rows[0];
        const settingsResult = await client.query(`SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
        const settings = settingsResult.rows[0] || {};
        const cashOrBankCode = bankAccountCode || (String(paymentMethod).toLowerCase().includes('efect') ? (settings.cash_account_code || '110505') : (settings.bank_account_code || '111005'));

        const journal = await insertJournalEntry(client, tenantId, {
            description: `Pago CxP ${updated.document_number} - ${updated.supplier_name}`,
            documentType: 'PAGO_CXP',
            documentId: updated.id,
            documentNumber: sourceNumber,
            entryDate: paymentDate || new Date(),
            lines: [
                {
                    account_code: updated.payable_account_code || settings.accounts_payable_code || '220505',
                    account_name: getDefaultAccountName(updated.payable_account_code || settings.accounts_payable_code || '220505'),
                    description: `Disminución obligación ${updated.document_number}`,
                    debit: paymentAmount,
                    credit: 0
                },
                {
                    account_code: cashOrBankCode,
                    account_name: getDefaultAccountName(cashOrBankCode),
                    description: `Salida ${paymentMethod}`,
                    debit: 0,
                    credit: paymentAmount
                }
            ],
            userId
        });

        await client.query('COMMIT');
        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.payment_applied',
            entityType: 'accounts_payable',
            entityId: updated.id,
            entityNumber: updated.document_number,
            documentType: updated.document_type,
            documentId: updated.id,
            documentNumber: sourceNumber,
            message: 'Pago aplicado a cuenta por pagar',
            afterData: { payable: updated, journal },
            metadata: { paymentAmount, paymentMethod, source: 'accountingController.applyAccountsPayablePayment' }
        });
        res.json({ success: true, payable: updated, journal });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Accounting] Error aplicando pago de CxP:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const getTaxSummary = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { startDate, endDate } = req.query;

        let invoiceDateFilter = '';
        let payableDateFilter = '';
        const invoiceParams = [tenantId];
        const payableParams = [tenantId];
        let invoiceIdx = 2;
        let payableIdx = 2;

        if (startDate) {
            invoiceDateFilter += ` AND date >= $${invoiceIdx++}`;
            payableDateFilter += ` AND issue_date >= $${payableIdx++}`;
            invoiceParams.push(startDate);
            payableParams.push(startDate);
        }
        if (endDate) {
            invoiceDateFilter += ` AND date <= $${invoiceIdx++}`;
            payableDateFilter += ` AND issue_date <= $${payableIdx++}`;
            invoiceParams.push(endDate);
            payableParams.push(endDate);
        }

        const salesTaxesResult = await db.query(
            `SELECT COALESCE(SUM(tax_amount), 0) AS vat_generated
             FROM invoices
             WHERE tenant_id = $1
             ${invoiceDateFilter}`,
            invoiceParams
        );

        const purchasesTaxesResult = await db.query(
            `SELECT
                COALESCE(SUM(tax_amount), 0) AS vat_deductible,
                COALESCE(SUM(withholding_source_amount), 0) AS withholding_source,
                COALESCE(SUM(withholding_ica_amount), 0) AS withholding_ica,
                COALESCE(SUM(withholding_vat_amount), 0) AS withholding_vat,
                COALESCE(SUM(subtotal_amount), 0) AS purchase_subtotal,
                COALESCE(SUM(original_amount), 0) AS net_payable
             FROM accounts_payable
             WHERE tenant_id = $1
             ${payableDateFilter}`,
            payableParams
        );

        const taxes = {
            vatGenerated: Number(salesTaxesResult.rows[0]?.vat_generated || 0),
            vatDeductible: Number(purchasesTaxesResult.rows[0]?.vat_deductible || 0),
            withholdingSource: Number(purchasesTaxesResult.rows[0]?.withholding_source || 0),
            withholdingIca: Number(purchasesTaxesResult.rows[0]?.withholding_ica || 0),
            withholdingVat: Number(purchasesTaxesResult.rows[0]?.withholding_vat || 0),
            purchaseSubtotal: Number(purchasesTaxesResult.rows[0]?.purchase_subtotal || 0),
            netPayable: Number(purchasesTaxesResult.rows[0]?.net_payable || 0)
        };

        res.json({
            success: true,
            summary: {
                ...taxes,
                vatPayable: taxes.vatGenerated - taxes.vatDeductible,
                totalWithholdings: taxes.withholdingSource + taxes.withholdingIca + taxes.withholdingVat
            }
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo resumen tributario:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// REGLAS DE CLASIFICACIÓN
// =============================================

// =============================================
// BANCOS Y CONCILIACION
// =============================================

const getBankTransactions = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { bankId, status = 'TODAS', search = '', startDate, endDate } = req.query;

        const where = ['bt.tenant_id = $1'];
        const params = [tenantId];

        if (bankId) {
            params.push(bankId);
            where.push(`bt.bank_id = $${params.length}`);
        }
        if (status && status !== 'TODAS') {
            params.push(status);
            where.push(`bt.status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            where.push(`(bt.description ILIKE $${params.length} OR COALESCE(bt.reference, '') ILIKE $${params.length} OR tb.name ILIKE $${params.length})`);
        }
        if (startDate) {
            params.push(startDate);
            where.push(`bt.transaction_date >= $${params.length}`);
        }
        if (endDate) {
            params.push(endDate);
            where.push(`bt.transaction_date <= $${params.length}`);
        }

        const result = await db.query(
            `SELECT
                bt.*,
                tb.name AS bank_name,
                tb.account_code,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', brl.id,
                            'source_type', brl.source_type,
                            'source_id', brl.source_id,
                            'source_number', brl.source_number,
                            'journal_entry_id', brl.journal_entry_id,
                            'movement_date', brl.movement_date,
                            'description', brl.description,
                            'amount', brl.amount
                        )
                        ORDER BY brl.id
                    ) FILTER (WHERE brl.id IS NOT NULL),
                    '[]'::json
                ) AS reconciliation_lines
             FROM bank_transactions bt
             INNER JOIN tenant_banks tb ON tb.id = bt.bank_id
             LEFT JOIN bank_reconciliations br ON br.bank_transaction_id = bt.id
             LEFT JOIN bank_reconciliation_lines brl ON brl.reconciliation_id = br.id
             WHERE ${where.join(' AND ')}
             GROUP BY bt.id, tb.name, tb.account_code
             ORDER BY bt.transaction_date DESC, bt.id DESC`,
            params
        );

        const summary = result.rows.reduce((acc, row) => {
            const amount = Number(row.amount || 0);
            const matched = Number(row.matched_amount || 0);
            acc.total += amount;
            acc.totalMatched += matched;
            acc.totalPending += Math.max(amount - matched, 0);
            acc.byStatus[row.status] = (acc.byStatus[row.status] || 0) + 1;
            return acc;
        }, { total: 0, totalMatched: 0, totalPending: 0, byStatus: {} });

        res.json({ success: true, transactions: result.rows, summary });
    } catch (error) {
        console.error('[Accounting] Error obteniendo movimientos bancarios:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createBankTransaction = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const {
            bankId,
            transactionDate,
            description,
            reference,
            transactionType = 'ABONO',
            amount,
            runningBalance,
            source = 'MANUAL',
            notes
        } = req.body;

        if (!bankId || !description || !amount) {
            return res.status(400).json({ success: false, error: 'bankId, description y amount son obligatorios' });
        }

        const numericAmount = Math.round(Number(amount || 0) * 100) / 100;
        if (numericAmount <= 0) {
            return res.status(400).json({ success: false, error: 'El monto debe ser mayor a cero' });
        }

        const bankResult = await db.query(
            `SELECT id FROM tenant_banks WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [bankId, tenantId]
        );

        if (bankResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Banco no encontrado para este tenant' });
        }

        const result = await db.query(
            `INSERT INTO bank_transactions (
                tenant_id, bank_id, transaction_date, description, reference,
                transaction_type, amount, running_balance, source, matched_amount,
                status, notes, created_by, created_at, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,0,'PENDIENTE',$10,$11,NOW(),NOW()
            )
            RETURNING *`,
            [
                tenantId,
                bankId,
                transactionDate || new Date(),
                description,
                reference || null,
                transactionType,
                numericAmount,
                runningBalance != null && runningBalance !== '' ? Number(runningBalance) : null,
                source,
                notes || null,
                userId
            ]
        );

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'bancos',
            action: 'bank.transaction.created',
            entityType: 'bank_transaction',
            entityId: result.rows[0].id,
            entityNumber: result.rows[0].reference || String(result.rows[0].id),
            message: 'Movimiento bancario creado',
            afterData: result.rows[0],
            metadata: { source: 'accountingController.createBankTransaction' }
        });

        res.status(201).json({ success: true, transaction: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error creando movimiento bancario:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getBankReconciliationCandidates = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { bankTransactionId } = req.query;

        if (!bankTransactionId) {
            return res.status(400).json({ success: false, error: 'bankTransactionId es obligatorio' });
        }

        const transactionResult = await db.query(
            `SELECT bt.*, tb.name AS bank_name, tb.account_code
             FROM bank_transactions bt
             INNER JOIN tenant_banks tb ON tb.id = bt.bank_id
             WHERE bt.id = $1 AND bt.tenant_id = $2
             LIMIT 1`,
            [bankTransactionId, tenantId]
        );

        const bankTransaction = transactionResult.rows[0];
        if (!bankTransaction) {
            return res.status(404).json({ success: false, error: 'Movimiento bancario no encontrado' });
        }

        const txAmount = Number(bankTransaction.amount || 0);
        const txType = String(bankTransaction.transaction_type || 'ABONO').toUpperCase();
        const candidates = [];

        if (txType === 'ABONO') {
            const receiptCandidates = await db.query(
                `SELECT
                    'RECIBO_PAGO' AS source_type,
                    pr.id AS source_id,
                    pr.receipt_number AS source_number,
                    pr.date AS movement_date,
                    CONCAT('Recibo ', pr.receipt_number, ' - ', COALESCE(pr.client_name, 'Cliente')) AS description,
                    pr.total AS amount,
                    je.id AS journal_entry_id
                 FROM payment_receipts pr
                 LEFT JOIN journal_entries je
                    ON je.tenant_id = pr.tenant_id
                   AND je.document_type = 'RECIBO_PAGO'
                   AND je.document_number = pr.receipt_number
                 WHERE pr.tenant_id = $1
                   AND ABS(COALESCE(pr.total, 0) - $2) <= 0.01
                   AND NOT EXISTS (
                        SELECT 1
                        FROM bank_reconciliation_lines brl
                        INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                        WHERE brl.source_type = 'RECIBO_PAGO'
                          AND brl.source_id = pr.id
                          AND br.status <> 'ANULADA'
                   )
                 ORDER BY pr.date DESC, pr.id DESC
                 LIMIT 20`,
                [tenantId, txAmount]
            );
            candidates.push(...receiptCandidates.rows);
        }

        if (txType === 'CARGO') {
            const payableCandidates = await db.query(
                `SELECT
                    'PAGO_CXP' AS source_type,
                    apa.id AS source_id,
                    apa.source_number AS source_number,
                    apa.application_date AS movement_date,
                    CONCAT('Pago CxP ', apa.source_number, ' - ', COALESCE(ap.supplier_name, 'Proveedor')) AS description,
                    apa.amount AS amount,
                    je.id AS journal_entry_id
                 FROM accounts_payable_applications apa
                 INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
                 LEFT JOIN journal_entries je
                    ON je.tenant_id = apa.tenant_id
                   AND je.document_type = 'PAGO_CXP'
                   AND je.document_number = apa.source_number
                 WHERE apa.tenant_id = $1
                   AND ABS(COALESCE(apa.amount, 0) - $2) <= 0.01
                   AND NOT EXISTS (
                        SELECT 1
                        FROM bank_reconciliation_lines brl
                        INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                        WHERE brl.source_type = 'PAGO_CXP'
                          AND brl.source_id = apa.id
                          AND br.status <> 'ANULADA'
                   )
                 ORDER BY apa.application_date DESC, apa.id DESC
                 LIMIT 20`,
                [tenantId, txAmount]
            );
            const egresoCandidates = await db.query(
                `SELECT
                    'COMPROBANTE_EGRESO' AS source_type,
                    mv.id AS source_id,
                    mv.voucher_number AS source_number,
                    mv.voucher_date AS movement_date,
                    CONCAT('Comprobante ', mv.voucher_number, ' - ', mv.description) AS description,
                    mv.total_credit AS amount,
                    mv.journal_entry_id
                 FROM manual_vouchers mv
                 WHERE mv.tenant_id = $1
                   AND mv.voucher_type = 'COMPROBANTE_EGRESO'
                   AND ABS(COALESCE(mv.total_credit, 0) - $2) <= 0.01
                   AND NOT EXISTS (
                        SELECT 1
                        FROM bank_reconciliation_lines brl
                        INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                        WHERE brl.source_type = 'COMPROBANTE_EGRESO'
                          AND brl.source_id = mv.id
                          AND br.status <> 'ANULADA'
                   )
                 ORDER BY mv.voucher_date DESC, mv.id DESC
                 LIMIT 20`,
                [tenantId, txAmount]
            );
            candidates.push(...payableCandidates.rows, ...egresoCandidates.rows);
        }

        if (txType === 'ABONO') {
            const ingresoCandidates = await db.query(
                `SELECT
                    'COMPROBANTE_INGRESO' AS source_type,
                    mv.id AS source_id,
                    mv.voucher_number AS source_number,
                    mv.voucher_date AS movement_date,
                    CONCAT('Comprobante ', mv.voucher_number, ' - ', mv.description) AS description,
                    mv.total_debit AS amount,
                    mv.journal_entry_id
                 FROM manual_vouchers mv
                 WHERE mv.tenant_id = $1
                   AND mv.voucher_type = 'COMPROBANTE_INGRESO'
                   AND ABS(COALESCE(mv.total_debit, 0) - $2) <= 0.01
                   AND NOT EXISTS (
                        SELECT 1
                        FROM bank_reconciliation_lines brl
                        INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                        WHERE brl.source_type = 'COMPROBANTE_INGRESO'
                          AND brl.source_id = mv.id
                          AND br.status <> 'ANULADA'
                   )
                 ORDER BY mv.voucher_date DESC, mv.id DESC
                 LIMIT 20`,
                [tenantId, txAmount]
            );
            candidates.push(...ingresoCandidates.rows);
        }

        if (bankTransaction.account_code) {
            const journalCandidates = await db.query(
                `SELECT
                    'ASIENTO_BANCARIO' AS source_type,
                    je.id AS source_id,
                    je.entry_number AS source_number,
                    je.entry_date AS movement_date,
                    je.description AS description,
                    ABS(CASE WHEN $3 = 'ABONO' THEN COALESCE(jel.debit, 0) ELSE COALESCE(jel.credit, 0) END) AS amount,
                    je.id AS journal_entry_id
                 FROM journal_entries je
                 INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
                 WHERE je.tenant_id = $1
                   AND jel.account_code = $2
                   AND ABS(ABS(CASE WHEN $3 = 'ABONO' THEN COALESCE(jel.debit, 0) ELSE COALESCE(jel.credit, 0) END) - $4) <= 0.01
                   AND NOT EXISTS (
                        SELECT 1
                        FROM bank_reconciliation_lines brl
                        INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                        WHERE brl.journal_entry_id = je.id
                          AND br.status <> 'ANULADA'
                   )
                 ORDER BY je.entry_date DESC, je.id DESC
                 LIMIT 20`,
                [tenantId, bankTransaction.account_code, txType, txAmount]
            );
            candidates.push(...journalCandidates.rows);
        }

        const uniqueCandidates = [];
        const seen = new Set();
        for (const candidate of candidates) {
            const key = `${candidate.source_type}:${candidate.source_id}:${candidate.journal_entry_id || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueCandidates.push(candidate);
            }
        }

        res.json({ success: true, bankTransaction, candidates: uniqueCandidates.slice(0, 50) });
    } catch (error) {
        console.error('[Accounting] Error obteniendo candidatos de conciliacion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const reconcileBankTransaction = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const {
            bankTransactionId,
            sourceType,
            sourceId = null,
            sourceNumber = null,
            journalEntryId = null,
            movementDate = null,
            description = null,
            amount = null,
            notes = null
        } = req.body;

        if (!bankTransactionId || !sourceType) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'bankTransactionId y sourceType son obligatorios' });
        }

        const transactionResult = await client.query(
            `SELECT * FROM bank_transactions WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [bankTransactionId, tenantId]
        );
        const bankTransaction = transactionResult.rows[0];

        if (!bankTransaction) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Movimiento bancario no encontrado' });
        }

        const pendingAmount = Math.max(Number(bankTransaction.amount || 0) - Number(bankTransaction.matched_amount || 0), 0);
        const matchedAmount = Math.round(Number(amount != null ? amount : pendingAmount) * 100) / 100;

        if (matchedAmount <= 0 || matchedAmount - pendingAmount > 0.01) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Monto de conciliacion invalido' });
        }

        let reconciliationResult = await client.query(
            `SELECT * FROM bank_reconciliations WHERE bank_transaction_id = $1 AND tenant_id = $2 LIMIT 1`,
            [bankTransactionId, tenantId]
        );

        if (reconciliationResult.rows.length === 0) {
            reconciliationResult = await client.query(
                `INSERT INTO bank_reconciliations (
                    tenant_id, bank_transaction_id, total_matched_amount, status, notes,
                    reconciled_at, reconciled_by, created_at, updated_at
                ) VALUES ($1,$2,0,'PENDIENTE',$3,NULL,NULL,NOW(),NOW())
                RETURNING *`,
                [tenantId, bankTransactionId, notes || null]
            );
        }

        const reconciliation = reconciliationResult.rows[0];

        const lineResult = await client.query(
            `INSERT INTO bank_reconciliation_lines (
                reconciliation_id, source_type, source_id, source_number, journal_entry_id,
                movement_date, description, amount, created_by, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
            RETURNING *`,
            [
                reconciliation.id,
                sourceType,
                sourceId,
                sourceNumber,
                journalEntryId,
                movementDate,
                description,
                matchedAmount,
                userId
            ]
        );

        const totalsResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM bank_reconciliation_lines
             WHERE reconciliation_id = $1`,
            [reconciliation.id]
        );

        const totalMatched = Math.round(Number(totalsResult.rows[0].total || 0) * 100) / 100;
        const newStatus = (Number(bankTransaction.amount || 0) - totalMatched) <= 0.01 ? 'CONCILIADO' : 'PARCIAL';

        await client.query(
            `UPDATE bank_reconciliations
             SET total_matched_amount = $1,
                 status = $2,
                 notes = COALESCE($3, notes),
                 reconciled_at = NOW(),
                 reconciled_by = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [totalMatched, newStatus, notes || null, userId, reconciliation.id]
        );

        const transactionUpdate = await client.query(
            `UPDATE bank_transactions
             SET matched_amount = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [totalMatched, newStatus, bankTransactionId]
        );

        await client.query('COMMIT');
        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'bancos',
            action: 'bank.transaction.reconciled',
            entityType: 'bank_transaction',
            entityId: transactionUpdate.rows[0].id,
            entityNumber: transactionUpdate.rows[0].reference || String(transactionUpdate.rows[0].id),
            message: 'Movimiento bancario conciliado',
            afterData: {
                transaction: transactionUpdate.rows[0],
                reconciliationLine: lineResult.rows[0]
            },
            metadata: { sourceType, sourceNumber, journalEntryId }
        });
        res.json({
            success: true,
            transaction: transactionUpdate.rows[0],
            reconciliationLine: lineResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Accounting] Error conciliando movimiento bancario:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const unreconcileBankTransactionLine = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const tenantId = resolveTenantId(req);
        const { id } = req.params;

        const lineResult = await client.query(
            `SELECT brl.*, br.id AS reconciliation_id, br.bank_transaction_id, bt.amount AS transaction_amount
             FROM bank_reconciliation_lines brl
             INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
             INNER JOIN bank_transactions bt ON bt.id = br.bank_transaction_id
             WHERE brl.id = $1 AND br.tenant_id = $2
             LIMIT 1`,
            [id, tenantId]
        );

        const line = lineResult.rows[0];
        if (!line) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Linea de conciliacion no encontrada' });
        }

        await client.query(`DELETE FROM bank_reconciliation_lines WHERE id = $1`, [id]);

        const totalsResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM bank_reconciliation_lines
             WHERE reconciliation_id = $1`,
            [line.reconciliation_id]
        );

        const totalMatched = Math.round(Number(totalsResult.rows[0].total || 0) * 100) / 100;
        const remaining = Math.max(Number(line.transaction_amount || 0) - totalMatched, 0);
        const newStatus = totalMatched <= 0.009 ? 'PENDIENTE' : (remaining <= 0.01 ? 'CONCILIADO' : 'PARCIAL');

        await client.query(
            `UPDATE bank_reconciliations
             SET total_matched_amount = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [totalMatched, newStatus, line.reconciliation_id]
        );

        const transactionUpdate = await client.query(
            `UPDATE bank_transactions
             SET matched_amount = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [totalMatched, newStatus, line.bank_transaction_id]
        );

        await client.query('COMMIT');
        await recordAccountingAuditEvent({
            tenantId,
            userId: req.user?.id || null,
            category: 'bancos',
            action: 'bank.transaction.unreconciled',
            entityType: 'bank_transaction',
            entityId: transactionUpdate.rows[0].id,
            entityNumber: transactionUpdate.rows[0].reference || String(transactionUpdate.rows[0].id),
            message: 'Conciliacion bancaria revertida',
            afterData: transactionUpdate.rows[0],
            metadata: { source: 'accountingController.unreconcileBankTransactionLine', lineId: id }
        });
        res.json({ success: true, transaction: transactionUpdate.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Accounting] Error deshaciendo conciliacion bancaria:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const getAuditEvents = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const audit = await listAccountingAuditEvents({
            tenantId,
            category: req.query.category || null,
            action: req.query.action || null,
            eventType: req.query.eventType || null,
            entityType: req.query.entityType || null,
            documentType: req.query.documentType || null,
            search: req.query.search || null,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null,
            page: req.query.page || 1,
            limit: req.query.limit || 50
        });
        res.json({
            success: true,
            events: audit.rows || [],
            total: audit.total || 0,
            page: Number(req.query.page || 1),
            totalPages: Math.ceil((audit.total || 0) / Number(req.query.limit || 50))
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo auditoria:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAuditSummary = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { category, action, eventType, entityType, search, startDate, endDate } = req.query;

        const params = [tenantId];
        const where = ['tenant_id = $1'];
        let idx = 2;

        if (category) {
            params.push(category);
            where.push(`category = $${idx++}`);
        }
        if (action) {
            params.push(action);
            where.push(`action = $${idx++}`);
        }
        if (eventType) {
            params.push(eventType);
            where.push(`event_type = $${idx++}`);
        }
        if (entityType) {
            params.push(entityType);
            where.push(`entity_type = $${idx++}`);
        }
        if (startDate) {
            params.push(startDate);
            where.push(`created_at >= $${idx++}`);
        }
        if (endDate) {
            params.push(endDate);
            where.push(`created_at <= $${idx++}`);
        }
        if (search) {
            params.push(`%${search}%`);
            where.push(`(
                message ILIKE $${idx}
                OR COALESCE(entity_number, '') ILIKE $${idx}
                OR COALESCE(document_number, '') ILIKE $${idx}
                OR COALESCE(metadata::text, '') ILIKE $${idx}
            )`);
        }

        const [byAction, byCategory, bySeverity, byEntity, totals] = await Promise.all([
            db.query(
                `SELECT action, COUNT(*)::int AS total
                 FROM accounting_audit_events
                 WHERE ${where.join(' AND ')}
                 GROUP BY action
                 ORDER BY total DESC, action ASC`,
                params
            ),
            db.query(
                `SELECT category, COUNT(*)::int AS total
                 FROM accounting_audit_events
                 WHERE ${where.join(' AND ')}
                 GROUP BY category
                 ORDER BY total DESC, category ASC`,
                params
            ),
            db.query(
                `SELECT event_type, COUNT(*)::int AS total
                 FROM accounting_audit_events
                 WHERE ${where.join(' AND ')}
                 GROUP BY event_type
                 ORDER BY total DESC, event_type ASC`,
                params
            ),
            db.query(
                `SELECT entity_type, COUNT(*)::int AS total
                 FROM accounting_audit_events
                 WHERE ${where.join(' AND ')} AND entity_type IS NOT NULL
                 GROUP BY entity_type
                 ORDER BY total DESC, entity_type ASC`,
                params
            ),
            db.query(
                `SELECT
                    COUNT(*)::int AS total_events,
                    COUNT(*) FILTER (WHERE event_type = 'SUCCESS')::int AS success_events,
                    COUNT(*) FILTER (WHERE event_type = 'ERROR')::int AS error_events,
                    COUNT(*) FILTER (WHERE severity = 'WARNING')::int AS warning_events
                 FROM accounting_audit_events
                 WHERE ${where.join(' AND ')}`,
                params
            )
        ]);

        res.json({
            success: true,
            totals: totals.rows[0] || {},
            byAction: byAction.rows,
            byCategory: byCategory.rows,
            bySeverity: bySeverity.rows,
            byEntity: byEntity.rows
        });
    } catch (error) {
        console.error('[Accounting] Error generando resumen de auditoria:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getClassificationRules = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const result = await db.query(
            `SELECT * FROM classification_rules WHERE tenant_id = $1 ORDER BY priority DESC, created_at DESC`,
            [tenantId]
        );
        res.json({ success: true, rules: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo reglas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createClassificationRule = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { keywords, accountCode, accountName, category, priority } = req.body;

        if (!keywords || !accountCode) {
            return res.status(400).json({ success: false, error: 'Keywords y código de cuenta son obligatorios' });
        }

        const result = await db.query(
            `INSERT INTO classification_rules (tenant_id, keywords, account_code, account_name, category, priority)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (tenant_id, keywords, account_code) DO UPDATE SET
                account_name = EXCLUDED.account_name,
                category = EXCLUDED.category,
                priority = EXCLUDED.priority,
                is_active = true
             RETURNING *`,
            [tenantId, keywords.toLowerCase(), accountCode, accountName, category, priority || 0]
        );

        res.status(201).json({ success: true, rule: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error creando regla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateClassificationRule = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const { keywords, accountCode, accountName, category, priority, isActive } = req.body;

        const result = await db.query(
            `UPDATE classification_rules SET
                keywords = COALESCE($1, keywords),
                account_code = COALESCE($2, account_code),
                account_name = COALESCE($3, account_name),
                category = COALESCE($4, category),
                priority = COALESCE($5, priority),
                is_active = COALESCE($6, is_active)
             WHERE id = $7 AND tenant_id = $8
             RETURNING *`,
            [keywords, accountCode, accountName, category, priority, isActive, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Regla no encontrada' });
        }
        res.json({ success: true, rule: result.rows[0] });
    } catch (error) {
        console.error('[Accounting] Error actualizando regla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteClassificationRule = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;

        const result = await db.query(
            `UPDATE classification_rules SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING *`,
            [id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Regla no encontrada' });
        }
        res.json({ success: true, message: 'Regla desactivada' });
    } catch (error) {
        console.error('[Accounting] Error desactivando regla:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const seedRules = async (req, res) => {
    const client = await db.getClient();
    try {
        const tenantId = req.user?.tenant_id;
        const count = await seedDefaultRules(client, tenantId);
        res.json({ success: true, message: `${count} reglas seedeadas`, count });
    } catch (error) {
        console.error('[Accounting] Error seedeando reglas:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

// =============================================
// MAPPINGS (APROBACIÓN / RECHAZO)
// =============================================

const getPendingMappings = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const result = await db.query(
            `SELECT * FROM account_mappings
             WHERE tenant_id = $1 AND approved = false
             ORDER BY last_used_at DESC`,
            [tenantId]
        );
        res.json({ success: true, mappings: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo mappings pendientes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAllMappings = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;
        const result = await db.query(
            `SELECT * FROM account_mappings
             WHERE tenant_id = $1
             ORDER BY approved ASC, last_used_at DESC`,
            [tenantId]
        );
        res.json({ success: true, mappings: result.rows, count: result.rows.length });
    } catch (error) {
        console.error('[Accounting] Error obteniendo mappings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const approveMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id;

        const result = await db.query(
            `UPDATE account_mappings SET
                approved = true,
                approved_by = $1,
                approved_at = NOW()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [userId, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Mapping no encontrado' });
        }
        res.json({ success: true, mapping: result.rows[0], message: 'Mapping aprobado' });
    } catch (error) {
        console.error('[Accounting] Error aprobando mapping:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const rejectMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id;
        const { accountCode, accountName } = req.body;

        if (!accountCode) {
            return res.status(400).json({ success: false, error: 'Debe proporcionar el código de cuenta correcto' });
        }

        const result = await db.query(
            `UPDATE account_mappings SET
                account_code = $1,
                account_name = COALESCE($2, account_name),
                approved = true,
                approved_by = $3,
                approved_at = NOW()
             WHERE id = $4 AND tenant_id = $5
             RETURNING *`,
            [accountCode, accountName, userId, id, tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Mapping no encontrado' });
        }
        res.json({ success: true, mapping: result.rows[0], message: 'Mapping corregido y aprobado' });
    } catch (error) {
        console.error('[Accounting] Error rechazando mapping:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// DASHBOARD
// =============================================

const getDashboardSummary = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;

        // KPIs principales
        const kpis = await db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) as total_ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' THEN jel.debit - jel.credit ELSE 0 END), 0) as total_gastos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '6%' THEN jel.debit - jel.credit ELSE 0 END), 0) as total_costos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'`,
            [tenantId]
        );

        const entriesCount = await db.query(
            `SELECT COUNT(*) as total FROM journal_entries WHERE tenant_id = $1 AND status = 'ACTIVO'`,
            [tenantId]
        );

        const pendingMappings = await db.query(
            `SELECT COUNT(*) as total FROM account_mappings WHERE tenant_id = $1 AND approved = false`,
            [tenantId]
        );

        const { total_ingresos, total_gastos, total_costos } = kpis.rows[0];
        const utilidad = Number(total_ingresos) - Number(total_gastos) - Number(total_costos);

        res.json({
            success: true,
            summary: {
                ingresos: Number(total_ingresos),
                gastos: Number(total_gastos),
                costos: Number(total_costos),
                utilidad,
                totalAsientos: parseInt(entriesCount.rows[0].total),
                pendingMappings: parseInt(pendingMappings.rows[0].total)
            }
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo dashboard:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getChartData = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId;

        // Datos mensuales (últimos 12 meses)
        const monthly = await db.query(
            `SELECT
                TO_CHAR(je.entry_date, 'YYYY-MM') as month,
                TO_CHAR(je.entry_date, 'Mon') as month_name,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) as ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' OR jel.account_code LIKE '6%' THEN jel.debit - jel.credit ELSE 0 END), 0) as gastos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')
             GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM'), TO_CHAR(je.entry_date, 'Mon')
             ORDER BY month`,
            [tenantId]
        );

        // Gastos por categoría (para donut chart)
        const categories = await db.query(
            `SELECT
                jel.account_name as category,
                COALESCE(SUM(jel.debit - jel.credit), 0) as amount
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND (jel.account_code LIKE '5%' OR jel.account_code LIKE '6%')
               AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')
             GROUP BY jel.account_name
             HAVING SUM(jel.debit - jel.credit) > 0
             ORDER BY amount DESC
             LIMIT 8`,
            [tenantId]
        );

        res.json({
            success: true,
            chartData: {
                monthly: monthly.rows,
                categories: categories.rows
            }
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo datos de gráficas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// REVERSAR ASIENTO
// =============================================
const reverseJournalEntry = async (req, res) => {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // 1. Traer el asiento original y sus líneas
    const origRes = await client.query('SELECT * FROM journal_entries WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (origRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Asiento no encontrado' });
    }
    const orig = origRes.rows[0];
    if (orig.status === 'REVERSADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Este asiento ya fue reversado' });
    }
    if (orig.reverses_entry_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'No puedes reversar un asiento que ya es reverso de otro' });
    }

    const linesRes = await client.query('SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id', [id]);

    // 2. Construir líneas invertidas (swap debit/credit)
    const reverseLines = linesRes.rows.map(l => ({
      account_code: l.account_code,
      account_name: l.account_name,
      description: 'REV: ' + (l.description || ''),
      debit: Number(l.credit || 0),
      credit: Number(l.debit || 0),
      third_party_document: l.third_party_document || null,
      third_party_name: l.third_party_name || null,
      base_amount: l.base_amount,
      tax_type: l.tax_type,
      tax_rate: l.tax_rate,
      tax_amount: l.tax_amount,
      tax_treatment: l.tax_treatment,
      dian_concept_code: l.dian_concept_code,
    }));

    // 3. Insertar nuevo asiento reverso
    const accountingCoreService = require('../services/accountingCoreService');
    const newEntry = await accountingCoreService.insertJournalEntry(client, tenantId, {
      description: 'REVERSO: ' + (orig.description || ''),
      documentType: 'REVERSO',
      documentId: orig.id,
      documentNumber: orig.entry_number,
      entryDate: new Date(),
      lines: reverseLines,
      userId,
    });

    // 4. Marcar original como reversado y guardar referencia cruzada
    await client.query(
      `UPDATE journal_entries SET status = 'REVERSADO', reversed_by_entry_id = $1, updated_at = NOW() WHERE id = $2`,
      [newEntry.id, id]
    );
    try {
      await client.query('UPDATE journal_entries SET reverses_entry_id = $1 WHERE id = $2', [id, newEntry.id]);
    } catch { /* columna podría no existir — no crítico */ }

    await client.query('COMMIT');
    res.json({ success: true, reverseEntry: { id: newEntry.id, entryNumber: newEntry.entryNumber }, originalId: id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Accounting] Error al reversar asiento:', err);
    res.status(500).json({ success: false, error: err.message || 'Error reversando asiento' });
  } finally {
    client.release();
  }
};

const addReverseColumnsIfMissing = async () => {
  try {
    await db.query("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversed_by_entry_id INTEGER");
    await db.query("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reverses_entry_id INTEGER");
  } catch (e) { /* silent */ }
};
addReverseColumnsIfMissing();

// =============================================
// EXPORTS
// =============================================

module.exports = {
    getAccountingPeriods,
    createAccountingPeriod,
    closeAccountingPeriod,
    reopenAccountingPeriod,
    // PUC
    getChartOfAccounts,
    createAccount,
    bulkCreateAccounts,
    updateAccount,
    deleteAccount,
    seedPucColombia,
    // Journal
    getJournalEntries,
    getJournalEntriesSummary,
    getUnpostedEntries,
    getTrialBalanceByThirdParty,
    getTrialBalanceConfigurable,
    getJournalEntryById,
    // Ledger
    getLedger,
    // Trial Balance
    getTrialBalance,
    getBalanceSheet,
    // Income Statement
    getIncomeStatement,
    // Cash Flow & Equity Changes
    getCashFlowStatement,
    getEquityChangesStatement,
    // Auxiliar
    getAuxiliarBook,
    getAccountsReceivableReport,
    getAccountsPayablePaymentsReport,
    getThirdPartyLedger,
    getManualVouchers,
    createManualVoucher,
    getAccountsPayableReport,
    createAccountsPayable,
    applyAccountsPayablePayment,
    getTaxSummary,
    getBankTransactions,
    createBankTransaction,
    getBankReconciliationCandidates,
    reconcileBankTransaction,
    unreconcileBankTransactionLine,
    getAuditEvents,
    getAuditSummary,
    // Classification Rules
    getClassificationRules,
    createClassificationRule,
    updateClassificationRule,
    deleteClassificationRule,
    seedRules,
    // Mappings
    getPendingMappings,
    getAllMappings,
    approveMapping,
    rejectMapping,
    // Dashboard
    getDashboardSummary,
    getChartData,
    // Reverse
    reverseJournalEntry,
};










