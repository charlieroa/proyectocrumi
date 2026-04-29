const db = require('../config/db');
const { getNextSequence } = require('../helpers/sequenceHelper');

const getQuotes = async (tenantId, filters = {}) => {
    let query = `SELECT q.*, COALESCE(
                    json_agg(
                        json_build_object(
                            'id', qi.id,
                            'description', qi.description,
                            'quantity', qi.quantity,
                            'unit_price', qi.unit_price,
                            'discount', qi.discount,
                            'tax_rate', qi.tax_rate,
                            'tax_amount', qi.tax_amount,
                            'subtotal', qi.subtotal,
                            'total', qi.total
                        )
                    ) FILTER (WHERE qi.id IS NOT NULL),
                    '[]'::json
                 ) as items
                 FROM quotes q LEFT JOIN quote_items qi ON qi.quote_id = q.id
                 WHERE q.tenant_id = $1`;
    const params = [tenantId];
    let idx = 2;

    if (filters.status) {
        query += ` AND q.status = $${idx}`;
        params.push(filters.status);
        idx++;
    }
    if (filters.search) {
        query += ` AND (q.client_name ILIKE $${idx} OR q.quote_number ILIKE $${idx})`;
        params.push(`%${filters.search}%`);
        idx++;
    }

    query += ' GROUP BY q.id ORDER BY q.created_at DESC';
    const result = await db.query(query, params);
    return result.rows;
};

const getQuoteById = async (tenantId, id) => {
    const result = await db.query(
        `SELECT q.*, COALESCE(
            json_agg(
                json_build_object(
                    'id', qi.id,
                    'description', qi.description,
                    'quantity', qi.quantity,
                    'unit_price', qi.unit_price,
                    'discount', qi.discount,
                    'tax_rate', qi.tax_rate,
                    'tax_amount', qi.tax_amount,
                    'subtotal', qi.subtotal,
                    'total', qi.total
                )
            ) FILTER (WHERE qi.id IS NOT NULL),
            '[]'::json
        ) as items
         FROM quotes q LEFT JOIN quote_items qi ON qi.quote_id = q.id
         WHERE q.id = $1 AND q.tenant_id = $2 GROUP BY q.id`,
        [id, tenantId]
    );
    return result.rows[0] || null;
};

const updateQuote = async (tenantId, id, data) => {
    const result = await db.query(
        `UPDATE quotes SET client_name=$3, client_email=$4, client_phone=$5, subtotal=$6, tax_amount=$7, total=$8, notes=$9, status=$10, valid_until=$11, updated_at=NOW()
         WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [id, tenantId, data.clientName, data.clientEmail, data.clientPhone, data.subtotal, data.taxTotal, data.total, data.notes, data.status || 'BORRADOR', data.validUntil]
    );
    return result.rows[0];
};

const deleteQuote = async (tenantId, id) => {
    await db.query('DELETE FROM quotes WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
};

const updateQuoteStatus = async (tenantId, id, status) => {
    const result = await db.query(
        'UPDATE quotes SET status=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *',
        [id, tenantId, status]
    );
    return result.rows[0];
};

const convertToInvoice = async (tenantId, quoteId, userId) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const quote = await client.query(
            'SELECT * FROM quotes WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
            [quoteId, tenantId]
        );
        if (!quote.rows[0]) throw new Error('Cotizacion no encontrada');
        const q = quote.rows[0];
        if (q.status === 'CONVERTIDA') throw new Error('La cotización ya fue convertida');
        if (q.status === 'RECHAZADA' || q.status === 'ANULADA') throw new Error('No se puede convertir una cotización rechazada o anulada');

        const sequence = await getNextSequence(client, tenantId, 'FACTURA');
        const invoiceNumber = sequence.fullNumber;

        const originPrefix = `[Origen: ${q.quote_number}] `;
        const combinedNotes = q.notes ? `${originPrefix}${q.notes}` : originPrefix.trim();

        const inv = await client.query(
            `INSERT INTO invoices (
                tenant_id, invoice_number, client_name, client_id,
                client_document_type, client_document_number, client_email,
                client_phone, client_address,
                date, due_date,
                subtotal, tax_amount, discount, total,
                notes, status, payment_form, created_by,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9,
                CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
                $10, $11, $12, $13,
                $14, 'BORRADOR', $15, $16,
                NOW(), NOW()
            ) RETURNING *`,
            [
                tenantId,
                invoiceNumber,
                q.client_name,
                q.client_id || null,
                q.client_document_type || null,
                q.client_document_number || null,
                q.client_email || null,
                q.client_phone || null,
                q.client_address || null,
                q.subtotal,
                q.tax_amount,
                q.discount,
                q.total,
                combinedNotes,
                q.payment_form || null,
                userId,
            ]
        );

        const items = await client.query(
            'SELECT * FROM quote_items WHERE quote_id=$1 ORDER BY id',
            [quoteId]
        );
        for (const item of items.rows) {
            await client.query(
                `INSERT INTO invoice_items (
                    invoice_id, product_id, service_id, item_type,
                    description, quantity, unit_price,
                    tax_rate, tax_amount, discount, subtotal, total,
                    cost_center, retention_rate, retention_amount,
                    created_at
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7,
                    $8, $9, $10, $11, $12,
                    $13, $14, $15,
                    NOW()
                )`,
                [
                    inv.rows[0].id,
                    item.product_id || null,
                    item.service_id || null,
                    item.item_type || null,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    item.tax_rate,
                    item.tax_amount,
                    item.discount,
                    item.subtotal,
                    item.total,
                    item.cost_center || null,
                    item.retention_rate || 0,
                    item.retention_amount || 0,
                ]
            );
        }

        await client.query(
            'UPDATE quotes SET status=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2',
            [quoteId, tenantId, 'CONVERTIDA']
        );
        await client.query('COMMIT');
        return inv.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const getDashboard = async (tenantId) => {
    const result = await db.query(
        `SELECT status, COUNT(*)::int as count, COALESCE(SUM(total), 0)::numeric as total_value
         FROM quotes WHERE tenant_id = $1 GROUP BY status`,
        [tenantId]
    );
    return result.rows;
};

module.exports = { getQuotes, getQuoteById, updateQuote, deleteQuote, updateQuoteStatus, convertToInvoice, getDashboard };
