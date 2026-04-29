// Contenido COMPLETO y CORREGIDO para: src/controllers/authController.js

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const slugify = require('slugify');

// --- Función para Iniciar Sesión (VERSIÓN MEJORADA Y COMPLETA) ---
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Por favor, ingrese email y contraseña.' });
    }

    try {
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // --- INICIO DE LA LÓGICA DE VERIFICACIÓN AVANZADA ---
        let isSetupComplete = false;
        if (user.tenant_id) {
            // 1. Obtenemos los datos del Tenant (básicos y horarios)
            const tenantResult = await db.query(
                'SELECT name, address, phone, working_hours FROM tenants WHERE id = $1',
                [user.tenant_id]
            );
            
            // 2. Obtenemos el conteo de servicios y de personal (estilistas)
            const servicesCountResult = await db.query('SELECT COUNT(id) FROM services WHERE tenant_id = $1', [user.tenant_id]);
            const staffCountResult = await db.query("SELECT COUNT(id) FROM users WHERE tenant_id = $1 AND role_id = 3", [user.tenant_id]);

            if (tenantResult.rows.length > 0) {
                const tenant = tenantResult.rows[0];
                const servicesCount = parseInt(servicesCountResult.rows[0].count, 10);
                const staffCount = parseInt(staffCountResult.rows[0].count, 10);

                // Verificación de datos básicos (ignorando espacios en blanco)
                const hasBasicInfo = !!(tenant.name?.trim() && tenant.address?.trim() && tenant.phone?.trim());
                
                // Verificación de horarios (al menos un día debe estar activo y no ser 'cerrado')
                const hours = tenant.working_hours || {};
                const hasActiveHours = Object.values(hours).some(daySchedule => daySchedule !== 'cerrado');
                
                // Verificación de servicios
                const hasServices = servicesCount > 0;
                
                // Verificación de personal
                const hasStaff = staffCount > 0;
                
                // 3. La configuración solo está completa si los 4 checks son verdaderos
                if (hasBasicInfo && hasActiveHours && hasServices && hasStaff) {
                    isSetupComplete = true;
                }
            }
        }
        // --- FIN DE LA LÓGICA DE VERIFICACIÓN ---

        const payload = {
            user: {
                id: user.id,
                role_id: user.role_id,
                tenant_id: user.tenant_id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '8h' },
            (err, token) => {
                if (err) throw err;

                const userForResponse = {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    role_id: user.role_id,
                    tenant_id: user.tenant_id
                };

                res.json({
                    token,
                    user: userForResponse,
                    setup_complete: isSetupComplete
                });
            }
        );

    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// --- Función para Registrar Dueño y Peluquería (SIN CAMBIOS) ---
const createSlug = (text) => {
    return slugify(text, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
};

// Genera un slug único, añadiendo sufijo numérico si ya existe
const createUniqueSlug = async (text) => {
    const base = createSlug(text);
    if (!base) return `tenant-${Date.now()}`;

    // Buscar slugs existentes que empiecen con este base
    const existing = await db.query(
        `SELECT slug FROM tenants WHERE slug = $1 OR slug ~ $2`,
        [base, `^${base}-\\d+$`]
    );

    if (existing.rows.length === 0) return base;

    const usedSlugs = new Set(existing.rows.map(r => r.slug));
    let suffix = 2;
    while (usedSlugs.has(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
};

exports.registerTenantAndAdmin = async (req, res) => {
    const { tenantName, adminFirstName, adminEmail, adminPassword } = req.body;

    if (!tenantName || !adminFirstName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    const client = await db.getClient();
    try {
        // Verificar si el email ya existe como usuario
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (existingUser.rows.length > 0) {
            client.release();
            return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
        }

        await client.query('BEGIN');

        const slug = await createUniqueSlug(tenantName);

        // Asignar parent al tenant principal (Didimosoft) — invisible al usuario
        let parentId = null;
        try {
            const mp = await client.query('SELECT id FROM tenants WHERE COALESCE(is_main_tenant,false) = true ORDER BY id ASC LIMIT 1');
            parentId = mp.rows[0]?.id || null;
        } catch (_) {}

        const tenantResult = await client.query(
            'INSERT INTO tenants (name, email, slug, parent_tenant_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [tenantName, adminEmail, slug, parentId]
        );
        const newTenantId = tenantResult.rows[0].id;

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);
        
        const adminResult = await client.query(
            `INSERT INTO users (tenant_id, role_id, first_name, last_name, email, password_hash)
             VALUES ($1, 1, $2, '(Admin)', $3, $4) RETURNING id, email, role_id, tenant_id, first_name, last_name`,
            [newTenantId, adminFirstName, adminEmail, password_hash]
        );

        await client.query('COMMIT');
        client.release();

        const newUser = adminResult.rows[0];

        // Generar JWT para auto-login
        const token = jwt.sign(
            { user: { id: newUser.id, role_id: newUser.role_id, tenant_id: newUser.tenant_id } },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(201).json({
            token,
            user: {
                id: newUser.id,
                first_name: newUser.first_name,
                last_name: newUser.last_name,
                email: newUser.email,
                role_id: newUser.role_id,
                tenant_id: newUser.tenant_id
            },
            setup_complete: false
        });

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        client.release();
        console.error("Error en el registro de tenant y admin:", error);
        
        if (error.code === '23505') {
            const detail = error.detail || '';
            if (detail.includes('email')) {
                return res.status(409).json({ error: 'Ya existe un usuario con ese email. ¿Ya tienes una cuenta?' });
            }
            return res.status(409).json({ error: 'Ya existe una empresa registrada con ese nombre. Prueba con otro nombre.' });
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// --- Registrar Contador (desde index/landing). Crea usuario rol 4 + primera empresa (owner).
exports.registerContador = async (req, res) => {
    const { firstName, lastName, email, password, companyName } = req.body;

    if (!firstName || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }
    if ((password || '').length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const name = (companyName || '').trim() || `${firstName} Contaduría`;

    const client = await db.getClient();
    try {
        // Verificar si el email ya existe como usuario
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.trim()]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe un usuario con ese email. ¿Ya tienes una cuenta?' });
        }

        const slug = await createUniqueSlug(name);

        await client.query('BEGIN');

        // Asignar parent al tenant principal (Didimosoft) — invisible al usuario
        let parentId = null;
        try {
            const mp = await client.query('SELECT id FROM tenants WHERE COALESCE(is_main_tenant,false) = true ORDER BY id ASC LIMIT 1');
            parentId = mp.rows[0]?.id || null;
        } catch (_) {}

        const tenantResult = await client.query(
            `INSERT INTO tenants (name, email, slug, parent_tenant_id) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, email, slug, parentId]
        );
        const newTenantId = tenantResult.rows[0].id;

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const userResult = await client.query(
            `INSERT INTO users (tenant_id, role_id, first_name, last_name, email, password_hash)
             VALUES ($1, 4, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role_id, tenant_id`,
            [newTenantId, (firstName || '').trim(), (lastName || '').trim() || null, email.trim(), password_hash]
        );
        const user = userResult.rows[0];

        await client.query(
            `UPDATE tenants SET owner_user_id = $1 WHERE id = $2`,
            [user.id, newTenantId]
        );

        await client.query('COMMIT');
        client.release();

        // Generar JWT para auto-login
        const token = jwt.sign(
            { user: { id: user.id, role_id: user.role_id, tenant_id: user.tenant_id } },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(201).json({
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role_id: user.role_id,
                tenant_id: user.tenant_id
            },
            setup_complete: false
        });
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (_) {}
        client.release();
        console.error('Error en register-contador:', error);
        if (error.code === '23505') {
            const detail = error.detail || '';
            if (detail.includes('email')) {
                return res.status(409).json({ error: 'Ya existe un usuario con ese email. ¿Ya tienes una cuenta?' });
            }
            return res.status(409).json({ error: 'Ya existe una empresa registrada con ese nombre. Prueba con otro nombre.' });
        }
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// --- Cambiar de empresa (tenant) — Contador o Super Admin ---
exports.switchTenant = async (req, res) => {
    const { tenantId } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'Falta tenantId.' });

    try {
        const u = req.user;
        const roleId = u && (parseInt(u.role_id, 10) || u.role_id);
        const isSuperAdmin = roleId === 99;
        const isContador = roleId === 4;
        if (!isSuperAdmin && !isContador) {
            return res.status(403).json({ error: 'Solo Super Admin o Contador pueden cambiar de empresa.' });
        }

        const tenantRow = await db.query('SELECT id, owner_user_id FROM tenants WHERE id = $1', [tenantId]);
        if (tenantRow.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada.' });
        const tenant = tenantRow.rows[0];

        if (isContador) {
            const owned = tenant.owner_user_id && String(tenant.owner_user_id) === String(u.id);
            const assigned = u.tenant_id && String(u.tenant_id) === String(tenantId);
            if (!owned && !assigned) {
                return res.status(403).json({ error: 'No tienes acceso a esta empresa.' });
            }
        }

        const userResult = await db.query(
            'SELECT id, first_name, last_name, email, role_id FROM users WHERE id = $1',
            [u.id]
        );
        if (userResult.rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado.' });
        const user = userResult.rows[0];

        const payload = {
            user: {
                id: user.id,
                role_id: user.role_id,
                tenant_id: tenantId
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '8h' },
            (err, token) => {
                if (err) {
                    console.error('Error firmando JWT en switch-tenant:', err);
                    return res.status(500).json({ error: 'Error interno.' });
                }
                res.json({
                    token,
                    user: {
                        id: user.id,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        email: user.email,
                        role_id: user.role_id,
                        tenant_id: tenantId
                    }
                });
            }
        );
    } catch (e) {
        console.error('Error en switch-tenant:', e);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
