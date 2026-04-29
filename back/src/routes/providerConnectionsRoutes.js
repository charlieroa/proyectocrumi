// src/routes/providerConnectionsRoutes.js
// Rutas para el modulo de Conexiones Externas

const express = require('express');
const router = express.Router();
const providerConnectionsController = require('../controllers/providerConnectionsController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/dashboard', authMiddleware, providerConnectionsController.getDashboard);
router.get('/logs', authMiddleware, providerConnectionsController.getSyncLogs);
router.get('/', authMiddleware, providerConnectionsController.getConnections);
router.get('/:id', authMiddleware, providerConnectionsController.getConnectionById);
router.get('/:id/sync-history', authMiddleware, providerConnectionsController.getSyncHistory);
router.delete('/:id', authMiddleware, providerConnectionsController.deleteConnection);
router.post('/:id/test', authMiddleware, providerConnectionsController.testConnection);

module.exports = router;
