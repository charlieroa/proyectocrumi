// src/controllers/crmController.js
// Controlador del modulo CRM

const crmService = require('../services/crmService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

// =============================================
// DASHBOARD
// =============================================
const getDashboard = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const metrics = await crmService.getDashboardMetrics(tenantId);
    res.json({ success: true, metrics });
  } catch (err) {
    console.error('[CRM] getDashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =============================================
// LEADS
// =============================================
const getLeads = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { status, search, stageId, limit, offset } = req.query;
    const data = await crmService.getLeads(tenantId, { status, search, stageId, limit, offset });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[CRM] getLeads error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getLeadById = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const lead = await crmService.getLeadById(tenantId, req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    res.json({ success: true, lead });
  } catch (err) {
    console.error('[CRM] getLeadById error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createLead = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = req.user?.id;
    const lead = await crmService.createLead(tenantId, req.body, userId);
    res.status(201).json({ success: true, lead });
  } catch (err) {
    console.error('[CRM] createLead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const lead = await crmService.updateLead(tenantId, req.params.id, req.body);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    res.json({ success: true, lead });
  } catch (err) {
    console.error('[CRM] updateLead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const deleted = await crmService.deleteLead(tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    res.json({ success: true, message: 'Lead eliminado' });
  } catch (err) {
    console.error('[CRM] deleteLead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLeadStage = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { stageId } = req.body;
    const lead = await crmService.updateLeadStage(tenantId, req.params.id, stageId);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    res.json({ success: true, lead });
  } catch (err) {
    console.error('[CRM] updateLeadStage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const convertLeadToClient = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const lead = await crmService.convertLeadToClient(tenantId, req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead no encontrado' });
    res.json({ success: true, lead, message: 'Lead convertido a cliente' });
  } catch (err) {
    console.error('[CRM] convertLeadToClient error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =============================================
// PIPELINE STAGES
// =============================================
const getPipelineStages = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const stages = await crmService.getPipelineStages(tenantId);
    res.json({ success: true, stages });
  } catch (err) {
    console.error('[CRM] getPipelineStages error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPipelineStage = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const stage = await crmService.createPipelineStage(tenantId, req.body);
    res.status(201).json({ success: true, stage });
  } catch (err) {
    console.error('[CRM] createPipelineStage error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =============================================
// ACTIVITIES
// =============================================
const getActivities = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { leadId } = req.query;
    const activities = await crmService.getActivities(tenantId, leadId);
    res.json({ success: true, activities });
  } catch (err) {
    console.error('[CRM] getActivities error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const createActivity = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const userId = req.user?.id;
    const activity = await crmService.createActivity(tenantId, req.body, userId);
    res.status(201).json({ success: true, activity });
  } catch (err) {
    console.error('[CRM] createActivity error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getDashboard,
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  updateLeadStage,
  convertLeadToClient,
  getPipelineStages,
  createPipelineStage,
  getActivities,
  createActivity,
};
