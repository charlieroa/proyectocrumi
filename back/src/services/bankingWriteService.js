const db = require('../config/db');
const { insertJournalEntry, getDefaultAccountName } = require('./accountingCoreService');

const createBankTransactionEntry = async ({ tenantId, userId, body }) => {
    const {
        bankId,
        transactionDate,
        description,
        reference,
        transactionType = 'ABONO',
        amount,
        runningBalance,
        source = 'MANUAL',
        notes,
        contraAccountCode,
        contraAccountName,
        skipJournal = false,
    } = body;

    if (!bankId || !description || !amount) {
        const error = new Error('bankId, description y amount son obligatorios');
        error.statusCode = 400;
        throw error;
    }

    const numericAmount = Math.round(Number(amount || 0) * 100) / 100;
    if (numericAmount <= 0) {
        const error = new Error('El monto debe ser mayor a cero');
        error.statusCode = 400;
        throw error;
    }

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const bankResult = await client.query(
            `SELECT id, name, account_code FROM tenant_banks WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [bankId, tenantId]
        );

        if (bankResult.rows.length === 0) {
            const error = new Error('Banco no encontrado para este tenant');
            error.statusCode = 404;
            throw error;
        }

        const bank = bankResult.rows[0];

        const result = await client.query(
            `INSERT INTO bank_transactions (
                tenant_id, bank_id, transaction_date, description, reference,
                transaction_type, amount, running_balance, source, matched_amount,
                status, notes, created_by, created_at, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,0,'PENDIENTE',$10,$11,NOW(),NOW()
            )
            RETURNING *`,
            [
                tenantId,
                bankId,
                transactionDate || new Date(),
                description,
                reference || null,
                transactionType,
                numericAmount,
                runningBalance != null && runningBalance !== '' ? Number(runningBalance) : null,
                source,
                notes || null,
                userId || null
            ]
        );

        const transaction = result.rows[0];

        // Generar asiento contable sólo para movimientos MANUAL con contra-cuenta.
        // Los movimientos originados por otros documentos (pagos, facturas) ya tienen asiento propio.
        const shouldPost = !skipJournal
            && source === 'MANUAL'
            && bank.account_code
            && contraAccountCode;

        let journal = null;
        if (shouldPost) {
            const isInflow = String(transactionType).toUpperCase() === 'ABONO';
            const bankLine = {
                account_code: bank.account_code,
                account_name: bank.name || getDefaultAccountName(bank.account_code),
                description,
                debit: isInflow ? numericAmount : 0,
                credit: isInflow ? 0 : numericAmount,
            };
            const contraLine = {
                account_code: contraAccountCode,
                account_name: contraAccountName || getDefaultAccountName(contraAccountCode),
                description,
                debit: isInflow ? 0 : numericAmount,
                credit: isInflow ? numericAmount : 0,
            };
            journal = await insertJournalEntry(client, tenantId, {
                description: `Mov. bancario ${reference || transaction.id} - ${bank.name}`,
                documentType: 'BANK_TRANSACTION',
                documentId: transaction.id,
                documentNumber: reference || `BT-${transaction.id}`,
                entryDate: transactionDate || new Date(),
                lines: [bankLine, contraLine],
                userId,
            });
        }

        await client.query('COMMIT');
        return { ...transaction, journal };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const reconcileBankTransactionEntry = async ({ tenantId, userId, body }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const {
            bankTransactionId,
            sourceType,
            sourceId = null,
            sourceNumber = null,
            journalEntryId = null,
            movementDate = null,
            description = null,
            amount = null,
            notes = null
        } = body;

        if (!bankTransactionId || !sourceType) {
            const error = new Error('bankTransactionId y sourceType son obligatorios');
            error.statusCode = 400;
            throw error;
        }

        const transactionResult = await client.query(
            `SELECT * FROM bank_transactions WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [bankTransactionId, tenantId]
        );
        const bankTransaction = transactionResult.rows[0];

        if (!bankTransaction) {
            const error = new Error('Movimiento bancario no encontrado');
            error.statusCode = 404;
            throw error;
        }

        const pendingAmount = Math.max(Number(bankTransaction.amount || 0) - Number(bankTransaction.matched_amount || 0), 0);
        const matchedAmount = Math.round(Number(amount != null ? amount : pendingAmount) * 100) / 100;

        if (matchedAmount <= 0 || matchedAmount - pendingAmount > 0.01) {
            const error = new Error('Monto de conciliacion invalido');
            error.statusCode = 400;
            throw error;
        }

        let reconciliationResult = await client.query(
            `SELECT * FROM bank_reconciliations WHERE bank_transaction_id = $1 AND tenant_id = $2 LIMIT 1`,
            [bankTransactionId, tenantId]
        );

        if (reconciliationResult.rows.length === 0) {
            reconciliationResult = await client.query(
                `INSERT INTO bank_reconciliations (
                    tenant_id, bank_transaction_id, total_matched_amount, status, notes,
                    reconciled_at, reconciled_by, created_at, updated_at
                ) VALUES ($1,$2,0,'PENDIENTE',$3,NULL,NULL,NOW(),NOW())
                RETURNING *`,
                [tenantId, bankTransactionId, notes || null]
            );
        }

        const reconciliation = reconciliationResult.rows[0];

        const lineResult = await client.query(
            `INSERT INTO bank_reconciliation_lines (
                reconciliation_id, source_type, source_id, source_number, journal_entry_id,
                movement_date, description, amount, created_by, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
            RETURNING *`,
            [
                reconciliation.id,
                sourceType,
                sourceId,
                sourceNumber,
                journalEntryId,
                movementDate,
                description,
                matchedAmount,
                userId || null
            ]
        );

        const totalsResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM bank_reconciliation_lines
             WHERE reconciliation_id = $1`,
            [reconciliation.id]
        );

        const totalMatched = Math.round(Number(totalsResult.rows[0].total || 0) * 100) / 100;
        const newStatus = (Number(bankTransaction.amount || 0) - totalMatched) <= 0.01 ? 'CONCILIADO' : 'PARCIAL';

        await client.query(
            `UPDATE bank_reconciliations
             SET total_matched_amount = $1,
                 status = $2,
                 notes = COALESCE($3, notes),
                 reconciled_at = NOW(),
                 reconciled_by = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [totalMatched, newStatus, notes || null, userId || null, reconciliation.id]
        );

        const transactionUpdate = await client.query(
            `UPDATE bank_transactions
             SET matched_amount = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [totalMatched, newStatus, bankTransactionId]
        );

        await client.query('COMMIT');
        return {
            transaction: transactionUpdate.rows[0],
            reconciliationLine: lineResult.rows[0]
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const unreconcileBankTransactionLineEntry = async ({ tenantId, lineId }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const lineResult = await client.query(
            `SELECT brl.*, br.id AS reconciliation_id, br.bank_transaction_id, bt.amount AS transaction_amount
             FROM bank_reconciliation_lines brl
             INNER JOIN bank_reconciliations br ON br.id = brl.reconciliation_id
             INNER JOIN bank_transactions bt ON bt.id = br.bank_transaction_id
             WHERE brl.id = $1 AND br.tenant_id = $2
             LIMIT 1`,
            [lineId, tenantId]
        );

        const line = lineResult.rows[0];
        if (!line) {
            const error = new Error('Linea de conciliacion no encontrada');
            error.statusCode = 404;
            throw error;
        }

        await client.query(`DELETE FROM bank_reconciliation_lines WHERE id = $1`, [lineId]);

        const totalsResult = await client.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM bank_reconciliation_lines
             WHERE reconciliation_id = $1`,
            [line.reconciliation_id]
        );

        const totalMatched = Math.round(Number(totalsResult.rows[0].total || 0) * 100) / 100;
        const remaining = Math.max(Number(line.transaction_amount || 0) - totalMatched, 0);
        const newStatus = totalMatched <= 0.009 ? 'PENDIENTE' : (remaining <= 0.01 ? 'CONCILIADO' : 'PARCIAL');

        await client.query(
            `UPDATE bank_reconciliations
             SET total_matched_amount = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [totalMatched, newStatus, line.reconciliation_id]
        );

        const transactionUpdate = await client.query(
            `UPDATE bank_transactions
             SET matched_amount = $1,
                 status = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [totalMatched, newStatus, line.bank_transaction_id]
        );

        await client.query('COMMIT');
        return { transaction: transactionUpdate.rows[0] };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createBankTransactionEntry,
    reconcileBankTransactionEntry,
    unreconcileBankTransactionLineEntry,
};
