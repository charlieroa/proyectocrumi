const crmTablesSQL = `
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    stage_order INTEGER DEFAULT 0,
    color VARCHAR(20) DEFAULT '#6c757d',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_leads (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'NUEVO',
    stage_id INTEGER REFERENCES crm_pipeline_stages(id),
    assigned_to INTEGER,
    estimated_value NUMERIC(15,2) DEFAULT 0,
    expected_close_date DATE,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id INTEGER REFERENCES crm_leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
`;

module.exports = { crmTablesSQL };
