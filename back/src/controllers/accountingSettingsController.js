const db = require('../config/db');

const DEFAULT_ACCOUNTING_SETTINGS = {
    accounting_method: 'causacion',
    reporting_basis: 'local',
    fiscal_year_start_month: 1,
    allow_manual_entries: true,
    lock_closed_periods: true,
    default_cost_center_required: false,
    cash_account_code: '110505',
    bank_account_code: '111005',
    accounts_receivable_code: '130505',
    accounts_payable_code: '220505',
    revenue_account_code: '413595',
    cost_account_code: '613595',
    expense_account_code: '519595',
    vat_generated_code: '240805',
    vat_deductible_code: '240810',
    withholding_source_code: '236540',
    withholding_ica_code: '236801',
    withholding_vat_code: '236703',
    rounding_account_code: '429581',
    fx_difference_account_code: '530525'
};

const DEFAULT_DOCUMENT_CONFIGS = [
    {
        document_type: 'FACTURA',
        enabled: true,
        prefix: 'FV',
        auto_post: true,
        affects_portfolio: true,
        requires_electronic_support: true,
        debit_account_code: '130505',
        credit_account_code: '413595',
        tax_account_code: '240805',
        counterpart_account_code: '130505',
        notes: 'Factura de venta con cartera'
    },
    {
        document_type: 'NOTA_CREDITO',
        enabled: true,
        prefix: 'NC',
        auto_post: true,
        affects_portfolio: true,
        requires_electronic_support: true,
        debit_account_code: '413595',
        credit_account_code: '130505',
        tax_account_code: '240805',
        counterpart_account_code: '130505',
        notes: 'Disminuye ingresos y cartera'
    },
    {
        document_type: 'NOTA_DEBITO',
        enabled: true,
        prefix: 'ND',
        auto_post: true,
        affects_portfolio: true,
        requires_electronic_support: true,
        debit_account_code: '130505',
        credit_account_code: '413595',
        tax_account_code: '240805',
        counterpart_account_code: '130505',
        notes: 'Incrementa ingresos y cartera'
    },
    {
        document_type: 'RECIBO_PAGO',
        enabled: true,
        prefix: 'RC',
        auto_post: true,
        affects_portfolio: true,
        requires_electronic_support: false,
        debit_account_code: '111005',
        credit_account_code: '130505',
        tax_account_code: null,
        counterpart_account_code: '130505',
        notes: 'Aplica recaudos a cartera'
    },
    {
        document_type: 'COMPROBANTE_EGRESO',
        enabled: true,
        prefix: 'CE',
        auto_post: true,
        affects_portfolio: false,
        requires_electronic_support: false,
        debit_account_code: '220505',
        credit_account_code: '111005',
        tax_account_code: null,
        counterpart_account_code: '111005',
        notes: 'Pagos y salidas de bancos/caja'
    },
    {
        document_type: 'AJUSTE_CONTABLE',
        enabled: true,
        prefix: 'AJ',
        auto_post: true,
        affects_portfolio: false,
        requires_electronic_support: false,
        debit_account_code: null,
        credit_account_code: null,
        tax_account_code: null,
        counterpart_account_code: null,
        notes: 'Ajustes manuales'
    },
    {
        document_type: 'NOMINA',
        enabled: true,
        prefix: 'NOM',
        auto_post: true,
        affects_portfolio: false,
        requires_electronic_support: false,
        debit_account_code: '510506',
        credit_account_code: '250505',
        tax_account_code: null,
        counterpart_account_code: '250505',
        notes: 'Contabilización de nómina'
    }
];

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId || req.body?.tenantId;

const ensureAccountingSettings = async (tenantId) => {
    const result = await db.query(
        `INSERT INTO accounting_settings (
            tenant_id, accounting_method, reporting_basis, fiscal_year_start_month,
            allow_manual_entries, lock_closed_periods, default_cost_center_required,
            cash_account_code, bank_account_code, accounts_receivable_code, accounts_payable_code,
            revenue_account_code, cost_account_code, expense_account_code,
            vat_generated_code, vat_deductible_code, withholding_source_code,
            withholding_ica_code, withholding_vat_code, rounding_account_code, fx_difference_account_code
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        ON CONFLICT (tenant_id) DO NOTHING`,
        [
            tenantId,
            DEFAULT_ACCOUNTING_SETTINGS.accounting_method,
            DEFAULT_ACCOUNTING_SETTINGS.reporting_basis,
            DEFAULT_ACCOUNTING_SETTINGS.fiscal_year_start_month,
            DEFAULT_ACCOUNTING_SETTINGS.allow_manual_entries,
            DEFAULT_ACCOUNTING_SETTINGS.lock_closed_periods,
            DEFAULT_ACCOUNTING_SETTINGS.default_cost_center_required,
            DEFAULT_ACCOUNTING_SETTINGS.cash_account_code,
            DEFAULT_ACCOUNTING_SETTINGS.bank_account_code,
            DEFAULT_ACCOUNTING_SETTINGS.accounts_receivable_code,
            DEFAULT_ACCOUNTING_SETTINGS.accounts_payable_code,
            DEFAULT_ACCOUNTING_SETTINGS.revenue_account_code,
            DEFAULT_ACCOUNTING_SETTINGS.cost_account_code,
            DEFAULT_ACCOUNTING_SETTINGS.expense_account_code,
            DEFAULT_ACCOUNTING_SETTINGS.vat_generated_code,
            DEFAULT_ACCOUNTING_SETTINGS.vat_deductible_code,
            DEFAULT_ACCOUNTING_SETTINGS.withholding_source_code,
            DEFAULT_ACCOUNTING_SETTINGS.withholding_ica_code,
            DEFAULT_ACCOUNTING_SETTINGS.withholding_vat_code,
            DEFAULT_ACCOUNTING_SETTINGS.rounding_account_code,
            DEFAULT_ACCOUNTING_SETTINGS.fx_difference_account_code
        ]
    );

    return result;
};

const ensureDocumentConfigs = async (tenantId) => {
    for (const config of DEFAULT_DOCUMENT_CONFIGS) {
        await db.query(
            `INSERT INTO accounting_document_configs (
                tenant_id, document_type, enabled, prefix, auto_post, affects_portfolio,
                requires_electronic_support, debit_account_code, credit_account_code,
                tax_account_code, counterpart_account_code, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (tenant_id, document_type) DO NOTHING`,
            [
                tenantId,
                config.document_type,
                config.enabled,
                config.prefix,
                config.auto_post,
                config.affects_portfolio,
                config.requires_electronic_support,
                config.debit_account_code,
                config.credit_account_code,
                config.tax_account_code,
                config.counterpart_account_code,
                config.notes
            ]
        );
    }
};

exports.getAccountingSettings = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        await ensureAccountingSettings(tenantId);

        const result = await db.query(
            `SELECT * FROM accounting_settings WHERE tenant_id = $1`,
            [tenantId]
        );

        res.json({ success: true, settings: result.rows[0] || null });
    } catch (error) {
        console.error('[AccountingSettings] Error obteniendo settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateAccountingSettings = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        await ensureAccountingSettings(tenantId);

        const allowedFields = [
            'accounting_method', 'reporting_basis', 'fiscal_year_start_month',
            'allow_manual_entries', 'lock_closed_periods', 'default_cost_center_required',
            'cash_account_code', 'bank_account_code', 'accounts_receivable_code',
            'accounts_payable_code', 'revenue_account_code', 'cost_account_code',
            'expense_account_code', 'vat_generated_code', 'vat_deductible_code',
            'withholding_source_code', 'withholding_ica_code', 'withholding_vat_code',
            'rounding_account_code', 'fx_difference_account_code',
            // Firmantes para PDFs de estados financieros (Ley 43 de 1990)
            'legal_representative_name', 'legal_representative_id_type', 'legal_representative_id_number',
            'accountant_name', 'accountant_card_number', 'accountant_id_number',
            'fiscal_auditor_name', 'fiscal_auditor_card_number', 'fiscal_auditor_id_number',
            'fiscal_auditor_firm_name',
        ];

        const fields = [];
        const values = [];
        let idx = 1;

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                fields.push(`${field} = $${idx++}`);
                values.push(req.body[field]);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
        }

        fields.push(`updated_at = NOW()`);
        values.push(tenantId);

        const result = await db.query(
            `UPDATE accounting_settings
             SET ${fields.join(', ')}
             WHERE tenant_id = $${idx}
             RETURNING *`,
            values
        );

        res.json({ success: true, settings: result.rows[0] });
    } catch (error) {
        console.error('[AccountingSettings] Error actualizando settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Devuelve el bloque que el FE necesita para imprimir el encabezado y firmas de
// los estados financieros (tenant info + 3 firmantes con tarjeta profesional).
exports.getReportHeader = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        await ensureAccountingSettings(tenantId);

        const tenantRes = await db.query(
            `SELECT id, name, tax_id, address, phone, email FROM tenants WHERE id = $1`,
            [tenantId]
        );
        const settingsRes = await db.query(
            `SELECT
                legal_representative_name, legal_representative_id_type, legal_representative_id_number,
                accountant_name, accountant_card_number, accountant_id_number,
                fiscal_auditor_name, fiscal_auditor_card_number, fiscal_auditor_id_number, fiscal_auditor_firm_name
             FROM accounting_settings WHERE tenant_id = $1`,
            [tenantId]
        );

        const tenant = tenantRes.rows[0] || {};
        const s = settingsRes.rows[0] || {};

        const signatures = [];
        if (s.legal_representative_name) {
            signatures.push({
                role: 'Representante Legal',
                name: s.legal_representative_name,
                idLabel: s.legal_representative_id_type || 'C.C.',
                idNumber: s.legal_representative_id_number || '',
            });
        }
        if (s.accountant_name) {
            signatures.push({
                role: 'Contador Público',
                name: s.accountant_name,
                idLabel: 'T.P.',
                idNumber: s.accountant_card_number || '',
                secondary: s.accountant_id_number ? `C.C. ${s.accountant_id_number}` : null,
            });
        }
        if (s.fiscal_auditor_name) {
            signatures.push({
                role: 'Revisor Fiscal',
                name: s.fiscal_auditor_name,
                idLabel: 'T.P.',
                idNumber: s.fiscal_auditor_card_number || '',
                secondary: s.fiscal_auditor_firm_name
                    ? `En representación de ${s.fiscal_auditor_firm_name}`
                    : (s.fiscal_auditor_id_number ? `C.C. ${s.fiscal_auditor_id_number}` : null),
            });
        }

        res.json({
            success: true,
            header: {
                tenantName: tenant.name || '',
                tenantTaxId: tenant.tax_id || '',
                tenantAddress: tenant.address || '',
                tenantPhone: tenant.phone || '',
                tenantEmail: tenant.email || '',
                signatures,
            },
        });
    } catch (error) {
        console.error('[AccountingSettings] Error obteniendo header de reporte:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getDocumentConfigs = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        await ensureDocumentConfigs(tenantId);

        const result = await db.query(
            `SELECT * FROM accounting_document_configs WHERE tenant_id = $1 ORDER BY document_type`,
            [tenantId]
        );

        res.json({ success: true, configs: result.rows });
    } catch (error) {
        console.error('[AccountingSettings] Error obteniendo configs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.upsertDocumentConfig = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const {
            document_type, enabled = true, prefix = null, auto_post = true,
            affects_portfolio = false, requires_electronic_support = false,
            debit_account_code = null, credit_account_code = null,
            tax_account_code = null, counterpart_account_code = null, notes = null
        } = req.body;

        if (!document_type) {
            return res.status(400).json({ success: false, error: 'document_type es obligatorio' });
        }

        const result = await db.query(
            `INSERT INTO accounting_document_configs (
                tenant_id, document_type, enabled, prefix, auto_post, affects_portfolio,
                requires_electronic_support, debit_account_code, credit_account_code,
                tax_account_code, counterpart_account_code, notes
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (tenant_id, document_type) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                prefix = EXCLUDED.prefix,
                auto_post = EXCLUDED.auto_post,
                affects_portfolio = EXCLUDED.affects_portfolio,
                requires_electronic_support = EXCLUDED.requires_electronic_support,
                debit_account_code = EXCLUDED.debit_account_code,
                credit_account_code = EXCLUDED.credit_account_code,
                tax_account_code = EXCLUDED.tax_account_code,
                counterpart_account_code = EXCLUDED.counterpart_account_code,
                notes = EXCLUDED.notes,
                updated_at = NOW()
            RETURNING *`,
            [
                tenantId, document_type, enabled, prefix, auto_post, affects_portfolio,
                requires_electronic_support, debit_account_code, credit_account_code,
                tax_account_code, counterpart_account_code, notes
            ]
        );

        res.json({ success: true, config: result.rows[0] });
    } catch (error) {
        console.error('[AccountingSettings] Error guardando config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getBanks = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const result = await db.query(
            `SELECT * FROM tenant_banks WHERE tenant_id = $1 ORDER BY is_default DESC, name ASC`,
            [tenantId]
        );

        res.json({ success: true, banks: result.rows });
    } catch (error) {
        console.error('[AccountingSettings] Error obteniendo bancos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.upsertBank = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const { id, name, account_type, account_number, account_code, branch, is_default = false, is_active = true } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'El nombre del banco es obligatorio' });

        if (is_default) {
            await db.query(`UPDATE tenant_banks SET is_default = false, updated_at = NOW() WHERE tenant_id = $1`, [tenantId]);
        }

        let result;
        if (id) {
            result = await db.query(
                `UPDATE tenant_banks
                 SET name = $1, account_type = $2, account_number = $3, account_code = $4,
                     branch = $5, is_default = $6, is_active = $7, updated_at = NOW()
                 WHERE id = $8 AND tenant_id = $9
                 RETURNING *`,
                [name, account_type, account_number, account_code, branch, is_default, is_active, id, tenantId]
            );
        } else {
            result = await db.query(
                `INSERT INTO tenant_banks
                    (tenant_id, name, account_type, account_number, account_code, branch, is_default, is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 RETURNING *`,
                [tenantId, name, account_type, account_number, account_code, branch, is_default, is_active]
            );
        }

        res.json({ success: true, bank: result.rows[0] });
    } catch (error) {
        console.error('[AccountingSettings] Error guardando banco:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteBank = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'Id inválido' });

        // Si el banco tiene movimientos no se puede borrar (FK CASCADE borraría la historia).
        const usageRes = await db.query(
            `SELECT COUNT(*)::int AS n FROM bank_transactions WHERE tenant_id = $1 AND bank_id = $2`,
            [tenantId, id]
        );
        if (Number(usageRes.rows[0]?.n || 0) > 0) {
            return res.status(409).json({
                success: false,
                error: 'No se puede eliminar: la cuenta tiene movimientos registrados. Desactívala en su lugar.'
            });
        }

        const result = await db.query(
            `DELETE FROM tenant_banks WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenantId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Cuenta bancaria no encontrada' });
        }
        res.json({ success: true, id });
    } catch (error) {
        console.error('[AccountingSettings] Error eliminando banco:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getCostCenters = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const result = await db.query(
            `SELECT * FROM cost_centers WHERE tenant_id = $1 ORDER BY is_active DESC, code ASC`,
            [tenantId]
        );

        res.json({ success: true, costCenters: result.rows });
    } catch (error) {
        console.error('[AccountingSettings] Error obteniendo centros de costo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.upsertCostCenter = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const { id, code, name, description = null, is_active = true } = req.body;
        if (!code || !name) {
            return res.status(400).json({ success: false, error: 'code y name son obligatorios' });
        }

        let result;
        if (id) {
            result = await db.query(
                `UPDATE cost_centers
                 SET code = $1, name = $2, description = $3, is_active = $4, updated_at = NOW()
                 WHERE id = $5 AND tenant_id = $6
                 RETURNING *`,
                [code, name, description, is_active, id, tenantId]
            );
        } else {
            result = await db.query(
                `INSERT INTO cost_centers (tenant_id, code, name, description, is_active)
                 VALUES ($1,$2,$3,$4,$5)
                 RETURNING *`,
                [tenantId, code, name, description, is_active]
            );
        }

        res.json({ success: true, costCenter: result.rows[0] });
    } catch (error) {
        console.error('[AccountingSettings] Error guardando centro de costo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

