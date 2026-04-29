// src/controllers/contractController.js
// Controlador del módulo de Contratos

const contractService = require('../services/contractService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;
const isSchemaMissingError = (err) => err?.code === '42P01' || err?.code === '42703';

// =============================================
// CONTRACTS
// =============================================

const getContracts = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { status, type, search } = req.query;
        const data = await contractService.getContracts(tenantId, { status, type, search });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getContracts:', err);
        if (isSchemaMissingError(err)) return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, message: err.message });
    }
};

const getContractById = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await contractService.getContractById(tenantId, req.params.id);
        if (!data) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getContractById:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const createContract = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await contractService.createContract(tenantId, { ...req.body, created_by: req.user?.id });
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error createContract:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateContract = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await contractService.updateContract(tenantId, req.params.id, req.body);
        if (!data) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error updateContract:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

const deleteContract = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const deleted = await contractService.deleteContract(tenantId, req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
        res.json({ success: true, message: 'Contrato eliminado' });
    } catch (err) {
        console.error('Error deleteContract:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// =============================================
// AMENDMENTS
// =============================================

const getAmendments = async (req, res) => {
    try {
        const data = await contractService.getAmendments(req.params.id);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getAmendments:', err);
        if (isSchemaMissingError(err)) return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, message: err.message });
    }
};

const createAmendment = async (req, res) => {
    try {
        const data = await contractService.createAmendment(req.params.id, { ...req.body, created_by: req.user?.id });
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error createAmendment:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// =============================================
// ALERTS
// =============================================

const getAlerts = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await contractService.getAlerts(tenantId);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getAlerts:', err);
        if (isSchemaMissingError(err)) return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, message: err.message });
    }
};

const createAlert = async (req, res) => {
    try {
        const data = await contractService.createAlert(req.params.id, req.body);
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('Error createAlert:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// =============================================
// DASHBOARD
// =============================================

const getDashboard = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await contractService.getContractDashboard(tenantId);
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error getDashboard:', err);
        if (isSchemaMissingError(err)) {
            return res.json({
                success: true,
                data: { total: 0, activos: 0, borradores: 0, vencidos: 0, terminados: 0, porVencer: 0 }
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getContracts,
    getContractById,
    createContract,
    updateContract,
    deleteContract,
    getAmendments,
    createAmendment,
    getAlerts,
    createAlert,
    getDashboard,
};
