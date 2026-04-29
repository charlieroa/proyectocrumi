const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { insertJournalEntry } = require('../services/accountingCoreService');

let migrationRan = false;
const ensureMigration = async () => {
    if (migrationRan) return;
    try {
        const sqlPath = path.join(__dirname, '..', 'migrations', 'files', 'create_journal_entry_templates.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await db.query(sql);
        migrationRan = true;
        console.log('[journalTemplates] Migration aplicada');
    } catch (err) {
        migrationRan = true;
        if (!/already exists/i.test(err.message || '')) {
            console.warn('[journalTemplates] Migration warn:', err.message);
        }
    }
};
ensureMigration();

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const normalizeLines = (lines) => {
    if (!Array.isArray(lines)) return [];
    return lines
        .map((l) => ({
            account_code: String(l.account_code || '').trim(),
            account_name: String(l.account_name || '').trim(),
            debit: round2(l.debit),
            credit: round2(l.credit),
            description: l.description || l.line_description || '',
            third_party_document: l.third_party_document || '',
            third_party_name: l.third_party_name || '',
        }))
        .filter((l) => l.account_code && (l.debit > 0 || l.credit > 0));
};

const validateBalance = (lines) => {
    if (!Array.isArray(lines) || lines.length < 2) {
        const err = new Error('La plantilla debe tener al menos dos líneas');
        err.statusCode = 400;
        throw err;
    }
    const totalDebit = round2(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
    const totalCredit = round2(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        const err = new Error(`La plantilla no cuadra: débitos=${totalDebit} créditos=${totalCredit}`);
        err.statusCode = 400;
        throw err;
    }
};

const listTemplates = async (req, res) => {
    try {
        await ensureMigration();
        const tenantId = resolveTenantId(req);
        const result = await db.query(
            `SELECT id, name, description, voucher_type, times_used, last_used_at,
                    jsonb_array_length(COALESCE(lines, '[]'::jsonb)) AS lines_count,
                    created_at, updated_at
             FROM journal_entry_templates
             WHERE tenant_id = $1
             ORDER BY (last_used_at IS NULL), last_used_at DESC, name ASC`,
            [tenantId]
        );
        res.json({ success: true, templates: result.rows });
    } catch (error) {
        console.error('[journalTemplates] list error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getTemplate = async (req, res) => {
    try {
        await ensureMigration();
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const result = await db.query(
            `SELECT * FROM journal_entry_templates WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
        }
        res.json({ success: true, template: result.rows[0] });
    } catch (error) {
        console.error('[journalTemplates] get error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createTemplate = async (req, res) => {
    try {
        await ensureMigration();
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const { name, description, voucher_type, lines } = req.body || {};

        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, error: 'El nombre es obligatorio' });
        }

        const normalized = normalizeLines(lines);
        validateBalance(normalized);

        const result = await db.query(
            `INSERT INTO journal_entry_templates
                (tenant_id, name, description, voucher_type, lines, created_by)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)
             RETURNING *`,
            [
                tenantId,
                String(name).trim(),
                description || null,
                voucher_type || 'AJUSTE_CONTABLE',
                JSON.stringify(normalized),
                userId,
            ]
        );

        res.status(201).json({ success: true, template: result.rows[0] });
    } catch (error) {
        const status = error.statusCode || 500;
        console.error('[journalTemplates] create error:', error);
        res.status(status).json({ success: false, error: error.message });
    }
};

const updateTemplate = async (req, res) => {
    try {
        await ensureMigration();
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const { name, description, voucher_type, lines } = req.body || {};

        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, error: 'El nombre es obligatorio' });
        }

        const normalized = normalizeLines(lines);
        validateBalance(normalized);

        const result = await db.query(
            `UPDATE journal_entry_templates
                SET name = $1, description = $2, voucher_type = $3,
                    lines = $4::jsonb, updated_at = NOW()
              WHERE id = $5 AND tenant_id = $6
              RETURNING *`,
            [
                String(name).trim(),
                description || null,
                voucher_type || 'AJUSTE_CONTABLE',
                JSON.stringify(normalized),
                id,
                tenantId,
            ]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
        }

        res.json({ success: true, template: result.rows[0] });
    } catch (error) {
        const status = error.statusCode || 500;
        console.error('[journalTemplates] update error:', error);
        res.status(status).json({ success: false, error: error.message });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        await ensureMigration();
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const result = await db.query(
            `DELETE FROM journal_entry_templates WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenantId]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[journalTemplates] delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const applyTemplate = async (req, res) => {
    const client = await db.getClient();
    try {
        await ensureMigration();
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const { id } = req.params;
        const { date, descriptionOverride, multiplier } = req.body || {};
        const factor = Number(multiplier);
        const mult = Number.isFinite(factor) && factor > 0 ? factor : 1;

        await client.query('BEGIN');

        const tplRes = await client.query(
            `SELECT * FROM journal_entry_templates WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
            [id, tenantId]
        );
        if (!tplRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
        }
        const template = tplRes.rows[0];
        const baseLines = Array.isArray(template.lines) ? template.lines : [];

        const lines = baseLines.map((l) => ({
            account_code: l.account_code,
            account_name: l.account_name,
            description: l.description || '',
            debit: round2(Number(l.debit || 0) * mult),
            credit: round2(Number(l.credit || 0) * mult),
            third_party_document: l.third_party_document || null,
            third_party_name: l.third_party_name || null,
        }));

        validateBalance(lines);

        const description = descriptionOverride && String(descriptionOverride).trim()
            ? String(descriptionOverride).trim()
            : (template.description || template.name);

        const journalEntry = await insertJournalEntry(client, tenantId, {
            description,
            documentType: template.voucher_type || 'AJUSTE_CONTABLE',
            documentId: `tpl-${template.id}-${Date.now()}`,
            documentNumber: `PLT-${template.id}`,
            entryDate: date || new Date(),
            lines,
            userId,
        });

        await client.query(
            `UPDATE journal_entry_templates
                SET times_used = times_used + 1,
                    last_used_at = NOW(),
                    updated_at = NOW()
              WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            journalEntry: { id: journalEntry.id, entryNumber: journalEntry.entryNumber },
        });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
        const status = error.statusCode || 500;
        console.error('[journalTemplates] apply error:', error);
        res.status(status).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
};
