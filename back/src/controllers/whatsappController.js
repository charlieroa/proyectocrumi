// src/controllers/whatsappController.js
// Controlador REST para WhatsApp

const db = require('../config/db');
const whatsappService = require('../services/whatsappService');

/**
 * POST /api/whatsapp/session/start
 * Inicia sesión de WhatsApp, genera QR
 */
const startSession = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await whatsappService.startSession(tenantId);
    res.json(result);
  } catch (err) {
    console.error('[WA Controller] Error iniciando sesión:', err);
    res.status(500).json({ error: 'Error iniciando sesión de WhatsApp' });
  }
};

/**
 * POST /api/whatsapp/session/logout
 * Cierra sesión de WhatsApp
 */
const logoutSession = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await whatsappService.logoutSession(tenantId);
    res.json(result);
  } catch (err) {
    console.error('[WA Controller] Error cerrando sesión:', err);
    res.status(500).json({ error: 'Error cerrando sesión de WhatsApp' });
  }
};

/**
 * GET /api/whatsapp/session/status
 * Estado de conexión
 */
const getSessionStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const result = await whatsappService.getSessionStatus(tenantId);
    res.json(result);
  } catch (err) {
    console.error('[WA Controller] Error obteniendo estado:', err);
    res.status(500).json({ error: 'Error obteniendo estado de sesión' });
  }
};

/**
 * GET /api/whatsapp/conversations
 * Lista de conversaciones paginada
 */
const getConversations = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'open';

    const result = await db.query(
      `SELECT c.*, ct.name as contact_name, ct.push_name, ct.phone, ct.wa_id, ct.is_group, ct.avatar_url
       FROM wa_conversations c
       JOIN wa_contacts ct ON c.contact_id = ct.id
       WHERE c.tenant_id = $1 AND c.status = $2
       ORDER BY c.last_message_at DESC NULLS LAST
       LIMIT $3 OFFSET $4`,
      [tenantId, status, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM wa_conversations WHERE tenant_id = $1 AND status = $2',
      [tenantId, status]
    );

    res.json({
      conversations: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('[WA Controller] Error obteniendo conversaciones:', err);
    res.status(500).json({ error: 'Error obteniendo conversaciones' });
  }
};

/**
 * GET /api/whatsapp/conversations/:id/messages
 * Mensajes de una conversación
 */
const getMessages = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const conversationId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Verificar que la conversación pertenece al tenant
    const convCheck = await db.query(
      'SELECT id FROM wa_conversations WHERE id = $1 AND tenant_id = $2',
      [conversationId, tenantId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const result = await db.query(
      `SELECT * FROM wa_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    // Marcar como leídos
    await db.query(
      'UPDATE wa_conversations SET unread_count = 0 WHERE id = $1',
      [conversationId]
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('[WA Controller] Error obteniendo mensajes:', err);
    res.status(500).json({ error: 'Error obteniendo mensajes' });
  }
};

/**
 * POST /api/whatsapp/send
 * Enviar mensaje (texto)
 */
const sendMessage = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { conversationId, text } = req.body;

    if (!conversationId || !text) {
      return res.status(400).json({ error: 'conversationId y text son requeridos' });
    }

    // Obtener conversación y contacto
    const convResult = await db.query(
      `SELECT c.*, ct.wa_id
       FROM wa_conversations c
       JOIN wa_contacts ct ON c.contact_id = ct.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [conversationId, tenantId]
    );

    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const conv = convResult.rows[0];

    // Enviar via Baileys
    const sentResult = await whatsappService.sendTextMessage(tenantId, conv.wa_id, text);

    // Guardar en DB
    const savedMsg = await whatsappService.saveMessage({
      conversationId: conv.id,
      waMessageId: sentResult.key.id,
      direction: 'outbound',
      contentType: 'text',
      contentText: text,
      contentMediaUrl: null,
      contentPayload: null,
      status: 'sent',
      handledBy: 'human',
      senderName: 'Agente',
    });

    // Actualizar conversación
    await db.query(
      `UPDATE wa_conversations
       SET last_message_at = NOW(),
           last_message_preview = $1,
           handling_mode = 'human'
       WHERE id = $2`,
      [text.substring(0, 100), conv.id]
    );

    res.json({ message: savedMsg });
  } catch (err) {
    console.error('[WA Controller] Error enviando mensaje:', err);
    res.status(500).json({ error: err.message || 'Error enviando mensaje' });
  }
};

/**
 * GET /api/whatsapp/groups
 * Lista de grupos
 */
const getGroups = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const groups = await whatsappService.getGroups(tenantId);
    res.json({ groups });
  } catch (err) {
    console.error('[WA Controller] Error obteniendo grupos:', err);
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
};

/**
 * PATCH /api/whatsapp/conversations/:id
 * Cambiar handling_mode, assigned_to, status
 */
const updateConversation = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const conversationId = req.params.id;
    const { handlingMode, handling_mode, assignedTo, assigned_to, status } = req.body;
    const effectiveHandlingMode = handlingMode || handling_mode;
    const effectiveAssignedTo = assignedTo !== undefined ? assignedTo : assigned_to;

    // Verificar pertenencia
    const convCheck = await db.query(
      'SELECT id FROM wa_conversations WHERE id = $1 AND tenant_id = $2',
      [conversationId, tenantId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (effectiveHandlingMode) {
      paramCount++;
      updates.push(`handling_mode = $${paramCount}`);
      values.push(effectiveHandlingMode);
    }
    if (effectiveAssignedTo !== undefined) {
      paramCount++;
      updates.push(`assigned_to = $${paramCount}`);
      values.push(effectiveAssignedTo);
    }
    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    paramCount++;
    values.push(conversationId);

    await db.query(
      `UPDATE wa_conversations SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[WA Controller] Error actualizando conversación:', err);
    res.status(500).json({ error: 'Error actualizando conversación' });
  }
};

module.exports = {
  startSession,
  logoutSession,
  getSessionStatus,
  getConversations,
  getMessages,
  sendMessage,
  getGroups,
  updateConversation,
};
