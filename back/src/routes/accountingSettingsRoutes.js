const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controllers/accountingSettingsController');

router.use(authMiddleware);

router.get('/settings', controller.getAccountingSettings);
router.put('/settings', controller.updateAccountingSettings);
router.get('/settings/report-header', controller.getReportHeader);

router.get('/document-configs', controller.getDocumentConfigs);
router.post('/document-configs', controller.upsertDocumentConfig);
router.put('/document-configs', controller.upsertDocumentConfig);

router.get('/banks', controller.getBanks);
router.post('/banks', controller.upsertBank);
router.put('/banks', controller.upsertBank);
router.delete('/banks/:id', controller.deleteBank);

router.get('/cost-centers', controller.getCostCenters);
router.post('/cost-centers', controller.upsertCostCenter);
router.put('/cost-centers', controller.upsertCostCenter);

module.exports = router;
