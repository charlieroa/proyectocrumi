const {
  ensureAccountingPeriod,
  assertAccountingPeriodOpen,
  listAccountingPeriods,
} = require('../helpers/accountingPeriodHelper');

const getNextJournalEntryNumber = async (client, tenantId) => {
  const result = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '[0-9]+') AS INT)), 0) + 1 AS next_number
     FROM journal_entries
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return `AST-${String(result.rows[0].next_number || 1).padStart(6, '0')}`;
};

const getNextManualVoucherNumber = async (client, tenantId) => {
  const result = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM '[0-9]+') AS INT)), 0) + 1 AS next_number
     FROM manual_vouchers
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return `MC-${String(result.rows[0].next_number || 1).padStart(6, '0')}`;
};

const getDefaultAccountName = (accountCode) => {
  const catalog = {
    '110505': 'CAJA GENERAL',
    '111005': 'BANCOS',
    '130505': 'CLIENTES NACIONALES',
    '220505': 'PROVEEDORES NACIONALES',
    '240805': 'IVA GENERADO',
    '240810': 'IVA DESCONTABLE',
    '236540': 'RETENCION EN LA FUENTE',
    '236801': 'RETEICA POR PAGAR',
    '236703': 'RETENCION DE IVA',
    '413595': 'INGRESOS OPERACIONALES',
    '519595': 'GASTOS OPERACIONALES',
    '613595': 'COSTOS DE VENTA',
  };

  return catalog[accountCode] || `CUENTA ${accountCode}`;
};

const ensureAccountExists = async (client, tenantId, accountCode, accountName) => {
  if (!accountCode) return;
  const code = String(accountCode);

  await client.query(
    `INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, level, is_active)
     VALUES ($1, $2, $3,
        CASE
            WHEN $2::varchar LIKE '1%' THEN 'ACTIVO'
            WHEN $2::varchar LIKE '2%' THEN 'PASIVO'
            WHEN $2::varchar LIKE '3%' THEN 'PATRIMONIO'
            WHEN $2::varchar LIKE '4%' THEN 'INGRESO'
            WHEN $2::varchar LIKE '5%' THEN 'GASTO'
            WHEN $2::varchar LIKE '6%' THEN 'COSTO'
            ELSE 'OTRO'
        END,
        CASE WHEN LENGTH($2::varchar) <= 2 THEN 1 WHEN LENGTH($2::varchar) <= 4 THEN 2 ELSE 3 END,
        true)
     ON CONFLICT (tenant_id, account_code) DO NOTHING`,
    [tenantId, code, accountName || getDefaultAccountName(code)]
  );
};

const insertJournalEntry = async (client, tenantId, { description, documentType, documentId, documentNumber, entryDate, lines, userId }) => {
  await assertAccountingPeriodOpen(client, tenantId, entryDate || new Date());

  const totalDebit = Math.round(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0) * 100) / 100;

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('El asiento no cuadra');
  }

  const entryNumber = await getNextJournalEntryNumber(client, tenantId);
  const entryResult = await client.query(
    `INSERT INTO journal_entries
        (tenant_id, entry_number, entry_date, description, document_type, document_id, document_number, total_debit, total_credit, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVO', $10)
     RETURNING id, entry_number`,
    [tenantId, entryNumber, entryDate || new Date(), description, documentType, String(documentId || ''), documentNumber, totalDebit, totalCredit, userId || null]
  );

  for (const line of lines) {
    await ensureAccountExists(client, tenantId, line.account_code, line.account_name);

    // Build dynamic column list for optional fiscal metadata fields
    const cols = ['journal_entry_id', 'account_code', 'account_name', 'description', 'debit', 'credit'];
    const vals = [
      entryResult.rows[0].id,
      line.account_code,
      line.account_name || getDefaultAccountName(line.account_code),
      line.description || description,
      Number(line.debit || 0),
      Number(line.credit || 0),
    ];

    const optionalFields = [
      'third_party_id', 'third_party_document', 'third_party_name',
      'base_amount', 'tax_type', 'tax_rate', 'tax_amount', 'tax_treatment', 'dian_concept_code'
    ];
    for (const field of optionalFields) {
      if (line[field] != null) {
        cols.push(field);
        vals.push(line[field]);
      }
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO journal_entry_lines (${cols.join(', ')}) VALUES (${placeholders})`,
      vals
    );
  }

  return {
    id: entryResult.rows[0].id,
    entryNumber: entryResult.rows[0].entry_number,
    totalDebit,
    totalCredit,
  };
};

module.exports = {
  ensureAccountingPeriod,
  assertAccountingPeriodOpen,
  listAccountingPeriods,
  getNextJournalEntryNumber,
  getNextManualVoucherNumber,
  getDefaultAccountName,
  ensureAccountExists,
  insertJournalEntry,
};
