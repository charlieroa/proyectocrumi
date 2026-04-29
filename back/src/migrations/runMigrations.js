// src/migrations/runMigrations.js
// Ejecuta migraciones pendientes al iniciar el backend

const db = require('../config/db');
const { createAllTablesSQL } = require('./createAllTables');
const { whatsappTablesSQL } = require('./025_whatsapp_tables');
const { crmTablesSQL } = require('./crmTables');
const { taxManagementSQL } = require('./taxManagement');
const { addFiscalMetadataSQL } = require('./addFiscalMetadata');

// SQL para crear las tablas base que el resto de migraciones necesitan
const createBaseTablesSQL = `
-- =============================================
-- ROLES (lookup table)
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);
INSERT INTO roles (id, name) VALUES
    (1, 'admin'),
    (3, 'stylist'),
    (4, 'contador'),
    (99, 'superadmin')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- TENANTS
-- =============================================
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    tax_rate NUMERIC DEFAULT 0,
    admin_fee_rate NUMERIC,
    working_hours JSONB,
    products_for_staff_enabled BOOLEAN DEFAULT true,
    admin_fee_enabled BOOLEAN DEFAULT false,
    loans_to_staff_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- USERS
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    role_id INTEGER DEFAULT 1,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    phone VARCHAR(50),
    payment_type VARCHAR(20) DEFAULT 'salary',
    base_salary NUMERIC(18,2) DEFAULT 0,
    commission_rate NUMERIC DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    working_hours JSONB,
    last_service_at TIMESTAMPTZ,
    last_turn_at TIMESTAMPTZ,
    google_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SERVICE CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS service_categories (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SERVICES
-- =============================================
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(18,2) DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    category_id INTEGER REFERENCES service_categories(id) ON DELETE SET NULL,
    commission_percent NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CASH SESSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS cash_sessions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    opened_by_user_id INTEGER REFERENCES users(id),
    closed_by_user_id INTEGER REFERENCES users(id),
    initial_amount NUMERIC(18,2) DEFAULT 0,
    final_amount_counted NUMERIC(18,2),
    expected_cash_amount NUMERIC(18,2),
    difference NUMERIC(18,2),
    status VARCHAR(10) DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- =============================================
-- KANBAN COLUMNS
-- =============================================
CREATE TABLE IF NOT EXISTS kanban_columns (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(50) NOT NULL,
    status_key VARCHAR(50) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const migrations = [
    {
        name: 'create_base_tables',
        sql: createBaseTablesSQL
    },
    {
        name: 'add_alegra_columns',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_company_id VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_test_set_id VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_test_set_status VARCHAR(20) DEFAULT 'PENDIENTE';
        `
    },
    {
        name: 'add_needs_electronic_invoice',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS needs_electronic_invoice BOOLEAN DEFAULT NULL;
        `
    },
    {
        name: 'add_accounting_fields',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id_type VARCHAR(10);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_responsibility VARCHAR(255);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'COP';
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS decimal_precision INT DEFAULT 2;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS decimal_separator VARCHAR(1) DEFAULT ',';
            CREATE INDEX IF NOT EXISTS idx_tenants_tax_id ON tenants(tax_id);
        `
    },
    {
        name: 'add_owner_user_id',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON tenants(owner_user_id);
        `
    },
    {
        name: 'add_alegra_resolution_columns',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_number VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_prefix VARCHAR(20);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_start INT;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_end INT;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_invoicing_enabled BOOLEAN DEFAULT FALSE;
        `
    },
    {
        name: 'add_alegra_resolution_manual_columns',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_valid_from DATE;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_valid_until DATE;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_technical_key VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alegra_resolution_date DATE;
        `
    },
    {
        name: 'create_all_tables',
        sql: createAllTablesSQL
    },
    {
        name: 'create_accounting_master_tables',
        sql: `
            CREATE TABLE IF NOT EXISTS accounting_settings (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
                accounting_method VARCHAR(20) DEFAULT 'causacion',
                reporting_basis VARCHAR(30) DEFAULT 'local',
                fiscal_year_start_month INT DEFAULT 1,
                allow_manual_entries BOOLEAN DEFAULT true,
                lock_closed_periods BOOLEAN DEFAULT true,
                default_cost_center_required BOOLEAN DEFAULT false,
                cash_account_code VARCHAR(20),
                bank_account_code VARCHAR(20),
                accounts_receivable_code VARCHAR(20),
                accounts_payable_code VARCHAR(20),
                revenue_account_code VARCHAR(20),
                cost_account_code VARCHAR(20),
                expense_account_code VARCHAR(20),
                vat_generated_code VARCHAR(20),
                vat_deductible_code VARCHAR(20),
                withholding_source_code VARCHAR(20),
                withholding_ica_code VARCHAR(20),
                withholding_vat_code VARCHAR(20),
                rounding_account_code VARCHAR(20),
                fx_difference_account_code VARCHAR(20),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS accounting_document_configs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                document_type VARCHAR(50) NOT NULL,
                enabled BOOLEAN DEFAULT true,
                prefix VARCHAR(20),
                auto_post BOOLEAN DEFAULT true,
                affects_portfolio BOOLEAN DEFAULT false,
                requires_electronic_support BOOLEAN DEFAULT false,
                debit_account_code VARCHAR(20),
                credit_account_code VARCHAR(20),
                tax_account_code VARCHAR(20),
                counterpart_account_code VARCHAR(20),
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(tenant_id, document_type)
            );

            CREATE TABLE IF NOT EXISTS tenant_banks (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                account_type VARCHAR(30) DEFAULT 'corriente',
                account_number VARCHAR(60),
                account_code VARCHAR(20),
                branch VARCHAR(120),
                is_default BOOLEAN DEFAULT false,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_tenant_banks_tenant_id ON tenant_banks(tenant_id);

            CREATE TABLE IF NOT EXISTS cost_centers (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                code VARCHAR(30) NOT NULL,
                name VARCHAR(120) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(tenant_id, code)
            );
            CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant_id ON cost_centers(tenant_id);

            CREATE TABLE IF NOT EXISTS accounting_periods (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                period_year INT NOT NULL,
                period_month INT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
                closed_at TIMESTAMPTZ,
                closed_by INTEGER REFERENCES users(id),
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, period_year, period_month)
            );
            CREATE INDEX IF NOT EXISTS idx_accounting_periods_tenant_period ON accounting_periods(tenant_id, period_year, period_month);
        `
    },
    {
        name: 'create_accounts_receivable_tables',
        sql: `
            CREATE TABLE IF NOT EXISTS accounts_receivable (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
                document_type VARCHAR(50) NOT NULL DEFAULT 'FACTURA',
                document_id VARCHAR(50),
                document_number VARCHAR(50) NOT NULL,
                client_name VARCHAR(255),
                client_document_type VARCHAR(10),
                client_document_number VARCHAR(50),
                issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
                due_date DATE,
                original_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                balance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
                currency VARCHAR(10) DEFAULT 'COP',
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, document_type, document_number)
            );
            CREATE INDEX IF NOT EXISTS idx_accounts_receivable_tenant_status ON accounts_receivable(tenant_id, status);
            CREATE INDEX IF NOT EXISTS idx_accounts_receivable_invoice_id ON accounts_receivable(invoice_id);

            CREATE TABLE IF NOT EXISTS accounts_receivable_applications (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                accounts_receivable_id INTEGER NOT NULL REFERENCES accounts_receivable(id) ON DELETE CASCADE,
                source_type VARCHAR(50) NOT NULL,
                source_id INTEGER,
                source_number VARCHAR(50),
                application_date DATE NOT NULL DEFAULT CURRENT_DATE,
                amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ar_applications_ar_id ON accounts_receivable_applications(accounts_receivable_id);
        `
    },
    {
        name: 'create_accounts_payable_and_manual_vouchers_tables',
        sql: `
            CREATE TABLE IF NOT EXISTS accounts_payable (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                supplier_name VARCHAR(255) NOT NULL,
                supplier_document_type VARCHAR(10),
                supplier_document_number VARCHAR(50),
                document_type VARCHAR(50) NOT NULL DEFAULT 'FACTURA_PROVEEDOR',
                document_number VARCHAR(50) NOT NULL,
                issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
                due_date DATE,
                original_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                balance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
                expense_account_code VARCHAR(20),
                expense_account_name VARCHAR(255),
                payable_account_code VARCHAR(20),
                currency VARCHAR(10) DEFAULT 'COP',
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, document_type, document_number)
            );
            CREATE INDEX IF NOT EXISTS idx_accounts_payable_tenant_status ON accounts_payable(tenant_id, status);

            CREATE TABLE IF NOT EXISTS accounts_payable_applications (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                accounts_payable_id INTEGER NOT NULL REFERENCES accounts_payable(id) ON DELETE CASCADE,
                source_type VARCHAR(50) NOT NULL,
                source_id INTEGER,
                source_number VARCHAR(50),
                application_date DATE NOT NULL DEFAULT CURRENT_DATE,
                amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ap_applications_ap_id ON accounts_payable_applications(accounts_payable_id);

            CREATE TABLE IF NOT EXISTS manual_vouchers (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                voucher_number VARCHAR(50) NOT NULL,
                voucher_type VARCHAR(50) NOT NULL DEFAULT 'AJUSTE_CONTABLE',
                voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
                description TEXT NOT NULL,
                total_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
                total_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
                journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, voucher_number)
            );

            CREATE TABLE IF NOT EXISTS manual_voucher_lines (
                id SERIAL PRIMARY KEY,
                voucher_id INTEGER NOT NULL REFERENCES manual_vouchers(id) ON DELETE CASCADE,
                account_code VARCHAR(20) NOT NULL,
                account_name VARCHAR(255),
                line_description TEXT,
                debit NUMERIC(18,2) NOT NULL DEFAULT 0,
                credit NUMERIC(18,2) NOT NULL DEFAULT 0,
                third_party_name VARCHAR(255),
                third_party_document VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_manual_voucher_lines_voucher_id ON manual_voucher_lines(voucher_id);
        `
    },
    {
        name: 'create_third_parties_table',
        sql: `
            CREATE TABLE IF NOT EXISTS third_parties (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                kind VARCHAR(20) NOT NULL DEFAULT 'OTHER',
                source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
                source_id INTEGER,
                document_type VARCHAR(20),
                document_number VARCHAR(50),
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                address TEXT,
                city VARCHAR(100),
                department VARCHAR(100),
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, source_type, source_id),
                UNIQUE (tenant_id, kind, document_number)
            );
            CREATE INDEX IF NOT EXISTS idx_third_parties_tenant_kind ON third_parties(tenant_id, kind);
            CREATE INDEX IF NOT EXISTS idx_third_parties_tenant_name ON third_parties(tenant_id, name);
        `
    },
    {
        name: 'create_accounting_periods_table',
        sql: `
            CREATE TABLE IF NOT EXISTS accounting_periods (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                period_year INT NOT NULL,
                period_month INT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
                closed_at TIMESTAMPTZ,
                closed_by INTEGER REFERENCES users(id),
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, period_year, period_month)
            );
            CREATE INDEX IF NOT EXISTS idx_accounting_periods_tenant_period ON accounting_periods(tenant_id, period_year, period_month);
        `
    },
    {
        name: 'create_bank_reconciliation_tables',
        sql: `
            CREATE TABLE IF NOT EXISTS bank_transactions (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                bank_id INTEGER NOT NULL REFERENCES tenant_banks(id) ON DELETE CASCADE,
                transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
                description TEXT NOT NULL,
                reference VARCHAR(100),
                transaction_type VARCHAR(20) NOT NULL DEFAULT 'ABONO',
                amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                running_balance NUMERIC(18,2),
                source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
                matched_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_bank ON bank_transactions(tenant_id, bank_id, transaction_date DESC);
            CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_status ON bank_transactions(tenant_id, status);

            CREATE TABLE IF NOT EXISTS bank_reconciliations (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                bank_transaction_id INTEGER NOT NULL UNIQUE REFERENCES bank_transactions(id) ON DELETE CASCADE,
                total_matched_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
                notes TEXT,
                reconciled_at TIMESTAMPTZ,
                reconciled_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_tenant_status ON bank_reconciliations(tenant_id, status);

            CREATE TABLE IF NOT EXISTS bank_reconciliation_lines (
                id SERIAL PRIMARY KEY,
                reconciliation_id INTEGER NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
                source_type VARCHAR(50) NOT NULL,
                source_id INTEGER,
                source_number VARCHAR(100),
                journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
                movement_date DATE,
                description TEXT,
                amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_lines_reconciliation_id ON bank_reconciliation_lines(reconciliation_id);
            CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_lines_source ON bank_reconciliation_lines(source_type, source_id);
        `
    },
    {
        name: 'add_payroll_accounting_columns',
        sql: `
            ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS accounting_status VARCHAR(20) DEFAULT 'PENDIENTE';
            ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS accounting_journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL;
            ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS accounting_journal_number VARCHAR(30);
            ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS accounting_posted_at TIMESTAMPTZ;
            ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS accounting_error TEXT;
            CREATE INDEX IF NOT EXISTS idx_payroll_periods_accounting_status ON payroll_periods(tenant_id, accounting_status);
        `
    },
    {
        name: 'create_accounting_audit_tables',
        sql: `
            CREATE TABLE IF NOT EXISTS accounting_audit_events (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                category VARCHAR(50) NOT NULL DEFAULT 'general',
                action VARCHAR(80) NOT NULL,
                event_type VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
                severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
                entity_type VARCHAR(50),
                entity_id VARCHAR(100),
                entity_number VARCHAR(100),
                document_type VARCHAR(50),
                document_id VARCHAR(100),
                document_number VARCHAR(100),
                message TEXT,
                before_data JSONB,
                after_data JSONB,
                metadata JSONB,
                context JSONB,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_accounting_audit_tenant_created_at ON accounting_audit_events(tenant_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_accounting_audit_tenant_action ON accounting_audit_events(tenant_id, action);
            CREATE INDEX IF NOT EXISTS idx_accounting_audit_tenant_entity ON accounting_audit_events(tenant_id, entity_type, entity_id);
        `
    },
    {
        name: 'create_provider_integration_tables',
        sql: `
            CREATE TABLE IF NOT EXISTS provider_connections (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                provider_name VARCHAR(40) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
                external_company_id VARCHAR(120),
                external_company_name VARCHAR(255),
                credentials JSONB DEFAULT '{}'::jsonb,
                settings JSONB DEFAULT '{}'::jsonb,
                metadata JSONB DEFAULT '{}'::jsonb,
                last_synced_at TIMESTAMPTZ,
                last_error TEXT,
                connected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (tenant_id, provider_name)
            );
            CREATE INDEX IF NOT EXISTS idx_provider_connections_tenant_provider ON provider_connections(tenant_id, provider_name);

            CREATE TABLE IF NOT EXISTS provider_third_party_links (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                provider_name VARCHAR(40) NOT NULL,
                third_party_id INTEGER NOT NULL REFERENCES third_parties(id) ON DELETE CASCADE,
                external_id VARCHAR(120) NOT NULL,
                external_number VARCHAR(120),
                sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                payload_hash VARCHAR(128),
                last_synced_at TIMESTAMPTZ,
                last_error TEXT,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (provider_name, third_party_id),
                UNIQUE (provider_name, external_id)
            );
            CREATE INDEX IF NOT EXISTS idx_provider_third_party_links_tenant_provider ON provider_third_party_links(tenant_id, provider_name, sync_status);
            CREATE INDEX IF NOT EXISTS idx_provider_third_party_links_third_party ON provider_third_party_links(third_party_id);

            CREATE TABLE IF NOT EXISTS provider_document_links (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                provider_name VARCHAR(40) NOT NULL,
                local_entity_type VARCHAR(60) NOT NULL,
                local_entity_id VARCHAR(120) NOT NULL,
                local_document_number VARCHAR(120),
                external_id VARCHAR(120),
                external_number VARCHAR(120),
                sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                payload_hash VARCHAR(128),
                direction VARCHAR(20) NOT NULL DEFAULT 'OUTBOUND',
                last_synced_at TIMESTAMPTZ,
                last_error TEXT,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (provider_name, local_entity_type, local_entity_id),
                UNIQUE (provider_name, external_id)
            );
            CREATE INDEX IF NOT EXISTS idx_provider_document_links_tenant_provider ON provider_document_links(tenant_id, provider_name, sync_status);
            CREATE INDEX IF NOT EXISTS idx_provider_document_links_local_entity ON provider_document_links(local_entity_type, local_entity_id);

            CREATE TABLE IF NOT EXISTS provider_sync_jobs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                provider_name VARCHAR(40) NOT NULL,
                job_type VARCHAR(60) NOT NULL,
                local_entity_type VARCHAR(60),
                local_entity_id VARCHAR(120),
                priority SMALLINT NOT NULL DEFAULT 5,
                status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                attempt_count INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 5,
                scheduled_at TIMESTAMPTZ DEFAULT NOW(),
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                last_error TEXT,
                payload JSONB DEFAULT '{}'::jsonb,
                result JSONB DEFAULT '{}'::jsonb,
                requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_provider_sync_jobs_tenant_status ON provider_sync_jobs(tenant_id, provider_name, status, scheduled_at);
            CREATE INDEX IF NOT EXISTS idx_provider_sync_jobs_entity ON provider_sync_jobs(local_entity_type, local_entity_id);

            CREATE TABLE IF NOT EXISTS provider_sync_events (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES provider_sync_jobs(id) ON DELETE SET NULL,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                provider_name VARCHAR(40) NOT NULL,
                event_type VARCHAR(40) NOT NULL DEFAULT 'INFO',
                local_entity_type VARCHAR(60),
                local_entity_id VARCHAR(120),
                external_id VARCHAR(120),
                message TEXT,
                request_payload JSONB,
                response_payload JSONB,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_provider_sync_events_tenant_created_at ON provider_sync_events(tenant_id, provider_name, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_provider_sync_events_job_id ON provider_sync_events(job_id);
        `
    },
    {
        name: 'create_whatsapp_tables',
        sql: whatsappTablesSQL
    },
    {
        name: 'add_aliaddo_columns',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_key VARCHAR(300);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_prefix VARCHAR(20);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_number VARCHAR(100);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_range_start BIGINT;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_range_end BIGINT;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_valid_from DATE;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_resolution_valid_until DATE;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_invoicing_enabled BOOLEAN DEFAULT FALSE;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS aliaddo_test_set_status VARCHAR(20) DEFAULT 'PENDIENTE';
        `
    },
    {
        name: 'extend_accounts_payable_for_taxes_and_withholdings',
        sql: `
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS withholding_source_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS withholding_ica_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS withholding_vat_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS tax_account_code VARCHAR(20);
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS withholding_source_code VARCHAR(20);
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS withholding_ica_code VARCHAR(20);
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS withholding_vat_code VARCHAR(20);
        `
    },
    {
        name: 'create_crm_tables',
        sql: crmTablesSQL
    },
    {
        name: 'create_tax_management_tables',
        sql: taxManagementSQL
    },
    {
        name: 'add_fiscal_metadata',
        sql: addFiscalMetadataSQL
    },
    {
        name: 'add_active_modules_to_tenants',
        sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS active_modules JSONB DEFAULT '["comercial"]';`
    },
    {
        name: 'add_tenant_hierarchy_and_accountant_mode',
        sql: `
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_main_tenant BOOLEAN DEFAULT FALSE;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_accountant_mode BOOLEAN DEFAULT FALSE;
            CREATE INDEX IF NOT EXISTS idx_tenants_parent_tenant_id ON tenants(parent_tenant_id);
            CREATE INDEX IF NOT EXISTS idx_tenants_is_main_tenant ON tenants(is_main_tenant);
        `
    },
    {
        name: 'third_parties_multirole_support',
        sql: `
            ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY[]::TEXT[];
            UPDATE third_parties SET roles = ARRAY[kind] WHERE (roles IS NULL OR array_length(roles,1) IS NULL) AND kind IS NOT NULL;
            -- Consolidar duplicados por documento: mantener el id mas bajo y fusionar roles
            WITH grouped AS (
                SELECT tenant_id, document_number, MIN(id) AS keep_id,
                       ARRAY(SELECT DISTINCT unnest(array_agg(DISTINCT kind))) AS merged_roles
                FROM third_parties
                WHERE document_number IS NOT NULL
                GROUP BY tenant_id, document_number
                HAVING COUNT(*) > 1
            )
            UPDATE third_parties tp
            SET roles = (SELECT ARRAY(SELECT DISTINCT unnest(tp.roles || g.merged_roles)) FROM grouped g WHERE g.keep_id = tp.id)
            FROM grouped g WHERE tp.id = g.keep_id;
            DELETE FROM third_parties tp
            USING (
                SELECT tenant_id, document_number, MIN(id) AS keep_id
                FROM third_parties
                WHERE document_number IS NOT NULL
                GROUP BY tenant_id, document_number
                HAVING COUNT(*) > 1
            ) g
            WHERE tp.tenant_id = g.tenant_id
              AND tp.document_number = g.document_number
              AND tp.id <> g.keep_id;
            ALTER TABLE third_parties DROP CONSTRAINT IF EXISTS third_parties_tenant_id_kind_document_number_key;
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'third_parties_tenant_doc_unique'
                ) THEN
                    ALTER TABLE third_parties ADD CONSTRAINT third_parties_tenant_doc_unique UNIQUE (tenant_id, document_number);
                END IF;
            END $$;
            CREATE INDEX IF NOT EXISTS idx_third_parties_roles ON third_parties USING GIN (roles);
        `
    },
    {
        name: 'add_payment_terms_to_accounts_payable',
        sql: `
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS payment_form VARCHAR(20) DEFAULT 'Contado';
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS credit_term_days INTEGER DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
        `
    },
    {
        name: 'add_internal_number_to_accounts_payable',
        sql: `
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS internal_number VARCHAR(30);
            CREATE INDEX IF NOT EXISTS idx_accounts_payable_tenant_internal ON accounts_payable(tenant_id, internal_number);
        `
    },
    {
        name: 'add_invoice_class_to_invoices',
        sql: `
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_class VARCHAR(20) DEFAULT 'ELECTRONICA';
            UPDATE invoices SET invoice_class = 'ELECTRONICA' WHERE invoice_class IS NULL;
            CREATE INDEX IF NOT EXISTS idx_invoices_tenant_class ON invoices(tenant_id, invoice_class);
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS internal_invoice_prefix VARCHAR(20) DEFAULT 'INT';
        `
    },
    {
        name: 'add_is_electronic_to_accounts_payable',
        sql: `
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS is_electronic BOOLEAN DEFAULT TRUE;
            UPDATE accounts_payable SET is_electronic = TRUE WHERE is_electronic IS NULL;
            CREATE INDEX IF NOT EXISTS idx_accounts_payable_tenant_electronic ON accounts_payable(tenant_id, is_electronic);
        `
    },
    {
        name: 'extend_ap_applications_for_egreso_workflow',
        sql: `
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVO';
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS bank_account_code VARCHAR(20);
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS voided_by INTEGER REFERENCES users(id);
            ALTER TABLE accounts_payable_applications ADD COLUMN IF NOT EXISTS void_reason TEXT;
            UPDATE accounts_payable_applications SET status = 'ACTIVO' WHERE status IS NULL;
            CREATE INDEX IF NOT EXISTS idx_ap_applications_tenant_status ON accounts_payable_applications(tenant_id, status);
            CREATE INDEX IF NOT EXISTS idx_ap_applications_tenant_date ON accounts_payable_applications(tenant_id, application_date DESC);
        `
    },
    {
        name: 'create_accounts_payable_lines_and_header_extras',
        sql: `
            CREATE TABLE IF NOT EXISTS accounts_payable_lines (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                accounts_payable_id INTEGER NOT NULL REFERENCES accounts_payable(id) ON DELETE CASCADE,
                line_no INTEGER NOT NULL DEFAULT 1,
                concept_name VARCHAR(255),
                description TEXT,
                puc_code VARCHAR(20) NOT NULL,
                puc_name VARCHAR(255),
                cost_center VARCHAR(100),
                quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
                unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
                discount_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
                iva_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
                rf_pct NUMERIC(9,4) NOT NULL DEFAULT 0,
                subtotal_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                base_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                iva_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                rf_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
                line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ap_lines_payable_id ON accounts_payable_lines(accounts_payable_id);
            CREATE INDEX IF NOT EXISTS idx_ap_lines_tenant ON accounts_payable_lines(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_ap_lines_puc ON accounts_payable_lines(tenant_id, puc_code);

            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(50);
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(255);
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS purchase_order_number VARCHAR(50);
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS printable_notes TEXT;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS discount_total NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS reteiva_pct NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS reteica_pct NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE accounts_payable ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100);
        `
    },
    {
        name: 'extend_credit_debit_note_items_with_cc_retention_product',
        sql: `
            ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(30);
            ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS retention_rate NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS product_id INTEGER;
            ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS service_id INTEGER;

            ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS cost_center_code VARCHAR(30);
            ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS retention_rate NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS product_id INTEGER;
            ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS service_id INTEGER;

            CREATE INDEX IF NOT EXISTS idx_credit_note_items_product ON credit_note_items(product_id);
            CREATE INDEX IF NOT EXISTS idx_debit_note_items_product ON debit_note_items(product_id);
        `
    },
    {
        name: 'invoices_extra_fields',
        sql: `
            -- Campos contables que llegaban del front pero no se persistían
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_form VARCHAR(20);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_term_days INTEGER;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS seller_id INTEGER;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS impo_consumo NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_source NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_vat_rate NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_vat_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_ica_rate NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_ica_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS advances_total NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xml_filename VARCHAR(255);
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_by INTEGER;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

            -- Retenciones por línea
            ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS retention_rate NUMERIC(9,4) DEFAULT 0;
            ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS retention_amount NUMERIC(18,2) DEFAULT 0;
            ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS reference VARCHAR(100);

            -- Anticipos aplicados a una factura
            CREATE TABLE IF NOT EXISTS invoice_advances (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL,
                invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                amount NUMERIC(18,2) NOT NULL,
                reference VARCHAR(100),
                applied_at TIMESTAMPTZ DEFAULT NOW(),
                created_by INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_invoice_advances_invoice ON invoice_advances(invoice_id);
            CREATE INDEX IF NOT EXISTS idx_invoice_advances_tenant ON invoice_advances(tenant_id);
        `
    }
];

const runMigrations = async () => {
    console.log('[Migrations] Verificando migraciones...');

    for (const migration of migrations) {
        try {
            await db.query(migration.sql);
            console.log(`[Migrations] ${migration.name} aplicada correctamente`);
        } catch (error) {
            // Si el error es que la columna/tabla ya existe, esta bien
            if (error.code === '42701' || error.code === '42P07') {
                console.log(`[Migrations] ${migration.name} ya aplicada`);
            } else {
                console.error(`[Migrations] Error en ${migration.name}:`, error.message);
            }
        }
    }

    console.log('[Migrations] Verificacion completada');
};

module.exports = { runMigrations };
