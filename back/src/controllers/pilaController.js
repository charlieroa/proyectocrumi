// src/controllers/pilaController.js
const { getSubmissions, createSubmission, getSubmissionById } = require('../services/pilaArchiveService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

exports.getSubmissions = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const submissions = await getSubmissions(tenantId);
        res.json(submissions);
    } catch (err) {
        console.error('[PILA] Error getSubmissions:', err.message);
        res.status(500).json({ message: 'Error al obtener submissions PILA' });
    }
};

exports.createSubmission = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const data = { ...req.body, created_by: req.user?.id };
        const submission = await createSubmission(tenantId, data);
        res.status(201).json(submission);
    } catch (err) {
        console.error('[PILA] Error createSubmission:', err.message);
        res.status(500).json({ message: 'Error al crear submission PILA' });
    }
};

exports.getSubmissionById = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'tenant_id requerido' });

        const submission = await getSubmissionById(tenantId, parseInt(req.params.id));
        if (!submission) return res.status(404).json({ message: 'Submission no encontrada' });
        res.json(submission);
    } catch (err) {
        console.error('[PILA] Error getSubmissionById:', err.message);
        res.status(500).json({ message: 'Error al obtener submission PILA' });
    }
};
