const db = require('../config/db');
const {
    getDefaultAccountName,
    getNextManualVoucherNumber,
    insertJournalEntry
} = require('./accountingCoreService');
const { recordAccountingAuditEvent } = require('../helpers/accountingAuditHelper');

const listManualVouchersData = async (tenantId) => {
    const result = await db.query(
        `SELECT mv.*,
                COALESCE(json_agg(json_build_object(
                    'id', mvl.id,
                    'account_code', mvl.account_code,
                    'account_name', mvl.account_name,
                    'line_description', mvl.line_description,
                    'debit', mvl.debit,
                    'credit', mvl.credit,
                    'third_party_name', mvl.third_party_name,
                    'third_party_document', mvl.third_party_document,
                    'third_party_id', mvl.third_party_id,
                    'base_amount', mvl.base_amount,
                    'tax_type', mvl.tax_type,
                    'tax_rate', mvl.tax_rate,
                    'tax_amount', mvl.tax_amount,
                    'tax_treatment', mvl.tax_treatment,
                    'dian_concept_code', mvl.dian_concept_code
                ) ORDER BY mvl.id) FILTER (WHERE mvl.id IS NOT NULL), '[]'::json) AS lines
         FROM manual_vouchers mv
         LEFT JOIN manual_voucher_lines mvl ON mvl.voucher_id = mv.id
         WHERE mv.tenant_id = $1
         GROUP BY mv.id
         ORDER BY mv.voucher_date DESC, mv.id DESC`,
        [tenantId]
    );

    return result.rows;
};

const createManualVoucherEntry = async ({ tenantId, userId, voucherType = 'AJUSTE_CONTABLE', voucherDate, description, lines = [] }) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        if (!description || !Array.isArray(lines) || lines.length < 2) {
            throw new Error('Descripción y al menos dos líneas son obligatorias');
        }

        const normalizedLines = lines
            .map((line) => ({
                account_code: String(line.account_code || '').trim(),
                account_name: line.account_name || getDefaultAccountName(String(line.account_code || '').trim()),
                description: line.line_description || description,
                debit: Number(line.debit || 0),
                credit: Number(line.credit || 0),
                third_party_name: line.third_party_name || null,
                third_party_document: line.third_party_document || null,
                third_party_id: line.third_party_id || null,
                base_amount: line.base_amount != null ? Number(line.base_amount) : null,
                tax_type: line.tax_type || null,
                tax_rate: line.tax_rate != null ? Number(line.tax_rate) : null,
                tax_amount: line.tax_amount != null ? Number(line.tax_amount) : null,
                tax_treatment: line.tax_treatment || null,
                dian_concept_code: line.dian_concept_code || null,
            }))
            .filter((line) => line.account_code && (line.debit > 0 || line.credit > 0));

        const totalDebit = normalizedLines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = normalizedLines.reduce((sum, line) => sum + line.credit, 0);

        if (normalizedLines.length < 2 || Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error('El comprobante debe tener al menos dos líneas y cuadrar');
        }

        const voucherNumber = await getNextManualVoucherNumber(client, tenantId);
        const journal = await insertJournalEntry(client, tenantId, {
            description,
            documentType: voucherType,
            documentId: `manual-${Date.now()}`,
            documentNumber: voucherNumber,
            entryDate: voucherDate || new Date(),
            lines: normalizedLines,
            userId
        });

        const voucherResult = await client.query(
            `INSERT INTO manual_vouchers (
                tenant_id, voucher_number, voucher_type, voucher_date, description,
                total_debit, total_credit, status, journal_entry_id, created_by, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVO',$8,$9,NOW(),NOW())
            RETURNING *`,
            [tenantId, voucherNumber, voucherType, voucherDate || new Date(), description, totalDebit, totalCredit, journal.id, userId || null]
        );

        for (const line of normalizedLines) {
            await client.query(
                `INSERT INTO manual_voucher_lines (
                    voucher_id, account_code, account_name, line_description, debit, credit,
                    third_party_name, third_party_document, third_party_id,
                    base_amount, tax_type, tax_rate, tax_amount, tax_treatment, dian_concept_code,
                    created_at
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
                [
                    voucherResult.rows[0].id, line.account_code, line.account_name, line.description,
                    line.debit, line.credit, line.third_party_name, line.third_party_document,
                    line.third_party_id, line.base_amount, line.tax_type, line.tax_rate,
                    line.tax_amount, line.tax_treatment, line.dian_concept_code
                ]
            );
        }

        await client.query('COMMIT');

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'manual',
            action: 'voucher.created',
            entityType: 'manual_voucher',
            entityId: voucherResult.rows[0].id,
            entityNumber: voucherResult.rows[0].voucher_number,
            documentType: voucherType,
            documentId: voucherResult.rows[0].id,
            documentNumber: voucherResult.rows[0].voucher_number,
            message: 'Comprobante manual creado',
            afterData: {
                voucher: voucherResult.rows[0],
                journal
            },
            metadata: { source: 'manualVoucherService.createManualVoucherEntry' }
        });

        return { voucher: voucherResult.rows[0], journal };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    listManualVouchersData,
    createManualVoucherEntry
};
