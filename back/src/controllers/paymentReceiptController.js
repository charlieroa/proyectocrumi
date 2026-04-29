const db = require('../config/db');
const { getNextSequence } = require('../helpers/sequenceHelper');
const {
    applyPaymentToAccountsReceivable,
    reversePaymentFromAccountsReceivable,
    createJournalFromPaymentReceipt
} = require('../helpers/accountingHelper');
const accountingCoreService = require('../services/accountingCoreService');
const { assertAccountingPeriodOpen } = require('../helpers/accountingPeriodHelper');
const { recordAccountingAuditEvent } = require('../helpers/accountingAuditHelper');

// Normaliza un NIT/identificación quitando separadores y dígito de verificación.
// Ej: "901.308.657-1" → "901308657". Permite hacer match aunque la AR guarde el
// documento sin guión y el cliente venga con él (o viceversa).
const normalizeNit = (raw) => {
    if (!raw) return '';
    const cleaned = String(raw).replace(/[^0-9]/g, '');
    // Si el original tenía un guión, descartamos el dígito de verificación (último).
    if (String(raw).includes('-') && cleaned.length > 1) {
        return cleaned.slice(0, -1);
    }
    return cleaned;
};

const getPaymentReceipts = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || req.query.tenantId || 1;
        const { startDate, endDate, clientNit, status } = req.query;

        const conditions = ['pr.tenant_id = $1'];
        const values = [tenantId];

        if (startDate) {
            values.push(startDate);
            conditions.push(`pr.date >= $${values.length}`);
        }
        if (endDate) {
            values.push(endDate);
            conditions.push(`pr.date <= $${values.length}`);
        }
        if (clientNit) {
            values.push(`%${String(clientNit).trim()}%`);
            conditions.push(`pr.client_document_number ILIKE $${values.length}`);
        }
        if (status) {
            values.push(String(status).toUpperCase());
            conditions.push(`UPPER(pr.status) = $${values.length}`);
        }

        const result = await db.query(
            `SELECT pr.*, COALESCE(SUM(pri.amount), 0) AS total_applied, COUNT(pri.*) AS total_invoices
             FROM payment_receipts pr
             LEFT JOIN payment_receipt_invoices pri ON pri.receipt_id = pr.id
             WHERE ${conditions.join(' AND ')}
             GROUP BY pr.id
             ORDER BY pr.date DESC, pr.created_at DESC NULLS LAST`,
            values
        );
        res.json({ success: true, paymentReceipts: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener recibos de pago', details: error.message });
    }
};

const getPaymentReceiptById = async (req, res) => {
    try {
        const { id } = req.params;
        const receiptResult = await db.query('SELECT * FROM payment_receipts WHERE id = $1', [id]);
        if (receiptResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Recibo de pago no encontrado' });
        }
        const invoicesResult = await db.query(
            `SELECT pri.*, i.invoice_number, i.total AS invoice_total, i.client_name AS invoice_client_name
             FROM payment_receipt_invoices pri
             LEFT JOIN invoices i ON i.id = pri.invoice_id
             WHERE pri.receipt_id = $1
             ORDER BY pri.id`,
            [id]
        );
        res.json({ success: true, paymentReceipt: { ...receiptResult.rows[0], invoices: invoicesResult.rows } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener recibo de pago', details: error.message });
    }
};

const createPaymentReceipt = async (req, res) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        const tenantId = req.user?.tenant_id || req.body.tenantId || 1;
        const createdBy = req.user?.id || req.body.createdBy || null;
        const {
            clientNit,
            clientName,
            clientDocType = 'CC',
            paymentDate,
            paymentMethod,
            paymentMethods: bodyPaymentMethods = [],
            bankName,
            transactionReference,
            amount,
            amountReceived,
            notes,
            invoices = [],
            // Retenciones sufridas por la empresa cuando el cliente paga
            retefuenteAmount = 0,
            reteivaAmount = 0,
            reteicaAmount = 0,
            impoconsumoAmount = 0,
            grossAmount
        } = req.body;

        const retefuenteVal = Math.max(Number(retefuenteAmount) || 0, 0);
        const reteivaVal = Math.max(Number(reteivaAmount) || 0, 0);
        const reteicaVal = Math.max(Number(reteicaAmount) || 0, 0);
        const impoconsumoVal = Math.max(Number(impoconsumoAmount) || 0, 0);
        const totalWithholdings = retefuenteVal + reteivaVal + reteicaVal;

        await assertAccountingPeriodOpen(client, tenantId, paymentDate || new Date());

        if (!clientName || !paymentMethod) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Cliente y método de pago son obligatorios' });
        }

        const resolvedInvoices = [];
        let totalFromInvoices = 0;

        for (const line of invoices) {
            let invoiceId = line.invoiceId || null;
            if (!invoiceId && line.invoiceNumber) {
                const invoiceLookup = await client.query(
                    'SELECT id FROM invoices WHERE tenant_id = $1 AND invoice_number = $2 LIMIT 1',
                    [tenantId, line.invoiceNumber]
                );
                invoiceId = invoiceLookup.rows[0]?.id || null;
            }

            if (!invoiceId) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'La línea #1 debe tener invoiceId o invoiceNumber válido' });
            }

            const lineAmount = Number(line.amountApplied) || 0;
            totalFromInvoices += lineAmount;
            resolvedInvoices.push({
                invoiceId,
                amount: lineAmount,
                retefuente: Math.max(Number(line.retefuente) || 0, 0),
                reteIva: Math.max(Number(line.reteIva) || 0, 0),
                reteIca: Math.max(Number(line.reteIca) || 0, 0),
                impoconsumo: Math.max(Number(line.impoconsumo) || 0, 0),
            });
        }

        // amount = NETO recibido al banco/caja; totalFromInvoices = BRUTO aplicado a cartera
        const totalAmount = amount != null ? Number(amount) : Math.max(totalFromInvoices - totalWithholdings, 0);
        const received = amountReceived != null ? Number(amountReceived) : totalAmount;
        const changeAmount = received - totalAmount;

        // Validaciones:
        // - Debe haber al menos una factura aplicada (bruto > 0)
        // - Neto recibido no puede ser negativo
        // - Retenciones no pueden ser mayores al bruto
        if (!totalFromInvoices || totalFromInvoices <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Debe aplicar al menos una factura con monto mayor a cero.'
            });
        }
        if (totalAmount < 0 || changeAmount < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Monto neto inválido: neto=${totalAmount}, recibido=${received}`
            });
        }
        if (totalWithholdings > totalFromInvoices + 0.01) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Las retenciones no pueden ser mayores al bruto aplicado.'
            });
        }

        const sequence = await getNextSequence(client, tenantId, 'RP');
        const receiptNumber = sequence.fullNumber;

        const gross = grossAmount != null ? Number(grossAmount) : (totalAmount + totalWithholdings);
        const receiptResult = await client.query(
            `INSERT INTO payment_receipts (
                tenant_id, receipt_number, client_name, client_document_type,
                client_document_number, date, total, payment_method, bank_name,
                reference, notes, status, created_by,
                retefuente_amount, reteiva_amount, reteica_amount, impoconsumo_amount, gross_amount,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, 'BORRADOR', $12,
                $13, $14, $15, $16, $17,
                NOW(), NOW()
            ) RETURNING *`,
            [
                tenantId,
                receiptNumber,
                clientName,
                clientDocType,
                clientNit || null,
                paymentDate || new Date(),
                totalAmount,
                paymentMethod,
                bankName || null,
                transactionReference || null,
                notes || null,
                createdBy,
                retefuenteVal,
                reteivaVal,
                reteicaVal,
                impoconsumoVal,
                gross
            ]
        );

        const receipt = receiptResult.rows[0];

        for (const line of resolvedInvoices) {
            await client.query(
                `INSERT INTO payment_receipt_invoices (
                    receipt_id, invoice_id, amount,
                    retefuente_amount, reteiva_amount, reteica_amount, impoconsumo_amount,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [receipt.id, line.invoiceId, line.amount,
                 line.retefuente || 0, line.reteIva || 0, line.reteIca || 0, line.impoconsumo || 0]
            );
        }

        let appliedPortfolio = [];
        try {
            appliedPortfolio = await applyPaymentToAccountsReceivable(
                client,
                tenantId,
                {
                    receiptId: receipt.id,
                    receiptNumber: receipt.receipt_number,
                    paymentDate: paymentDate || new Date(),
                    notes
                },
                resolvedInvoices,
                createdBy
            );
        } catch (portfolioError) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: portfolioError.message });
        }

        // ---- Generación de asiento contable vía accountingCoreService.insertJournalEntry ----
        // Respeta flag auto_post de accounting_document_configs (document_type='RECIBO_COBRO').
        // Si status pasa a VOID/ANULADO en el futuro, el asiento reverso se manejaría en
        // updatePaymentReceiptStatus (pendiente de implementación).
        let journalResult = null;
        try {
            const configRes = await client.query(
                `SELECT auto_post FROM accounting_document_configs
                 WHERE tenant_id = $1 AND document_type IN ('RECIBO_COBRO','RECIBO_PAGO')
                 ORDER BY CASE WHEN document_type = 'RECIBO_COBRO' THEN 0 ELSE 1 END
                 LIMIT 1`,
                [tenantId]
            );
            const autoPost = configRes.rows[0]?.auto_post !== false;

            if (autoPost) {
                const settingsRes = await client.query(
                    `SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`,
                    [tenantId]
                );
                const s = settingsRes.rows[0] || {};

                const method = String(paymentMethod || '').toUpperCase();
                const isCash = ['CASH', 'EFECTIVO'].includes(method);
                const debitAccount = isCash
                    ? (s.cash_account_code || '110505')
                    : (s.bank_account_code || '111005');
                const crAccount = s.accounts_receivable_code || '130505';
                // Si llegan múltiples formas de recaudo, generamos una línea de débito por cada una
                const splits = Array.isArray(bodyPaymentMethods) ? bodyPaymentMethods : [];
                const resolveMethodAccount = (m) => {
                    const u = String(m || '').toUpperCase();
                    if (u.includes('EFECT') || u === 'CASH') return s.cash_account_code || '110505';
                    return s.bank_account_code || '111005';
                };

                // Si faltan ambas configuraciones críticas (AR + caja/banco), abortar.
                const arConfigured = !!s.accounts_receivable_code;
                const cashBankConfigured = isCash ? !!s.cash_account_code : !!s.bank_account_code;
                if (!arConfigured && !cashBankConfigured) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        error: 'Configura primero las cuentas por defecto en Settings → Contabilidad maestra'
                    });
                }

                const totalNum = Number(totalAmount);
                const appliedTotal = Number(totalFromInvoices) || 0;
                // Bruto aplicado = lo que se abona a clientes (suma de amountApplied por factura).
                // Las retenciones NO se suman de nuevo; ya están implícitas en el bruto.
                const creditToAR = appliedTotal > 0 ? appliedTotal : Math.max(totalNum + totalWithholdings, 0);

                // Cuentas de retenciones sufridas (activo - anticipos)
                const retefuenteCode = s.withholding_income_tax_suffered_code
                    || s.withholding_suffered_renta_code || '135515';
                const reteivaCode = s.withholding_vat_suffered_code || '135517';
                const reteicaCode = s.withholding_ica_suffered_code || '135518';

                const lines = [];

                // Débitos por forma de recaudo (caja / banco)
                if (splits.length > 0) {
                    for (const sp of splits) {
                        const amt = Number(sp.amount || sp.monto || 0);
                        if (amt <= 0) continue;
                        const acct = resolveMethodAccount(sp.method || sp.metodo || '');
                        lines.push({
                            account_code: acct,
                            debit: amt,
                            credit: 0,
                            third_party_document: clientNit || null,
                            third_party_name: clientName,
                            description: `Cobro ${receipt.receipt_number} · ${sp.method || sp.metodo || ''}`,
                        });
                    }
                } else {
                    lines.push({
                        account_code: debitAccount,
                        debit: totalNum,
                        credit: 0,
                        third_party_document: clientNit || null,
                        third_party_name: clientName,
                        description: `Cobro ${receipt.receipt_number} - ${clientName}`,
                    });
                }

                // Retenciones sufridas (débito = activo)
                if (retefuenteVal > 0) {
                    lines.push({
                        account_code: retefuenteCode,
                        debit: retefuenteVal, credit: 0,
                        third_party_document: clientNit || null,
                        third_party_name: clientName,
                        description: `Retefuente sufrida ${receipt.receipt_number}`,
                    });
                }
                if (reteivaVal > 0) {
                    lines.push({
                        account_code: reteivaCode,
                        debit: reteivaVal, credit: 0,
                        third_party_document: clientNit || null,
                        third_party_name: clientName,
                        description: `ReteIVA sufrida ${receipt.receipt_number}`,
                    });
                }
                if (reteicaVal > 0) {
                    lines.push({
                        account_code: reteicaCode,
                        debit: reteicaVal, credit: 0,
                        third_party_document: clientNit || null,
                        third_party_name: clientName,
                        description: `ReteICA sufrida ${receipt.receipt_number}`,
                    });
                }

                // Crédito a clientes por el valor bruto (factura completa)
                lines.push({
                    account_code: crAccount,
                    debit: 0,
                    credit: creditToAR,
                    third_party_document: clientNit || null,
                    third_party_name: clientName,
                    description: `Aplicación cartera recibo ${receipt.receipt_number}`,
                });

                // Sobrante → anticipo recibido (280505) si aplica
                if (appliedTotal > 0 && totalNum + totalWithholdings > appliedTotal + totalWithholdings) {
                    // Caso: el neto cobrado excede el saldo de las facturas (anticipo)
                    const over = totalNum + totalWithholdings - (appliedTotal + totalWithholdings);
                    if (over > 0) {
                        lines.push({
                            account_code: '280505',
                            debit: 0,
                            credit: over,
                            third_party_document: clientNit || null,
                            third_party_name: clientName,
                            description: 'Anticipo recibido'
                        });
                    }
                }

                journalResult = await accountingCoreService.insertJournalEntry(client, tenantId, {
                    description: `Recibo cobro ${receipt.receipt_number} - ${clientName}`,
                    documentType: 'RECIBO_COBRO',
                    documentId: receipt.id,
                    documentNumber: receipt.receipt_number || String(receipt.id),
                    entryDate: paymentDate || receipt.date || new Date(),
                    lines,
                    userId: createdBy
                });
            }
        } catch (journalError) {
            // Falla del asiento es crítica: rollback de toda la transacción.
            await client.query('ROLLBACK');
            return res.status(500).json({
                success: false,
                error: 'Error generando asiento contable del recibo',
                details: journalError.message
            });
        }

        await client.query('COMMIT');
        await recordAccountingAuditEvent({
            tenantId,
            userId: createdBy,
            category: 'cartera',
            action: 'receipt.created',
            entityType: 'payment_receipt',
            entityId: receipt.id,
            entityNumber: receipt.receipt_number,
            documentType: 'RECIBO_PAGO',
            documentId: receipt.id,
            documentNumber: receipt.receipt_number,
            message: 'Recibo de pago creado y aplicado a cartera',
            afterData: {
                receipt,
                portfolio: appliedPortfolio,
                journal: journalResult,
                amountReceived: received,
                changeAmount
            },
            metadata: {
                paymentMethod,
                bankName: bankName || null,
                source: 'paymentReceiptController.createPaymentReceipt'
            },
            context: {
                ip: req.ip,
                userAgent: req.headers?.['user-agent'] || null
            }
        });
        res.status(201).json({
            success: true,
            message: 'Recibo de pago creado exitosamente',
            paymentReceipt: {
                id: receipt.id,
                number: receipt.receipt_number,
                clientName: receipt.client_name,
                amount: receipt.total,
                amountReceived: received,
                changeAmount,
                status: receipt.status,
                dateIssue: receipt.date,
                paymentDate: receipt.date
            },
            portfolio: appliedPortfolio,
            journalEntry: journalResult
                ? { id: journalResult.id, entryNumber: journalResult.entry_number || journalResult.entryNumber || null }
                : null
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: 'Error al crear recibo de pago', details: error.message });
    } finally {
        client.release();
    }
};

const updatePaymentReceipt = async (_req, res) =>
    res.status(501).json({ success: false, error: 'Edición de recibos no soportada — anular y volver a crear.' });

// Anula un recibo de cobro: revierte aplicación a cartera, marca status=ANULADO y
// genera asiento contable reverso. Idempotente sobre recibos ya anulados.
const updatePaymentReceiptStatus = async (req, res) => {
    const client = await db.getClient();
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id || req.body.tenantId || 1;
        const userId = req.user?.id || req.body.userId || null;
        const targetStatus = String(req.body?.status || 'ANULADO').toUpperCase();

        if (!['ANULADO', 'VOID', 'VOIDED', 'CANCELLED'].includes(targetStatus)) {
            return res.status(400).json({
                success: false,
                error: `Status no soportado: ${targetStatus}. Solo se permite anular.`,
            });
        }

        await client.query('BEGIN');

        const recRes = await client.query(
            `SELECT * FROM payment_receipts WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );
        if (recRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Recibo no encontrado' });
        }
        const receipt = recRes.rows[0];

        const currentStatus = String(receipt.status || '').toUpperCase();
        if (['ANULADO', 'VOID', 'VOIDED', 'CANCELLED'].includes(currentStatus)) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                error: 'El recibo ya está anulado.',
                receiptStatus: receipt.status,
            });
        }

        const today = new Date();
        await assertAccountingPeriodOpen(client, tenantId, today);

        // 1) Revertir aplicación a cartera
        const reversed = await reversePaymentFromAccountsReceivable(client, tenantId, receipt.id);

        // 2) Generar asiento contable reverso (si el original había generado uno)
        let reverseEntry = null;
        const origJournal = await client.query(
            `SELECT id, entry_number, status FROM journal_entries
              WHERE tenant_id = $1 AND document_type = 'RECIBO_COBRO' AND document_id = $2
              ORDER BY id DESC LIMIT 1`,
            [tenantId, String(receipt.id)]
        );

        if (origJournal.rows.length > 0) {
            const origLines = await client.query(
                `SELECT account_code, account_name, debit, credit, third_party_document, third_party_name, description
                   FROM journal_entry_lines WHERE journal_entry_id = $1`,
                [origJournal.rows[0].id]
            );

            // Asiento reverso = swap debit/credit
            const reverseLines = origLines.rows.map((l) => ({
                account_code: l.account_code,
                account_name: l.account_name,
                debit: Number(l.credit || 0),
                credit: Number(l.debit || 0),
                third_party_document: l.third_party_document,
                third_party_name: l.third_party_name,
                description: `Reverso anulación - ${l.description || ''}`.slice(0, 250),
            }));

            reverseEntry = await accountingCoreService.insertJournalEntry(client, tenantId, {
                description: `Anulación recibo ${receipt.receipt_number} - ${receipt.client_name}`,
                documentType: 'RECIBO_COBRO_ANULACION',
                documentId: receipt.id,
                documentNumber: receipt.receipt_number,
                entryDate: today,
                lines: reverseLines,
                userId,
            });
        }

        // 3) Marcar recibo como ANULADO
        const upd = await client.query(
            `UPDATE payment_receipts
                SET status = 'ANULADO', updated_at = NOW()
              WHERE id = $1
          RETURNING *`,
            [receipt.id]
        );

        await client.query('COMMIT');

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'cartera',
            action: 'receipt.voided',
            entityType: 'payment_receipt',
            entityId: receipt.id,
            entityNumber: receipt.receipt_number,
            documentType: 'RECIBO_PAGO',
            documentId: receipt.id,
            documentNumber: receipt.receipt_number,
            message: 'Recibo de pago anulado y reverso aplicado a cartera',
            beforeData: { status: receipt.status },
            afterData: {
                status: 'ANULADO',
                reversedApplications: reversed,
                reverseJournalEntry: reverseEntry,
            },
            metadata: { source: 'paymentReceiptController.updatePaymentReceiptStatus' },
            context: {
                ip: req.ip,
                userAgent: req.headers?.['user-agent'] || null,
            },
        });

        res.json({
            success: true,
            message: 'Recibo anulado correctamente',
            paymentReceipt: upd.rows[0],
            reversed,
            reverseJournalEntry: reverseEntry
                ? { id: reverseEntry.id, entryNumber: reverseEntry.entryNumber }
                : null,
        });
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        res.status(500).json({
            success: false,
            error: 'Error al anular recibo de pago',
            details: error.message,
        });
    } finally {
        client.release();
    }
};

const deletePaymentReceipt = async (_req, res) =>
    res.status(501).json({ success: false, error: 'Eliminación no soportada — usa anulación.' });

module.exports = { getPaymentReceipts, getPaymentReceiptById, createPaymentReceipt, updatePaymentReceipt, updatePaymentReceiptStatus, deletePaymentReceipt };
