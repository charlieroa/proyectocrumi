// src/controllers/approvalController.js
const approvalService = require('../services/approvalService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;
const isSchemaMissingError = (err) => err?.code === '42P01' || err?.code === '42703';

exports.getWorkflows = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const workflows = await approvalService.getWorkflows(tenantId);
        res.json(workflows);
    } catch (err) {
        console.error('[Approvals] Error getWorkflows:', err.message);
        if (isSchemaMissingError(err)) return res.json([]);
        res.status(500).json({ message: 'Error al obtener flujos de trabajo' });
    }
};

exports.createWorkflow = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const workflow = await approvalService.createWorkflow(tenantId, req.body);
        res.status(201).json(workflow);
    } catch (err) {
        console.error('[Approvals] Error createWorkflow:', err.message);
        res.status(500).json({ message: 'Error al crear flujo de trabajo' });
    }
};

exports.getRequests = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const filters = {
            status: req.query.status,
            entity_type: req.query.entity_type
        };
        const requests = await approvalService.getRequests(tenantId, filters);
        res.json(requests);
    } catch (err) {
        console.error('[Approvals] Error getRequests:', err.message);
        if (isSchemaMissingError(err)) return res.json([]);
        res.status(500).json({ message: 'Error al obtener solicitudes' });
    }
};

exports.getMyPending = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const userId = req.user?.id;
        if (!userId) return res.status(400).json({ message: 'user_id requerido' });

        const pending = await approvalService.getMyPending(tenantId, userId);
        res.json(pending);
    } catch (err) {
        console.error('[Approvals] Error getMyPending:', err.message);
        if (isSchemaMissingError(err)) return res.json([]);
        res.status(500).json({ message: 'Error al obtener pendientes' });
    }
};

exports.createRequest = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const data = {
            ...req.body,
            requested_by: req.user?.id,
            requested_by_name: req.user?.first_name ? `${req.user.first_name} ${req.user.last_name || ''}`.trim() : req.body.requested_by_name
        };

        const request = await approvalService.createRequest(tenantId, data);
        res.status(201).json(request);
    } catch (err) {
        console.error('[Approvals] Error createRequest:', err.message);
        res.status(500).json({ message: 'Error al crear solicitud' });
    }
};

exports.approve = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const userId = req.user?.id;
        const { id } = req.params;
        const { comments } = req.body;

        const result = await approvalService.approveStep(tenantId, parseInt(id), userId, comments);
        res.json(result);
    } catch (err) {
        console.error('[Approvals] Error approve:', err.message);
        res.status(500).json({ message: err.message || 'Error al aprobar' });
    }
};

exports.reject = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const userId = req.user?.id;
        const { id } = req.params;
        const { comments } = req.body;

        const result = await approvalService.rejectStep(tenantId, parseInt(id), userId, comments);
        res.json(result);
    } catch (err) {
        console.error('[Approvals] Error reject:', err.message);
        res.status(500).json({ message: err.message || 'Error al rechazar' });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const history = await approvalService.getRequestHistory(tenantId);
        res.json(history);
    } catch (err) {
        console.error('[Approvals] Error getHistory:', err.message);
        if (isSchemaMissingError(err)) return res.json([]);
        res.status(500).json({ message: 'Error al obtener historial' });
    }
};
