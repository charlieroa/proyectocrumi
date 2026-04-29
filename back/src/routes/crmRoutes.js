const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/crmController');

router.use(authMiddleware);

router.get('/dashboard', ctrl.getDashboard);
router.get('/leads', ctrl.getLeads);
router.get('/leads/:id', ctrl.getLeadById);
router.post('/leads', ctrl.createLead);
router.put('/leads/:id', ctrl.updateLead);
router.delete('/leads/:id', ctrl.deleteLead);
router.patch('/leads/:id/stage', ctrl.updateLeadStage);
router.post('/leads/:id/convert', ctrl.convertLeadToClient);
router.get('/pipeline-stages', ctrl.getPipelineStages);
router.post('/pipeline-stages', ctrl.createPipelineStage);
router.get('/activities', ctrl.getActivities);
router.post('/activities', ctrl.createActivity);

module.exports = router;
