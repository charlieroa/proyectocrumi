const {
    getBanksData,
    getBankTransactionsData,
    getBankReconciliationCandidatesData
} = require('../services/bankingQueryService');
const {
    createBankTransactionEntry,
    reconcileBankTransactionEntry,
    unreconcileBankTransactionLineEntry
} = require('../services/bankingWriteService');
const { recordAccountingAuditEvent } = require('../helpers/accountingAuditHelper');

const resolveTenantId = (req) => req.user?.tenant_id || req.query?.tenantId || req.body?.tenantId;

const getBanks = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await getBanksData(tenantId);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Banking] Error obteniendo cuentas bancarias:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getBankTransactions = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await getBankTransactionsData(tenantId, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Banking] Error obteniendo movimientos bancarios:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createBankTransaction = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const transaction = await createBankTransactionEntry({ tenantId, userId, body: req.body });

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'bancos',
            action: 'bank.transaction.created',
            entityType: 'bank_transaction',
            entityId: transaction.id,
            entityNumber: transaction.reference || String(transaction.id),
            message: 'Movimiento bancario creado',
            afterData: transaction,
            metadata: { source: 'bankingController.createBankTransaction' }
        });

        res.status(201).json({ success: true, transaction });
    } catch (error) {
        console.error('[Banking] Error creando movimiento bancario:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const getBankReconciliationCandidates = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { bankTransactionId } = req.query;

        if (!bankTransactionId) {
            return res.status(400).json({ success: false, error: 'bankTransactionId es obligatorio' });
        }

        const data = await getBankReconciliationCandidatesData(tenantId, bankTransactionId);
        if (!data.bankTransaction) {
            return res.status(404).json({ success: false, error: 'Movimiento bancario no encontrado' });
        }

        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Banking] Error obteniendo candidatos de conciliacion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const reconcileBankTransaction = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id || null;
        const { transaction, reconciliationLine } = await reconcileBankTransactionEntry({ tenantId, userId, body: req.body });

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'bancos',
            action: 'bank.transaction.reconciled',
            entityType: 'bank_transaction',
            entityId: transaction.id,
            entityNumber: transaction.reference || String(transaction.id),
            message: 'Movimiento bancario conciliado',
            afterData: { transaction, reconciliationLine },
            metadata: { sourceType: req.body.sourceType, sourceNumber: req.body.sourceNumber, journalEntryId: req.body.journalEntryId, source: 'bankingController.reconcileBankTransaction' }
        });
        res.json({ success: true, transaction, reconciliationLine });
    } catch (error) {
        console.error('[Banking] Error conciliando movimiento bancario:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const unreconcileBankTransactionLine = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { id } = req.params;
        const { transaction } = await unreconcileBankTransactionLineEntry({ tenantId, lineId: id });

        await recordAccountingAuditEvent({
            tenantId,
            userId: req.user?.id || null,
            category: 'bancos',
            action: 'bank.transaction.unreconciled',
            entityType: 'bank_transaction',
            entityId: transaction.id,
            entityNumber: transaction.reference || String(transaction.id),
            message: 'Conciliacion bancaria revertida',
            afterData: transaction,
            metadata: { source: 'bankingController.unreconcileBankTransactionLine', lineId: id }
        });
        res.json({ success: true, transaction });
    } catch (error) {
        console.error('[Banking] Error deshaciendo conciliacion bancaria:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getBanks,
    getBankTransactions,
    createBankTransaction,
    getBankReconciliationCandidates,
    reconcileBankTransaction,
    unreconcileBankTransactionLine,
};
