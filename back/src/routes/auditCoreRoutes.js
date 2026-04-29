// src/routes/auditCoreRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const auditCoreController = require('../controllers/auditCoreController');

router.get('/events', authMiddleware, auditCoreController.getEvents);
router.get('/summary', authMiddleware, auditCoreController.getSummary);
router.get('/timeline/:entityType/:entityId', authMiddleware, auditCoreController.getTimeline);
router.post('/events', authMiddleware, auditCoreController.createEvent);

module.exports = router;
