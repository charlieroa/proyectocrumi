const db = require('../config/db');

const mapLine = (row) => ({
    id: row.id,
    line_no: row.line_no,
    concept_name: row.concept_name,
    description: row.description,
    puc_code: row.puc_code,
    puc_name: row.puc_name,
    cost_center: row.cost_center,
    quantity: Number(row.quantity || 0),
    unit_price: Number(row.unit_price || 0),
    discount_pct: Number(row.discount_pct || 0),
    iva_pct: Number(row.iva_pct || 0),
    rf_pct: Number(row.rf_pct || 0),
    subtotal_amount: Number(row.subtotal_amount || 0),
    discount_amount: Number(row.discount_amount || 0),
    base_amount: Number(row.base_amount || 0),
    iva_amount: Number(row.iva_amount || 0),
    rf_amount: Number(row.rf_amount || 0),
    line_total: Number(row.line_total || 0),
    notes: row.notes,
    product_id: row.product_id,
    service_id: row.service_id,
    item_type: row.item_type,
    // Alias camelCase para frontend (Compras.tsx usa estos nombres)
    expense_account_code: row.puc_code,
    item: row.concept_name,
    price: Number(row.unit_price || 0),
    discount: Number(row.discount_pct || 0),
    tax: Number(row.iva_pct || 0),
    retentionRate: Number(row.rf_pct || 0),
    costCenter: row.cost_center,
});

const loadItemsForPayableIds = async (tenantId, payableIds) => {
    if (!payableIds || payableIds.length === 0) return new Map();
    const res = await db.query(
        `SELECT * FROM accounts_payable_lines
         WHERE tenant_id = $1 AND accounts_payable_id = ANY($2::int[])
         ORDER BY accounts_payable_id, line_no, id`,
        [tenantId, payableIds]
    );
    const byPayable = new Map();
    for (const r of res.rows) {
        const k = Number(r.accounts_payable_id);
        if (!byPayable.has(k)) byPayable.set(k, []);
        byPayable.get(k).push(mapLine(r));
    }
    return byPayable;
};

const getAccountsPayableReportData = async (tenantId, filters = {}) => {
    const { status, supplierSearch, documentType, startDate, endDate } = filters;

    let whereClause = 'WHERE tenant_id = $1';
    const params = [tenantId];
    let paramIdx = 2;

    if (status && status !== 'TODAS') {
        whereClause += ` AND status = $${paramIdx}`;
        params.push(status);
        paramIdx++;
    }
    if (supplierSearch) {
        whereClause += ` AND (supplier_name ILIKE $${paramIdx} OR COALESCE(supplier_document_number, '') ILIKE $${paramIdx} OR COALESCE(document_number, '') ILIKE $${paramIdx} OR COALESCE(internal_number, '') ILIKE $${paramIdx})`;
        params.push(`%${supplierSearch}%`);
        paramIdx++;
    }
    if (documentType) {
        whereClause += ` AND document_type = $${paramIdx}`;
        params.push(documentType);
        paramIdx++;
    }
    if (startDate) {
        whereClause += ` AND issue_date >= $${paramIdx}`;
        params.push(startDate);
        paramIdx++;
    }
    if (endDate) {
        whereClause += ` AND issue_date <= $${paramIdx}`;
        params.push(endDate);
        paramIdx++;
    }

    const result = await db.query(
        `SELECT
            ap.*,
            GREATEST(CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date), 0) AS days_overdue,
            CASE
                WHEN ap.balance_amount <= 0.009 THEN 'AL DIA'
                WHEN CURRENT_DATE <= COALESCE(ap.due_date, ap.issue_date) THEN 'AL DIA'
                WHEN CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date) BETWEEN 1 AND 30 THEN '1-30'
                WHEN CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date) BETWEEN 31 AND 60 THEN '31-60'
                WHEN CURRENT_DATE - COALESCE(ap.due_date, ap.issue_date) BETWEEN 61 AND 90 THEN '61-90'
                ELSE '90+'
            END AS aging_bucket
         FROM accounts_payable ap
         ${whereClause}
         ORDER BY COALESCE(ap.due_date, ap.issue_date) ASC, ap.id DESC`,
        params
    );

    // Hidratar items por factura (1 query batch, no N+1)
    const payableIds = result.rows.map(r => Number(r.id));
    const itemsByPayable = await loadItemsForPayableIds(tenantId, payableIds);

    const payables = result.rows.map(row => ({
        ...row,
        items: itemsByPayable.get(Number(row.id)) || [],
    }));

    const summary = payables.reduce((acc, row) => {
        const balance = Number(row.balance_amount || 0);
        acc.totalOriginal += Number(row.original_amount || 0);
        acc.totalPaid += Number(row.paid_amount || 0);
        acc.totalBalance += balance;
        acc.byBucket[row.aging_bucket] = (acc.byBucket[row.aging_bucket] || 0) + balance;
        return acc;
    }, {
        totalOriginal: 0,
        totalPaid: 0,
        totalBalance: 0,
        byBucket: { 'AL DIA': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    });

    return { payables, summary };
};

const getAccountsPayableByIdData = async (tenantId, payableId) => {
    const res = await db.query(
        `SELECT * FROM accounts_payable WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [payableId, tenantId]
    );
    if (res.rows.length === 0) return null;
    const payable = res.rows[0];
    const itemsRes = await db.query(
        `SELECT * FROM accounts_payable_lines
         WHERE tenant_id = $1 AND accounts_payable_id = $2
         ORDER BY line_no, id`,
        [tenantId, payableId]
    );
    return {
        ...payable,
        items: itemsRes.rows.map(mapLine),
    };
};

const getAccountsPayablePaymentsReportData = async (tenantId, filters = {}) => {
    const { supplierSearch, startDate, endDate } = filters;

    let whereClause = 'WHERE apa.tenant_id = $1';
    const params = [tenantId];
    let paramIdx = 2;

    if (supplierSearch) {
        whereClause += ` AND (ap.supplier_name ILIKE $${paramIdx} OR COALESCE(ap.supplier_document_number, '') ILIKE $${paramIdx})`;
        params.push(`%${supplierSearch}%`);
        paramIdx++;
    }
    if (startDate) {
        whereClause += ` AND apa.application_date >= $${paramIdx}`;
        params.push(startDate);
        paramIdx++;
    }
    if (endDate) {
        whereClause += ` AND apa.application_date <= $${paramIdx}`;
        params.push(endDate);
        paramIdx++;
    }

    const result = await db.query(
        `SELECT
            apa.id,
            apa.source_type,
            apa.source_number,
            apa.application_date AS date,
            apa.amount,
            apa.notes,
            apa.payment_method AS method,
            apa.bank_account_code,
            apa.reference,
            COALESCE(apa.status, 'ACTIVO') AS status,
            apa.voided_at,
            apa.void_reason,
            ap.id AS payable_id,
            ap.document_number AS payable_document_number,
            ap.document_type AS payable_document_type,
            ap.supplier_name,
            ap.supplier_document_number,
            ap.original_amount AS payable_total,
            ap.balance_amount AS payable_balance,
            ap.payable_account_code
         FROM accounts_payable_applications apa
         INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
         ${whereClause}
         ORDER BY apa.application_date DESC, apa.id DESC`,
        params
    );

    const summary = result.rows.reduce((acc, row) => {
        const isActive = String(row.status || 'ACTIVO').toUpperCase() === 'ACTIVO';
        acc.count += 1;
        if (isActive) acc.totalPaid += Number(row.amount || 0);
        else acc.voidedCount += 1;
        return acc;
    }, { totalPaid: 0, count: 0, voidedCount: 0 });

    return { payments: result.rows, summary };
};

const getPaymentDetailData = async (tenantId, applicationId) => {
    const appRes = await db.query(
        `SELECT
            apa.*,
            ap.document_number AS payable_document_number,
            ap.document_type AS payable_document_type,
            ap.internal_number AS payable_internal_number,
            ap.is_electronic AS payable_is_electronic,
            ap.supplier_name,
            ap.supplier_document_type,
            ap.supplier_document_number,
            ap.issue_date AS payable_issue_date,
            ap.due_date AS payable_due_date,
            ap.subtotal_amount AS payable_subtotal,
            ap.tax_amount AS payable_tax,
            ap.withholding_source_amount AS payable_retefuente,
            ap.withholding_ica_amount AS payable_reteica,
            ap.withholding_vat_amount AS payable_reteiva,
            ap.original_amount AS payable_total,
            ap.paid_amount AS payable_paid,
            ap.balance_amount AS payable_balance,
            ap.status AS payable_status,
            ap.expense_account_code,
            ap.expense_account_name,
            ap.payable_account_code
         FROM accounts_payable_applications apa
         INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
         WHERE apa.tenant_id = $1 AND apa.id = $2
         LIMIT 1`,
        [tenantId, applicationId]
    );
    if (appRes.rows.length === 0) return null;
    const row = appRes.rows[0];

    const payableTotal = Number(row.payable_total || 0);
    const amount = Number(row.amount || 0);

    // Hermanos del comprobante: todas las applications que compartan source_number (multi-factura)
    const siblingsRes = await db.query(
        `SELECT apa.*, ap.document_type AS sib_doc_type, ap.document_number AS sib_doc_number,
                ap.supplier_name AS sib_supplier_name, ap.supplier_document_number AS sib_supplier_doc,
                ap.issue_date AS sib_issue_date, ap.due_date AS sib_due_date,
                ap.original_amount AS sib_original, ap.paid_amount AS sib_paid,
                ap.balance_amount AS sib_balance
         FROM accounts_payable_applications apa
         INNER JOIN accounts_payable ap ON ap.id = apa.accounts_payable_id
         WHERE apa.tenant_id = $1 AND apa.source_number = $2 AND apa.source_type = 'PAGO_CXP'
         ORDER BY apa.id ASC`,
        [tenantId, row.source_number]
    );
    const siblingInvoices = siblingsRes.rows.map(s => ({
        application_id: s.id,
        payable_id: s.accounts_payable_id,
        document_type: s.sib_doc_type,
        document_number: s.sib_doc_number,
        supplier_name: s.sib_supplier_name,
        supplier_document_number: s.sib_supplier_doc,
        issue_date: s.sib_issue_date,
        due_date: s.sib_due_date,
        original_amount: Number(s.sib_original || 0),
        paid_after: Number(s.sib_paid || 0),
        balance_after: Number(s.sib_balance || 0),
        amount_applied: Number(s.gross_amount || 0) || Number(s.amount || 0),
        amount_net: Number(s.amount || 0),
        gross_amount: Number(s.gross_amount || 0),
        withholding_source_amount: Number(s.withholding_source_amount || 0),
        withholding_ica_amount: Number(s.withholding_ica_amount || 0),
        withholding_vat_amount: Number(s.withholding_vat_amount || 0),
        status: s.status,
    }));

    // Items de la factura pagada (si existen)
    const payableItemsRes = await db.query(
        `SELECT * FROM accounts_payable_lines WHERE tenant_id = $1 AND accounts_payable_id = $2 ORDER BY line_no, id`,
        [tenantId, row.accounts_payable_id]
    );
    const payableItems = payableItemsRes.rows.map(mapLine);

    let paymentMethods = [];
    const withMethods = siblingsRes.rows.find(s => s.payment_methods);
    if (withMethods) {
        try {
            const raw = typeof withMethods.payment_methods === 'string'
                ? JSON.parse(withMethods.payment_methods)
                : withMethods.payment_methods;
            paymentMethods = Array.isArray(raw) ? raw.map(m => ({
                method: m.method,
                amount: Number(m.amount || 0),
                bank_account_code: m.bankAccountCode || m.bank_account_code || null,
            })) : [];
        } catch { /* noop */ }
    }
    if (paymentMethods.length === 0) {
        const totalNet = siblingsRes.rows.reduce((s, r) => s + Number(r.amount || 0), 0);
        paymentMethods = [{
            method: row.payment_method || 'BANK_TRANSFER',
            amount: totalNet,
            bank_account_code: row.bank_account_code || null,
        }];
    }

    const journalRes = await db.query(
        `SELECT id, entry_number, description, document_type, document_number,
                entry_date, status, created_at
         FROM journal_entries
         WHERE tenant_id = $1 AND document_number = $2
           AND document_type IN ('PAGO_CXP', 'REVERSO_PAGO_CXP')
         ORDER BY id ASC`,
        [tenantId, row.source_number]
    );

    let lines = [];
    if (journalRes.rows.length > 0) {
        const ids = journalRes.rows.map(r => r.id);
        const linesRes = await db.query(
            `SELECT journal_entry_id, account_code, account_name, description, debit, credit,
                    third_party_document, third_party_name
             FROM journal_entry_lines
             WHERE journal_entry_id = ANY($1::int[])
             ORDER BY journal_entry_id, id`,
            [ids]
        );
        lines = linesRes.rows;
    }

    return {
        application: {
            id: row.id,
            source_number: row.source_number,
            source_type: row.source_type,
            date: row.application_date,
            amount,
            gross_amount: Number(row.gross_amount || 0) || (amount + Number(row.withholding_source_amount || 0) + Number(row.withholding_ica_amount || 0) + Number(row.withholding_vat_amount || 0)),
            withholding_source_amount: Number(row.withholding_source_amount || 0),
            withholding_ica_amount: Number(row.withholding_ica_amount || 0),
            withholding_vat_amount: Number(row.withholding_vat_amount || 0),
            withholding_source_code: row.withholding_source_code || null,
            withholding_ica_code: row.withholding_ica_code || null,
            withholding_vat_code: row.withholding_vat_code || null,
            method: row.payment_method,
            bank_account_code: row.bank_account_code,
            reference: row.reference,
            notes: row.notes,
            status: row.status || 'ACTIVO',
            voided_at: row.voided_at,
            void_reason: row.void_reason,
            created_at: row.created_at,
            invoices: siblingInvoices,
            paymentMethods,
        },
        payable: {
            id: row.accounts_payable_id,
            document_type: row.payable_document_type,
            document_number: row.payable_document_number,
            internal_number: row.payable_internal_number,
            is_electronic: row.payable_is_electronic,
            supplier_name: row.supplier_name,
            supplier_document_type: row.supplier_document_type,
            supplier_document_number: row.supplier_document_number,
            issue_date: row.payable_issue_date,
            due_date: row.payable_due_date,
            subtotal: Number(row.payable_subtotal || 0),
            tax: Number(row.payable_tax || 0),
            retefuente: Number(row.payable_retefuente || 0),
            reteica: Number(row.payable_reteica || 0),
            reteiva: Number(row.payable_reteiva || 0),
            total: payableTotal,
            paid: Number(row.payable_paid || 0),
            balance: Number(row.payable_balance || 0),
            status: row.payable_status,
            expense_account_code: row.expense_account_code,
            expense_account_name: row.expense_account_name,
            payable_account_code: row.payable_account_code,
            items: payableItems,
        },
        journal: {
            entries: journalRes.rows,
            lines,
        },
    };
};

const getTaxSummaryData = async (tenantId, filters = {}) => {
    const { startDate, endDate } = filters;

    let invoiceDateFilter = '';
    let payableDateFilter = '';
    const invoiceParams = [tenantId];
    const payableParams = [tenantId];
    let invoiceIdx = 2;
    let payableIdx = 2;

    if (startDate) {
        invoiceDateFilter += ` AND date >= $${invoiceIdx++}`;
        payableDateFilter += ` AND issue_date >= $${payableIdx++}`;
        invoiceParams.push(startDate);
        payableParams.push(startDate);
    }
    if (endDate) {
        invoiceDateFilter += ` AND date <= $${invoiceIdx++}`;
        payableDateFilter += ` AND issue_date <= $${payableIdx++}`;
        invoiceParams.push(endDate);
        payableParams.push(endDate);
    }

    const salesTaxesResult = await db.query(
        `SELECT COALESCE(SUM(tax_amount), 0) AS vat_generated
         FROM invoices
         WHERE tenant_id = $1
         ${invoiceDateFilter}`,
        invoiceParams
    );

    const purchasesTaxesResult = await db.query(
        `SELECT
            COALESCE(SUM(tax_amount), 0) AS vat_deductible,
            COALESCE(SUM(withholding_source_amount), 0) AS withholding_source,
            COALESCE(SUM(withholding_ica_amount), 0) AS withholding_ica,
            COALESCE(SUM(withholding_vat_amount), 0) AS withholding_vat,
            COALESCE(SUM(subtotal_amount), 0) AS purchase_subtotal,
            COALESCE(SUM(original_amount), 0) AS net_payable
         FROM accounts_payable
         WHERE tenant_id = $1
         ${payableDateFilter}`,
        payableParams
    );

    const taxes = {
        vatGenerated: Number(salesTaxesResult.rows[0]?.vat_generated || 0),
        vatDeductible: Number(purchasesTaxesResult.rows[0]?.vat_deductible || 0),
        withholdingSource: Number(purchasesTaxesResult.rows[0]?.withholding_source || 0),
        withholdingIca: Number(purchasesTaxesResult.rows[0]?.withholding_ica || 0),
        withholdingVat: Number(purchasesTaxesResult.rows[0]?.withholding_vat || 0),
        purchaseSubtotal: Number(purchasesTaxesResult.rows[0]?.purchase_subtotal || 0),
        netPayable: Number(purchasesTaxesResult.rows[0]?.net_payable || 0)
    };

    return {
        ...taxes,
        vatPayable: taxes.vatGenerated - taxes.vatDeductible,
        totalWithholdings: taxes.withholdingSource + taxes.withholdingIca + taxes.withholdingVat
    };
};

module.exports = {
    getAccountsPayableReportData,
    getAccountsPayableByIdData,
    getAccountsPayablePaymentsReportData,
    getPaymentDetailData,
    getTaxSummaryData,
};
