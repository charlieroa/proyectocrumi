const db = require('../config/db');

const insertAuditEvent = async (executor, event) => {
    const {
        tenantId,
        category = 'general',
        action,
        eventType = 'SUCCESS',
        severity = 'INFO',
        entityType = null,
        entityId = null,
        entityNumber = null,
        documentType = null,
        documentId = null,
        documentNumber = null,
        message = null,
        beforeData = null,
        afterData = null,
        metadata = null,
        context = null,
        createdBy = null,
        userId = null
    } = event || {};

    if (!tenantId || !action) {
        return null;
    }

    const rawCreatedBy = createdBy ?? userId;
    const normalizedCreatedBy =
        rawCreatedBy != null && rawCreatedBy !== '' && Number.isFinite(Number(rawCreatedBy))
            ? Number(rawCreatedBy)
            : null;

    const result = await executor.query(
        `INSERT INTO accounting_audit_events (
            tenant_id, category, action, event_type, severity,
            entity_type, entity_id, entity_number,
            document_type, document_id, document_number,
            message, before_data, after_data, metadata, context,
            created_by, created_at, updated_at
        ) VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,
            $9,$10,$11,
            $12,$13,$14,$15,$16,
            $17,NOW(),NOW()
        )
        RETURNING *`,
        [
            tenantId, category, action, eventType, severity,
            entityType, entityId != null ? String(entityId) : null, entityNumber,
            documentType, documentId != null ? String(documentId) : null, documentNumber,
            message, beforeData, afterData, metadata, context,
            normalizedCreatedBy
        ]
    );

    return result.rows[0];
};

const logAccountingAudit = async (client, event) => {
    const executor = client || db;
    try {
        return await insertAuditEvent(executor, event);
    } catch (error) {
        console.error('[AccountingAudit] Error registrando evento:', error.message);
        return null;
    }
};

const recordAccountingAuditEvent = async (event) => {
    const executor = event?.client || db;
    try {
        return await insertAuditEvent(executor, event);
    } catch (error) {
        console.error('[AccountingAudit] Error registrando evento:', error.message);
        return null;
    }
};

const listAccountingAuditEvents = async (filters = {}) => {
    const {
        tenantId,
        category = null,
        action = null,
        eventType = null,
        entityType = null,
        documentType = null,
        search = null,
        startDate = null,
        endDate = null,
        page = 1,
        limit = 50
    } = filters;

    if (!tenantId) {
        return { rows: [], total: 0 };
    }

    const where = ['tenant_id = $1'];
    const params = [tenantId];

    if (category) {
        params.push(category);
        where.push(`category = $${params.length}`);
    }
    if (action) {
        params.push(action);
        where.push(`action = $${params.length}`);
    }
    if (eventType) {
        params.push(eventType);
        where.push(`event_type = $${params.length}`);
    }
    if (entityType) {
        params.push(entityType);
        where.push(`entity_type = $${params.length}`);
    }
    if (documentType) {
        params.push(documentType);
        where.push(`document_type = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        where.push(`(
            message ILIKE $${params.length} OR
            entity_number ILIKE $${params.length} OR
            document_number ILIKE $${params.length}
        )`);
    }
    if (startDate) {
        params.push(startDate);
        where.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        where.push(`created_at <= $${params.length}`);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = where.join(' AND ');

    const [countResult, result] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS total FROM accounting_audit_events WHERE ${whereClause}`, params),
        db.query(
            `SELECT
                ae.*,
                COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Sistema') AS created_by_name,
                u.email AS created_by_email
             FROM accounting_audit_events ae
             LEFT JOIN users u ON u.id = ae.created_by
             WHERE ${whereClause.replace(/tenant_id/g, 'ae.tenant_id').replace(/\bcreated_at\b/g, 'ae.created_at')}
             ORDER BY ae.created_at DESC, ae.id DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, Number(limit), offset]
        )
    ]);

    return {
        rows: result.rows,
        total: countResult.rows[0]?.total || 0
    };
};

module.exports = {
    logAccountingAudit,
    recordAccountingAuditEvent,
    listAccountingAuditEvents
};
