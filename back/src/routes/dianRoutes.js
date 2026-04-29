// src/routes/dianRoutes.js
// Rutas para Facturación Electrónica DIAN

const express = require('express');
const router = express.Router();
const {
    sendInvoice,
    checkStatus,
    getDocumentInfo,
    getConfig,
    generateTest,
    testSetStatus
} = require('../controllers/dianController');
const authMiddleware = require('../middleware/authMiddleware');

// ============================================
// RUTAS PÚBLICAS (Para debug - Quitar en producción)
// ============================================

// GET: Obtener configuración DIAN
router.get('/config', getConfig);

// GET: Estado del set de pruebas
router.get('/test-set-status', testSetStatus);

// ============================================
// RUTAS PROTEGIDAS
// ============================================

// POST: Enviar factura específica a DIAN
router.post('/send/:invoiceId', authMiddleware, sendInvoice);

// GET: Consultar estado por trackId
router.get('/status/:trackId', authMiddleware, checkStatus);

// GET: Consultar documento por CUFE
router.get('/document/:cufe', authMiddleware, getDocumentInfo);

// POST: Generar y enviar factura de prueba
router.post('/test', authMiddleware, generateTest);

// ============================================
// RUTA DE PRUEBA SIN AUTH (Solo desarrollo)
// ============================================
if (process.env.NODE_ENV !== 'production') {
    router.post('/test-no-auth', generateTest);
}

module.exports = router;
