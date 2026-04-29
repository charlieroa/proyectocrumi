// src/routes/complianceRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const complianceController = require('../controllers/complianceController');

// =============================================
// DASHBOARD
// =============================================
router.get('/dashboard', authMiddleware, complianceController.getDashboard);

// =============================================
// OBLIGATIONS
// =============================================
router.get('/obligations', authMiddleware, complianceController.getObligations);
router.post('/obligations', authMiddleware, complianceController.createObligation);

// =============================================
// FILINGS
// =============================================
router.get('/filings', authMiddleware, complianceController.getFilings);
router.post('/filings', authMiddleware, complianceController.createFiling);
router.post('/filings/:id/mark-filed', authMiddleware, complianceController.markFiled);

// =============================================
// RISKS
// =============================================
router.get('/risks', authMiddleware, complianceController.getRisks);
router.post('/risks', authMiddleware, complianceController.createRisk);
router.put('/risks/:id', authMiddleware, complianceController.updateRisk);

module.exports = router;
