// src/migrations/createAllTables.js
// Creates ALL missing tables with correct INTEGER FK types

const createAllTablesSQL = `
-- =============================================
-- DOCUMENT SEQUENCES
-- =============================================
CREATE TABLE IF NOT EXISTS document_sequences (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    prefix VARCHAR(10) DEFAULT '',
    current_number INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, document_type)
);

-- =============================================
-- PRODUCTS & INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    price NUMERIC(18,2) DEFAULT 0,
    cost NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'und',
    is_active BOOLEAN DEFAULT true,
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- APPOINTMENTS (Salon/Services)
-- =============================================
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    client_email VARCHAR(255),
    client_id INTEGER REFERENCES users(id),
    stylist_id INTEGER REFERENCES users(id),
    service_id INTEGER REFERENCES services(id),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    duration INTEGER DEFAULT 60,
    status VARCHAR(30) DEFAULT 'PENDIENTE',
    notes TEXT,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stylist_services (
    id SERIAL PRIMARY KEY,
    stylist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(stylist_id, service_id)
);

-- =============================================
-- INVOICES
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50),
    client_name VARCHAR(255),
    client_id INTEGER,
    client_document_type VARCHAR(10),
    client_document_number VARCHAR(50),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_address TEXT,
    client_city VARCHAR(100),
    client_department VARCHAR(100),
    date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'BORRADOR',
    payment_method VARCHAR(50),
    payment_status VARCHAR(30) DEFAULT 'PENDIENTE',
    cufe VARCHAR(200),
    dian_status VARCHAR(30),
    dian_response JSONB,
    xml_path VARCHAR(255),
    pdf_path VARCHAR(255),
    reference VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit_price NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    subtotal NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'und',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES invoices(id),
    appointment_id INTEGER REFERENCES appointments(id),
    amount NUMERIC(18,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'efectivo',
    payment_date DATE DEFAULT CURRENT_DATE,
    reference VARCHAR(100),
    notes TEXT,
    status VARCHAR(30) DEFAULT 'COMPLETADO',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CASH MOVEMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS cash_movements (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    payment_method VARCHAR(50) DEFAULT 'efectivo',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STAFF LOANS
-- =============================================
CREATE TABLE IF NOT EXISTS staff_loans (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount NUMERIC(18,2) NOT NULL,
    balance NUMERIC(18,2) DEFAULT 0,
    installment_amount NUMERIC(18,2) DEFAULT 0,
    total_installments INTEGER DEFAULT 1,
    paid_installments INTEGER DEFAULT 0,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_loan_installments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES staff_loans(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL,
    installment_number INTEGER DEFAULT 1,
    payment_date DATE,
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STAFF PURCHASES
-- =============================================
CREATE TABLE IF NOT EXISTS staff_purchases (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    notes TEXT,
    deducted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_purchase_items (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL REFERENCES staff_purchases(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TASKS (Kanban)
-- =============================================
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    due_date DATE,
    position INTEGER DEFAULT 0,
    label VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'todo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_assignees (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_checklist_items (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text VARCHAR(500) NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QUOTES
-- =============================================
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quote_number VARCHAR(50),
    client_name VARCHAR(255),
    client_id INTEGER,
    client_document_type VARCHAR(10),
    client_document_number VARCHAR(50),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_address TEXT,
    date DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'BORRADOR',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit_price NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    subtotal NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- REMISSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS remissions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    remission_number VARCHAR(50),
    client_name VARCHAR(255),
    client_id INTEGER,
    client_document_type VARCHAR(10),
    client_document_number VARCHAR(50),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    client_address TEXT,
    date DATE DEFAULT CURRENT_DATE,
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'BORRADOR',
    converted_to_invoice_id INTEGER REFERENCES invoices(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS remission_items (
    id SERIAL PRIMARY KEY,
    remission_id INTEGER NOT NULL REFERENCES remissions(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit_price NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    subtotal NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CREDIT NOTES
-- =============================================
CREATE TABLE IF NOT EXISTS credit_notes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    note_number VARCHAR(50),
    invoice_id INTEGER REFERENCES invoices(id),
    invoice_number VARCHAR(50),
    client_name VARCHAR(255),
    client_document_type VARCHAR(10),
    client_document_number VARCHAR(50),
    client_email VARCHAR(255),
    date DATE DEFAULT CURRENT_DATE,
    correction_concept VARCHAR(10),
    description TEXT,
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'BORRADOR',
    cude VARCHAR(200),
    dian_status VARCHAR(30),
    dian_response JSONB,
    xml_path VARCHAR(255),
    pdf_path VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_note_items (
    id SERIAL PRIMARY KEY,
    credit_note_id INTEGER NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit_price NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    subtotal NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DEBIT NOTES
-- =============================================
CREATE TABLE IF NOT EXISTS debit_notes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    note_number VARCHAR(50),
    invoice_id INTEGER REFERENCES invoices(id),
    invoice_number VARCHAR(50),
    client_name VARCHAR(255),
    client_document_type VARCHAR(10),
    client_document_number VARCHAR(50),
    client_email VARCHAR(255),
    date DATE DEFAULT CURRENT_DATE,
    correction_concept VARCHAR(10),
    description TEXT,
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'BORRADOR',
    cude VARCHAR(200),
    dian_status VARCHAR(30),
    dian_response JSONB,
    xml_path VARCHAR(255),
    pdf_path VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS debit_note_items (
    id SERIAL PRIMARY KEY,
    debit_note_id INTEGER NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(18,4) DEFAULT 1,
    unit_price NUMERIC(18,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    discount NUMERIC(18,2) DEFAULT 0,
    subtotal NUMERIC(18,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAYMENT RECEIPTS
-- =============================================
CREATE TABLE IF NOT EXISTS payment_receipts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50),
    client_name VARCHAR(255),
    client_document_type VARCHAR(10),
    client_document_number VARCHAR(50),
    date DATE DEFAULT CURRENT_DATE,
    total NUMERIC(18,2) DEFAULT 0,
    payment_method VARCHAR(50),
    bank_name VARCHAR(100),
    reference VARCHAR(100),
    notes TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVO',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_receipt_invoices (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES payment_receipts(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    amount NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAYROLLS (Legacy - simple table)
-- =============================================
CREATE TABLE IF NOT EXISTS payrolls (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    period_start DATE,
    period_end DATE,
    base_salary NUMERIC(18,2) DEFAULT 0,
    commissions NUMERIC(18,2) DEFAULT 0,
    deductions NUMERIC(18,2) DEFAULT 0,
    loan_deductions NUMERIC(18,2) DEFAULT 0,
    purchase_deductions NUMERIC(18,2) DEFAULT 0,
    net_pay NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'BORRADOR',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACCOUNTING TABLES (with INTEGER FKs)
-- =============================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    account_code VARCHAR(10) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50),
    parent_code VARCHAR(10),
    level INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, account_code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entry_number VARCHAR(20),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    document_type VARCHAR(50),
    document_id VARCHAR(50),
    document_number VARCHAR(50),
    total_debit NUMERIC(18,2) DEFAULT 0,
    total_credit NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(10) NOT NULL,
    account_name VARCHAR(255),
    description TEXT,
    debit NUMERIC(18,2) DEFAULT 0,
    credit NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_mappings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    concept VARCHAR(255) NOT NULL,
    account_code VARCHAR(10) NOT NULL,
    account_name VARCHAR(255),
    document_type VARCHAR(50),
    approved BOOLEAN DEFAULT false,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    normalized_concept VARCHAR(255),
    match_count INT DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, concept, document_type)
);

CREATE TABLE IF NOT EXISTS classification_rules (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    keywords TEXT NOT NULL,
    account_code VARCHAR(10) NOT NULL,
    account_name VARCHAR(255),
    category VARCHAR(50),
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, keywords, account_code)
);

-- =============================================
-- NOMINA TABLES (with INTEGER FKs)
-- =============================================
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    termination_date DATE,
    contract_type VARCHAR(30) NOT NULL DEFAULT 'indefinido',
    position VARCHAR(100),
    department VARCHAR(100),
    cost_center VARCHAR(50),
    base_salary NUMERIC(18,2) NOT NULL DEFAULT 0,
    salary_type VARCHAR(20) DEFAULT 'mensual',
    payment_frequency VARCHAR(20) DEFAULT 'mensual',
    works_saturdays BOOLEAN DEFAULT false,
    bank_name VARCHAR(100),
    bank_account_type VARCHAR(20),
    bank_account_number VARCHAR(30),
    arl_risk_class INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, document_number)
);

CREATE TABLE IF NOT EXISTS employee_affiliations (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS employee_contracts (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS payroll_periods (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, year, month, period_number, period_type)
);

CREATE TABLE IF NOT EXISTS payroll_liquidations (
    id SERIAL PRIMARY KEY,
    period_id INT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    salary_days INT DEFAULT 30,
    base_salary NUMERIC(18,2) DEFAULT 0,
    worked_days INT DEFAULT 30,
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
    health_employee NUMERIC(18,2) DEFAULT 0,
    pension_employee NUMERIC(18,2) DEFAULT 0,
    solidarity_fund NUMERIC(18,2) DEFAULT 0,
    withholding_tax NUMERIC(18,2) DEFAULT 0,
    other_deductions NUMERIC(18,2) DEFAULT 0,
    loan_deductions NUMERIC(18,2) DEFAULT 0,
    total_deductions NUMERIC(18,2) DEFAULT 0,
    net_pay NUMERIC(18,2) DEFAULT 0,
    health_employer NUMERIC(18,2) DEFAULT 0,
    pension_employer NUMERIC(18,2) DEFAULT 0,
    arl_employer NUMERIC(18,2) DEFAULT 0,
    sena_employer NUMERIC(18,2) DEFAULT 0,
    icbf_employer NUMERIC(18,2) DEFAULT 0,
    ccf_employer NUMERIC(18,2) DEFAULT 0,
    total_employer_cost NUMERIC(18,2) DEFAULT 0,
    prima_provision NUMERIC(18,2) DEFAULT 0,
    cesantias_provision NUMERIC(18,2) DEFAULT 0,
    intereses_cesantias_provision NUMERIC(18,2) DEFAULT 0,
    vacaciones_provision NUMERIC(18,2) DEFAULT 0,
    total_provisions NUMERIC(18,2) DEFAULT 0,
    ibc_health NUMERIC(18,2) DEFAULT 0,
    ibc_pension NUMERIC(18,2) DEFAULT 0,
    ibc_arl NUMERIC(18,2) DEFAULT 0,
    ibc_ccf NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'borrador',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_id, employee_id)
);

CREATE TABLE IF NOT EXISTS payroll_novelties (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
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
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_electronic_docs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_id INT REFERENCES payroll_periods(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
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

CREATE TABLE IF NOT EXISTS disability_claims (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
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

CREATE TABLE IF NOT EXISTS social_security_entities (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(10) NOT NULL,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(150) NOT NULL,
    nit VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(entity_type, code)
);

-- Insert SSE data
INSERT INTO social_security_entities (entity_type, code, name, nit) VALUES
    ('EPS', 'EPS001', 'SURA EPS', '800088702'),
    ('EPS', 'EPS002', 'NUEVA EPS', '900156264'),
    ('EPS', 'EPS003', 'SANITAS', '800251440'),
    ('EPS', 'EPS005', 'SALUD TOTAL', '800130907'),
    ('EPS', 'EPS008', 'COMPENSAR', '860066942'),
    ('EPS', 'EPS010', 'FAMISANAR', '830003564'),
    ('EPS', 'EPS012', 'COMFENALCO VALLE', '890303093'),
    ('EPS', 'EPS016', 'COOSALUD', '900226715'),
    ('EPS', 'EPS017', 'MUTUAL SER', '806008394'),
    ('EPS', 'EPS018', 'ALIANSALUD', '830113831'),
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
    ('CCF', 'CCF001', 'COMPENSAR', '860066942'),
    ('CCF', 'CCF002', 'CAFAM', '860013570'),
    ('CCF', 'CCF003', 'COLSUBSIDIO', '860007336'),
    ('CCF', 'CCF004', 'COMFENALCO', '890903790'),
    ('CCF', 'CCF005', 'COMFAMA', '890900842')
ON CONFLICT (entity_type, code) DO NOTHING;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remissions_tenant ON remissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_tenant ON debit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_tenant ON payroll_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_account_mappings_tenant ON account_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classification_rules_tenant ON classification_rules(tenant_id);
`;

module.exports = { createAllTablesSQL };
