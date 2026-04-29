// src/controllers/complianceController.js
// Controlador del módulo de Cumplimiento

const complianceService = require('../services/complianceService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;
const isSchemaMissingError = (err) => err?.code === '42P01' || err?.code === '42703';

// =============================================
// OBLIGATIONS
// =============================================

const getObligations = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.getObligations(tenantId);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getObligations:', err);
        if (isSchemaMissingError(err)) return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, message: err.message });
    }
};

const createObligation = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.createObligation(tenantId, req.body);
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error createObligation:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// =============================================
// FILINGS
// =============================================

const getFilings = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { status, obligation_id } = req.query;
        const data = await complianceService.getFilings(tenantId, { status, obligation_id });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getFilings:', err);
        if (isSchemaMissingError(err)) return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, message: err.message });
    }
};

const createFiling = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.createFiling(tenantId, req.body);
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error createFiling:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const markFiled = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.markFiled(tenantId, req.params.id, { ...req.body, filed_by: req.user?.id });
        if (!data) return res.status(404).json({ success: false, message: 'Presentacion no encontrada' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error markFiled:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// =============================================
// RISKS
// =============================================

const getRisks = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.getRisks(tenantId);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getRisks:', err);
        if (isSchemaMissingError(err)) return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, message: err.message });
    }
};

const createRisk = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.createRisk(tenantId, req.body);
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error createRisk:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateRisk = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.updateRisk(tenantId, req.params.id, req.body);
        if (!data) return res.status(404).json({ success: false, message: 'Riesgo no encontrado' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updateRisk:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// =============================================
// DASHBOARD
// =============================================

const getDashboard = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await complianceService.getDashboard(tenantId);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getDashboard:', err);
        if (isSchemaMissingError(err)) {
            return res.json({
                success: true,
                data: {
                    obligacionesActivas: 0,
                    presentacionesVencidas: 0,
                    presentacionesProximas: 0,
                    riesgosAltos: 0,
                }
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getObligations,
    createObligation,
    getFilings,
    createFiling,
    markFiled,
    getRisks,
    createRisk,
    updateRisk,
    getDashboard,
};
