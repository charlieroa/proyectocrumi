// src/helpers/secretVault.js
// Cifrado simétrico reutilizable para secretos en BD (AES-256-GCM).
// Usa la MISMA clave maestra y empaquetado que aiCredentialsController, para
// mantener un único secreto de entorno (AI_CRED_ENCRYPTION_KEY) en el VPS.
// Empaquetado: iv(12) | authTag(16) | ciphertext  -> base64.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const getEncryptionKey = () => {
    const raw = process.env.AI_CRED_ENCRYPTION_KEY;
    if (raw && raw.length > 0) {
        if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
        return crypto.createHash('sha256').update(raw).digest();
    }
    console.warn('[secretVault] AI_CRED_ENCRYPTION_KEY no configurada — usando fallback inseguro (dev only).');
    return crypto.createHash('sha256').update('crumi-ai-cred-fallback-do-not-use-in-prod').digest();
};

const encrypt = (plaintext) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
};

const decrypt = (payload) => {
    const key = getEncryptionKey();
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.slice(0, IV_LENGTH);
    const authTag = buf.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt };
