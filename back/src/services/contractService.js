// src/services/contractService.js
// Servicio del módulo de Contratos

const db = require('../config/db');

// =============================================
// CONTRACTS CRUD
// =============================================

const getContracts = async (tenantId, { status, type, search } = {}) => {
    let query = `SELECT * FROM contracts WHERE tenant_id = $1`;
    const params = [tenantId];
    let idx = 2;

    if (status) {
        query += ` AND status = $${idx++}`;
        params.push(status);
    }
    if (type) {
        query += ` AND contract_type = $${idx++}`;
        params.push(type);
    }
    if (search) {
        query += ` AND (title ILIKE $${idx} OR party_name ILIKE $${idx})`;
        params.push(`%${search}%`);
        idx++;
    }

    query += ` ORDER BY created_at DESC`;
    const result = await db.query(query, params);
    return result.rows;
};

const getContractById = async (tenantId, id) => {
    const result = await db.query(
        `SELECT * FROM contracts WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
    );
    return result.rows[0] || null;
};

const createContract = async (tenantId, data) => {
    const result = await db.query(
        `INSERT INTO contracts (tenant_id, contract_type, title, party_id, party_name, start_date, end_date, value, currency, status, document_url, terms, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
            tenantId,
            data.contract_type || 'LABORAL',
            data.title,
            data.party_id || null,
            data.party_name || null,
            data.start_date || null,
            data.end_date || null,
            data.value || 0,
            data.currency || 'COP',
            data.status || 'BORRADOR',
            data.document_url || null,
            JSON.stringify(data.terms || {}),
            data.notes || null,
            data.created_by || null,
        ]
    );
    return result.rows[0];
};

const updateContract = async (tenantId, id, data) => {
    const result = await db.query(
        `UPDATE contracts SET
            contract_type = COALESCE($3, contract_type),
            title = COALESCE($4, title),
            party_id = COALESCE($5, party_id),
            party_name = COALESCE($6, party_name),
            start_date = COALESCE($7, start_date),
            end_date = COALESCE($8, end_date),
            value = COALESCE($9, value),
            currency = COALESCE($10, currency),
            status = COALESCE($11, status),
            document_url = COALESCE($12, document_url),
            terms = COALESCE($13, terms),
            notes = COALESCE($14, notes),
            updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2
         RETURNING *`,
        [
            id,
            tenantId,
            data.contract_type || null,
            data.title || null,
            data.party_id || null,
            data.party_name || null,
            data.start_date || null,
            data.end_date || null,
            data.value != null ? data.value : null,
            data.currency || null,
            data.status || null,
            data.document_url || null,
            data.terms ? JSON.stringify(data.terms) : null,
            data.notes || null,
        ]
    );
    return result.rows[0];
};

const deleteContract = async (tenantId, id) => {
    const result = await db.query(
        `DELETE FROM contracts WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [id, tenantId]
    );
    return result.rowCount > 0;
};

// =============================================
// AMENDMENTS
// =============================================

const getAmendments = async (contractId) => {
    const result = await db.query(
        `SELECT * FROM contract_amendments WHERE contract_id = $1 ORDER BY created_at DESC`,
        [contractId]
    );
    return result.rows;
};

const createAmendment = async (contractId, data) => {
    const result = await db.query(
        `INSERT INTO contract_amendments (contract_id, amendment_type, description, effective_date, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [contractId, data.amendment_type, data.description, data.effective_date || null, data.created_by || null]
    );
    return result.rows[0];
};

// =============================================
// ALERTS
// =============================================

const getAlerts = async (tenantId) => {
    const result = await db.query(
        `SELECT ca.*, c.title as contract_title, c.end_date
         FROM contract_alerts ca
         INNER JOIN contracts c ON c.id = ca.contract_id
         WHERE c.tenant_id = $1 AND ca.alert_date <= (CURRENT_DATE + INTERVAL '30 days')
         ORDER BY ca.alert_date ASC`,
        [tenantId]
    );
    return result.rows;
};

const createAlert = async (contractId, data) => {
    const result = await db.query(
        `INSERT INTO contract_alerts (contract_id, alert_type, alert_date, message)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [contractId, data.alert_type, data.alert_date, data.message || null]
    );
    return result.rows[0];
};

// =============================================
// DASHBOARD
// =============================================

const getContractDashboard = async (tenantId) => {
    const [statusCounts, expiringSoon] = await Promise.all([
        db.query(
            `SELECT status, COUNT(*)::int as count FROM contracts WHERE tenant_id = $1 GROUP BY status`,
            [tenantId]
        ),
        db.query(
            `SELECT COUNT(*)::int as count FROM contracts
             WHERE tenant_id = $1 AND status = 'ACTIVO'
             AND end_date IS NOT NULL AND end_date <= (CURRENT_DATE + INTERVAL '30 days')`,
            [tenantId]
        ),
    ]);

    const byStatus = {};
    statusCounts.rows.forEach(r => { byStatus[r.status] = r.count; });
    const total = statusCounts.rows.reduce((s, r) => s + r.count, 0);

    return {
        total,
        activos: byStatus['ACTIVO'] || 0,
        borradores: byStatus['BORRADOR'] || 0,
        vencidos: byStatus['VENCIDO'] || 0,
        terminados: byStatus['TERMINADO'] || 0,
        porVencer: expiringSoon.rows[0]?.count || 0,
    };
};

module.exports = {
    getContracts,
    getContractById,
    createContract,
    updateContract,
    deleteContract,
    getAmendments,
    createAmendment,
    getAlerts,
    createAlert,
    getContractDashboard,
};
