const db = require('../config/db');
const { getNextSequence } = require('../helpers/sequenceHelper');

const getRemissions = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const result = await db.query(
            'SELECT * FROM remissions WHERE tenant_id = $1 ORDER BY created_at DESC',
            [tenantId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getRemissionById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const header = await db.query(
            'SELECT * FROM remissions WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        if (header.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No encontrada' });
        }

        const items = await db.query(
            'SELECT * FROM remission_items WHERE remission_id = $1 ORDER BY id',
            [id]
        );

        res.json({ success: true, data: { ...header.rows[0], items: items.rows } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createRemission = async (req, res) => {
    const client = await db.getClient();

    try {
        const tenantId = req.user?.tenant_id;
        const createdBy = req.user?.id || null;
        const {
            clientId,
            clientNit,
            clientName,
            clientDocType = 'CC',
            clientEmail,
            deliveryAddress,
            dateIssue,
            notes,
            items = []
        } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        if (!clientName || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Cliente e items son obligatorios' });
        }

        await client.query('BEGIN');

        const sequence = await getNextSequence(client, tenantId, 'REMISION');
        const remissionNumber = sequence.fullNumber;

        let subtotal = 0;
        let taxAmount = 0;
        let discount = 0;
        let total = 0;

        const processedItems = items.map((item) => {
            const quantity = Number(item.quantity) || 1;
            const unitPrice = Number(item.unitPrice) || 0;
            const taxRate = Number(item.tax) || 0;
            const discountPercent = Number(item.discount) || 0;
            const lineBase = quantity * unitPrice;
            const discountValue = lineBase * (discountPercent / 100);
            const taxable = lineBase - discountValue;
            const taxValue = taxable * (taxRate / 100);
            const lineTotal = taxable + taxValue;

            subtotal += lineBase;
            taxAmount += taxValue;
            discount += discountValue;
            total += lineTotal;

            return {
                productId: item.productId || null,
                description: item.description || item.item || 'Item',
                quantity,
                unitPrice,
                taxRate,
                taxValue,
                discountValue,
                taxable,
                total: lineTotal
            };
        });

        const result = await client.query(
            `INSERT INTO remissions (
                tenant_id, remission_number, client_name, client_id,
                client_document_type, client_document_number, client_email,
                client_address, date, subtotal, tax_amount, discount, total,
                notes, status, created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, 'BORRADOR', $15, NOW(), NOW()
            ) RETURNING *`,
            [
                tenantId,
                remissionNumber,
                clientName,
                clientId || null,
                clientDocType,
                clientNit || null,
                clientEmail || null,
                deliveryAddress || null,
                dateIssue || new Date(),
                subtotal,
                taxAmount,
                discount,
                total,
                notes || null,
                createdBy
            ]
        );

        const remission = result.rows[0];

        for (const item of processedItems) {
            await client.query(
                `INSERT INTO remission_items (
                    remission_id, product_id, description, quantity, unit_price,
                    tax_rate, tax_amount, discount, subtotal, total, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                [
                    remission.id,
                    item.productId,
                    item.description,
                    item.quantity,
                    item.unitPrice,
                    item.taxRate,
                    item.taxValue,
                    item.discountValue,
                    item.taxable,
                    item.total
                ]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({
            success: true,
            remission: {
                id: remission.id,
                number: remission.remission_number,
                clientName: remission.client_name,
                total: remission.total
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const VALID_STATUSES = ['BORRADOR', 'ENTREGADA', 'FACTURADA', 'ANULADA'];

const updateRemissionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        const tenantId = req.user?.tenant_id;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}` });
        }

        const current = await db.query(
            'SELECT id, status, converted_to_invoice_id FROM remissions WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No encontrada' });
        }
        const row = current.rows[0];
        if (row.status === 'FACTURADA' || row.converted_to_invoice_id) {
            return res.status(409).json({ success: false, error: 'No se puede cambiar el estado de una remisión ya facturada' });
        }

        const updated = await db.query(
            `UPDATE remissions
             SET status = $1, updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [status, id, tenantId]
        );

        res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteRemission = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const current = await db.query(
            'SELECT id, status, converted_to_invoice_id FROM remissions WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No encontrada' });
        }
        const row = current.rows[0];
        if (row.status === 'FACTURADA' || row.converted_to_invoice_id) {
            return res.status(409).json({ success: false, error: 'No se puede eliminar una remisión ya facturada' });
        }

        await db.query(
            'DELETE FROM remissions WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const convertToInvoice = async (req, res) => {
    const client = await db.getClient();

    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const createdBy = req.user?.id || null;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        await client.query('BEGIN');

        const headerRes = await client.query(
            'SELECT * FROM remissions WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [id, tenantId]
        );
        if (headerRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'No encontrada' });
        }
        const remission = headerRes.rows[0];

        if (remission.status === 'FACTURADA' || remission.converted_to_invoice_id) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, error: 'La remisión ya fue facturada' });
        }
        if (remission.status === 'ANULADA') {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, error: 'No se puede facturar una remisión anulada' });
        }

        const itemsRes = await client.query(
            'SELECT * FROM remission_items WHERE remission_id = $1 ORDER BY id',
            [id]
        );
        if (itemsRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'La remisión no tiene ítems para facturar' });
        }

        const sequence = await getNextSequence(client, tenantId, 'FACTURA');
        const invoiceNumber = sequence.fullNumber;

        const originPrefix = `[Origen: ${remission.remission_number}] `;
        const combinedNotes = remission.notes
            ? `${originPrefix}${remission.notes}`
            : originPrefix.trim();

        const invoiceRes = await client.query(
            `INSERT INTO invoices (
                tenant_id, invoice_number, client_name, client_id,
                client_document_type, client_document_number, client_email,
                client_phone, client_address, date,
                subtotal, tax_amount, discount, total,
                notes, status, created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7,
                $8, $9, $10,
                $11, $12, $13, $14,
                $15, 'BORRADOR', $16, NOW(), NOW()
            ) RETURNING *`,
            [
                tenantId,
                invoiceNumber,
                remission.client_name,
                remission.client_id || null,
                remission.client_document_type || null,
                remission.client_document_number || null,
                remission.client_email || null,
                remission.client_phone || null,
                remission.client_address || null,
                remission.date || new Date(),
                remission.subtotal,
                remission.tax_amount,
                remission.discount,
                remission.total,
                combinedNotes,
                createdBy
            ]
        );
        const invoice = invoiceRes.rows[0];

        for (const item of itemsRes.rows) {
            await client.query(
                `INSERT INTO invoice_items (
                    invoice_id, product_id, description, quantity, unit_price,
                    tax_rate, tax_amount, discount, subtotal, total, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                [
                    invoice.id,
                    item.product_id || null,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    item.tax_rate,
                    item.tax_amount,
                    item.discount,
                    item.subtotal,
                    item.total
                ]
            );
        }

        await client.query(
            `UPDATE remissions
             SET status = 'FACTURADA', converted_to_invoice_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [invoice.id, remission.id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            invoice: {
                id: invoice.id,
                number: invoice.invoice_number
            },
            remissionId: Number(id)
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const updateRemission = async (req, res) => {
    const client = await db.getClient();

    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;
        const {
            clientId,
            clientNit,
            clientName,
            clientDocType = 'CC',
            clientEmail,
            deliveryAddress,
            dateIssue,
            notes,
            items = []
        } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }
        if (!clientName || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Cliente e items son obligatorios' });
        }

        await client.query('BEGIN');

        const current = await client.query(
            'SELECT id, status, converted_to_invoice_id FROM remissions WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [id, tenantId]
        );
        if (current.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'No encontrada' });
        }
        const row = current.rows[0];
        if (row.status === 'FACTURADA' || row.converted_to_invoice_id) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, error: 'No se puede modificar una remisión ya facturada' });
        }

        let subtotal = 0;
        let taxAmount = 0;
        let discount = 0;
        let total = 0;

        const processedItems = items.map((item) => {
            const quantity = Number(item.quantity) || 1;
            const unitPrice = Number(item.unitPrice) || 0;
            const taxRate = Number(item.tax) || 0;
            const discountPercent = Number(item.discount) || 0;
            const lineBase = quantity * unitPrice;
            const discountValue = lineBase * (discountPercent / 100);
            const taxable = lineBase - discountValue;
            const taxValue = taxable * (taxRate / 100);
            const lineTotal = taxable + taxValue;

            subtotal += lineBase;
            taxAmount += taxValue;
            discount += discountValue;
            total += lineTotal;

            return {
                productId: item.productId || null,
                description: item.description || item.item || 'Item',
                quantity,
                unitPrice,
                taxRate,
                taxValue,
                discountValue,
                taxable,
                total: lineTotal
            };
        });

        const updated = await client.query(
            `UPDATE remissions SET
                client_name = $1,
                client_id = $2,
                client_document_type = $3,
                client_document_number = $4,
                client_email = $5,
                client_address = $6,
                date = $7,
                subtotal = $8,
                tax_amount = $9,
                discount = $10,
                total = $11,
                notes = $12,
                updated_at = NOW()
             WHERE id = $13 AND tenant_id = $14
             RETURNING *`,
            [
                clientName,
                clientId || null,
                clientDocType,
                clientNit || null,
                clientEmail || null,
                deliveryAddress || null,
                dateIssue || new Date(),
                subtotal,
                taxAmount,
                discount,
                total,
                notes || null,
                id,
                tenantId
            ]
        );

        await client.query('DELETE FROM remission_items WHERE remission_id = $1', [id]);

        for (const item of processedItems) {
            await client.query(
                `INSERT INTO remission_items (
                    remission_id, product_id, description, quantity, unit_price,
                    tax_rate, tax_amount, discount, subtotal, total, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                [
                    id,
                    item.productId,
                    item.description,
                    item.quantity,
                    item.unitPrice,
                    item.taxRate,
                    item.taxValue,
                    item.discountValue,
                    item.taxable,
                    item.total
                ]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

module.exports = { getRemissions, getRemissionById, createRemission, updateRemission, updateRemissionStatus, convertToInvoice, deleteRemission };
