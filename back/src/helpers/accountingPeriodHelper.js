const db = require('../config/db');

const toDateOnly = (value) => {
    const date = value ? new Date(value) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const ensureAccountingPeriod = async (client, tenantId, targetDate) => {
    const date = toDateOnly(targetDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await client.query(
        `INSERT INTO accounting_periods (
            tenant_id, period_year, period_month, start_date, end_date, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'ABIERTO', NOW(), NOW())
        ON CONFLICT (tenant_id, period_year, period_month) DO UPDATE SET
            start_date = accounting_periods.start_date,
            end_date = accounting_periods.end_date
        RETURNING *`,
        [tenantId, year, month, startDate, endDate]
    );

    return result.rows[0];
};

const getLockClosedPeriodsEnabled = async (client, tenantId) => {
    const result = await client.query(
        `SELECT lock_closed_periods
         FROM accounting_settings
         WHERE tenant_id = $1
         LIMIT 1`,
        [tenantId]
    );
    return result.rows[0]?.lock_closed_periods !== false;
};

const assertAccountingPeriodOpen = async (client, tenantId, targetDate) => {
    const lockClosed = await getLockClosedPeriodsEnabled(client, tenantId);
    const period = await ensureAccountingPeriod(client, tenantId, targetDate);

    if (lockClosed && period.status === 'CERRADO') {
        const label = `${period.period_year}-${String(period.period_month).padStart(2, '0')}`;
        throw new Error(`El periodo contable ${label} está cerrado`);
    }

    return period;
};

const listAccountingPeriods = async (client, tenantId) => {
    const result = await client.query(
        `SELECT *
         FROM accounting_periods
         WHERE tenant_id = $1
         ORDER BY period_year DESC, period_month DESC`,
        [tenantId]
    );
    return result.rows;
};

module.exports = {
    ensureAccountingPeriod,
    getLockClosedPeriodsEnabled,
    assertAccountingPeriodOpen,
    listAccountingPeriods
};
