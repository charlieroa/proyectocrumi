// src/services/dianImapPollerService.js
// Fase 2 de la Bandeja DIAN: lee un buzón IMAP por tenant, extrae los adjuntos
// XML/ZIP de las facturas electrónicas que llegan por correo y los mete por el
// MISMO pipeline de auto-causación que la carga manual (dianInboxService.ingestFiles).
//
// Seguridad: la contraseña/app-password se guarda cifrada (secretVault) y solo se
// descifra en memoria al conectar. Idempotencia: el pipeline ya deduplica por CUFE,
// y además avanzamos last_uid para no reprocesar correos.

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../config/db');
const { decrypt } = require('../helpers/secretVault');
const dianInbox = require('./dianInboxService');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos
const ATTACH_RE = /\.(xml|zip)$/i;

const isInvoiceAttachment = (a) => {
    const name = a.filename || '';
    const type = a.contentType || '';
    return ATTACH_RE.test(name) || /xml|zip|octet-stream/i.test(type);
};

function makeClient({ host, port, secure, user, pass }) {
    return new ImapFlow({
        host,
        port: Number(port) || 993,
        secure: secure !== false,
        auth: { user, pass },
        logger: false,
        // Tolerar certificados de proveedores comunes; el tráfico sigue cifrado por TLS.
        tls: { rejectUnauthorized: false },
    });
}

// Prueba de conexión + devuelve el UID máximo actual del buzón (para baseline).
async function testConnection({ host, port, secure, user, pass, folder = 'INBOX' }) {
    const client = makeClient({ host, port, secure, user, pass });
    try {
        await client.connect();
        const mbox = await client.mailboxOpen(folder, { readOnly: true });
        const maxUid = mbox && mbox.uidNext ? Math.max(0, Number(mbox.uidNext) - 1) : 0;
        await client.logout();
        return { ok: true, maxUid, exists: mbox?.exists ?? 0 };
    } catch (e) {
        try { client.close(); } catch (_) {}
        return { ok: false, error: e.message };
    }
}

async function loadConfig(tenantId) {
    const r = await db.query(`SELECT * FROM dian_inbox_config WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    return r.rows[0] || null;
}

// Procesa los correos nuevos (uid > last_uid) de un tenant.
async function pollTenant(tenantId) {
    const cfg = await loadConfig(tenantId);
    if (!cfg || !cfg.enabled) return { skipped: true, reason: 'deshabilitado' };
    if (!cfg.imap_host || !cfg.imap_user || !cfg.imap_password_enc) {
        return { skipped: true, reason: 'configuración incompleta' };
    }

    let pass;
    try {
        pass = decrypt(cfg.imap_password_enc);
    } catch (e) {
        await db.query(
            `UPDATE dian_inbox_config SET last_poll_at = NOW(), last_poll_status = 'ERROR',
                last_poll_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
            [tenantId, 'No se pudo descifrar la contraseña (¿cambió AI_CRED_ENCRYPTION_KEY?).']
        );
        return { ok: false, error: 'decrypt' };
    }

    const folder = cfg.folder || 'INBOX';
    const client = makeClient({ host: cfg.imap_host, port: cfg.imap_port, secure: cfg.imap_secure, user: cfg.imap_user, pass });
    const totals = { received: 0, causados: 0, revision: 0, errores: 0, duplicados: 0 };
    const sinceUid = Number(cfg.last_uid) || 0;
    let maxUid = sinceUid;

    try {
        await client.connect();
        const lock = await client.getMailboxLock(folder);
        try {
            // Rango por UID: "n:*" siempre devuelve al menos el último mensaje aunque su
            // UID sea < n, por eso filtramos explícitamente uid > sinceUid.
            for await (const msg of client.fetch(`${sinceUid + 1}:*`, { uid: true, source: true }, { uid: true })) {
                if (!msg.uid || msg.uid <= sinceUid) continue;
                if (msg.uid > maxUid) maxUid = msg.uid;
                let parsed;
                try {
                    parsed = await simpleParser(msg.source);
                } catch (_) { continue; }
                const files = (parsed.attachments || [])
                    .filter(isInvoiceAttachment)
                    .map((a) => ({ buffer: a.content, originalname: a.filename || 'adjunto.xml' }));
                if (!files.length) continue;
                try {
                    const { summary } = await dianInbox.ingestFiles({ tenantId, userId: null, files, source: 'EMAIL' });
                    for (const k of Object.keys(totals)) totals[k] += summary[k] || 0;
                } catch (e) {
                    totals.errores += 1;
                }
            }
        } finally {
            lock.release();
        }
        await client.logout();

        await db.query(
            `UPDATE dian_inbox_config SET last_uid = $2, last_poll_at = NOW(), last_poll_status = 'OK',
                last_poll_error = NULL, last_poll_summary = $3, updated_at = NOW() WHERE tenant_id = $1`,
            [tenantId, maxUid, JSON.stringify(totals)]
        );
        return { ok: true, summary: totals };
    } catch (e) {
        try { client.close(); } catch (_) {}
        await db.query(
            `UPDATE dian_inbox_config SET last_poll_at = NOW(), last_poll_status = 'ERROR',
                last_poll_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
            [tenantId, String(e.message || e).slice(0, 1000)]
        );
        return { ok: false, error: e.message };
    }
}

// Recorre todos los tenants con buzón activo.
async function pollAll() {
    const r = await db.query(`SELECT tenant_id FROM dian_inbox_config WHERE enabled = TRUE`);
    for (const row of r.rows) {
        try {
            await pollTenant(row.tenant_id);
        } catch (e) {
            console.error('[DIAN IMAP] poll tenant', row.tenant_id, 'falló:', e.message);
        }
    }
    return r.rows.length;
}

let _timer = null;
let _running = false;

function startPoller() {
    if (_timer) return;
    const tick = async () => {
        if (_running) return; // evitar solapamiento
        _running = true;
        try {
            const n = await pollAll();
            if (n > 0) console.log(`[DIAN IMAP] poll completado (${n} buzones)`);
        } catch (e) {
            console.error('[DIAN IMAP] pollAll falló:', e.message);
        } finally {
            _running = false;
        }
    };
    setTimeout(tick, 30000); // primera corrida 30s tras el arranque
    _timer = setInterval(tick, POLL_INTERVAL_MS);
    console.log('[DIAN IMAP] poller iniciado (cada 5 min)');
}

module.exports = {
    testConnection,
    pollTenant,
    pollAll,
    startPoller,
};
