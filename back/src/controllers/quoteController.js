const { pool } = require('../config/db');
const { getNextSequence } = require('../helpers/sequenceHelper');

const createQuote = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            clientId,
            clientName,
            clientDocType,
            clientPhone,
            clientAddress,
            email,
            date,
            validUntil,
            items,
            seller,
            notes,
            branchId,
            costCenterGlobal,
            orderPrefix,
            orderNumber,
            paymentForm,
            paymentMethod,
            terms
        } = req.body;

        const tenantId = req.user?.tenant_id || req.body.tenantId;
        const userIdToSave = seller || req.user?.id || null;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        if (!clientName || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Cliente e items son obligatorios' });
        }

        await client.query('BEGIN');

        const isUUID = /^[0-9a-fA-F-]{36}$/.test(String(clientId || ''));
        const dbClientId = isUUID ? clientId : null;
        const dbClientDocument = isUUID ? null : (clientId || null);

        const sequenceData = await getNextSequence(client, tenantId, 'COTIZACION');
        const quoteNumber = sequenceData.fullNumber;

        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;
        let total = 0;

        const processedItems = items.map((item) => {
            const quantity = Number(item.quantity) || 1;
            const unitPrice = Number(item.unitPrice) || 0;
            const discount = Number(item.discount) || 0;
            const taxRate = Number(item.tax) || 0;
            const lineBase = quantity * unitPrice;
            const discountValue = lineBase * (discount / 100);
            const taxable = lineBase - discountValue;
            const taxValue = taxable * (taxRate / 100);
            const lineTotal = taxable + taxValue;

            subtotal += lineBase;
            discountAmount += discountValue;
            taxAmount += taxValue;
            total += lineTotal;

            const retentionRate = Number(item.retentionRate ?? item.retention_rate ?? 0);
            const retentionAmount = taxable * (retentionRate / 100);

            return {
                description: item.description || item.item || 'Item',
                quantity,
                unitPrice,
                taxRate,
                taxValue,
                discountValue,
                taxable,
                total: lineTotal,
                productId: item.productId ?? item.product_id ?? null,
                serviceId: item.serviceId ?? item.service_id ?? null,
                costCenter: item.costCenter ?? item.cost_center ?? null,
                retentionRate,
                retentionAmount
            };
        });

        const quoteDate = date ? new Date(date) : new Date();
        const issueDate = quoteDate.toISOString().split('T')[0];

        const result = await client.query(
            `INSERT INTO quotes (
                tenant_id, quote_number, client_id, client_name,
                client_document_type, client_document_number, client_email,
                client_phone, client_address,
                date, valid_until, subtotal, tax_amount, discount, total,
                notes, status, created_by,
                branch_id, cost_center_global, order_prefix, order_number,
                payment_form, payment_method, terms,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9,
                $10, $11, $12, $13, $14, $15,
                $16, 'PENDIENTE', $17,
                $18, $19, $20, $21,
                $22, $23, $24,
                NOW(), NOW()
            ) RETURNING id`,
            [
                tenantId,
                quoteNumber,
                dbClientId,
                clientName,
                clientDocType || 'CC',
                dbClientDocument,
                email || '',
                clientPhone || null,
                clientAddress || null,
                issueDate,
                validUntil || null,
                subtotal,
                taxAmount,
                discountAmount,
                total,
                notes || '',
                userIdToSave,
                branchId || null,
                costCenterGlobal || null,
                orderPrefix || null,
                orderNumber || null,
                paymentForm || null,
                paymentMethod || null,
                terms || null
            ]
        );

        const quoteId = result.rows[0].id;

        // QUOTE_LINK_PATCH_v1
        // COST_CENTER_QUOTE_v1
        for (const item of processedItems) {
            const __pid = item.productId || item.product_id || null;
            const __sid = item.serviceId || item.service_id || null;
            const __itype = __pid ? 'product' : (__sid ? 'service' : 'free');
            const __cc = item.costCenter || item.cost_center || null;
            await client.query(
                `INSERT INTO quote_items (
                    quote_id, product_id, service_id, item_type, cost_center,
                    description, quantity, unit_price,
                    tax_rate, tax_amount, discount, subtotal, total,
                    retention_rate, retention_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                    quoteId, __pid, __sid, __itype, __cc,
                    item.description,
                    item.quantity,
                    item.unitPrice,
                    item.taxRate,
                    item.taxValue,
                    item.discountValue,
                    item.taxable,
                    item.total,
                    item.retentionRate || 0,
                    item.retentionAmount || 0
                ]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Cotización creada correctamente',
            quote: {
                id: quoteId,
                number: quoteNumber,
                clientName,
                total,
                date: issueDate
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en transacción de cotización:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const getQuotes = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.body.tenantId;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        const result = await pool.query(
            `SELECT
                id, quote_number, client_name, client_document_type,
                client_email, date, valid_until, status, total,
                subtotal, tax_amount, discount, created_at, updated_at
             FROM quotes
             WHERE tenant_id = $1
             ORDER BY created_at DESC`,
            [tenantId]
        );

        res.status(200).json({
            success: true,
            quotes: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error obteniendo cotizaciones:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { createQuote, getQuotes };
