const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const kardex = require('../controllers/kardexController');

router.get('/', authMiddleware, kardex.getKardex);
router.get('/summary', authMiddleware, kardex.getSummary);
router.post('/movement', authMiddleware, kardex.recordMovement);
router.post('/record-movement', authMiddleware, kardex.recordMovement);
router.post('/physical-count', authMiddleware, kardex.physicalCount);

module.exports = router;
