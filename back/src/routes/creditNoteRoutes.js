const express = require('express');
const router = express.Router();

const creditNoteController = require('../controllers/creditNoteController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, creditNoteController.getCreditNotes);
router.get('/:id', authMiddleware, creditNoteController.getCreditNoteById);
router.post('/', authMiddleware, creditNoteController.createCreditNote);
router.post('/:id/resend-dian', authMiddleware, creditNoteController.resendToDian);
router.put('/:id', authMiddleware, creditNoteController.updateCreditNote);
router.patch('/:id/status', authMiddleware, creditNoteController.updateCreditNoteStatus);
router.delete('/:id', authMiddleware, creditNoteController.deleteCreditNote);

module.exports = router;
