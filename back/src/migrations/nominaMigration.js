// src/migrations/nominaMigration.js
// Migración para el módulo completo de Nómina Colombiana

const nominaMigrationSQL = `
    -- =============================================
    -- MÓDULO DE NÓMINA - TABLAS PRINCIPALES
    -- =============================================

    -- 1. EMPLEADOS
    CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        -- Datos personales
        document_type VARCHAR(5) NOT NULL DEFAULT 'CC',
        document_number VARCHAR(20) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        department_geo VARCHAR(100),
        birth_date DATE,
        gender VARCHAR(1),
        -- Datos laborales
        hire_date DATE NOT NULL,
        termination_date DATE,
        contract_type VARCHAR(30) NOT NULL DEFAULT 'indefinido',
        position VARCHAR(100),
        department VARCHAR(100),
        cost_center VARCHAR(50),
        base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
        salary_type VARCHAR(20) DEFAULT 'mensual',
        payment_frequency VARCHAR(20) DEFAULT 'mensual',
        works_saturdays BOOLEAN DEFAULT false,
        -- Datos bancarios
        bank_name VARCHAR(100),
        bank_account_type VARCHAR(20),
        bank_account_number VARCHAR(30),
        -- Riesgo ARL
        arl_risk_class INT DEFAULT 1,
        -- Estado
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, document_number)
    );

    -- 2. AFILIACIONES DE SEGURIDAD SOCIAL
    CREATE TABLE IF NOT EXISTS employee_affiliations (
        id SERIAL PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        eps_code VARCHAR(10),
        eps_name VARCHAR(100),
        afp_code VARCHAR(10),
        afp_name VARCHAR(100),
        arl_code VARCHAR(10),
        arl_name VARCHAR(100),
        ccf_code VARCHAR(10),
        ccf_name VARCHAR(100),
        eps_affiliation_number VARCHAR(50),
        afp_affiliation_number VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(employee_id)
    );

    -- 3. CONTRATOS LABORALES
    CREATE TABLE IF NOT EXISTS employee_contracts (
        id SERIAL PRIMARY KEY,
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        contract_type VARCHAR(30) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        base_salary NUMERIC(18,2) NOT NULL,
        position VARCHAR(100),
        department VARCHAR(100),
        notes TEXT,
        document_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'active',
        signed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 4. PERÍODOS DE NÓMINA
    CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        period_type VARCHAR(20) NOT NULL DEFAULT 'mensual',
        year INT NOT NULL,
        month INT NOT NULL,
        period_number INT DEFAULT 1,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_date DATE,
        status VARCHAR(20) DEFAULT 'borrador',
        total_devengado NUMERIC(18,2) DEFAULT 0,
        total_deducido NUMERIC(18,2) DEFAULT 0,
      total_neto NUMERIC(18,2) DEFAULT 0,
      total_costo_empresa NUMERIC(18,2) DEFAULT 0,
      employee_count INT DEFAULT 0,
      dian_status VARCHAR(20),
      accounting_status VARCHAR(20) DEFAULT 'PENDIENTE',
      accounting_journal_entry_id INT REFERENCES journal_entries(id) ON DELETE SET NULL,
      accounting_journal_number VARCHAR(30),
      accounting_posted_at TIMESTAMPTZ,
      accounting_error TEXT,
      notes TEXT,
      created_by UUID,
      approved_by UUID,
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, year, month, period_number, period_type)
    );

    -- 5. LIQUIDACIONES DE NÓMINA (una por empleado por período)
    CREATE TABLE IF NOT EXISTS payroll_liquidations (
        id SERIAL PRIMARY KEY,
        period_id INT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES employees(id),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        -- Datos base
        salary_days INT DEFAULT 30,
        base_salary NUMERIC(18,2) DEFAULT 0,
        worked_days INT DEFAULT 30,
        -- Devengado
        salary_amount NUMERIC(18,2) DEFAULT 0,
        transport_allowance NUMERIC(18,2) DEFAULT 0,
        overtime_day NUMERIC(18,2) DEFAULT 0,
        overtime_night NUMERIC(18,2) DEFAULT 0,
        overtime_holiday_day NUMERIC(18,2) DEFAULT 0,
        overtime_holiday_night NUMERIC(18,2) DEFAULT 0,
        night_surcharge NUMERIC(18,2) DEFAULT 0,
        holiday_surcharge NUMERIC(18,2) DEFAULT 0,
        holiday_night_surcharge NUMERIC(18,2) DEFAULT 0,
        commissions NUMERIC(18,2) DEFAULT 0,
        bonuses NUMERIC(18,2) DEFAULT 0,
        disability_pay NUMERIC(18,2) DEFAULT 0,
        vacation_pay NUMERIC(18,2) DEFAULT 0,
        other_income NUMERIC(18,2) DEFAULT 0,
        total_devengado NUMERIC(18,2) DEFAULT 0,
        -- Deducciones empleado
        health_employee NUMERIC(18,2) DEFAULT 0,
        pension_employee NUMERIC(18,2) DEFAULT 0,
        solidarity_fund NUMERIC(18,2) DEFAULT 0,
        withholding_tax NUMERIC(18,2) DEFAULT 0,
        other_deductions NUMERIC(18,2) DEFAULT 0,
        loan_deductions NUMERIC(18,2) DEFAULT 0,
        total_deductions NUMERIC(18,2) DEFAULT 0,
        -- Neto
        net_pay NUMERIC(18,2) DEFAULT 0,
        -- Aportes empresa
        health_employer NUMERIC(18,2) DEFAULT 0,
        pension_employer NUMERIC(18,2) DEFAULT 0,
        arl_employer NUMERIC(18,2) DEFAULT 0,
        sena_employer NUMERIC(18,2) DEFAULT 0,
        icbf_employer NUMERIC(18,2) DEFAULT 0,
        ccf_employer NUMERIC(18,2) DEFAULT 0,
        total_employer_cost NUMERIC(18,2) DEFAULT 0,
        -- Provisiones
        prima_provision NUMERIC(18,2) DEFAULT 0,
        cesantias_provision NUMERIC(18,2) DEFAULT 0,
        intereses_cesantias_provision NUMERIC(18,2) DEFAULT 0,
        vacaciones_provision NUMERIC(18,2) DEFAULT 0,
        total_provisions NUMERIC(18,2) DEFAULT 0,
        -- IBC (Ingreso Base de Cotización)
        ibc_health NUMERIC(18,2) DEFAULT 0,
        ibc_pension NUMERIC(18,2) DEFAULT 0,
        ibc_arl NUMERIC(18,2) DEFAULT 0,
        ibc_ccf NUMERIC(18,2) DEFAULT 0,
        -- Estado
        status VARCHAR(20) DEFAULT 'borrador',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(period_id, employee_id)
    );

    -- 6. NOVEDADES DE NÓMINA
    CREATE TABLE IF NOT EXISTS payroll_novelties (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        employee_id UUID NOT NULL REFERENCES employees(id),
        period_id INT REFERENCES payroll_periods(id),
        novelty_type VARCHAR(50) NOT NULL,
        quantity NUMERIC(10,2) DEFAULT 0,
        amount NUMERIC(18,2) DEFAULT 0,
        start_date DATE,
        end_date DATE,
        description TEXT,
        eps_name VARCHAR(100),
        diagnosis VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pendiente',
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 7. DOCUMENTOS ELECTRÓNICOS DE NÓMINA (DIAN)
    CREATE TABLE IF NOT EXISTS payroll_electronic_docs (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        period_id INT REFERENCES payroll_periods(id),
        employee_id UUID NOT NULL REFERENCES employees(id),
        liquidation_id INT REFERENCES payroll_liquidations(id),
        document_type VARCHAR(5) DEFAULT '102',
        cune VARCHAR(200),
        consecutive VARCHAR(20),
        xml_content TEXT,
        xml_path VARCHAR(255),
        dian_status VARCHAR(20) DEFAULT 'PENDIENTE',
        dian_response JSONB,
        dian_track_id VARCHAR(100),
        transmitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 8. RECLAMACIONES DE INCAPACIDADES
    CREATE TABLE IF NOT EXISTS disability_claims (
        id SERIAL PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        employee_id UUID NOT NULL REFERENCES employees(id),
        claim_type VARCHAR(20) NOT NULL DEFAULT 'eps',
        entity_name VARCHAR(100),
        diagnosis TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days INT NOT NULL,
        daily_rate NUMERIC(18,2) DEFAULT 0,
        total_amount NUMERIC(18,2) DEFAULT 0,
        amount_claimed NUMERIC(18,2) DEFAULT 0,
        amount_recovered NUMERIC(18,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pendiente',
        filing_date DATE,
        filing_number VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- =============================================
    -- DATOS MAESTROS - ENTIDADES DE SEGURIDAD SOCIAL
    -- =============================================

    CREATE TABLE IF NOT EXISTS social_security_entities (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(10) NOT NULL,
        code VARCHAR(10) NOT NULL,
        name VARCHAR(150) NOT NULL,
        nit VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        UNIQUE(entity_type, code)
    );

    -- Insertar EPS principales de Colombia
    INSERT INTO social_security_entities (entity_type, code, name, nit) VALUES
        ('EPS', 'EPS001', 'SURA EPS', '800088702'),
        ('EPS', 'EPS002', 'NUEVA EPS', '900156264'),
        ('EPS', 'EPS003', 'SANITAS', '800251440'),
        ('EPS', 'EPS005', 'SALUD TOTAL', '800130907'),
        ('EPS', 'EPS008', 'COMPENSAR', '860066942'),
        ('EPS', 'EPS010', 'FAMISANAR', '830003564'),
        ('EPS', 'EPS012', 'COMFENALCO VALLE', '890303093'),
        ('EPS', 'EPS013', 'SALUDVIDA', '900462547'),
        ('EPS', 'EPS016', 'COOSALUD', '900226715'),
        ('EPS', 'EPS017', 'MUTUAL SER', '806008394'),
        ('EPS', 'EPS018', 'ALIANSALUD', '830113831'),
        ('EPS', 'EPS037', 'CAJACOPI', '890100645'),
        ('AFP', 'AFP001', 'PORVENIR', '800144331'),
        ('AFP', 'AFP002', 'PROTECCION', '800138188'),
        ('AFP', 'AFP003', 'COLFONDOS', '800198644'),
        ('AFP', 'AFP004', 'SKANDIA', '800184549'),
        ('AFP', 'AFP005', 'COLPENSIONES', '900336004'),
        ('ARL', 'ARL001', 'SURA ARL', '890903790'),
        ('ARL', 'ARL002', 'POSITIVA', '860011153'),
        ('ARL', 'ARL003', 'COLMENA', '860002183'),
        ('ARL', 'ARL004', 'LIBERTY ARL', '860039988'),
        ('ARL', 'ARL005', 'BOLIVAR ARL', '860002964'),
        ('ARL', 'ARL006', 'ALFA ARL', '860527622'),
        ('CCF', 'CCF001', 'COMPENSAR', '860066942'),
        ('CCF', 'CCF002', 'CAFAM', '860013570'),
        ('CCF', 'CCF003', 'COLSUBSIDIO', '860007336'),
        ('CCF', 'CCF004', 'COMFENALCO', '890903790'),
        ('CCF', 'CCF005', 'COMFAMA', '890900842'),
        ('CCF', 'CCF006', 'COMFANDI', '890300466')
    ON CONFLICT (entity_type, code) DO NOTHING;

    -- =============================================
    -- ÍNDICES DE RENDIMIENTO
    -- =============================================

    CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_employees_document ON employees(tenant_id, document_number);
    CREATE INDEX IF NOT EXISTS idx_employee_affiliations_employee ON employee_affiliations(employee_id);
    CREATE INDEX IF NOT EXISTS idx_employee_contracts_employee ON employee_contracts(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_periods_tenant ON payroll_periods(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_payroll_periods_date ON payroll_periods(tenant_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_payroll_liquidations_period ON payroll_liquidations(period_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_liquidations_employee ON payroll_liquidations(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_novelties_employee ON payroll_novelties(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_novelties_period ON payroll_novelties(period_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_novelties_type ON payroll_novelties(tenant_id, novelty_type);
    CREATE INDEX IF NOT EXISTS idx_payroll_electronic_docs_period ON payroll_electronic_docs(period_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_electronic_docs_status ON payroll_electronic_docs(tenant_id, dian_status);
    CREATE INDEX IF NOT EXISTS idx_disability_claims_employee ON disability_claims(employee_id);
    CREATE INDEX IF NOT EXISTS idx_disability_claims_status ON disability_claims(tenant_id, status);
`;

module.exports = { nominaMigrationSQL };
