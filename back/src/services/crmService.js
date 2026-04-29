// src/services/crmService.js
// Servicio completo del modulo CRM

const db = require('../config/db');

// =============================================
// LEADS
// =============================================

const getLeads = async (tenantId, filters = {}) => {
  const { status, search, stageId, limit = 100, offset = 0 } = filters;
  const conditions = ['l.tenant_id = $1'];
  const params = [tenantId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`l.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (stageId) {
    conditions.push(`l.stage_id = $${paramIndex}`);
    params.push(stageId);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(l.name ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex} OR l.company ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');

  const countResult = await db.query(
    `SELECT COUNT(*) FROM crm_leads l WHERE ${where}`,
    params
  );

  params.push(limit, offset);
  const result = await db.query(
    `SELECT l.*, ps.name AS stage_name, ps.color AS stage_color
     FROM crm_leads l
     LEFT JOIN crm_pipeline_stages ps ON ps.id = l.stage_id
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    leads: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

const getLeadById = async (tenantId, id) => {
  const result = await db.query(
    `SELECT l.*, ps.name AS stage_name, ps.color AS stage_color
     FROM crm_leads l
     LEFT JOIN crm_pipeline_stages ps ON ps.id = l.stage_id
     WHERE l.id = $1 AND l.tenant_id = $2`,
    [id, tenantId]
  );
  return result.rows[0] || null;
};

const createLead = async (tenantId, data, userId) => {
  const {
    name, email, phone, company, source, status,
    stageId, assignedTo, estimatedValue, expectedCloseDate, notes, metadata,
  } = data;

  const result = await db.query(
    `INSERT INTO crm_leads
       (tenant_id, name, email, phone, company, source, status,
        stage_id, assigned_to, estimated_value, expected_close_date, notes, metadata, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      tenantId, name, email || null, phone || null, company || null,
      source || null, status || 'NUEVO', stageId || null,
      assignedTo || null, estimatedValue || 0, expectedCloseDate || null,
      notes || null, metadata ? JSON.stringify(metadata) : '{}', userId,
    ]
  );
  return result.rows[0];
};

const updateLead = async (tenantId, id, data) => {
  const {
    name, email, phone, company, source, status,
    stageId, assignedTo, estimatedValue, expectedCloseDate, notes, metadata,
  } = data;

  const result = await db.query(
    `UPDATE crm_leads SET
       name = COALESCE($3, name),
       email = COALESCE($4, email),
       phone = COALESCE($5, phone),
       company = COALESCE($6, company),
       source = COALESCE($7, source),
       status = COALESCE($8, status),
       stage_id = COALESCE($9, stage_id),
       assigned_to = COALESCE($10, assigned_to),
       estimated_value = COALESCE($11, estimated_value),
       expected_close_date = COALESCE($12, expected_close_date),
       notes = COALESCE($13, notes),
       metadata = COALESCE($14, metadata),
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [
      id, tenantId, name, email, phone, company, source, status,
      stageId, assignedTo, estimatedValue, expectedCloseDate, notes,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
  return result.rows[0] || null;
};

const deleteLead = async (tenantId, id) => {
  const result = await db.query(
    'DELETE FROM crm_leads WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, tenantId]
  );
  return result.rowCount > 0;
};

const updateLeadStage = async (tenantId, id, stageId) => {
  const result = await db.query(
    `UPDATE crm_leads SET stage_id = $3, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, stageId]
  );
  return result.rows[0] || null;
};

const convertLeadToClient = async (tenantId, leadId) => {
  const result = await db.query(
    `UPDATE crm_leads SET status = 'GANADO', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [leadId, tenantId]
  );
  return result.rows[0] || null;
};

// =============================================
// PIPELINE STAGES
// =============================================

const getPipelineStages = async (tenantId) => {
  const result = await db.query(
    `SELECT * FROM crm_pipeline_stages
     WHERE tenant_id = $1
     ORDER BY stage_order ASC, id ASC`,
    [tenantId]
  );
  return result.rows;
};

const createPipelineStage = async (tenantId, data) => {
  const { name, stageOrder, color, isDefault } = data;
  const result = await db.query(
    `INSERT INTO crm_pipeline_stages (tenant_id, name, stage_order, color, is_default)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, name, stageOrder || 0, color || '#6c757d', isDefault || false]
  );
  return result.rows[0];
};

// =============================================
// ACTIVITIES
// =============================================

const getActivities = async (tenantId, leadId) => {
  const conditions = ['a.tenant_id = $1'];
  const params = [tenantId];

  if (leadId) {
    conditions.push('a.lead_id = $2');
    params.push(leadId);
  }

  const where = conditions.join(' AND ');

  const result = await db.query(
    `SELECT a.*, l.name AS lead_name
     FROM crm_activities a
     LEFT JOIN crm_leads l ON l.id = a.lead_id
     WHERE ${where}
     ORDER BY a.scheduled_at DESC NULLS LAST, a.created_at DESC
     LIMIT 200`,
    params
  );
  return result.rows;
};

const createActivity = async (tenantId, data, userId) => {
  const { leadId, activityType, description, scheduledAt, completedAt } = data;
  const result = await db.query(
    `INSERT INTO crm_activities
       (tenant_id, lead_id, activity_type, description, scheduled_at, completed_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [tenantId, leadId || null, activityType, description || null, scheduledAt || null, completedAt || null, userId]
  );
  return result.rows[0];
};

// =============================================
// DASHBOARD METRICS
// =============================================

const getDashboardMetrics = async (tenantId) => {
  const byStatus = await db.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(estimated_value),0) AS total_value
     FROM crm_leads WHERE tenant_id = $1
     GROUP BY status`,
    [tenantId]
  );

  const totalResult = await db.query(
    `SELECT COUNT(*) AS total_leads, COALESCE(SUM(estimated_value),0) AS total_value
     FROM crm_leads WHERE tenant_id = $1`,
    [tenantId]
  );

  const thisMonth = await db.query(
    `SELECT COUNT(*) AS count
     FROM crm_leads
     WHERE tenant_id = $1
       AND created_at >= date_trunc('month', CURRENT_DATE)`,
    [tenantId]
  );

  const wonCount = byStatus.rows.find(r => r.status === 'GANADO');
  const totalCount = parseInt(totalResult.rows[0].total_leads, 10);
  const conversionRate = totalCount > 0
    ? ((parseInt(wonCount?.count || '0', 10) / totalCount) * 100).toFixed(1)
    : '0.0';

  return {
    totalLeads: totalCount,
    totalValue: parseFloat(totalResult.rows[0].total_value),
    newThisMonth: parseInt(thisMonth.rows[0].count, 10),
    wonCount: parseInt(wonCount?.count || '0', 10),
    conversionRate: parseFloat(conversionRate),
    byStatus: byStatus.rows,
  };
};

module.exports = {
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
  getDashboardMetrics,
};
