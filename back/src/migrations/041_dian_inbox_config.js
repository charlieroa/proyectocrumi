// src/migrations/041_dian_inbox_config.js
// Configuración del buzón IMAP por tenant para la Bandeja DIAN (Fase 2).
// Una fila por tenant. La contraseña se guarda CIFRADA (AES-256-GCM, secretVault).

const dianInboxConfigSQL = `
CREATE TABLE IF NOT EXISTS dian_inbox_config (
    tenant_id           INTEGER PRIMARY KEY,
    enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    imap_host           VARCHAR(255),
    imap_port           INTEGER DEFAULT 993,
    imap_secure         BOOLEAN NOT NULL DEFAULT TRUE,
    imap_user           VARCHAR(255),
    imap_password_enc   TEXT,                 -- contraseña/app-password cifrada
    folder              VARCHAR(120) NOT NULL DEFAULT 'INBOX',
    last_uid            BIGINT DEFAULT 0,     -- último UID procesado en la carpeta
    last_poll_at        TIMESTAMPTZ,
    last_poll_status    VARCHAR(20),          -- OK | ERROR
    last_poll_error     TEXT,
    last_poll_summary   JSONB,                -- {received, causados, revision, errores, duplicados}
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
`;

module.exports = { dianInboxConfigSQL };
