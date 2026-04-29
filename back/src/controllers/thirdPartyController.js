const db = require('../config/db');
const { VALID_ROLES } = require('../helpers/thirdPartyHelper');
const {
    listThirdPartiesData,
    createThirdPartyEntry,
    syncThirdPartiesData,
    bulkImportThirdParties,
} = require('../services/thirdPartyService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query?.tenantId || req.body?.tenantId;

const normalizeKind = (k) => {
    const v = String(k || '').toUpperCase();
    return VALID_ROLES.includes(v) ? v : null;
};

const normalizeRolesInput = (roles) => {
    if (roles == null) return undefined;
    const arr = Array.isArray(roles) ? roles : [roles];
    const cleaned = arr.map(normalizeKind).filter(Boolean);
    return Array.from(new Set(cleaned));
};

const listThirdParties = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await listThirdPartiesData(tenantId, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[ThirdParties] Error listando terceros:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createThirdParty = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const thirdParty = await createThirdPartyEntry({ tenantId, body: req.body });
        res.status(201).json({ success: true, thirdParty });
    } catch (error) {
        console.error('[ThirdParties] Error creando tercero:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const syncThirdParties = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const summary = await syncThirdPartiesData(tenantId);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('[ThirdParties] Error sincronizando terceros:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateThirdParty = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const id = parseInt(req.params.id, 10);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });
        if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

        const existing = await db.query(
            'SELECT id, document_number FROM third_parties WHERE id = $1 AND tenant_id = $2 LIMIT 1',
            [id, tenantId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tercero no encontrado' });
        }

        const body = req.body || {};
        const roles = normalizeRolesInput(body.roles);
        const kind = body.kind !== undefined ? normalizeKind(body.kind) : undefined;

        // Si cambia el document_number, validar que no choque con otro tercero
        if (body.documentNumber && String(body.documentNumber).trim() !== String(existing.rows[0].document_number || '')) {
            const clash = await db.query(
                'SELECT id FROM third_parties WHERE tenant_id = $1 AND document_number = $2 AND id <> $3 LIMIT 1',
                [tenantId, String(body.documentNumber).trim(), id]
            );
            if (clash.rows.length > 0) {
                return res.status(409).json({ success: false, error: 'Ya existe otro tercero con ese número de documento' });
            }
        }

        // UPDATE parcial: solo campos presentes en body (evita borrar datos no enviados)
        const fields = [];
        const values = [];
        let idx = 1;
        const set = (col, val) => { fields.push(`${col} = $${idx++}`); values.push(val); };

        if (body.name !== undefined) set('name', String(body.name).trim());
        if (body.documentType !== undefined) set('document_type', body.documentType || null);
        if (body.documentNumber !== undefined) set('document_number', body.documentNumber ? String(body.documentNumber).trim() : null);
        if (kind !== undefined && kind !== null) set('kind', kind);
        if (roles !== undefined && roles.length > 0) set('roles', roles);
        if (body.email !== undefined) set('email', body.email || null);
        if (body.phone !== undefined) set('phone', body.phone || null);
        if (body.address !== undefined) set('address', body.address || null);
        if (body.city !== undefined) set('city', body.city || null);
        if (body.department !== undefined) set('department', body.department || null);
        if (body.status !== undefined) set('status', body.status || 'ACTIVO');
        if (body.dv !== undefined) set('dv', body.dv || null);
        if (body.dane_municipality_code !== undefined) set('dane_municipality_code', body.dane_municipality_code || null);
        if (body.dane_department_code !== undefined) set('dane_department_code', body.dane_department_code || null);
        if (body.fiscal_regime !== undefined) set('fiscal_regime', body.fiscal_regime || null);
        if (body.fiscal_responsibilities !== undefined) set('fiscal_responsibilities', body.fiscal_responsibilities || null);
        if (body.economic_activity_code !== undefined) set('economic_activity_code', body.economic_activity_code || null);

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay campos para actualizar' });
        }

        fields.push('updated_at = NOW()');
        values.push(id, tenantId);

        const result = await db.query(
            `UPDATE third_parties SET ${fields.join(', ')}
             WHERE id = $${idx++} AND tenant_id = $${idx}
             RETURNING *`,
            values
        );

        res.json({ success: true, thirdParty: result.rows[0] });
    } catch (error) {
        console.error('[ThirdParties] Error actualizando tercero:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const bulkCreateThirdParties = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const rows = Array.isArray(req.body?.thirdParties) ? req.body.thirdParties : [];
        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Se requiere un array thirdParties con al menos una fila.' });
        }
        if (rows.length > 2000) {
            return res.status(400).json({ success: false, error: 'Máximo 2000 terceros por carga.' });
        }
        const summary = await bulkImportThirdParties({ tenantId, rows });
        res.json({ success: true, ...summary });
    } catch (error) {
        console.error('[ThirdParties] Error en carga masiva:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    listThirdParties,
    createThirdParty,
    updateThirdParty,
    syncThirdParties,
    bulkCreateThirdParties,
};


