// src/routes/contractRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const contractController = require('../controllers/contractController');

// =============================================
// DASHBOARD
// =============================================
router.get('/dashboard', authMiddleware, contractController.getDashboard);

// =============================================
// CONTRACTS
// =============================================
router.get('/contracts', authMiddleware, contractController.getContracts);
router.post('/contracts', authMiddleware, contractController.createContract);
router.get('/contracts/:id', authMiddleware, contractController.getContractById);
router.put('/contracts/:id', authMiddleware, contractController.updateContract);
router.delete('/contracts/:id', authMiddleware, contractController.deleteContract);

// =============================================
// AMENDMENTS
// =============================================
router.get('/contracts/:id/amendments', authMiddleware, contractController.getAmendments);
router.post('/contracts/:id/amendments', authMiddleware, contractController.createAmendment);

// =============================================
// ALERTS
// =============================================
router.get('/alerts', authMiddleware, contractController.getAlerts);
router.post('/alerts/:id', authMiddleware, contractController.createAlert);

module.exports = router;
