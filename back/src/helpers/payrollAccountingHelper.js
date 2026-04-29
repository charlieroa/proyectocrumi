const { createJournalFromPayroll } = require('./accountingHelper');
const { logAccountingAudit } = require('./accountingAuditHelper');

const getPayrollAccountingSnapshot = async (client, tenantId, periodId) => {
    const [periodResult, summaryResult] = await Promise.all([
        client.query(
            `SELECT pp.*,
                    je.id AS accounting_journal_id,
                    je.entry_number AS accounting_journal_number_live,
                    je.entry_date AS accounting_journal_date,
                    je.description AS accounting_journal_description,
                    je.total_debit AS accounting_journal_total_debit,
                    je.total_credit AS accounting_journal_total_credit
             FROM payroll_periods pp
             LEFT JOIN journal_entries je ON je.id = pp.accounting_journal_entry_id
             WHERE pp.id = $1 AND pp.tenant_id = $2
             LIMIT 1`,
            [periodId, tenantId]
        ),
        client.query(
            `SELECT
                COUNT(*)::int AS liquidation_count,
                COALESCE(SUM(total_devengado), 0) AS total_devengado,
                COALESCE(SUM(total_deductions), 0) AS total_deducido,
                COALESCE(SUM(net_pay), 0) AS total_neto,
                COALESCE(SUM(total_employer_cost), 0) AS total_costo_empresa,
                COALESCE(SUM(total_provisions), 0) AS total_provisiones
             FROM payroll_liquidations
             WHERE period_id = $1 AND tenant_id = $2`,
            [periodId, tenantId]
        )
    ]);

    const period = periodResult.rows[0] || null;
    if (!period) {
        return null;
    }

    return {
        period,
        summary: summaryResult.rows[0] || {
            liquidation_count: 0,
            total_devengado: 0,
            total_deducido: 0,
            total_neto: 0,
            total_costo_empresa: 0,
            total_provisiones: 0
        }
    };
};

const accountPayrollPeriod = async (client, tenantId, periodId, userId) => {
    const snapshot = await getPayrollAccountingSnapshot(client, tenantId, periodId);
    if (!snapshot) {
        throw new Error('Periodo de nómina no encontrado');
    }

    const { period, summary } = snapshot;
    if (Number(summary.liquidation_count || 0) === 0) {
        throw new Error('No se puede contabilizar un periodo sin liquidaciones');
    }

    if (period.accounting_status === 'CONTABILIZADO' && period.accounting_journal_entry_id) {
        return {
            period,
            journalEntryId: period.accounting_journal_entry_id,
            journalEntryNumber: period.accounting_journal_number || period.accounting_journal_number_live || null,
            source: 'EXISTENTE',
            summary
        };
    }

    let journalEntryId = period.accounting_journal_entry_id || null;
    let journalEntryNumber = period.accounting_journal_number || null;
    let source = 'CREATED';

    if (journalEntryId) {
        const linkedEntryResult = await client.query(
            `SELECT id, entry_number
             FROM journal_entries
             WHERE id = $1 AND tenant_id = $2
             LIMIT 1`,
            [journalEntryId, tenantId]
        );
        if (linkedEntryResult.rows[0]) {
            journalEntryNumber = linkedEntryResult.rows[0].entry_number;
            source = 'LINKED';
        } else {
            journalEntryId = null;
            journalEntryNumber = null;
        }
    }

    if (!journalEntryId) {
        const existingJournalResult = await client.query(
            `SELECT id, entry_number
             FROM journal_entries
             WHERE tenant_id = $1 AND document_type = 'NOMINA' AND document_id = $2
             ORDER BY id DESC
             LIMIT 1`,
            [tenantId, String(periodId)]
        );
        if (existingJournalResult.rows[0]) {
            journalEntryId = existingJournalResult.rows[0].id;
            journalEntryNumber = existingJournalResult.rows[0].entry_number;
            source = 'LINKED';
        }
    }

    if (!journalEntryId) {
        const liquidationsResult = await client.query(
            `SELECT *
             FROM payroll_liquidations
             WHERE period_id = $1 AND tenant_id = $2
             ORDER BY employee_id ASC, id ASC`,
            [periodId, tenantId]
        );

        const journal = await createJournalFromPayroll(client, tenantId, period, liquidationsResult.rows, userId);
        if (!journal) {
            throw new Error('No se pudo crear el asiento contable de nómina');
        }

        journalEntryId = journal.journalEntryId;
        journalEntryNumber = journal.entryNumber;
        source = 'CREATED';
    }

    await client.query(
        `UPDATE payroll_periods
         SET accounting_status = 'CONTABILIZADO',
             accounting_journal_entry_id = $1,
             accounting_journal_number = $2,
             accounting_posted_at = NOW(),
             accounting_error = NULL,
             updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [journalEntryId, journalEntryNumber, periodId, tenantId]
    );

    await logAccountingAudit(client, {
        tenantId,
        category: 'nomina',
        action: 'PAYROLL_ACCOUNTED',
        entityType: 'payroll_period',
        entityId: periodId,
        entityNumber: journalEntryNumber,
        documentType: 'NOMINA',
        documentId: periodId,
        documentNumber: journalEntryNumber,
        message: `Periodo de nómina contabilizado con asiento ${journalEntryNumber}`,
        afterData: {
            accounting_status: 'CONTABILIZADO',
            accounting_journal_entry_id: journalEntryId,
            accounting_journal_number: journalEntryNumber
        },
        metadata: {
            source,
            liquidation_count: summary.liquidation_count
        },
        createdBy: userId
    });

    return {
        period: {
            ...period,
            accounting_status: 'CONTABILIZADO',
            accounting_journal_entry_id: journalEntryId,
            accounting_journal_number: journalEntryNumber,
            accounting_posted_at: new Date().toISOString()
        },
        journalEntryId,
        journalEntryNumber,
        source,
        summary
    };
};

module.exports = {
    getPayrollAccountingSnapshot,
    accountPayrollPeriod
};
