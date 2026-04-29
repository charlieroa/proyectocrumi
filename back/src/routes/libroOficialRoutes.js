// src/routes/libroOficialRoutes.js
// Rutas de los Libros Oficiales DIAN (Compras, Ventas, Inventarios y Balance).

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/libroOficialController');

router.use(authMiddleware);

router.get('/libro-oficial/compras', ctrl.getLibroCompras);
router.get('/libro-oficial/ventas', ctrl.getLibroVentas);
router.get('/libro-oficial/inventarios-balance', ctrl.getLibroInventariosYBalance);

module.exports = router;
