const db = require('../config/db');
const slugify = require('slugify');

// --- Helpers ---

const createSlug = (text = '') => slugify(text, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });

// Genera un slug único, excluyendo opcionalmente un tenant específico (para updates)
const createUniqueSlug = async (text, excludeTenantId = null) => {
    const base = createSlug(text);
    if (!base) return `tenant-${Date.now()}`;

    const params = [base, `^${base}-\\d+$`];
    let query = `SELECT slug FROM tenants WHERE (slug = $1 OR slug ~ $2)`;
    if (excludeTenantId) {
        query += ` AND id != $3`;
        params.push(excludeTenantId);
    }

    const existing = await db.query(query, params);
    if (existing.rows.length === 0) return base;

    const usedSlugs = new Set(existing.rows.map(r => r.slug));
    if (!usedSlugs.has(base)) return base;

    let suffix = 2;
    while (usedSlugs.has(`${base}-${suffix}`)) suffix++;
    return `${base}-${suffix}`;
};
const clean = (v) => (v === undefined || v === null ? null : v);
const fracToPct = (v) => (v === null || v === undefined ? null : Number(v) * 100);
const pctToFrac = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : null;
};
const safeParseJSON = (s) => {
  try { return JSON.parse(s); } catch { return null; }
};

// Mapea la fila de la BD al objeto que espera la API del frontend
const dbToApiTenant = (row) => ({
  id: row.id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  email: row.email,
  website: row.website,
  logo_url: row.logo_url,
  iva_rate: fracToPct(row.tax_rate),
  admin_fee_percent: fracToPct(row.admin_fee_rate),
  slug: row.slug,
  working_hours: typeof row.working_hours === 'string' ? safeParseJSON(row.working_hours) : row.working_hours,
  // --- Mapeo de los nuevos módulos activables ---
  products_for_staff_enabled: row.products_for_staff_enabled,
  admin_fee_enabled: row.admin_fee_enabled,
  loans_to_staff_enabled: row.loans_to_staff_enabled,
  // --- Campos de contabilidad y datos tributarios ---
  tax_id_type: row.tax_id_type,
  tax_id: row.tax_id,
  business_name: row.business_name,
  tax_responsibility: row.tax_responsibility,
  city: row.city,
  state: row.state,
  postal_code: row.postal_code,
  sector: row.sector,
  currency: row.currency,
  decimal_precision: row.decimal_precision,
  decimal_separator: row.decimal_separator,
  needs_electronic_invoice: row.needs_electronic_invoice ?? null,
  active_modules: row.active_modules || ['comercial'],
  alegra_company_id: row.alegra_company_id || null,
  alegra_test_set_status: row.alegra_test_set_status || null,
  // ---------------------------------------------
  is_main_tenant: row.is_main_tenant || false,
  is_accountant_mode: row.is_accountant_mode || false,
  parent_tenant_id: row.parent_tenant_id || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  owner_user_id: row.owner_user_id || null,
});

// Construye la cláusula SET dinámicamente para las actualizaciones
const buildUpdateSet = (payload) => {
  const fields = [];
  const values = [];
  let i = 1;
  for (const [k, v] of Object.entries(payload)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  fields.push(`updated_at = NOW()`);
  return { clause: fields.join(', '), values };
};

// --- Controlador ---

// Crear un nuevo Tenant (Super Admin, Contador rol 4, o Tenant Admin rol 1 en Espacio Contador)
exports.createTenant = async (req, res) => {
  try {
    const roleId = req.user && (parseInt(req.user.role_id, 10) || req.user.role_id);
    const isSuperAdmin = roleId === 99;
    const isContador = roleId === 4;
    const isTenantAdmin = roleId === 1;
    if (!isSuperAdmin && !isContador && !isTenantAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para crear empresas.' });
    }

    const {
      name, address, phone, working_hours, email, website, logo_url,
      iva_rate, admin_fee_percent, products_for_staff_enabled = true,
      admin_fee_enabled = false, loans_to_staff_enabled = false,
      tax_id_type, tax_id, business_name, tax_responsibility,
      city, state, postal_code, sector, currency = 'COP',
      decimal_precision = 2, decimal_separator = ','
    } = req.body;

    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const slug = createSlug(name);
    // Asignar owner: Contador y Tenant Admin crean empresas propias
    const ownerUserId = (isContador || isTenantAdmin) ? req.user.id : null;

    const result = await db.query(
      `INSERT INTO tenants (
          name, address, phone, working_hours, slug, email, website, logo_url,
          tax_rate, admin_fee_rate, products_for_staff_enabled, admin_fee_enabled, loans_to_staff_enabled,
          tax_id_type, tax_id, business_name, tax_responsibility,
          city, state, postal_code, sector, currency, decimal_precision, decimal_separator,
          owner_user_id
       ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
       ) RETURNING *`,
      [
        clean(name), clean(address), clean(phone),
        working_hours ? JSON.stringify(working_hours) : null,
        slug, clean(email), clean(website), clean(logo_url),
        pctToFrac(iva_rate), pctToFrac(admin_fee_percent),
        products_for_staff_enabled, admin_fee_enabled, loans_to_staff_enabled,
        clean(tax_id_type), clean(tax_id), clean(business_name), clean(tax_responsibility),
        clean(city), clean(state), clean(postal_code), clean(sector),
        clean(currency), decimal_precision, clean(decimal_separator),
        ownerUserId
      ]
    );

    const newTenant = result.rows[0];

    // Crear usuario admin para la empresa si tiene email (para que pueda loguearse)
    if (email && (isContador || isTenantAdmin)) {
      const bcrypt = require('bcryptjs');
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length === 0) {
        const rawPassword = req.body.admin_password || 'Crumi123*';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);
        await db.query(
          `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newTenant.id, email, hashedPassword, name || 'Admin', 'Empresa', 1]
        );
      }
    }

    return res.status(201).json(dbToApiTenant(newTenant));
  } catch (error) {
    console.error('Error al crear tenant:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una empresa con un nombre similar.' });
    }
    return res.status(500).json({ error: 'Error interno del servidor', detail: error.message });
  }
};

// Listar todos los Tenants (público por slug; sin auth lista todos)
exports.getAllTenants = async (req, res) => {
  const { slug } = req.query;
  try {
    if (slug) {
      const r = await db.query('SELECT * FROM tenants WHERE slug = $1', [slug]);
      if (r.rows.length === 0) return res.status(404).json({ message: 'Peluquería no encontrada con ese slug.' });
      return res.status(200).json(dbToApiTenant(r.rows[0]));
    }
    const result = await db.query('SELECT * FROM tenants ORDER BY created_at DESC');
    return res.status(200).json(result.rows.map(dbToApiTenant));
  } catch (error) {
    console.error('Error al obtener tenants:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /tenants/mine — Solo con auth. Super Admin: todos; Contador (4) o Tenant (1): solo los que creó.
exports.getMyTenants = async (req, res) => {
  try {
    const roleId = req.user && (parseInt(req.user.role_id, 10) || req.user.role_id);
    const isSuperAdmin = roleId === 99;
    const isContador = roleId === 4;
    const isTenantAdmin = roleId === 1;

    if (!isSuperAdmin && !isContador && !isTenantAdmin) {
      return res.status(403).json({ error: 'No tienes permisos para listar empresas.' });
    }

    let result;
    if (isSuperAdmin) {
      result = await db.query('SELECT * FROM tenants WHERE COALESCE(is_main_tenant,false) = false ORDER BY created_at DESC');
    } else {
      // Tenant del usuario + empresas hijas (parent_tenant_id = su tenant) + las que él creó (owner)
      // Excluye SIEMPRE cualquier tenant marcado is_main_tenant (Didimosoft invisible).
      result = await db.query(
        `SELECT * FROM tenants
         WHERE (id = $2 OR parent_tenant_id = $2 OR owner_user_id = $1)
           AND COALESCE(is_main_tenant, false) = false
         ORDER BY created_at DESC`,
        [req.user.id, req.user.tenant_id]
      );
    }
    return res.status(200).json(result.rows.map(dbToApiTenant));
  } catch (error) {
    console.error('Error en getMyTenants:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener un Tenant por ID
exports.getTenantById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Tenant no encontrado' });
    return res.status(200).json(dbToApiTenant(result.rows[0]));
  } catch (error) {
    console.error('Error al obtener tenant por ID:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar (parcial) un Tenant
exports.updateTenant = async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  try {
    const exists = await db.query('SELECT id FROM tenants WHERE id = $1', [id]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ message: 'Tenant no encontrado para actualizar' });
    }

    const payload = {};

    if (body.name !== undefined) {
      payload.name = clean(body.name);
      payload.slug = await createUniqueSlug(body.name, id);
    }
    if (body.address !== undefined) payload.address = clean(body.address);
    if (body.phone !== undefined) payload.phone = clean(body.phone);
    if (body.email !== undefined) payload.email = clean(body.email);
    if (body.website !== undefined) payload.website = clean(body.website);
    if (body.logo_url !== undefined) payload.logo_url = clean(body.logo_url);
    if (body.working_hours !== undefined) payload.working_hours = body.working_hours ? JSON.stringify(body.working_hours) : null;
    if (body.iva_rate !== undefined) payload.tax_rate = pctToFrac(body.iva_rate);

    if (body.admin_fee_enabled === false) {
      payload.admin_fee_rate = null;
    } else if (body.admin_fee_percent !== undefined) {
      payload.admin_fee_rate = pctToFrac(body.admin_fee_percent);
    }

    if (body.products_for_staff_enabled !== undefined) payload.products_for_staff_enabled = body.products_for_staff_enabled;
    if (body.admin_fee_enabled !== undefined) payload.admin_fee_enabled = body.admin_fee_enabled;
    if (body.loans_to_staff_enabled !== undefined) payload.loans_to_staff_enabled = body.loans_to_staff_enabled;

    // --- Campos de contabilidad y datos tributarios ---
    if (body.tax_id_type !== undefined) payload.tax_id_type = clean(body.tax_id_type);
    if (body.tax_id !== undefined) payload.tax_id = clean(body.tax_id);
    if (body.business_name !== undefined) payload.business_name = clean(body.business_name);
    if (body.tax_responsibility !== undefined) payload.tax_responsibility = clean(body.tax_responsibility);
    if (body.city !== undefined) payload.city = clean(body.city);
    if (body.state !== undefined) payload.state = clean(body.state);
    if (body.postal_code !== undefined) payload.postal_code = clean(body.postal_code);
    if (body.sector !== undefined) payload.sector = clean(body.sector);
    if (body.currency !== undefined) payload.currency = clean(body.currency);
    if (body.decimal_precision !== undefined) payload.decimal_precision = body.decimal_precision;
    if (body.decimal_separator !== undefined) payload.decimal_separator = clean(body.decimal_separator);
    if (body.needs_electronic_invoice !== undefined) payload.needs_electronic_invoice = body.needs_electronic_invoice === true ? true : (body.needs_electronic_invoice === false ? false : null);
    if (body.active_modules !== undefined && Array.isArray(body.active_modules)) payload.active_modules = JSON.stringify(body.active_modules);

    if (Object.keys(payload).length === 0) {
      const current = await db.query('SELECT * FROM tenants WHERE id = $1', [id]);
      return res.status(200).json(dbToApiTenant(current.rows[0]));
    }

    const { clause, values } = buildUpdateSet(payload);
    const sql = `UPDATE tenants SET ${clause} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await db.query(sql, [...values, id]);

    return res.status(200).json(dbToApiTenant(result.rows[0]));

  } catch (error) {
    console.error('Error al actualizar tenant:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Endpoint para subir y actualizar el logo del tenant
exports.uploadTenantLogo = async (req, res) => {
  const { tenantId } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
    }
    const uploadedFileUrl = `/uploads/logos/${req.file.filename}`;
    const tenantExists = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (tenantExists.rowCount === 0) {
      return res.status(404).json({ message: 'Tenant no encontrado.' });
    }
    await db.query('UPDATE tenants SET logo_url = $1, updated_at = NOW() WHERE id = $2', [uploadedFileUrl, tenantId]);
    return res.status(200).json({ url: uploadedFileUrl });
  } catch (error) {
    console.error('Error al subir el logo:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// Eliminar un Tenant
exports.deleteTenant = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM tenants WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Tenant no encontrado para eliminar' });
    return res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar tenant:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.checkSetupStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID not found in token' });
    }

    const result = await db.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = result.rows[0];
    const missingFields = [];

    // Check critical fields
    if (!tenant.tax_id) missingFields.push('tax_id');
    if (!tenant.address) missingFields.push('address');
    if (!tenant.phone) missingFields.push('phone');
    if (!tenant.name || tenant.name === 'Mi Empresa') missingFields.push('name');

    const isConfigured = missingFields.length === 0;

    return res.json({ isConfigured, missingFields });
  } catch (error) {
    console.error('Error checking setup status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


// POST /tenants/child — sólo usuarios de tenant con is_main_tenant=true
exports.createChildTenant = async (req, res) => {
  const parentTenantId = req.user?.tenant_id;
  if (!parentTenantId) return res.status(401).json({ error: 'No autenticado' });

  try {
    const parentRes = await db.query('SELECT id, is_main_tenant, is_accountant_mode, name FROM tenants WHERE id = $1', [parentTenantId]);
    if (parentRes.rows.length === 0) return res.status(404).json({ error: 'Tenant padre no encontrado' });
    const parentRow = parentRes.rows[0];
    if (!parentRow.is_main_tenant && !parentRow.is_accountant_mode) {
      return res.status(403).json({ error: 'Activa el Espacio Contador para registrar empresas.' });
    }
  } catch (e) {
    console.error('[createChildTenant] parent check error:', e);
    return res.status(500).json({ error: 'Error verificando tenant padre', detail: e.message });
  }

  const {
    businessName, taxId, taxIdType, email, phone, address, city, state,
    taxResponsibility, needsElectronicInvoice
  } = req.body;

  if (!businessName || !taxId) {
    return res.status(400).json({ error: 'businessName y taxId son requeridos' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const slug = await createUniqueSlug(businessName);
    const name = businessName;
    const needsEI = needsElectronicInvoice === true;

    const insertRes = await client.query(
      `INSERT INTO tenants (
        name, slug, business_name, tax_id, tax_id_type, email, phone, address,
        city, state, tax_responsibility, needs_electronic_invoice,
        parent_tenant_id, owner_user_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        clean(name), slug, clean(businessName), clean(taxId), clean(taxIdType),
        clean(email), clean(phone), clean(address), clean(city), clean(state),
        clean(taxResponsibility), needsEI, parentTenantId, req.user.id
      ]
    );
    const newTenant = insertRes.rows[0];
    await client.query('COMMIT');

    // Paso Alegra (fuera de la TX)
    const nextSteps = [];
    let alegraInfo = null;
    if (needsEI) {
      try {
        const alegraService = require('../services/alegraService');
        const found = await alegraService.getCompanyByIdentification(taxId);
        if (found?.success && found?.data?.id) {
          await db.query(
            'UPDATE tenants SET alegra_company_id=$1, updated_at=NOW() WHERE id=$2',
            [found.data.id, newTenant.id]
          );
          newTenant.alegra_company_id = found.data.id;
          alegraInfo = { status: 'linked_existing', alegraCompanyId: found.data.id };
          nextSteps.push('Empresa enlazada con Alegra (ya existía).');
          nextSteps.push('Configurar resolución y test set de facturación electrónica.');
        } else {
          const created = await alegraService.createCompany(newTenant);
          if (created?.success) {
            const alegraId = created.alegraCompanyId || created.data?.id || null;
            if (alegraId) {
              await db.query(
                'UPDATE tenants SET alegra_company_id=$1, updated_at=NOW() WHERE id=$2',
                [alegraId, newTenant.id]
              );
              newTenant.alegra_company_id = alegraId;
            }
            alegraInfo = { status: 'created', alegraCompanyId: alegraId };
            nextSteps.push('Empresa creada en Alegra.');
            nextSteps.push('Configurar resolución y test set de facturación electrónica.');
          } else {
            alegraInfo = { status: 'error', error: created?.error || 'No se pudo crear en Alegra' };
            nextSteps.push('Revisar integración Alegra y reintentar.');
          }
        }
      } catch (e) {
        console.error('[createChildTenant] Alegra error:', e);
        alegraInfo = { status: 'error', error: e.message };
      }
    } else {
      nextSteps.push('Configurar datos de facturación normal (sin DIAN).');
    }

    return res.status(201).json({
      tenant: dbToApiTenant(newTenant),
      alegra: alegraInfo,
      nextSteps,
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error createChildTenant:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Empresa duplicada (NIT o slug).' });
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  } finally {
    client.release();
  }
};


// POST /tenants/me/accountant-mode — Activar/desactivar Espacio Contador para el tenant del usuario
exports.toggleAccountantMode = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) return res.status(401).json({ error: 'No autenticado' });
    const enabled = req.body?.enabled === true;
    const r = await db.query(
      'UPDATE tenants SET is_accountant_mode = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [enabled, tenantId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Tenant no encontrado' });
    return res.status(200).json({ success: true, is_accountant_mode: r.rows[0].is_accountant_mode, tenant: dbToApiTenant(r.rows[0]) });
  } catch (e) {
    console.error('toggleAccountantMode error:', e);
    return res.status(500).json({ error: 'Error interno', detail: e.message });
  }
};

// Carga Masiva de Tenants
exports.bulkCreateTenants = async (req, res) => {
  // Verificación de rol: solo Contador (4) o Super Admin (99)
  const roleId = req.user && (parseInt(req.user.role_id, 10) || req.user.role_id);
  if (roleId !== 4 && roleId !== 99) {
    return res.status(403).json({ error: 'No tienes permisos para carga masiva de empresas.' });
  }

  const { tenants, skip_user_creation } = req.body;

  if (!Array.isArray(tenants) || tenants.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de empresas.' });
  }

  const results = { success: 0, errors: 0, details: [] };
  const bcrypt = require('bcryptjs');

  for (const t of tenants) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      if (!t.name || !t.email) {
        throw new Error(`Faltan datos obligatorios para ${t.name || 'Empresa sin nombre'}`);
      }

      const slug = await createUniqueSlug(t.name);

      const tenantRes = await client.query(
        `INSERT INTO tenants (
          name, address, phone, slug, email, tax_id, tax_id_type, business_name,
          city, state, tax_responsibility, needs_electronic_invoice, owner_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          clean(t.name), clean(t.address), clean(t.phone), slug, clean(t.email),
          clean(t.tax_id), clean(t.tax_id_type), clean(t.business_name || t.name),
          clean(t.city), clean(t.state), clean(t.tax_responsibility),
          t.needs_electronic_invoice === true ? true : (t.needs_electronic_invoice === false ? false : null),
          req.user.id
        ]
      );
      const newTenant = tenantRes.rows[0];

      // Crear usuario admin para que pueda loguearse
      if (!skip_user_creation && t.email) {
        const rawPassword = t.password || 'Crumi123*';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        // Verificar si ya existe un usuario con ese email
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [t.email]);
        if (existingUser.rows.length === 0) {
          await client.query(
            `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [newTenant.id, t.email, hashedPassword, t.admin_name || 'Admin', t.admin_lastname || 'Empresa', 1]
          );
        }
      }

      await client.query('COMMIT');
      results.success++;
      results.details.push({
        name: t.name, status: 'created', email: t.email,
        tenant_id: newTenant.id,
        needs_electronic_invoice: newTenant.needs_electronic_invoice || false,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error bulk tenant ${t.name}:`, err);
      results.errors++;
      results.details.push({ name: t.name, status: 'error', message: err.message });
    } finally {
      client.release();
    }
  }

  return res.json(results);
};