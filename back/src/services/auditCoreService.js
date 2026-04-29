// src/services/auditCoreService.js
const db = require('../config/db');

const getAuditEvents = async (tenantId, filters = {}) => {
    const { module, category, action, severity, search, startDate, endDate, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;
    const conditions = ['tenant_id = $1'];
    const params = [tenantId];
    let idx = 2;

    if (module) {
        conditions.push(`module = $${idx++}`);
        params.push(module);
    }
    if (category) {
        conditions.push(`category = $${idx++}`);
        params.push(category);
    }
    if (action) {
        conditions.push(`action = $${idx++}`);
        params.push(action);
    }
    if (severity) {
        conditions.push(`severity = $${idx++}`);
        params.push(severity);
    }
    if (search) {
        conditions.push(`(description ILIKE $${idx} OR user_name ILIKE $${idx} OR action ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
    }
    if (startDate) {
        conditions.push(`created_at >= $${idx++}`);
        params.push(startDate);
    }
    if (endDate) {
        conditions.push(`created_at <= $${idx++}`);
        params.push(endDate);
    }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
        `SELECT COUNT(*) as total FROM system_audit_events WHERE ${where}`,
        params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    params.push(limit);
    params.push(offset);
    const result = await db.query(
        `SELECT * FROM system_audit_events WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        params
    );

    return {
        events: result.rows,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    };
};

const getAuditSummary = async (tenantId) => {
    const byModule = await db.query(
        `SELECT module, COUNT(*) as count FROM system_audit_events
         WHERE tenant_id = $1 GROUP BY module ORDER BY count DESC`,
        [tenantId]
    );
    const bySeverity = await db.query(
        `SELECT severity, COUNT(*) as count FROM system_audit_events
         WHERE tenant_id = $1 GROUP BY severity ORDER BY count DESC`,
        [tenantId]
    );
    const byAction = await db.query(
        `SELECT action, COUNT(*) as count FROM system_audit_events
         WHERE tenant_id = $1 GROUP BY action ORDER BY count DESC LIMIT 10`,
        [tenantId]
    );
    const recent = await db.query(
        `SELECT * FROM system_audit_events
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [tenantId]
    );
    const totalResult = await db.query(
        `SELECT COUNT(*) as total FROM system_audit_events WHERE tenant_id = $1`,
        [tenantId]
    );

    return {
        total: parseInt(totalResult.rows[0].total, 10),
        byModule: byModule.rows,
        bySeverity: bySeverity.rows,
        byAction: byAction.rows,
        recentActivity: recent.rows
    };
};

const getEntityTimeline = async (tenantId, entityType, entityId) => {
    const result = await db.query(
        `SELECT * FROM system_audit_events
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
         ORDER BY created_at ASC`,
        [tenantId, entityType, entityId]
    );
    return result.rows;
};

const recordAuditEvent = async (tenantId, eventData) => {
    const { module, category, action, entity_type, entity_id, description, severity, user_id, user_name, ip_address, metadata } = eventData;
    const result = await db.query(
        `INSERT INTO system_audit_events
            (tenant_id, module, category, action, entity_type, entity_id, description, severity, user_id, user_name, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [tenantId, module, category, action, entity_type, entity_id, description, severity || 'INFO', user_id, user_name, ip_address, metadata ? JSON.stringify(metadata) : '{}']
    );
    return result.rows[0];
};

module.exports = {
    getAuditEvents,
    getAuditSummary,
    getEntityTimeline,
    recordAuditEvent
};
