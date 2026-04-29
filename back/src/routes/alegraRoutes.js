// src/routes/alegraRoutes.js
// Rutas para integraci�n con API de Alegra Proveedor Electr�nico

const express = require('express');
const router = express.Router();
const alegraController = require('../controllers/alegraController');
const authMiddleware = require('../middleware/authMiddleware');

// Config y observabilidad
router.get('/config', authMiddleware, alegraController.getConfig);
router.get('/provider/status', authMiddleware, alegraController.getProviderStatus);

// Tablas DIAN
router.get('/dian/departments', alegraController.getDianDepartments);
router.get('/dian/municipalities', alegraController.getDianMunicipalities);
router.get('/dian/tax-regimes', alegraController.getDianTaxRegimes);
router.get('/dian/identification-types', alegraController.getDianIdentificationTypes);
router.get('/dian/acquirer-info', alegraController.lookupAcquirerInfo);

// Estado de facturaci�n y resoluciones
router.get('/invoicing-status', authMiddleware, alegraController.getInvoicingStatus);
router.get('/resolutions', authMiddleware, alegraController.getResolutions);
router.post('/resolution/manual', authMiddleware, alegraController.saveManualResolution);

// Empresas
router.post('/company/register', authMiddleware, alegraController.registerCompany);
router.get('/company/:companyId', authMiddleware, alegraController.getCompany);

// Set de pruebas
router.get('/test-set/status', authMiddleware, alegraController.getTestSetStatus);
router.post('/test-set/send', authMiddleware, alegraController.sendTestSet);
router.post('/test-set/generate', authMiddleware, alegraController.generateTestDocuments);

// N�mina electr�nica
router.get('/payroll-electronic/status', authMiddleware, alegraController.getPayrollElectronicStatus);
router.get('/payroll-electronic/periods', authMiddleware, alegraController.listPayrollElectronicPeriods);
router.get('/payroll-electronic/periods/:periodId/documents', authMiddleware, alegraController.getPayrollElectronicDocuments);
router.post('/payroll-electronic/periods/:periodId/prepare', authMiddleware, alegraController.preparePayrollElectronicPeriod);
router.post('/payroll-electronic/periods/:periodId/sync', authMiddleware, alegraController.syncPayrollElectronicPeriod);

// Facturaci�n
router.post('/invoices', authMiddleware, alegraController.createInvoice);
router.get('/invoices/:invoiceId', authMiddleware, alegraController.getInvoice);
router.post('/invoices/:invoiceId/send', authMiddleware, alegraController.sendInvoiceToDian);

// Notas
router.post('/credit-notes', authMiddleware, alegraController.createCreditNote);
router.post('/debit-notes', authMiddleware, alegraController.createDebitNote);

module.exports = router;

