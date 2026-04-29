// src/routes/aliaddoRoutes.js
// Rutas para integración con API de Aliaddo - Facturación Electrónica

const express = require('express');
const router = express.Router();
const aliaddoController = require('../controllers/aliaddoController');
const authMiddleware = require('../middleware/authMiddleware');

// ============================================
// CONFIGURACIÓN Y ESTADO
// ============================================

// GET: Configuración de Aliaddo
router.get('/config', authMiddleware, aliaddoController.getConfig);

// GET: Estado completo del flujo de facturación electrónica
router.get('/invoicing-status', authMiddleware, aliaddoController.getInvoicingStatus);

// ============================================
// RESOLUCIÓN DIAN
// ============================================

// POST: Guardar resolución DIAN
router.post('/resolution', authMiddleware, aliaddoController.saveResolution);

// ============================================
// SET DE PRUEBAS
// ============================================

// GET: Estado del set de pruebas
router.get('/test-set/status', authMiddleware, aliaddoController.getTestSetStatus);

// POST: Enviar factura de prueba a DIAN vía Aliaddo
router.post('/test-set/send', authMiddleware, aliaddoController.sendTestSet);

// PUT: Actualizar estado del set de pruebas manualmente
router.put('/test-set/status', authMiddleware, aliaddoController.updateTestSetStatus);

// ============================================
// FACTURACIÓN
// ============================================

// POST: Crear y enviar factura a DIAN
router.post('/invoices', authMiddleware, aliaddoController.createInvoice);

// ============================================
// NOTAS CRÉDITO / DÉBITO
// ============================================

// POST: Crear y enviar nota crédito a DIAN
router.post('/credit-notes', authMiddleware, aliaddoController.createCreditNote);

// POST: Crear y enviar nota débito a DIAN
router.post('/debit-notes', authMiddleware, aliaddoController.createDebitNote);

// ============================================
// CONSULTA DE DOCUMENTOS
// ============================================

// GET: Estado de un documento por consecutivo
router.get('/documents/:consecutive', authMiddleware, aliaddoController.getDocumentStatus);

// ============================================
// TABLAS DIAN (públicas para formularios)
// ============================================

router.get('/dian/tax-regimes', aliaddoController.getDianTaxRegimes);
router.get('/dian/responsibilities', aliaddoController.getDianResponsibilities);
router.get('/dian/identification-types', aliaddoController.getDianIdentificationTypes);
router.get('/dian/document-types', aliaddoController.getDianDocumentTypes);
router.get('/dian/payment-methods', aliaddoController.getDianPaymentMethods);

module.exports = router;
