// src/routes/pilaRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pilaController = require('../controllers/pilaController');

router.get('/submissions', authMiddleware, pilaController.getSubmissions);
router.post('/submissions', authMiddleware, pilaController.createSubmission);
router.get('/submissions/:id', authMiddleware, pilaController.getSubmissionById);

module.exports = router;
