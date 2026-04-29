// src/routes/approvalRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const approvalController = require('../controllers/approvalController');

router.get('/workflows', authMiddleware, approvalController.getWorkflows);
router.post('/workflows', authMiddleware, approvalController.createWorkflow);
router.get('/requests', authMiddleware, approvalController.getRequests);
router.get('/requests/my-pending', authMiddleware, approvalController.getMyPending);
router.post('/requests', authMiddleware, approvalController.createRequest);
router.post('/requests/:id/approve', authMiddleware, approvalController.approve);
router.post('/requests/:id/reject', authMiddleware, approvalController.reject);
router.get('/history', authMiddleware, approvalController.getHistory);

module.exports = router;
