// src/services/whatsappService.js
// Servicio de WhatsApp con Baileys

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const db = require('../config/db');
const { usePostgresAuthState, updateSessionStatus, createSessionRecord, deleteSession } = require('./whatsappAuthStore');

const logger = pino({ level: 'silent' });

// Sesiones activas en memoria por tenant
const activeSessions = new Map();

// Contador de reintentos por tenant
const reconnectAttempts = new Map();
const MAX_RECONNECT_ATTEMPTS = 3;

// Referencia global al IO server (se setea desde index.js)
let io = null;

const setIO = (ioServer) => {
  io = ioServer;
};

const getIO = () => io;

/**
 * Iniciar sesión de WhatsApp para un tenant
 */
const startSession = async (tenantId) => {
  const sessionId = `wa_${tenantId}`;

  // Si ya hay una sesión activa, retornar
  if (activeSessions.has(tenantId)) {
    const existing = activeSessions.get(tenantId);
    if (existing.sock?.ws?.readyState === 1) {
      return { status: 'already_connected' };
    }
    // Limpiar sesión rota
    if (existing.safeEnd) existing.safeEnd();
    else { try { existing.sock?.end(); } catch (e) {} }
    activeSessions.delete(tenantId);
  }

  // Crear/actualizar registro en DB
  await createSessionRecord(tenantId, sessionId);

  // Cargar auth state desde PostgreSQL
  const { state, saveCreds } = await usePostgresAuthState(sessionId);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: true,
    browser: ['Crumi', 'Chrome', '120.0'],
  });

  // Función segura para cerrar el socket sin crash
  const safeEnd = () => {
    try {
      if (sock.ws) sock.ws.removeAllListeners('error');
      if (sock.ws) sock.ws.on('error', () => {});
    } catch (e) {}
    try { sock.end(); } catch (e) {}
  };

  activeSessions.set(tenantId, { sock, sessionId, safeEnd });

  // Eventos de conexión
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Generar QR como data URL
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        await updateSessionStatus(sessionId, 'qr_pending');

        // Emitir QR via Socket.IO
        if (io) {
          io.to(`tenant_${tenantId}`).emit('qr', { qr: qrDataUrl });
          io.to(`tenant_${tenantId}`).emit('connection_status', { status: 'qr_pending' });
        }
      } catch (err) {
        console.error('[WhatsApp] Error generando QR:', err);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== undefined;

      console.log(`[WhatsApp] Conexión cerrada para tenant ${tenantId}, statusCode: ${statusCode}`);

      // Limpiar sesión activa
      const session = activeSessions.get(tenantId);
      if (session?.safeEnd) session.safeEnd();
      activeSessions.delete(tenantId);

      if (shouldReconnect) {
        const attempts = (reconnectAttempts.get(tenantId) || 0) + 1;
        reconnectAttempts.set(tenantId, attempts);

        if (attempts <= MAX_RECONNECT_ATTEMPTS) {
          console.log(`[WhatsApp] Reintentando tenant ${tenantId} (${attempts}/${MAX_RECONNECT_ATTEMPTS})`);
          await updateSessionStatus(sessionId, 'disconnected');
          if (io) {
            io.to(`tenant_${tenantId}`).emit('connection_status', { status: 'reconnecting' });
          }
          setTimeout(() => startSession(tenantId).catch(e => console.error('[WhatsApp] Reconnect error:', e.message)), 3000);
        } else {
          console.log(`[WhatsApp] Máximo de reintentos alcanzado para tenant ${tenantId}`);
          reconnectAttempts.delete(tenantId);
          await updateSessionStatus(sessionId, 'disconnected');
          if (io) {
            io.to(`tenant_${tenantId}`).emit('connection_status', { status: 'disconnected' });
          }
        }
      } else {
        // Logged out o statusCode undefined - limpiar sesión
        reconnectAttempts.delete(tenantId);
        await deleteSession(sessionId);
        if (io) {
          io.to(`tenant_${tenantId}`).emit('connection_status', { status: 'disconnected' });
        }
      }
    }

    if (connection === 'open') {
      console.log(`[WhatsApp] Conectado para tenant ${tenantId}`);
      reconnectAttempts.delete(tenantId);
      const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || '';
      await updateSessionStatus(sessionId, 'connected', phoneNumber);

      if (io) {
        io.to(`tenant_${tenantId}`).emit('connection_status', {
          status: 'connected',
          phoneNumber,
        });
      }
    }
  });

  // Guardar credenciales cuando se actualicen
  sock.ev.on('creds.update', saveCreds);

  // Recibir mensajes
  sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
    if (type !== 'notify') return;

    for (const msg of msgs) {
      // Ignorar mensajes de status/broadcast
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;

      try {
        await handleIncomingMessage(tenantId, sock, msg);
      } catch (err) {
        console.error('[WhatsApp] Error procesando mensaje:', err);
      }
    }
  });

  return { status: 'connecting', sessionId };
};

/**
 * Procesar mensaje entrante
 */
const handleIncomingMessage = async (tenantId, sock, msg) => {
  const remoteJid = msg.key.remoteJid;
  const isGroup = remoteJid.endsWith('@g.us');
  const fromMe = msg.key.fromMe;
  const pushName = msg.pushName || '';

  // Extraer contenido del mensaje
  const messageContent = extractMessageContent(msg);
  if (!messageContent.text && !messageContent.mediaUrl) return;

  // Obtener o crear contacto
  const contact = await getOrCreateContact(tenantId, remoteJid, pushName, isGroup);

  // Obtener o crear conversación
  const conversation = await getOrCreateConversation(tenantId, contact.id);

  // Guardar mensaje
  const savedMsg = await saveMessage({
    conversationId: conversation.id,
    waMessageId: msg.key.id,
    direction: fromMe ? 'outbound' : 'inbound',
    contentType: messageContent.type,
    contentText: messageContent.text,
    contentMediaUrl: messageContent.mediaUrl,
    contentPayload: messageContent.payload,
    status: 'delivered',
    handledBy: fromMe ? 'human' : null,
    senderName: fromMe ? 'Tú' : pushName,
  });

  // Actualizar conversación
  await db.query(
    `UPDATE wa_conversations
     SET last_message_at = NOW(),
         last_message_preview = $1,
         unread_count = CASE WHEN $2 THEN unread_count + 1 ELSE unread_count END
     WHERE id = $3`,
    [
      (messageContent.text || `[${messageContent.type}]`).substring(0, 100),
      !fromMe,
      conversation.id,
    ]
  );

  // Emitir al frontend via Socket.IO
  if (io) {
    io.to(`tenant_${tenantId}`).emit('new_message', {
      conversation: {
        id: conversation.id,
        contactId: contact.id,
        contactName: contact.name || contact.push_name || contact.phone,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: (messageContent.text || `[${messageContent.type}]`).substring(0, 100),
        unreadCount: fromMe ? 0 : (conversation.unread_count || 0) + 1,
        handlingMode: conversation.handling_mode,
      },
      message: {
        id: savedMsg.id,
        conversationId: conversation.id,
        direction: fromMe ? 'outbound' : 'inbound',
        contentType: messageContent.type,
        contentText: messageContent.text,
        senderName: fromMe ? 'Tú' : pushName,
        createdAt: new Date().toISOString(),
        handledBy: fromMe ? 'human' : null,
      },
    });
  }

  // Si no es un mensaje propio y el modo es AI, enviar a auto-respuesta
  if (!fromMe && conversation.handling_mode === 'ai' && !isGroup) {
    try {
      const aiAgentService = require('./aiAgentService');
      await aiAgentService.handleAutoReply(tenantId, conversation.id, sock, remoteJid);
    } catch (err) {
      console.error('[WhatsApp] Error en auto-reply:', err);
    }
  }
};

/**
 * Extraer contenido del mensaje de Baileys
 */
const extractMessageContent = (msg) => {
  const m = msg.message;
  if (!m) return { type: 'text', text: null, mediaUrl: null, payload: null };

  if (m.conversation) {
    return { type: 'text', text: m.conversation, mediaUrl: null, payload: null };
  }
  if (m.extendedTextMessage?.text) {
    return { type: 'text', text: m.extendedTextMessage.text, mediaUrl: null, payload: null };
  }
  if (m.imageMessage) {
    return { type: 'image', text: m.imageMessage.caption || null, mediaUrl: null, payload: { mimetype: m.imageMessage.mimetype } };
  }
  if (m.videoMessage) {
    return { type: 'video', text: m.videoMessage.caption || null, mediaUrl: null, payload: { mimetype: m.videoMessage.mimetype } };
  }
  if (m.audioMessage) {
    return { type: 'audio', text: null, mediaUrl: null, payload: { mimetype: m.audioMessage.mimetype, ptt: m.audioMessage.ptt } };
  }
  if (m.documentMessage) {
    return { type: 'document', text: m.documentMessage.fileName || null, mediaUrl: null, payload: { mimetype: m.documentMessage.mimetype } };
  }
  if (m.locationMessage) {
    return {
      type: 'location',
      text: `${m.locationMessage.degreesLatitude}, ${m.locationMessage.degreesLongitude}`,
      mediaUrl: null,
      payload: { lat: m.locationMessage.degreesLatitude, lng: m.locationMessage.degreesLongitude },
    };
  }
  if (m.contactMessage) {
    return { type: 'text', text: `[Contacto: ${m.contactMessage.displayName}]`, mediaUrl: null, payload: null };
  }
  if (m.stickerMessage) {
    return { type: 'image', text: '[Sticker]', mediaUrl: null, payload: { sticker: true } };
  }

  return { type: 'text', text: '[Mensaje no soportado]', mediaUrl: null, payload: null };
};

/**
 * Obtener o crear contacto
 */
const getOrCreateContact = async (tenantId, waId, pushName, isGroup) => {
  const phone = waId.split('@')[0];

  const existing = await db.query(
    'SELECT * FROM wa_contacts WHERE tenant_id = $1 AND wa_id = $2',
    [tenantId, waId]
  );

  if (existing.rows.length > 0) {
    // Actualizar push_name si cambió
    if (pushName && pushName !== existing.rows[0].push_name) {
      await db.query(
        'UPDATE wa_contacts SET push_name = $1 WHERE id = $2',
        [pushName, existing.rows[0].id]
      );
    }
    return existing.rows[0];
  }

  const result = await db.query(
    `INSERT INTO wa_contacts (tenant_id, wa_id, name, push_name, phone, is_group)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, waId, pushName || phone, pushName, phone, isGroup]
  );

  return result.rows[0];
};

/**
 * Obtener o crear conversación
 */
const getOrCreateConversation = async (tenantId, contactId) => {
  const existing = await db.query(
    'SELECT * FROM wa_conversations WHERE tenant_id = $1 AND contact_id = $2 AND status != $3',
    [tenantId, contactId, 'archived']
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await db.query(
    `INSERT INTO wa_conversations (tenant_id, contact_id, status, handling_mode, last_message_at)
     VALUES ($1, $2, 'open', 'ai', NOW()) RETURNING *`,
    [tenantId, contactId]
  );

  return result.rows[0];
};

/**
 * Guardar mensaje en DB
 */
const saveMessage = async ({ conversationId, waMessageId, direction, contentType, contentText, contentMediaUrl, contentPayload, status, handledBy, senderName }) => {
  const result = await db.query(
    `INSERT INTO wa_messages (conversation_id, wa_message_id, direction, content_type, content_text, content_media_url, content_payload, status, handled_by, sender_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [conversationId, waMessageId, direction, contentType, contentText, contentMediaUrl, contentPayload ? JSON.stringify(contentPayload) : null, status, handledBy, senderName]
  );
  return result.rows[0];
};

/**
 * Enviar mensaje de texto
 */
const sendTextMessage = async (tenantId, remoteJid, text) => {
  const session = activeSessions.get(tenantId);
  if (!session || !session.sock) {
    throw new Error('No hay sesión activa de WhatsApp');
  }

  const result = await session.sock.sendMessage(remoteJid, { text });
  return result;
};

/**
 * Cerrar sesión
 */
const logoutSession = async (tenantId) => {
  const session = activeSessions.get(tenantId);
  if (session && session.sock) {
    try {
      await session.sock.logout();
    } catch (e) {
      // Puede fallar si ya estaba desconectado
    }
    if (session.safeEnd) session.safeEnd();
    else { try { session.sock.end(); } catch (e) {} }
  }

  const sessionId = `wa_${tenantId}`;
  await deleteSession(sessionId);
  activeSessions.delete(tenantId);

  if (io) {
    io.to(`tenant_${tenantId}`).emit('connection_status', { status: 'disconnected' });
  }

  return { status: 'disconnected' };
};

/**
 * Obtener estado de la sesión
 */
const getSessionStatus = async (tenantId) => {
  const session = activeSessions.get(tenantId);
  if (session && session.sock?.ws?.readyState === 1) {
    return { status: 'connected', phoneNumber: session.sock.user?.id?.split(':')[0] || '' };
  }

  // Revisar en DB
  const dbSession = await db.query(
    'SELECT status, phone_number FROM wa_sessions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1',
    [tenantId]
  );

  if (dbSession.rows.length > 0) {
    return { status: dbSession.rows[0].status, phoneNumber: dbSession.rows[0].phone_number };
  }

  return { status: 'disconnected', phoneNumber: null };
};

/**
 * Obtener grupos de WhatsApp
 */
const getGroups = async (tenantId) => {
  const session = activeSessions.get(tenantId);
  if (!session || !session.sock) {
    return [];
  }

  try {
    const groups = await session.sock.groupFetchAllParticipating();
    return Object.values(groups).map(g => ({
      id: g.id,
      subject: g.subject,
      participants: g.participants?.length || 0,
      creation: g.creation,
      desc: g.desc,
    }));
  } catch (err) {
    console.error('[WhatsApp] Error obteniendo grupos:', err);
    return [];
  }
};

/**
 * Obtener sock activo de un tenant (usado por aiAgentService)
 */
const getActiveSock = (tenantId) => {
  const session = activeSessions.get(tenantId);
  return session?.sock || null;
};

/**
 * Reconectar sesiones existentes al arrancar el servidor
 */
const reconnectSessions = async (ioNamespace) => {
  // Guardar referencia al IO
  io = ioNamespace;

  // Limpiar sesiones que quedaron en qr_pending (no tienen auth válido)
  await db.query("UPDATE wa_sessions SET status = 'disconnected' WHERE status = 'qr_pending'");

  const sessions = await db.query(
    "SELECT tenant_id, session_id FROM wa_sessions WHERE status = 'connected'"
  );

  if (sessions.rows.length === 0) {
    console.log('[WhatsApp] No hay sesiones para reconectar');
    return;
  }

  console.log(`[WhatsApp] Reconectando ${sessions.rows.length} sesión(es)...`);

  for (const session of sessions.rows) {
    try {
      await startSession(session.tenant_id);
      console.log(`[WhatsApp] Sesión reconectada para tenant ${session.tenant_id}`);
    } catch (err) {
      console.error(`[WhatsApp] Error reconectando tenant ${session.tenant_id}:`, err.message);
    }
  }
};

module.exports = {
  setIO,
  getIO,
  startSession,
  logoutSession,
  getSessionStatus,
  sendTextMessage,
  saveMessage,
  getOrCreateContact,
  getOrCreateConversation,
  getGroups,
  getActiveSock,
  reconnectSessions,
};
