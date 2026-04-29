// src/controllers/dianController.js
// Controlador para endpoints de Facturación Electrónica DIAN

const {
    sendInvoiceToDIAN,
    getDocumentStatus,
    getDocumentByCUFE,
    getTestSetStatus,
    generateTestInvoice
} = require('../services/dianService');
const { DIAN_CONFIG } = require('../config/dianConfig');
const { pool } = require('../config/db');

// ============================================
// ENVIAR FACTURA A DIAN
// ============================================
const sendInvoice = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const tenantId = req.user?.tenant_id;

        // 1. Obtener factura de la base de datos
        const invoiceQuery = `
            SELECT 
                i.*,
                json_agg(
                    json_build_object(
                        'item', ii.description,
                        'description', ii.additional_description,
                        'reference', ii.reference,
                        'quantity', ii.quantity,
                        'unitPrice', ii.unit_price,
                        'discount', ii.discount_percent,
                        'tax', ii.tax_percent,
                        'lineBase', ii.unit_price * ii.quantity,
                        'discountVal', (ii.unit_price * ii.quantity * COALESCE(ii.discount_percent, 0) / 100),
                        'taxVal', ii.tax_amount,
                        'lineTotal', ii.total_line
                    )
                ) as items
            FROM invoices i
            LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
            WHERE i.id = $1 AND i.tenant_id = $2
            GROUP BY i.id
        `;

        const result = await pool.query(invoiceQuery, [invoiceId, tenantId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        const invoice = result.rows[0];

        // 2. Verificar que no haya sido enviada ya
        if (invoice.dian_status === 'ACEPTADA') {
            return res.status(400).json({
                success: false,
                error: 'Esta factura ya fue aceptada por la DIAN',
                cufe: invoice.cufe
            });
        }

        // 3. Preparar datos para DIAN
        const invoiceData = {
            consecutivo: invoice.invoice_number.replace(/\D/g, ''), // Solo números
            subtotal: parseFloat(invoice.subtotal),
            taxAmount: parseFloat(invoice.tax_amount),
            discountAmount: parseFloat(invoice.discount_amount || 0),
            total: parseFloat(invoice.total),
            paymentMethod: invoice.payment_method,
            paymentMeanCode: invoice.payment_mean_code,
            notes: invoice.notes,
            client: {
                name: invoice.client_name,
                idNumber: invoice.client_nit || invoice.client_id,
                docType: invoice.client_doc_type === 'NIT' ? '31' : '13',
                email: invoice.client_email,
                direccion: 'Sin dirección', // TODO: Obtener de la tabla clients
                ciudad: 'Bogotá',
                departamento: 'Bogotá D.C.',
                codigoMunicipio: '11001',
                codigoDepartamento: '11',
                tipoPersona: invoice.client_doc_type === 'NIT' ? '1' : '2'
            },
            items: invoice.items
        };

        // 4. Enviar a DIAN
        const dianResult = await sendInvoiceToDIAN(invoiceData);

        // 5. Actualizar estado en base de datos
        const updateQuery = `
            UPDATE invoices
            SET 
                dian_status = $1,
                cufe = $2,
                dian_track_id = $3,
                dian_response = $4,
                dian_sent_at = NOW(),
                updated_at = NOW()
            WHERE id = $5
        `;

        await pool.query(updateQuery, [
            dianResult.success ? 'ENVIADA' : 'ERROR',
            dianResult.cufe,
            dianResult.trackId || null,
            JSON.stringify(dianResult.dianResponse || dianResult.error),
            invoiceId
        ]);

        // 6. Responder
        res.status(dianResult.success ? 200 : 500).json({
            success: dianResult.success,
            message: dianResult.success
                ? 'Factura enviada a la DIAN correctamente'
                : 'Error enviando factura a la DIAN',
            invoiceNumber: dianResult.invoiceNumber,
            cufe: dianResult.cufe,
            trackId: dianResult.trackId,
            xmlPath: dianResult.xmlPath,
            dianResponse: dianResult.dianResponse,
            error: dianResult.error
        });

    } catch (error) {
        console.error('❌ Error en sendInvoice:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// CONSULTAR ESTADO DE DOCUMENTO
// ============================================
const checkStatus = async (req, res) => {
    try {
        const { trackId } = req.params;

        const result = await getDocumentStatus(trackId);

        if (result.success) {
            res.json({
                success: true,
                status: result.status
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ Error en checkStatus:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// CONSULTAR DOCUMENTO POR CUFE
// ============================================
const getDocumentInfo = async (req, res) => {
    try {
        const { cufe } = req.params;

        const result = await getDocumentByCUFE(cufe);

        if (result.success) {
            res.json({
                success: true,
                document: result.document
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('❌ Error en getDocumentInfo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// OBTENER CONFIGURACIÓN DIAN (Para debug)
// ============================================
const getConfig = async (req, res) => {
    try {
        // No exponer datos sensibles
        const safeConfig = {
            ambiente: DIAN_CONFIG.AMBIENTE === '1' ? 'PRODUCCIÓN' : 'HABILITACIÓN',
            emisor: {
                nit: DIAN_CONFIG.EMISOR.NIT,
                razonSocial: DIAN_CONFIG.EMISOR.RAZON_SOCIAL,
                ciudad: DIAN_CONFIG.EMISOR.CIUDAD
            },
            resolucion: {
                numero: DIAN_CONFIG.RESOLUCION.NUMERO,
                prefijo: DIAN_CONFIG.RESOLUCION.PREFIJO,
                rangoDesde: DIAN_CONFIG.RESOLUCION.RANGO_DESDE,
                rangoHasta: DIAN_CONFIG.RESOLUCION.RANGO_HASTA
            },
            software: {
                id: DIAN_CONFIG.SOFTWARE.ID.substring(0, 8) + '...',
                testSetId: DIAN_CONFIG.SOFTWARE.TEST_SET_ID.substring(0, 8) + '...'
            }
        };

        res.json({
            success: true,
            config: safeConfig
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// GENERAR FACTURA DE PRUEBA
// ============================================
const generateTest = async (req, res) => {
    try {
        const { consecutivo } = req.body;

        console.log('🧪 Generando factura de prueba...');

        const result = await generateTestInvoice(consecutivo || 990000001);

        res.json({
            success: result.success,
            message: result.success
                ? 'Factura de prueba generada y enviada'
                : 'Error generando factura de prueba',
            invoiceNumber: result.invoiceNumber,
            cufe: result.cufe,
            trackId: result.trackId,
            xmlPath: result.xmlPath,
            dianResponse: result.dianResponse,
            error: result.error
        });
    } catch (error) {
        console.error('❌ Error en generateTest:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// ESTADO DEL SET DE PRUEBAS
// ============================================
const testSetStatus = async (req, res) => {
    try {
        const result = await getTestSetStatus();

        res.json({
            success: result.success,
            testSetId: DIAN_CONFIG.SOFTWARE.TEST_SET_ID,
            status: result.testSetStatus,
            error: result.error
        });
    } catch (error) {
        console.error('❌ Error en testSetStatus:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    sendInvoice,
    checkStatus,
    getDocumentInfo,
    getConfig,
    generateTest,
    testSetStatus
};
