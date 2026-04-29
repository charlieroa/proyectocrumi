const express = require('express');
const router = express.Router();
const columnController = require('../controllers/columnController');
const requireAuth = require('../middleware/authMiddleware');

// Middleware to ensure authentication
router.use(requireAuth);

router.get('/', columnController.getColumns);
router.post('/', columnController.createColumn);
router.put('/:id', columnController.updateColumn);
router.delete('/:id', columnController.deleteColumn);

module.exports = router;
