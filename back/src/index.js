// =============================================
// Archivo Principal de la API: src/index.js
// =============================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server: SocketIOServer } = require('socket.io');

// Configuración de la base de datos
const db = require('./config/db');

// Migraciones automáticas
const { runMigrations } = require('./migrations/runMigrations');

// --- IMPORTACIÓN DE RUTAS ---
const tenantRoutes = require('./routes/tenantRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const productRoutes = require('./routes/productRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const stylistRoutes = require('./routes/stylistRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const authRoutes = require('./routes/authRoutes');
const cashRoutes = require('./routes/cashRoutes');
const productCategoryRoutes = require('./routes/productCategoryRoutes');
const staffPurchaseRoutes = require('./routes/staffPurchaseRoutes');
const staffLoanRoutes = require('./routes/staffLoanRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const remissionRoutes = require('./routes/remissionRoutes'); // ✅ Remisiones

// ✅ NUEVOS: Notas Débito / Notas Crédito / Recibos de Pago
const debitNoteRoutes = require('./routes/debitNoteRoutes');
const creditNoteRoutes = require('./routes/creditNoteRoutes');
const paymentReceiptRoutes = require('./routes/paymentReceiptRoutes');

// DIAN directo (XML/SOAP/firma) - desactivado, ahora se usa Aliaddo
// const dianRoutes = require('./routes/dianRoutes');

// ✅ INTEGRACIÓN ALIADDO API (Proveedor Electrónico)
const aliaddoRoutes = require('./routes/aliaddoRoutes');
const alegraRoutes = require('./routes/alegraRoutes');
const kpiRoutes = require('./routes/kpiRoutes');

// ✅ Módulo de Contabilidad
const accountingRoutes = require('./routes/accountingRoutes');
const accountingSettingsRoutes = require('./routes/accountingSettingsRoutes');

// Módulo de Impuestos y Cierres
const taxManagementRoutes = require('./routes/taxManagementRoutes');

// Módulo de Nómina
const nominaRoutes = require('./routes/nominaRoutes');

// Módulos Base y Legal
const approvalRoutes = require('./routes/approvalRoutes');
const auditCoreRoutes = require('./routes/auditCoreRoutes');
const contractRoutes = require('./routes/contractRoutes');
const complianceRoutes = require('./routes/complianceRoutes');

// Modulo CRM
const crmRoutes = require('./routes/crmRoutes');

// WhatsApp (Baileys)
const whatsappRoutes = require('./routes/whatsappRoutes');

// IA Contable (Automatización inteligente)
const aiAccountingRoutes = require('./routes/aiAccountingRoutes');

const { uploadTenantLogo } = require('./controllers/tenantController');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;


/* =======================================
    🛡️ CONFIGURACIÓN DE CORS
======================================= */
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:4173',
  'http://localhost:4174',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'https://crumi.ai',
  'https://www.crumi.ai',
  'https://app.tupelukeria.com',
  'https://tpia.tupelukeria.com',
  'https://bolti.co',
  'https://www.bolti.co',
];

const isLocalDevOrigin = (origin) => {
  if (!origin) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
};

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política de CORS.'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));


/* =======================================
    🔌 SOCKET.IO (WhatsApp real-time)
======================================= */
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Namespace /whatsapp for WhatsApp events
const waNamespace = io.of('/whatsapp');
waNamespace.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('join_tenant', (tenantId) => {
    socket.join(`tenant_${tenantId}`);
    console.log(`[Socket.IO] Client ${socket.id} joined tenant_${tenantId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Store io instance on app for controllers to access
app.set('io', waNamespace);


/* =======================================
    🚀 MIDDLEWARES ESENCIALES
======================================= */
app.use(express.json());


/* =======================================
    🗂️ SERVICIO DE ARCHIVOS ESTÁTICOS Y DIRECTORIOS
======================================= */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
const XMLS_DIR = path.join(UPLOADS_DIR, 'xmls');

fs.mkdirSync(LOGOS_DIR, { recursive: true });
fs.mkdirSync(XMLS_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));


/* =======================================
    ⬆️ CONFIGURACIÓN DE SUBIDA DE ARCHIVOS (MULTER)
======================================= */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `logo-${req.params.tenantId}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });


/* =======================================
    📡 RUTAS DE LA APLICACIÓN
======================================= */
app.get('/', (_req, res) => res.send('¡API de TuPelukeria.com funcionando!'));

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payrolls', payrollRoutes);
app.use('/api/stylists', stylistRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/product-categories', productCategoryRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/staff-purchases', staffPurchaseRoutes);
app.use('/api/staff-loans', staffLoanRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/quotes-ext', require('./routes/quoteExtRoutes'));
app.use('/api/remissions', remissionRoutes);
app.use('/api/tasks', require('./routes/taskRoutes')); // ✅ Rutas de Tareas (Kanban)

// ✅ Nuevas rutas de documentos contables
app.use('/api/debit-notes', debitNoteRoutes);
app.use('/api/credit-notes', creditNoteRoutes);
app.use('/api/payment-receipts', paymentReceiptRoutes);

// DIAN directo (XML/SOAP/firma) - desactivado, ahora se usa Aliaddo
// app.use('/api/dian', dianRoutes);

// ✅ Integración Aliaddo API (Proveedor Electrónico)
app.use('/api/aliaddo', aliaddoRoutes);
app.use('/api/alegra', alegraRoutes);
app.use('/api/kpis', kpiRoutes);

// ✅ Módulo de Contabilidad
app.use('/api/accounting', accountingRoutes);
app.use('/api/accounting', accountingSettingsRoutes);
app.use('/api/accounting', require('./routes/libroOficialRoutes'));
app.use('/api/accounting', require('./routes/pygFuncionRoutes'));
app.use('/api/accounting/exogenous', require('./routes/exogenousRoutes'));
app.use('/api/kardex', require('./routes/kardexRoutes'));
app.use('/api/fixed-assets', require('./routes/fixedAssetsRoutes'));
app.use('/api/journal-templates', require('./routes/journalTemplatesRoutes'));

// Módulo de Impuestos y Cierres
app.use('/api/taxes', taxManagementRoutes);

// Módulo de Nómina
app.use('/api/nomina', nominaRoutes);

// Módulos Base y Legal
app.use('/api/aprobaciones', approvalRoutes);
app.use('/api/auditoria', auditCoreRoutes);
app.use('/api/contratos', contractRoutes);
app.use('/api/cumplimiento', complianceRoutes);

// Modulo CRM
app.use('/api/crm', crmRoutes);

// WhatsApp (Baileys + Socket.IO)
app.use('/api/whatsapp', whatsappRoutes);

// IA Contable (Automatización inteligente)
app.use('/api/ai-accounting', aiAccountingRoutes);

// Ruta específica para la subida del logo
app.post('/api/tenants/:tenantId/logo', upload.single('logo'), uploadTenantLogo);

app.use('/api/columns', require('./routes/columnRoutes'));

// Modulo de Conexiones Externas
app.use('/api/connections', require('./routes/providerConnectionsRoutes'));


/* =======================================
    ❤️ HEALTHCHECK
======================================= */
app.get(['/health', '/api/health'], async (_req, res) => {
  try {
    await db.healthCheck();
    res.status(200).json({ status: 'ok', app: 'up', db: 'up' });
  } catch (e) {
    res.status(503).json({ status: 'error', app: 'up', db: 'down', error: e.message });
  }
});


/* =======================================
    🧯 MANEJO DE ERRORES
======================================= */
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.stack}`);
  if (err.message === 'No permitido por la política de CORS.') {
    return res.status(403).json({ error: 'Acceso denegado por CORS.' });
  }
  res.status(500).json({ error: 'Ocurrió un error inesperado en el servidor.' });
});


/* =======================================
    ▶️ INICIO DEL SERVIDOR
======================================= */
// Ejecutar migraciones y luego iniciar servidor
runMigrations().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    // Reconnect existing WhatsApp sessions
    const whatsappService = require('./services/whatsappService');
    whatsappService.reconnectSessions(waNamespace).catch(err => {
      console.error('[WhatsApp] Error reconnecting sessions:', err.message);
    });
  });
}).catch(err => {
  console.error('❌ Error en migraciones:', err);
  // Iniciar servidor de todos modos
  server.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT} (con advertencias de migración)`);
  });
});
