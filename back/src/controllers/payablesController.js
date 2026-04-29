const db = require('../config/db');
const {
    getAccountsPayableReportData,
    getAccountsPayableByIdData,
    getAccountsPayablePaymentsReportData,
    getPaymentDetailData,
    getTaxSummaryData
} = require('../services/accountsPayableQueryService');
const {
    createAccountsPayableEntry,
    applyAccountsPayablePaymentEntry,
    voidAccountsPayablePaymentEntry,
    voidAccountsPayableEntry,
    updateAccountsPayableEntry
} = require('../services/accountsPayableWriteService');
const { recordAccountingAuditEvent } = require('../helpers/accountingAuditHelper');
const alegraService = require('../services/alegraService');

const resolveTenantId = (req) => req.user?.tenant_id || req.query?.tenantId || req.body?.tenantId;

const getNextPurchaseNumber = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant requerido' });

        const rawElectronic = req.query?.isElectronic ?? req.query?.electronic;
        // Si no viene, default a electrónica
        const isElectronic = rawElectronic === undefined
            ? true
            : String(rawElectronic).toLowerCase() !== 'false' && rawElectronic !== false && rawElectronic !== '0';

        // MAX del consecutivo interno cuando está poblado, y COUNT total de compras de ese tipo
        // como fallback (para compras creadas antes de que existiera internal_number).
        const r = await db.query(
            `SELECT
                COALESCE(MAX(
                    NULLIF(regexp_replace(COALESCE(internal_number, ''), '\\D', '', 'g'), '')::bigint
                ), 0)::bigint AS max_num,
                COUNT(*)::bigint AS total
             FROM accounts_payable
             WHERE tenant_id = $1 AND COALESCE(is_electronic, TRUE) = $2`,
            [tenantId, isElectronic]
        );
        const maxNum = Number(r.rows[0]?.max_num || 0);
        const total = Number(r.rows[0]?.total || 0);
        const next = Math.max(maxNum, total) + 1;
        const prefix = isElectronic ? 'FC' : 'CI';
        res.json({
            success: true,
            isElectronic,
            nextNumber: String(next),
            prefix,
            preview: `${prefix}-${next}`
        });
    } catch (error) {
        console.error('[Payables] Error obteniendo siguiente consecutivo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAccountsPayableReport = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await getAccountsPayableReportData(tenantId, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Payables] Error obteniendo cuentas por pagar:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAccountsPayablePaymentsReport = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const data = await getAccountsPayablePaymentsReportData(tenantId, req.query);
        res.json({ success: true, ...data });
    } catch (error) {
        console.error('[Payables] Error obteniendo pagos de proveedores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAccountsPayableById = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const payableId = Number(req.params.id);
        if (!payableId) return res.status(400).json({ success: false, error: 'Id invalido' });
        const payable = await getAccountsPayableByIdData(tenantId, payableId);
        if (!payable) return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        res.json({ success: true, payable });
    } catch (error) {
        console.error('[Payables] Error obteniendo detalle de factura:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createAccountsPayable = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const { payable, journal, inventoryMovements } = await createAccountsPayableEntry({ tenantId, userId, body: req.body });

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.created',
            entityType: 'accounts_payable',
            entityId: payable.id,
            entityNumber: payable.document_number,
            documentType: payable.document_type,
            documentId: payable.id,
            documentNumber: payable.document_number,
            message: 'Cuenta por pagar creada',
            afterData: { payable, journal },
            metadata: { source: 'payablesController.createAccountsPayable' }
        });
        res.status(201).json({ success: true, payable, journal, inventoryMovements: inventoryMovements || [] });
    } catch (error) {
        console.error('[Payables] Error creando cuenta por pagar:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const updateAccountsPayable = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const payableId = Number(req.params.id);
        if (!payableId) {
            return res.status(400).json({ success: false, error: 'Id invalido' });
        }
        const { payable, journal, reverseEntry, previous } = await updateAccountsPayableEntry({
            tenantId,
            userId,
            payableId,
            body: req.body
        });

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.updated',
            entityType: 'accounts_payable',
            entityId: payable.id,
            entityNumber: payable.document_number,
            documentType: payable.document_type,
            documentId: payable.id,
            documentNumber: payable.document_number,
            message: 'Cuenta por pagar editada',
            beforeData: { payable: previous },
            afterData: { payable, journal, reverseEntry },
            metadata: { source: 'payablesController.updateAccountsPayable' }
        });
        res.json({ success: true, payable, journal, reverseEntry });
    } catch (error) {
        console.error('[Payables] Error actualizando cuenta por pagar:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const applyAccountsPayablePayment = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const result = await applyAccountsPayablePaymentEntry({ tenantId, userId, body: req.body });
        const { payable, journal, sourceNumber, paymentAmount, paymentMethod, applicationId, applicationIds, bankTransactionIds } = result;

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.payment_applied',
            entityType: 'accounts_payable',
            entityId: payable.id,
            entityNumber: payable.document_number,
            documentType: payable.document_type,
            documentId: payable.id,
            documentNumber: sourceNumber,
            message: 'Pago aplicado a cuenta por pagar',
            afterData: { payable, journal },
            metadata: { paymentAmount, paymentMethod, source: 'payablesController.applyAccountsPayablePayment' }
        });
        res.json({
            success: true,
            payable,
            journal,
            sourceNumber,
            paymentAmount,
            paymentMethod,
            applicationId,
            applicationIds,
            bankTransactionIds: bankTransactionIds || [],
        });
    } catch (error) {
        console.error('[Payables] Error aplicando pago de CxP:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

const getTaxSummary = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const summary = await getTaxSummaryData(tenantId, req.query);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('[Payables] Error obteniendo resumen tributario:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getPaymentById = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const applicationId = Number(req.params.id);
        if (!applicationId) return res.status(400).json({ success: false, error: 'Id invalido' });
        const detail = await getPaymentDetailData(tenantId, applicationId);
        if (!detail) return res.status(404).json({ success: false, error: 'Pago no encontrado' });
        res.json({ success: true, ...detail });
    } catch (error) {
        console.error('[Payables] Error obteniendo detalle de pago:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const voidPayment = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const applicationId = Number(req.params.id);
        const reason = req.body?.reason || null;
        if (!applicationId) return res.status(400).json({ success: false, error: 'Id invalido' });

        const result = await voidAccountsPayablePaymentEntry({ tenantId, userId, applicationId, reason });

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.payment_voided',
            entityType: 'accounts_payable_application',
            entityId: result.applicationId,
            entityNumber: result.sourceNumber,
            documentType: 'PAGO_CXP',
            documentId: result.applicationId,
            documentNumber: result.sourceNumber,
            message: 'Pago a proveedor anulado',
            afterData: { payable: result.payable, reverseEntry: result.reverseEntry, reversedAmount: result.reversedAmount },
            metadata: { reason, source: 'payablesController.voidPayment' }
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Payables] Error anulando pago:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

// Envia un Documento Soporte (DS) electronico a la DIAN via Alegra.
// Ruta: POST /accounting/accounts-payable/:id/submit-dian
const submitSupportDocumentToDian = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const payableId = Number(req.params.id);
        if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant requerido' });
        if (!payableId) return res.status(400).json({ success: false, error: 'Id invalido' });

        const payableRes = await db.query(
            `SELECT * FROM accounts_payable WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [payableId, tenantId]
        );
        const payable = payableRes.rows[0];
        if (!payable) return res.status(404).json({ success: false, error: 'Documento no encontrado' });

        if ((payable.document_type || '').toUpperCase() !== 'DS') {
            return res.status(400).json({ success: false, error: 'Solo Documentos Soporte pueden enviarse a la DIAN por esta ruta' });
        }
        if ((payable.dian_status || '').toUpperCase() === 'APROBADO') {
            return res.status(400).json({ success: false, error: 'El DS ya fue aprobado por la DIAN' });
        }

        const tenantRes = await db.query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
        const tenant = tenantRes.rows[0];
        if (!tenant) return res.status(400).json({ success: false, error: 'Tenant no configurado' });

        if (!tenant.alegra_company_id) {
            return res.status(400).json({ success: false, error: 'El tenant no esta registrado en Alegra (alegra_company_id vacio)' });
        }
        if (!tenant.alegra_ds_resolution_prefix || !tenant.alegra_ds_resolution_start) {
            return res.status(400).json({ success: false, error: 'El tenant no tiene configurada la resolucion DS en Alegra' });
        }

        const subtotal = Number(payable.subtotal_amount || 0);
        const tax = Number(payable.tax_amount || 0);
        const bruto = subtotal + tax;

        // Intentar usar las líneas reales si existen; si no, 1 item agregado
        const linesRes = await db.query(
            `SELECT * FROM accounts_payable_lines WHERE tenant_id = $1 AND accounts_payable_id = $2 ORDER BY line_no, id`,
            [tenantId, payableId]
        );
        const dsItems = linesRes.rows.length > 0
            ? linesRes.rows.map((l, idx) => ({
                description: l.concept_name || l.description || l.puc_name || `Item ${idx + 1}`,
                quantity: Number(l.quantity || 1),
                unitPrice: Number(l.unit_price || 0),
                subtotal: Number(l.base_amount || 0),
                taxRate: Number(l.iva_pct || 0),
                taxAmount: Number(l.iva_amount || 0),
                code: l.puc_code || `DSITEM-${idx + 1}`
            }))
            : [{
                description: (payable.notes && payable.notes.replace(/\s*\/\/.*$/, '')) || payable.expense_account_name || 'Servicio/compra',
                quantity: 1,
                unitPrice: subtotal,
                subtotal,
                taxRate: subtotal > 0 ? Math.round((tax / subtotal) * 100) : 0,
                taxAmount: tax,
                code: payable.expense_account_code || 'DSITEM-1'
            }];

        const dsData = {
            number: payable.document_number,
            date: (payable.issue_date instanceof Date ? payable.issue_date.toISOString() : String(payable.issue_date || '')).slice(0, 10),
            dueDate: (payable.due_date instanceof Date ? payable.due_date.toISOString() : String(payable.due_date || payable.issue_date || '')).slice(0, 10),
            subtotal,
            taxAmount: tax,
            total: bruto,
            paymentForm: payable.payment_form === 'Credito' ? '2' : '1',
            paymentMethod: '10',
            supplier: {
                identification: payable.supplier_document_number,
                identificationType: payable.supplier_document_type,
                name: payable.supplier_name
            },
            items: dsItems,
            notes: payable.notes || ''
        };

        const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');
        const alegraResult = await alegraService.createSupportDocument(dsData, { tenant, sandboxMode });

        const responseSummary = { success: alegraResult.success, error: alegraResult.error || null, details: alegraResult.details || null };
        if (alegraResult.success) {
            await db.query(
                `UPDATE accounts_payable SET
                    cuds = $1,
                    dian_status = $2,
                    dian_response = $3,
                    dian_submitted_at = NOW(),
                    dian_submitted_number = $4,
                    updated_at = NOW()
                 WHERE id = $5`,
                [
                    alegraResult.cuds || null,
                    (alegraResult.dianStatus || 'APROBADO').toUpperCase(),
                    JSON.stringify(alegraResult.data || {}),
                    alegraResult.number || payable.document_number,
                    payableId
                ]
            );
        } else {
            await db.query(
                `UPDATE accounts_payable SET
                    dian_status = 'ERROR',
                    dian_response = $1,
                    dian_submitted_at = NOW(),
                    updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify(responseSummary), payableId]
            );
        }

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: alegraResult.success ? 'payable.ds_submitted' : 'payable.ds_submit_failed',
            entityType: 'accounts_payable',
            entityId: payableId,
            entityNumber: payable.document_number,
            documentType: 'DS',
            documentId: payableId,
            documentNumber: payable.document_number,
            message: alegraResult.success ? 'DS enviado a la DIAN correctamente' : 'Error al enviar DS a la DIAN',
            afterData: alegraResult,
            metadata: { source: 'payablesController.submitSupportDocumentToDian' }
        });

        res.status(alegraResult.success ? 200 : 502).json({
            success: alegraResult.success,
            cuds: alegraResult.cuds || null,
            dianStatus: alegraResult.dianStatus || null,
            error: alegraResult.error || null,
            data: alegraResult.data || null
        });
    } catch (error) {
        console.error('[Payables] Error enviando DS a DIAN:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const voidAccountsPayable = async (req, res) => {
    try {
        const tenantId = resolveTenantId(req);
        const userId = req.user?.id;
        const payableId = Number(req.params.id);
        const reason = req.body?.reason || null;
        if (!payableId) return res.status(400).json({ success: false, error: 'Id invalido' });

        const result = await voidAccountsPayableEntry({ tenantId, userId, payableId, reason });

        await recordAccountingAuditEvent({
            tenantId,
            userId,
            category: 'compras',
            action: 'payable.voided',
            entityType: 'accounts_payable',
            entityId: result.payable.id,
            entityNumber: result.payable.document_number,
            documentType: result.payable.document_type,
            documentId: result.payable.id,
            documentNumber: result.payable.document_number,
            message: 'Factura de compra anulada',
            beforeData: { payable: result.previous },
            afterData: { payable: result.payable, reverseEntry: result.reverseEntry },
            metadata: { reason, source: 'payablesController.voidAccountsPayable' }
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Payables] Error anulando factura:', error);
        res.status(error.statusCode || 500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getAccountsPayableReport,
    getAccountsPayableById,
    getAccountsPayablePaymentsReport,
    getNextPurchaseNumber,
    createAccountsPayable,
    updateAccountsPayable,
    voidAccountsPayable,
    applyAccountsPayablePayment,
    getPaymentById,
    voidPayment,
    getTaxSummary,
    submitSupportDocumentToDian,
};
