const db = require('../config/db');

const listPendingMappingsData = async (tenantId) => {
    const result = await db.query(
        `SELECT * FROM account_mappings
         WHERE tenant_id = $1 AND approved = false
         ORDER BY last_used_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const listAllMappingsData = async (tenantId) => {
    const result = await db.query(
        `SELECT * FROM account_mappings
         WHERE tenant_id = $1
         ORDER BY approved ASC, last_used_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const approveMappingEntry = async ({ id, tenantId, userId }) => {
    const result = await db.query(
        `UPDATE account_mappings SET
            approved = true,
            approved_by = $1,
            approved_at = NOW()
         WHERE id = $2 AND tenant_id = $3
         RETURNING *`,
        [userId, id, tenantId]
    );
    return result.rows[0] || null;
};

const rejectMappingEntry = async ({ id, tenantId, userId, accountCode, accountName }) => {
    const result = await db.query(
        `UPDATE account_mappings SET
            account_code = $1,
            account_name = COALESCE($2, account_name),
            approved = true,
            approved_by = $3,
            approved_at = NOW()
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [accountCode, accountName, userId, id, tenantId]
    );
    return result.rows[0] || null;
};

module.exports = {
    listPendingMappingsData,
    listAllMappingsData,
    approveMappingEntry,
    rejectMappingEntry
};
