const db = require('../config/db');
const { getNextSequence } = require('../helpers/sequenceHelper');
const { insertJournalEntry } = require('../services/accountingCoreService');
const alegraService = require('../services/alegraService');
const { validateTotalCancel } = require('../helpers/totalCancelValidator');
const { insertMovementRaw } = require('./kardexController');

const getAccountingConfig = async (client, tenantId, documentType) => {
    const cfgRes = await client.query(
        `SELECT * FROM accounting_document_configs WHERE tenant_id = $1 AND document_type = $2 LIMIT 1`,
        [tenantId, documentType]
    );
    const settingsRes = await client.query(
        `SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`,
        [tenantId]
    );
    return {
        config: cfgRes.rows[0] || null,
        settings: settingsRes.rows[0] || null,
    };
};

const getCreditNotes = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const result = await db.query(
            `SELECT c.*, (SELECT COUNT(*) FROM credit_note_items WHERE credit_note_id = c.id) AS total_items
             FROM credit_notes c
             WHERE c.tenant_id = $1
             ORDER BY c.date DESC, c.created_at DESC NULLS LAST`,
            [tenantId]
        );
        res.json({ success: true, creditNotes: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener notas crédito', details: error.message });
    }
};

const getCreditNoteById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const { id } = req.params;
        const creditNoteResult = await db.query(
            'SELECT * FROM credit_notes WHERE id = $1 AND tenant_id = $2',
            [id, tenantId]
        );
        if (creditNoteResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Nota crédito no encontrada' });
        }
        const itemsResult = await db.query('SELECT * FROM credit_note_items WHERE credit_note_id = $1 ORDER BY id', [id]);
        res.json({ success: true, creditNote: { ...creditNoteResult.rows[0], items: itemsResult.rows } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener nota crédito', details: error.message });
    }
};

const createCreditNote = async (req, res) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            await client.query('ROLLBACK');
            return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        }
        const createdBy = req.user?.id || null;
        const {
            clientId,
            clientNit,
            clientName,
            clientDocType = 'CC',
            clientEmail,
            relatedInvoiceId,
            relatedInvoiceNumber,
            dateIssue,
            notes,
            referenceNote,
            reason,
            correctionCode,
            reasonDetail,
            responsibleName,
            responsibleUserId,
            noteType,
            creditNoteKind,
            items = []
        } = req.body;

        // Mapeo de motivo (texto humano del FE) a código DIAN (correction_concept).
        // Si el FE manda explícitamente correctionCode, ese gana.
        const REASON_TO_DIAN_NC = {
            'Devolución': '1',
            'Devolucion': '1',
            'Anulación': '2',
            'Anulacion': '2',
            'Anulación total': '2',
            'Anulacion total': '2',
            'Rebaja': '3',
            'Descuento': '3',
            'Ajuste de precio': '4',
            'Otros': '5',
            'Otro': '5',
        };
        const resolvedConceptCode = (() => {
            if (correctionCode && /^\d+$/.test(String(correctionCode))) return String(correctionCode);
            if (reason && /^\d+$/.test(String(reason))) return String(reason);
            if (reason && REASON_TO_DIAN_NC[reason]) return REASON_TO_DIAN_NC[reason];
            return null;
        })();

        if (!clientName || items.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Cliente e items son obligatorios' });
        }

        // El Tab manda creditNoteKind, el Drawer manda noteType. Aceptamos ambos.
        const effectiveNoteType = noteType || creditNoteKind || null;
        const isTotalCancel = effectiveNoteType === 'anulacion-total';

        const sequence = await getNextSequence(client, tenantId, 'NC');
        const noteNumber = sequence.fullNumber;

        let subtotal = 0;
        let totalTax = 0;
        let totalDiscount = 0;

        const processedItems = items.map((item) => {
            const quantity = Number(item.quantity) || 1;
            const unitPrice = Number(item.unitPrice) || 0;
            const discountPercent = Number(item.discount) || 0;
            const taxRate = Number(item.tax) || 0;
            const lineBase = quantity * unitPrice;
            const discountValue = lineBase * (discountPercent / 100);
            const taxable = lineBase - discountValue;
            const taxValue = taxable * (taxRate / 100);
            const lineTotal = taxable + taxValue;

            subtotal += lineBase;
            totalDiscount += discountValue;
            totalTax += taxValue;

            return {
                description: item.description || item.item || 'Item',
                quantity, unitPrice, taxRate, taxValue, discountValue, taxable, total: lineTotal,
                costCenter: item.costCenter || item.cost_center || null,
                retentionRate: Number(item.retentionRate || item.retention_rate || 0),
                productId: item.productId ? Number(item.productId) : null,
                serviceId: item.serviceId ? Number(item.serviceId) : null,
            };
        });

        const total = subtotal - totalDiscount + totalTax;

        if (isTotalCancel) {
            const check = await validateTotalCancel(
                client,
                tenantId,
                { relatedInvoiceId, relatedInvoiceNumber },
                items,
                total
            );
            if (!check.ok) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: check.error });
            }
        }

        const creditNoteResult = await client.query(
            `INSERT INTO credit_notes (
                tenant_id, note_number, invoice_id, invoice_number,
                client_name, client_document_type, client_document_number, client_email,
                date, correction_concept, description, subtotal, tax_amount,
                discount, total, status, created_by,
                reason_detail, responsible_name, responsible_user_id,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15,
                'BORRADOR', $16, $17, $18, $19, NOW(), NOW()
            ) RETURNING *`,
            [
                tenantId,
                noteNumber,
                relatedInvoiceId ? Number(relatedInvoiceId) : null,
                relatedInvoiceNumber || null,
                clientName,
                clientDocType,
                clientNit || null,
                clientEmail || null,
                dateIssue || new Date(),
                isTotalCancel ? '2' : (resolvedConceptCode || referenceNote || '2'),
                notes || null,
                subtotal,
                totalTax,
                totalDiscount,
                total,
                createdBy,
                reasonDetail || null,
                responsibleName || null,
                responsibleUserId != null ? String(responsibleUserId) : null
            ]
        );

        const creditNote = creditNoteResult.rows[0];

        // Acumuladores kardex/COGS reversal (consumidos al armar el asiento)
        const __ncMovementIds = [];
        let __ncCogsReversal = 0;

        for (const item of processedItems) {
            await client.query(
                `INSERT INTO credit_note_items (
                    credit_note_id, description, quantity, unit_price,
                    tax_rate, tax_amount, discount, subtotal, total,
                    cost_center_code, retention_rate, retention_amount,
                    product_id, service_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
                [
                    creditNote.id, item.description, item.quantity, item.unitPrice,
                    item.taxRate, item.taxValue, item.discountValue, item.taxable, item.total,
                    item.costCenter, item.retentionRate, item.taxable * (item.retentionRate / 100),
                    item.productId, item.serviceId,
                ]
            );

            // CREDITNOTE_KARDEX_PATCH_v1
            // Devolución de mercancía al inventario (motivo 1 devolución o 2 anulación).
            // Usa insertMovementRaw para alimentar kardex IN (sin asiento — se inyecta abajo).
            const conceptForKardex = isTotalCancel ? '2' : (resolvedConceptCode || '');
            if (item.productId && (conceptForKardex === '1' || conceptForKardex === '2')) {
                // Validamos producto inventariable
                const __pres = await client.query(
                    'SELECT id, cost, is_inventoriable FROM products WHERE id = $1 AND tenant_id = $2',
                    [item.productId, tenantId]
                );
                const __prod = __pres.rows[0];
                if (__prod && __prod.is_inventoriable !== false) {
                    const __qty = Math.abs(Number(item.quantity) || 0);
                    if (__qty > 0) {
                        // Buscar costo unitario de la salida original en kardex
                        let __unitCost = 0;
                        if (relatedInvoiceId) {
                            const __lastOut = await client.query(
                                `SELECT unit_cost FROM inventory_movements
                                  WHERE tenant_id = $1 AND product_id = $2
                                    AND document_type = 'INVOICE' AND document_id = $3
                                    AND movement_type = 'OUT'
                                  ORDER BY id DESC LIMIT 1`,
                                [tenantId, item.productId, Number(relatedInvoiceId)]
                            );
                            __unitCost = Number(__lastOut.rows[0]?.unit_cost || 0);
                            if (!__unitCost) {
                                const __ii = await client.query(
                                    `SELECT unit_cost FROM invoice_items
                                      WHERE invoice_id = $1 AND product_id = $2
                                      ORDER BY id LIMIT 1`,
                                    [Number(relatedInvoiceId), item.productId]
                                );
                                __unitCost = Number(__ii.rows[0]?.unit_cost || 0);
                            }
                        }
                        if (!__unitCost) __unitCost = Number(__prod.cost) || 0;

                        await client.query('SAVEPOINT kardex_sp');
                        try {
                            const { movement } = await insertMovementRaw(client, tenantId, {
                                productId: item.productId,
                                type: 'IN',
                                quantity: __qty,
                                unitCost: __unitCost,
                                documentType: 'CREDIT_NOTE',
                                documentId: creditNote.id,
                                documentNumber: noteNumber,
                                date: dateIssue || creditNote.date,
                                notes: `Devolución venta - NC ${noteNumber}`,
                                userId: createdBy,
                            });
                            __ncMovementIds.push(movement.id);
                            __ncCogsReversal += __qty * __unitCost;
                            await client.query('RELEASE SAVEPOINT kardex_sp');
                        } catch (kErr) {
                            await client.query('ROLLBACK TO SAVEPOINT kardex_sp');
                            console.warn('[creditNoteController] kardex IN falló:', kErr.message);
                        }
                    }
                }
            }
        }

        // ====== Asiento contable automático ======
        let journalEntry = null;
        const { config, settings } = await getAccountingConfig(client, tenantId, 'NOTA_CREDITO');
        const autoPost = config ? config.auto_post !== false : true;

        if (autoPost) {
            const arCode = (config && config.accounts_receivable_code)
                || (settings && settings.accounts_receivable_code)
                || null;
            const revenueCode = (config && config.revenue_account_code)
                || (settings && settings.revenue_account_code)
                || '413595';
            const vatCode = (config && config.vat_generated_code)
                || (settings && settings.vat_generated_code)
                || '240805';

            if (!arCode) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    error: 'Configura primero las cuentas por defecto en Settings → Contabilidad maestra'
                });
            }

            const baseNeta = Number(subtotal) - Number(totalDiscount);
            const lines = [];
            // Dr Ingresos (reversa)
            lines.push({
                account_code: String(revenueCode),
                description: `Reversa ingresos NC ${noteNumber}`,
                debit: baseNeta,
                credit: 0,
                third_party_document: clientNit || null,
                third_party_name: clientName || null,
            });
            // Dr IVA generado (reversa)
            if (Number(totalTax) > 0) {
                lines.push({
                    account_code: String(vatCode),
                    description: `Reversa IVA NC ${noteNumber}`,
                    debit: Number(totalTax),
                    credit: 0,
                    third_party_document: clientNit || null,
                    third_party_name: clientName || null,
                });
            }
            // Cr Clientes
            lines.push({
                account_code: String(arCode),
                description: `Reversa cuenta por cobrar NC ${noteNumber}`,
                debit: 0,
                credit: Number(total),
                third_party_document: clientNit || null,
                third_party_name: clientName || null,
            });

            // === Reverso costo de ventas (kardex IN devolución) ===
            if (__ncCogsReversal > 0) {
                const __cv = Math.round(__ncCogsReversal * 100) / 100;
                const __cogsAccount = (settings && settings.cost_account_code) || '613595';
                const __invAccount = (settings && settings.inventory_account_code) || '143505';
                lines.push({
                    account_code: __invAccount,
                    description: `Reverso entrada inventario NC ${noteNumber}`,
                    debit: __cv,
                    credit: 0,
                    third_party_document: clientNit || null,
                    third_party_name: clientName || null,
                });
                lines.push({
                    account_code: __cogsAccount,
                    description: `Reverso costo de ventas NC ${noteNumber}`,
                    debit: 0,
                    credit: __cv,
                    third_party_document: clientNit || null,
                    third_party_name: clientName || null,
                });
            }

            journalEntry = await insertJournalEntry(client, tenantId, {
                description: `Nota crédito ${noteNumber} - ${clientName}`,
                documentType: 'NOTA_CREDITO',
                documentId: creditNote.id,
                documentNumber: noteNumber,
                entryDate: dateIssue || creditNote.date || new Date(),
                lines,
                userId: createdBy,
            });

            if (journalEntry && __ncMovementIds.length > 0) {
                await client.query(
                    `UPDATE inventory_movements SET journal_entry_id = $1
                      WHERE id = ANY($2::int[]) AND tenant_id = $3`,
                    [journalEntry.id, __ncMovementIds, tenantId]
                );
            }
        }

        await client.query('COMMIT');

        // ====== Envío a DIAN via Alegra (fuera de la tx) ======
        let alegraResult = null;
        let dianAttempted = false;
        let dianException = null;
        try {
            const tenantRes = await db.query(
                `SELECT alegra_test_set_status, needs_electronic_invoice, alegra_company_id, tax_id, tax_id_type,
                        tax_responsibility, name, business_name, email, phone, address, city, state, postal_code
                 FROM tenants WHERE id = $1`,
                [tenantId]
            );
            const tenant = tenantRes.rows[0] || {};
            const needsElectronic = tenant.needs_electronic_invoice === true;
            const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');

            if (needsElectronic && tenant.alegra_test_set_status === 'APROBADO') {
                // Buscar CUFE + fecha + id numérico de la factura origen
                let relatedCufe = null;
                let relatedInvoiceDate = null;
                let relatedInvoiceDbId = null;
                if (relatedInvoiceId || relatedInvoiceNumber) {
                    const invRes = await db.query(
                        `SELECT id, cufe, invoice_number, date FROM invoices
                         WHERE tenant_id = $1 AND (id::text = $2::text OR invoice_number = $2)
                         LIMIT 1`,
                        [tenantId, String(relatedInvoiceId || relatedInvoiceNumber)]
                    );
                    relatedCufe = invRes.rows[0]?.cufe || null;
                    relatedInvoiceDate = invRes.rows[0]?.date || null;
                    relatedInvoiceDbId = invRes.rows[0]?.id || null;
                }

                if (!relatedCufe) {
                    dianAttempted = true;
                    alegraResult = {
                        success: false,
                        error: 'La factura origen no fue emitida electrónicamente (sin CUFE). Para emitir una nota crédito electrónica primero debés enviar la factura a la DIAN.',
                    };
                    await db.query(
                        `UPDATE credit_notes SET dian_response = $1, updated_at = NOW() WHERE id = $2`,
                        [JSON.stringify({ error: alegraResult.error }), creditNote.id]
                    );
                } else {
                    dianAttempted = true;
                    alegraResult = await alegraService.createCreditNote({
                    number: noteNumber,
                    date: creditNote.date,
                    correctionConcept: isTotalCancel ? '2' : (reason || referenceNote || '2'),
                    notes: notes || reasonDetail || null,
                    relatedInvoice: {
                        number: relatedInvoiceNumber || null,
                        cufe: relatedCufe,
                        date: relatedInvoiceDate,
                        id: relatedInvoiceDbId,
                    },
                    customer: {
                        name: clientName,
                        identification: clientNit || '',
                        identificationType: clientDocType || 'CC',
                        email: clientEmail || null,
                    },
                    items: processedItems.map((it) => ({
                        description: it.description,
                        quantity: it.quantity,
                        unitPrice: it.unitPrice,
                        taxRate: it.taxRate,
                        taxAmount: it.taxValue,
                        subtotal: it.taxable,
                    })),
                }, { tenant, sandboxMode });

                    if (alegraResult?.success) {
                        await db.query(
                            `UPDATE credit_notes
                             SET cude = $1, dian_status = $2, dian_response = $3, status = 'EMITIDA', updated_at = NOW()
                             WHERE id = $4`,
                            [
                                alegraResult.cufe || alegraResult.cude || null,
                                alegraResult.dianStatus || 'ENVIADA',
                                JSON.stringify(alegraResult.data || {}),
                                creditNote.id
                            ]
                        );
                    } else {
                        await db.query(
                            `UPDATE credit_notes SET dian_response = $1, updated_at = NOW() WHERE id = $2`,
                            [JSON.stringify({ error: alegraResult?.error, details: alegraResult?.details }), creditNote.id]
                        );
                    }
                }
            }
        } catch (dianErr) {
            console.error('[creditNoteController] Error DIAN:', dianErr.message);
            dianException = dianErr.message;
            try {
                await db.query(
                    `UPDATE credit_notes SET dian_response = $1, updated_at = NOW() WHERE id = $2`,
                    [JSON.stringify({ error: dianErr.message }), creditNote.id]
                );
            } catch (_e) { /* ignore */ }
        }

        const dianSent = !!alegraResult?.success;
        const dianFailed = dianAttempted && !dianSent;
        const dianErrorMsg = dianException || alegraResult?.error || null;

        res.status(201).json({
            success: true,
            partialFailure: dianFailed,
            message: dianSent
                ? 'Nota crédito creada y enviada a DIAN'
                : dianFailed
                    ? `Nota crédito creada, pero el envío a DIAN falló: ${dianErrorMsg || 'error desconocido'}. Quedó en BORRADOR — usá "Reenviar a DIAN".`
                    : 'Nota crédito creada exitosamente',
            creditNote: {
                id: creditNote.id,
                number: creditNote.note_number,
                clientName: creditNote.client_name,
                total: creditNote.total,
                status: dianSent ? 'EMITIDA' : creditNote.status,
                dateIssue: creditNote.date,
                relatedInvoiceNumber: creditNote.invoice_number
            },
            journalEntry: journalEntry ? { id: journalEntry.id, entryNumber: journalEntry.entryNumber } : null,
            dian: dianAttempted ? {
                attempted: true,
                sent: dianSent,
                cude: alegraResult?.cufe || alegraResult?.cude || null,
                dianStatus: alegraResult?.dianStatus || null,
                error: dianSent ? null : dianErrorMsg,
            } : { attempted: false, sent: false }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: 'Error al crear nota crédito', details: error.message });
    } finally {
        client.release();
    }
};

// Edita una nota crédito SOLO si está en BORRADOR. Una vez EMITIDA es inmutable.
const updateCreditNote = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const { id } = req.params;
        const cur = await db.query(
            `SELECT id, status, cude FROM credit_notes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [id, tenantId]
        );
        if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Nota crédito no encontrada' });
        const nc = cur.rows[0];
        if (nc.status !== 'BORRADOR' || nc.cude) {
            return res.status(409).json({ success: false, error: 'Solo se pueden editar notas en BORRADOR no emitidas' });
        }
        const b = req.body || {};
        const REASON_TO_DIAN_NC = {
            'Devolución': '1', 'Devolucion': '1',
            'Anulación': '2', 'Anulacion': '2',
            'Anulación total': '2', 'Anulacion total': '2',
            'Rebaja': '3', 'Descuento': '3',
            'Ajuste de precio': '4',
            'Otros': '5', 'Otro': '5',
        };
        const code = b.correctionCode && /^\d+$/.test(String(b.correctionCode))
            ? String(b.correctionCode)
            : (b.reason && REASON_TO_DIAN_NC[b.reason]) || (b.reason && /^\d+$/.test(String(b.reason)) ? String(b.reason) : null);
        await db.query(
            `UPDATE credit_notes SET
                client_name = COALESCE($1, client_name),
                client_email = COALESCE($2, client_email),
                description = COALESCE($3, description),
                correction_concept = COALESCE($4, correction_concept),
                reason_detail = COALESCE($5, reason_detail),
                updated_at = NOW()
             WHERE id = $6 AND tenant_id = $7`,
            [b.clientName ?? null, b.clientEmail ?? null, b.notes ?? null, code, b.reasonDetail ?? null, id, tenantId]
        );
        res.json({ success: true, id: Number(id) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al actualizar nota crédito', details: error.message });
    }
};

// Cambia status de una nota crédito (BORRADOR → ANULADA). EMITIDA es terminal.
const updateCreditNoteStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const { id } = req.params;
        const newStatus = String(req.body?.status || '').toUpperCase();
        if (!['BORRADOR', 'ANULADA'].includes(newStatus)) {
            return res.status(400).json({ success: false, error: 'Estado inválido (BORRADOR | ANULADA)' });
        }
        const cur = await db.query(
            `SELECT id, status, cude FROM credit_notes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [id, tenantId]
        );
        if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Nota crédito no encontrada' });
        if (cur.rows[0].status === 'EMITIDA' || cur.rows[0].cude) {
            return res.status(409).json({ success: false, error: 'Una nota emitida a DIAN no puede cambiar de estado' });
        }
        await db.query(
            `UPDATE credit_notes SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
            [newStatus, id, tenantId]
        );
        res.json({ success: true, id: Number(id), status: newStatus });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al cambiar estado', details: error.message });
    }
};

// Borra una nota crédito SOLO si está en BORRADOR. Las EMITIDAS son inmutables.
const deleteCreditNote = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const { id } = req.params;
        const cur = await db.query(
            `SELECT id, status, cude FROM credit_notes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [id, tenantId]
        );
        if (cur.rows.length === 0) return res.status(404).json({ success: false, error: 'Nota crédito no encontrada' });
        if (cur.rows[0].status !== 'BORRADOR' || cur.rows[0].cude) {
            return res.status(409).json({ success: false, error: 'Solo se pueden borrar notas en BORRADOR no emitidas' });
        }
        await db.query(`DELETE FROM credit_note_items WHERE credit_note_id = $1`, [id]);
        await db.query(`DELETE FROM credit_notes WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al borrar nota crédito', details: error.message });
    }
};

const resendToDian = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const { id } = req.params;

        const noteRes = await db.query(
            `SELECT * FROM credit_notes WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [id, tenantId]
        );
        const note = noteRes.rows[0];
        if (!note) return res.status(404).json({ success: false, error: 'Nota crédito no encontrada' });
        if (note.status === 'EMITIDA') {
            return res.status(400).json({ success: false, error: 'La nota ya fue emitida a DIAN' });
        }

        const itemsRes = await db.query(
            `SELECT * FROM credit_note_items WHERE credit_note_id = $1 ORDER BY id`, [id]
        );

        const tenantRes = await db.query(
            `SELECT alegra_test_set_status, needs_electronic_invoice, alegra_company_id, tax_id, tax_id_type,
                    tax_responsibility, name, business_name, email, phone, address, city, state, postal_code
             FROM tenants WHERE id = $1`, [tenantId]
        );
        const tenant = tenantRes.rows[0] || {};
        if (tenant.needs_electronic_invoice !== true) {
            return res.status(400).json({ success: false, error: 'El tenant no tiene facturación electrónica habilitada' });
        }
        if (tenant.alegra_test_set_status !== 'APROBADO') {
            return res.status(400).json({ success: false, error: 'El set de pruebas Alegra no está APROBADO' });
        }

        let relatedCufe = null;
        let relatedInvoiceDate = null;
        let relatedInvoiceDbId = null;
        if (note.invoice_id || note.invoice_number) {
            const invRes = await db.query(
                `SELECT id, cufe, date FROM invoices
                 WHERE tenant_id = $1 AND (id::text = $2::text OR invoice_number = $3)
                 LIMIT 1`,
                [tenantId, String(note.invoice_id || ''), note.invoice_number || '']
            );
            relatedCufe = invRes.rows[0]?.cufe || null;
            relatedInvoiceDate = invRes.rows[0]?.date || null;
            relatedInvoiceDbId = invRes.rows[0]?.id || null;
        }

        if (!relatedCufe) {
            return res.status(400).json({
                success: false,
                error: 'La factura origen no fue emitida electrónicamente (sin CUFE). No se puede emitir una nota crédito electrónica sin CUFE de la factura.',
            });
        }

        const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');
        const alegraResult = await alegraService.createCreditNote({
            number: note.note_number,
            date: note.date,
            correctionConcept: note.correction_concept || '2',
            notes: note.description || null,
            relatedInvoice: {
                number: note.invoice_number || null,
                cufe: relatedCufe,
                date: relatedInvoiceDate,
                id: relatedInvoiceDbId,
            },
            customer: {
                name: note.client_name,
                identification: note.client_document_number || '',
                identificationType: note.client_document_type || 'CC',
                email: note.client_email || null,
            },
            items: itemsRes.rows.map((it) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unit_price),
                taxRate: Number(it.tax_rate),
                taxAmount: Number(it.tax_amount),
                subtotal: Number(it.subtotal),
            })),
        }, { tenant, sandboxMode });

        if (alegraResult?.success) {
            await db.query(
                `UPDATE credit_notes
                 SET cude = $1, dian_status = $2, dian_response = $3, status = 'EMITIDA', updated_at = NOW()
                 WHERE id = $4`,
                [
                    alegraResult.cufe || alegraResult.cude || null,
                    alegraResult.dianStatus || 'ENVIADA',
                    JSON.stringify(alegraResult.data || {}),
                    id
                ]
            );
            return res.json({
                success: true,
                message: 'Nota crédito enviada a DIAN',
                cude: alegraResult.cufe || alegraResult.cude || null,
                dianStatus: alegraResult.dianStatus || 'ENVIADA',
            });
        }

        await db.query(
            `UPDATE credit_notes SET dian_response = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify({ error: alegraResult?.error, details: alegraResult?.details }), id]
        );
        return res.status(502).json({
            success: false,
            error: alegraResult?.error || 'Falla al enviar a DIAN',
            details: alegraResult?.details || null,
        });
    } catch (error) {
        console.error('[creditNoteController] Reenvío DIAN error:', error.message);
        return res.status(500).json({ success: false, error: 'Error al reenviar a DIAN', details: error.message });
    }
};

module.exports = { getCreditNotes, getCreditNoteById, createCreditNote, updateCreditNote, updateCreditNoteStatus, deleteCreditNote, resendToDian };
