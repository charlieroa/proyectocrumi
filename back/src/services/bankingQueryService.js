const db = require('../config/db');

const getBanksData = async (tenantId) => {
    const result = await db.query(
        `SELECT id, name, account_code, created_at
         FROM tenant_banks
         WHERE tenant_id = $1
         ORDER BY name ASC`,
        [tenantId]
    );
    return { banks: result.rows };
};

const getBankTransactionsData = async (tenantId, filters = {}) => {
    const { bankId, status = 'TODAS', search = '', startDate, endDate } = filters;

    const where = ['bt.tenant_id = $1'];
    const params = [tenantId];

    if (bankId) {
        params.push(bankId);
        where.push(`bt.bank_id = $${params.length}`);
    }
    if (status && status !== 'TODAS') {
        params.push(status);
        where.push(`bt.status = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        where.push(`(bt.description ILIKE $${params.length} OR COALESCE(bt.reference, '') ILIKE $${params.length} OR tb.name ILIKE $${params.length})`);
    }
    if (startDate) {
        params.push(startDate);
        where.push(`bt.transaction_date >= $${params.length}`);
    }
    if (endDate) {
        params.push(endDate);
        where.push(`bt.transaction_date <= $${params.length}`);
    }

    const result = await db.query(
        `SELECT
            bt.*,
            bt.bank_id AS bank_account_id,
            tb.name AS bank_name,
            tb.name AS bank_account_name,
            tb.account_code,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', brl.id,
                        'source_type', brl.source_type,
                        'source_id', brl.source_id,
                        'source_number', brl.source_number,
                        'journal_entry_id', brl.journal_entry_id,
                        'movement_date', brl.movement_date,
                        'description', brl.description,
                        'amount', brl.amount
                    )
                    ORDER BY brl.id
                ) FILTER (WHERE brl.id IS NOT NULL),
                '[]'::json
            ) AS reconciliation_lines
         FROM bank_transactions bt
         INNER JOIN tenant_banks tb ON tb.id = bt.bank_id
         LEFT JOIN bank_reconciliations br ON br.bank_transaction_id = bt.id
         LEFT JOIN bank_reconciliation_lines brl ON brl.reconciliation_id = br.id
         WHERE ${where.join(' AND ')}
         GROUP BY bt.id, tb.name, tb.account_code
         ORDER BY bt.transaction_date DESC, bt.id DESC`,
        params
    );

    const summary = result.rows.reduce((acc, row) => {
        const amount = Number(row.amount || 0);
        const matched = Number(row.matched_amount || 0);
        acc.total += amount;
        acc.totalMatched += matched;
        acc.totalPending += Math.max(amount - matched, 0);
        acc.byStatus[row.status] = (acc.byStatus[row.status] || 0) + 1;
        return acc;
    }, { total: 0, totalMatched: 0, totalPending: 0, byStatus: {} });

    return { transactions: result.rows, summary };
};

const getBankReconciliationCandidatesData = async (tenantId, bankTransactionId) => {
    const transactionResult = await db.query(
        `SELECT bt.*, tb.name AS bank_name, tb.account_code
         FROM bank_transactions bt
         INNER JOIN tenant_banks tb ON tb.id = bt.bank_id
         WHERE bt.id = $1 AND bt.tenant_id = $2
         LIMIT 1`,
        [bankTransactionId, tenantId]
    );

    const bankTransaction = transactionResult.rows[0];
    if (!bankTransaction) {
        return { bankTransaction: null, candidates: [] };
    }

    const txAmount = Number(bankTransaction.amount || 0);
    const txType = String(bankTransaction.transaction_type || 'ABONO').toUpperCase();
    const candidates = [];

    if (txType === 'ABONO') {
        const receiptCandidates = await db.query(
            `SELECT
                'RECIBO_PAGO' AS source_type,
                pr.id AS source_id,
                pr.receipt_number AS source_number,
                pr.date AS movement_date,
                CONCAT('Recibo ', pr.receipt_number, ' - ', COALESCE(pr.client_name, 'Cliente')) AS description,
                pr.total AS amount,
                je.id AS journal_entry_id
             FROM payment_receipts pr
             LEFT JOIN journal_entries je
                ON je.tenant_id = pr.tenant_id
               AND je.document_type = 'RECIBO_PAGO'
               AND je.document_number = pr.receipt_number
             WHERE pr.tenant_id = $1
               AND ABS(COALESCE(pr.total, 0) - $2) <= 0.01
               AND NOT EXISTS (
                    SELECT 1
                    FROM bank_reconciliation_lines brl
                    INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                    WHERE brl.source_type = 'RECIBO_PAGO'
                      AND brl.source_id = pr.id
                      AND br.status <> 'ANULADA'
               )
             ORDER BY pr.date DESC, pr.id DESC
             LIMIT 20`,
            [tenantId, txAmount]
        );
        candidates.push(...receiptCandidates.rows);
    }

    if (txType === 'CARGO') {
        const payableCandidates = await db.query(
            `SELECT
                'PAGO_CXP' AS source_type,
                apa.id AS source_id,
                apa.source_number AS source_number,
                apa.application_date AS movement_date,
                CONCAT('Pago CxP ', apa.source_number, ' - ', COALESCE(ap.supplier_name, 'Proveedor')) AS description,
                apa.amount AS amount,
                je.id AS journal_entry_id
             FROM accounts_payable_applications apa
             INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
             LEFT JOIN journal_entries je
                ON je.tenant_id = apa.tenant_id
               AND je.document_type = 'PAGO_CXP'
               AND je.document_number = apa.source_number
             WHERE apa.tenant_id = $1
               AND ABS(COALESCE(apa.amount, 0) - $2) <= 0.01
               AND NOT EXISTS (
                    SELECT 1
                    FROM bank_reconciliation_lines brl
                    INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                    WHERE brl.source_type = 'PAGO_CXP'
                      AND brl.source_id = apa.id
                      AND br.status <> 'ANULADA'
               )
             ORDER BY apa.application_date DESC, apa.id DESC
             LIMIT 20`,
            [tenantId, txAmount]
        );
        const egresoCandidates = await db.query(
            `SELECT
                'COMPROBANTE_EGRESO' AS source_type,
                mv.id AS source_id,
                mv.voucher_number AS source_number,
                mv.voucher_date AS movement_date,
                CONCAT('Comprobante ', mv.voucher_number, ' - ', mv.description) AS description,
                mv.total_credit AS amount,
                mv.journal_entry_id
             FROM manual_vouchers mv
             WHERE mv.tenant_id = $1
               AND mv.voucher_type = 'COMPROBANTE_EGRESO'
               AND ABS(COALESCE(mv.total_credit, 0) - $2) <= 0.01
               AND NOT EXISTS (
                    SELECT 1
                    FROM bank_reconciliation_lines brl
                    INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                    WHERE brl.source_type = 'COMPROBANTE_EGRESO'
                      AND brl.source_id = mv.id
                      AND br.status <> 'ANULADA'
               )
             ORDER BY mv.voucher_date DESC, mv.id DESC
             LIMIT 20`,
            [tenantId, txAmount]
        );
        candidates.push(...payableCandidates.rows, ...egresoCandidates.rows);
    }

    if (txType === 'ABONO') {
        const ingresoCandidates = await db.query(
            `SELECT
                'COMPROBANTE_INGRESO' AS source_type,
                mv.id AS source_id,
                mv.voucher_number AS source_number,
                mv.voucher_date AS movement_date,
                CONCAT('Comprobante ', mv.voucher_number, ' - ', mv.description) AS description,
                mv.total_debit AS amount,
                mv.journal_entry_id
             FROM manual_vouchers mv
             WHERE mv.tenant_id = $1
               AND mv.voucher_type = 'COMPROBANTE_INGRESO'
               AND ABS(COALESCE(mv.total_debit, 0) - $2) <= 0.01
               AND NOT EXISTS (
                    SELECT 1
                    FROM bank_reconciliation_lines brl
                    INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                    WHERE brl.source_type = 'COMPROBANTE_INGRESO'
                      AND brl.source_id = mv.id
                      AND br.status <> 'ANULADA'
               )
             ORDER BY mv.voucher_date DESC, mv.id DESC
             LIMIT 20`,
            [tenantId, txAmount]
        );
        candidates.push(...ingresoCandidates.rows);
    }

    if (bankTransaction.account_code) {
        const journalCandidates = await db.query(
            `SELECT
                'ASIENTO_BANCARIO' AS source_type,
                je.id AS source_id,
                je.entry_number AS source_number,
                je.entry_date AS movement_date,
                je.description AS description,
                ABS(CASE WHEN $3 = 'ABONO' THEN COALESCE(jel.debit, 0) ELSE COALESCE(jel.credit, 0) END) AS amount,
                je.id AS journal_entry_id
             FROM journal_entries je
             INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
             WHERE je.tenant_id = $1
               AND jel.account_code = $2
               AND ABS(ABS(CASE WHEN $3 = 'ABONO' THEN COALESCE(jel.debit, 0) ELSE COALESCE(jel.credit, 0) END) - $4) <= 0.01
               AND NOT EXISTS (
                    SELECT 1
                    FROM bank_reconciliation_lines brl
                    INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
                    WHERE brl.journal_entry_id = je.id
                      AND br.status <> 'ANULADA'
               )
             ORDER BY je.entry_date DESC, je.id DESC
             LIMIT 20`,
            [tenantId, bankTransaction.account_code, txType, txAmount]
        );
        candidates.push(...journalCandidates.rows);
    }

    const uniqueCandidates = [];
    const seen = new Set();
    for (const candidate of candidates) {
        const key = `${candidate.source_type}:${candidate.source_id}:${candidate.journal_entry_id || ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCandidates.push(candidate);
        }
    }

    return { bankTransaction, candidates: uniqueCandidates.slice(0, 50) };
};

module.exports = {
    getBanksData,
    getBankTransactionsData,
    getBankReconciliationCandidatesData,
};
