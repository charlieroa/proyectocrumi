const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ctrl = require('../controllers/quoteExtController');

router.use(authMiddleware);

router.get('/', ctrl.getQuotes);
router.get('/:id', ctrl.getQuoteById);
router.put('/:id', ctrl.updateQuote);
router.delete('/:id', ctrl.deleteQuote);
router.patch('/:id/status', ctrl.updateQuoteStatus);
router.post('/:id/convert-to-invoice', ctrl.convertToInvoice);

module.exports = router;
