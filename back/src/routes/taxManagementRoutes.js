const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/taxManagementController');

router.use(authMiddleware);

router.get('/configurations', ctrl.getTaxConfigurations);
router.post('/configurations', ctrl.createTaxConfiguration);
router.put('/configurations/:id', ctrl.updateTaxConfiguration);
router.delete('/configurations/:id', ctrl.deleteTaxConfiguration);
router.get('/summary', ctrl.getTaxSummary);
router.get('/calendar', ctrl.getTaxCalendar);
router.post('/calendar', ctrl.createTaxCalendarEvent);
router.post('/calendar/seed-dian', ctrl.seedDianCalendar);
router.post('/calendar/:id/filed', ctrl.markCalendarEventFiled);
router.get('/fiscal-year-closings', ctrl.getFiscalYearClosings);
router.post('/fiscal-year-close', ctrl.closeFiscalYear);

module.exports = router;
