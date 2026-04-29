const db = require('../config/db');

const getTaxConfigurations = async (tenantId) => {
    const result = await db.query(
        'SELECT * FROM tax_configurations WHERE tenant_id = $1 ORDER BY tax_type, name',
        [tenantId]
    );
    return result.rows;
};

const createTaxConfiguration = async (tenantId, data) => {
    const result = await db.query(
        `INSERT INTO tax_configurations (tenant_id, tax_type, name, rate, threshold, effective_from, effective_to, account_code_debit, account_code_credit, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [tenantId, data.taxType, data.name, data.rate || 0, data.threshold || 0, data.effectiveFrom || null, data.effectiveTo || null, data.accountCodeDebit || null, data.accountCodeCredit || null, data.description || null]
    );
    return result.rows[0];
};

const updateTaxConfiguration = async (tenantId, id, data) => {
    const result = await db.query(
        `UPDATE tax_configurations SET tax_type=$2, name=$3, rate=$4, threshold=$5, effective_from=$6, effective_to=$7, account_code_debit=$8, account_code_credit=$9, description=$10, is_active=$11, updated_at=NOW()
         WHERE id=$1 AND tenant_id=$12 RETURNING *`,
        [id, data.taxType, data.name, data.rate, data.threshold, data.effectiveFrom, data.effectiveTo, data.accountCodeDebit, data.accountCodeCredit, data.description, data.isActive !== false, tenantId]
    );
    return result.rows[0];
};

const deleteTaxConfiguration = async (tenantId, id) => {
    await db.query('DELETE FROM tax_configurations WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
};

const getTaxCalendar = async (tenantId, year) => {
    let query = 'SELECT * FROM tax_calendar_events WHERE tenant_id = $1';
    const params = [tenantId];
    if (year) {
        query += ' AND EXTRACT(YEAR FROM due_date) = $2';
        params.push(year);
    }
    query += ' ORDER BY due_date ASC';
    const result = await db.query(query, params);
    return result.rows;
};

const createTaxCalendarEvent = async (tenantId, data) => {
    const result = await db.query(
        `INSERT INTO tax_calendar_events (tenant_id, tax_type, period_label, due_date, description, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, data.taxType, data.periodLabel, data.dueDate, data.description || null, data.notes || null]
    );
    return result.rows[0];
};

const markCalendarEventFiled = async (tenantId, id, userId) => {
    const result = await db.query(
        `UPDATE tax_calendar_events SET status='PRESENTADO', filed_at=NOW(), filed_by=$3 WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [id, tenantId, userId]
    );
    return result.rows[0];
};

const getFiscalYearClosings = async (tenantId) => {
    const result = await db.query(
        'SELECT * FROM fiscal_year_closings WHERE tenant_id = $1 ORDER BY year DESC',
        [tenantId]
    );
    return result.rows;
};

const closeFiscalYear = async (tenantId, year, userId) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Get income and expense totals for the year
        const incomeRes = await client.query(
            `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as total
             FROM journal_entry_lines jel
             JOIN journal_entries je ON je.id = jel.journal_entry_id
             JOIN chart_of_accounts coa ON coa.account_code = jel.account_code AND coa.tenant_id = $1
             WHERE je.tenant_id = $1 AND coa.account_type = 'INGRESO'
             AND EXTRACT(YEAR FROM je.entry_date) = $2`,
            [tenantId, year]
        );

        const expenseRes = await client.query(
            `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) as total
             FROM journal_entry_lines jel
             JOIN journal_entries je ON je.id = jel.journal_entry_id
             JOIN chart_of_accounts coa ON coa.account_code = jel.account_code AND coa.tenant_id = $1
             WHERE je.tenant_id = $1 AND (coa.account_type = 'GASTO' OR coa.account_type = 'COSTO')
             AND EXTRACT(YEAR FROM je.entry_date) = $2`,
            [tenantId, year]
        );

        const totalIncome = Number(incomeRes.rows[0]?.total || 0);
        const totalExpense = Number(expenseRes.rows[0]?.total || 0);
        const netResult = totalIncome - totalExpense;

        // Create closing journal entry (transfer to retained earnings 3605)
        const entryRes = await client.query(
            `INSERT INTO journal_entries (tenant_id, entry_date, description, entry_type, status, created_by)
             VALUES ($1, $2, $3, 'CIERRE_FISCAL', 'POSTED', $4) RETURNING id`,
            [tenantId, `${year}-12-31`, `Cierre fiscal año ${year} - Utilidad/Pérdida del ejercicio`, userId]
        );
        const entryId = entryRes.rows[0].id;

        if (netResult >= 0) {
            // Profit: debit P&L summary (5905), credit retained earnings (3605)
            await client.query(
                `INSERT INTO journal_entry_lines (journal_entry_id, account_code, account_name, debit, credit, line_description)
                 VALUES ($1, '5905', 'GANANCIAS Y PERDIDAS', $2, 0, 'Cierre utilidad del ejercicio'),
                        ($1, '3605', 'UTILIDADES ACUMULADAS', 0, $2, 'Cierre utilidad del ejercicio')`,
                [entryId, Math.abs(netResult)]
            );
        } else {
            // Loss: debit retained earnings, credit P&L summary
            await client.query(
                `INSERT INTO journal_entry_lines (journal_entry_id, account_code, account_name, debit, credit, line_description)
                 VALUES ($1, '3605', 'UTILIDADES ACUMULADAS', $2, 0, 'Cierre perdida del ejercicio'),
                        ($1, '5905', 'GANANCIAS Y PERDIDAS', 0, $2, 'Cierre perdida del ejercicio')`,
                [entryId, Math.abs(netResult)]
            );
        }

        // Record the fiscal year closing
        const closingRes = await client.query(
            `INSERT INTO fiscal_year_closings (tenant_id, year, status, closed_at, closed_by, retained_earnings_entry_id)
             VALUES ($1, $2, 'CERRADO', NOW(), $3, $4)
             ON CONFLICT (tenant_id, year) DO UPDATE SET status='CERRADO', closed_at=NOW(), closed_by=$3, retained_earnings_entry_id=$4
             RETURNING *`,
            [tenantId, year, userId, entryId]
        );

        await client.query('COMMIT');
        return { closing: closingRes.rows[0], journalEntryId: entryId, netResult };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    getTaxConfigurations, createTaxConfiguration, updateTaxConfiguration, deleteTaxConfiguration,
    getTaxCalendar, createTaxCalendarEvent, markCalendarEventFiled,
    getFiscalYearClosings, closeFiscalYear
};
