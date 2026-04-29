const approvalTablesSQL = `
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    steps JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id INTEGER REFERENCES approval_workflows(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    entity_description TEXT,
    status VARCHAR(30) DEFAULT 'PENDIENTE',
    current_step INTEGER DEFAULT 1,
    requested_by INTEGER,
    requested_by_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_steps (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    approver_id INTEGER,
    approver_name VARCHAR(255),
    status VARCHAR(30) DEFAULT 'PENDIENTE',
    decision_at TIMESTAMP,
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
`;
module.exports = { approvalTablesSQL };
