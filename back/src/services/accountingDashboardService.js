const db = require('../config/db');

const getDashboardSummaryData = async (tenantId) => {
    const [kpis, entriesCount, pendingMappings] = await Promise.all([
        db.query(
            `SELECT
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) as total_ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' THEN jel.debit - jel.credit ELSE 0 END), 0) as total_gastos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '6%' THEN jel.debit - jel.credit ELSE 0 END), 0) as total_costos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'`,
            [tenantId]
        ),
        db.query(
            `SELECT COUNT(*) as total FROM journal_entries WHERE tenant_id = $1 AND status = 'ACTIVO'`,
            [tenantId]
        ),
        db.query(
            `SELECT COUNT(*) as total FROM account_mappings WHERE tenant_id = $1 AND approved = false`,
            [tenantId]
        )
    ]);

    const { total_ingresos, total_gastos, total_costos } = kpis.rows[0];
    const utilidad = Number(total_ingresos) - Number(total_gastos) - Number(total_costos);

    return {
        ingresos: Number(total_ingresos),
        gastos: Number(total_gastos),
        costos: Number(total_costos),
        utilidad,
        totalAsientos: parseInt(entriesCount.rows[0].total, 10),
        pendingMappings: parseInt(pendingMappings.rows[0].total, 10)
    };
};

const getDashboardChartData = async (tenantId) => {
    const [monthly, categories] = await Promise.all([
        db.query(
            `SELECT
                TO_CHAR(je.entry_date, 'YYYY-MM') as month,
                TO_CHAR(je.entry_date, 'Mon') as month_name,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit - jel.debit ELSE 0 END), 0) as ingresos,
                COALESCE(SUM(CASE WHEN jel.account_code LIKE '5%' OR jel.account_code LIKE '6%' THEN jel.debit - jel.credit ELSE 0 END), 0) as gastos
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')
             GROUP BY TO_CHAR(je.entry_date, 'YYYY-MM'), TO_CHAR(je.entry_date, 'Mon')
             ORDER BY month`,
            [tenantId]
        ),
        db.query(
            `SELECT
                jel.account_name as category,
                COALESCE(SUM(jel.debit - jel.credit), 0) as amount
             FROM journal_entry_lines jel
             INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
             WHERE je.tenant_id = $1 AND je.status = 'ACTIVO'
               AND (jel.account_code LIKE '5%' OR jel.account_code LIKE '6%')
               AND je.entry_date >= (CURRENT_DATE - INTERVAL '12 months')
             GROUP BY jel.account_name
             HAVING SUM(jel.debit - jel.credit) > 0
             ORDER BY amount DESC
             LIMIT 8`,
            [tenantId]
        )
    ]);

    return {
        monthly: monthly.rows,
        categories: categories.rows
    };
};

module.exports = {
    getDashboardSummaryData,
    getDashboardChartData
};
