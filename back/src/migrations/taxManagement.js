const taxManagementSQL = `
CREATE TABLE IF NOT EXISTS tax_configurations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tax_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    rate NUMERIC(10,4) DEFAULT 0,
    threshold NUMERIC(15,2) DEFAULT 0,
    effective_from DATE,
    effective_to DATE,
    account_code_debit VARCHAR(20),
    account_code_credit VARCHAR(20),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_calendar_events (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tax_type VARCHAR(50) NOT NULL,
    period_label VARCHAR(100) NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'PENDIENTE',
    filed_at TIMESTAMP,
    filed_by INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_year_closings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    status VARCHAR(30) DEFAULT 'ABIERTO',
    closed_at TIMESTAMP,
    closed_by INTEGER,
    retained_earnings_entry_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, year)
);
`;

module.exports = { taxManagementSQL };
