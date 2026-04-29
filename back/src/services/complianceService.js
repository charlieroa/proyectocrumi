// src/services/complianceService.js
// Servicio del módulo de Cumplimiento

const db = require('../config/db');

// =============================================
// OBLIGATIONS
// =============================================

const getObligations = async (tenantId) => {
    const result = await db.query(
        `SELECT * FROM compliance_obligations WHERE tenant_id = $1 ORDER BY name ASC`,
        [tenantId]
    );
    return result.rows;
};

const createObligation = async (tenantId, data) => {
    const result = await db.query(
        `INSERT INTO compliance_obligations (tenant_id, obligation_type, name, description, frequency, due_day, regulatory_reference, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
            tenantId,
            data.obligation_type,
            data.name,
            data.description || null,
            data.frequency,
            data.due_day || null,
            data.regulatory_reference || null,
            data.is_active !== false,
        ]
    );
    return result.rows[0];
};

// =============================================
// FILINGS
// =============================================

const getFilings = async (tenantId, { status, obligation_id } = {}) => {
    let query = `SELECT cf.*, co.name as obligation_name, co.obligation_type
                 FROM compliance_filings cf
                 INNER JOIN compliance_obligations co ON co.id = cf.obligation_id
                 WHERE cf.tenant_id = $1`;
    const params = [tenantId];
    let idx = 2;

    if (status) {
        query += ` AND cf.status = $${idx++}`;
        params.push(status);
    }
    if (obligation_id) {
        query += ` AND cf.obligation_id = $${idx++}`;
        params.push(obligation_id);
    }

    // Auto-detect overdue
    query = `WITH updated AS (
        UPDATE compliance_filings SET status = 'VENCIDO'
        WHERE tenant_id = $1 AND status = 'PENDIENTE' AND due_date < CURRENT_DATE
        RETURNING id
    ) ${query} ORDER BY cf.due_date DESC`;

    const result = await db.query(query, params);
    return result.rows;
};

const createFiling = async (tenantId, data) => {
    const result = await db.query(
        `INSERT INTO compliance_filings (tenant_id, obligation_id, period, due_date, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
            tenantId,
            data.obligation_id,
            data.period || null,
            data.due_date,
            data.status || 'PENDIENTE',
            data.notes || null,
        ]
    );
    return result.rows[0];
};

const markFiled = async (tenantId, id, data) => {
    const result = await db.query(
        `UPDATE compliance_filings SET
            status = 'PRESENTADO',
            filed_date = COALESCE($3, CURRENT_DATE),
            filed_by = $4,
            evidence_url = $5,
            notes = COALESCE($6, notes)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [id, tenantId, data.filed_date || null, data.filed_by || null, data.evidence_url || null, data.notes || null]
    );
    return result.rows[0];
};

// =============================================
// RISKS
// =============================================

const getRisks = async (tenantId) => {
    const result = await db.query(
        `SELECT * FROM compliance_risks WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const createRisk = async (tenantId, data) => {
    const result = await db.query(
        `INSERT INTO compliance_risks (tenant_id, category, description, probability, impact, mitigation, status, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
            tenantId,
            data.category || null,
            data.description,
            data.probability,
            data.impact,
            data.mitigation || null,
            data.status || 'IDENTIFICADO',
            data.assigned_to || null,
        ]
    );
    return result.rows[0];
};

const updateRisk = async (tenantId, id, data) => {
    const result = await db.query(
        `UPDATE compliance_risks SET
            category = COALESCE($3, category),
            description = COALESCE($4, description),
            probability = COALESCE($5, probability),
            impact = COALESCE($6, impact),
            mitigation = COALESCE($7, mitigation),
            status = COALESCE($8, status),
            assigned_to = COALESCE($9, assigned_to)
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [
            id, tenantId,
            data.category || null,
            data.description || null,
            data.probability || null,
            data.impact || null,
            data.mitigation || null,
            data.status || null,
            data.assigned_to || null,
        ]
    );
    return result.rows[0];
};

// =============================================
// DASHBOARD
// =============================================

const getDashboard = async (tenantId) => {
    const [obligations, overdue, upcoming, highRisks] = await Promise.all([
        db.query(
            `SELECT COUNT(*)::int as count FROM compliance_obligations WHERE tenant_id = $1 AND is_active = true`,
            [tenantId]
        ),
        db.query(
            `SELECT COUNT(*)::int as count FROM compliance_filings
             WHERE tenant_id = $1 AND status = 'PENDIENTE' AND due_date < CURRENT_DATE`,
            [tenantId]
        ),
        db.query(
            `SELECT COUNT(*)::int as count FROM compliance_filings
             WHERE tenant_id = $1 AND status = 'PENDIENTE'
             AND due_date >= CURRENT_DATE AND due_date <= (CURRENT_DATE + INTERVAL '30 days')`,
            [tenantId]
        ),
        db.query(
            `SELECT COUNT(*)::int as count FROM compliance_risks
             WHERE tenant_id = $1 AND probability = 'ALTA' AND status != 'MITIGADO'`,
            [tenantId]
        ),
    ]);

    return {
        obligacionesActivas: obligations.rows[0]?.count || 0,
        presentacionesVencidas: overdue.rows[0]?.count || 0,
        presentacionesProximas: upcoming.rows[0]?.count || 0,
        riesgosAltos: highRisks.rows[0]?.count || 0,
    };
};

module.exports = {
    getObligations,
    createObligation,
    getFilings,
    createFiling,
    markFiled,
    getRisks,
    createRisk,
    updateRisk,
    getDashboard,
};
