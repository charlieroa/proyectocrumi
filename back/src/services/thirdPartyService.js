const db = require('../config/db');
const { upsertThirdParty } = require('../helpers/thirdPartyHelper');

const CLIENT_ROLE_ID = 4;

const listThirdPartiesData = async (tenantId, filters = {}) => {
    const { kind, search } = filters;
    const params = [tenantId];
    let where = 'WHERE tenant_id = $1';
    let paramIdx = 2;

    if (kind) {
        where += ` AND ($${paramIdx} = ANY(COALESCE(roles, ARRAY[]::TEXT[])) OR kind = $${paramIdx})`;
        params.push(String(kind).toUpperCase());
        paramIdx += 1;
    }

    if (search) {
        where += ` AND (name ILIKE $${paramIdx} OR COALESCE(document_number, '') ILIKE $${paramIdx} OR COALESCE(email, '') ILIKE $${paramIdx})`;
        params.push(`%${search}%`);
    }

    const result = await db.query(
        `SELECT *
         FROM third_parties
         ${where}
         ORDER BY name ASC, id DESC`,
        params
    );

    const summary = result.rows.reduce((acc, row) => {
        acc.total += 1;
        acc.byKind[row.kind] = (acc.byKind[row.kind] || 0) + 1;
        return acc;
    }, { total: 0, byKind: {} });

    return { thirdParties: result.rows, summary };
};

const createThirdPartyEntry = async ({ tenantId, body }) => {
    const {
        kind = 'OTHER',
        roles,
        documentType,
        documentNumber,
        name,
        email,
        phone,
        address,
        city,
        department,
        sourceType = 'MANUAL',
        sourceId = null,
        metadata = {},
        dv,
        dane_municipality_code,
        dane_department_code,
        fiscal_regime,
        fiscal_responsibilities,
        economic_activity_code,
    } = body;

    if (!name || !documentNumber) {
        const error = new Error('name y documentNumber son obligatorios');
        error.statusCode = 400;
        throw error;
    }

    return upsertThirdParty(db, {
        tenantId,
        kind,
        roles,
        sourceType,
        sourceId,
        documentType,
        documentNumber,
        name,
        email,
        phone,
        address,
        city,
        department,
        status: 'ACTIVO',
        metadata,
        dv: dv ?? null,
        dane_municipality_code: dane_municipality_code ?? null,
        dane_department_code: dane_department_code ?? null,
        fiscal_regime: fiscal_regime ?? null,
        fiscal_responsibilities: fiscal_responsibilities ?? null,
        economic_activity_code: economic_activity_code ?? null,
    });
};

const syncThirdPartiesData = async (tenantId) => {
    const summary = {
        customers: 0,
        suppliers: 0,
        employees: 0,
        receivableCustomers: 0,
        total: 0
    };

    const usersResult = await db.query(
        `SELECT id, first_name, last_name, email, phone, role_id
         FROM users
         WHERE tenant_id = $1 AND role_id = $2`,
        [tenantId, CLIENT_ROLE_ID]
    );

    for (const row of usersResult.rows) {
        await upsertThirdParty(db, {
            tenantId,
            kind: 'CUSTOMER',
            sourceType: 'USER',
            sourceId: row.id,
            documentType: 'CC',
            documentNumber: row.phone || row.email || `USER-${row.id}`,
            name: `${row.first_name} ${row.last_name || ''}`.trim(),
            email: row.email,
            phone: row.phone,
            status: 'ACTIVO',
            metadata: { role_id: row.role_id, source_group: 'users.clients' }
        });
        summary.customers += 1;
    }

    const suppliersResult = await db.query(
        `SELECT id, supplier_name, supplier_document_type, supplier_document_number
         FROM accounts_payable
         WHERE tenant_id = $1`,
        [tenantId]
    );

    for (const row of suppliersResult.rows) {
        await upsertThirdParty(db, {
            tenantId,
            kind: 'SUPPLIER',
            sourceType: 'ACCOUNTS_PAYABLE',
            sourceId: row.id,
            documentType: row.supplier_document_type,
            documentNumber: row.supplier_document_number || `PROV-${row.id}`,
            name: row.supplier_name,
            status: 'ACTIVO',
            metadata: { source_group: 'accounts_payable' }
        });
        summary.suppliers += 1;
    }

    const employeesResult = await db.query(
        `SELECT id, document_type, document_number, first_name, last_name, email, phone, address, city, department_geo, position, contract_type
         FROM employees
         WHERE tenant_id = $1`,
        [tenantId]
    );

    for (const row of employeesResult.rows) {
        await upsertThirdParty(db, {
            tenantId,
            kind: 'EMPLOYEE',
            sourceType: 'EMPLOYEE',
            sourceId: row.id,
            documentType: row.document_type,
            documentNumber: row.document_number,
            name: `${row.first_name} ${row.last_name || ''}`.trim(),
            email: row.email,
            phone: row.phone,
            address: row.address,
            city: row.city,
            department: row.department_geo,
            status: 'ACTIVO',
            metadata: {
                position: row.position,
                contract_type: row.contract_type,
                source_group: 'employees'
            }
        });
        summary.employees += 1;
    }

    const receivableCustomersResult = await db.query(
        `SELECT id, client_name, client_document_type, client_document_number
         FROM accounts_receivable
         WHERE tenant_id = $1`,
        [tenantId]
    );

    for (const row of receivableCustomersResult.rows) {
        await upsertThirdParty(db, {
            tenantId,
            kind: 'CUSTOMER',
            sourceType: 'ACCOUNTS_RECEIVABLE',
            sourceId: row.id,
            documentType: row.client_document_type,
            documentNumber: row.client_document_number || `AR-${row.id}`,
            name: row.client_name || `Cliente ${row.id}`,
            status: 'ACTIVO',
            metadata: { source_group: 'accounts_receivable' }
        });
        summary.receivableCustomers += 1;
    }

    const totalResult = await db.query(
        `SELECT COUNT(*)::int AS total FROM third_parties WHERE tenant_id = $1`,
        [tenantId]
    );
    summary.total = totalResult.rows[0]?.total || 0;

    return summary;
};

// Import masivo. Recibe un array de registros normalizados (mismo shape que
// createThirdPartyEntry acepta), procesa cada uno y devuelve resumen con
// detalle por fila: { status: 'created' | 'updated' | 'error', ... }.
// No aborta al primer error — deja que el cliente revise fila por fila.
const bulkImportThirdParties = async ({ tenantId, rows }) => {
    const summary = { total: rows.length, created: 0, updated: 0, errors: 0, details: [] };

    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        const name = (row.name || '').trim();
        const documentNumber = (row.documentNumber || '').trim();
        if (!name || !documentNumber) {
            summary.errors += 1;
            summary.details.push({
                rowIndex: i,
                name: name || '(sin nombre)',
                documentNumber,
                status: 'error',
                message: 'name y documentNumber son obligatorios',
            });
            continue;
        }

        try {
            // Detectar si ya existe: upsertThirdParty hace el match por documento,
            // pero queremos reportar si fue nuevo o actualizado.
            const existing = await db.query(
                `SELECT id FROM third_parties WHERE tenant_id = $1 AND document_number = $2 LIMIT 1`,
                [tenantId, documentNumber]
            );
            const wasExisting = existing.rows.length > 0;

            const created = await upsertThirdParty(db, {
                tenantId,
                kind: row.kind || 'OTHER',
                roles: row.roles,
                sourceType: row.sourceType || 'BULK_IMPORT',
                sourceId: null,
                documentType: row.documentType,
                documentNumber,
                name,
                email: row.email,
                phone: row.phone,
                address: row.address,
                city: row.city,
                department: row.department,
                status: 'ACTIVO',
                metadata: row.metadata || {},
                dv: row.dv ?? null,
                dane_municipality_code: row.dane_municipality_code ?? null,
                dane_department_code: row.dane_department_code ?? null,
                fiscal_regime: row.fiscal_regime ?? null,
                fiscal_responsibilities: row.fiscal_responsibilities ?? null,
                economic_activity_code: row.economic_activity_code ?? null,
            });

            if (wasExisting) {
                summary.updated += 1;
                summary.details.push({
                    rowIndex: i,
                    name,
                    documentNumber,
                    status: 'updated',
                    id: created?.id,
                });
            } else {
                summary.created += 1;
                summary.details.push({
                    rowIndex: i,
                    name,
                    documentNumber,
                    status: 'created',
                    id: created?.id,
                });
            }
        } catch (error) {
            summary.errors += 1;
            summary.details.push({
                rowIndex: i,
                name,
                documentNumber,
                status: 'error',
                message: error.message,
            });
        }
    }

    return summary;
};

module.exports = {
    CLIENT_ROLE_ID,
    listThirdPartiesData,
    createThirdPartyEntry,
    syncThirdPartiesData,
    bulkImportThirdParties,
};
