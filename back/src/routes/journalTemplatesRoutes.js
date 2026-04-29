const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/journalTemplatesController');

router.get('/journal-templates', authMiddleware, ctrl.listTemplates);
router.get('/journal-templates/:id', authMiddleware, ctrl.getTemplate);
router.post('/journal-templates', authMiddleware, ctrl.createTemplate);
router.put('/journal-templates/:id', authMiddleware, ctrl.updateTemplate);
router.delete('/journal-templates/:id', authMiddleware, ctrl.deleteTemplate);
router.post('/journal-templates/:id/apply', authMiddleware, ctrl.applyTemplate);

module.exports = router;
