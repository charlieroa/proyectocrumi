// src/controllers/invoiceController.js
const { pool } = require('../config/db');
const { getNextSequence } = require('../helpers/sequenceHelper');
const aliaddoService = require('../services/aliaddoService');
const {
    createJournalFromInvoice,
    createAccountsReceivableFromInvoice
} = require('../helpers/accountingHelper');
const { assertAccountingPeriodOpen } = require('../helpers/accountingPeriodHelper');
const { recordAccountingAuditEvent } = require('../helpers/accountingAuditHelper');
const { upsertThirdParty } = require('../helpers/thirdPartyHelper');
const accountingCoreService = require('../services/accountingCoreService');
const { insertMovementRaw } = require('./kardexController');

const createInvoice = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            // ✅ Cliente
            clientId,
            clientName,
            clientDocType,    // ✅ NUEVO: CC, NIT, CE
            email,            // ✅ NUEVO: Email del cliente

            // ✅ Configuración
            documentType,     // ✅ NUEVO: "Factura de venta"
            warehouse,        // ✅ NUEVO: "Principal"
            priceList,        // ✅ NUEVO: "General"
            seller,           // ID del vendedor
            date,             // ✅ NUEVO: Fecha seleccionada por el usuario

            // ✅ Items
            items,

            // ✅ Pago
            paymentMethod,
            paymentMeanCode,

            // ✅ Textos
            notes,
            reference,
            terms             // ✅ NUEVO: Términos y condiciones
        } = req.body;

        // Tenant y User
        const tenantId = req.user?.tenant_id || req.body.tenantId;
        const userIdToSave = seller || req.user?.id || '210ea809-8d41-48e3-b76c-ed3ef9ef265f';

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'No hay ítems en la factura' });
        }

        await client.query('BEGIN');
        await assertAccountingPeriodOpen(client, tenantId, date || new Date());

        // ------------------------------------------------------------------
        // LÓGICA CLIENTE: UUID vs NIT MANUAL
        // ------------------------------------------------------------------
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(clientId);

        let dbClientId = null;
        let dbClientNit = null;

        if (isUUID) {
            dbClientId = clientId;
        } else {
            dbClientNit = clientId;
        }

        // ------------------------------------------------------------------
        // PASO A: Obtener Consecutivo
        // ------------------------------------------------------------------
        const sequenceData = await getNextSequence(client, tenantId, 'FACTURA');
        const invoiceNumber = sequenceData.fullNumber;
        console.log(`Generando factura ${invoiceNumber} para tenant ${tenantId}`);

        // ------------------------------------------------------------------
        // PASO B: Cálculos
        // ------------------------------------------------------------------
        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;
        let total = 0;

        const processedItems = items.map(item => {
            const lineBase = Number(item.unitPrice) * Number(item.quantity);
            const discountVal = lineBase * (Number(item.discount || 0) / 100);
            const baseAfterDiscount = lineBase - discountVal;
            const taxVal = baseAfterDiscount * (Number(item.tax || 0) / 100);
            const lineTotal = baseAfterDiscount + taxVal;

            subtotal += lineBase;
            discountAmount += discountVal;
            taxAmount += taxVal;
            total += lineTotal;

            return {
                ...item,
                lineBase,
                discountVal,
                taxVal,
                lineTotal
            };
        });

        // ------------------------------------------------------------------
        // PASO C: ENVÍO A DIAN vía Aliaddo
        // ------------------------------------------------------------------
        // Obtener resolución del tenant
        const tenantResolution = await client.query(
            `SELECT aliaddo_resolution_key, aliaddo_resolution_prefix, aliaddo_resolution_number,
                    aliaddo_resolution_range_start, aliaddo_resolution_range_end,
                    aliaddo_resolution_valid_from, aliaddo_resolution_valid_until,
                    aliaddo_invoicing_enabled, needs_electronic_invoice
             FROM tenants WHERE id = $1`,
            [tenantId]
        );
        const tenantConfig = tenantResolution.rows[0] || {};
        const useAliaddo = tenantConfig.needs_electronic_invoice && tenantConfig.aliaddo_invoicing_enabled;

        let cufe = null;
        let dianResult = { success: false, demoMode: !useAliaddo, trackId: null, xmlPath: null, dianResponse: {} };
        let relativePath = null;
        let fileName = null;

        if (useAliaddo && tenantConfig.aliaddo_resolution_key) {
            const resolution = {
                resolutionKey: tenantConfig.aliaddo_resolution_key,
                resolutionPrefix: tenantConfig.aliaddo_resolution_prefix || '',
                resolutionNumber: tenantConfig.aliaddo_resolution_number,
                resolutionRangeInitial: tenantConfig.aliaddo_resolution_range_start,
                resolutionRangeFinal: tenantConfig.aliaddo_resolution_range_end,
                resolutionValidFrom: tenantConfig.aliaddo_resolution_valid_from,
                resolutionValidUntil: tenantConfig.aliaddo_resolution_valid_until
            };

            const aliaddoInvoiceData = {
                consecutive: invoiceNumber.replace(/\D/g, '') || Date.now().toString().slice(-9),
                date: date || new Date().toISOString().split('T')[0],
                dueDate: date || new Date().toISOString().split('T')[0],
                paymentMeanCode: paymentMeanCode || '10',
                notes: notes || '',
                terms: terms || '',
                customer: {
                    name: clientName || 'CONSUMIDOR FINAL',
                    identification: dbClientNit || dbClientId || '222222222222',
                    identificationType: clientDocType || 'CC',
                    email: email || 'usuario@sinemail.com',
                    address: req.body.clientAddress || 'Calle 123 # 45-67',
                    city: req.body.clientCity || 'Bogotá',
                    cityCode: req.body.clientCityCode || '11001',
                    department: req.body.clientDepartment || 'Bogotá D.C.',
                    departmentCode: req.body.clientDepCode || '11',
                    phone: req.body.clientPhone || ''
                },
                items: processedItems.map(item => ({
                    item: item.item,
                    description: item.description || item.item || 'Producto',
                    reference: item.reference || '',
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    discount: Number(item.discount || 0),
                    tax: Number(item.tax || 0)
                }))
            };

            console.log('[Invoice] Enviando factura a DIAN via Aliaddo...');
            const aliaddoResult = await aliaddoService.createInvoice(aliaddoInvoiceData, resolution);

            cufe = aliaddoResult.cufe || null;
            dianResult = {
                success: aliaddoResult.success,
                demoMode: false,
                trackId: aliaddoResult.trackId || null,
                xmlPath: null,
                dianResponse: aliaddoResult.data || {}
            };

            console.log(`[Invoice] Aliaddo: ${aliaddoResult.success ? 'OK' : 'Error'} - CUFE: ${cufe}`);
        } else {
            console.log('[Invoice] Facturacion electronica no habilitada - guardando solo localmente');
            cufe = `LOCAL-${Date.now()}`;
            dianResult = { success: true, demoMode: true, trackId: null, xmlPath: null, dianResponse: {} };
        }

        const dianInvoiceNumber = invoiceNumber;
        relativePath = dianResult.xmlPath;
        fileName = relativePath ? `${dianInvoiceNumber}.xml` : null;

        // ------------------------------------------------------------------
        // PASO D: Insertar Cabecera (Invoices) - ✅ CON CAMPOS NUEVOS
        // ------------------------------------------------------------------
        // Calcular fechas para BD
        const now = new Date();
        const dateIssue = date || now.toISOString().split('T')[0];
        const dianStatus = useAliaddo
            ? (dianResult.success ? 'ENVIADA' : 'ERROR')
            : 'BORRADOR';

        const insertHeaderQuery = `
            INSERT INTO invoices (
                tenant_id,
                invoice_number,
                client_id,
                client_name,
                client_document_type,
                client_document_number,
                client_email,
                client_phone,
                client_address,
                client_city,
                client_department,
                date,
                due_date,
                created_by,
                subtotal,
                tax_amount,
                discount,
                total,
                dian_status,
                dian_response,
                cufe,
                xml_path,
                payment_method,
                notes,
                reference,
                payment_status,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21, $22, $23, $24, $25, $26, NOW(), NOW()
            )
            RETURNING id
        `;

        const headerValues = [
            tenantId,
            invoiceNumber,
            dbClientId,
            clientName,
            clientDocType || 'CC',
            dbClientNit || dbClientId || null,
            email || '',
            req.body.clientPhone || null,
            req.body.clientAddress || null,
            req.body.clientCity || null,
            req.body.clientDepartment || null,
            dateIssue,
            date || dateIssue,
            userIdToSave,
            subtotal,
            taxAmount,
            discountAmount,
            total,
            dianStatus,
            JSON.stringify(dianResult.dianResponse || {}),
            cufe,
            relativePath,
            paymentMethod || 'Contado',
            notes || '',
            reference || '',
            'PENDIENTE'
        ];

        const headerResult = await client.query(insertHeaderQuery, headerValues);
        const invoiceId = headerResult.rows[0].id;

        await upsertThirdParty(client, {
            tenantId,
            kind: 'CUSTOMER',
            sourceType: 'INVOICE',
            sourceId: invoiceId,
            documentType: clientDocType || 'CC',
            documentNumber: dbClientNit || dbClientId || `CLI-${invoiceId}`,
            name: clientName || 'CONSUMIDOR FINAL',
            email: email || null,
            phone: req.body.clientPhone || null,
            address: req.body.clientAddress || null,
            city: req.body.clientCity || null,
            department: req.body.clientDepartment || null,
            status: 'ACTIVO',
            metadata: { invoice_number: invoiceNumber }
        });

        try {
            await client.query(
                `UPDATE invoices
                 SET payment_status = 'PENDIENTE', updated_at = NOW()
                 WHERE id = $1`,
                [invoiceId]
            );
        } catch (_error) {
            // El esquema legacy no siempre tiene payment_status.
        }

        // ------------------------------------------------------------------
        // PASO E: Insertar Ítems - ✅ CON REFERENCE Y DESCRIPTION
        // ------------------------------------------------------------------
        // INVOICE_ITEMS_KARDEX_PATCH_v2
        for (const item of processedItems) {
            const __pid = item.productId || item.product_id || null;
            const __sid = item.serviceId || item.service_id || null;
            const __itype = __pid ? 'product' : (__sid ? 'service' : 'free');
            const __unitCost = Number(item.unitCost || item.unit_cost || 0) || null;

            const insertItemQuery = `
                INSERT INTO invoice_items (
                    invoice_id,
                    product_id,
                    service_id,
                    item_type,
                    unit_cost,
                    description,
                    quantity,
                    unit_price,
                    tax_rate,
                    tax_amount,
                    discount,
                    subtotal,
                    total,
                    unit,
                    created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
                )
            `;

            await client.query(insertItemQuery, [
                invoiceId,
                __pid,
                __sid,
                __itype,
                __unitCost,
                item.description || item.item || 'Item',
                item.quantity,
                item.unitPrice,
                item.tax || 0,
                item.taxVal,
                item.discountVal || 0,
                item.lineBase - item.discountVal,
                item.lineTotal,
                item.unit || 'und'
            ]);
        }

        // === KARDEX OUT por línea inventariable (vía insertMovementRaw) ===
        // No genera asiento aquí — el COGS se inyecta al asiento de la FV (ver más abajo).
        const __invMovementIds = [];
        let __totalCostOfSales = 0;
        for (const __it of processedItems) {
            const __pid = __it.productId || __it.product_id;
            if (!__pid) continue;
            const __pres = await client.query(
                'SELECT id, cost, is_inventoriable FROM products WHERE id = $1 AND tenant_id = $2',
                [__pid, tenantId]
            );
            if (!__pres.rows[0]) continue;
            const __prod = __pres.rows[0];
            if (__prod.is_inventoriable === false) continue;

            const __qty = Number(__it.quantity || 0);
            if (!(__qty > 0)) continue;

            // unitCost: el avg lo recalcula insertMovementRaw a partir del balance previo;
            // para OUT solo importa que exista costo previo. Pasamos el cost del producto
            // como hint si no hay balance (caso borde: producto sin movimientos previos).
            const { movement } = await insertMovementRaw(client, tenantId, {
                productId: __pid,
                type: 'OUT',
                quantity: __qty,
                unitCost: Number(__prod.cost) || 0,
                documentType: 'INVOICE',
                documentId: invoiceId,
                documentNumber: invoiceNumber,
                date: dateIssue,
                notes: `Venta - factura ${invoiceNumber}`,
                userId: userIdToSave,
            });
            __invMovementIds.push(movement.id);
            __totalCostOfSales += Number(movement.quantity) * Number(movement.average_cost);
        }
        const __invMarker = { totalCostOfSales: Math.round(__totalCostOfSales * 100) / 100, movementIds: __invMovementIds };

        const receivableResult = await createAccountsReceivableFromInvoice(client, tenantId, {
            invoiceId,
            invoiceNumber,
            clientName,
            clientDocType: clientDocType || 'CC',
            clientDocumentNumber: dbClientNit || dbClientId,
            issueDate: dateIssue,
            dueDate: date || dateIssue,
            total,
            currency: 'COP',
            notes
        }, userIdToSave);

        // ------------------------------------------------------------------
        // PASO F: Asiento contable automático (antes del COMMIT)
        // Usa accountingCoreService.insertJournalEntry driven by
        // accounting_document_configs (document_type='FACTURA').
        // ------------------------------------------------------------------
        const configResult = await client.query(
            `SELECT auto_post, debit_account_code, credit_account_code, tax_account_code
             FROM accounting_document_configs
             WHERE tenant_id = $1 AND document_type = 'FACTURA'`,
            [tenantId]
        );
        const docConfig = configResult.rows[0] || { auto_post: true };

        const settingsResult = await client.query(
            `SELECT * FROM accounting_settings WHERE tenant_id = $1`,
            [tenantId]
        );
        const s = settingsResult.rows[0] || {};

        // Cuentas efectivas (settings > docConfig > default CO PUC)
        const arAccount = s.accounts_receivable_code || docConfig.debit_account_code || '130505';
        const revenueAccount = s.revenue_account_code || docConfig.credit_account_code || '413595';
        const vatAccount = s.vat_generated_code || docConfig.tax_account_code || '240805';

        // Guarda mínima: si no hay ninguna referencia a cuentas, pedir configuración
        if (!s.accounts_receivable_code && !docConfig.debit_account_code && !s.revenue_account_code && !docConfig.credit_account_code) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Configura primero las cuentas por defecto en Settings → Contabilidad maestra.'
            });
        }

        // Retenciones practicadas por el cliente a esta empresa (retenciones sufridas)
        // Se leen opcionalmente del body; si no vienen, 0.
        const retRenta = Number(req.body.retentionRenta || req.body.retRenta || 0);
        const retIca = Number(req.body.retentionIca || req.body.retIca || 0);
        const retIva = Number(req.body.retentionIva || req.body.retIva || 0);
        const totalRetenciones = retRenta + retIca + retIva;

        // Total cobrable neto al cliente (después de retenciones sufridas)
        const totalCobrable = Math.round((Number(total) - totalRetenciones) * 100) / 100;

        const thirdPartyDocument = dbClientNit || dbClientId || null;
        const thirdPartyName = clientName || 'CONSUMIDOR FINAL';

        let journalEntry = null;
        if (docConfig.auto_post !== false) {
            const description = `Factura venta ${invoiceNumber} - ${thirdPartyName}`;
            const entryDate = dateIssue;
            const lines = [];

            // Dr Clientes (neto cobrable)
            lines.push({
                account_code: arAccount,
                debit: totalCobrable,
                credit: 0,
                description,
                third_party_document: thirdPartyDocument,
                third_party_name: thirdPartyName,
            });

            // Dr Retenciones sufridas (si hay)
            if (retRenta > 0) {
                lines.push({
                    account_code: s.withholding_income_tax_suffered_code || s.withholding_suffered_renta_code || '135515',
                    debit: retRenta,
                    credit: 0,
                    description: `${description} - Retención renta sufrida`,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
            }
            if (retIca > 0) {
                lines.push({
                    account_code: s.withholding_ica_suffered_code || '135517',
                    debit: retIca,
                    credit: 0,
                    description: `${description} - ReteICA sufrida`,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
            }
            if (retIva > 0) {
                lines.push({
                    account_code: s.withholding_vat_suffered_code || '135518',
                    debit: retIva,
                    credit: 0,
                    description: `${description} - ReteIVA sufrida`,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
            }

            // Cr Ingresos (base gravable = subtotal - descuentos)
            const revenueBase = Math.round((Number(subtotal) - Number(discountAmount)) * 100) / 100;
            lines.push({
                account_code: revenueAccount,
                debit: 0,
                credit: revenueBase,
                description,
                third_party_document: thirdPartyDocument,
                third_party_name: thirdPartyName,
            });

            // Cr IVA generado (si hay)
            if (Number(taxAmount) > 0) {
                lines.push({
                    account_code: vatAccount,
                    debit: 0,
                    credit: Math.round(Number(taxAmount) * 100) / 100,
                    description: `${description} - IVA generado`,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
            }

            // === Líneas Costo de ventas / Salida de inventario (kardex) ===
            if (__invMarker && __invMarker.totalCostOfSales > 0) {
                const __cv = __invMarker.totalCostOfSales;
                const __cogsAccount = (s && s.cost_account_code) || '613595';
                const __invAccount = (s && s.inventory_account_code) || '143505';
                lines.push({
                    account_code: __cogsAccount,
                    debit: __cv,
                    credit: 0,
                    description: description + ' - Costo de ventas',
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
                lines.push({
                    account_code: __invAccount,
                    debit: 0,
                    credit: __cv,
                    description: description + ' - Salida de inventario',
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName,
                });
            }

            journalEntry = await accountingCoreService.insertJournalEntry(client, tenantId, {
                description,
                documentType: 'FACTURA_VENTA',
                documentId: invoiceId,
                documentNumber: invoiceNumber,
                entryDate,
                lines,
                userId: userIdToSave,
            });

            // Vincular journal_entry_id a los movimientos de inventario para trazabilidad
            if (journalEntry && __invMarker && __invMarker.movementIds && __invMarker.movementIds.length > 0) {
                await client.query(
                    `UPDATE inventory_movements SET journal_entry_id = $1
                     WHERE id = ANY($2::int[]) AND tenant_id = $3`,
                    [journalEntry.id, __invMarker.movementIds, tenantId]
                );
            }
        }

        // Mantener la variable journalResult para el audit log (compatibilidad)
        const journalResult = journalEntry;

        // ------------------------------------------------------------------
        // PASO G: Confirmar (Commit)
        // ------------------------------------------------------------------
        await client.query('COMMIT');

        await recordAccountingAuditEvent({
            tenantId,
            userId: userIdToSave,
            category: 'ventas',
            action: 'invoice.created',
            entityType: 'invoice',
            entityId: invoiceId,
            entityNumber: invoiceNumber,
            documentType: 'FACTURA',
            documentId: invoiceId,
            documentNumber: invoiceNumber,
            message: 'Factura creada y contabilizada',
            afterData: {
                invoice: {
                    id: invoiceId,
                    number: invoiceNumber,
                    clientName,
                    total,
                    subtotal,
                    taxAmount,
                    discountAmount,
                    cufe,
                    dianStatus
                },
                receivable: receivableResult,
                journal: journalResult,
                dian: dianResult
            },
            metadata: {
                paymentMethod: paymentMethod || 'Contado',
                paymentMeanCode: paymentMeanCode || '10',
                source: 'invoiceController.createInvoice'
            },
            context: {
                ip: req.ip,
                userAgent: req.headers?.['user-agent'] || null
            }
        });

        res.status(201).json({
            success: true,
            message: dianResult.demoMode
                ? 'Factura creada correctamente (DIAN en modo DEMO)'
                : 'Factura creada y enviada a DIAN',
            invoice: {
                id: invoiceId,
                number: invoiceNumber,
                dianNumber: dianInvoiceNumber,
                client: clientName,
                total: total,
                cufe: cufe,
                date: dateIssue,
                paymentMethod: paymentMethod || 'Contado',
                documentType: documentType || 'Factura de venta'
            },
            dian: {
                success: dianResult.success,
                demoMode: dianResult.demoMode || false,
                cufe: cufe,
                trackId: dianResult.trackId,
                xmlPath: dianResult.xmlPath,
                statusCode: dianResult.dianResponse?.StatusCode || '00',
                statusMessage: dianResult.dianResponse?.StatusDescription || 'Procesado'
            },
            journalEntry: journalEntry
                ? { id: journalEntry.id, entryNumber: journalEntry.entryNumber }
                : null
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error en transacción de factura:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

const getInvoices = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });

        const { clientDocumentNumber, clientName, clientId, status, dianStatus, search, startDate, endDate } = req.query || {};

        const conditions = ['i.tenant_id = $1'];
        const params = [tenantId];
        let idx = 2;

        if (clientDocumentNumber && clientName) {
            conditions.push(`(i.client_document_number = $${idx} OR i.client_name ILIKE $${idx + 1})`);
            params.push(String(clientDocumentNumber));
            params.push(`%${clientName}%`);
            idx += 2;
        } else if (clientDocumentNumber) {
            conditions.push(`i.client_document_number = $${idx++}`);
            params.push(String(clientDocumentNumber));
        } else if (clientName) {
            conditions.push(`i.client_name ILIKE $${idx++}`);
            params.push(`%${clientName}%`);
        }
        if (clientId) {
            conditions.push(`i.client_id = $${idx++}`);
            params.push(clientId);
        }
        if (status) {
            conditions.push(`i.status = $${idx++}`);
            params.push(String(status));
        }
        if (dianStatus) {
            // Matchea valor exacto y variantes con sufijo (_MOCK, _REAL).
            const base = String(dianStatus);
            conditions.push(`i.dian_status IN ($${idx}, $${idx + 1}, $${idx + 2})`);
            params.push(base, `${base}_MOCK`, `${base}_REAL`);
            idx += 3;
        }
        if (search) {
            const term = `%${String(search).trim()}%`;
            conditions.push(`(i.invoice_number ILIKE $${idx} OR i.client_name ILIKE $${idx} OR COALESCE(i.client_document_number, '') ILIKE $${idx})`);
            params.push(term);
            idx++;
        }
        if (startDate) {
            conditions.push(`i.date >= $${idx++}`);
            params.push(startDate);
        }
        if (endDate) {
            conditions.push(`i.date <= $${idx++}`);
            params.push(endDate);
        }

        const query = `
            SELECT
                i.id,
                i.invoice_number,
                i.client_id,
                i.client_name,
                i.client_document_type,
                i.client_document_number,
                i.client_email,
                i.date,
                i.date AS date_issue,
                i.due_date,
                i.status,
                i.dian_status,
                i.total,
                i.subtotal,
                i.tax_amount,
                i.discount,
                i.cufe,
                i.payment_method,
                i.payment_status,
                i.created_at,
                i.updated_at,
                COALESCE(ar.paid_amount, 0)::numeric AS paid_amount,
                COALESCE(ar.balance_amount, i.total)::numeric AS balance_amount
            FROM invoices i
            LEFT JOIN accounts_receivable ar
                ON ar.invoice_id = i.id AND ar.tenant_id = i.tenant_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY i.date DESC, i.created_at DESC
        `;

        const result = await pool.query(query, params);

        res.status(200).json({
            success: true,
            invoices: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("Error obteniendo facturas:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const getInvoiceById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const { id } = req.params;
        const numericId = Number.parseInt(id, 10);
        if (!Number.isInteger(numericId)) {
            return res.status(400).json({ success: false, error: 'ID inválido' });
        }
        const inv = await pool.query(
            `SELECT i.*,
                    i.date AS date_issue,
                    COALESCE(ar.paid_amount, 0)::numeric AS paid_amount,
                    COALESCE(ar.balance_amount, i.total)::numeric AS balance_amount
             FROM invoices i
             LEFT JOIN accounts_receivable ar
                 ON ar.invoice_id = i.id AND ar.tenant_id = i.tenant_id
             WHERE i.tenant_id = $1 AND i.id = $2 LIMIT 1`,
            [tenantId, numericId]
        );
        if (inv.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }
        const items = await pool.query(
            `SELECT id, description, quantity, unit_price, tax_rate, tax_amount, discount, subtotal, total
             FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
            [numericId]
        );
        res.json({ success: true, invoice: { ...inv.rows[0], items: items.rows } });
    } catch (error) {
        console.error('Error getInvoiceById:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ✅ Descargar y ver XML (sin cambios)
const downloadInvoiceXML = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;

        const query = `
            SELECT xml_path, xml_filename, invoice_number
            FROM invoices 
            WHERE id = $1 AND tenant_id = $2
        `;

        const result = await pool.query(query, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const invoice = result.rows[0];
        const path = require('path');
        const filePath = path.join(__dirname, '..', '..', 'public', invoice.xml_path);

        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo XML no encontrado' });
        }

        res.download(filePath, invoice.xml_filename, (err) => {
            if (err) {
                console.error('Error descargando XML:', err);
                res.status(500).json({ error: 'Error al descargar el archivo' });
            }
        });

    } catch (error) {
        console.error("Error descargando XML:", error);
        res.status(500).json({ error: error.message });
    }
};

const viewInvoiceXML = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id;

        const query = `
            SELECT xml_path, invoice_number
            FROM invoices 
            WHERE id = $1 AND tenant_id = $2
        `;

        const result = await pool.query(query, [id, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        const invoice = result.rows[0];
        const path = require('path');
        const filePath = path.join(__dirname, '..', '..', 'public', invoice.xml_path);

        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo XML no encontrado' });
        }

        const xmlContent = fs.readFileSync(filePath, 'utf-8');
        res.set('Content-Type', 'application/xml');
        res.send(xmlContent);

    } catch (error) {
        console.error("Error viendo XML:", error);
        res.status(500).json({ error: error.message });
    }
};

const getNextInvoiceNumber = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant requerido' });

        const rawClass = String(req.query?.class || req.query?.invoiceClass || 'ELECTRONICA').toUpperCase();
        const invoiceClass = rawClass === 'INTERNA' ? 'INTERNA' : 'ELECTRONICA';

        const tRes = await pool.query(
            `SELECT alegra_resolution_prefix, alegra_resolution_start, alegra_resolution_end,
                    alegra_resolution_number, alegra_invoicing_enabled,
                    alegra_test_set_status, alegra_company_id, tax_id, business_name, tax_id_type,
                    internal_invoice_prefix
             FROM tenants WHERE id = $1`,
            [tenantId]
        );
        const t = tRes.rows[0] || {};

        if (invoiceClass === 'INTERNA') {
            // Consecutivo interno: MAX de invoice_number para invoice_class='INTERNA' + 1.
            // Si aún no hay ninguna interna, empieza en 1. Prefijo sale del tenant.
            const internalMaxRes = await pool.query(
                `SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '\\D', '', 'g'), '')::bigint), 0)::bigint AS max_num
                 FROM invoices
                 WHERE tenant_id = $1 AND invoice_class = 'INTERNA'
                   AND invoice_number IS NOT NULL AND invoice_number <> ''`,
                [tenantId]
            );
            // También considerar document_sequences para alinearse con el contador usado al crear
            const seqRes = await pool.query(
                `SELECT current_number, prefix FROM document_sequences
                 WHERE tenant_id = $1 AND document_type = 'FACTURA_INTERNA'`,
                [tenantId]
            );
            const maxInvoice = Number(internalMaxRes.rows[0]?.max_num || 0);
            const seqCurrent = Number(seqRes.rows[0]?.current_number || 0);
            const next = Math.max(maxInvoice, seqCurrent) + 1;
            const prefix = seqRes.rows[0]?.prefix || t.internal_invoice_prefix || 'INT';

            return res.json({
                success: true,
                invoiceClass: 'INTERNA',
                nextNumber: String(next),
                prefix,
                preview: `${prefix}-${next}`,
                invoicingReady: true,
                invoicingEnabled: true,
                resolutionConfigured: true
            });
        }

        const maxRes = await pool.query(
            `SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '\\D', '', 'g'), '')::bigint), 0)::bigint AS max_num
             FROM invoices
             WHERE tenant_id = $1 AND invoice_number IS NOT NULL AND invoice_number <> ''
               AND (invoice_class IS NULL OR invoice_class = 'ELECTRONICA')`,
            [tenantId]
        );
        const maxExisting = Number(maxRes.rows[0]?.max_num || 0);
        const resStart = Number(t.alegra_resolution_start || 0);
        const resEnd = Number(t.alegra_resolution_end || 0);

        let next;
        if (resStart > 0 && maxExisting < resStart) {
            next = resStart;
        } else {
            next = maxExisting + 1;
        }

        const hasCompanyData = !!(t.tax_id && t.business_name && t.tax_id_type);
        const companyRegistered = !!t.alegra_company_id;
        const testSetApproved = t.alegra_test_set_status === 'APROBADO';
        const resolutionConfigured = !!t.alegra_resolution_number;
        const invoicingReady = hasCompanyData && companyRegistered && testSetApproved && resolutionConfigured;
        const invoicingEnabled = !!t.alegra_invoicing_enabled;

        res.json({
            success: true,
            invoiceClass: 'ELECTRONICA',
            nextNumber: String(next),
            prefix: t.alegra_resolution_prefix || null,
            resolutionRange: resStart > 0 ? { start: resStart, end: resEnd } : null,
            invoicingReady,
            invoicingEnabled,
            resolutionConfigured
        });
    } catch (error) {
        console.error('[Invoices] Error obteniendo siguiente consecutivo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Edita una factura SOLO si está en BORRADOR y no fue emitida a DIAN.
// Para facturas emitidas, hay que usar nota crédito.
const updateInvoice = async (req, res) => {
    const client = await pool.connect();
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const numericId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(numericId)) {
            return res.status(400).json({ success: false, error: 'ID inválido' });
        }
        const current = await client.query(
            `SELECT id, status, dian_status, cufe FROM invoices WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [numericId, tenantId]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }
        const inv = current.rows[0];
        if (inv.status !== 'BORRADOR' || inv.cufe || ['APROBADA', 'ENVIADA', 'APROBADA_MOCK', 'APROBADA_REAL'].includes(inv.dian_status)) {
            return res.status(409).json({
                success: false,
                error: 'No se puede editar una factura emitida o enviada a DIAN. Use una nota crédito.'
            });
        }

        const b = req.body || {};
        await client.query('BEGIN');
        await client.query(
            `UPDATE invoices SET
                client_name = COALESCE($1, client_name),
                client_document_type = COALESCE($2, client_document_type),
                client_document_number = COALESCE($3, client_document_number),
                client_email = COALESCE($4, client_email),
                client_phone = COALESCE($5, client_phone),
                client_address = COALESCE($6, client_address),
                client_city = COALESCE($7, client_city),
                client_department = COALESCE($8, client_department),
                date = COALESCE($9, date),
                due_date = COALESCE($10, due_date),
                notes = COALESCE($11, notes),
                payment_method = COALESCE($12, payment_method),
                payment_form = COALESCE($13, payment_form),
                updated_at = NOW()
             WHERE id = $14 AND tenant_id = $15`,
            [
                b.clientName ?? null,
                b.clientDocType ?? null,
                b.clientNit ?? null,
                b.email ?? null,
                b.clientPhone ?? null,
                b.clientAddress ?? null,
                b.clientCity ?? null,
                b.clientDepartment ?? null,
                b.date ?? null,
                b.dueDate ?? null,
                b.notes ?? null,
                b.paymentMethod ?? null,
                b.paymentForm ? String(b.paymentForm).toUpperCase() : null,
                numericId,
                tenantId,
            ]
        );

        // Si vienen items nuevos, reemplazar los existentes y recalcular totales.
        if (Array.isArray(b.items)) {
            await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [numericId]);
            const round2 = (n) => Math.round(n * 100) / 100;
            let subtotal = 0, discount = 0, tax = 0;
            for (const item of b.items) {
                const qty = Number(item.quantity) || 1;
                const unit = Number(item.unitPrice ?? item.price ?? item.unit_price) || 0;
                const discPct = Number(item.discount) || 0;
                const taxRate = Number(item.taxRate ?? item.tax ?? item.tax_rate) || 0;
                const lineBase = qty * unit;
                const lineDisc = round2(lineBase * (discPct / 100));
                const lineNet = lineBase - lineDisc;
                const lineTax = round2(lineNet * (taxRate / 100));
                subtotal += lineBase; discount += lineDisc; tax += lineTax;
                await client.query(
                    `INSERT INTO invoice_items (
                        invoice_id, product_id, description, quantity, unit, unit_price,
                        tax_rate, tax_amount, discount, subtotal, total, cost_center
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        numericId,
                        Number.isFinite(Number(item.productId ?? item.product_id)) ? Number(item.productId ?? item.product_id) : null,
                        item.description || item.item || '',
                        qty,
                        item.unit || null,
                        unit,
                        taxRate,
                        lineTax,
                        lineDisc,
                        round2(lineNet),
                        round2(lineNet + lineTax),
                        item.costCenter || item.cost_center || null
                    ]
                );
            }
            await client.query(
                `UPDATE invoices SET subtotal = $1, discount = $2, tax_amount = $3, total = $4, updated_at = NOW()
                 WHERE id = $5 AND tenant_id = $6`,
                [round2(subtotal), round2(discount), round2(tax), round2(subtotal - discount + tax), numericId, tenantId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, id: numericId });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error updateInvoice:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

// Anula una factura. Reglas:
// - BORRADOR sin CUFE: cambia a ANULADA, reversa CxC, marca timestamps.
// - Emitida a DIAN: 409, exige nota crédito.
const cancelInvoice = async (req, res) => {
    const client = await pool.connect();
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const userId = req.user?.id || null;
        const numericId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(numericId)) {
            return res.status(400).json({ success: false, error: 'ID inválido' });
        }
        const reason = (req.body?.reason || 'Anulada por usuario').toString().slice(0, 500);

        const current = await client.query(
            `SELECT id, status, dian_status, cufe FROM invoices WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [numericId, tenantId]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }
        const inv = current.rows[0];
        if (inv.status === 'ANULADA') {
            return res.status(409).json({ success: false, error: 'La factura ya está anulada' });
        }
        if (inv.cufe || ['APROBADA', 'ENVIADA', 'APROBADA_MOCK', 'APROBADA_REAL'].includes(inv.dian_status)) {
            return res.status(409).json({
                success: false,
                error: 'No se puede anular directamente una factura emitida a DIAN. Cree una nota crédito.'
            });
        }

        await client.query('BEGIN');
        await client.query(
            `UPDATE invoices SET
                status = 'ANULADA',
                cancelled_at = NOW(),
                cancelled_by = $1,
                cancellation_reason = $2,
                updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4`,
            [userId, reason, numericId, tenantId]
        );
        await client.query(
            `UPDATE accounts_receivable SET status = 'ANULADA', updated_at = NOW()
             WHERE invoice_id = $1 AND tenant_id = $2`,
            [numericId, tenantId]
        );
        await client.query('COMMIT');
        res.json({ success: true, id: numericId, status: 'ANULADA' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error cancelInvoice:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

const downloadInvoicePDF = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) return res.status(401).json({ success: false, error: 'Tenant no autenticado' });
        const numericId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(numericId)) {
            return res.status(400).json({ success: false, error: 'ID inválido' });
        }

        const invRes = await pool.query(
            `SELECT i.*,
                    COALESCE(ar.paid_amount, 0)::numeric AS paid_amount,
                    COALESCE(ar.balance_amount, i.total)::numeric AS balance_amount
             FROM invoices i
             LEFT JOIN accounts_receivable ar
                 ON ar.invoice_id = i.id AND ar.tenant_id = i.tenant_id
             WHERE i.tenant_id = $1 AND i.id = $2 LIMIT 1`,
            [tenantId, numericId]
        );
        if (invRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }
        const invoice = invRes.rows[0];

        const itemsRes = await pool.query(
            `SELECT description, quantity, unit_price, tax_rate, tax_amount, discount, subtotal, total
             FROM invoice_items WHERE invoice_id = $1 ORDER BY id`,
            [numericId]
        );

        const tenantRes = await pool.query(
            `SELECT business_name AS name, tax_id, address, phone, email
             FROM tenants WHERE id = $1 LIMIT 1`,
            [tenantId]
        );
        const tenant = tenantRes.rows[0] || { name: 'Emisor' };

        const { streamInvoicePdf } = require('../services/invoicePdfService');
        streamInvoicePdf({ invoice, items: itemsRes.rows, tenant, res });
    } catch (error) {
        console.error('Error generando PDF factura:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = { createInvoice, getInvoices, getInvoiceById, downloadInvoiceXML, viewInvoiceXML, downloadInvoicePDF, updateInvoice, cancelInvoice, getNextInvoiceNumber };





