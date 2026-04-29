// src/migrations/addFiscalMetadata.js
// Adds DIAN-required fiscal metadata columns to existing tables

const addFiscalMetadataSQL = `
-- =============================================
-- 1. third_parties - DIAN identification fields
-- =============================================
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS dv VARCHAR(1);
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS dane_municipality_code VARCHAR(10);
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS dane_department_code VARCHAR(5);
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS fiscal_regime VARCHAR(50);
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS fiscal_responsibilities TEXT[];
ALTER TABLE third_parties ADD COLUMN IF NOT EXISTS economic_activity_code VARCHAR(10);

-- =============================================
-- 2. journal_entry_lines - fiscal metadata per line
-- =============================================
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS third_party_id INTEGER REFERENCES third_parties(id);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS third_party_document VARCHAR(50);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS third_party_name VARCHAR(255);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(30);
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS dian_concept_code VARCHAR(10);

-- =============================================
-- 3. manual_voucher_lines - same fiscal metadata
-- =============================================
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS third_party_id INTEGER REFERENCES third_parties(id);
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS base_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20);
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(30);
ALTER TABLE manual_voucher_lines ADD COLUMN IF NOT EXISTS dian_concept_code VARCHAR(10);

-- =============================================
-- 4. accounts_receivable - tax breakdown
-- =============================================
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS withholding_source_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS withholding_ica_amount NUMERIC(18,2) DEFAULT 0;
ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS withholding_vat_amount NUMERIC(18,2) DEFAULT 0;
`;

module.exports = { addFiscalMetadataSQL };
