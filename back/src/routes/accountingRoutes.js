// src/routes/accountingRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const accounting = require('../controllers/accountingController');
const receivablesController = require('../controllers/receivablesController');
const payablesController = require('../controllers/payablesController');
const bankingController = require('../controllers/bankingController');
const thirdPartyController = require('../controllers/thirdPartyController');
const manualVouchersController = require('../controllers/manualVouchersController');
const accountingAuditController = require('../controllers/accountingAuditController');
const accountingRulesController = require('../controllers/accountingRulesController');
const accountingMappingsController = require('../controllers/accountingMappingsController');
const accountingDashboardController = require('../controllers/accountingDashboardController');

// =============================================
// DASHBOARD
// =============================================
router.get('/dashboard/summary', authMiddleware, accountingDashboardController.getDashboardSummary);
router.get('/dashboard/chart-data', authMiddleware, accountingDashboardController.getChartData);

// =============================================
// PLAN DE CUENTAS (PUC)
// =============================================
router.get('/periods', authMiddleware, accounting.getAccountingPeriods);
router.post('/periods', authMiddleware, accounting.createAccountingPeriod);
router.post('/periods/:id/close', authMiddleware, accounting.closeAccountingPeriod);
router.post('/periods/:id/reopen', authMiddleware, accounting.reopenAccountingPeriod);

// =============================================
// PLAN DE CUENTAS (PUC)
// =============================================
router.get('/chart-of-accounts', authMiddleware, accounting.getChartOfAccounts);
router.post('/chart-of-accounts', authMiddleware, accounting.createAccount);
router.post('/chart-of-accounts/bulk', authMiddleware, accounting.bulkCreateAccounts);
router.put('/chart-of-accounts/:id', authMiddleware, accounting.updateAccount);
router.delete('/chart-of-accounts/:id', authMiddleware, accounting.deleteAccount);
router.post('/chart-of-accounts/seed-colombia', authMiddleware, accounting.seedPucColombia);

// =============================================
// LIBRO DIARIO
// =============================================
router.get('/journal-entries', authMiddleware, accounting.getJournalEntries);
router.get('/journal-entries/summary', authMiddleware, accounting.getJournalEntriesSummary);
router.get('/journal-entries/unposted', authMiddleware, accounting.getUnpostedEntries);
router.get('/trial-balance/by-third-party', authMiddleware, accounting.getTrialBalanceByThirdParty);
router.get('/trial-balance/configurable', authMiddleware, accounting.getTrialBalanceConfigurable);
router.get('/journal-entries/:id', authMiddleware, accounting.getJournalEntryById);
router.post('/journal-entries/:id/reverse', authMiddleware, accounting.reverseJournalEntry);

// =============================================
// LIBRO MAYOR
// =============================================
router.get('/ledger', authMiddleware, accounting.getLedger);

// =============================================
// BALANCE DE PRUEBA
// =============================================
router.get('/trial-balance', authMiddleware, accounting.getTrialBalance);
router.get('/balance-sheet', authMiddleware, accounting.getBalanceSheet);

// =============================================
// ESTADO DE RESULTADOS
// =============================================
router.get('/income-statement', authMiddleware, accounting.getIncomeStatement);

// =============================================
// ESTADO DE FLUJO DE EFECTIVO
// =============================================
router.get('/cash-flow', authMiddleware, accounting.getCashFlowStatement);

// =============================================
// ESTADO DE CAMBIOS EN EL PATRIMONIO
// =============================================
router.get('/equity-changes', authMiddleware, accounting.getEquityChangesStatement);

// =============================================
// LIBRO AUXILIAR
// =============================================
router.get('/auxiliar', authMiddleware, accounting.getAuxiliarBook);
router.get('/third-parties', authMiddleware, thirdPartyController.listThirdParties);
router.post('/third-parties', authMiddleware, thirdPartyController.createThirdParty);
router.put('/third-parties/:id', authMiddleware, thirdPartyController.updateThirdParty);
router.post('/third-parties/bulk', authMiddleware, thirdPartyController.bulkCreateThirdParties);
router.post('/third-parties/sync', authMiddleware, thirdPartyController.syncThirdParties);
router.get('/third-party-ledger', authMiddleware, receivablesController.getThirdPartyLedger);
router.get('/accounts-receivable', authMiddleware, receivablesController.getAccountsReceivableReport);
router.get('/tax-summary', authMiddleware, payablesController.getTaxSummary);
router.get('/accounts-payable/payments', authMiddleware, payablesController.getAccountsPayablePaymentsReport);
router.get('/accounts-payable/payments/:id', authMiddleware, payablesController.getPaymentById);
router.post('/accounts-payable/payments/:id/void', authMiddleware, payablesController.voidPayment);
router.get('/accounts-payable/next-number', authMiddleware, payablesController.getNextPurchaseNumber);
router.get('/manual-vouchers', authMiddleware, manualVouchersController.getManualVouchers);
router.post('/manual-vouchers', authMiddleware, manualVouchersController.createManualVoucher);
router.post('/manual-vouchers/bulk', authMiddleware, manualVouchersController.bulkCreateVouchers);
router.get('/accounts-payable', authMiddleware, payablesController.getAccountsPayableReport);
router.post('/accounts-payable', authMiddleware, payablesController.createAccountsPayable);
router.get('/accounts-payable/:id', authMiddleware, payablesController.getAccountsPayableById);
router.put('/accounts-payable/:id', authMiddleware, payablesController.updateAccountsPayable);
router.post('/accounts-payable/apply-payment', authMiddleware, payablesController.applyAccountsPayablePayment);
router.post('/accounts-payable/:id/submit-dian', authMiddleware, payablesController.submitSupportDocumentToDian);
router.post('/accounts-payable/:id/void', authMiddleware, payablesController.voidAccountsPayable);
router.get('/banks', authMiddleware, bankingController.getBanks);
router.get('/bank-transactions', authMiddleware, bankingController.getBankTransactions);
router.post('/bank-transactions', authMiddleware, bankingController.createBankTransaction);
router.get('/bank-reconciliations/candidates', authMiddleware, bankingController.getBankReconciliationCandidates);
router.post('/bank-reconciliations/match', authMiddleware, bankingController.reconcileBankTransaction);
router.post('/bank-reconciliation-lines/:id/unmatch', authMiddleware, bankingController.unreconcileBankTransactionLine);
router.get('/audit-events', authMiddleware, accountingAuditController.getAuditEvents);
router.get('/audit-summary', authMiddleware, accountingAuditController.getAuditSummary);

// =============================================
// REGLAS DE CLASIFICACIÓN
// =============================================
router.get('/classification-rules', authMiddleware, accountingRulesController.getClassificationRules);
router.post('/classification-rules', authMiddleware, accountingRulesController.createClassificationRule);
router.post('/classification-rules/seed', authMiddleware, accountingRulesController.seedRules);
router.put('/classification-rules/:id', authMiddleware, accountingRulesController.updateClassificationRule);
router.delete('/classification-rules/:id', authMiddleware, accountingRulesController.deleteClassificationRule);

// =============================================
// MAPPINGS (APROBACIÓN)
// =============================================
router.get('/mappings', authMiddleware, accountingMappingsController.getAllMappings);
router.get('/mappings/pending', authMiddleware, accountingMappingsController.getPendingMappings);
router.post('/mappings/:id/approve', authMiddleware, accountingMappingsController.approveMapping);
router.post('/mappings/:id/reject', authMiddleware, accountingMappingsController.rejectMapping);

module.exports = router;


