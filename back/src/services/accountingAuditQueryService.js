const db = require('../config/db');
const { listAccountingAuditEvents } = require('../helpers/accountingAuditHelper');

const getAuditEventsData = async ({
    tenantId,
    category,
    action,
    eventType,
    entityType,
    documentType,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 50
}) => {
    return listAccountingAuditEvents({
        tenantId,
        category: category || null,
        action: action || null,
        eventType: eventType || null,
        entityType: entityType || null,
        documentType: documentType || null,
        search: search || null,
        startDate: startDate || null,
        endDate: endDate || null,
        page,
        limit
    });
};

const getAuditSummaryData = async ({
    tenantId,
    category,
    action,
    eventType,
    entityType,
    search,
    startDate,
    endDate
}) => {
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

    const whereClause = where.join(' AND ');

    const [byAction, byCategory, bySeverity, byEntity, totals] = await Promise.all([
        db.query(
            `SELECT action, COUNT(*)::int AS total
             FROM accounting_audit_events
             WHERE ${whereClause}
             GROUP BY action
             ORDER BY total DESC, action ASC`,
            params
        ),
        db.query(
            `SELECT category, COUNT(*)::int AS total
             FROM accounting_audit_events
             WHERE ${whereClause}
             GROUP BY category
             ORDER BY total DESC, category ASC`,
            params
        ),
        db.query(
            `SELECT event_type, COUNT(*)::int AS total
             FROM accounting_audit_events
             WHERE ${whereClause}
             GROUP BY event_type
             ORDER BY total DESC, event_type ASC`,
            params
        ),
        db.query(
            `SELECT entity_type, COUNT(*)::int AS total
             FROM accounting_audit_events
             WHERE ${whereClause} AND entity_type IS NOT NULL
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
             WHERE ${whereClause}`,
            params
        )
    ]);

    return {
        totals: totals.rows[0] || {},
        byAction: byAction.rows,
        byCategory: byCategory.rows,
        bySeverity: bySeverity.rows,
        byEntity: byEntity.rows
    };
};

module.exports = {
    getAuditEventsData,
    getAuditSummaryData
};
