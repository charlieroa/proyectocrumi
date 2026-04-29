// src/services/aiAgentService.js
// Agente IA para auto-respuesta en WhatsApp (Alejandro - Comercial)

const db = require('../config/db');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `Eres Alejandro, el asesor comercial de Crumi. Crumi es una plataforma de gestión empresarial con IA para empresas colombianas.

Tu personalidad:
- Amable, profesional y cercano
- Respondes en español colombiano natural
- Eres conciso pero informativo (máximo 2-3 párrafos)
- Usas emojis con moderación (1-2 por mensaje)

Lo que ofrece Crumi:
- Facturación electrónica DIAN (facturas, notas crédito/débito, cotizaciones, remisiones)
- Contabilidad automatizada (PUC, libro diario, mayor, balance, estados financieros)
- Nómina electrónica (cálculos, prestaciones, seguridad social, PILA)
- CRM y gestión de clientes
- Tablero Kanban para tareas
- 7 agentes de IA especializados (Comercial, Contador, Nómina, Auditor, Tributario, Legal, Asistente)

Reglas:
- Si te preguntan precios, indica que hay planes desde $49.900/mes y que pueden agendar una demo
- Si no puedes resolver algo, ofrece escalar a un agente humano
- No inventes información sobre funcionalidades que no existen
- Si la pregunta es muy técnica (contable, legal, tributaria), sugiere que en el dashboard de Crumi hay agentes especializados
- Mantén respuestas cortas y directas, esto es WhatsApp no un email

Si detectas que el usuario necesita hablar con un humano o está molesto, responde amablemente y escala.`;

/**
 * Manejar auto-respuesta para una conversación
 */
const handleAutoReply = async (tenantId, conversationId, sock, remoteJid) => {
  if (!OPENAI_API_KEY) {
    console.warn('[AI Agent] No hay OPENAI_API_KEY configurada, saltando auto-reply');
    return;
  }

  // Cargar últimos 20 mensajes de la conversación para contexto
  const messagesResult = await db.query(
    `SELECT direction, content_text, sender_name, created_at
     FROM wa_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [conversationId]
  );

  const history = messagesResult.rows.reverse();

  // Construir mensajes para OpenAI
  const openaiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  for (const msg of history) {
    if (!msg.content_text) continue;
    openaiMessages.push({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content_text,
    });
  }

  try {
    // Llamar a OpenAI
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const replyText = response.data?.choices?.[0]?.message?.content;

    if (!replyText) {
      console.warn('[AI Agent] Respuesta vacía de OpenAI');
      return;
    }

    // Detectar si necesita escalar a humano
    const shouldEscalate = detectEscalation(replyText, history);

    // Enviar respuesta por WhatsApp
    const sentMsg = await sock.sendMessage(remoteJid, { text: replyText });

    // Guardar respuesta en DB
    const whatsappService = require('./whatsappService');
    await whatsappService.saveMessage({
      conversationId,
      waMessageId: sentMsg.key.id,
      direction: 'outbound',
      contentType: 'text',
      contentText: replyText,
      contentMediaUrl: null,
      contentPayload: null,
      status: 'sent',
      handledBy: 'ai',
      senderName: 'Alejandro (IA)',
    });

    // Actualizar preview de la conversación
    await db.query(
      `UPDATE wa_conversations
       SET last_message_at = NOW(),
           last_message_preview = $1
       WHERE id = $2`,
      [replyText.substring(0, 100), conversationId]
    );

    // Emitir al frontend
    const io = whatsappService.getIO();
    if (io) {
      io.of('/whatsapp').to(`tenant_${tenantId}`).emit('new_message', {
        conversation: {
          id: conversationId,
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: replyText.substring(0, 100),
        },
        message: {
          id: sentMsg.key.id,
          conversationId,
          direction: 'outbound',
          contentType: 'text',
          contentText: replyText,
          senderName: 'Alejandro (IA)',
          createdAt: new Date().toISOString(),
          handledBy: 'ai',
        },
      });
    }

    // Si debe escalar, cambiar a modo humano
    if (shouldEscalate) {
      await db.query(
        `UPDATE wa_conversations SET handling_mode = 'human' WHERE id = $1`,
        [conversationId]
      );
      if (io) {
        io.of('/whatsapp').to(`tenant_${tenantId}`).emit('escalation', {
          conversationId,
          reason: 'El agente IA detectó que se necesita intervención humana',
        });
      }
    }

  } catch (err) {
    console.error('[AI Agent] Error en OpenAI call:', err.response?.data || err.message);
  }
};

/**
 * Detectar si la conversación necesita escalarse a un humano
 */
const detectEscalation = (replyText, history) => {
  const lowerReply = replyText.toLowerCase();
  const escalationPhrases = [
    'agente humano', 'hablar con un agente', 'persona real',
    'equipo de soporte', 'te comunico con', 'transferir',
  ];

  if (escalationPhrases.some(phrase => lowerReply.includes(phrase))) {
    return true;
  }

  // Si hay muchos mensajes sin resolver, escalar
  const inboundCount = history.filter(m => m.direction === 'inbound').length;
  if (inboundCount > 8) {
    return true;
  }

  return false;
};

module.exports = { handleAutoReply };
