// src/services/whatsappAuthStore.js
// Persistir Baileys auth state en PostgreSQL

const db = require('../config/db');
const { proto } = require('@whiskeysockets/baileys');
const { BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

/**
 * Crea un auth state store persistido en PostgreSQL
 * Compatible con Baileys useMultiFileAuthState interface
 */
const usePostgresAuthState = async (sessionId) => {
  // Intentar cargar creds existentes
  const existing = await db.query(
    'SELECT creds, keys FROM wa_sessions WHERE session_id = $1',
    [sessionId]
  );

  let creds;
  let keys = {};

  if (existing.rows.length > 0 && existing.rows[0].creds) {
    creds = JSON.parse(JSON.stringify(existing.rows[0].creds), BufferJSON.reviver);
    keys = existing.rows[0].keys || {};
  } else {
    creds = initAuthCreds();
  }

  const saveCreds = async () => {
    const credsJson = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    await db.query(
      `INSERT INTO wa_sessions (session_id, creds, keys, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET creds = $2, keys = $3, updated_at = NOW()`,
      [sessionId, credsJson, keys]
    );
  };

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          for (const id of ids) {
            const key = `${type}-${id}`;
            if (keys[key]) {
              let value = keys[key];
              // Deserialize proto messages
              if (type === 'app-state-sync-key') {
                try {
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                } catch (e) { /* ignore parse errors */ }
              }
              data[id] = value;
            }
          }
          return data;
        },
        set: async (data) => {
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const value = data[category][id];
              if (value) {
                keys[key] = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
              } else {
                delete keys[key];
              }
            }
          }
          // Persist keys to DB
          await db.query(
            `UPDATE wa_sessions SET keys = $1, updated_at = NOW() WHERE session_id = $2`,
            [keys, sessionId]
          );
        },
      },
    },
    saveCreds,
  };
};

/**
 * Eliminar sesión de la DB
 */
const deleteSession = async (sessionId) => {
  await db.query('DELETE FROM wa_sessions WHERE session_id = $1', [sessionId]);
};

/**
 * Actualizar estado de sesión
 */
const updateSessionStatus = async (sessionId, status, phoneNumber = null) => {
  const params = [status, sessionId];
  let sql = 'UPDATE wa_sessions SET status = $1, updated_at = NOW() WHERE session_id = $2';
  if (phoneNumber) {
    sql = 'UPDATE wa_sessions SET status = $1, phone_number = $3, updated_at = NOW() WHERE session_id = $2';
    params.push(phoneNumber);
  }
  await db.query(sql, params);
};

/**
 * Obtener sesión por tenant_id
 */
const getSessionByTenant = async (tenantId) => {
  const result = await db.query(
    'SELECT * FROM wa_sessions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1',
    [tenantId]
  );
  return result.rows[0] || null;
};

/**
 * Crear registro de sesión para un tenant
 */
const createSessionRecord = async (tenantId, sessionId) => {
  await db.query(
    `INSERT INTO wa_sessions (tenant_id, session_id, status)
     VALUES ($1, $2, 'qr_pending')
     ON CONFLICT (session_id) DO UPDATE SET status = 'qr_pending', updated_at = NOW()`,
    [tenantId, sessionId]
  );
};

module.exports = {
  usePostgresAuthState,
  deleteSession,
  updateSessionStatus,
  getSessionByTenant,
  createSessionRecord,
};
