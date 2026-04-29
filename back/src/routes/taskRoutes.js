const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken); // Ensure all routes are protected

router.post('/', taskController.createTask);
router.get('/user/:userId', taskController.getTasksByUser);
router.get('/users', taskController.getUsersForAssignment);
router.get('/', taskController.getTasks);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Checklist endpoints
router.post('/:taskId/checklist', taskController.addChecklistItem);
router.patch('/checklist/:itemId/toggle', taskController.toggleChecklistItem);
router.delete('/checklist/:itemId', taskController.deleteChecklistItem);

module.exports = router;
