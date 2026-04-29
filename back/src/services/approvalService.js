// src/services/approvalService.js
const db = require('../config/db');

const getWorkflows = async (tenantId) => {
    const result = await db.query(
        `SELECT * FROM approval_workflows WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const createWorkflow = async (tenantId, data) => {
    const { entity_type, name, steps } = data;
    const result = await db.query(
        `INSERT INTO approval_workflows (tenant_id, entity_type, name, steps)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [tenantId, entity_type, name, JSON.stringify(steps || [])]
    );
    return result.rows[0];
};

const getRequests = async (tenantId, filters = {}) => {
    const { status, entity_type } = filters;
    const conditions = ['tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (status) {
        conditions.push(`status = $${idx++}`);
        params.push(status);
    }
    if (entity_type) {
        conditions.push(`entity_type = $${idx++}`);
        params.push(entity_type);
    }

    const where = conditions.join(' AND ');
    const result = await db.query(
        `SELECT * FROM approval_requests WHERE ${where} ORDER BY created_at DESC`,
        params
    );
    return result.rows;
};

const getMyPending = async (tenantId, userId) => {
    const result = await db.query(
        `SELECT ar.*, ast.id as step_id, ast.step_order, ast.comments as step_comments
         FROM approval_requests ar
         JOIN approval_steps ast ON ast.request_id = ar.id
         WHERE ar.tenant_id = $1
           AND ar.status = 'PENDIENTE'
           AND ast.step_order = ar.current_step
           AND ast.approver_id = $2
           AND ast.status = 'PENDIENTE'
         ORDER BY ar.created_at DESC`,
        [tenantId, userId]
    );
    return result.rows;
};

const createRequest = async (tenantId, data) => {
    const { workflow_id, entity_type, entity_id, entity_description, requested_by, requested_by_name } = data;
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Get workflow steps
        let steps = [];
        if (workflow_id) {
            const wfResult = await client.query(
                `SELECT steps FROM approval_workflows WHERE id = $1 AND tenant_id = $2`,
                [workflow_id, tenantId]
            );
            if (wfResult.rows.length > 0) {
                steps = wfResult.rows[0].steps || [];
            }
        }

        const reqResult = await client.query(
            `INSERT INTO approval_requests
                (tenant_id, workflow_id, entity_type, entity_id, entity_description, requested_by, requested_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [tenantId, workflow_id, entity_type, entity_id, entity_description, requested_by, requested_by_name]
        );
        const request = reqResult.rows[0];

        // Create approval steps
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            await client.query(
                `INSERT INTO approval_steps (request_id, step_order, approver_id, approver_name)
                 VALUES ($1, $2, $3, $4)`,
                [request.id, i + 1, step.approver_id, step.approver_name]
            );
        }

        await client.query('COMMIT');
        return request;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const approveStep = async (tenantId, requestId, userId, comments) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Get the request
        const reqResult = await client.query(
            `SELECT * FROM approval_requests WHERE id = $1 AND tenant_id = $2 AND status = 'PENDIENTE'`,
            [requestId, tenantId]
        );
        if (reqResult.rows.length === 0) {
            throw new Error('Solicitud no encontrada o ya procesada');
        }
        const request = reqResult.rows[0];

        // Update the current step
        await client.query(
            `UPDATE approval_steps SET status = 'APROBADA', decision_at = NOW(), comments = $1
             WHERE request_id = $2 AND step_order = $3 AND approver_id = $4`,
            [comments, requestId, request.current_step, userId]
        );

        // Check if there are more steps
        const nextStep = await client.query(
            `SELECT * FROM approval_steps WHERE request_id = $1 AND step_order = $2`,
            [requestId, request.current_step + 1]
        );

        if (nextStep.rows.length > 0) {
            // Advance to next step
            await client.query(
                `UPDATE approval_requests SET current_step = current_step + 1, updated_at = NOW()
                 WHERE id = $1`,
                [requestId]
            );
        } else {
            // All steps completed
            await client.query(
                `UPDATE approval_requests SET status = 'APROBADA', updated_at = NOW()
                 WHERE id = $1`,
                [requestId]
            );
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const rejectStep = async (tenantId, requestId, userId, comments) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const reqResult = await client.query(
            `SELECT * FROM approval_requests WHERE id = $1 AND tenant_id = $2 AND status = 'PENDIENTE'`,
            [requestId, tenantId]
        );
        if (reqResult.rows.length === 0) {
            throw new Error('Solicitud no encontrada o ya procesada');
        }
        const request = reqResult.rows[0];

        await client.query(
            `UPDATE approval_steps SET status = 'RECHAZADA', decision_at = NOW(), comments = $1
             WHERE request_id = $2 AND step_order = $3 AND approver_id = $4`,
            [comments, requestId, request.current_step, userId]
        );

        await client.query(
            `UPDATE approval_requests SET status = 'RECHAZADA', updated_at = NOW()
             WHERE id = $1`,
            [requestId]
        );

        await client.query('COMMIT');
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const getRequestHistory = async (tenantId) => {
    const result = await db.query(
        `SELECT ar.*,
            (SELECT json_agg(s ORDER BY s.step_order) FROM approval_steps s WHERE s.request_id = ar.id) as steps
         FROM approval_requests ar
         WHERE ar.tenant_id = $1 AND ar.status IN ('APROBADA', 'RECHAZADA')
         ORDER BY ar.updated_at DESC`,
        [tenantId]
    );
    return result.rows;
};

module.exports = {
    getWorkflows,
    createWorkflow,
    getRequests,
    getMyPending,
    createRequest,
    approveStep,
    rejectStep,
    getRequestHistory
};
