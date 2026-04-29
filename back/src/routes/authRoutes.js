const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('../config/passport-google');
const requireAuth = require('../middleware/authMiddleware');

// Ruta para iniciar sesión (ya la teníamos)
router.post('/login', authController.login);

// Cambiar de empresa (Contador / Super Admin)
router.post('/switch-tenant', requireAuth, authController.switchTenant);

// NUEVA RUTA para que un dueño de peluquería se registre
router.post('/register-tenant', authController.registerTenantAndAdmin);

// Registro público de Contador (desde landing / sección Contador)
router.post('/register-contador', authController.registerContador);

// ========== RUTAS DE GOOGLE OAUTH ==========
// Iniciar autenticación con Google
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false
    })
);

// Callback de Google OAuth
router.get('/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
    }),
    (req, res) => {
        // Si llega aquí, la autenticación fue exitosa
        const { token } = req.user;

        // Redirigir al frontend con el token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        // Usamos una ruta específica en el frontend para procesar el token
        res.redirect(`${frontendUrl}/auth-google-callback?token=${token}`);
    }
);

module.exports = router;