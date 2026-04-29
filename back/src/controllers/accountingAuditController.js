const {
    getAuditEventsData,
    getAuditSummaryData
} = require('../services/accountingAuditQueryService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const getAuditEvents = async (req, res) => {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 50);
        const audit = await getAuditEventsData({
            tenantId: resolveTenantId(req),
            category: req.query.category,
            action: req.query.action,
            eventType: req.query.eventType,
            entityType: req.query.entityType,
            documentType: req.query.documentType,
            search: req.query.search,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            page,
            limit
        });

        res.json({
            success: true,
            events: audit.rows || [],
            total: audit.total || 0,
            page,
            totalPages: Math.ceil((audit.total || 0) / limit)
        });
    } catch (error) {
        console.error('[Accounting] Error obteniendo auditoria:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAuditSummary = async (req, res) => {
    try {
        const summary = await getAuditSummaryData({
            tenantId: resolveTenantId(req),
            category: req.query.category,
            action: req.query.action,
            eventType: req.query.eventType,
            entityType: req.query.entityType,
            search: req.query.search,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        });

        res.json({ success: true, ...summary });
    } catch (error) {
        console.error('[Accounting] Error generando resumen de auditoria:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getAuditEvents,
    getAuditSummary
};
