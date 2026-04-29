const taxConfigService = require('../services/taxConfigService');
const db = require('../config/db');
const { buildDian2026Calendar } = require('../helpers/dianCalendar2026');

const resolveTenantId = (req) => {
    return req.user?.tenant_id || req.headers['x-tenant-id'] || null;
};

const getTaxConfigurations = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const configs = await taxConfigService.getTaxConfigurations(tenantId);
        res.json({ success: true, configurations: configs });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const createTaxConfiguration = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const config = await taxConfigService.createTaxConfiguration(tenantId, req.body);
        res.json({ success: true, configuration: config });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const updateTaxConfiguration = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const config = await taxConfigService.updateTaxConfiguration(tenantId, req.params.id, req.body);
        if (!config) return res.status(404).json({ success: false, error: 'Configuracion no encontrada' });
        res.json({ success: true, configuration: config });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const deleteTaxConfiguration = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        await taxConfigService.deleteTaxConfiguration(tenantId, req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const getTaxCalendar = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const events = await taxConfigService.getTaxCalendar(tenantId, req.query.year);
        res.json({ success: true, events });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const createTaxCalendarEvent = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const event = await taxConfigService.createTaxCalendarEvent(tenantId, req.body);
        res.json({ success: true, event });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const markCalendarEventFiled = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const userId = req.user?.id || null;
        const event = await taxConfigService.markCalendarEventFiled(tenantId, req.params.id, userId);
        if (!event) return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        res.json({ success: true, event });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const getFiscalYearClosings = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const closings = await taxConfigService.getFiscalYearClosings(tenantId);
        res.json({ success: true, closings });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const closeFiscalYear = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const userId = req.user?.id || null;
        const { year } = req.body;
        if (!year) return res.status(400).json({ success: false, error: 'Año requerido' });
        const result = await taxConfigService.closeFiscalYear(tenantId, year, userId);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const getTaxSummary = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const { startDate, endDate } = req.query;
        const db = require('../config/db');

        const vatGenRes = await db.query(
            `SELECT COALESCE(SUM(tax_amount), 0) as total
             FROM invoices
             WHERE tenant_id = $1
               AND date BETWEEN $2 AND $3
               AND status != 'ANULADA'`,
            [tenantId, startDate || '1900-01-01', endDate || '2100-12-31']
        );
        const vatDedRes = await db.query(
            `SELECT COALESCE(SUM(tax_amount), 0) as total FROM accounts_payable WHERE tenant_id = $1 AND created_at::date BETWEEN $2 AND $3`,
            [tenantId, startDate || '1900-01-01', endDate || '2100-12-31']
        );
        const withRes = await db.query(
            `SELECT COALESCE(SUM(withholding_source_amount), 0) as wsrc, COALESCE(SUM(withholding_ica_amount), 0) as wica, COALESCE(SUM(withholding_vat_amount), 0) as wvat
             FROM accounts_payable WHERE tenant_id = $1 AND created_at::date BETWEEN $2 AND $3`,
            [tenantId, startDate || '1900-01-01', endDate || '2100-12-31']
        );

        const vatGenerated = Number(vatGenRes.rows[0]?.total || 0);
        const vatDeductible = Number(vatDedRes.rows[0]?.total || 0);
        const w = withRes.rows[0] || {};

        res.json({
            success: true,
            summary: {
                vatGenerated,
                vatDeductible,
                vatPayable: vatGenerated - vatDeductible,
                withholdingSource: Number(w.wsrc || 0),
                withholdingIca: Number(w.wica || 0),
                withholdingVat: Number(w.wvat || 0),
                totalWithholdings: Number(w.wsrc || 0) + Number(w.wica || 0) + Number(w.wvat || 0)
            }
        });
    } catch (err) {
        console.error('[TaxManagement] Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

const seedDianCalendar = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        const year = Number(req.query.year) || 2026;
        if (year !== 2026) {
            return res.status(400).json({ success: false, error: `Solo se soporta calendario DIAN 2026 (recibido: ${year})` });
        }

        const tenantRes = await db.query('SELECT tax_id FROM tenants WHERE id = $1', [tenantId]);
        const taxId = tenantRes.rows[0]?.tax_id;
        if (!taxId) {
            return res.status(400).json({ success: false, error: 'El tenant no tiene NIT (tax_id) configurado' });
        }
        const cleaned = String(taxId).replace(/[^0-9]/g, '');
        if (!cleaned) {
            return res.status(400).json({ success: false, error: `NIT invalido: ${taxId}` });
        }
        const lastDigit = Number(cleaned.slice(-1));

        const events = buildDian2026Calendar(lastDigit);

        let inserted = 0;
        let skipped = 0;
        for (const ev of events) {
            const exists = await db.query(
                `SELECT 1 FROM tax_calendar_events
                 WHERE tenant_id = $1 AND period_label = $2 AND tax_type = $3
                 LIMIT 1`,
                [tenantId, ev.period_label, ev.tax_type]
            );
            if (exists.rows.length > 0) {
                skipped++;
                continue;
            }
            await db.query(
                `INSERT INTO tax_calendar_events (tenant_id, tax_type, period_label, due_date, description)
                 VALUES ($1, $2, $3, $4, $5)`,
                [tenantId, ev.tax_type, ev.period_label, ev.due_date, ev.description]
            );
            inserted++;
        }

        res.json({ success: true, year, nit: taxId, lastDigit, total: events.length, inserted, skipped });
    } catch (err) {
        console.error('[TaxManagement] seedDianCalendar error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    getTaxConfigurations, createTaxConfiguration, updateTaxConfiguration, deleteTaxConfiguration,
    getTaxCalendar, createTaxCalendarEvent, markCalendarEventFiled, seedDianCalendar,
    getFiscalYearClosings, closeFiscalYear, getTaxSummary
};
