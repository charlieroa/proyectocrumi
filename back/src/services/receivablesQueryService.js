const db = require('../config/db');

const getAccountsReceivableReportData = async (tenantId, filters = {}) => {
    const { status, customerSearch } = filters;

    let whereClause = 'WHERE tenant_id = $1';
    const params = [tenantId];
    let paramIdx = 2;

    if (status && status !== 'TODAS') {
        whereClause += ` AND status = $${paramIdx}`;
        params.push(status);
        paramIdx++;
    }

    if (customerSearch) {
        whereClause += ` AND (client_name ILIKE $${paramIdx} OR client_document_number ILIKE $${paramIdx})`;
        params.push(`%${customerSearch}%`);
        paramIdx++;
    }

    const result = await db.query(
        `SELECT
            ar.*,
            GREATEST(CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date), 0) AS days_overdue,
            CASE
                WHEN ar.balance_amount <= 0.009 THEN 'AL DIA'
                WHEN CURRENT_DATE <= COALESCE(ar.due_date, ar.issue_date) THEN 'AL DIA'
                WHEN CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date) BETWEEN 1 AND 30 THEN '1-30'
                WHEN CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date) BETWEEN 31 AND 60 THEN '31-60'
                WHEN CURRENT_DATE - COALESCE(ar.due_date, ar.issue_date) BETWEEN 61 AND 90 THEN '61-90'
                ELSE '90+'
            END AS aging_bucket
         FROM accounts_receivable ar
         ${whereClause}
         ORDER BY COALESCE(ar.due_date, ar.issue_date) ASC, ar.id DESC`,
        params
    );

    const summary = result.rows.reduce((acc, row) => {
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

    return { receivables: result.rows, summary };
};

const getThirdPartyLedgerData = async (tenantId, filters = {}) => {
    const { thirdParty, startDate, endDate } = filters;

    let whereAr = 'WHERE ar.tenant_id = $1';
    let whereApp = 'WHERE ar.tenant_id = $1';
    const params = [tenantId];
    let paramIdx = 2;

    if (thirdParty) {
        whereAr += ` AND (ar.client_name ILIKE $${paramIdx} OR ar.client_document_number ILIKE $${paramIdx})`;
        whereApp += ` AND (ar.client_name ILIKE $${paramIdx} OR ar.client_document_number ILIKE $${paramIdx})`;
        params.push(`%${thirdParty}%`);
        paramIdx++;
    }
    if (startDate) {
        whereAr += ` AND ar.issue_date >= $${paramIdx}`;
        whereApp += ` AND app.application_date >= $${paramIdx}`;
        params.push(startDate);
        paramIdx++;
    }
    if (endDate) {
        whereAr += ` AND ar.issue_date <= $${paramIdx}`;
        whereApp += ` AND app.application_date <= $${paramIdx}`;
        params.push(endDate);
        paramIdx++;
    }

    const result = await db.query(
        `WITH movements AS (
            SELECT
                COALESCE(ar.client_document_number, 'SIN-DOC') AS third_party_id,
                COALESCE(ar.client_name, 'SIN NOMBRE') AS third_party_name,
                ar.issue_date AS movement_date,
                ar.document_type,
                ar.document_number,
                ar.notes AS description,
                ar.original_amount AS debit,
                0::numeric AS credit
            FROM accounts_receivable ar
            ${whereAr}

            UNION ALL

            SELECT
                COALESCE(ar.client_document_number, 'SIN-DOC') AS third_party_id,
                COALESCE(ar.client_name, 'SIN NOMBRE') AS third_party_name,
                app.application_date AS movement_date,
                app.source_type AS document_type,
                app.source_number AS document_number,
                COALESCE(app.notes, 'Aplicacion de cartera') AS description,
                0::numeric AS debit,
                app.amount AS credit
            FROM accounts_receivable_applications app
            INNER JOIN accounts_receivable ar ON ar.id = app.accounts_receivable_id
            ${whereApp}
        )
        SELECT
            third_party_id,
            third_party_name,
            movement_date,
            document_type,
            document_number,
            description,
            debit,
            credit,
            SUM(debit - credit) OVER (
                PARTITION BY third_party_id
                ORDER BY movement_date, document_number
            ) AS running_balance
        FROM movements
        ORDER BY third_party_name, movement_date, document_number`,
        params
    );

    const summaryMap = new Map();
    for (const row of result.rows) {
        const key = row.third_party_id;
        const current = summaryMap.get(key) || {
            third_party_id: row.third_party_id,
            third_party_name: row.third_party_name,
            total_debit: 0,
            total_credit: 0,
            balance: 0
        };
        current.total_debit += Number(row.debit || 0);
        current.total_credit += Number(row.credit || 0);
        current.balance = current.total_debit - current.total_credit;
        summaryMap.set(key, current);
    }

    return {
        movements: result.rows,
        summary: Array.from(summaryMap.values()).sort((a, b) => b.balance - a.balance)
    };
};

module.exports = {
    getAccountsReceivableReportData,
    getThirdPartyLedgerData,
};
