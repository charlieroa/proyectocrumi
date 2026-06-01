// src/routes/aiAccountingRoutes.js
// Rutas de IA Contable - Automatización inteligente

const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ai = require('../controllers/aiAccountingController');

// Carga de XML/ZIP de facturas DIAN: en memoria (el XML se guarda en BD, no en disco).
const inboxUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 50 },
});

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
// BANDEJA DIAN — Auto-causación real desde XML/ZIP
// =============================================
router.post('/inbox/upload', authMiddleware, inboxUpload.array('files', 50), ai.inboxUpload);
router.get('/inbox', authMiddleware, ai.inboxList);

// Buzón IMAP automático (Fase 2). IMPORTANTE: definir ANTES de '/inbox/:id'
// para que 'config'/'poll' no se interpreten como un :id.
router.get('/inbox/config', authMiddleware, ai.inboxConfigGet);
router.put('/inbox/config', authMiddleware, ai.inboxConfigSave);
router.post('/inbox/config/test', authMiddleware, ai.inboxConfigTest);
router.post('/inbox/poll', authMiddleware, ai.inboxPollNow);

router.get('/inbox/:id', authMiddleware, ai.inboxGet);
router.post('/inbox/:id/causar', authMiddleware, ai.inboxCausar);
router.post('/inbox/:id/discard', authMiddleware, ai.inboxDiscard);

// =============================================
// CHAT CONTABLE IA
// =============================================
router.post('/chat', authMiddleware, ai.chat);

module.exports = router;
