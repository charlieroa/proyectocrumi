// src/routes/whatsappRoutes.js
// Rutas REST para WhatsApp

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const whatsappController = require('../controllers/whatsappController');

// Sesión
router.post('/session/start', authMiddleware, whatsappController.startSession);
router.post('/session/logout', authMiddleware, whatsappController.logoutSession);
router.get('/session/status', authMiddleware, whatsappController.getSessionStatus);

// Conversaciones
router.get('/conversations', authMiddleware, whatsappController.getConversations);
router.get('/conversations/:id/messages', authMiddleware, whatsappController.getMessages);
router.patch('/conversations/:id', authMiddleware, whatsappController.updateConversation);

// Mensajes
router.post('/send', authMiddleware, whatsappController.sendMessage);

// Grupos
router.get('/groups', authMiddleware, whatsappController.getGroups);

module.exports = router;
