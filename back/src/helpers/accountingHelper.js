// src/helpers/accountingHelper.js
// Helper para crear asientos contables automáticos usando el clasificador PUC

const {
    classifyDocumentItems,
    learnMapping,
    FALLBACK_ACCOUNTS,
    IVA_ACCOUNTS,
    BANK_ACCOUNT
} = require('./classifierEngine');
const { assertAccountingPeriodOpen } = require('./accountingPeriodHelper');

const DEFAULT_ACCOUNTING_SETTINGS = {
    cash_account_code: '110505',
    bank_account_code: '111005',
    accounts_receivable_code: '130505',
    revenue_account_code: '413595',
    expense_account_code: '519595',
    vat_generated_code: '240805',
    rounding_account_code: '429581'
};

const DEFAULT_DOCUMENT_CONFIGS = {
    FACTURA: {
        debit_account_code: '130505',
        credit_account_code: '413595',
        tax_account_code: '240805'
    },
    NOTA_CREDITO: {
        debit_account_code: '413595',
        credit_account_code: '130505',
        tax_account_code: '240805'
    },
    NOTA_DEBITO: {
        debit_account_code: '130505',
        credit_account_code: '413595',
        tax_account_code: '240805'
    },
    RECIBO_PAGO: {
        debit_account_code: '111005',
        credit_account_code: '130505'
    }
};

// =============================================
// GENERAR NÚMERO DE ASIENTO
// =============================================

async function getNextEntryNumber(client, tenantId) {
    const result = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM '[0-9]+') AS INT)), 0) + 1 AS next_number
         FROM journal_entries
         WHERE tenant_id = $1`,
        [tenantId]
    );
    const nextNum = result.rows[0].next_number || 1;
    return `AST-${String(nextNum).padStart(6, '0')}`;
}

// =============================================
// REGISTRAR CUENTAS EN PUC SI NO EXISTEN
// =============================================

async function ensureAccountExists(client, tenantId, accountCode, accountName) {
    try {
        await client.query(
            `INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, level, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             ON CONFLICT (tenant_id, account_code) DO NOTHING`,
            [
                tenantId,
                accountCode,
                accountName,
                getAccountType(accountCode),
                accountCode.length <= 2 ? 1 : accountCode.length <= 4 ? 2 : 3
            ]
        );
    } catch (error) {
        // Ignorar si ya existe
    }
}

function getAccountType(code) {
    const prefix = code.charAt(0);
    switch (prefix) {
        case '1': return 'ACTIVO';
        case '2': return 'PASIVO';
        case '3': return 'PATRIMONIO';
        case '4': return 'INGRESO';
        case '5': return 'GASTO';
        case '6': return 'COSTO';
        case '7': return 'COSTO_PRODUCCION';
        default: return 'OTRO';
    }
}

function getDefaultAccountName(accountCode) {
    const catalog = {
        '110505': 'CAJA GENERAL',
        '111005': 'BANCOS',
        '130505': 'CLIENTES NACIONALES',
        '220505': 'PROVEEDORES NACIONALES',
        '240805': 'IVA GENERADO',
        '240810': 'IVA DESCONTABLE',
        '413595': 'INGRESOS OPERACIONALES',
        '419595': 'AJUSTES AL INGRESO',
        '429581': 'AJUSTES POR REDONDEO',
        '519595': 'GASTOS OPERACIONALES'
    };

    return catalog[accountCode] || `CUENTA ${accountCode}`;
}

async function getAccountingContext(client, tenantId, documentType) {
    const [settingsResult, documentConfigResult] = await Promise.all([
        client.query(
            `SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`,
            [tenantId]
        ),
        client.query(
            `SELECT * FROM accounting_document_configs WHERE tenant_id = $1 AND document_type = $2 LIMIT 1`,
            [tenantId, documentType]
        )
    ]);

    return {
        settings: settingsResult.rows[0] || DEFAULT_ACCOUNTING_SETTINGS,
        documentConfig: documentConfigResult.rows[0] || DEFAULT_DOCUMENT_CONFIGS[documentType] || {}
    };
}

async function resolveBankAccountCode(client, tenantId, bankName, paymentMethod, fallbackCode) {
    if (paymentMethod && String(paymentMethod).toLowerCase().includes('efect')) {
        return fallbackCode || DEFAULT_ACCOUNTING_SETTINGS.cash_account_code;
    }

    if (bankName) {
        const bankResult = await client.query(
            `SELECT account_code
             FROM tenant_banks
             WHERE tenant_id = $1 AND is_active = true AND LOWER(name) = LOWER($2)
             ORDER BY is_default DESC, id ASC
             LIMIT 1`,
            [tenantId, bankName]
        );
        if (bankResult.rows[0]?.account_code) {
            return bankResult.rows[0].account_code;
        }
    }

    const defaultBankResult = await client.query(
        `SELECT account_code
         FROM tenant_banks
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY is_default DESC, id ASC
         LIMIT 1`,
        [tenantId]
    );

    return defaultBankResult.rows[0]?.account_code || fallbackCode || DEFAULT_ACCOUNTING_SETTINGS.bank_account_code;
}

function rebalanceLines(lines) {
    const totalDebit = Math.round(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0) * 100) / 100;
    const totalCredit = Math.round(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0) * 100) / 100;
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;

    if (Math.abs(diff) <= 0.01 || lines.length === 0) {
        return lines;
    }

    if (diff > 0) {
        const target = [...lines].reverse().find((line) => Number(line.credit || 0) > 0);
        if (target) {
            target.credit = Math.round((Number(target.credit || 0) + diff) * 100) / 100;
        }
    } else {
        const target = [...lines].reverse().find((line) => Number(line.debit || 0) > 0);
        if (target) {
            target.debit = Math.round((Number(target.debit || 0) + Math.abs(diff)) * 100) / 100;
        }
    }

    return lines;
}

async function createAccountsReceivableFromInvoice(client, tenantId, invoiceData, userId) {
    await assertAccountingPeriodOpen(client, tenantId, invoiceData.issueDate || new Date());

    const result = await client.query(
        `INSERT INTO accounts_receivable (
            tenant_id, invoice_id, document_type, document_id, document_number,
            client_name, client_document_type, client_document_number,
            issue_date, due_date, original_amount, paid_amount, balance_amount,
            status, currency, notes, created_by, created_at, updated_at
        ) VALUES (
            $1, $2, 'FACTURA', $3, $4,
            $5, $6, $7,
            $8, $9, $10, 0, $10,
            'PENDIENTE', $11, $12, $13, NOW(), NOW()
        )
        ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE SET
            invoice_id = EXCLUDED.invoice_id,
            document_id = EXCLUDED.document_id,
            client_name = EXCLUDED.client_name,
            client_document_type = EXCLUDED.client_document_type,
            client_document_number = EXCLUDED.client_document_number,
            issue_date = EXCLUDED.issue_date,
            due_date = EXCLUDED.due_date,
            original_amount = EXCLUDED.original_amount,
            balance_amount = GREATEST(EXCLUDED.original_amount - accounts_receivable.paid_amount, 0),
            currency = EXCLUDED.currency,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        RETURNING *`,
        [
            tenantId,
            invoiceData.invoiceId,
            String(invoiceData.invoiceId),
            invoiceData.invoiceNumber,
            invoiceData.clientName || 'CLIENTE',
            invoiceData.clientDocType || 'CC',
            invoiceData.clientDocumentNumber || null,
            invoiceData.issueDate,
            invoiceData.dueDate || invoiceData.issueDate,
            Number(invoiceData.total) || 0,
            invoiceData.currency || 'COP',
            invoiceData.notes || null,
            userId || null
        ]
    );

    return result.rows[0];
}

async function applyPaymentToAccountsReceivable(client, tenantId, receiptData, applications, userId) {
    await assertAccountingPeriodOpen(client, tenantId, receiptData.paymentDate || new Date());

    const appliedRows = [];

    for (const application of applications) {
        const amountToApply = Math.round(Number(application.amount || 0) * 100) / 100;
        if (amountToApply <= 0) continue;

        const arResult = await client.query(
            `SELECT *
             FROM accounts_receivable
             WHERE tenant_id = $1 AND invoice_id = $2
             LIMIT 1`,
            [tenantId, application.invoiceId]
        );

        const ar = arResult.rows[0];
        if (!ar) {
            console.warn(`[applyPaymentToAccountsReceivable] Factura ${application.invoiceId} sin AR, se omite`);
            continue;
        }

        const applicableAmount = Math.min(amountToApply, Number(ar.balance_amount || 0));
        if (applicableAmount <= 0) continue;

        await client.query(
            `INSERT INTO accounts_receivable_applications (
                tenant_id, accounts_receivable_id, source_type, source_id, source_number,
                application_date, amount, notes, created_by, created_at
            ) VALUES ($1, $2, 'RECIBO_PAGO', $3, $4, $5, $6, $7, $8, NOW())`,
            [
                tenantId,
                ar.id,
                receiptData.receiptId,
                receiptData.receiptNumber,
                receiptData.paymentDate,
                applicableAmount,
                receiptData.notes || null,
                userId || null
            ]
        );

        const updateResult = await client.query(
            `UPDATE accounts_receivable
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
            [applicableAmount, ar.id]
        );

        const currentAr = updateResult.rows[0];

        await client.query(
            `UPDATE invoices
             SET payment_status = CASE
                    WHEN $1 <= 0.009 THEN 'PAGADA'
                    WHEN $2 > 0 THEN 'PARCIAL'
                    ELSE COALESCE(payment_status, 'PENDIENTE')
                 END,
                 updated_at = NOW()
             WHERE id = $3`,
            [Number(currentAr.balance_amount || 0), Number(currentAr.paid_amount || 0), application.invoiceId]
        );

        appliedRows.push({
            invoiceId: application.invoiceId,
            accountsReceivableId: currentAr.id,
            amountApplied: applicableAmount,
            balanceAmount: Number(currentAr.balance_amount || 0),
            status: currentAr.status
        });
    }

    return appliedRows;
}

// =============================================
// REVERSAR APLICACIÓN DE PAGO A CARTERA
// =============================================
// Usado al anular un recibo: borra las accounts_receivable_applications del recibo,
// devuelve el saldo a las facturas (paid_amount -=, balance_amount +=) y recalcula status.
async function reversePaymentFromAccountsReceivable(client, tenantId, receiptId) {
    const apps = await client.query(
        `SELECT id, accounts_receivable_id, amount FROM accounts_receivable_applications
          WHERE tenant_id = $1 AND source_type = 'RECIBO_PAGO' AND source_id = $2`,
        [tenantId, receiptId]
    );

    const reversedRows = [];

    for (const app of apps.rows) {
        const amt = Math.round(Number(app.amount || 0) * 100) / 100;
        if (amt <= 0) continue;

        const updateResult = await client.query(
            `UPDATE accounts_receivable
             SET paid_amount = ROUND(GREATEST(paid_amount - $1, 0)::numeric, 2),
                 balance_amount = ROUND(LEAST(original_amount, balance_amount + $1)::numeric, 2),
                 status = CASE
                    WHEN GREATEST(paid_amount - $1, 0) <= 0.009 THEN 'PENDIENTE'
                    WHEN GREATEST(paid_amount - $1, 0) > 0 THEN 'PARCIAL'
                    ELSE status
                 END,
                 updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3
             RETURNING *`,
            [amt, app.accounts_receivable_id, tenantId]
        );

        const ar = updateResult.rows[0];
        if (!ar) continue;

        await client.query(
            `UPDATE invoices
             SET payment_status = CASE
                    WHEN $1 <= 0.009 THEN 'PAGADA'
                    WHEN $2 > 0 THEN 'PARCIAL'
                    ELSE 'PENDIENTE'
                 END,
                 updated_at = NOW()
             WHERE id = $3`,
            [Number(ar.balance_amount || 0), Number(ar.paid_amount || 0), ar.invoice_id]
        );

        reversedRows.push({
            invoiceId: ar.invoice_id,
            accountsReceivableId: ar.id,
            amountReversed: amt,
            balanceAmount: Number(ar.balance_amount || 0),
            status: ar.status,
        });
    }

    // Borrar las aplicaciones (después de actualizar AR para que el rastro de auditoría
    // de los UPDATE sea correcto)
    await client.query(
        `DELETE FROM accounts_receivable_applications
          WHERE tenant_id = $1 AND source_type = 'RECIBO_PAGO' AND source_id = $2`,
        [tenantId, receiptId]
    );

    return reversedRows;
}

// =============================================
// CREAR ASIENTO DESDE FACTURA DE VENTA
// =============================================

async function createJournalFromInvoice(client, tenantId, invoiceData, items, userId) {
    try {
        const {
            invoiceId,
            invoiceNumber,
            total,
            subtotal,
            taxAmount,
            discountAmount,
            description,
            thirdPartyDocument = null,
            thirdPartyName = null
        } = invoiceData;

        const entryNumber = await getNextEntryNumber(client, tenantId);
        const { settings, documentConfig } = await getAccountingContext(client, tenantId, 'FACTURA');
        const ivaAccounts = IVA_ACCOUNTS['FACTURA'];
        const receivableAccountCode = documentConfig.debit_account_code || settings.accounts_receivable_code || ivaAccounts.debit;
        const receivableAccountName = getDefaultAccountName(receivableAccountCode);
        const taxAccountCode = documentConfig.tax_account_code || settings.vat_generated_code || ivaAccounts.credit;
        const taxAccountName = getDefaultAccountName(taxAccountCode);

        let lines = [];

        // Si hay items, clasificar por producto
        if (items && items.length > 0) {
            const grouped = await classifyDocumentItems(client, tenantId, items, 'FACTURA');

            // DÉBITO: Clientes/Bancos por el total (con IVA)
            const totalWithTax = Number(total) || 0;
            lines.push({
                accountCode: receivableAccountCode,
                accountName: receivableAccountName,
                description: `Factura ${invoiceNumber} - ${description || 'Venta'}`,
                debit: totalWithTax,
                credit: 0,
                third_party_document: thirdPartyDocument,
                third_party_name: thirdPartyName
            });

            // CRÉDITO: Cada grupo de cuenta clasificada (base sin IVA)
            for (const group of grouped) {
                if (group.totalBase > 0) {
                    const revenueCode = group.accountCode || documentConfig.credit_account_code || settings.revenue_account_code || FALLBACK_ACCOUNTS['FACTURA'].accountCode;
                    lines.push({
                        accountCode: revenueCode,
                        accountName: group.accountName || getDefaultAccountName(revenueCode),
                        description: `${group.items.join(', ').substring(0, 200)}`,
                        debit: 0,
                        credit: Math.round(group.totalBase * 100) / 100,
                        third_party_document: thirdPartyDocument,
                        third_party_name: thirdPartyName
                    });
                }

                // Guardar mappings para aprendizaje
                for (const itemDesc of group.items) {
                    await learnMapping(
                        client, tenantId, itemDesc,
                        group.accountCode, group.accountName,
                        'FACTURA', userId,
                        group.minConfidence >= 0.85
                    );
                }
            }

            // CRÉDITO: IVA generado en ventas
            const totalTax = grouped.reduce((sum, g) => sum + g.totalTax, 0) || Number(taxAmount) || 0;
            if (totalTax > 0) {
                lines.push({
                    accountCode: taxAccountCode,
                    accountName: taxAccountName,
                    description: `IVA Factura ${invoiceNumber}`,
                    debit: 0,
                    credit: Math.round(totalTax * 100) / 100,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName
                });
            }
        } else {
            // Fallback genérico (sin items detallados)
            const fallback = FALLBACK_ACCOUNTS['FACTURA'];
            const totalAmount = Number(total) || 0;
            const tax = Number(taxAmount) || 0;
            const base = totalAmount - tax;

            // DÉBITO: Clientes
            lines.push({
                accountCode: receivableAccountCode,
                accountName: receivableAccountName,
                description: `Factura ${invoiceNumber} - ${description || 'Venta'}`,
                debit: totalAmount,
                credit: 0,
                third_party_document: thirdPartyDocument,
                third_party_name: thirdPartyName
            });

            // CRÉDITO: Ingreso genérico
            if (base > 0) {
                const revenueCode = documentConfig.credit_account_code || settings.revenue_account_code || fallback.accountCode;
                lines.push({
                    accountCode: revenueCode,
                    accountName: getDefaultAccountName(revenueCode),
                    description: `Ingreso Factura ${invoiceNumber}`,
                    debit: 0,
                    credit: Math.round(base * 100) / 100,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName
                });
            }

            // CRÉDITO: IVA
            if (tax > 0) {
                lines.push({
                    accountCode: taxAccountCode,
                    accountName: taxAccountName,
                    description: `IVA Factura ${invoiceNumber}`,
                    debit: 0,
                    credit: Math.round(tax * 100) / 100,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName
                });
            }
        }
        rebalanceLines(lines);

        // Insertar asiento
        const journalResult = await insertJournalEntry(client, tenantId, {
            entryNumber,
            description: `Factura ${invoiceNumber} - ${description || 'Venta'}`,
            documentType: 'FACTURA',
            documentId: invoiceId,
            documentNumber: invoiceNumber,
            lines,
            userId
        });

        // Asegurar que las cuentas existan en el PUC
        for (const line of lines) {
            await ensureAccountExists(client, tenantId, line.accountCode, line.accountName);
        }

        console.log(`[Accounting] Asiento ${entryNumber} creado para Factura ${invoiceNumber} (${lines.length} líneas)`);
        return journalResult;

    } catch (error) {
        console.error('[Accounting] Error creando asiento desde factura:', error.message);
        throw error;
    }
}

// =============================================
// CREAR ASIENTO DESDE NOTA CRÉDITO
// =============================================

async function createJournalFromCreditNote(client, tenantId, noteData, items, userId) {
    try {
        const { noteId, noteNumber, total, taxAmount, description, thirdPartyDocument = null, thirdPartyName = null } = noteData;

        const entryNumber = await getNextEntryNumber(client, tenantId);
        const { settings, documentConfig } = await getAccountingContext(client, tenantId, 'NOTA_CREDITO');
        const ivaAccounts = IVA_ACCOUNTS['NOTA_CREDITO'];
        const receivableAccountCode = documentConfig.credit_account_code || settings.accounts_receivable_code || ivaAccounts.credit;
        const receivableAccountName = getDefaultAccountName(receivableAccountCode);
        const taxAccountCode = documentConfig.tax_account_code || settings.vat_generated_code || ivaAccounts.debit;
        const taxAccountName = getDefaultAccountName(taxAccountCode);

        let lines = [];

        if (items && items.length > 0) {
            const grouped = await classifyDocumentItems(client, tenantId, items, 'NOTA_CREDITO');

            // DÉBITO: Cada grupo clasificado (devolvemos ingreso)
            for (const group of grouped) {
                if (group.totalBase > 0) {
                    const incomeCode = group.accountCode || documentConfig.debit_account_code || settings.revenue_account_code || FALLBACK_ACCOUNTS['NOTA_CREDITO'].accountCode;
                    lines.push({
                        accountCode: incomeCode,
                        accountName: group.accountName || getDefaultAccountName(incomeCode),
                        description: `NC ${noteNumber} - ${group.items.join(', ').substring(0, 200)}`,
                        debit: Math.round(group.totalBase * 100) / 100,
                        credit: 0,
                        third_party_document: thirdPartyDocument,
                        third_party_name: thirdPartyName
                    });
                }

                for (const itemDesc of group.items) {
                    await learnMapping(client, tenantId, itemDesc, group.accountCode, group.accountName, 'NOTA_CREDITO', userId, group.minConfidence >= 0.85);
                }
            }

            // DÉBITO: IVA
            const totalTax = grouped.reduce((sum, g) => sum + g.totalTax, 0) || Number(taxAmount) || 0;
            if (totalTax > 0) {
                lines.push({
                    accountCode: taxAccountCode,
                    accountName: taxAccountName,
                    description: `IVA NC ${noteNumber}`,
                    debit: Math.round(totalTax * 100) / 100,
                    credit: 0,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName
                });
            }

            // CRÉDITO: Clientes por el total
            lines.push({
                accountCode: receivableAccountCode,
                accountName: receivableAccountName,
                description: `NC ${noteNumber} - ${description || 'Nota Crédito'}`,
                debit: 0,
                credit: Number(total) || 0,
                third_party_document: thirdPartyDocument,
                third_party_name: thirdPartyName
            });
        } else {
            const fallback = FALLBACK_ACCOUNTS['NOTA_CREDITO'];
            const totalAmount = Number(total) || 0;
            const tax = Number(taxAmount) || 0;
            const base = totalAmount - tax;

            if (base > 0) {
                const incomeCode = documentConfig.debit_account_code || fallback.accountCode;
                lines.push({
                    accountCode: incomeCode,
                    accountName: getDefaultAccountName(incomeCode),
                    description: `NC ${noteNumber}`,
                    debit: Math.round(base * 100) / 100,
                    credit: 0,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName
                });
            }
            if (tax > 0) {
                lines.push({
                    accountCode: taxAccountCode,
                    accountName: taxAccountName,
                    description: `IVA NC ${noteNumber}`,
                    debit: Math.round(tax * 100) / 100,
                    credit: 0,
                    third_party_document: thirdPartyDocument,
                    third_party_name: thirdPartyName
                });
            }
            lines.push({
                accountCode: receivableAccountCode,
                accountName: receivableAccountName,
                description: `NC ${noteNumber} - ${description || 'Nota Crédito'}`,
                debit: 0,
                credit: totalAmount,
                third_party_document: thirdPartyDocument,
                third_party_name: thirdPartyName
            });
        }
        rebalanceLines(lines);

        const journalResult = await insertJournalEntry(client, tenantId, {
            entryNumber,
            description: `NC ${noteNumber} - ${description || 'Nota Crédito'}`,
            documentType: 'NOTA_CREDITO',
            documentId: noteId,
            documentNumber: noteNumber,
            lines,
            userId
        });

        for (const line of lines) {
            await ensureAccountExists(client, tenantId, line.accountCode, line.accountName);
        }

        console.log(`[Accounting] Asiento ${entryNumber} creado para NC ${noteNumber}`);
        return journalResult;
    } catch (error) {
        console.error('[Accounting] Error creando asiento desde NC:', error.message);
        return null;
    }
}

// =============================================
// CREAR ASIENTO DESDE NOTA DÉBITO
// =============================================

async function createJournalFromDebitNote(client, tenantId, noteData, items, userId) {
    try {
        const { noteId, noteNumber, total, taxAmount, description } = noteData;

        const entryNumber = await getNextEntryNumber(client, tenantId);
        const { settings, documentConfig } = await getAccountingContext(client, tenantId, 'NOTA_DEBITO');
        const ivaAccounts = IVA_ACCOUNTS['NOTA_DEBITO'];
        const receivableAccountCode = documentConfig.debit_account_code || settings.accounts_receivable_code || ivaAccounts.debit;
        const receivableAccountName = getDefaultAccountName(receivableAccountCode);
        const taxAccountCode = documentConfig.tax_account_code || settings.vat_generated_code || ivaAccounts.credit;
        const taxAccountName = getDefaultAccountName(taxAccountCode);

        let lines = [];

        if (items && items.length > 0) {
            const grouped = await classifyDocumentItems(client, tenantId, items, 'NOTA_DEBITO');

            // DÉBITO: Clientes por el total
            lines.push({
                accountCode: receivableAccountCode,
                accountName: receivableAccountName,
                description: `ND ${noteNumber} - ${description || 'Nota Débito'}`,
                debit: Number(total) || 0,
                credit: 0
            });

            // CRÉDITO: Cada grupo clasificado
            for (const group of grouped) {
                if (group.totalBase > 0) {
                    const incomeCode = group.accountCode || documentConfig.credit_account_code || settings.revenue_account_code || FALLBACK_ACCOUNTS['NOTA_DEBITO'].accountCode;
                    lines.push({
                        accountCode: incomeCode,
                        accountName: group.accountName || getDefaultAccountName(incomeCode),
                        description: `ND ${noteNumber} - ${group.items.join(', ').substring(0, 200)}`,
                        debit: 0,
                        credit: Math.round(group.totalBase * 100) / 100
                    });
                }

                for (const itemDesc of group.items) {
                    await learnMapping(client, tenantId, itemDesc, group.accountCode, group.accountName, 'NOTA_DEBITO', userId, group.minConfidence >= 0.85);
                }
            }

            // CRÉDITO: IVA
            const totalTax = grouped.reduce((sum, g) => sum + g.totalTax, 0) || Number(taxAmount) || 0;
            if (totalTax > 0) {
                lines.push({
                    accountCode: taxAccountCode,
                    accountName: taxAccountName,
                    description: `IVA ND ${noteNumber}`,
                    debit: 0,
                    credit: Math.round(totalTax * 100) / 100
                });
            }
        } else {
            const fallback = FALLBACK_ACCOUNTS['NOTA_DEBITO'];
            const totalAmount = Number(total) || 0;
            const tax = Number(taxAmount) || 0;
            const base = totalAmount - tax;

            lines.push({
                accountCode: receivableAccountCode,
                accountName: receivableAccountName,
                description: `ND ${noteNumber}`,
                debit: totalAmount,
                credit: 0
            });
            if (base > 0) {
                const incomeCode = documentConfig.credit_account_code || fallback.accountCode;
                lines.push({
                    accountCode: incomeCode,
                    accountName: getDefaultAccountName(incomeCode),
                    description: `ND ${noteNumber}`,
                    debit: 0,
                    credit: Math.round(base * 100) / 100
                });
            }
            if (tax > 0) {
                lines.push({
                    accountCode: taxAccountCode,
                    accountName: taxAccountName,
                    description: `IVA ND ${noteNumber}`,
                    debit: 0,
                    credit: Math.round(tax * 100) / 100
                });
            }
        }
        rebalanceLines(lines);

        const journalResult = await insertJournalEntry(client, tenantId, {
            entryNumber,
            description: `ND ${noteNumber} - ${description || 'Nota Débito'}`,
            documentType: 'NOTA_DEBITO',
            documentId: noteId,
            documentNumber: noteNumber,
            lines,
            userId
        });

        for (const line of lines) {
            await ensureAccountExists(client, tenantId, line.accountCode, line.accountName);
        }

        console.log(`[Accounting] Asiento ${entryNumber} creado para ND ${noteNumber}`);
        return journalResult;
    } catch (error) {
        console.error('[Accounting] Error creando asiento desde ND:', error.message);
        return null;
    }
}

// =============================================
// INSERTAR ASIENTO EN BD
// =============================================

async function insertJournalEntry(client, tenantId, data) {
    await assertAccountingPeriodOpen(client, tenantId, data.entryDate || new Date());

    const { entryNumber, description, documentType, documentId, documentNumber, lines, userId } = data;

    const totalDebit = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const totalCredit = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;

    const journalResult = await client.query(
        `INSERT INTO journal_entries
            (tenant_id, entry_number, entry_date, description, document_type, document_id, document_number, total_debit, total_credit, status, created_by)
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, 'ACTIVO', $9)
         RETURNING id, entry_number`,
        [tenantId, entryNumber, description, documentType, documentId, documentNumber, totalDebit, totalCredit, userId]
    );

    const journalEntryId = journalResult.rows[0].id;

    for (const line of lines) {
        const cols = ['journal_entry_id', 'account_code', 'account_name', 'description', 'debit', 'credit'];
        const vals = [journalEntryId, line.accountCode, line.accountName, line.description, line.debit, line.credit];

        const optionalFields = [
            'third_party_id', 'third_party_document', 'third_party_name',
            'base_amount', 'tax_type', 'tax_rate', 'tax_amount', 'tax_treatment', 'dian_concept_code'
        ];
        for (const field of optionalFields) {
            const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            const v = line[field] != null ? line[field] : line[camel];
            if (v != null) {
                cols.push(field);
                vals.push(v);
            }
        }

        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
            `INSERT INTO journal_entry_lines (${cols.join(', ')}) VALUES (${placeholders})`,
            vals
        );
    }

    return {
        id: journalEntryId,
        entryNumber: journalResult.rows[0].entry_number,
        totalDebit,
        totalCredit,
        lineCount: lines.length
    };
}

async function createJournalFromPaymentReceipt(client, tenantId, receiptData, userId) {
    try {
        const entryNumber = await getNextEntryNumber(client, tenantId);
        const { settings, documentConfig } = await getAccountingContext(client, tenantId, 'RECIBO_PAGO');
        const debitAccountCode = await resolveBankAccountCode(
            client,
            tenantId,
            receiptData.bankName,
            receiptData.paymentMethod,
            documentConfig.debit_account_code || settings.bank_account_code || settings.cash_account_code || BANK_ACCOUNT.accountCode
        );
        const creditAccountCode = documentConfig.credit_account_code || settings.accounts_receivable_code || DEFAULT_DOCUMENT_CONFIGS.RECIBO_PAGO.credit_account_code;

        const clientNit = receiptData.thirdPartyDocument || receiptData.clientDocumentNumber || null;
        const clientName = receiptData.thirdPartyName || receiptData.clientName || null;

        const lines = rebalanceLines([
            {
                accountCode: debitAccountCode,
                accountName: getDefaultAccountName(debitAccountCode),
                description: `Recibo ${receiptData.receiptNumber} - ${clientName || 'Cliente'}`,
                debit: Number(receiptData.amount) || 0,
                credit: 0,
                third_party_document: clientNit,
                third_party_name: clientName
            },
            {
                accountCode: creditAccountCode,
                accountName: getDefaultAccountName(creditAccountCode),
                description: `Aplicacion cartera recibo ${receiptData.receiptNumber}`,
                debit: 0,
                credit: Number(receiptData.amount) || 0,
                third_party_document: clientNit,
                third_party_name: clientName
            }
        ]);

        const journalResult = await insertJournalEntry(client, tenantId, {
            entryNumber,
            description: `Recibo ${receiptData.receiptNumber} - ${receiptData.clientName || 'Cliente'}`,
            documentType: 'RECIBO_PAGO',
            documentId: receiptData.receiptId,
            documentNumber: receiptData.receiptNumber,
            lines,
            userId
        });

        for (const line of lines) {
            await ensureAccountExists(client, tenantId, line.accountCode, line.accountName);
        }

        return journalResult;
    } catch (error) {
        console.error('[Accounting] Error creando asiento desde recibo de pago:', error.message);
        return null;
    }
}

// =============================================
// CREAR ASIENTO DESDE LIQUIDACIÓN DE NÓMINA
// =============================================

/**
 * Creates accounting journal entries from a payroll period liquidation
 */
const createJournalFromPayroll = async (client, tenantId, period, liquidations, userId) => {
    // Generate entry number
    const countRes = await client.query(
        'SELECT COUNT(*) FROM journal_entries WHERE tenant_id = $1',
        [tenantId]
    );
    const nextNum = parseInt(countRes.rows[0].count) + 1;
    const entryNumber = `NOM-${String(nextNum).padStart(6, '0')}`;

    const totalDevengado = liquidations.reduce((sum, l) => sum + Number(l.total_devengado), 0);
    const totalDeductions = liquidations.reduce((sum, l) => sum + Number(l.total_deductions), 0);
    const totalNetPay = liquidations.reduce((sum, l) => sum + Number(l.net_pay), 0);
    const totalHealthEmp = liquidations.reduce((sum, l) => sum + Number(l.health_employee), 0);
    const totalPensionEmp = liquidations.reduce((sum, l) => sum + Number(l.pension_employee), 0);
    const totalHealthEmpr = liquidations.reduce((sum, l) => sum + Number(l.health_employer), 0);
    const totalPensionEmpr = liquidations.reduce((sum, l) => sum + Number(l.pension_employer), 0);
    const totalArl = liquidations.reduce((sum, l) => sum + Number(l.arl_employer), 0);
    const totalSena = liquidations.reduce((sum, l) => sum + Number(l.sena_employer), 0);
    const totalIcbf = liquidations.reduce((sum, l) => sum + Number(l.icbf_employer), 0);
    const totalCcf = liquidations.reduce((sum, l) => sum + Number(l.ccf_employer), 0);
    const totalPrima = liquidations.reduce((sum, l) => sum + Number(l.prima_provision), 0);
    const totalCesantias = liquidations.reduce((sum, l) => sum + Number(l.cesantias_provision), 0);
    const totalIntCesantias = liquidations.reduce((sum, l) => sum + Number(l.intereses_cesantias_provision), 0);
    const totalVacaciones = liquidations.reduce((sum, l) => sum + Number(l.vacaciones_provision), 0);

    const totalEmployerCost = totalHealthEmpr + totalPensionEmpr + totalArl + totalSena + totalIcbf + totalCcf;
    const totalProvisions = totalPrima + totalCesantias + totalIntCesantias + totalVacaciones;
    const grandTotalDebit = totalDevengado + totalEmployerCost + totalProvisions;
    const grandTotalCredit = grandTotalDebit;

    const description = `Nómina ${period.period_type} - ${period.year}/${String(period.month).padStart(2,'0')} P${period.period_number}`;

    // Insert journal entry
    const entryRes = await client.query(
        `INSERT INTO journal_entries (tenant_id, entry_number, entry_date, description, document_type, document_id, total_debit, total_credit, status, created_by)
         VALUES ($1, $2, $3, $4, 'NOMINA', $5, $6, $7, 'ACTIVO', $8) RETURNING id`,
        [tenantId, entryNumber, period.payment_date || period.end_date, description, String(period.id), grandTotalDebit, grandTotalCredit, userId]
    );
    const journalEntryId = entryRes.rows[0].id;

    // Insert lines
    const lines = [];

    // DEBITS - Gastos de nómina
    if (totalDevengado > 0) lines.push({ code: '510506', name: 'SUELDOS Y SALARIOS', desc: 'Salarios devengados', debit: totalDevengado, credit: 0 });
    if (totalHealthEmpr > 0) lines.push({ code: '510569', name: 'APORTES SALUD EMPLEADOR', desc: 'Aporte salud empleador', debit: totalHealthEmpr, credit: 0 });
    if (totalPensionEmpr > 0) lines.push({ code: '510570', name: 'APORTES PENSION EMPLEADOR', desc: 'Aporte pensión empleador', debit: totalPensionEmpr, credit: 0 });
    if (totalArl > 0) lines.push({ code: '510568', name: 'APORTES ARL', desc: 'Aporte ARL', debit: totalArl, credit: 0 });
    if (totalSena > 0) lines.push({ code: '510572', name: 'APORTES SENA', desc: 'Aporte SENA', debit: totalSena, credit: 0 });
    if (totalIcbf > 0) lines.push({ code: '510575', name: 'APORTES ICBF', desc: 'Aporte ICBF', debit: totalIcbf, credit: 0 });
    if (totalCcf > 0) lines.push({ code: '510578', name: 'APORTES CAJA COMPENSACION', desc: 'Aporte caja compensación', debit: totalCcf, credit: 0 });
    if (totalPrima > 0) lines.push({ code: '510536', name: 'PRIMA DE SERVICIOS', desc: 'Provisión prima', debit: totalPrima, credit: 0 });
    if (totalCesantias > 0) lines.push({ code: '510539', name: 'CESANTIAS', desc: 'Provisión cesantías', debit: totalCesantias, credit: 0 });
    if (totalIntCesantias > 0) lines.push({ code: '510542', name: 'INTERESES SOBRE CESANTIAS', desc: 'Provisión intereses cesantías', debit: totalIntCesantias, credit: 0 });
    if (totalVacaciones > 0) lines.push({ code: '510545', name: 'VACACIONES', desc: 'Provisión vacaciones', debit: totalVacaciones, credit: 0 });

    // CREDITS
    if (totalNetPay > 0) lines.push({ code: '250505', name: 'SALARIOS POR PAGAR', desc: 'Neto a pagar empleados', debit: 0, credit: totalNetPay });
    if (totalHealthEmp > 0) lines.push({ code: '237005', name: 'APORTES SALUD POR PAGAR', desc: 'Retención salud empleado', debit: 0, credit: totalHealthEmp });
    if (totalPensionEmp > 0) lines.push({ code: '238030', name: 'APORTES PENSION POR PAGAR', desc: 'Retención pensión empleado', debit: 0, credit: totalPensionEmp });
    if (totalHealthEmpr > 0) lines.push({ code: '237006', name: 'APORTES SALUD EMPLEADOR POR PAGAR', desc: 'Aporte salud empleador por pagar', debit: 0, credit: totalHealthEmpr });
    if (totalPensionEmpr > 0) lines.push({ code: '238031', name: 'APORTES PENSION EMPLEADOR POR PAGAR', desc: 'Aporte pensión empleador por pagar', debit: 0, credit: totalPensionEmpr });
    if (totalArl > 0) lines.push({ code: '237010', name: 'APORTES ARL POR PAGAR', desc: 'ARL por pagar', debit: 0, credit: totalArl });
    if (totalSena > 0) lines.push({ code: '237045', name: 'APORTES SENA POR PAGAR', desc: 'SENA por pagar', debit: 0, credit: totalSena });
    if (totalIcbf > 0) lines.push({ code: '237050', name: 'APORTES ICBF POR PAGAR', desc: 'ICBF por pagar', debit: 0, credit: totalIcbf });
    if (totalCcf > 0) lines.push({ code: '237055', name: 'APORTES CCF POR PAGAR', desc: 'Caja compensación por pagar', debit: 0, credit: totalCcf });
    if (totalPrima > 0) lines.push({ code: '261005', name: 'PRIMA DE SERVICIOS POR PAGAR', desc: 'Provisión prima por pagar', debit: 0, credit: totalPrima });
    if (totalCesantias > 0) lines.push({ code: '261010', name: 'CESANTIAS POR PAGAR', desc: 'Provisión cesantías por pagar', debit: 0, credit: totalCesantias });
    if (totalIntCesantias > 0) lines.push({ code: '261015', name: 'INTERESES CESANTIAS POR PAGAR', desc: 'Provisión intereses por pagar', debit: 0, credit: totalIntCesantias });
    if (totalVacaciones > 0) lines.push({ code: '261020', name: 'VACACIONES POR PAGAR', desc: 'Provisión vacaciones por pagar', debit: 0, credit: totalVacaciones });

    for (const line of lines) {
        await client.query(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_code, account_name, description, debit, credit) VALUES ($1, $2, $3, $4, $5, $6)`,
            [journalEntryId, line.code, line.name, line.desc, line.debit, line.credit]
        );
    }

    return { journalEntryId, entryNumber };
};

// =============================================
// EXPORTS
// =============================================

module.exports = {
    createJournalFromInvoice,
    createJournalFromCreditNote,
    createJournalFromDebitNote,
    createJournalFromPaymentReceipt,
    createAccountsReceivableFromInvoice,
    applyPaymentToAccountsReceivable,
    reversePaymentFromAccountsReceivable,
    createJournalFromPayroll,
    ensureAccountExists,
    getAccountType,
    getAccountingContext
};


