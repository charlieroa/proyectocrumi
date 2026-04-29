// src/config/db.js

// Este archivo NO debe cargar dotenv. Esa es responsabilidad del punto de entrada (index.js).
const { Pool } = require('pg');

/**
 * CONFIGURACIÓN DE CONEXIÓN
 * Soporta DATABASE_URL o variables individuales
 */
const useConnStr = !!process.env.DATABASE_URL;
const useSSL =
  (process.env.PGSSL && process.env.PGSSL.toLowerCase() === 'true') ||
  (process.env.DATABASE_SSL && process.env.DATABASE_SSL.toLowerCase() === 'true');

const baseConfig = useConnStr
  ? {
    connectionString: process.env.DATABASE_URL,
  }
  : {
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: Number(process.env.PGPORT || 5432),
  };

// CREACIÓN DEL POOL
const pool = new Pool({
  ...baseConfig,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  // Opcionales para producción:
  // connectionTimeoutMillis: 10000,
  // idleTimeoutMillis: 30000,
});

// LOGS DE DIAGNÓSTICO AL INICIAR
(() => {
  const mode = useConnStr ? 'DATABASE_URL' : 'PG vars';
  const host = useConnStr ? '(in URL)' : baseConfig.host;
  const db = useConnStr ? '(in URL)' : baseConfig.database;
  const port = useConnStr ? '(in URL)' : baseConfig.port;
  // eslint-disable-next-line no-console
  console.log(`[DB] Modo=${mode} host=${host} db=${db} port=${port} ssl=${!!useSSL}`);
})();

// HELPER: Consulta simple
const query = (text, params) => pool.query(text, params);

// HELPER: Obtener cliente directo (necesario para transacciones manuales)
const getClient = () => pool.connect();

// HELPER: Health Check
const healthCheck = async () => {
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

// EXPORTACIÓN
// Exportamos 'pool' para que los controladores puedan hacer pool.connect()
module.exports = {
  pool,
  query,
  getClient,
  healthCheck
};