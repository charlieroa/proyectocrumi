// src/migrations/complianceTables.js
// Migración para el módulo de Cumplimiento

const complianceTablesSQL = `
    -- =============================================
    -- MÓDULO DE CUMPLIMIENTO - TABLAS
    -- =============================================

    CREATE TABLE IF NOT EXISTS compliance_obligations (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        obligation_type VARCHAR(50) NOT NULL
            CHECK (obligation_type IN ('DIAN','SUPERSOCIEDADES','SIC','UGPP','MIN_TRABAJO')),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        frequency VARCHAR(30) NOT NULL
            CHECK (frequency IN ('MENSUAL','BIMESTRAL','TRIMESTRAL','ANUAL')),
        due_day INT,
        regulatory_reference TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_filings (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        obligation_id INT NOT NULL REFERENCES compliance_obligations(id) ON DELETE CASCADE,
        period VARCHAR(20),
        due_date DATE NOT NULL,
        filed_date DATE,
        status VARCHAR(30) DEFAULT 'PENDIENTE'
            CHECK (status IN ('PENDIENTE','PRESENTADO','VENCIDO','EXENTO')),
        filed_by INT,
        evidence_url TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_risks (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        category VARCHAR(100),
        description TEXT NOT NULL,
        probability VARCHAR(10) NOT NULL
            CHECK (probability IN ('BAJA','MEDIA','ALTA')),
        impact VARCHAR(10) NOT NULL
            CHECK (impact IN ('BAJO','MEDIO','ALTO')),
        mitigation TEXT,
        status VARCHAR(30) DEFAULT 'IDENTIFICADO'
            CHECK (status IN ('IDENTIFICADO','EN_TRATAMIENTO','MITIGADO')),
        assigned_to INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_obligations_tenant ON compliance_obligations(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_compliance_filings_tenant ON compliance_filings(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_compliance_filings_due ON compliance_filings(due_date, status);
    CREATE INDEX IF NOT EXISTS idx_compliance_risks_tenant ON compliance_risks(tenant_id);
`;

module.exports = complianceTablesSQL;
