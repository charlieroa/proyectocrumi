const db = require('../config/db');

const VALID_ROLES = ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'OTHER'];

const normalizeKind = (kind) => {
    const value = String(kind || 'OTHER').toUpperCase();
    return VALID_ROLES.includes(value) ? value : 'OTHER';
};

const normalizeRoles = (roles, fallbackKind) => {
    const arr = Array.isArray(roles) ? roles : (roles ? [roles] : []);
    const cleaned = arr.map(normalizeKind);
    if (fallbackKind) cleaned.push(normalizeKind(fallbackKind));
    const unique = Array.from(new Set(cleaned));
    return unique.length ? unique : ['OTHER'];
};

const normalizeSource = (sourceType) => String(sourceType || 'MANUAL').toUpperCase();

const upsertThirdParty = async (executor, payload) => {
    const queryable = executor || db;
    const tenantId = payload?.tenantId;
    const documentNumber = payload?.documentNumber ? String(payload.documentNumber).trim() : null;
    const sourceType = normalizeSource(payload?.sourceType);
    const sourceId = payload?.sourceId ?? null;
    const primaryKind = normalizeKind(payload?.kind);
    const rolesList = normalizeRoles(payload?.roles, primaryKind);

    if (!tenantId) throw new Error('tenantId es obligatorio para sincronizar tercero');
    if (!payload?.name || !String(payload.name).trim()) throw new Error('name es obligatorio para sincronizar tercero');
    if (!documentNumber && sourceId == null) throw new Error('documentNumber o sourceId son obligatorios para sincronizar tercero');

    const dv = payload?.dv ?? null;
    const daneMunicipalityCode = payload?.dane_municipality_code ?? null;
    const daneDepartmentCode = payload?.dane_department_code ?? null;
    const fiscalRegime = payload?.fiscal_regime ?? null;
    const fiscalResponsibilities = payload?.fiscal_responsibilities ?? null;
    const economicActivityCode = payload?.economic_activity_code ?? null;

    // 1. Buscar por documento (prioridad) -> fusionar roles
    if (documentNumber) {
        const existing = await queryable.query(
            `SELECT id, roles FROM third_parties WHERE tenant_id = $1 AND document_number = $2 LIMIT 1`,
            [tenantId, documentNumber]
        );
        if (existing.rows[0]?.id) {
            const mergedRoles = Array.from(new Set([...(existing.rows[0].roles || []), ...rolesList]));
            const updated = await queryable.query(
                `UPDATE third_parties SET
                    kind = COALESCE($1, kind),
                    roles = $2,
                    source_type = COALESCE($3, source_type),
                    source_id = COALESCE($4, source_id),
                    document_type = COALESCE($5, document_type),
                    name = $6,
                    email = COALESCE($7, email),
                    phone = COALESCE($8, phone),
                    address = COALESCE($9, address),
                    city = COALESCE($10, city),
                    department = COALESCE($11, department),
                    status = COALESCE($12, status),
                    metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($13, '{}'::jsonb),
                    dv = COALESCE($14, dv),
                    dane_municipality_code = COALESCE($15, dane_municipality_code),
                    dane_department_code = COALESCE($16, dane_department_code),
                    fiscal_regime = COALESCE($17, fiscal_regime),
                    fiscal_responsibilities = COALESCE($18, fiscal_responsibilities),
                    economic_activity_code = COALESCE($19, economic_activity_code),
                    updated_at = NOW()
                 WHERE id = $20
                 RETURNING *`,
                [
                    primaryKind, mergedRoles, sourceType, sourceId,
                    payload?.documentType || null, String(payload.name).trim(),
                    payload?.email || null, payload?.phone || null, payload?.address || null,
                    payload?.city || null, payload?.department || null,
                    payload?.status || 'ACTIVO', payload?.metadata || {},
                    dv, daneMunicipalityCode, daneDepartmentCode, fiscalRegime, fiscalResponsibilities, economicActivityCode,
                    existing.rows[0].id,
                ]
            );
            return updated.rows[0];
        }
    }

    // 2. Insertar nuevo
    const result = await queryable.query(
        `INSERT INTO third_parties (
            tenant_id, kind, roles, source_type, source_id, document_type, document_number,
            name, email, phone, address, city, department, status, metadata,
            dv, dane_municipality_code, dane_department_code, fiscal_regime, fiscal_responsibilities, economic_activity_code,
            updated_at
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14,'ACTIVO'),COALESCE($15,'{}'::jsonb),
            $16,$17,$18,$19,$20,$21,NOW()
        )
        ON CONFLICT (tenant_id, document_number) DO UPDATE SET
            kind = EXCLUDED.kind,
            roles = ARRAY(SELECT DISTINCT unnest(third_parties.roles || EXCLUDED.roles)),
            name = EXCLUDED.name,
            updated_at = NOW()
        RETURNING *`,
        [
            tenantId, primaryKind, rolesList, sourceType, sourceId,
            payload?.documentType || null, documentNumber,
            String(payload.name).trim(),
            payload?.email || null, payload?.phone || null, payload?.address || null,
            payload?.city || null, payload?.department || null,
            payload?.status || 'ACTIVO', payload?.metadata || {},
            dv, daneMunicipalityCode, daneDepartmentCode, fiscalRegime, fiscalResponsibilities, economicActivityCode,
        ]
    );
    return result.rows[0];
};

module.exports = {
    upsertThirdParty,
    VALID_ROLES,
};
