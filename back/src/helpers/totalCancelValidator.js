// Valida que una nota crédito/débito de tipo "anulación total" replique
// exactamente los items y totales de la factura origen. Bloquea cambios de
// precio/cantidad/descuento/IVA enviados desde el frontend.

const TOL = 0.02;

const eq = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) <= TOL;

const validateTotalCancel = async (client, tenantId, { relatedInvoiceId, relatedInvoiceNumber }, payloadItems, payloadTotal) => {
    const ref = relatedInvoiceId || relatedInvoiceNumber;
    if (!ref) {
        return { ok: false, error: 'Anulación total requiere factura relacionada.' };
    }

    const invRes = await client.query(
        `SELECT id, total FROM invoices
         WHERE tenant_id = $1 AND (id::text = $2::text OR invoice_number = $2)
         LIMIT 1`,
        [tenantId, String(ref)]
    );
    const invoice = invRes.rows[0];
    if (!invoice) {
        return { ok: false, error: 'Factura origen no encontrada para anulación total.' };
    }

    const itemsRes = await client.query(
        `SELECT description, quantity, unit_price, tax_rate, discount
         FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
        [invoice.id]
    );
    const original = itemsRes.rows;

    if (original.length !== payloadItems.length) {
        return { ok: false, error: `Anulación total: la nota debe tener ${original.length} ítems, llegaron ${payloadItems.length}.` };
    }

    for (let i = 0; i < original.length; i++) {
        const o = original[i];
        const p = payloadItems[i];
        if (!eq(o.quantity, p.quantity)) {
            return { ok: false, error: `Anulación total: cantidad de la línea ${i + 1} no coincide con la factura.` };
        }
        if (!eq(o.unit_price, p.unitPrice)) {
            return { ok: false, error: `Anulación total: precio unitario de la línea ${i + 1} no coincide con la factura.` };
        }
        if (!eq(o.discount || 0, p.discount || 0)) {
            return { ok: false, error: `Anulación total: descuento de la línea ${i + 1} no coincide con la factura.` };
        }
        if (!eq(o.tax_rate || 0, p.tax || p.taxRate || 0)) {
            return { ok: false, error: `Anulación total: IVA de la línea ${i + 1} no coincide con la factura.` };
        }
    }

    if (!eq(invoice.total, payloadTotal)) {
        return { ok: false, error: `Anulación total: total ${payloadTotal} no coincide con el de la factura ${invoice.total}.` };
    }

    return { ok: true, invoice };
};

module.exports = { validateTotalCancel };
