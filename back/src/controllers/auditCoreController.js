// src/controllers/auditCoreController.js
const { getAuditEvents, getAuditSummary, getEntityTimeline, recordAuditEvent } = require('../services/auditCoreService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;
const isSchemaMissingError = (err) => err?.code === '42P01' || err?.code === '42703';

exports.getEvents = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const filters = {
            module: req.query.module,
            category: req.query.category,
            action: req.query.action,
            severity: req.query.severity,
            search: req.query.search,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50
        };

        const result = await getAuditEvents(tenantId, filters);
        res.json(result);
    } catch (err) {
        console.error('[AuditCore] Error getEvents:', err.message);
        if (isSchemaMissingError(err)) return res.json({ events: [], total: 0, page: 1, limit: parseInt(req.query.limit) || 50, totalPages: 0 });
        res.status(500).json({ message: 'Error al obtener eventos de auditoria' });
    }
};

exports.getSummary = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const summary = await getAuditSummary(tenantId);
        res.json(summary);
    } catch (err) {
        console.error('[AuditCore] Error getSummary:', err.message);
        if (isSchemaMissingError(err)) return res.json({ total: 0, byModule: [], bySeverity: [], byAction: [], recentActivity: [] });
        res.status(500).json({ message: 'Error al obtener resumen de auditoria' });
    }
};

exports.getTimeline = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const { entityType, entityId } = req.params;
        const timeline = await getEntityTimeline(tenantId, entityType, parseInt(entityId));
        res.json(timeline);
    } catch (err) {
        console.error('[AuditCore] Error getTimeline:', err.message);
        if (isSchemaMissingError(err)) return res.json([]);
        res.status(500).json({ message: 'Error al obtener timeline' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const eventData = {
            ...req.body,
            user_id: req.user?.id,
            user_name: req.user?.first_name ? `${req.user.first_name} ${req.user.last_name || ''}`.trim() : undefined,
            ip_address: req.ip
        };

        const event = await recordAuditEvent(tenantId, eventData);
        res.status(201).json(event);
    } catch (err) {
        console.error('[AuditCore] Error createEvent:', err.message);
        res.status(500).json({ message: 'Error al registrar evento de auditoria' });
    }
};
