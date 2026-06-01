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
const dianInbox = require('../services/dianInboxService');
const dianImap = require('../services/dianImapPollerService');
const db = require('../config/db');
const { encrypt } = require('../helpers/secretVault');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;
const resolveUserId = (req) => req.user?.id || null;

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

// =============================================
// BANDEJA DIAN — Auto-causación real desde XML/ZIP
// =============================================

const inboxUpload = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = resolveUserId(req);
        const files = (req.files || []).map((f) => ({ buffer: f.buffer, originalname: f.originalname }));

        if (!files.length) {
            return res.status(400).json({ success: false, error: 'No se recibieron archivos (campo "files")' });
        }

        const { summary, documents } = await dianInbox.ingestFiles({ tenantId, userId, files, source: 'UPLOAD' });
        res.json({ success: true, summary, documents });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/upload:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const inboxList = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { status, direction } = req.query;
        const documents = await dianInbox.listInbox({ tenantId, status, direction });
        res.json({ success: true, documents });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/list:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const inboxGet = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const id = Number(req.params.id);
        const result = await dianInbox.getInboxDocument({ tenantId, id });
        if (!result) return res.status(404).json({ success: false, error: 'Documento no encontrado' });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/get:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const inboxCausar = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = resolveUserId(req);
        const id = Number(req.params.id);
        const lineOverrides = Array.isArray(req.body?.lines) ? req.body.lines : [];
        const document = await dianInbox.causarManual({ tenantId, userId, id, lineOverrides });
        res.json({ success: true, document });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/causar:', error.message);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const inboxDiscard = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const id = Number(req.params.id);
        await dianInbox.discardDocument({ tenantId, id });
        res.json({ success: true });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/discard:', error.message);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

// =============================================
// BANDEJA DIAN — Buzón IMAP automático (Fase 2)
// =============================================

// Devuelve la config del buzón SIN la contraseña (solo has_password).
const inboxConfigGet = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const r = await db.query(
            `SELECT tenant_id, enabled, imap_host, imap_port, imap_secure, imap_user, folder,
                    (imap_password_enc IS NOT NULL AND length(imap_password_enc) > 0) AS has_password,
                    last_uid, last_poll_at, last_poll_status, last_poll_error, last_poll_summary
               FROM dian_inbox_config WHERE tenant_id = $1 LIMIT 1`,
            [tenantId]
        );
        const config = r.rows[0] || {
            tenant_id: tenantId, enabled: false, imap_host: null, imap_port: 993,
            imap_secure: true, imap_user: null, folder: 'INBOX', has_password: false,
            last_poll_at: null, last_poll_status: null, last_poll_error: null, last_poll_summary: null,
        };
        res.json({ success: true, config });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/config GET:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Guarda la config. Si llega password la cifra; si llega vacía conserva la existente.
const inboxConfigSave = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { enabled, imap_host, imap_port, imap_secure, imap_user, folder, password } = req.body || {};

        const existing = await db.query(`SELECT imap_password_enc, last_uid FROM dian_inbox_config WHERE tenant_id = $1`, [tenantId]);
        const prev = existing.rows[0];

        let passwordEnc = prev?.imap_password_enc || null;
        if (typeof password === 'string' && password.trim() !== '') {
            passwordEnc = encrypt(password.trim());
        }

        const enabledVal = !!enabled;
        const portVal = Number(imap_port) || 993;
        const secureVal = imap_secure !== false;
        const folderVal = (folder && String(folder).trim()) || 'INBOX';

        // Al ACTIVAR por primera vez (sin last_uid previo), fijamos baseline al UID actual
        // del buzón para procesar SOLO el correo nuevo (no toda la historia).
        let baselineUid = prev?.last_uid;
        if (enabledVal && (baselineUid === undefined || baselineUid === null || Number(baselineUid) === 0) && imap_host && imap_user && passwordEnc) {
            try {
                const { decrypt } = require('../helpers/secretVault');
                const test = await dianImap.testConnection({
                    host: imap_host, port: portVal, secure: secureVal, user: imap_user,
                    pass: decrypt(passwordEnc), folder: folderVal,
                });
                if (test.ok) baselineUid = test.maxUid || 0;
            } catch (_) { /* si falla, baseline queda en 0 y el primer poll procesará lo que haya */ }
        }
        if (baselineUid === undefined || baselineUid === null) baselineUid = 0;

        const upsert = await db.query(
            `INSERT INTO dian_inbox_config
                (tenant_id, enabled, imap_host, imap_port, imap_secure, imap_user, imap_password_enc, folder, last_uid, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
             ON CONFLICT (tenant_id) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                imap_host = EXCLUDED.imap_host,
                imap_port = EXCLUDED.imap_port,
                imap_secure = EXCLUDED.imap_secure,
                imap_user = EXCLUDED.imap_user,
                imap_password_enc = EXCLUDED.imap_password_enc,
                folder = EXCLUDED.folder,
                last_uid = EXCLUDED.last_uid,
                updated_at = NOW()
             RETURNING tenant_id, enabled, imap_host, imap_port, imap_secure, imap_user, folder,
                       (imap_password_enc IS NOT NULL) AS has_password, last_uid, last_poll_at, last_poll_status`,
            [tenantId, enabledVal, imap_host || null, portVal, secureVal, imap_user || null, passwordEnc, folderVal, baselineUid]
        );
        res.json({ success: true, config: upsert.rows[0] });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/config SAVE:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Prueba la conexión IMAP (usa la password enviada o, si viene vacía, la guardada).
const inboxConfigTest = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const { imap_host, imap_port, imap_secure, imap_user, folder, password } = req.body || {};
        let pass = (typeof password === 'string' && password.trim() !== '') ? password.trim() : null;
        if (!pass) {
            const r = await db.query(`SELECT imap_password_enc FROM dian_inbox_config WHERE tenant_id = $1`, [tenantId]);
            if (r.rows[0]?.imap_password_enc) {
                const { decrypt } = require('../helpers/secretVault');
                pass = decrypt(r.rows[0].imap_password_enc);
            }
        }
        if (!imap_host || !imap_user || !pass) {
            return res.status(400).json({ success: false, error: 'Faltan host, usuario o contraseña' });
        }
        const result = await dianImap.testConnection({
            host: imap_host, port: Number(imap_port) || 993, secure: imap_secure !== false,
            user: imap_user, pass, folder: (folder && String(folder).trim()) || 'INBOX',
        });
        res.json({ success: result.ok, ...result });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/config TEST:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Dispara una revisión del buzón AHORA para este tenant.
const inboxPollNow = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const result = await dianImap.pollTenant(tenantId);
        res.json({ success: result.ok !== false, ...result });
    } catch (error) {
        console.error('[AI Accounting] Error en inbox/poll:', error.message);
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
    chat,
    inboxUpload,
    inboxList,
    inboxGet,
    inboxCausar,
    inboxDiscard,
    inboxConfigGet,
    inboxConfigSave,
    inboxConfigTest,
    inboxPollNow
};
