const crypto = require('crypto');
const db = require('../config/db');

const PROVIDER_NAME = 'alegra';

const buildPayloadHash = (payload) => {
  if (!payload) return null;
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

const upsertProviderConnection = async ({
  tenantId,
  providerName = PROVIDER_NAME,
  status = 'ACTIVE',
  environment = 'sandbox',
  externalCompanyId = null,
  externalCompanyName = null,
  credentials = {},
  settings = {},
  metadata = {},
  connectedBy = null,
  lastError = null,
  markSynced = false,
}) => {
  const result = await db.query(
    `INSERT INTO provider_connections (
      tenant_id, provider_name, status, environment, external_company_id,
      external_company_name, credentials, settings, metadata, connected_by,
      last_error, last_synced_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7::jsonb, $8::jsonb, $9::jsonb, $10,
      $11, CASE WHEN $12 THEN NOW() ELSE NULL END, NOW(), NOW()
    )
    ON CONFLICT (tenant_id, provider_name)
    DO UPDATE SET
      status = EXCLUDED.status,
      environment = EXCLUDED.environment,
      external_company_id = COALESCE(EXCLUDED.external_company_id, provider_connections.external_company_id),
      external_company_name = COALESCE(EXCLUDED.external_company_name, provider_connections.external_company_name),
      credentials = provider_connections.credentials || EXCLUDED.credentials,
      settings = provider_connections.settings || EXCLUDED.settings,
      metadata = provider_connections.metadata || EXCLUDED.metadata,
      connected_by = COALESCE(EXCLUDED.connected_by, provider_connections.connected_by),
      last_error = EXCLUDED.last_error,
      last_synced_at = CASE WHEN $12 THEN NOW() ELSE provider_connections.last_synced_at END,
      updated_at = NOW()
    RETURNING *`,
    [
      tenantId,
      providerName,
      status,
      environment,
      externalCompanyId,
      externalCompanyName,
      JSON.stringify(credentials || {}),
      JSON.stringify(settings || {}),
      JSON.stringify(metadata || {}),
      connectedBy,
      lastError,
      markSynced,
    ]
  );

  return result.rows[0];
};

const getProviderConnection = async (tenantId, providerName = PROVIDER_NAME) => {
  const result = await db.query(
    `SELECT *
     FROM provider_connections
     WHERE tenant_id = $1 AND provider_name = $2
     LIMIT 1`,
    [tenantId, providerName]
  );

  return result.rows[0] || null;
};

const createSyncJob = async ({
  tenantId,
  providerName = PROVIDER_NAME,
  jobType,
  localEntityType = null,
  localEntityId = null,
  priority = 5,
  payload = {},
  requestedBy = null,
}) => {
  const result = await db.query(
    `INSERT INTO provider_sync_jobs (
      tenant_id, provider_name, job_type, local_entity_type, local_entity_id,
      priority, payload, requested_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW(), NOW())
    RETURNING *`,
    [tenantId, providerName, jobType, localEntityType, localEntityId, priority, JSON.stringify(payload || {}), requestedBy]
  );

  return result.rows[0];
};

const updateSyncJob = async (jobId, { status, attemptCount, lastError = null, result = null, started = false, finished = false }) => {
  const values = [jobId, status || null, attemptCount ?? null, lastError, JSON.stringify(result || {})];
  const query = `
    UPDATE provider_sync_jobs
    SET
      status = COALESCE($2, status),
      attempt_count = COALESCE($3, attempt_count),
      last_error = $4,
      result = CASE WHEN $5::jsonb = '{}'::jsonb THEN result ELSE $5::jsonb END,
      started_at = CASE WHEN ${started ? 'TRUE' : 'FALSE'} THEN COALESCE(started_at, NOW()) ELSE started_at END,
      finished_at = CASE WHEN ${finished ? 'TRUE' : 'FALSE'} THEN NOW() ELSE finished_at END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *`;

  const response = await db.query(query, values);
  return response.rows[0] || null;
};

const logSyncEvent = async ({
  tenantId,
  providerName = PROVIDER_NAME,
  jobId = null,
  eventType = 'INFO',
  localEntityType = null,
  localEntityId = null,
  externalId = null,
  message = null,
  requestPayload = null,
  responsePayload = null,
  metadata = {},
  createdBy = null,
}) => {
  const result = await db.query(
    `INSERT INTO provider_sync_events (
      job_id, tenant_id, provider_name, event_type, local_entity_type,
      local_entity_id, external_id, message, request_payload, response_payload,
      metadata, created_by, created_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9::jsonb, $10::jsonb,
      $11::jsonb, $12, NOW()
    ) RETURNING *`,
    [
      jobId,
      tenantId,
      providerName,
      eventType,
      localEntityType,
      localEntityId,
      externalId,
      message,
      JSON.stringify(requestPayload || {}),
      JSON.stringify(responsePayload || {}),
      JSON.stringify(metadata || {}),
      createdBy,
    ]
  );

  return result.rows[0];
};

const upsertDocumentLink = async ({
  tenantId,
  providerName = PROVIDER_NAME,
  localEntityType,
  localEntityId,
  localDocumentNumber = null,
  externalId = null,
  externalNumber = null,
  syncStatus = 'PENDING',
  direction = 'OUTBOUND',
  payload = null,
  lastError = null,
  metadata = {},
  createdBy = null,
}) => {
  const payloadHash = buildPayloadHash(payload);
  const result = await db.query(
    // NOTA: el `$8::text = 'SYNCED'` fuerza el cast explícito. Sin el cast, PG rompe
    // con "inconsistent types deduced for parameter $8" porque $8 se usa tanto como
    // valor de columna VARCHAR como dentro del CASE comparándose con TEXT literal.
    `INSERT INTO provider_document_links (
      tenant_id, provider_name, local_entity_type, local_entity_id, local_document_number,
      external_id, external_number, sync_status, payload_hash, direction,
      last_synced_at, last_error, metadata, created_by, created_at, updated_at
    ) VALUES (
      $1::int, $2::text, $3::text, $4::text, $5::text,
      $6::text, $7::text, $8::text, $9::text, $10::text,
      CASE WHEN $8::text = 'SYNCED' THEN NOW() ELSE NULL END, $11::text, $12::jsonb, $13::int, NOW(), NOW()
    )
    ON CONFLICT (provider_name, local_entity_type, local_entity_id)
    DO UPDATE SET
      local_document_number = COALESCE(EXCLUDED.local_document_number, provider_document_links.local_document_number),
      external_id = COALESCE(EXCLUDED.external_id, provider_document_links.external_id),
      external_number = COALESCE(EXCLUDED.external_number, provider_document_links.external_number),
      sync_status = EXCLUDED.sync_status,
      payload_hash = COALESCE(EXCLUDED.payload_hash, provider_document_links.payload_hash),
      direction = EXCLUDED.direction,
      last_synced_at = CASE WHEN EXCLUDED.sync_status = 'SYNCED' THEN NOW() ELSE provider_document_links.last_synced_at END,
      last_error = EXCLUDED.last_error,
      metadata = provider_document_links.metadata || EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING *`,
    [
      tenantId,
      providerName,
      localEntityType,
      String(localEntityId),
      localDocumentNumber,
      externalId,
      externalNumber,
      syncStatus,
      payloadHash,
      direction,
      lastError,
      JSON.stringify(metadata || {}),
      createdBy,
    ]
  );

  return result.rows[0];
};

const getProviderOverview = async (tenantId, providerName = PROVIDER_NAME) => {
  const [connection, jobs, recentEvents] = await Promise.all([
    getProviderConnection(tenantId, providerName),
    db.query(
      `SELECT status, COUNT(*)::int AS total
       FROM provider_sync_jobs
       WHERE tenant_id = $1 AND provider_name = $2
       GROUP BY status`,
      [tenantId, providerName]
    ),
    db.query(
      `SELECT id, event_type, local_entity_type, local_entity_id, external_id, message, created_at
       FROM provider_sync_events
       WHERE tenant_id = $1 AND provider_name = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [tenantId, providerName]
    ),
  ]);

  return {
    connection,
    jobsByStatus: jobs.rows,
    recentEvents: recentEvents.rows,
  };
};

module.exports = {
  PROVIDER_NAME,
  buildPayloadHash,
  upsertProviderConnection,
  getProviderConnection,
  createSyncJob,
  updateSyncJob,
  logSyncEvent,
  upsertDocumentLink,
  getProviderOverview,
};
