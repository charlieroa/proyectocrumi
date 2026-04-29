// src/migrations/025_whatsapp_tables.js
// Tablas para el módulo de WhatsApp (Baileys)

const whatsappTablesSQL = `
-- =============================================
-- SESIONES WHATSAPP (auth state persistida)
-- =============================================
CREATE TABLE IF NOT EXISTS wa_sessions (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  creds JSONB,
  keys JSONB,
  status VARCHAR(20) DEFAULT 'disconnected',
  phone_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONTACTOS WHATSAPP
-- =============================================
CREATE TABLE IF NOT EXISTS wa_contacts (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  wa_id VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  push_name VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  is_group BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, wa_id)
);

-- =============================================
-- CONVERSACIONES
-- =============================================
CREATE TABLE IF NOT EXISTS wa_conversations (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  contact_id INT REFERENCES wa_contacts(id),
  status VARCHAR(20) DEFAULT 'open',
  handling_mode VARCHAR(10) DEFAULT 'ai',
  assigned_to INT,
  unread_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MENSAJES
-- =============================================
CREATE TABLE IF NOT EXISTS wa_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES wa_conversations(id),
  wa_message_id VARCHAR(255),
  direction VARCHAR(10) NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text',
  content_text TEXT,
  content_media_url TEXT,
  content_payload JSONB,
  status VARCHAR(20) DEFAULT 'sent',
  handled_by VARCHAR(10),
  sender_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_wa_messages_conv ON wa_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_tenant ON wa_conversations(tenant_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_tenant ON wa_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_tenant ON wa_sessions(tenant_id);
`;

module.exports = { whatsappTablesSQL };
