const db = require('../config/db');
const { getDefaultAccountName, insertJournalEntry } = require('./accountingCoreService');
const { upsertThirdParty } = require('../helpers/thirdPartyHelper');
const { getNextSequence } = require('../helpers/sequenceHelper');
const { insertMovementRaw } = require('../controllers/kardexController');

// Inserta movimientos de inventario "IN" para cada línea con product_id de una FC.
// El asiento contable de la FC ya cubre Dr Inventario / Cr CxP, así que NO creamos
// asiento aquí — sólo registramos en kardex y vinculamos journal_entry_id.
const recordPurchaseInventoryEntries = async (client, tenantId, { items, payable, journalEntryId, userId }) => {
    const movements = [];
    for (const it of items) {
        if (!it.product_id || it.item_type === 'service') continue;
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) continue;
        const unitCost = qty > 0 ? round2(Number(it.base_amount || 0) / qty) : 0;
        const { movement } = await insertMovementRaw(client, tenantId, {
            productId: it.product_id,
            type: 'IN',
            quantity: qty,
            unitCost,
            documentType: 'FACTURA_PROVEEDOR',
            documentId: payable.id,
            documentNumber: payable.document_number,
            date: payable.issue_date,
            notes: `Entrada por ${payable.document_number}`,
            userId,
        });
        if (journalEntryId) {
            await client.query(
                `UPDATE inventory_movements SET journal_entry_id = $1 WHERE id = $2`,
                [journalEntryId, movement.id]
            );
        }
        movements.push(movement);
    }
    return movements;
};

// Inserta movimientos en bank_transactions para los métodos de pago no-efectivo
// que apunten a una cuenta registrada en tenant_banks. Devuelve los ids creados.
const recordPaymentBankTransactions = async (client, tenantId, {
    paymentMethods, applicationIds, sourceNumber, paymentDate, reference, notes, userId,
}) => {
    const inserted = [];
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) return inserted;
    // Tomamos el primer applicationId como link (usual: 1 pago = 1 aplicación principal).
    const linkId = applicationIds && applicationIds.length > 0 ? applicationIds[0] : null;
    for (const m of paymentMethods) {
        const code = m.bankAccountCode || m.bank_account_code || null;
        if (!code) continue;
        const methodUpper = String(m.method || '').toUpperCase();
        if (methodUpper === 'CASH' || methodUpper === 'EFECTIVO') continue;
        const bankRes = await client.query(
            `SELECT id FROM tenant_banks WHERE tenant_id = $1 AND account_code = $2 AND is_active = true LIMIT 1`,
            [tenantId, code]
        );
        if (bankRes.rows.length === 0) continue;
        const bankId = bankRes.rows[0].id;
        const insRes = await client.query(
            `INSERT INTO bank_transactions (
                tenant_id, bank_id, transaction_date, description, reference,
                transaction_type, amount, source, source_id, status, notes, created_by
             ) VALUES (
                $1, $2, $3, $4, $5, 'CARGO', $6, 'PAGO_CXP', $7, 'PENDIENTE', $8, $9
             ) RETURNING id`,
            [
                tenantId, bankId,
                paymentDate || new Date(),
                `Pago CxP ${sourceNumber}`,
                reference || null,
                round2(m.amount),
                linkId,
                notes || null,
                userId || null,
            ]
        );
        inserted.push(insRes.rows[0].id);
    }
    return inserted;
};

// Reversa movimientos de inventario de una FC. Calcula el saldo neto activo por
// producto (IN totales menos OUT reversos previos) y emite un único OUT por la
// diferencia. Esto evita doble-revertir cuando ya hubo ediciones previas.
const reversePurchaseInventoryEntries = async (client, tenantId, { payableId, payableNumber, userId }) => {
    const aggRes = await client.query(
        `SELECT product_id,
                SUM(CASE WHEN movement_type = 'IN' AND document_type = 'FACTURA_PROVEEDOR' THEN quantity ELSE 0 END) AS in_qty,
                SUM(CASE WHEN movement_type = 'OUT' AND document_type = 'FACTURA_PROVEEDOR_REV' THEN quantity ELSE 0 END) AS out_qty
         FROM inventory_movements
         WHERE tenant_id = $1 AND document_id = $2
         GROUP BY product_id`,
        [tenantId, payableId]
    );
    const reversed = [];
    for (const row of aggRes.rows) {
        const activeQty = Number(row.in_qty) - Number(row.out_qty);
        if (activeQty <= 0) continue;
        // costo unitario = último IN activo de ese producto en esta FC
        const lastInRes = await client.query(
            `SELECT unit_cost FROM inventory_movements
             WHERE tenant_id = $1 AND document_id = $2 AND product_id = $3
               AND movement_type = 'IN' AND document_type = 'FACTURA_PROVEEDOR'
             ORDER BY id DESC LIMIT 1`,
            [tenantId, payableId, row.product_id]
        );
        const unitCost = Number(lastInRes.rows[0]?.unit_cost || 0);
        const { movement } = await insertMovementRaw(client, tenantId, {
            productId: row.product_id,
            type: 'OUT',
            quantity: activeQty,
            unitCost,
            documentType: 'FACTURA_PROVEEDOR_REV',
            documentId: payableId,
            documentNumber: `${payableNumber || payableId}-REV`,
            notes: `Reverso ${payableNumber || payableId}`,
            userId,
        });
        reversed.push(movement);
    }
    return reversed;
};

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Normaliza una línea de factura de compra a un objeto uniforme con montos calculados.
// Acepta las claves que envía el front actual (Compras.tsx/CompraTab.tsx): expense_account_code, quantity, unit_price, discount_pct, iva_pct, rf_pct.
// También acepta puc_code (alias) y totales precalculados.
const normalizeLine = (raw, index) => {
    if (!raw || typeof raw !== 'object') return null;
    const pucCode = String(raw.puc_code || raw.expense_account_code || raw.account_code || '').trim();
    const pucName = String(raw.puc_name || raw.expense_account_name || raw.account_name || '').trim();
    const quantity = Number(raw.quantity) || 0;
    const unitPrice = Number(raw.unit_price ?? raw.unitPrice ?? raw.price ?? 0) || 0;
    const discountPct = Number(raw.discount_pct ?? raw.discountPct ?? raw.discount ?? 0) || 0;
    const ivaPct = Number(raw.iva_pct ?? raw.ivaPct ?? raw.tax ?? 0) || 0;
    const rfPct = Number(raw.rf_pct ?? raw.rfPct ?? 0) || 0;

    const subtotal = round2(quantity * unitPrice);
    const discount = round2(subtotal * (discountPct / 100));
    const base = round2(subtotal - discount);
    const iva = round2(base * (ivaPct / 100));
    const rf = round2(base * (rfPct / 100));
    const total = round2(base + iva - rf);

    const productId = raw.product_id ?? raw.productId ?? null;
    const serviceId = raw.service_id ?? raw.serviceId ?? null;
    const inferredItemType = productId ? 'product' : (serviceId ? 'service' : 'free');

    return {
        line_no: Number(raw.line_no) || (index + 1),
        concept_name: String(raw.concept_name || raw.item || raw.concept || '').slice(0, 255),
        description: String(raw.description || '').slice(0, 1000),
        puc_code: pucCode,
        puc_name: pucName,
        cost_center: raw.cost_center ? String(raw.cost_center).slice(0, 100) : null,
        quantity,
        unit_price: unitPrice,
        discount_pct: discountPct,
        iva_pct: ivaPct,
        rf_pct: rfPct,
        subtotal_amount: subtotal,
        discount_amount: discount,
        base_amount: base,
        iva_amount: iva,
        rf_amount: rf,
        line_total: total,
        notes: raw.notes ? String(raw.notes).slice(0, 1000) : null,
        product_id: productId ? Number(productId) : null,
        service_id: serviceId ? Number(serviceId) : null,
        item_type: String(raw.item_type || inferredItemType).slice(0, 10),
    };
};

const createAccountsPayableEntry = async ({ tenantId, userId, body }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const {
            supplierName,
            supplierDocumentType = 'NIT',
            supplierDocumentNumber,
            documentType = 'FACTURA_PROVEEDOR',
            documentNumber: documentNumberRaw,
            issueDate,
            dueDate,
            amount,
            subtotalAmount,
            taxAmount = 0,
            withholdingSourceAmount = 0,
            withholdingIcaAmount = 0,
            withholdingVatAmount = 0,
            expenseAccountCode,
            expenseAccountName,
            taxAccountCode,
            withholdingSourceCode,
            withholdingIcaCode,
            withholdingVatCode,
            paymentForm,
            creditTermDays,
            paymentMethod,
            internalNumber,
            isElectronic,
            notes,
            // Nuevos campos Alegra-style (acepta camelCase y snake_case)
            items: rawItems,
            warehouseCode,
            warehouseName,
            purchaseOrderNumber,
            termsAndConditions,
            printableNotes,
        } = body;
        const reteIvaPct = body.reteIvaPct ?? body.rete_iva_pct ?? 0;
        const reteIcaPct = body.reteIcaPct ?? body.rete_ica_pct ?? 0;
        const costCenter = body.costCenter ?? body.cost_center ?? null;
        const rawDiscountTotal = body.discountTotal ?? body.discount_total ?? 0;

        const internalNumberValue = internalNumber ? String(internalNumber).slice(0, 30) : null;
        const isElectronicValue = isElectronic === undefined || isElectronic === null
            ? true
            : (isElectronic === true || String(isElectronic).toLowerCase() === 'true' || isElectronic === 1 || isElectronic === '1');

        const paymentFormValue = (paymentForm === 'Credito' || paymentForm === 'Contado') ? paymentForm : 'Contado';
        const creditTermDaysValue = paymentFormValue === 'Credito' ? Math.max(parseInt(creditTermDays, 10) || 0, 0) : 0;
        const paymentMethodValue = paymentMethod ? String(paymentMethod).slice(0, 30) : null;

        let documentNumber = documentNumberRaw;
        if (!documentNumber && documentType === 'DS') {
            const dsSeq = await getNextSequence(client, tenantId, 'DS', 'DS');
            documentNumber = dsSeq.fullNumber;
        }

        // === Procesar items (modo Alegra multi-linea) ===
        const rawItemsArray = Array.isArray(rawItems) ? rawItems : [];
        const items = rawItemsArray
            .map((it, idx) => normalizeLine(it, idx))
            .filter(it => it && it.puc_code && it.quantity > 0 && it.unit_price >= 0);

        const hasLines = items.length > 0;

        // === Settings y códigos por defecto ===
        const settingsResult = await client.query(`SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
        const settings = settingsResult.rows[0] || {};
        const payableAccountCode = settings.accounts_payable_code || '220505';
        const resolvedTaxAccountCode = taxAccountCode || settings.vat_deductible_code || '240810';
        const resolvedWithholdingSourceCode = withholdingSourceCode || settings.withholding_source_code || '236540';
        const resolvedWithholdingIcaCode = withholdingIcaCode || settings.withholding_ica_code || '236801';
        const resolvedWithholdingVatCode = withholdingVatCode || settings.withholding_vat_code || '236703';

        // === Calcular totales ===
        // Si hay items[], los totales salen de ellos. Si no, se usan los del body (modo legacy).
        let subtotalValue, taxAmountValue, withholdingSourceValue, withholdingIcaValue, withholdingVatValue;
        let headerExpenseAccountCode, headerExpenseAccountName, discountTotalValue;

        if (hasLines) {
            subtotalValue = round2(items.reduce((s, it) => s + it.base_amount, 0));
            taxAmountValue = round2(items.reduce((s, it) => s + it.iva_amount, 0));
            // Retenciones: si el body envía montos > 0, son autoritativos (ya incluyen rf de líneas + globales).
            // Si todos son 0, calculamos: rf de líneas + reteIva% sobre IVA + reteIca xmil sobre base.
            const bodyRetSource = Math.max(Number(withholdingSourceAmount || 0), 0);
            const bodyRetIca = Math.max(Number(withholdingIcaAmount || 0), 0);
            const bodyRetVat = Math.max(Number(withholdingVatAmount || 0), 0);
            const anyBody = bodyRetSource > 0 || bodyRetIca > 0 || bodyRetVat > 0;
            if (anyBody) {
                withholdingSourceValue = bodyRetSource;
                withholdingIcaValue = bodyRetIca;
                withholdingVatValue = bodyRetVat;
            } else {
                const rfFromLines = round2(items.reduce((s, it) => s + it.rf_amount, 0));
                const reteIvaGlobalAmt = round2(taxAmountValue * (Number(reteIvaPct || 0) / 100));
                const reteIcaGlobalAmt = round2(subtotalValue * (Number(reteIcaPct || 0) / 1000));
                withholdingSourceValue = rfFromLines;
                withholdingIcaValue = reteIcaGlobalAmt;
                withholdingVatValue = reteIvaGlobalAmt;
            }
            discountTotalValue = round2(items.reduce((s, it) => s + it.discount_amount, 0));
            headerExpenseAccountCode = items[0].puc_code;
            headerExpenseAccountName = items[0].puc_name || getDefaultAccountName(items[0].puc_code);
        } else {
            // Legacy: flat fields
            taxAmountValue = Math.max(Number(taxAmount || 0), 0);
            withholdingSourceValue = Math.max(Number(withholdingSourceAmount || 0), 0);
            withholdingIcaValue = Math.max(Number(withholdingIcaAmount || 0), 0);
            withholdingVatValue = Math.max(Number(withholdingVatAmount || 0), 0);
            const totalWithholdings = withholdingSourceValue + withholdingIcaValue + withholdingVatValue;
            subtotalValue = subtotalAmount != null && subtotalAmount !== ''
                ? Math.max(Number(subtotalAmount || 0), 0)
                : Math.max(Number(amount || 0) - taxAmountValue + totalWithholdings, 0);
            discountTotalValue = Math.max(Number(rawDiscountTotal || 0), 0);
            headerExpenseAccountCode = expenseAccountCode;
            headerExpenseAccountName = expenseAccountName || (expenseAccountCode ? getDefaultAccountName(expenseAccountCode) : null);
        }

        const totalWithholdings = withholdingSourceValue + withholdingIcaValue + withholdingVatValue;
        const totalAmount = hasLines
            ? round2(subtotalValue + taxAmountValue - totalWithholdings)
            : Math.max(
                Number(amount != null && amount !== '' ? amount : (subtotalValue + taxAmountValue - totalWithholdings)),
                0
            );

        // === Validaciones ===
        if (!supplierName || !documentNumber) {
            const error = new Error('Proveedor y número de documento son obligatorios');
            error.statusCode = 400;
            throw error;
        }
        if (!hasLines && !headerExpenseAccountCode) {
            const error = new Error('Debe indicar al menos una línea o una cuenta de gasto');
            error.statusCode = 400;
            throw error;
        }
        if (subtotalValue <= 0 && taxAmountValue <= 0) {
            const error = new Error('La compra debe tener base o impuesto mayor a cero');
            error.statusCode = 400;
            throw error;
        }
        if (totalAmount <= 0) {
            const error = new Error('El neto por pagar debe ser mayor a cero');
            error.statusCode = 400;
            throw error;
        }

        // === INSERT accounts_payable ===
        const payableResult = await client.query(
            `INSERT INTO accounts_payable (
                tenant_id, supplier_name, supplier_document_type, supplier_document_number, supplier_phone,
                document_type, document_number, internal_number, is_electronic, issue_date, due_date,
                subtotal_amount, tax_amount, withholding_source_amount, withholding_ica_amount, withholding_vat_amount,
                original_amount, paid_amount, balance_amount, status,
                expense_account_code, expense_account_name, payable_account_code, tax_account_code,
                withholding_source_code, withholding_ica_code, withholding_vat_code,
                payment_form, credit_term_days, payment_method,
                currency, notes, created_by,
                warehouse_code, warehouse_name, purchase_order_number, terms_and_conditions, printable_notes,
                discount_total, reteiva_pct, reteica_pct, cost_center,
                created_at, updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,$17,'PENDIENTE',$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'COP',$28,$29,
                $30,$31,$32,$33,$34,$35,$36,$37,$38,
                NOW(),NOW()
            )
            RETURNING *`,
            [
                tenantId,
                supplierName,
                supplierDocumentType,
                supplierDocumentNumber || null,
                body.supplierPhone ? String(body.supplierPhone).slice(0, 50) : null,
                documentType,
                documentNumber,
                internalNumberValue,
                isElectronicValue,
                issueDate || new Date(),
                dueDate || issueDate || new Date(),
                subtotalValue,
                taxAmountValue,
                withholdingSourceValue,
                withholdingIcaValue,
                withholdingVatValue,
                totalAmount,
                headerExpenseAccountCode || null,
                headerExpenseAccountName || null,
                payableAccountCode,
                resolvedTaxAccountCode,
                resolvedWithholdingSourceCode,
                resolvedWithholdingIcaCode,
                resolvedWithholdingVatCode,
                paymentFormValue,
                creditTermDaysValue,
                paymentMethodValue,
                notes || null,
                userId || null,
                warehouseCode ? String(warehouseCode).slice(0, 50) : null,
                warehouseName ? String(warehouseName).slice(0, 255) : null,
                purchaseOrderNumber ? String(purchaseOrderNumber).slice(0, 50) : null,
                termsAndConditions || null,
                printableNotes || null,
                discountTotalValue,
                Number(reteIvaPct || 0),
                Number(reteIcaPct || 0),
                costCenter ? String(costCenter).slice(0, 100) : null,
            ]
        );

        const payable = payableResult.rows[0];

        // === INSERT líneas (si hay) ===
        if (hasLines) {
            for (const it of items) {
                await client.query(
                    `INSERT INTO accounts_payable_lines (
                        tenant_id, accounts_payable_id, line_no, concept_name, description, puc_code, puc_name, cost_center,
                        quantity, unit_price, discount_pct, iva_pct, rf_pct,
                        subtotal_amount, discount_amount, base_amount, iva_amount, rf_amount, line_total, notes,
                        product_id, service_id, item_type
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
                    [
                        tenantId, payable.id, it.line_no, it.concept_name || null, it.description || null,
                        it.puc_code, it.puc_name || getDefaultAccountName(it.puc_code), it.cost_center,
                        it.quantity, it.unit_price, it.discount_pct, it.iva_pct, it.rf_pct,
                        it.subtotal_amount, it.discount_amount, it.base_amount, it.iva_amount, it.rf_amount, it.line_total, it.notes,
                        it.product_id || null, it.service_id || null, it.item_type || null
                    ]
                );
            }
        }

        await upsertThirdParty(client, {
            tenantId,
            kind: 'SUPPLIER',
            sourceType: 'ACCOUNTS_PAYABLE',
            sourceId: payable.id,
            documentType: supplierDocumentType,
            documentNumber: supplierDocumentNumber || `PROV-${payable.id}`,
            name: supplierName,
            status: 'ACTIVO',
            metadata: {
                payable_document_number: payable.document_number,
                payable_document_type: payable.document_type
            }
        });

        // === Construir asiento: 1 débito por línea + débito IVA + crédito payable + créditos retenciones ===
        const journalLines = [];
        if (hasLines) {
            for (const it of items) {
                if (it.base_amount > 0) {
                    journalLines.push({
                        account_code: it.puc_code,
                        account_name: it.puc_name || getDefaultAccountName(it.puc_code),
                        description: it.concept_name || it.description || `Gasto ${documentNumber}`,
                        debit: it.base_amount,
                        credit: 0,
                        third_party_document: supplierDocumentNumber || null,
                        third_party_name: supplierName
                    });
                }
            }
        } else if (subtotalValue > 0) {
            journalLines.push({
                account_code: headerExpenseAccountCode,
                account_name: headerExpenseAccountName || getDefaultAccountName(headerExpenseAccountCode),
                description: notes || `Registro gasto proveedor ${supplierName}`,
                debit: subtotalValue,
                credit: 0,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }

        if (taxAmountValue > 0) {
            journalLines.push({
                account_code: resolvedTaxAccountCode,
                account_name: getDefaultAccountName(resolvedTaxAccountCode),
                description: `IVA descontable ${documentNumber}`,
                debit: taxAmountValue,
                credit: 0,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }

        journalLines.push({
            account_code: payableAccountCode,
            account_name: getDefaultAccountName(payableAccountCode),
            description: `Obligacion con proveedor ${supplierName}`,
            debit: 0,
            credit: totalAmount,
            third_party_document: supplierDocumentNumber || null,
            third_party_name: supplierName
        });

        if (withholdingSourceValue > 0) {
            journalLines.push({
                account_code: resolvedWithholdingSourceCode,
                account_name: getDefaultAccountName(resolvedWithholdingSourceCode),
                description: `Retefuente ${documentNumber}`,
                debit: 0,
                credit: withholdingSourceValue,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }
        if (withholdingIcaValue > 0) {
            journalLines.push({
                account_code: resolvedWithholdingIcaCode,
                account_name: getDefaultAccountName(resolvedWithholdingIcaCode),
                description: `ReteICA ${documentNumber}`,
                debit: 0,
                credit: withholdingIcaValue,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }
        if (withholdingVatValue > 0) {
            journalLines.push({
                account_code: resolvedWithholdingVatCode,
                account_name: getDefaultAccountName(resolvedWithholdingVatCode),
                description: `ReteIVA ${documentNumber}`,
                debit: 0,
                credit: withholdingVatValue,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }

        const journal = await insertJournalEntry(client, tenantId, {
            description: `CxP ${documentNumber} - ${supplierName}`,
            documentType: 'CUENTA_POR_PAGAR',
            documentId: payable.id,
            documentNumber,
            entryDate: issueDate || new Date(),
            lines: journalLines,
            userId
        });

        // Movimientos de inventario por las líneas con product_id (entradas).
        // Si falla, abortamos la transacción completa (mejor que dejar FC sin kardex).
        let inventoryMovements = [];
        try {
            inventoryMovements = await recordPurchaseInventoryEntries(client, tenantId, {
                items, payable, journalEntryId: journal?.id, userId,
            });
        } catch (kErr) {
            await client.query('ROLLBACK');
            const err = new Error(`Error registrando inventario: ${kErr.message}`);
            err.statusCode = 400;
            throw err;
        }

        await client.query('COMMIT');
        return { payable, journal, inventoryMovements };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const applyAccountsPayablePaymentEntry = async ({ tenantId, userId, body }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const {
            // Legacy single-invoice
            payableId,
            amount,
            // Nuevo multi-invoice
            invoices: rawInvoices,
            // Legacy single-method
            paymentMethod: legacyPaymentMethod,
            bankAccountCode: legacyBankCode,
            // Nuevo multi-method
            paymentMethods: rawPaymentMethods,

            paymentDate,
            reference,
            notes,

            // Retenciones TOTALES practicadas al comprobante
            withholdingSourceAmount = 0,
            withholdingIcaAmount = 0,
            withholdingVatAmount = 0,
            withholdingSourceCode,
            withholdingIcaCode,
            withholdingVatCode,
        } = body || {};

        const retSource = Math.max(Number(withholdingSourceAmount || 0), 0);
        const retIca = Math.max(Number(withholdingIcaAmount || 0), 0);
        const retVat = Math.max(Number(withholdingVatAmount || 0), 0);
        const totalWithholdings = retSource + retIca + retVat;

        // === Normalizar invoices ===
        let invoices = Array.isArray(rawInvoices) && rawInvoices.length > 0
            ? rawInvoices.map(i => ({
                payableId: Number(i.payableId || i.payable_id),
                amountApplied: Number(i.amountApplied || i.amount_applied || i.amount || 0),
            }))
            : null;

        if (!invoices) {
            // Legacy fallback: amount era el NETO, el bruto aplicado = neto + retenciones
            if (!payableId || amount == null) {
                const err = new Error('Debe enviar invoices[] o payableId+amount');
                err.statusCode = 400;
                throw err;
            }
            const netLegacy = Math.max(Number(amount || 0), 0);
            invoices = [{ payableId: Number(payableId), amountApplied: round2(netLegacy + totalWithholdings) }];
        }

        if (!invoices.length) {
            const err = new Error('invoices[] no puede estar vacio');
            err.statusCode = 400;
            throw err;
        }
        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            if (!inv.payableId || !(inv.amountApplied > 0)) {
                const err = new Error(`Factura #${i + 1}: payableId y amountApplied>0 son obligatorios`);
                err.statusCode = 400;
                throw err;
            }
        }

        // === Normalizar paymentMethods ===
        let paymentMethods = Array.isArray(rawPaymentMethods) && rawPaymentMethods.length > 0
            ? rawPaymentMethods.map(m => ({
                method: String(m.method || m.metodo || 'BANK_TRANSFER').toUpperCase(),
                amount: Math.max(Number(m.amount || m.monto || 0), 0),
                bankAccountCode: m.bankAccountCode || m.bank_account_code || null,
            }))
            : null;

        // === Cargar todas las cuentas por pagar del comprobante ===
        const payableIds = invoices.map(i => i.payableId);
        const payablesRes = await client.query(
            `SELECT * FROM accounts_payable
             WHERE id = ANY($1::int[]) AND tenant_id = $2
             FOR UPDATE`,
            [payableIds, tenantId]
        );
        if (payablesRes.rows.length !== payableIds.length) {
            const err = new Error('Una o mas cuentas por pagar no existen o no pertenecen al tenant');
            err.statusCode = 400;
            throw err;
        }
        const payablesById = new Map(payablesRes.rows.map(p => [Number(p.id), p]));

        // Validar monto no supere el saldo y sea > 0
        for (const inv of invoices) {
            const p = payablesById.get(Number(inv.payableId));
            const balance = Number(p.balance_amount || 0);
            if (inv.amountApplied > balance + 0.01) {
                const err = new Error(`Factura ${p.document_number}: amountApplied (${inv.amountApplied}) excede el saldo (${balance})`);
                err.statusCode = 400;
                throw err;
            }
        }

        const sumApplied = round2(invoices.reduce((s, i) => s + Number(i.amountApplied || 0), 0));
        const expectedNet = round2(sumApplied - totalWithholdings);
        if (expectedNet < -0.01) {
            const err = new Error('Las retenciones exceden el bruto aplicado a facturas');
            err.statusCode = 400;
            throw err;
        }

        // Si no hay paymentMethods, construir legacy a partir del neto calculado
        if (!paymentMethods) {
            const method = (legacyPaymentMethod || 'BANK_TRANSFER').toUpperCase();
            paymentMethods = [{
                method,
                amount: Math.max(expectedNet, 0),
                bankAccountCode: legacyBankCode || null,
            }];
        }
        paymentMethods = paymentMethods.filter(m => m.amount > 0);
        const sumMethods = round2(paymentMethods.reduce((s, m) => s + Number(m.amount || 0), 0));

        // Validacion central: sum(invoices.amountApplied) === sum(paymentMethods.amount) + retenciones
        if (Math.abs(sumApplied - (sumMethods + totalWithholdings)) > 0.01) {
            const err = new Error(
                `Descuadre: aplicado a facturas (${sumApplied}) != pagos (${sumMethods}) + retenciones (${totalWithholdings})`
            );
            err.statusCode = 400;
            throw err;
        }

        // === Cargar settings y resolver cuentas de retencion ===
        const settingsResult = await client.query(
            `SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`,
            [tenantId]
        );
        const settings = settingsResult.rows[0] || {};
        const resolvedRetSourceCode = withholdingSourceCode || settings.withholding_source_code || '236540';
        const resolvedRetIcaCode = withholdingIcaCode || settings.withholding_ica_code || '236801';
        const resolvedRetVatCode = withholdingVatCode || settings.withholding_vat_code || '236703';
        const defaultPayableCode = settings.accounts_payable_code || '220505';
        const cashCode = settings.cash_account_code || '110505';
        const bankCode = settings.bank_account_code || '111005';

        const resolveMethodAccount = (m) => {
            if (m.bankAccountCode) return String(m.bankAccountCode).slice(0, 20);
            const up = String(m.method || '').toUpperCase();
            if (up === 'CASH' || up.includes('EFECT')) return cashCode;
            return bankCode;
        };

        // === Generar UN solo sourceNumber ===
        const sequence = await getNextSequence(client, tenantId, 'CE', 'CE');
        const sourceNumber = sequence.fullNumber;

        // === Insertar una row de application por factura ===
        const applicationIds = [];
        const legacyMethodStr = paymentMethods.length === 1
            ? String(paymentMethods[0].method || '').slice(0, 30)
            : 'MIXTO';
        const legacyBankStr = paymentMethods.length === 1 && paymentMethods[0].bankAccountCode
            ? String(paymentMethods[0].bankAccountCode).slice(0, 20)
            : null;
        const referenceValue = reference ? String(reference).slice(0, 100) : null;
        const paymentMethodsJson = JSON.stringify(paymentMethods);

        const totalNet = Math.max(expectedNet, 0);
        const updatedPayables = [];

        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            const gross = round2(inv.amountApplied);
            const netPortion = sumApplied > 0 ? round2(gross * (totalNet / sumApplied)) : 0;
            const rowRetSource = sumApplied > 0 ? round2(gross * (retSource / sumApplied)) : 0;
            const rowRetIca = sumApplied > 0 ? round2(gross * (retIca / sumApplied)) : 0;
            const rowRetVat = sumApplied > 0 ? round2(gross * (retVat / sumApplied)) : 0;

            const insertRes = await client.query(
                `INSERT INTO accounts_payable_applications (
                    tenant_id, accounts_payable_id, source_type, source_id, source_number,
                    application_date, amount, notes, created_by, created_at,
                    status, payment_method, bank_account_code, reference,
                    gross_amount, withholding_source_amount, withholding_ica_amount, withholding_vat_amount,
                    withholding_source_code, withholding_ica_code, withholding_vat_code,
                    payment_methods
                ) VALUES ($1,$2,'PAGO_CXP',NULL,$3,$4,$5,$6,$7,NOW(),'ACTIVO',$8,$9,$10,
                         $11,$12,$13,$14,$15,$16,$17,$18::jsonb)
                RETURNING id`,
                [
                    tenantId, inv.payableId, sourceNumber, paymentDate || new Date(),
                    netPortion, notes || null, userId || null,
                    legacyMethodStr, legacyBankStr, referenceValue,
                    gross, rowRetSource, rowRetIca, rowRetVat,
                    rowRetSource > 0 ? resolvedRetSourceCode : null,
                    rowRetIca > 0 ? resolvedRetIcaCode : null,
                    rowRetVat > 0 ? resolvedRetVatCode : null,
                    paymentMethodsJson,
                ]
            );
            applicationIds.push(insertRes.rows[0].id);

            const updRes = await client.query(
                `UPDATE accounts_payable
                 SET paid_amount = ROUND((paid_amount + $1)::numeric, 2),
                     balance_amount = ROUND(GREATEST(original_amount - (paid_amount + $1), 0)::numeric, 2),
                     status = CASE
                        WHEN GREATEST(original_amount - (paid_amount + $1), 0) <= 0.009 THEN 'PAGADA'
                        WHEN (paid_amount + $1) > 0 THEN 'PARCIAL'
                        ELSE status
                     END,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [gross, inv.payableId]
            );
            updatedPayables.push(updRes.rows[0]);
        }

        // === Construir el asiento UNICO ===
        const firstPayable = updatedPayables[0];
        const firstSupplierDoc = firstPayable.supplier_document_number || null;
        const firstSupplierName = firstPayable.supplier_name;

        const lines = [];

        for (let i = 0; i < invoices.length; i++) {
            const inv = invoices[i];
            const p = updatedPayables[i];
            const payableAccount = p.payable_account_code || defaultPayableCode;
            lines.push({
                account_code: payableAccount,
                account_name: getDefaultAccountName(payableAccount),
                description: `Disminucion obligacion ${p.document_number}`,
                debit: round2(inv.amountApplied),
                credit: 0,
                third_party_document: p.supplier_document_number || null,
                third_party_name: p.supplier_name,
            });
        }

        for (const m of paymentMethods) {
            const acc = resolveMethodAccount(m);
            lines.push({
                account_code: acc,
                account_name: getDefaultAccountName(acc),
                description: `Salida ${m.method}`,
                debit: 0,
                credit: round2(m.amount),
                third_party_document: firstSupplierDoc,
                third_party_name: firstSupplierName,
            });
        }

        if (retSource > 0) {
            lines.push({
                account_code: resolvedRetSourceCode,
                account_name: getDefaultAccountName(resolvedRetSourceCode),
                description: `Retefuente practicada ${sourceNumber}`,
                debit: 0,
                credit: retSource,
                third_party_document: firstSupplierDoc,
                third_party_name: firstSupplierName,
            });
        }
        if (retIca > 0) {
            lines.push({
                account_code: resolvedRetIcaCode,
                account_name: getDefaultAccountName(resolvedRetIcaCode),
                description: `ReteICA practicada ${sourceNumber}`,
                debit: 0,
                credit: retIca,
                third_party_document: firstSupplierDoc,
                third_party_name: firstSupplierName,
            });
        }
        if (retVat > 0) {
            lines.push({
                account_code: resolvedRetVatCode,
                account_name: getDefaultAccountName(resolvedRetVatCode),
                description: `ReteIVA practicada ${sourceNumber}`,
                debit: 0,
                credit: retVat,
                third_party_document: firstSupplierDoc,
                third_party_name: firstSupplierName,
            });
        }

        const journal = await insertJournalEntry(client, tenantId, {
            description: `Pago CxP ${sourceNumber} - ${firstSupplierName}${invoices.length > 1 ? ' (+' + (invoices.length - 1) + ' facturas)' : ''}`,
            documentType: 'PAGO_CXP',
            documentId: firstPayable.id,
            documentNumber: sourceNumber,
            entryDate: paymentDate || new Date(),
            lines,
            userId,
        });

        // Crea bank_transactions para cada forma de pago no-efectivo cuyo
        // bankAccountCode mapee a una cuenta registrada en tenant_banks.
        const bankTransactionIds = await recordPaymentBankTransactions(client, tenantId, {
            paymentMethods,
            applicationIds,
            sourceNumber,
            paymentDate,
            reference: referenceValue,
            notes,
            userId,
        });

        await client.query('COMMIT');
        return {
            payable: firstPayable,
            payables: updatedPayables,
            journal,
            applicationIds,
            applicationId: applicationIds[0],
            sourceNumber,
            paymentAmount: totalNet,
            grossAmount: sumApplied,
            withholdings: { source: retSource, ica: retIca, vat: retVat },
            paymentMethod: legacyMethodStr,
            paymentMethods,
            bankTransactionIds,
            invoices,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const voidAccountsPayablePaymentEntry = async ({ tenantId, userId, applicationId, reason }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        if (!applicationId) {
            const err = new Error('applicationId requerido');
            err.statusCode = 400;
            throw err;
        }

        const appRes = await client.query(
            `SELECT * FROM accounts_payable_applications WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [applicationId, tenantId]
        );
        const clickedApp = appRes.rows[0];
        if (!clickedApp) {
            const err = new Error('Pago no encontrado');
            err.statusCode = 404;
            throw err;
        }
        if ((clickedApp.status || 'ACTIVO').toUpperCase() === 'ANULADO') {
            const err = new Error('El pago ya está anulado');
            err.statusCode = 400;
            throw err;
        }

        const sourceNumber = clickedApp.source_number;

        const allAppsRes = await client.query(
            `SELECT * FROM accounts_payable_applications
             WHERE tenant_id = $1 AND source_number = $2 AND source_type = 'PAGO_CXP'
             ORDER BY id ASC`,
            [tenantId, sourceNumber]
        );
        const allApps = allAppsRes.rows.filter(a => (a.status || 'ACTIVO').toUpperCase() !== 'ANULADO');
        if (allApps.length === 0) {
            const err = new Error('El comprobante no tiene aplicaciones activas');
            err.statusCode = 400;
            throw err;
        }

        const updatedPayables = [];
        let totalReversed = 0;
        for (const app of allApps) {
            const amount = Number(app.amount || 0);
            const retTotal = Number(app.withholding_source_amount || 0) + Number(app.withholding_ica_amount || 0) + Number(app.withholding_vat_amount || 0);
            const grossReversed = Number(app.gross_amount || 0) || (amount + retTotal);

            const payableRes = await client.query(
                `SELECT * FROM accounts_payable WHERE id = $1 AND tenant_id = $2 LIMIT 1 FOR UPDATE`,
                [app.accounts_payable_id, tenantId]
            );
            const payable = payableRes.rows[0];
            if (!payable) continue;

            const newPaid = Math.max(Number(payable.paid_amount || 0) - grossReversed, 0);
            const newBalance = Math.max(Number(payable.original_amount || 0) - newPaid, 0);
            let newStatus;
            if (newBalance <= 0.009) newStatus = 'PAGADA';
            else if (newPaid > 0) newStatus = 'PARCIAL';
            else newStatus = 'PENDIENTE';

            const updRes = await client.query(
                `UPDATE accounts_payable
                 SET paid_amount = $1, balance_amount = $2, status = $3, updated_at = NOW()
                 WHERE id = $4 RETURNING *`,
                [newPaid, newBalance, newStatus, payable.id]
            );
            updatedPayables.push(updRes.rows[0]);
            totalReversed += grossReversed;
        }

        const primarySupplier = updatedPayables[0]?.supplier_name || '';
        const origJournalRes = await client.query(
            `SELECT * FROM journal_entries
             WHERE tenant_id = $1 AND document_type = 'PAGO_CXP' AND document_number = $2
               AND (status IS NULL OR status <> 'REVERSADO')
             ORDER BY id DESC LIMIT 1`,
            [tenantId, sourceNumber]
        );

        let reverseEntry = null;
        if (origJournalRes.rows.length > 0) {
            const orig = origJournalRes.rows[0];
            const linesRes = await client.query(
                'SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id',
                [orig.id]
            );
            const reverseLines = linesRes.rows.map(l => ({
                account_code: l.account_code,
                account_name: l.account_name,
                description: 'REV: ' + (l.description || ''),
                debit: Number(l.credit || 0),
                credit: Number(l.debit || 0),
                third_party_document: l.third_party_document || null,
                third_party_name: l.third_party_name || null,
            }));

            reverseEntry = await insertJournalEntry(client, tenantId, {
                description: `REVERSO pago ${sourceNumber} - ${primarySupplier}${updatedPayables.length > 1 ? ' (+' + (updatedPayables.length - 1) + ' facturas)' : ''}`,
                documentType: 'REVERSO_PAGO_CXP',
                documentId: orig.id,
                documentNumber: sourceNumber,
                entryDate: new Date(),
                lines: reverseLines,
                userId,
            });

            await client.query(
                `UPDATE journal_entries SET status = 'REVERSADO', updated_at = NOW() WHERE id = $1`,
                [orig.id]
            );
        }

        await client.query(
            `UPDATE accounts_payable_applications
             SET status = 'ANULADO', voided_at = NOW(), voided_by = $1, void_reason = $2
             WHERE tenant_id = $3 AND source_number = $4 AND source_type = 'PAGO_CXP'
               AND (status IS NULL OR status <> 'ANULADO')`,
            [userId || null, reason || null, tenantId, sourceNumber]
        );

        // Marcar bank_transactions del pago como ANULADO (no se borran para preservar
        // auditoría y conciliaciones previas; si hay reconciliaciones activas el usuario
        // debe deshacerlas antes de verlas como pendientes).
        const voidedBankTxRes = await client.query(
            `UPDATE bank_transactions
             SET status = 'ANULADO', updated_at = NOW()
             WHERE tenant_id = $1 AND source = 'PAGO_CXP'
               AND source_id IN (SELECT id FROM accounts_payable_applications
                                 WHERE tenant_id = $1 AND source_number = $2 AND source_type = 'PAGO_CXP')
             RETURNING id`,
            [tenantId, sourceNumber]
        );

        await client.query('COMMIT');
        return {
            applicationId: clickedApp.id,
            sourceNumber,
            payable: updatedPayables[0],
            payables: updatedPayables,
            reverseEntry,
            reversedAmount: totalReversed,
            invoicesCount: updatedPayables.length,
            voidedBankTransactionIds: voidedBankTxRes.rows.map(r => r.id),
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const updateAccountsPayableEntry = async ({ tenantId, userId, payableId, body }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const existingResult = await client.query(
            `SELECT * FROM accounts_payable WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [payableId, tenantId]
        );
        const existing = existingResult.rows[0];
        if (!existing) {
            const error = new Error('Cuenta por pagar no encontrada');
            error.statusCode = 404;
            throw error;
        }

        if (Number(existing.paid_amount || 0) > 0) {
            const error = new Error('No se puede editar una factura de compra que ya tiene pagos aplicados. Reversá el pago primero.');
            error.statusCode = 409;
            throw error;
        }

        const {
            supplierName,
            supplierDocumentType = existing.supplier_document_type || 'NIT',
            supplierDocumentNumber,
            documentType = existing.document_type || 'FACTURA_PROVEEDOR',
            documentNumber,
            issueDate,
            dueDate,
            amount,
            subtotalAmount,
            taxAmount = 0,
            withholdingSourceAmount = 0,
            withholdingIcaAmount = 0,
            withholdingVatAmount = 0,
            expenseAccountCode,
            expenseAccountName,
            taxAccountCode,
            withholdingSourceCode,
            withholdingIcaCode,
            withholdingVatCode,
            notes,
            items: rawItems,
            warehouseCode,
            warehouseName,
            purchaseOrderNumber,
            termsAndConditions,
            printableNotes,
        } = body;
        const reteIvaPct = body.reteIvaPct ?? body.rete_iva_pct ?? 0;
        const reteIcaPct = body.reteIcaPct ?? body.rete_ica_pct ?? 0;
        const costCenter = body.costCenter ?? body.cost_center ?? null;
        const rawDiscountTotal = body.discountTotal ?? body.discount_total ?? 0;

        const rawItemsArray = Array.isArray(rawItems) ? rawItems : [];
        const items = rawItemsArray
            .map((it, idx) => normalizeLine(it, idx))
            .filter(it => it && it.puc_code && it.quantity > 0 && it.unit_price >= 0);
        const hasLines = items.length > 0;

        const settingsResult = await client.query(`SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
        const settings = settingsResult.rows[0] || {};
        const payableAccountCode = existing.payable_account_code || settings.accounts_payable_code || '220505';
        const resolvedTaxAccountCode = taxAccountCode || existing.tax_account_code || settings.vat_deductible_code || '240810';
        const resolvedWithholdingSourceCode = withholdingSourceCode || existing.withholding_source_code || settings.withholding_source_code || '236540';
        const resolvedWithholdingIcaCode = withholdingIcaCode || existing.withholding_ica_code || settings.withholding_ica_code || '236801';
        const resolvedWithholdingVatCode = withholdingVatCode || existing.withholding_vat_code || settings.withholding_vat_code || '236703';

        let subtotalValue, taxAmountValue, withholdingSourceValue, withholdingIcaValue, withholdingVatValue;
        let headerExpenseAccountCode, headerExpenseAccountName, discountTotalValue;

        if (hasLines) {
            subtotalValue = round2(items.reduce((s, it) => s + it.base_amount, 0));
            taxAmountValue = round2(items.reduce((s, it) => s + it.iva_amount, 0));
            const bodyRetSource = Math.max(Number(withholdingSourceAmount || 0), 0);
            const bodyRetIca = Math.max(Number(withholdingIcaAmount || 0), 0);
            const bodyRetVat = Math.max(Number(withholdingVatAmount || 0), 0);
            const anyBody = bodyRetSource > 0 || bodyRetIca > 0 || bodyRetVat > 0;
            if (anyBody) {
                withholdingSourceValue = bodyRetSource;
                withholdingIcaValue = bodyRetIca;
                withholdingVatValue = bodyRetVat;
            } else {
                const rfFromLines = round2(items.reduce((s, it) => s + it.rf_amount, 0));
                const reteIvaGlobalAmt = round2(taxAmountValue * (Number(reteIvaPct || 0) / 100));
                const reteIcaGlobalAmt = round2(subtotalValue * (Number(reteIcaPct || 0) / 1000));
                withholdingSourceValue = rfFromLines;
                withholdingIcaValue = reteIcaGlobalAmt;
                withholdingVatValue = reteIvaGlobalAmt;
            }
            discountTotalValue = round2(items.reduce((s, it) => s + it.discount_amount, 0));
            headerExpenseAccountCode = items[0].puc_code;
            headerExpenseAccountName = items[0].puc_name || getDefaultAccountName(items[0].puc_code);
        } else {
            taxAmountValue = Math.max(Number(taxAmount || 0), 0);
            withholdingSourceValue = Math.max(Number(withholdingSourceAmount || 0), 0);
            withholdingIcaValue = Math.max(Number(withholdingIcaAmount || 0), 0);
            withholdingVatValue = Math.max(Number(withholdingVatAmount || 0), 0);
            const totalWithholdings = withholdingSourceValue + withholdingIcaValue + withholdingVatValue;
            subtotalValue = subtotalAmount != null && subtotalAmount !== ''
                ? Math.max(Number(subtotalAmount || 0), 0)
                : Math.max(Number(amount || 0) - taxAmountValue + totalWithholdings, 0);
            discountTotalValue = Math.max(Number(rawDiscountTotal || 0), 0);
            headerExpenseAccountCode = expenseAccountCode || existing.expense_account_code;
            headerExpenseAccountName = expenseAccountName || existing.expense_account_name || (headerExpenseAccountCode ? getDefaultAccountName(headerExpenseAccountCode) : null);
        }

        const totalWithholdings = withholdingSourceValue + withholdingIcaValue + withholdingVatValue;
        const totalAmount = hasLines
            ? round2(subtotalValue + taxAmountValue - totalWithholdings)
            : Math.max(
                Number(amount != null && amount !== '' ? amount : (subtotalValue + taxAmountValue - totalWithholdings)),
                0
            );

        if (!supplierName || !documentNumber) {
            const error = new Error('Proveedor y número de documento son obligatorios');
            error.statusCode = 400;
            throw error;
        }
        if (!hasLines && !headerExpenseAccountCode) {
            const error = new Error('Debe indicar al menos una línea o una cuenta de gasto');
            error.statusCode = 400;
            throw error;
        }
        if (subtotalValue <= 0 && taxAmountValue <= 0) {
            const error = new Error('La compra debe tener base o impuesto mayor a cero');
            error.statusCode = 400;
            throw error;
        }
        if (totalAmount <= 0) {
            const error = new Error('El neto por pagar debe ser mayor a cero');
            error.statusCode = 400;
            throw error;
        }

        const paidAmount = Number(existing.paid_amount || 0);
        const newBalance = Math.max(totalAmount - paidAmount, 0);
        let newStatus;
        if (newBalance <= 0.009) newStatus = 'PAGADA';
        else if (paidAmount > 0) newStatus = 'PARCIAL';
        else newStatus = 'PENDIENTE';

        // === Reverso del asiento original ===
        const origJournalRes = await client.query(
            `SELECT * FROM journal_entries
             WHERE tenant_id = $1 AND document_type = 'CUENTA_POR_PAGAR' AND document_id = $2
               AND (status IS NULL OR status <> 'REVERSADO')
             ORDER BY id DESC LIMIT 1`,
            [tenantId, payableId]
        );

        let reverseEntry = null;
        if (origJournalRes.rows.length > 0) {
            const orig = origJournalRes.rows[0];
            const linesRes = await client.query(
                'SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id',
                [orig.id]
            );
            const reverseLines = linesRes.rows.map(l => ({
                account_code: l.account_code,
                account_name: l.account_name,
                description: 'REV: ' + (l.description || ''),
                debit: Number(l.credit || 0),
                credit: Number(l.debit || 0),
                third_party_document: l.third_party_document || null,
                third_party_name: l.third_party_name || null,
                base_amount: l.base_amount,
                tax_type: l.tax_type,
                tax_rate: l.tax_rate,
                tax_amount: l.tax_amount,
                tax_treatment: l.tax_treatment,
                dian_concept_code: l.dian_concept_code,
            }));

            reverseEntry = await insertJournalEntry(client, tenantId, {
                description: 'REVERSO edicion: ' + (orig.description || ''),
                documentType: 'REVERSO',
                documentId: orig.id,
                documentNumber: orig.entry_number,
                entryDate: new Date(),
                lines: reverseLines,
                userId,
            });

            await client.query(
                `UPDATE journal_entries SET status = 'REVERSADO', reversed_by_entry_id = $1, updated_at = NOW() WHERE id = $2`,
                [reverseEntry.id, orig.id]
            );
            try {
                await client.query('UPDATE journal_entries SET reverses_entry_id = $1 WHERE id = $2', [orig.id, reverseEntry.id]);
            } catch { /* columna opcional */ }
        }

        // Reversar movimientos de inventario de la versión anterior antes de
        // borrar/reinsertar líneas. Si el stock no alcanza (porque ya se vendió),
        // insertMovementRaw lanzará y abortaremos la edición.
        try {
            await reversePurchaseInventoryEntries(client, tenantId, {
                payableId,
                payableNumber: existing.document_number,
                userId,
            });
        } catch (kErr) {
            const err = new Error(`No se puede editar: stock insuficiente para revertir ingreso original (${kErr.message}). Anula primero las salidas que consumieron el inventario.`);
            err.statusCode = 409;
            throw err;
        }

        // === Borrar líneas viejas (si existen) ===
        await client.query('DELETE FROM accounts_payable_lines WHERE accounts_payable_id = $1 AND tenant_id = $2', [payableId, tenantId]);

        // === UPDATE cabecera ===
        const updatedResult = await client.query(
            `UPDATE accounts_payable SET
                supplier_name = $1,
                supplier_document_type = $2,
                supplier_document_number = $3,
                document_type = $4,
                document_number = $5,
                issue_date = $6,
                due_date = $7,
                subtotal_amount = $8,
                tax_amount = $9,
                withholding_source_amount = $10,
                withholding_ica_amount = $11,
                withholding_vat_amount = $12,
                original_amount = $13,
                balance_amount = $14,
                status = $15,
                expense_account_code = $16,
                expense_account_name = $17,
                tax_account_code = $18,
                withholding_source_code = $19,
                withholding_ica_code = $20,
                withholding_vat_code = $21,
                notes = $22,
                warehouse_code = $23,
                warehouse_name = $24,
                purchase_order_number = $25,
                terms_and_conditions = $26,
                printable_notes = $27,
                discount_total = $28,
                reteiva_pct = $29,
                reteica_pct = $30,
                cost_center = $31,
                supplier_phone = $32,
                updated_at = NOW()
             WHERE id = $33 AND tenant_id = $34
             RETURNING *`,
            [
                supplierName,
                supplierDocumentType,
                supplierDocumentNumber || null,
                documentType,
                documentNumber,
                issueDate || existing.issue_date || new Date(),
                dueDate || issueDate || existing.due_date || new Date(),
                subtotalValue,
                taxAmountValue,
                withholdingSourceValue,
                withholdingIcaValue,
                withholdingVatValue,
                totalAmount,
                newBalance,
                newStatus,
                headerExpenseAccountCode || null,
                headerExpenseAccountName || null,
                resolvedTaxAccountCode,
                resolvedWithholdingSourceCode,
                resolvedWithholdingIcaCode,
                resolvedWithholdingVatCode,
                notes || null,
                warehouseCode ? String(warehouseCode).slice(0, 50) : (existing.warehouse_code || null),
                warehouseName ? String(warehouseName).slice(0, 255) : (existing.warehouse_name || null),
                purchaseOrderNumber ? String(purchaseOrderNumber).slice(0, 50) : (existing.purchase_order_number || null),
                termsAndConditions != null ? termsAndConditions : (existing.terms_and_conditions || null),
                printableNotes != null ? printableNotes : (existing.printable_notes || null),
                discountTotalValue,
                Number(reteIvaPct || 0),
                Number(reteIcaPct || 0),
                costCenter ? String(costCenter).slice(0, 100) : (existing.cost_center || null),
                body.supplierPhone != null ? String(body.supplierPhone).slice(0, 50) : (existing.supplier_phone || null),
                payableId,
                tenantId
            ]
        );
        const payable = updatedResult.rows[0];

        // === Insertar líneas nuevas (si hay) ===
        if (hasLines) {
            for (const it of items) {
                await client.query(
                    `INSERT INTO accounts_payable_lines (
                        tenant_id, accounts_payable_id, line_no, concept_name, description, puc_code, puc_name, cost_center,
                        quantity, unit_price, discount_pct, iva_pct, rf_pct,
                        subtotal_amount, discount_amount, base_amount, iva_amount, rf_amount, line_total, notes,
                        product_id, service_id, item_type
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
                    [
                        tenantId, payable.id, it.line_no, it.concept_name || null, it.description || null,
                        it.puc_code, it.puc_name || getDefaultAccountName(it.puc_code), it.cost_center,
                        it.quantity, it.unit_price, it.discount_pct, it.iva_pct, it.rf_pct,
                        it.subtotal_amount, it.discount_amount, it.base_amount, it.iva_amount, it.rf_amount, it.line_total, it.notes,
                        it.product_id || null, it.service_id || null, it.item_type || null
                    ]
                );
            }
        }

        // === Construir nuevo asiento ===
        const journalLines = [];
        if (hasLines) {
            for (const it of items) {
                if (it.base_amount > 0) {
                    journalLines.push({
                        account_code: it.puc_code,
                        account_name: it.puc_name || getDefaultAccountName(it.puc_code),
                        description: it.concept_name || it.description || `Gasto ${documentNumber}`,
                        debit: it.base_amount,
                        credit: 0,
                        third_party_document: supplierDocumentNumber || null,
                        third_party_name: supplierName
                    });
                }
            }
        } else if (subtotalValue > 0) {
            journalLines.push({
                account_code: headerExpenseAccountCode,
                account_name: headerExpenseAccountName || getDefaultAccountName(headerExpenseAccountCode),
                description: notes || `Registro gasto proveedor ${supplierName}`,
                debit: subtotalValue,
                credit: 0,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }

        if (taxAmountValue > 0) {
            journalLines.push({
                account_code: resolvedTaxAccountCode,
                account_name: getDefaultAccountName(resolvedTaxAccountCode),
                description: `IVA descontable ${documentNumber}`,
                debit: taxAmountValue,
                credit: 0,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }

        journalLines.push({
            account_code: payableAccountCode,
            account_name: getDefaultAccountName(payableAccountCode),
            description: `Obligacion con proveedor ${supplierName}`,
            debit: 0,
            credit: totalAmount,
            third_party_document: supplierDocumentNumber || null,
            third_party_name: supplierName
        });

        if (withholdingSourceValue > 0) {
            journalLines.push({
                account_code: resolvedWithholdingSourceCode,
                account_name: getDefaultAccountName(resolvedWithholdingSourceCode),
                description: `Retefuente ${documentNumber}`,
                debit: 0,
                credit: withholdingSourceValue,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }
        if (withholdingIcaValue > 0) {
            journalLines.push({
                account_code: resolvedWithholdingIcaCode,
                account_name: getDefaultAccountName(resolvedWithholdingIcaCode),
                description: `ReteICA ${documentNumber}`,
                debit: 0,
                credit: withholdingIcaValue,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }
        if (withholdingVatValue > 0) {
            journalLines.push({
                account_code: resolvedWithholdingVatCode,
                account_name: getDefaultAccountName(resolvedWithholdingVatCode),
                description: `ReteIVA ${documentNumber}`,
                debit: 0,
                credit: withholdingVatValue,
                third_party_document: supplierDocumentNumber || null,
                third_party_name: supplierName
            });
        }

        const journal = await insertJournalEntry(client, tenantId, {
            description: `CxP ${documentNumber} - ${supplierName} (editada)`,
            documentType: 'CUENTA_POR_PAGAR',
            documentId: payable.id,
            documentNumber,
            entryDate: issueDate || existing.issue_date || new Date(),
            lines: journalLines,
            userId
        });

        // Re-insertar movimientos de inventario para la versión nueva.
        let inventoryMovements = [];
        try {
            inventoryMovements = await recordPurchaseInventoryEntries(client, tenantId, {
                items, payable, journalEntryId: journal?.id, userId,
            });
        } catch (kErr) {
            const err = new Error(`Error registrando inventario: ${kErr.message}`);
            err.statusCode = 400;
            throw err;
        }

        await client.query('COMMIT');
        return { payable, journal, reverseEntry, previous: existing, inventoryMovements };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Anula una factura de compra completa (BORRADOR/PENDIENTE → ANULADA), reversando
// el asiento contable original. Bloquea si ya tiene pagos aplicados.
const voidAccountsPayableEntry = async ({ tenantId, userId, payableId, reason }) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const existingRes = await client.query(
            'SELECT * FROM accounts_payable WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [payableId, tenantId]
        );
        if (existingRes.rows.length === 0) {
            const err = new Error('Factura de compra no encontrada');
            err.statusCode = 404;
            throw err;
        }
        const existing = existingRes.rows[0];

        if (existing.status === 'ANULADA') {
            const err = new Error('La factura ya está anulada');
            err.statusCode = 409;
            throw err;
        }
        if (Number(existing.paid_amount || 0) > 0) {
            const err = new Error('No se puede anular una factura con pagos aplicados. Anula los pagos primero.');
            err.statusCode = 409;
            throw err;
        }

        // Reverso del asiento original (mismo patrón que updateAccountsPayableEntry).
        const origJournalRes = await client.query(
            `SELECT * FROM journal_entries
             WHERE tenant_id = $1 AND document_type = 'CUENTA_POR_PAGAR' AND document_id = $2
               AND (status IS NULL OR status <> 'REVERSADO')
             ORDER BY id DESC LIMIT 1`,
            [tenantId, payableId]
        );

        let reverseEntry = null;
        if (origJournalRes.rows.length > 0) {
            const orig = origJournalRes.rows[0];
            const linesRes = await client.query(
                'SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1 ORDER BY id',
                [orig.id]
            );
            const reverseLines = linesRes.rows.map(l => ({
                account_code: l.account_code,
                account_name: l.account_name,
                description: 'REV: ' + (l.description || ''),
                debit: Number(l.credit || 0),
                credit: Number(l.debit || 0),
                third_party_document: l.third_party_document || null,
                third_party_name: l.third_party_name || null,
                base_amount: l.base_amount,
                tax_type: l.tax_type,
                tax_rate: l.tax_rate,
                tax_amount: l.tax_amount,
                tax_treatment: l.tax_treatment,
                dian_concept_code: l.dian_concept_code,
            }));

            reverseEntry = await insertJournalEntry(client, tenantId, {
                description: 'REVERSO anulacion FC: ' + (orig.description || ''),
                documentType: 'REVERSO',
                documentId: orig.id,
                documentNumber: orig.entry_number,
                entryDate: new Date(),
                lines: reverseLines,
                userId,
            });

            await client.query(
                `UPDATE journal_entries SET status = 'REVERSADO', reversed_by_entry_id = $1, updated_at = NOW() WHERE id = $2`,
                [reverseEntry.id, orig.id]
            );
            try {
                await client.query('UPDATE journal_entries SET reverses_entry_id = $1 WHERE id = $2', [orig.id, reverseEntry.id]);
            } catch { /* columna opcional */ }
        }

        // Reversar movimientos de inventario (OUT por cada IN previo).
        let reversedMovements = [];
        try {
            reversedMovements = await reversePurchaseInventoryEntries(client, tenantId, {
                payableId,
                payableNumber: existing.document_number,
                userId,
            });
        } catch (kErr) {
            const err = new Error(`No se puede anular: stock insuficiente para revertir el ingreso (${kErr.message}). Anula primero las salidas que consumieron el inventario.`);
            err.statusCode = 409;
            throw err;
        }

        const updatedRes = await client.query(
            `UPDATE accounts_payable
             SET status = 'ANULADA',
                 notes = COALESCE(NULLIF(notes, ''), '') ||
                         CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE E'\n' END ||
                         '[ANULADA] ' || COALESCE($3, '(sin motivo)'),
                 updated_at = NOW()
             WHERE id = $1 AND tenant_id = $2
             RETURNING *`,
            [payableId, tenantId, reason || null]
        );

        await client.query('COMMIT');
        return { payable: updatedRes.rows[0], reverseEntry, previous: existing, reversedMovements };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createAccountsPayableEntry,
    applyAccountsPayablePaymentEntry,
    voidAccountsPayablePaymentEntry,
    voidAccountsPayableEntry,
    updateAccountsPayableEntry,
};
