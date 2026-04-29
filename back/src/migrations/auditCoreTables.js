const auditCoreSQL = `
CREATE TABLE IF NOT EXISTS system_audit_events (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'INFO',
    user_id INTEGER,
    user_name VARCHAR(255),
    ip_address VARCHAR(45),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_audit_tenant ON system_audit_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_module ON system_audit_events(tenant_id, module);
CREATE INDEX IF NOT EXISTS idx_system_audit_date ON system_audit_events(created_at);
`;
module.exports = { auditCoreSQL };
