// src/routes/aiAccountingRoutes.js
// Rutas de IA Contable - Automatización inteligente

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ai = require('../controllers/aiAccountingController');

// =============================================
// CLASIFICACIÓN INTELIGENTE
// =============================================
router.post('/classify', authMiddleware, ai.classifyItem);
router.post('/classify/batch', authMiddleware, ai.classifyBatch);

// =============================================
// CONCILIACIÓN BANCARIA IA
// =============================================
router.post('/reconciliation/smart', authMiddleware, ai.smartReconciliation);
router.post('/reconciliation/auto', authMiddleware, ai.autoReconcile);

// =============================================
// PREDICCIÓN FLUJO DE CAJA
// =============================================
router.get('/cash-flow/prediction', authMiddleware, ai.cashFlowPrediction);

// =============================================
// AUDITORÍA INTELIGENTE
// =============================================
router.get('/audit', authMiddleware, ai.auditEntries);

// =============================================
// AUTO-CAUSACIÓN
// =============================================
router.post('/auto-causacion', authMiddleware, ai.autoCausacion);

// =============================================
// PARSING DE DOCUMENTOS
// =============================================
router.post('/parse-document', authMiddleware, ai.parseDocument);

// =============================================
// CHAT CONTABLE IA
// =============================================
router.post('/chat', authMiddleware, ai.chat);

module.exports = router;
