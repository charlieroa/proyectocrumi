// src/controllers/exogenousController.js
// Modulo de Informacion Exogena DIAN (medios magneticos).
// Genera los formatos 1001, 1003, 1007, 1008 y 1009 a partir de los movimientos
// contables del tenant. Devuelve datos JSON o exporta CSV/TXT (Muisca).
//
// Supuestos sobre el esquema (verificados con queries defensivas):
//  - accounts_payable: tenant_id, supplier_document_number, supplier_name,
//    issue_date, original_amount, subtotal_amount, tax_amount,
//    withholding_source_amount, withholding_ica_amount, withholding_vat_amount,
//    balance_amount.
//  - accounts_payable_applications: tenant_id, accounts_payable_id,
//    application_date, amount.
//  - accounts_receivable: tenant_id, client_document_number, client_name,
//    issue_date, original_amount, balance_amount.
//  - invoices: tenant_id, date, total, tax_amount, client_name,
//    client_document_number / client_nit (se intenta ambas).
//  - journal_entry_lines: tenant_id (a traves de journal_entries), account_code,
//    debit, credit, third_party_document, third_party_name, tax_type,
//    tax_treatment, dian_concept_code.
//  - journal_entries: tenant_id, entry_date, status.
//
// Si una tabla o columna no existe, los queries devuelven arreglos vacios
// (manejado por try/catch a nivel de query).

const db = require('../config/db');

const PAIS_RESIDENCIA_DEFAULT = '169'; // Colombia
const TIPO_DOC_DEFAULT = '13'; // Cedula de ciudadania (fallback)

const FORMATS = {
    '1001': {
        code: '1001',
        name: 'Pagos y abonos en cuenta',
        description: 'Pagos y abonos en cuenta efectuados a terceros (proveedores) durante el ano.',
    },
    '1003': {
        code: '1003',
        name: 'Retenciones en la fuente practicadas',
        description: 'Retenciones en la fuente, IVA e ICA practicadas a terceros.',
    },
    '1005': {
        code: '1005',
        name: 'IVA descontable',
        description: 'IVA descontable pagado a proveedores durante el ano.',
    },
    '1006': {
        code: '1006',
        name: 'IVA generado',
        description: 'IVA generado en ventas a clientes durante el ano.',
    },
    '1007': {
        code: '1007',
        name: 'Ingresos recibidos',
        description: 'Ingresos recibidos de clientes durante el ano.',
    },
    '1008': {
        code: '1008',
        name: 'Cuentas por cobrar al cierre',
        description: 'Saldo de cuentas por cobrar a 31 de diciembre por tercero.',
    },
    '1009': {
        code: '1009',
        name: 'Cuentas por pagar al cierre',
        description: 'Saldo de cuentas por pagar a 31 de diciembre por tercero.',
    },
    '1010': {
        code: '1010',
        name: 'Socios, accionistas y participes',
        description: 'Socios o accionistas con participacion en el patrimonio al cierre.',
    },
    '1011': {
        code: '1011',
        name: 'Informacion de declaraciones tributarias',
        description: 'Valores declarados: activos, pasivos, patrimonio, ingresos y gastos.',
    },
    '2276': {
        code: '2276',
        name: 'Certificado ingresos y retenciones',
        description: 'Certificado de ingresos laborales y retenciones practicadas a empleados.',
    },
};

const COLUMNS = {
    '1001': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_first_name', label: 'Nombres', width: 160 },
        { key: 'tp_last_name', label: 'Apellidos', width: 160 },
        { key: 'tp_business_name', label: 'Razon Social', width: 220 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'value_paid', label: 'Pago/Abono', width: 140 },
        { key: 'iva_value', label: 'IVA Mayor Valor', width: 140 },
        { key: 'retefuente_value', label: 'Retefuente', width: 130 },
        { key: 'reteiva_value', label: 'ReteIVA', width: 130 },
        { key: 'reteica_value', label: 'ReteICA', width: 130 },
    ],
    '1003': [
        { key: 'concepto_dian', label: 'Concepto', width: 110 },
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_name', label: 'Tercero', width: 240 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'base_value', label: 'Base sometida', width: 150 },
        { key: 'retention_value', label: 'Valor retenido', width: 150 },
        { key: 'tax_type', label: 'Tipo', width: 110 },
    ],
    '1007': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_name', label: 'Cliente', width: 260 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'operational_income', label: 'Ingresos operacionales', width: 180 },
        { key: 'non_operational_income', label: 'Ingresos no operacionales', width: 200 },
        { key: 'returns_value', label: 'Devoluciones', width: 150 },
    ],
    '1008': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_name', label: 'Cliente', width: 260 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'balance_value', label: 'Saldo CxC', width: 160 },
    ],
    '1009': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_name', label: 'Proveedor', width: 260 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'balance_value', label: 'Saldo CxP', width: 160 },
    ],
    '1005': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_name', label: 'Proveedor', width: 260 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'base_value', label: 'Base gravable', width: 150 },
        { key: 'iva_value', label: 'IVA descontable', width: 150 },
    ],
    '1006': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_name', label: 'Cliente', width: 260 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'base_value', label: 'Base gravable', width: 150 },
        { key: 'iva_value', label: 'IVA generado', width: 150 },
    ],
    '1010': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_first_name', label: 'Nombres', width: 160 },
        { key: 'tp_last_name', label: 'Apellidos', width: 160 },
        { key: 'tp_business_name', label: 'Razon Social', width: 220 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'percent_share', label: '% Participacion', width: 130 },
        { key: 'balance_value', label: 'Valor aportes', width: 160 },
    ],
    '1011': [
        { key: 'concepto_dian', label: 'Concepto', width: 160 },
        { key: 'descripcion', label: 'Descripcion', width: 260 },
        { key: 'balance_value', label: 'Valor declarado', width: 160 },
    ],
    '2276': [
        { key: 'tp_doc_type', label: 'Tipo Doc', width: 80 },
        { key: 'tp_doc_number', label: 'Documento', width: 140 },
        { key: 'tp_first_name', label: 'Nombres', width: 160 },
        { key: 'tp_last_name', label: 'Apellidos', width: 160 },
        { key: 'country', label: 'Pais', width: 70 },
        { key: 'ingresos_laborales', label: 'Ingresos laborales', width: 160 },
        { key: 'retefuente_value', label: 'Retefuente laboral', width: 160 },
    ],
};

const SUMMARY_AMOUNT_KEY = {
    '1001': 'value_paid',
    '1003': 'retention_value',
    '1005': 'iva_value',
    '1006': 'iva_value',
    '1007': 'operational_income',
    '1008': 'balance_value',
    '1009': 'balance_value',
    '1010': 'balance_value',
    '1011': 'balance_value',
    '2276': 'ingresos_laborales',
};

const resolveTenantId = (req) => req.user?.tenant_id || req.query?.tenantId || req.body?.tenantId;

const resolveYear = (req) => {
    const y = parseInt(req.query?.year, 10);
    if (Number.isFinite(y) && y > 1990 && y < 2100) return y;
    return new Date().getFullYear() - 1;
};

const safeQuery = async (sql, params) => {
    try {
        const result = await db.query(sql, params);
        return result.rows || [];
    } catch (err) {
        console.warn('[Exogenous] Query no ejecutada (esquema no compatible):', err.message);
        return [];
    }
};

const splitName = (fullName) => {
    if (!fullName) return { first: '', last: '', business: '' };
    const cleaned = String(fullName).trim().replace(/\s+/g, ' ');
    if (!cleaned) return { first: '', last: '', business: '' };
    const parts = cleaned.split(' ');
    if (parts.length >= 4) {
        return {
            first: `${parts[0]} ${parts[1]}`,
            last: `${parts[2]} ${parts.slice(3).join(' ')}`,
            business: '',
        };
    }
    if (parts.length === 3) {
        return { first: parts[0], last: `${parts[1]} ${parts[2]}`, business: '' };
    }
    if (parts.length === 2) {
        return { first: parts[0], last: parts[1], business: '' };
    }
    return { first: cleaned, last: '', business: cleaned };
};

const inferDocType = (docNumber) => {
    if (!docNumber) return TIPO_DOC_DEFAULT;
    const digits = String(docNumber).replace(/\D/g, '');
    if (digits.length >= 9) return '31'; // NIT
    return '13'; // CC
};

// ---------- Formato 1001: Pagos y abonos en cuenta -------------------------

const build1001 = async (tenantId, year) => {
    const sql = `
        SELECT
            COALESCE(NULLIF(ap.supplier_document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(ap.supplier_name, ''), 'SIN NOMBRE') AS name,
            COALESCE(SUM(apa.amount), 0) AS total_paid,
            COALESCE(SUM(
                COALESCE(ap.tax_amount, 0) * (apa.amount / NULLIF(ap.original_amount, 0))
            ), 0) AS iva_part,
            COALESCE(SUM(
                COALESCE(ap.withholding_source_amount, 0) * (apa.amount / NULLIF(ap.original_amount, 0))
            ), 0) AS retefuente_part,
            COALESCE(SUM(
                COALESCE(ap.withholding_vat_amount, 0) * (apa.amount / NULLIF(ap.original_amount, 0))
            ), 0) AS reteiva_part,
            COALESCE(SUM(
                COALESCE(ap.withholding_ica_amount, 0) * (apa.amount / NULLIF(ap.original_amount, 0))
            ), 0) AS reteica_part
        FROM accounts_payable_applications apa
        INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
        WHERE apa.tenant_id = $1
          AND EXTRACT(YEAR FROM apa.application_date) = $2
        GROUP BY 1, 2
        ORDER BY total_paid DESC
    `;
    const rows = await safeQuery(sql, [tenantId, year]);
    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        const docType = inferDocType(docNumber);
        const split = splitName(r.name);
        return {
            tp_doc_type: docType,
            tp_doc_number: docNumber,
            tp_first_name: docType === '31' ? '' : split.first,
            tp_last_name: docType === '31' ? '' : split.last,
            tp_business_name: docType === '31' ? r.name : '',
            country: PAIS_RESIDENCIA_DEFAULT,
            value_paid: Math.round(Number(r.total_paid || 0)),
            iva_value: Math.round(Number(r.iva_part || 0)),
            retefuente_value: Math.round(Number(r.retefuente_part || 0)),
            reteiva_value: Math.round(Number(r.reteiva_part || 0)),
            reteica_value: Math.round(Number(r.reteica_part || 0)),
        };
    });
};

// ---------- Formato 1003: Retenciones practicadas -------------------------

const build1003 = async (tenantId, year) => {
    const sql = `
        SELECT
            COALESCE(NULLIF(jel.dian_concept_code, ''), 'SIN-CONCEPTO') AS concepto_dian,
            COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
            jel.tax_type AS tax_type,
            COALESCE(SUM(jel.base_amount), 0) AS base_value,
            COALESCE(SUM(jel.tax_amount), 0) AS retention_value
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.tenant_id = $1
          AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
          AND EXTRACT(YEAR FROM je.entry_date) = $2
          AND jel.tax_type IN ('RETEFUENTE', 'RETEIVA', 'RETEICA')
          AND COALESCE(jel.tax_treatment, 'RETENIDO') = 'RETENIDO'
        GROUP BY 1, 2, 3, 4
        ORDER BY retention_value DESC
    `;
    const rows = await safeQuery(sql, [tenantId, year]);
    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        return {
            concepto_dian: r.concepto_dian,
            tp_doc_type: inferDocType(docNumber),
            tp_doc_number: docNumber,
            tp_name: r.name,
            country: PAIS_RESIDENCIA_DEFAULT,
            base_value: Math.round(Number(r.base_value || 0)),
            retention_value: Math.round(Number(r.retention_value || 0)),
            tax_type: r.tax_type,
        };
    });
};

// ---------- Formato 1007: Ingresos recibidos ------------------------------

const build1007 = async (tenantId, year) => {
    // Intentamos primero por accounts_receivable (mas confiable) y caemos a invoices.
    const sqlAR = `
        SELECT
            COALESCE(NULLIF(ar.client_document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(ar.client_name, ''), 'SIN NOMBRE') AS name,
            COALESCE(SUM(ar.original_amount), 0) AS total_income
        FROM accounts_receivable ar
        WHERE ar.tenant_id = $1
          AND EXTRACT(YEAR FROM ar.issue_date) = $2
        GROUP BY 1, 2
        ORDER BY total_income DESC
    `;
    let rows = await safeQuery(sqlAR, [tenantId, year]);

    if (!rows.length) {
        const sqlInv = `
            SELECT
                COALESCE(NULLIF(client_document_number, ''), NULLIF(client_nit, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(client_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(total), 0) AS total_income
            FROM invoices
            WHERE tenant_id = $1
              AND EXTRACT(YEAR FROM date) = $2
            GROUP BY 1, 2
            ORDER BY total_income DESC
        `;
        rows = await safeQuery(sqlInv, [tenantId, year]);
        if (!rows.length) {
            // ultimo fallback sin client_document_number
            const sqlInv2 = `
                SELECT
                    COALESCE(NULLIF(client_nit, ''), 'SIN-DOC') AS doc_number,
                    COALESCE(NULLIF(client_name, ''), 'SIN NOMBRE') AS name,
                    COALESCE(SUM(total), 0) AS total_income
                FROM invoices
                WHERE tenant_id = $1
                  AND EXTRACT(YEAR FROM date) = $2
                GROUP BY 1, 2
                ORDER BY total_income DESC
            `;
            rows = await safeQuery(sqlInv2, [tenantId, year]);
        }
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        return {
            tp_doc_type: inferDocType(docNumber),
            tp_doc_number: docNumber,
            tp_name: r.name,
            country: PAIS_RESIDENCIA_DEFAULT,
            operational_income: Math.round(Number(r.total_income || 0)),
            non_operational_income: 0,
            returns_value: 0,
        };
    });
};

// ---------- Formato 1008: CxC al cierre ----------------------------------

const build1008 = async (tenantId, year) => {
    const sqlAR = `
        SELECT
            COALESCE(NULLIF(client_document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(client_name, ''), 'SIN NOMBRE') AS name,
            COALESCE(SUM(balance_amount), 0) AS balance_value
        FROM accounts_receivable
        WHERE tenant_id = $1
          AND issue_date <= make_date($2::int, 12, 31)
          AND COALESCE(balance_amount, 0) > 0
        GROUP BY 1, 2
        ORDER BY balance_value DESC
    `;
    let rows = await safeQuery(sqlAR, [tenantId, year]);

    if (!rows.length) {
        const sqlJEL = `
            SELECT
                COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(jel.debit - jel.credit), 0) AS balance_value
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = $1
              AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
              AND je.entry_date <= make_date($2::int, 12, 31)
              AND jel.account_code LIKE '1305%'
            GROUP BY 1, 2
            HAVING COALESCE(SUM(jel.debit - jel.credit), 0) <> 0
            ORDER BY balance_value DESC
        `;
        rows = await safeQuery(sqlJEL, [tenantId, year]);
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        return {
            tp_doc_type: inferDocType(docNumber),
            tp_doc_number: docNumber,
            tp_name: r.name,
            country: PAIS_RESIDENCIA_DEFAULT,
            balance_value: Math.round(Number(r.balance_value || 0)),
        };
    });
};

// ---------- Formato 1009: CxP al cierre ----------------------------------

const build1009 = async (tenantId, year) => {
    const sqlAP = `
        SELECT
            COALESCE(NULLIF(supplier_document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(supplier_name, ''), 'SIN NOMBRE') AS name,
            COALESCE(SUM(balance_amount), 0) AS balance_value
        FROM accounts_payable
        WHERE tenant_id = $1
          AND issue_date <= make_date($2::int, 12, 31)
          AND COALESCE(balance_amount, 0) > 0
        GROUP BY 1, 2
        ORDER BY balance_value DESC
    `;
    let rows = await safeQuery(sqlAP, [tenantId, year]);

    if (!rows.length) {
        const sqlJEL = `
            SELECT
                COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(jel.credit - jel.debit), 0) AS balance_value
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = $1
              AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
              AND je.entry_date <= make_date($2::int, 12, 31)
              AND jel.account_code LIKE '2205%'
            GROUP BY 1, 2
            HAVING COALESCE(SUM(jel.credit - jel.debit), 0) <> 0
            ORDER BY balance_value DESC
        `;
        rows = await safeQuery(sqlJEL, [tenantId, year]);
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        return {
            tp_doc_type: inferDocType(docNumber),
            tp_doc_number: docNumber,
            tp_name: r.name,
            country: PAIS_RESIDENCIA_DEFAULT,
            balance_value: Math.round(Number(r.balance_value || 0)),
        };
    });
};

// ---------- Formato 1005: IVA descontable --------------------------------
//
// Agrupa por proveedor el IVA descontable pagado. Fuentes (en orden):
//   1. accounts_payable.tax_amount + supplier_document_number (si existe)
//   2. journal_entry_lines con account_code '2408%' (IVA descontable) cruzado
//      con third_party_document.
//
const build1005 = async (tenantId, year) => {
    const sqlAP = `
        SELECT
            COALESCE(NULLIF(ap.supplier_document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(ap.supplier_name, ''), 'SIN NOMBRE') AS name,
            COALESCE(SUM(COALESCE(ap.subtotal_amount, ap.original_amount - COALESCE(ap.tax_amount, 0))), 0) AS base_value,
            COALESCE(SUM(ap.tax_amount), 0) AS iva_value
        FROM accounts_payable ap
        WHERE ap.tenant_id = $1
          AND EXTRACT(YEAR FROM ap.issue_date) = $2
          AND COALESCE(ap.tax_amount, 0) > 0
        GROUP BY 1, 2
        ORDER BY iva_value DESC
    `;
    let rows = await safeQuery(sqlAP, [tenantId, year]);

    if (!rows.length) {
        const sqlJEL = `
            SELECT
                COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(jel.base_amount), 0) AS base_value,
                COALESCE(SUM(jel.debit - jel.credit), 0) AS iva_value
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = $1
              AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
              AND EXTRACT(YEAR FROM je.entry_date) = $2
              AND jel.account_code LIKE '2408%'
            GROUP BY 1, 2
            HAVING COALESCE(SUM(jel.debit - jel.credit), 0) > 0
            ORDER BY iva_value DESC
        `;
        rows = await safeQuery(sqlJEL, [tenantId, year]);
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        return {
            tp_doc_type: inferDocType(docNumber),
            tp_doc_number: docNumber,
            tp_name: r.name,
            country: PAIS_RESIDENCIA_DEFAULT,
            base_value: Math.round(Number(r.base_value || 0)),
            iva_value: Math.round(Number(r.iva_value || 0)),
        };
    });
};

// ---------- Formato 1006: IVA generado -----------------------------------
//
// Agrupa por cliente el IVA generado en facturas de venta. Fuentes:
//   1. invoices.tax_amount
//   2. journal_entry_lines con '2408%' (crédito)
//
const build1006 = async (tenantId, year) => {
    const sqlInv = `
        SELECT
            COALESCE(NULLIF(client_document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(client_name, ''), 'SIN NOMBRE') AS name,
            COALESCE(SUM(total - COALESCE(tax_amount, 0)), 0) AS base_value,
            COALESCE(SUM(tax_amount), 0) AS iva_value
        FROM invoices
        WHERE tenant_id = $1
          AND EXTRACT(YEAR FROM date) = $2
          AND COALESCE(tax_amount, 0) > 0
        GROUP BY 1, 2
        ORDER BY iva_value DESC
    `;
    let rows = await safeQuery(sqlInv, [tenantId, year]);

    if (!rows.length) {
        const sqlJEL = `
            SELECT
                COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(jel.base_amount), 0) AS base_value,
                COALESCE(SUM(jel.credit - jel.debit), 0) AS iva_value
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = $1
              AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
              AND EXTRACT(YEAR FROM je.entry_date) = $2
              AND jel.account_code LIKE '2408%'
            GROUP BY 1, 2
            HAVING COALESCE(SUM(jel.credit - jel.debit), 0) > 0
            ORDER BY iva_value DESC
        `;
        rows = await safeQuery(sqlJEL, [tenantId, year]);
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        return {
            tp_doc_type: inferDocType(docNumber),
            tp_doc_number: docNumber,
            tp_name: r.name,
            country: PAIS_RESIDENCIA_DEFAULT,
            base_value: Math.round(Number(r.base_value || 0)),
            iva_value: Math.round(Number(r.iva_value || 0)),
        };
    });
};

// ---------- Formato 1010: Socios, accionistas y participes ---------------
//
// Si existe tabla 'shareholders' (o 'partners') la usa; sino agrupa
// movimientos de cuentas 31% (capital social) por tercero.
//
const build1010 = async (tenantId, year) => {
    const sqlShareholders = `
        SELECT
            COALESCE(NULLIF(document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(name, ''), 'SIN NOMBRE') AS name,
            COALESCE(share_percent, 0) AS percent_share,
            COALESCE(share_amount, 0) AS balance_value
        FROM shareholders
        WHERE tenant_id = $1
          AND (closed_at IS NULL OR EXTRACT(YEAR FROM closed_at) >= $2)
        ORDER BY balance_value DESC
    `;
    let rows = await safeQuery(sqlShareholders, [tenantId, year]);

    if (!rows.length) {
        const sqlJEL = `
            SELECT
                COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(jel.credit - jel.debit), 0) AS balance_value
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = $1
              AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
              AND je.entry_date <= make_date($2::int, 12, 31)
              AND jel.account_code LIKE '31%'
            GROUP BY 1, 2
            HAVING COALESCE(SUM(jel.credit - jel.debit), 0) <> 0
            ORDER BY balance_value DESC
        `;
        rows = await safeQuery(sqlJEL, [tenantId, year]);
        const total = rows.reduce((s, r) => s + Number(r.balance_value || 0), 0) || 1;
        rows = rows.map((r) => ({
            ...r,
            percent_share: ((Number(r.balance_value) / total) * 100).toFixed(2),
        }));
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        const docType = inferDocType(docNumber);
        const split = splitName(r.name);
        return {
            tp_doc_type: docType,
            tp_doc_number: docNumber,
            tp_first_name: docType === '31' ? '' : split.first,
            tp_last_name: docType === '31' ? '' : split.last,
            tp_business_name: docType === '31' ? r.name : '',
            country: PAIS_RESIDENCIA_DEFAULT,
            percent_share: Number(r.percent_share || 0).toFixed(2),
            balance_value: Math.round(Number(r.balance_value || 0)),
        };
    });
};

// ---------- Formato 1011: Información de declaraciones tributarias -------
//
// Consolida totales: activos (1%), pasivos (2%), patrimonio (3%), ingresos
// (4%), costos (6,7%), gastos (5%). Devuelve una fila por concepto.
//
const build1011 = async (tenantId, year) => {
    const sql = `
        SELECT
            COALESCE(SUM(CASE WHEN jel.account_code LIKE '1%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS activos,
            COALESCE(SUM(CASE WHEN jel.account_code LIKE '2%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS pasivos,
            COALESCE(SUM(CASE WHEN jel.account_code LIKE '3%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS patrimonio,
            COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS gastos,
            COALESCE(SUM(CASE WHEN jel.account_code LIKE '6%' OR jel.account_code LIKE '7%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS costos
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.tenant_id = $1
          AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
          AND EXTRACT(YEAR FROM je.entry_date) = $2
    `;
    const rows = await safeQuery(sql, [tenantId, year]);
    const r = rows[0] || {};
    const out = [
        { concepto_dian: '1', descripcion: 'Total activos', balance_value: Math.round(Number(r.activos || 0)) },
        { concepto_dian: '2', descripcion: 'Total pasivos', balance_value: Math.round(Number(r.pasivos || 0)) },
        { concepto_dian: '3', descripcion: 'Patrimonio bruto', balance_value: Math.round(Number(r.patrimonio || 0)) },
        { concepto_dian: '4', descripcion: 'Ingresos brutos', balance_value: Math.round(Number(r.ingresos || 0)) },
        { concepto_dian: '5', descripcion: 'Costos', balance_value: Math.round(Number(r.costos || 0)) },
        { concepto_dian: '6', descripcion: 'Gastos operacionales y no op.', balance_value: Math.round(Number(r.gastos || 0)) },
    ];
    return out.filter((x) => Math.abs(x.balance_value) > 0);
};

// ---------- Formato 2276: Certificado ingresos y retenciones laborales ---
//
// Intenta leer de 'payroll_periods' + 'payroll_employees' (si el módulo nómina
// existe); si no, agrupa cuentas 5105% (gastos laborales) + 2365% (retefuente
// laboral) por tercero.
//
const build2276 = async (tenantId, year) => {
    const sqlPayroll = `
        SELECT
            COALESCE(NULLIF(e.document_number, ''), 'SIN-DOC') AS doc_number,
            COALESCE(NULLIF(CONCAT_WS(' ', e.first_name, e.last_name), ''), e.name, 'SIN NOMBRE') AS name,
            COALESCE(SUM(pe.gross_income), 0) AS ingresos_laborales,
            COALESCE(SUM(pe.retefuente), 0) AS retefuente_value
        FROM payroll_employees pe
        INNER JOIN payroll_periods pp ON pp.id = pe.period_id
        INNER JOIN employees e ON e.id = pe.employee_id
        WHERE pp.tenant_id = $1
          AND EXTRACT(YEAR FROM pp.period_end) = $2
        GROUP BY 1, 2
        ORDER BY ingresos_laborales DESC
    `;
    let rows = await safeQuery(sqlPayroll, [tenantId, year]);

    if (!rows.length) {
        const sqlJEL = `
            SELECT
                COALESCE(NULLIF(jel.third_party_document, ''), 'SIN-DOC') AS doc_number,
                COALESCE(NULLIF(jel.third_party_name, ''), 'SIN NOMBRE') AS name,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5105%' OR jel.account_code LIKE '7205%' THEN jel.debit - jel.credit ELSE 0 END), 0) AS ingresos_laborales,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '2365%' THEN jel.credit - jel.debit ELSE 0 END), 0) AS retefuente_value
            FROM journal_entry_lines jel
            INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.tenant_id = $1
              AND COALESCE(je.status, 'ACTIVO') = 'ACTIVO'
              AND EXTRACT(YEAR FROM je.entry_date) = $2
              AND (jel.account_code LIKE '5105%' OR jel.account_code LIKE '7205%' OR jel.account_code LIKE '2365%')
            GROUP BY 1, 2
            HAVING COALESCE(SUM(CASE WHEN jel.account_code LIKE '5105%' OR jel.account_code LIKE '7205%' THEN jel.debit - jel.credit ELSE 0 END), 0) > 0
            ORDER BY ingresos_laborales DESC
        `;
        rows = await safeQuery(sqlJEL, [tenantId, year]);
    }

    return rows.map((r) => {
        const docNumber = String(r.doc_number || '').replace(/\D/g, '') || r.doc_number;
        const split = splitName(r.name);
        return {
            tp_doc_type: '13', // CC por defecto para empleados
            tp_doc_number: docNumber,
            tp_first_name: split.first,
            tp_last_name: split.last,
            country: PAIS_RESIDENCIA_DEFAULT,
            ingresos_laborales: Math.round(Number(r.ingresos_laborales || 0)),
            retefuente_value: Math.round(Number(r.retefuente_value || 0)),
        };
    });
};

const BUILDERS = {
    '1001': build1001,
    '1003': build1003,
    '1005': build1005,
    '1006': build1006,
    '1007': build1007,
    '1008': build1008,
    '1009': build1009,
    '1010': build1010,
    '1011': build1011,
    '2276': build2276,
};

const buildSummary = (formatCode, rows) => {
    const amountKey = SUMMARY_AMOUNT_KEY[formatCode];
    const totalAmount = rows.reduce((acc, r) => acc + Number(r[amountKey] || 0), 0);
    const docKey = formatCode === '1003' ? 'tp_doc_number' : 'tp_doc_number';
    const uniqueThirds = new Set(rows.map((r) => r[docKey])).size;
    return {
        totalRows: rows.length,
        totalAmount,
        uniqueThirds,
    };
};

const escapeCsvCell = (value, separator) => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (separator === '\t') {
        return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    }
    if (s.includes(separator) || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
};

const buildDelimited = (formatCode, rows, separator) => {
    const cols = COLUMNS[formatCode];
    const header = cols.map((c) => escapeCsvCell(c.label, separator)).join(separator);
    const body = rows
        .map((row) => cols.map((c) => escapeCsvCell(row[c.key], separator)).join(separator))
        .join('\r\n');
    return `${header}\r\n${body}`;
};

// ---------- Endpoints ----------------------------------------------------

const getAvailableFormats = async (_req, res) => {
    res.json({
        success: true,
        formats: Object.values(FORMATS),
    });
};

const getFormat = async (req, res) => {
    try {
        const formatCode = req.params.format;
        const tenantId = resolveTenantId(req);
        const year = resolveYear(req);

        if (!FORMATS[formatCode]) {
            return res.status(404).json({ success: false, error: `Formato no soportado: ${formatCode}` });
        }
        if (!tenantId) {
            return res.status(401).json({ success: false, error: 'Tenant no resuelto.' });
        }

        const builder = BUILDERS[formatCode];
        const rows = await builder(tenantId, year);
        const summary = buildSummary(formatCode, rows);
        const columns = COLUMNS[formatCode];

        // Modo descarga (CSV / TXT muisca) si llega ?format=csv|txt
        const exportFormat = (req.query?.format || '').toString().toLowerCase();
        if (exportFormat === 'csv' || exportFormat === 'txt') {
            const separator = exportFormat === 'txt' ? '\t' : ',';
            const content = buildDelimited(formatCode, rows, separator);
            const ext = exportFormat === 'txt' ? 'txt' : 'csv';
            const filename = `exogena_${formatCode}_${year}.${ext}`;
            res.setHeader('Content-Type', exportFormat === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            // BOM para Excel CSV
            if (exportFormat === 'csv') res.write('\ufeff');
            return res.send(content);
        }

        return res.json({
            success: true,
            format: formatCode,
            year,
            rows,
            columns,
            summary,
            meta: FORMATS[formatCode],
        });
    } catch (error) {
        console.error('[Exogenous] Error generando formato:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getAvailableFormats,
    getFormat,
};
