// src/services/dianInboxService.js
// Bandeja de entrada DIAN + auto-causación real.
//
// Flujo (estilo AX1/Cifrato, pero causando dentro de Bolti que YA es el ERP):
//   1. Entran archivos XML/ZIP (carga manual o, en fase 2, buzón IMAP).
//   2. ublParser.extractXmlDocuments -> ublParser.parseUbl extrae datos EXACTOS del UBL DIAN.
//   3. Se determina la dirección (compra/venta) comparando el NIT del tenant.
//   4. classifierEngine clasifica cada línea a su cuenta PUC (4 capas: memoria/fuzzy/IA/fallback).
//   5. Si es COMPRA y la confianza es suficiente -> se causa automáticamente vía
//      accountsPayableWriteService.createAccountsPayableEntry (calcula retenciones y postea el asiento).
//      Si no, queda en estado REVISION para que el contador la apruebe.
//   6. Idempotencia por CUFE: una factura nunca se causa dos veces.

const db = require('../config/db');
const { parseUbl, extractXmlDocuments } = require('../helpers/ublParser');
const { classifyItem } = require('../helpers/classifierEngine');
const { createAccountsPayableEntry } = require('./accountsPayableWriteService');

// Confianza mínima por línea para causar sin intervención humana.
const AUTO_CAUSAR_THRESHOLD = 0.7;

const DOC_TYPE_FOR_CLASSIFIER = {
    INVOICE: 'FACTURA',
    CREDIT_NOTE: 'NOTA_CREDITO',
    DEBIT_NOTE: 'NOTA_DEBITO',
    UNKNOWN: 'FACTURA',
};

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

// --- Resolución del NIT propio del tenant (para decidir compra vs venta) ---
async function getTenantNit(tenantId) {
    try {
        const r = await db.query(`SELECT tax_id FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
        return onlyDigits(r.rows[0]?.tax_id);
    } catch (_) {
        return '';
    }
}

function resolveDirection(parsed, tenantNit) {
    const supplierNit = onlyDigits(parsed?.supplier?.nit);
    const customerNit = onlyDigits(parsed?.customer?.nit);
    if (tenantNit && supplierNit && supplierNit === tenantNit) return 'SALE';
    if (tenantNit && customerNit && customerNit === tenantNit) return 'PURCHASE';
    // Sin NIT del tenant configurado: asumimos compra (es el caso de uso dominante: causar facturas de proveedor).
    return 'PURCHASE';
}

// --- Clasificación de líneas -> propuesta de cuentas PUC ---
async function classifyLines(tenantId, parsed) {
    const docType = DOC_TYPE_FOR_CLASSIFIER[parsed.documentKind] || 'FACTURA';
    const proposed = [];
    for (const line of parsed.lines || []) {
        const description = line.description || '';
        let classification;
        try {
            // classifyItem acepta cualquier "client" con .query; db sirve directamente.
            classification = await classifyItem(db, tenantId, description, docType);
        } catch (e) {
            classification = { accountCode: '', accountName: '', confidence: 0, source: 'ERROR' };
        }
        const base = Number(line.lineExtensionAmount) || 0;
        const ivaAmount = Number(line.ivaAmount) || 0;
        // El % de IVA puede no venir explícito (cbc:Percent); si hay monto de IVA y base, lo derivamos.
        let ivaPct = Number(line.ivaPct) || 0;
        if (!ivaPct && base > 0 && ivaAmount > 0) {
            ivaPct = Math.round((ivaAmount / base) * 100 * 100) / 100;
        }
        proposed.push({
            lineNo: line.lineNo,
            description,
            quantity: Number(line.quantity) || 0,
            unitPrice: Number(line.unitPrice) || 0,
            base,
            ivaPct,
            puc_code: classification.accountCode || '',
            puc_name: classification.accountName || '',
            confidence: Number(classification.confidence) || 0,
            source: classification.source || '',
        });
    }
    return proposed;
}

function minConfidence(proposedLines) {
    if (!proposedLines.length) return 0;
    return proposedLines.reduce((m, l) => Math.min(m, Number(l.confidence) || 0), 1);
}

// --- Construye el body para createAccountsPayableEntry desde el XML + clasificación ---
function buildPayableBody(parsed, proposedLines) {
    const w = parsed.withholdings || {};
    return {
        supplierName: parsed.supplier?.name || 'Proveedor sin nombre',
        supplierDocumentType: 'NIT',
        supplierDocumentNumber: parsed.supplier?.nit || '',
        documentType: 'FACTURA_PROVEEDOR',
        documentNumber: parsed.documentNumber || parsed.cufe || '',
        issueDate: parsed.issueDate || null,
        dueDate: parsed.dueDate || null,
        isElectronic: true,
        paymentForm: parsed.dueDate ? 'Credito' : 'Contado',
        // Retenciones tomadas EXACTAS del XML (montos de cabecera = autoritativos cuando hay líneas).
        withholdingSourceAmount: Number(w.reteFuenteAmount) || 0,
        withholdingIcaAmount: Number(w.reteIcaAmount) || 0,
        withholdingVatAmount: Number(w.reteIvaAmount) || 0,
        items: proposedLines.map((l) => ({
            concept_name: (l.description || '').slice(0, 255),
            description: l.description || '',
            puc_code: l.puc_code,
            puc_name: l.puc_name,
            quantity: l.quantity > 0 ? l.quantity : 1,
            unit_price: l.quantity > 0 ? l.unitPrice : l.base,
            iva_pct: l.ivaPct,
            rf_pct: 0, // la ReteFuente va como monto de cabecera, no por línea
        })),
        notes: `Causación automática desde XML DIAN (CUFE ${parsed.cufe || 'N/A'})`,
    };
}

// --- Causa una compra: crea la CxP + asiento y marca el documento como CAUSADO ---
async function causarPurchase({ tenantId, userId, row, proposedLines }) {
    const parsed = row.parsed;
    const body = buildPayableBody(parsed, proposedLines);
    const result = await createAccountsPayableEntry({ tenantId, userId, body });
    const payableId = result?.payable?.id || null;
    const journalId = result?.journal?.id || null;

    const upd = await db.query(
        `UPDATE dian_inbox_documents
            SET status = 'CAUSADO',
                accounts_payable_id = $2,
                journal_entry_id = $3,
                proposed_lines = $4,
                error_message = NULL,
                updated_at = NOW()
          WHERE id = $1
       RETURNING *`,
        [row.id, payableId, journalId, JSON.stringify(proposedLines)]
    );
    return upd.rows[0];
}

// --- Procesa un único XML: parsea, clasifica, guarda y (si aplica) causa ---
async function ingestXml({ tenantId, userId, xmlString, source = 'UPLOAD' }) {
    const parsed = parseUbl(xmlString);
    const tenantNit = await getTenantNit(tenantId);
    const direction = resolveDirection(parsed, tenantNit);

    // Idempotencia por CUFE
    if (parsed.cufe) {
        const existing = await db.query(
            `SELECT id, status FROM dian_inbox_documents WHERE tenant_id = $1 AND cufe = $2 LIMIT 1`,
            [tenantId, parsed.cufe]
        );
        if (existing.rows[0]) {
            return { outcome: 'duplicado', document: existing.rows[0] };
        }
    }

    const proposedLines = await classifyLines(tenantId, parsed);
    const minConf = minConfidence(proposedLines);
    const total = Number(parsed.totals?.payableAmount) || 0;

    // Decidir si causamos automáticamente o dejamos en revisión.
    const hasMandatory = !!(parsed.documentNumber && (parsed.supplier?.nit || parsed.supplier?.name));
    const canAutoCausar =
        direction === 'PURCHASE' &&
        parsed.documentKind !== 'UNKNOWN' &&
        proposedLines.length > 0 &&
        hasMandatory &&
        minConf >= AUTO_CAUSAR_THRESHOLD;

    // Insertar el documento en la bandeja (estado provisional PENDIENTE).
    const ins = await db.query(
        `INSERT INTO dian_inbox_documents
            (tenant_id, source, direction, document_kind, cufe, document_number, issue_date,
             supplier_name, supplier_nit, total, currency, status, min_confidence,
             parsed, proposed_lines, raw_xml, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDIENTE',$12,$13,$14,$15,$16)
       RETURNING *`,
        [
            tenantId, source, direction, parsed.documentKind, parsed.cufe, parsed.documentNumber,
            parsed.issueDate, parsed.supplier?.name || null, parsed.supplier?.nit || null,
            total, parsed.currency || 'COP', minConf,
            JSON.stringify(parsed), JSON.stringify(proposedLines), xmlString, userId || null,
        ]
    );
    const row = ins.rows[0];

    if (!canAutoCausar) {
        // Marcar como REVISION (con motivo si es venta o doc no reconocido).
        let note = null;
        if (direction === 'SALE') note = 'Factura de venta: revísela (las ventas normalmente se emiten dentro de Bolti).';
        else if (parsed.documentKind === 'UNKNOWN') note = 'No se pudo reconocer el XML como factura UBL DIAN.';
        else if (!proposedLines.length) note = 'El documento no tiene líneas para clasificar.';
        else if (minConf < AUTO_CAUSAR_THRESHOLD) note = `Confianza de clasificación baja (${Math.round(minConf * 100)}%). Revise las cuentas antes de causar.`;
        const upd = await db.query(
            `UPDATE dian_inbox_documents SET status = 'REVISION', error_message = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [row.id, note]
        );
        return { outcome: 'revision', document: upd.rows[0] };
    }

    try {
        const causado = await causarPurchase({ tenantId, userId, row, proposedLines });
        return { outcome: 'causado', document: causado };
    } catch (e) {
        const upd = await db.query(
            `UPDATE dian_inbox_documents SET status = 'ERROR', error_message = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [row.id, String(e.message || e).slice(0, 1000)]
        );
        return { outcome: 'error', document: upd.rows[0] };
    }
}

// --- Procesa una tanda de archivos subidos ---
// files: [{ buffer, originalname }]
async function ingestFiles({ tenantId, userId, files, source = 'UPLOAD' }) {
    const summary = { received: 0, causados: 0, revision: 0, errores: 0, duplicados: 0 };
    const documents = [];

    for (const file of files || []) {
        let xmls = [];
        try {
            xmls = await extractXmlDocuments(file.buffer, file.originalname || 'doc.xml');
        } catch (e) {
            summary.errores += 1;
            continue;
        }
        for (const xml of xmls) {
            summary.received += 1;
            try {
                const { outcome, document } = await ingestXml({ tenantId, userId, xmlString: xml, source });
                if (outcome === 'causado') summary.causados += 1;
                else if (outcome === 'revision') summary.revision += 1;
                else if (outcome === 'duplicado') summary.duplicados += 1;
                else if (outcome === 'error') summary.errores += 1;
                if (document) documents.push(document);
            } catch (e) {
                summary.errores += 1;
            }
        }
    }
    return { summary, documents };
}

// --- Listar la bandeja ---
async function listInbox({ tenantId, status, direction }) {
    const conds = ['tenant_id = $1'];
    const params = [tenantId];
    if (status) { params.push(status); conds.push(`status = $${params.length}`); }
    if (direction) { params.push(direction); conds.push(`direction = $${params.length}`); }
    const r = await db.query(
        `SELECT id, source, direction, document_kind, cufe, document_number, issue_date,
                supplier_name, supplier_nit, total, currency, status, min_confidence,
                journal_entry_id, accounts_payable_id, error_message, created_at
           FROM dian_inbox_documents
          WHERE ${conds.join(' AND ')}
          ORDER BY created_at DESC, id DESC
          LIMIT 500`,
        params
    );
    return r.rows;
}

// --- Detalle de un documento (incluye líneas propuestas) ---
async function getInboxDocument({ tenantId, id }) {
    const r = await db.query(
        `SELECT * FROM dian_inbox_documents WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, id]
    );
    const row = r.rows[0];
    if (!row) return null;
    const proposedLines = Array.isArray(row.proposed_lines) ? row.proposed_lines : [];
    // No devolver el XML crudo ni el parsed completo en el detalle liviano.
    const { raw_xml, parsed, proposed_lines, ...document } = row;
    return { document, proposedLines };
}

// --- Causar manualmente un documento en revisión (con override opcional de cuentas) ---
async function causarManual({ tenantId, userId, id, lineOverrides = [] }) {
    const r = await db.query(
        `SELECT * FROM dian_inbox_documents WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, id]
    );
    const row = r.rows[0];
    if (!row) { const e = new Error('Documento no encontrado'); e.statusCode = 404; throw e; }
    if (row.status === 'CAUSADO') {
        const e = new Error('El documento ya fue causado'); e.statusCode = 409; throw e;
    }
    if (row.direction === 'SALE') {
        const e = new Error('La causación automática de ventas no está disponible: las ventas se emiten dentro de Bolti.');
        e.statusCode = 422; throw e;
    }

    // Aplicar overrides de PUC por número de línea.
    const overrideMap = new Map((lineOverrides || []).map((o) => [Number(o.lineNo), String(o.puc_code || '').trim()]));
    const proposedLines = (Array.isArray(row.proposed_lines) ? row.proposed_lines : []).map((l) => {
        const ov = overrideMap.get(Number(l.lineNo));
        return ov ? { ...l, puc_code: ov, source: 'manual', confidence: 1 } : l;
    });

    if (!proposedLines.length) { const e = new Error('El documento no tiene líneas para causar'); e.statusCode = 400; throw e; }
    const missing = proposedLines.find((l) => !l.puc_code);
    if (missing) { const e = new Error(`La línea ${missing.lineNo} no tiene cuenta PUC asignada`); e.statusCode = 400; throw e; }

    try {
        const causado = await causarPurchase({ tenantId, userId, row, proposedLines });
        return causado;
    } catch (e) {
        await db.query(
            `UPDATE dian_inbox_documents SET status = 'ERROR', error_message = $2, updated_at = NOW() WHERE id = $1`,
            [row.id, String(e.message || e).slice(0, 1000)]
        );
        throw e;
    }
}

// --- Descartar un documento ---
async function discardDocument({ tenantId, id }) {
    const r = await db.query(
        `UPDATE dian_inbox_documents
            SET status = 'DESCARTADO', updated_at = NOW()
          WHERE tenant_id = $1 AND id = $2 AND status <> 'CAUSADO'
       RETURNING id`,
        [tenantId, id]
    );
    if (!r.rows[0]) { const e = new Error('No se pudo descartar (no existe o ya está causado)'); e.statusCode = 400; throw e; }
    return true;
}

module.exports = {
    ingestFiles,
    ingestXml,
    listInbox,
    getInboxDocument,
    causarManual,
    discardDocument,
    // exportadas por si se reutilizan (fase IMAP / tests)
    classifyLines,
    resolveDirection,
};
