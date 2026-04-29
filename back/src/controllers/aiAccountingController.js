// src/controllers/aiAccountingController.js
// Controlador de IA Contable - Endpoints para automatización estilo AX1

const {
    aiClassifyItem,
    aiClassifyBatch,
    aiBankReconciliation,
    aiAutoReconcile,
    aiCashFlowPrediction,
    aiAuditEntries,
    aiAutoCausacion,
    aiParseDocument,
    aiAccountingChat
} = require('../services/aiAccountingService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

// =============================================
// CLASIFICACIÓN INTELIGENTE
// =============================================

const classifyItem = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { description, documentType } = req.body;

        if (!description) {
            return res.status(400).json({ success: false, error: 'description es obligatorio' });
        }

        const result = await aiClassifyItem(tenantId, description, documentType);
        res.json({ success: true, classification: result });
    } catch (error) {
        console.error('[AI Accounting] Error en clasificación:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const classifyBatch = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { items, documentType } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'items debe ser un array con al menos 1 elemento' });
        }

        if (items.length > 50) {
            return res.status(400).json({ success: false, error: 'Máximo 50 ítems por batch' });
        }

        const result = await aiClassifyBatch(tenantId, items, documentType);
        res.json({ success: true, classifications: result });
    } catch (error) {
        console.error('[AI Accounting] Error en clasificación batch:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// CONCILIACIÓN BANCARIA INTELIGENTE
// =============================================

const smartReconciliation = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { bankTransactionId } = req.body;

        if (!bankTransactionId) {
            return res.status(400).json({ success: false, error: 'bankTransactionId es obligatorio' });
        }

        const result = await aiBankReconciliation(tenantId, bankTransactionId);
        res.json({ success: true, reconciliation: result });
    } catch (error) {
        console.error('[AI Accounting] Error en conciliación IA:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const autoReconcile = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { bankId, minConfidence } = req.body;

        if (!bankId) {
            return res.status(400).json({ success: false, error: 'bankId es obligatorio' });
        }

        const result = await aiAutoReconcile(tenantId, bankId, minConfidence || 0.85);
        res.json({ success: true, results: result });
    } catch (error) {
        console.error('[AI Accounting] Error en auto-conciliación:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// PREDICCIÓN DE FLUJO DE CAJA
// =============================================

const cashFlowPrediction = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const monthsAhead = Number(req.query.months) || 3;

        const result = await aiCashFlowPrediction(tenantId, monthsAhead);
        res.json({ success: true, prediction: result });
    } catch (error) {
        console.error('[AI Accounting] Error en predicción flujo de caja:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// AUDITORÍA INTELIGENTE
// =============================================

const auditEntries = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { startDate, endDate, limit } = req.query;

        const result = await aiAuditEntries(tenantId, {
            startDate,
            endDate,
            limit: Number(limit) || 50
        });
        res.json({ success: true, audit: result });
    } catch (error) {
        console.error('[AI Accounting] Error en auditoría IA:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// AUTO-CAUSACIÓN
// =============================================

const autoCausacion = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { text, amount, date, documentType, thirdParty } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: 'text es obligatorio' });
        }

        const result = await aiAutoCausacion(tenantId, { text, amount, date, documentType, thirdParty });
        res.json({ success: true, causacion: result });
    } catch (error) {
        console.error('[AI Accounting] Error en auto-causación:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// PARSING DE DOCUMENTOS
// =============================================

const parseDocument = async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, error: 'text es obligatorio' });
        }

        const result = await aiParseDocument(text);
        res.json({ success: true, document: result });
    } catch (error) {
        console.error('[AI Accounting] Error en parsing:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// =============================================
// CHAT CONTABLE
// =============================================

const chat = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { question, history } = req.body;

        if (!question) {
            return res.status(400).json({ success: false, error: 'question es obligatorio' });
        }

        const result = await aiAccountingChat(tenantId, question, history || []);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[AI Accounting] Error en chat contable:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    classifyItem,
    classifyBatch,
    smartReconciliation,
    autoReconcile,
    cashFlowPrediction,
    auditEntries,
    autoCausacion,
    parseDocument,
    chat
};
