const db = require('../config/db');
const { seedDefaultRules } = require('../helpers/classifierEngine');

const listClassificationRulesData = async (tenantId) => {
    const result = await db.query(
        `SELECT * FROM classification_rules WHERE tenant_id = $1 ORDER BY priority DESC, created_at DESC`,
        [tenantId]
    );
    return result.rows;
};

const createClassificationRuleEntry = async ({ tenantId, keywords, accountCode, accountName, category, priority }) => {
    const result = await db.query(
        `INSERT INTO classification_rules (tenant_id, keywords, account_code, account_name, category, priority)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, keywords, account_code) DO UPDATE SET
            account_name = EXCLUDED.account_name,
            category = EXCLUDED.category,
            priority = EXCLUDED.priority,
            is_active = true
         RETURNING *`,
        [tenantId, keywords.toLowerCase(), accountCode, accountName, category, priority || 0]
    );
    return result.rows[0];
};

const updateClassificationRuleEntry = async ({ id, tenantId, keywords, accountCode, accountName, category, priority, isActive }) => {
    const result = await db.query(
        `UPDATE classification_rules SET
            keywords = COALESCE($1, keywords),
            account_code = COALESCE($2, account_code),
            account_name = COALESCE($3, account_name),
            category = COALESCE($4, category),
            priority = COALESCE($5, priority),
            is_active = COALESCE($6, is_active)
         WHERE id = $7 AND tenant_id = $8
         RETURNING *`,
        [keywords, accountCode, accountName, category, priority, isActive, id, tenantId]
    );
    return result.rows[0] || null;
};

const deactivateClassificationRuleEntry = async ({ id, tenantId }) => {
    const result = await db.query(
        `UPDATE classification_rules SET is_active = false WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenantId]
    );
    return result.rows[0] || null;
};

const seedClassificationRules = async (tenantId) => {
    const client = await db.getClient();
    try {
        return await seedDefaultRules(client, tenantId);
    } finally {
        client.release();
    }
};

module.exports = {
    listClassificationRulesData,
    createClassificationRuleEntry,
    updateClassificationRuleEntry,
    deactivateClassificationRuleEntry,
    seedClassificationRules
};
