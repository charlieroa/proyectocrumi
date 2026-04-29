// src/routes/exogenousRoutes.js
// Rutas del modulo de Informacion Exogena DIAN.

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
    getAvailableFormats,
    getFormat,
} = require('../controllers/exogenousController');

// Lista de formatos disponibles.
router.get('/available-formats', authMiddleware, getAvailableFormats);

// Datos JSON o exportacion (?format=csv|txt) de un formato especifico.
router.get('/format/:format', authMiddleware, getFormat);

// Atajo explicito de descarga (mismo handler, util si el cliente prefiere url separada).
router.get('/format/:format/download', authMiddleware, getFormat);

module.exports = router;
