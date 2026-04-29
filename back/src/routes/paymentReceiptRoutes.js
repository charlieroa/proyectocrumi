const express = require('express');
const router = express.Router();

const paymentReceiptController = require('../controllers/paymentReceiptController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, paymentReceiptController.getPaymentReceipts);
router.get('/:id', authMiddleware, paymentReceiptController.getPaymentReceiptById);
router.post('/', authMiddleware, paymentReceiptController.createPaymentReceipt);
router.put('/:id', authMiddleware, paymentReceiptController.updatePaymentReceipt);
router.patch('/:id/status', authMiddleware, paymentReceiptController.updatePaymentReceiptStatus);
router.delete('/:id', authMiddleware, paymentReceiptController.deletePaymentReceipt);

module.exports = router;
