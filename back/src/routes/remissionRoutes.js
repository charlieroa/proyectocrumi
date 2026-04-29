// =============================================
// Rutas: src/routes/remissionRoutes.js
// Endpoints de Remisiones
// =============================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
    getRemissions,
    getRemissionById,
    createRemission,
    updateRemission,
    updateRemissionStatus,
    convertToInvoice,
    deleteRemission
} = require('../controllers/remissionController'); // ✅ CORREGIDO: minúscula

// =============================================
// RUTAS PROTEGIDAS CON AUTENTICACIÓN
// =============================================

// GET /api/remissions - Listar todas las remisiones
router.get('/', authMiddleware, getRemissions);

// GET /api/remissions/:id - Obtener una remisión por ID
router.get('/:id', authMiddleware, getRemissionById);

// POST /api/remissions - Crear nueva remisión
router.post('/', authMiddleware, createRemission);

// PUT /api/remissions/:id - Actualizar remisión completa
router.put('/:id', authMiddleware, updateRemission);

// PATCH /api/remissions/:id/status - Cambiar solo el estado
router.patch('/:id/status', authMiddleware, updateRemissionStatus);

// POST /api/remissions/:id/convert-to-invoice - Convertir a factura
router.post('/:id/convert-to-invoice', authMiddleware, convertToInvoice);

// DELETE /api/remissions/:id - Eliminar remisión
router.delete('/:id', authMiddleware, deleteRemission);

module.exports = router;