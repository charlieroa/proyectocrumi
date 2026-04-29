// src/services/pilaArchiveService.js
const db = require('../config/db');

const getSubmissions = async (tenantId) => {
    const result = await db.query(
        `SELECT id, tenant_id, period_id, period_label, operator_name,
                status, submitted_at, response_data, created_by, created_at
         FROM pila_submissions
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const createSubmission = async (tenantId, data) => {
    const { period_id, period_label, operator_name, file_content, status, submitted_at, response_data, created_by } = data;
    const result = await db.query(
        `INSERT INTO pila_submissions
            (tenant_id, period_id, period_label, operator_name, file_content, status, submitted_at, response_data, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [tenantId, period_id, period_label, operator_name, file_content, status || 'GENERADO', submitted_at, response_data ? JSON.stringify(response_data) : null, created_by]
    );
    return result.rows[0];
};

const getSubmissionById = async (tenantId, id) => {
    const result = await db.query(
        `SELECT * FROM pila_submissions WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id]
    );
    return result.rows[0] || null;
};

module.exports = {
    getSubmissions,
    createSubmission,
    getSubmissionById
};
