const express = require('express');
const router = express.Router();

const debitNoteController = require('../controllers/debitNoteController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, debitNoteController.getDebitNotes);
router.get('/:id', authMiddleware, debitNoteController.getDebitNoteById);
router.post('/', authMiddleware, debitNoteController.createDebitNote);
router.post('/:id/resend-dian', authMiddleware, debitNoteController.resendToDian);
router.put('/:id', authMiddleware, debitNoteController.updateDebitNote);
router.patch('/:id/status', authMiddleware, debitNoteController.updateDebitNoteStatus);
router.delete('/:id', authMiddleware, debitNoteController.deleteDebitNote);

module.exports = router;
