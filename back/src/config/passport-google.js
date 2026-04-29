const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Configurar estrategia de Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const googleId = profile.id;
            const displayName = profile.displayName;
            const firstName = profile.name?.givenName || '';
            const lastName = profile.name?.familyName || '';

            // Buscar usuario por email
            let userResult = await db.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
            );

            let user;

            if (userResult.rows.length === 0) {
                // Usuario no existe, crear nuevo usuario y tenant
                // 1. Crear tenant
                const tenantResult = await db.query(
                    `INSERT INTO tenants (name, slug) 
           VALUES ($1, $2) 
           RETURNING id`,
                    [displayName || 'Mi Empresa', `tenant-${Date.now()}`]
                );

                const tenantId = tenantResult.rows[0].id;

                // 2. Crear usuario con role_id = 1 (Admin)
                const newUserResult = await db.query(
                    `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, google_id, role_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, tenant_id, email, first_name, last_name, role_id, google_id`,
                    [tenantId, email, 'GOOGLE_AUTH', firstName, lastName, googleId, 1]
                );

                user = newUserResult.rows[0];
            } else {
                user = userResult.rows[0];

                // Actualizar google_id si no existe
                if (!user.google_id) {
                    await db.query(
                        'UPDATE users SET google_id = $1 WHERE id = $2',
                        [googleId, user.id]
                    );
                    user.google_id = googleId;
                }
            }

            // Generar JWT token
            const token = jwt.sign(
                {
                    user: {
                        id: user.id,
                        email: user.email,
                        tenant_id: user.tenant_id,
                        role_id: user.role_id
                    }
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            return done(null, { user, token });
        } catch (error) {
            console.error('Error en autenticación Google:', error);
            return done(error, null);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

module.exports = passport;
