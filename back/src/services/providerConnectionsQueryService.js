const db = require('../config/db');

const getConnections = async (tenantId) => {
    const result = await db.query(
        `SELECT pc.*,
         (SELECT COUNT(*) FROM provider_sync_jobs psj WHERE psj.tenant_id = pc.tenant_id AND psj.provider_name = pc.provider_name) as total_syncs,
         (SELECT MAX(created_at) FROM provider_sync_jobs psj WHERE psj.tenant_id = pc.tenant_id AND psj.provider_name = pc.provider_name) as last_sync_at
         FROM provider_connections pc WHERE pc.tenant_id = $1 ORDER BY pc.created_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const getConnectionById = async (tenantId, id) => {
    const result = await db.query(
        'SELECT * FROM provider_connections WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
    );
    return result.rows[0] || null;
};

const getSyncHistory = async (tenantId, connectionId, limit = 50) => {
    const result = await db.query(
        `SELECT psj.*,
         (SELECT json_agg(json_build_object('id', pse.id, 'event_type', pse.event_type, 'entity_type', pse.local_entity_type, 'message', pse.message, 'created_at', pse.created_at))
          FROM provider_sync_events pse WHERE pse.job_id = psj.id) as events
         FROM provider_sync_jobs psj
         JOIN provider_connections pc ON pc.id = $2
         WHERE pc.tenant_id = $1
           AND psj.tenant_id = pc.tenant_id
           AND psj.provider_name = pc.provider_name
         ORDER BY psj.created_at DESC LIMIT $3`,
        [tenantId, connectionId, limit]
    );
    return result.rows;
};

const getSyncLogs = async (tenantId, limit = 100) => {
    const result = await db.query(
        `SELECT pse.*, pc.id AS connection_id, pc.provider_name
         FROM provider_sync_events pse
         JOIN provider_sync_jobs psj ON psj.id = pse.job_id
         JOIN provider_connections pc ON pc.tenant_id = psj.tenant_id AND pc.provider_name = psj.provider_name
         WHERE pc.tenant_id = $1
         ORDER BY pse.created_at DESC LIMIT $2`,
        [tenantId, limit]
    );
    return result.rows;
};

const getDashboard = async (tenantId) => {
    const connections = await db.query(
        'SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = \'ACTIVE\')::int as active FROM provider_connections WHERE tenant_id = $1',
        [tenantId]
    );
    const recentSyncs = await db.query(
        `SELECT COUNT(*)::int as total FROM provider_sync_jobs psj
         JOIN provider_connections pc ON pc.tenant_id = psj.tenant_id AND pc.provider_name = psj.provider_name
         WHERE pc.tenant_id = $1 AND psj.created_at > NOW() - INTERVAL '7 days'`,
        [tenantId]
    );
    return {
        connections: connections.rows[0] || { total: 0, active: 0 },
        recentSyncs: recentSyncs.rows[0]?.total || 0
    };
};

module.exports = { getConnections, getConnectionById, getSyncHistory, getSyncLogs, getDashboard };
