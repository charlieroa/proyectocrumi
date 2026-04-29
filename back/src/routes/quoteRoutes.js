// src/routes/quoteRoutes.js
const express = require('express');
const router = express.Router();
const { createQuote, getQuotes } = require('../controllers/quoteController');
const authMiddleware = require('../middleware/authMiddleware'); // ✅ CORREGIDO

// =========================================================
/** CRUD de Cotizaciones */
// =========================================================

// POST /api/quotes - Crear una nueva cotización
router.post('/', authMiddleware, createQuote);

// GET /api/quotes - Obtener todas las cotizaciones del tenant
router.get('/', authMiddleware, getQuotes);

module.exports = router;