// src/migrations/contractTables.js
// Migración para el módulo de Contratos

const contractTablesSQL = `
    -- =============================================
    -- MÓDULO DE CONTRATOS - TABLAS
    -- =============================================

    CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        contract_type VARCHAR(50) NOT NULL DEFAULT 'LABORAL'
            CHECK (contract_type IN ('LABORAL','COMERCIAL','ARRIENDO','PRESTACION_SERVICIOS')),
        title VARCHAR(255) NOT NULL,
        party_id INT,
        party_name VARCHAR(255),
        start_date DATE,
        end_date DATE,
        value NUMERIC(18,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'COP',
        status VARCHAR(30) DEFAULT 'BORRADOR'
            CHECK (status IN ('BORRADOR','ACTIVO','VENCIDO','TERMINADO')),
        document_url TEXT,
        terms JSONB DEFAULT '{}',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_amendments (
        id SERIAL PRIMARY KEY,
        contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        amendment_type VARCHAR(100),
        description TEXT,
        effective_date DATE,
        created_by INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_alerts (
        id SERIAL PRIMARY KEY,
        contract_id INT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        alert_type VARCHAR(30) NOT NULL
            CHECK (alert_type IN ('VENCIMIENTO','RENOVACION','HITO')),
        alert_date DATE NOT NULL,
        notified BOOLEAN DEFAULT false,
        message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_contract_alerts_date ON contract_alerts(alert_date);
`;

module.exports = contractTablesSQL;
