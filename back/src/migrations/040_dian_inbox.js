// src/migrations/040_dian_inbox.js
// Bandeja de entrada de documentos DIAN (facturas/notas) recibidos por carga
// manual o correo electrónico. Cada documento se parsea (UBL), se clasifica con
// PUC y se causa de forma idempotente (un CUFE no se causa dos veces por tenant).
// Estado: PENDIENTE -> CAUSADO | REVISION | ERROR | DESCARTADO.

const dianInboxSQL = `
CREATE TABLE IF NOT EXISTS dian_inbox_documents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'UPLOAD',        -- UPLOAD | EMAIL
  direction VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',    -- PURCHASE | SALE | UNKNOWN
  document_kind VARCHAR(20),                            -- INVOICE | CREDIT_NOTE | DEBIT_NOTE | UNKNOWN
  cufe VARCHAR(120),
  document_number VARCHAR(60),
  issue_date DATE,
  supplier_name VARCHAR(255),
  supplier_nit VARCHAR(40),
  total NUMERIC(18,2) DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'COP',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',      -- PENDIENTE | CAUSADO | REVISION | ERROR | DESCARTADO
  min_confidence NUMERIC(4,3),
  parsed JSONB,                                          -- objeto UBL parseado
  proposed_lines JSONB,                                  -- líneas clasificadas con PUC
  raw_xml TEXT,
  journal_entry_id INTEGER,
  accounts_payable_id INTEGER,
  error_message TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotencia: un CUFE no se causa dos veces por tenant (índice único parcial).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dian_inbox_cufe ON dian_inbox_documents (tenant_id, cufe) WHERE cufe IS NOT NULL;

-- Índice de consulta por estado.
CREATE INDEX IF NOT EXISTS idx_dian_inbox_tenant_status ON dian_inbox_documents (tenant_id, status);
`;

module.exports = { dianInboxSQL };
