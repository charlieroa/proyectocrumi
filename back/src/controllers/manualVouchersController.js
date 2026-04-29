const db = require('../config/db');
const {
    listManualVouchersData,
    createManualVoucherEntry
} = require('../services/manualVoucherService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query.tenantId;

const getManualVouchers = async (req, res) => {
    try {
        const vouchers = await listManualVouchersData(resolveTenantId(req));
        res.json({ success: true, vouchers });
    } catch (error) {
        console.error('[Accounting] Error obteniendo comprobantes manuales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createManualVoucher = async (req, res) => {
    try {
        const result = await createManualVoucherEntry({
            tenantId: resolveTenantId(req),
            userId: req.user?.id || null,
            voucherType: req.body?.voucherType || 'AJUSTE_CONTABLE',
            voucherDate: req.body?.voucherDate,
            description: req.body?.description,
            lines: req.body?.lines || []
        });

        res.status(201).json({ success: true, voucher: result.voucher, journal: result.journal });
    } catch (error) {
        const statusCode = /obligatorias|cuadrar/i.test(error.message) ? 400 : 500;
        console.error('[Accounting] Error creando comprobante manual:', error);
        res.status(statusCode).json({ success: false, error: error.message });
    }
};

// Carga masiva de comprobantes contables.
// Formato flat: una fila por línea, agrupadas por `comprobante_ref`.
// Columnas aceptadas (se toleran sinónimos):
//   comprobante_ref | fecha | descripcion | tipo_comp | cuenta | tercero_nit |
//   tercero_nombre | descripcion_linea | debito | credito
const bulkCreateVouchers = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant no encontrado' });

        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Se requiere un array rows con al menos una fila.' });
        }
        if (rows.length > 10000) {
            return res.status(400).json({ success: false, error: 'Máximo 10000 líneas por carga.' });
        }

        // Agrupar por comprobante_ref preservando el orden de aparición.
        const groups = new Map();
        const order = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i] || {};
            const ref = String(r.comprobante_ref ?? r.ref ?? r.comprobante ?? '').trim();
            if (!ref) {
                // Se trata individualmente como error, pero no rompemos la agrupación.
                if (!groups.has('__SIN_REF__')) {
                    groups.set('__SIN_REF__', []);
                    order.push('__SIN_REF__');
                }
                groups.get('__SIN_REF__').push({ idx: i, row: r });
                continue;
            }
            if (!groups.has(ref)) {
                groups.set(ref, []);
                order.push(ref);
            }
            groups.get(ref).push({ idx: i, row: r });
        }

        // Cargar el PUC del tenant para validar account_code por línea.
        const puc = await db.query(
            'SELECT account_code FROM chart_of_accounts WHERE tenant_id = $1',
            [tenantId]
        );
        const validCodes = new Set(puc.rows.map(r => String(r.account_code)));

        // Cargar terceros por document_number para resolver third_party_id cuando haya NIT.
        const tpRes = await db.query(
            'SELECT id, document_number FROM third_parties WHERE tenant_id = $1 AND document_number IS NOT NULL',
            [tenantId]
        );
        const tpByDoc = new Map(tpRes.rows.map(r => [String(r.document_number).trim(), r.id]));

        const summary = { totalGroups: order.length, created: 0, errors: 0, details: [] };

        for (const ref of order) {
            const items = groups.get(ref);
            try {
                if (ref === '__SIN_REF__') {
                    throw new Error(`Falta comprobante_ref en ${items.length} línea(s)`);
                }
                const first = items[0].row;
                const date = String(first.fecha || first.date || '').trim();
                const description = String(first.descripcion || first.description || ref).trim();
                const voucherType = String(first.tipo_comp || first.voucher_type || 'AJUSTE_CONTABLE').trim();

                if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
                    throw new Error('Fecha inválida o ausente (formato esperado YYYY-MM-DD)');
                }

                const lines = [];
                const lineErrors = [];
                for (const { idx, row } of items) {
                    const accountCode = String(row.cuenta || row.account_code || '').trim();
                    const debit = Number(String(row.debito ?? row.debit ?? '0').replace(',', '.')) || 0;
                    const credit = Number(String(row.credito ?? row.credit ?? '0').replace(',', '.')) || 0;

                    if (!accountCode) { lineErrors.push(`fila ${idx + 1}: falta cuenta`); continue; }
                    if (!validCodes.has(accountCode)) { lineErrors.push(`fila ${idx + 1}: cuenta ${accountCode} no existe en el PUC`); continue; }
                    if (debit === 0 && credit === 0) { lineErrors.push(`fila ${idx + 1}: débito y crédito en cero`); continue; }
                    if (debit > 0 && credit > 0) { lineErrors.push(`fila ${idx + 1}: no puede tener débito y crédito simultáneamente`); continue; }

                    const tpDoc = String(row.tercero_nit || row.third_party_document || '').trim();
                    const tpName = String(row.tercero_nombre || row.third_party_name || '').trim();
                    const tpId = tpDoc ? (tpByDoc.get(tpDoc) || null) : null;

                    lines.push({
                        account_code: accountCode,
                        line_description: String(row.descripcion_linea || row.line_description || description).trim(),
                        debit,
                        credit,
                        third_party_document: tpDoc || null,
                        third_party_name: tpName || null,
                        third_party_id: tpId,
                    });
                }

                if (lineErrors.length > 0) {
                    throw new Error(lineErrors.join(' · '));
                }
                if (lines.length < 2) {
                    throw new Error('Se requieren al menos 2 líneas válidas');
                }

                const result = await createManualVoucherEntry({
                    tenantId,
                    userId: req.user?.id || null,
                    voucherType,
                    voucherDate: date,
                    description,
                    lines,
                });

                summary.created++;
                summary.details.push({
                    ref,
                    status: 'created',
                    voucher_number: result.voucher?.voucher_number,
                    journal_entry_id: result.journal?.id,
                    lines: lines.length,
                });
            } catch (e) {
                summary.errors++;
                summary.details.push({ ref, status: 'error', message: e.message, lines: items.length });
            }
        }

        res.json({ success: summary.errors === 0, ...summary });
    } catch (error) {
        console.error('[Accounting] Error en bulk comprobantes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getManualVouchers,
    createManualVoucher,
    bulkCreateVouchers
};
