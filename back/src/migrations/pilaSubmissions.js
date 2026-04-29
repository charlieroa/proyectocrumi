const pilaSubmissionsSQL = `
CREATE TABLE IF NOT EXISTS pila_submissions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_id INTEGER,
    period_label VARCHAR(50),
    operator_name VARCHAR(255),
    file_content TEXT,
    status VARCHAR(30) DEFAULT 'GENERADO',
    submitted_at TIMESTAMP,
    response_data JSONB,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
`;
module.exports = { pilaSubmissionsSQL };
