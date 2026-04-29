// src/controllers/aliaddoController.js
// Controlador para integración con API de Aliaddo - Facturación Electrónica

const db = require('../config/db');
const aliaddoService = require('../services/aliaddoService');

// ============================================
// CONFIGURACIÓN
// ============================================
const getConfig = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;

        let tenantData = null;
        if (tenantId) {
            const result = await db.query(
                `SELECT aliaddo_resolution_key, aliaddo_resolution_prefix, aliaddo_resolution_number,
                        aliaddo_resolution_range_start, aliaddo_resolution_range_end,
                        aliaddo_resolution_valid_from, aliaddo_resolution_valid_until,
                        aliaddo_invoicing_enabled, aliaddo_test_set_status, tax_id
                 FROM tenants WHERE id = $1`,
                [tenantId]
            );
            if (result.rows[0]) tenantData = result.rows[0];
        }

        res.json({
            success: true,
            config: {
                provider: 'aliaddo',
                baseUrl: process.env.ALIADDO_BASE_URL || 'https://isv.aliaddo.net/api/v1/public/documents',
                hasApiKey: !!process.env.ALIADDO_API_KEY,
                resolutionConfigured: !!(tenantData?.aliaddo_resolution_key),
                invoicingEnabled: tenantData?.aliaddo_invoicing_enabled || false,
                testSetStatus: tenantData?.aliaddo_test_set_status || 'PENDIENTE',
                resolution: tenantData?.aliaddo_resolution_key ? {
                    prefix: tenantData.aliaddo_resolution_prefix,
                    number: tenantData.aliaddo_resolution_number,
                    rangeStart: tenantData.aliaddo_resolution_range_start,
                    rangeEnd: tenantData.aliaddo_resolution_range_end,
                    validFrom: tenantData.aliaddo_resolution_valid_from,
                    validUntil: tenantData.aliaddo_resolution_valid_until
                } : null
            }
        });
    } catch (error) {
        console.error('Error en getConfig:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// ESTADO DE FACTURACIÓN
// ============================================
const getInvoicingStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const tenantResult = await db.query(
            `SELECT needs_electronic_invoice, tax_id, business_name, tax_id_type,
                    aliaddo_resolution_key, aliaddo_resolution_prefix,
                    aliaddo_resolution_number, aliaddo_resolution_range_start,
                    aliaddo_resolution_range_end, aliaddo_resolution_valid_from,
                    aliaddo_resolution_valid_until, aliaddo_invoicing_enabled,
                    aliaddo_test_set_status
             FROM tenants WHERE id = $1`,
            [tenantId]
        );

        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
        }

        const t = tenantResult.rows[0];
        const missingSteps = [];

        // Check company data
        const hasCompanyData = !!(t.tax_id && t.business_name && t.tax_id_type);
        if (!hasCompanyData) missingSteps.push('Completar datos de empresa (NIT, Razón Social, Tipo de documento)');

        // Check API Key configured
        const hasApiKey = !!process.env.ALIADDO_API_KEY;
        if (!hasApiKey) missingSteps.push('Configurar API Key de Aliaddo en el servidor');

        // Check resolution
        const resolutionConfigured = !!(t.aliaddo_resolution_key);
        if (!resolutionConfigured) missingSteps.push('Configurar resolución DIAN');

        // Check test set
        const testSetApproved = t.aliaddo_test_set_status === 'APROBADO';
        if (!testSetApproved) missingSteps.push('Completar set de pruebas DIAN');

        const invoicingReady = hasCompanyData && hasApiKey && resolutionConfigured && testSetApproved;

        res.json({
            success: true,
            needsElectronicInvoice: t.needs_electronic_invoice,
            hasCompanyData,
            hasApiKey,
            // Para compatibilidad con frontend: companyRegistered se marca como true si hay API key
            companyRegistered: hasApiKey,
            testSetStatus: t.aliaddo_test_set_status || 'PENDIENTE',
            resolutionConfigured,
            resolution: resolutionConfigured ? {
                key: t.aliaddo_resolution_key,
                number: t.aliaddo_resolution_number,
                prefix: t.aliaddo_resolution_prefix,
                rangeStart: t.aliaddo_resolution_range_start,
                rangeEnd: t.aliaddo_resolution_range_end,
                validFrom: t.aliaddo_resolution_valid_from,
                validUntil: t.aliaddo_resolution_valid_until
            } : null,
            invoicingEnabled: t.aliaddo_invoicing_enabled || false,
            invoicingReady,
            missingSteps
        });
    } catch (error) {
        console.error('Error en getInvoicingStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// GUARDAR RESOLUCIÓN DIAN
// ============================================
const saveResolution = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const {
            resolutionKey,
            resolutionPrefix,
            resolutionNumber,
            resolutionRangeInitial,
            resolutionRangeFinal,
            resolutionValidFrom,
            resolutionValidUntil
        } = req.body;

        if (!resolutionKey || !resolutionNumber) {
            return res.status(400).json({
                success: false,
                error: 'La clave técnica (resolutionKey) y el número de resolución son obligatorios'
            });
        }

        await db.query(
            `UPDATE tenants SET
                aliaddo_resolution_key = $1,
                aliaddo_resolution_prefix = $2,
                aliaddo_resolution_number = $3,
                aliaddo_resolution_range_start = $4,
                aliaddo_resolution_range_end = $5,
                aliaddo_resolution_valid_from = $6,
                aliaddo_resolution_valid_until = $7,
                aliaddo_invoicing_enabled = TRUE,
                updated_at = NOW()
             WHERE id = $8`,
            [
                resolutionKey,
                resolutionPrefix || '',
                resolutionNumber,
                resolutionRangeInitial || 0,
                resolutionRangeFinal || 0,
                resolutionValidFrom || null,
                resolutionValidUntil || null,
                tenantId
            ]
        );

        res.json({
            success: true,
            message: 'Resolución guardada correctamente'
        });
    } catch (error) {
        console.error('Error en saveResolution:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// SET DE PRUEBAS
// ============================================

// Actualizar estado del set de pruebas
const updateTestSetStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const { status: newStatus } = req.body;
        const validStatuses = ['PENDIENTE', 'ENVIADO', 'APROBADO'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                error: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}`
            });
        }

        await db.query(
            'UPDATE tenants SET aliaddo_test_set_status = $1, updated_at = NOW() WHERE id = $2',
            [newStatus, tenantId]
        );

        res.json({
            success: true,
            message: `Estado del set de pruebas actualizado a ${newStatus}`,
            status: newStatus
        });
    } catch (error) {
        console.error('Error en updateTestSetStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getTestSetStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const result = await db.query(
            'SELECT aliaddo_test_set_status, tax_id FROM tenants WHERE id = $1',
            [tenantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
        }

        const tenant = result.rows[0];

        res.json({
            success: true,
            status: tenant.aliaddo_test_set_status || 'PENDIENTE',
            isCompleted: tenant.aliaddo_test_set_status === 'APROBADO'
        });
    } catch (error) {
        console.error('Error en getTestSetStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Enviar set de pruebas (envía una factura de prueba a Aliaddo)
const sendTestSet = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Obtener datos del tenant y resolución
        const tenantResult = await db.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
        }

        const tenant = tenantResult.rows[0];

        if (!tenant.aliaddo_resolution_key) {
            return res.status(400).json({
                success: false,
                error: 'Primero debes configurar la resolución DIAN'
            });
        }

        if (!process.env.ALIADDO_API_KEY) {
            return res.status(400).json({
                success: false,
                error: 'No se ha configurado el API Key de Aliaddo en el servidor'
            });
        }

        const resolution = {
            resolutionKey: tenant.aliaddo_resolution_key,
            resolutionPrefix: tenant.aliaddo_resolution_prefix || '',
            resolutionNumber: tenant.aliaddo_resolution_number,
            resolutionRangeInitial: tenant.aliaddo_resolution_range_start,
            resolutionRangeFinal: tenant.aliaddo_resolution_range_end,
            resolutionValidFrom: tenant.aliaddo_resolution_valid_from,
            resolutionValidUntil: tenant.aliaddo_resolution_valid_until
        };

        // Generar consecutivo de prueba dentro del rango
        const rangeStart = Number(resolution.resolutionRangeInitial) || 990000000;
        const testConsecutive = rangeStart + Math.floor(Math.random() * 100) + 1;

        // Construir factura de prueba
        const nit = (tenant.tax_id || '').split('-')[0].replace(/\D/g, '');
        const testInvoice = {
            code: '01',
            consecutive: testConsecutive.toString(),
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            typeOfOperation: '10',
            paymentMeanCode: '10',
            notes: 'Factura de prueba - Set de pruebas DIAN',
            customer: {
                name: 'CONSUMIDOR FINAL',
                identification: '222222222222',
                identificationType: '13',
                dv: '0',
                email: 'test@test.com',
                address: 'Calle 123',
                city: 'Bogotá',
                cityCode: '11001',
                department: 'Bogotá D.C.',
                departmentCode: '11'
            },
            items: [{
                item: 'Producto de prueba',
                description: 'Producto de prueba - Set de pruebas',
                reference: 'TEST-001',
                quantity: 1,
                unitPrice: 100000,
                tax: 19,
                discount: 0
            }]
        };

        const result = await aliaddoService.createInvoice(testInvoice, resolution);

        if (result.success) {
            await db.query(
                'UPDATE tenants SET aliaddo_test_set_status = $1, updated_at = NOW() WHERE id = $2',
                ['ENVIADO', tenantId]
            );

            res.json({
                success: true,
                message: 'Factura de prueba enviada a la DIAN vía Aliaddo',
                status: 'ENVIADO',
                data: result.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || 'Error al enviar factura de prueba',
                details: result.details
            });
        }
    } catch (error) {
        console.error('Error en sendTestSet:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// FACTURACIÓN
// ============================================

const createInvoice = async (req, res) => {
    const client = await db.connect();
    try {
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id;
        const invoiceData = req.body;

        if (!tenantId) {
            client.release();
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Verificar que el tenant esté habilitado
        const tenantResult = await db.query(
            `SELECT needs_electronic_invoice, aliaddo_test_set_status, aliaddo_invoicing_enabled,
                    aliaddo_resolution_key, aliaddo_resolution_prefix, aliaddo_resolution_number,
                    aliaddo_resolution_range_start, aliaddo_resolution_range_end,
                    aliaddo_resolution_valid_from, aliaddo_resolution_valid_until
             FROM tenants WHERE id = $1`,
            [tenantId]
        );

        const tenant = tenantResult.rows[0];
        const needsElectronic = tenant?.needs_electronic_invoice === true;

        if (needsElectronic && tenant.aliaddo_test_set_status !== 'APROBADO') {
            client.release();
            return res.status(400).json({
                success: false,
                error: 'Tu empresa aún no está habilitada para facturar electrónicamente. Completa el set de pruebas primero.',
                testSetStatus: tenant?.aliaddo_test_set_status || 'PENDIENTE'
            });
        }

        await client.query('BEGIN');

        // Guardar factura en BD local
        const insertResult = await client.query(
            `INSERT INTO invoices (
                tenant_id, invoice_number, client_name, client_document_type,
                client_document_number, client_email, client_phone, client_address,
                client_city, client_department, date, due_date,
                subtotal, tax_amount, discount, total,
                notes, status, payment_method, payment_status,
                created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW(), NOW()
            ) RETURNING id, invoice_number`,
            [
                tenantId,
                invoiceData.number || invoiceData.invoice_number || null,
                invoiceData.customer?.name || invoiceData.clientName || null,
                invoiceData.customer?.identificationType || invoiceData.clientDocType || null,
                invoiceData.customer?.identification || invoiceData.clientNit || null,
                invoiceData.customer?.email || invoiceData.email || null,
                invoiceData.customer?.phone || invoiceData.clientPhone || null,
                invoiceData.customer?.address || invoiceData.clientAddress || null,
                invoiceData.customer?.city || invoiceData.clientCity || null,
                invoiceData.customer?.department || invoiceData.clientDepartment || null,
                invoiceData.date || new Date().toISOString().split('T')[0],
                invoiceData.dueDate || invoiceData.date || new Date().toISOString().split('T')[0],
                invoiceData.subtotal || 0,
                invoiceData.taxAmount || invoiceData.tax_amount || 0,
                invoiceData.discount || 0,
                invoiceData.total || 0,
                invoiceData.notes || '',
                'BORRADOR',
                invoiceData.paymentMethod || invoiceData.payment_method || null,
                'PENDIENTE',
                userId || null
            ]
        );

        const localInvoice = insertResult.rows[0];

        // Save invoice items
        if (invoiceData.items && Array.isArray(invoiceData.items)) {
            for (const item of invoiceData.items) {
                await client.query(
                    `INSERT INTO invoice_items (
                        invoice_id, description, quantity, unit_price,
                        tax_rate, tax_amount, discount, subtotal, total
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        localInvoice.id,
                        item.description || item.item || '',
                        item.quantity || 1,
                        item.unitPrice || item.price || 0,
                        item.taxRate || item.tax || 0,
                        item.taxAmount || 0,
                        item.discount || 0,
                        item.subtotal || (item.quantity || 1) * (item.unitPrice || item.price || 0),
                        item.total || item.totalLine || 0
                    ]
                );
            }
        }

        await client.query('COMMIT');

        // Si facturación electrónica está habilitada, enviar a Aliaddo
        let aliaddoResult = null;
        if (needsElectronic && tenant.aliaddo_invoicing_enabled) {
            const resolution = {
                resolutionKey: tenant.aliaddo_resolution_key,
                resolutionPrefix: tenant.aliaddo_resolution_prefix,
                resolutionNumber: tenant.aliaddo_resolution_number,
                resolutionRangeInitial: tenant.aliaddo_resolution_range_start,
                resolutionRangeFinal: tenant.aliaddo_resolution_range_end,
                resolutionValidFrom: tenant.aliaddo_resolution_valid_from,
                resolutionValidUntil: tenant.aliaddo_resolution_valid_until
            };

            aliaddoResult = await aliaddoService.createInvoice(invoiceData, resolution);

            if (aliaddoResult.success) {
                await db.query(
                    `UPDATE invoices SET
                        cufe = $1, dian_status = $2, dian_response = $3,
                        status = 'ENVIADA', updated_at = NOW()
                     WHERE id = $4`,
                    [
                        aliaddoResult.cufe || null,
                        aliaddoResult.dianStatus || 'ENVIADA',
                        JSON.stringify(aliaddoResult.data || {}),
                        localInvoice.id
                    ]
                );
            } else {
                await db.query(
                    `UPDATE invoices SET
                        dian_status = 'ERROR', dian_response = $1, updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify({ error: aliaddoResult.error, details: aliaddoResult.details }), localInvoice.id]
                );
            }
        }

        res.json({
            success: true,
            message: needsElectronic
                ? (aliaddoResult?.success ? 'Factura guardada y enviada a la DIAN vía Aliaddo' : 'Factura guardada localmente. Error al enviar a DIAN.')
                : 'Factura guardada correctamente',
            invoice: {
                id: localInvoice.id,
                invoiceNumber: localInvoice.invoice_number
            },
            dian: aliaddoResult ? {
                sent: aliaddoResult.success,
                cufe: aliaddoResult?.cufe || null,
                dianStatus: aliaddoResult?.dianStatus || null,
                error: aliaddoResult?.success ? null : aliaddoResult?.error,
                data: aliaddoResult?.data || null
            } : null
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en createInvoice:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};

// ============================================
// NOTAS CRÉDITO / DÉBITO
// ============================================

const createCreditNote = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Obtener resolución del tenant
        const tenantResult = await db.query(
            `SELECT aliaddo_resolution_key, aliaddo_resolution_prefix, aliaddo_resolution_number,
                    aliaddo_resolution_range_start, aliaddo_resolution_range_end,
                    aliaddo_resolution_valid_from, aliaddo_resolution_valid_until
             FROM tenants WHERE id = $1`,
            [tenantId]
        );

        const tenant = tenantResult.rows[0];
        if (!tenant?.aliaddo_resolution_key) {
            return res.status(400).json({
                success: false,
                error: 'No hay resolución DIAN configurada'
            });
        }

        const resolution = {
            resolutionKey: tenant.aliaddo_resolution_key,
            resolutionPrefix: tenant.aliaddo_resolution_prefix,
            resolutionNumber: tenant.aliaddo_resolution_number,
            resolutionRangeInitial: tenant.aliaddo_resolution_range_start,
            resolutionRangeFinal: tenant.aliaddo_resolution_range_end,
            resolutionValidFrom: tenant.aliaddo_resolution_valid_from,
            resolutionValidUntil: tenant.aliaddo_resolution_valid_until
        };

        const result = await aliaddoService.createCreditNote(req.body, resolution);

        if (result.success) {
            res.json({
                success: true,
                message: 'Nota crédito enviada a la DIAN vía Aliaddo',
                data: result.data,
                cude: result.cude,
                dianStatus: result.dianStatus
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        console.error('Error en createCreditNote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createDebitNote = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const tenantResult = await db.query(
            `SELECT aliaddo_resolution_key, aliaddo_resolution_prefix, aliaddo_resolution_number,
                    aliaddo_resolution_range_start, aliaddo_resolution_range_end,
                    aliaddo_resolution_valid_from, aliaddo_resolution_valid_until
             FROM tenants WHERE id = $1`,
            [tenantId]
        );

        const tenant = tenantResult.rows[0];
        if (!tenant?.aliaddo_resolution_key) {
            return res.status(400).json({
                success: false,
                error: 'No hay resolución DIAN configurada'
            });
        }

        const resolution = {
            resolutionKey: tenant.aliaddo_resolution_key,
            resolutionPrefix: tenant.aliaddo_resolution_prefix,
            resolutionNumber: tenant.aliaddo_resolution_number,
            resolutionRangeInitial: tenant.aliaddo_resolution_range_start,
            resolutionRangeFinal: tenant.aliaddo_resolution_range_end,
            resolutionValidFrom: tenant.aliaddo_resolution_valid_from,
            resolutionValidUntil: tenant.aliaddo_resolution_valid_until
        };

        const result = await aliaddoService.createDebitNote(req.body, resolution);

        if (result.success) {
            res.json({
                success: true,
                message: 'Nota débito enviada a la DIAN vía Aliaddo',
                data: result.data,
                cude: result.cude,
                dianStatus: result.dianStatus
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        console.error('Error en createDebitNote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// CONSULTAR ESTADO DE DOCUMENTO
// ============================================
const getDocumentStatus = async (req, res) => {
    try {
        const { consecutive } = req.params;

        if (!consecutive) {
            return res.status(400).json({ success: false, error: 'El consecutivo es requerido' });
        }

        const result = await aliaddoService.getDocumentStatus(consecutive);

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                dianStatus: result.dianStatus,
                cufe: result.cufe
            });
        } else {
            res.status(result.notFound ? 404 : 400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error en getDocumentStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// TABLAS DIAN
// ============================================
const getDianTaxRegimes = (req, res) => {
    const result = aliaddoService.getDianTaxRegimes();
    res.json(result);
};

const getDianResponsibilities = (req, res) => {
    const result = aliaddoService.getDianResponsibilities();
    res.json(result);
};

const getDianIdentificationTypes = (req, res) => {
    const result = aliaddoService.getDianIdentificationTypes();
    res.json(result);
};

const getDianDocumentTypes = (req, res) => {
    const result = aliaddoService.getDianDocumentTypes();
    res.json(result);
};

const getDianPaymentMethods = (req, res) => {
    const result = aliaddoService.getDianPaymentMethods();
    res.json(result);
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
    getConfig,
    getInvoicingStatus,
    saveResolution,
    getTestSetStatus,
    updateTestSetStatus,
    sendTestSet,
    createInvoice,
    createCreditNote,
    createDebitNote,
    getDocumentStatus,
    getDianTaxRegimes,
    getDianResponsibilities,
    getDianIdentificationTypes,
    getDianDocumentTypes,
    getDianPaymentMethods
};
