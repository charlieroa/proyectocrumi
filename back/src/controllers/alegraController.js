// src/controllers/alegraController.js
// Controlador para integración con API de Alegra

const db = require('../config/db');
const alegraService = require('../services/alegraService');
const providerIntegrationService = require('../services/providerIntegrationService');
const { createJournalFromInvoice, createAccountsReceivableFromInvoice } = require('../helpers/accountingHelper');
const accountingCoreService = require('../services/accountingCoreService');
const { getNextSequence } = require('../helpers/sequenceHelper');

// Métodos que implican pago inmediato (no crédito)
const isImmediatePayment = (method) => {
    if (!method) return false;
    const m = String(method).toUpperCase().trim();
    if (!m) return false;
    // Crédito / a crédito → deja cartera abierta, NO se auto-recibe
    if (m.includes('CREDIT') || m.includes('CRÉDIT') || m === 'SIN PAGO') return false;
    return true;
};

// Resuelve la cuenta contable (caja / banco) según método de pago
const resolveCashOrBankCode = (method, settings) => {
    const m = String(method || '').toUpperCase();
    const isCash = m.includes('CASH') || m.includes('EFECT');
    return isCash
        ? (settings.cash_account_code || '110505')
        : (settings.bank_account_code || '111005');
};

// Normaliza el método al código canónico usado por el listado de Cobros
const canonicalMethod = (method) => {
    const m = String(method || '').toUpperCase().trim();
    if (!m) return 'OTHER';
    if (m.includes('EFECT') || m === 'CASH') return 'CASH';
    if (m.includes('TRANSF') || m === 'TRANSFER' || m.includes('PSE')) return 'TRANSFER';
    if (m.includes('CHEQ') || m === 'CHECK') return 'CHECK';
    if (m.includes('TARJ') || m === 'CARD') return 'CARD';
    return 'OTHER';
};

// Devuelve el código contable (caja/banco/etc.) según método canónico
const accountForCanonical = (canonical, settings) => {
    switch (canonical) {
        case 'CASH':
            return settings.cash_account_code || '110505';
        case 'CARD':
            // Bancos-tarjeta o caja-tarjeta según configuración
            return settings.bank_account_code || '111005';
        case 'CHECK':
        case 'TRANSFER':
        case 'OTHER':
        default:
            return settings.bank_account_code || '111005';
    }
};

// ============================================
// CONFIGURACIÓN
// ============================================
const getConfig = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const alegraBaseUrl = process.env.ALEGRA_BASE_URL || 'https://api.alegra.com/e-provider/col/v1';
        const sandboxMode = alegraBaseUrl.includes('sandbox-api.alegra.com');
        
        // Obtener datos del tenant si existe
        let tenantAlegraData = null;
        if (tenantId) {
            const result = await db.query(
                'SELECT alegra_company_id, alegra_test_set_status, tax_id FROM tenants WHERE id = $1',
                [tenantId]
            );
            if (result.rows[0]) {
                tenantAlegraData = result.rows[0];
            }
        }

        res.json({
            success: true,
            config: {
                baseUrl: alegraBaseUrl,
                sandboxMode,
                hasToken: !!process.env.ALEGRA_API_TOKEN,
                companyId: tenantAlegraData?.alegra_company_id || null,
                testSetStatus: tenantAlegraData?.alegra_test_set_status || 'PENDIENTE',
                governmentId: tenantAlegraData?.tax_id || null
            }
        });
    } catch (error) {
        console.error('Error en getConfig:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};


const getProviderStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesi�n' });
        }

        const overview = await providerIntegrationService.getProviderOverview(tenantId, 'alegra');
        res.json({ success: true, provider: 'alegra', ...overview });
    } catch (error) {
        console.error('Error en getProviderStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
// ============================================
// EMPRESAS
// ============================================

// Registrar empresa del tenant en Alegra
const registerCompany = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Obtener datos del tenant
        const tenantResult = await db.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
        }

        const tenant = tenantResult.rows[0];

        // Verificar datos mínimos requeridos
        if (!tenant.tax_id || !tenant.business_name) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos requeridos: NIT y Razón Social son obligatorios',
                missingFields: {
                    tax_id: !tenant.tax_id,
                    business_name: !tenant.business_name
                }
            });
        }

        // Registrar en Alegra
        const result = await alegraService.createCompany(tenant);

        if (result.success) {
            const alegraCompanyId = result.alegraCompanyId || result.data?.id || null;

            await db.query(
                'UPDATE tenants SET alegra_company_id = $1, updated_at = NOW() WHERE id = $2',
                [alegraCompanyId, tenantId]
            );

            await providerIntegrationService.upsertProviderConnection({
                tenantId,
                providerName: 'alegra',
                status: 'ACTIVE',
                environment: (process.env.ALEGRA_BASE_URL || '').includes('sandbox') ? 'sandbox' : 'production',
                externalCompanyId: alegraCompanyId,
                externalCompanyName: tenant.business_name || tenant.name,
                settings: {
                    testSetStatus: tenant.alegra_test_set_status || 'PENDIENTE'
                },
                metadata: {
                    source: 'alegraController.registerCompany'
                },
                connectedBy: req.user?.id || null,
                markSynced: true,
            });

            await providerIntegrationService.logSyncEvent({
                tenantId,
                providerName: 'alegra',
                eventType: 'COMPANY_REGISTERED',
                localEntityType: 'tenant',
                localEntityId: String(tenantId),
                externalId: alegraCompanyId,
                message: 'Empresa registrada en Alegra correctamente',
                responsePayload: result.data,
                metadata: { source: 'alegraController.registerCompany' },
                createdBy: req.user?.id || null,
            });

            res.json({
                success: true,
                message: 'Empresa registrada en Alegra correctamente',
                data: result.data,
                alegraCompanyId
            });
        } else {
            await providerIntegrationService.upsertProviderConnection({
                tenantId,
                providerName: 'alegra',
                status: 'ERROR',
                environment: (process.env.ALEGRA_BASE_URL || '').includes('sandbox') ? 'sandbox' : 'production',
                externalCompanyName: tenant.business_name || tenant.name,
                metadata: { source: 'alegraController.registerCompany' },
                connectedBy: req.user?.id || null,
                lastError: result.error || 'No se pudo registrar la empresa en Alegra',
            });

            await providerIntegrationService.logSyncEvent({
                tenantId,
                providerName: 'alegra',
                eventType: 'COMPANY_REGISTER_FAILED',
                localEntityType: 'tenant',
                localEntityId: String(tenantId),
                message: result.error || 'No se pudo registrar la empresa en Alegra',
                responsePayload: result.details,
                metadata: { source: 'alegraController.registerCompany' },
                createdBy: req.user?.id || null,
            });

            res.status(400).json({
                success: false,
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        console.error('Error en registerCompany:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Consultar empresa en Alegra
const getCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        
        const result = await alegraService.getCompany(companyId);
        
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(404).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error en getCompany:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// SET DE PRUEBAS
// ============================================

// Obtener estado del set de pruebas del tenant
const getTestSetStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Obtener datos del tenant
        const tenantResult = await db.query(
            'SELECT tax_id, alegra_company_id, alegra_test_set_status, alegra_test_set_id FROM tenants WHERE id = $1',
            [tenantId]
        );

        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
        }

        const tenant = tenantResult.rows[0];

        // Si ya tenemos un set aprobado guardado localmente, priorizarlo
        if (tenant.alegra_test_set_status === 'APROBADO' && tenant.alegra_test_set_id) {
            return res.json({
                success: true,
                status: 'APROBADO',
                isCompleted: true,
                data: { id: tenant.alegra_test_set_id },
                message: 'Set de pruebas aprobado por la DIAN'
            });
        }

        // Si no tiene NIT, no puede consultar
        if (!tenant.tax_id) {
            return res.json({
                success: true,
                status: 'PENDIENTE',
                isCompleted: false,
                message: 'Primero debes configurar el NIT de tu empresa en Settings'
            });
        }

        const nit = tenant.tax_id.split('-')[0].replace(/\D/g, '');

        // Si tenemos un alegra_test_set_id guardado, consultar directo por ID en Alegra
        if (tenant.alegra_test_set_id) {
            try {
                const directResult = await alegraService.getTestSet(tenant.alegra_test_set_id);
                if (directResult.success && directResult.data) {
                    const tsData = directResult.data?.testSet || directResult.data;
                    const alegraStatus = tsData.status;
                    const errors = tsData.errors || [];

                    // Mapear status de Alegra a nuestro status
                    let mappedStatus = tenant.alegra_test_set_status;
                    if (alegraStatus === 'APPROVED' || alegraStatus === 'COMPLETED') mappedStatus = 'APROBADO';
                    else if (alegraStatus === 'REJECTED') mappedStatus = 'RECHAZADO';
                    else if (alegraStatus === 'WAITING_RESPONSE' || alegraStatus === 'PROCESSING') mappedStatus = 'ENVIADO';

                    // Actualizar BD si cambió
                    if (mappedStatus !== tenant.alegra_test_set_status) {
                        await db.query(
                            'UPDATE tenants SET alegra_test_set_status = $1, updated_at = NOW() WHERE id = $2',
                            [mappedStatus, tenantId]
                        );
                    }

                    return res.json({
                        success: true,
                        status: mappedStatus,
                        isCompleted: mappedStatus === 'APROBADO',
                        data: tsData,
                        error: errors.length > 0 ? errors[0] : null,
                        message: mappedStatus === 'APROBADO' ? 'Set de pruebas aprobado por la DIAN' :
                                 mappedStatus === 'RECHAZADO' ? (errors[0] || 'Set de pruebas rechazado por la DIAN') :
                                 'Set de pruebas en proceso. Alegra está enviando documentos a la DIAN.'
                    });
                }
            } catch (directErr) {
                console.log('[getTestSetStatus] Error consultando directo:', directErr.message);
            }
        }

        // Fallback: consultar en Alegra por NIT
        const result = await alegraService.getTestSetByGovernmentId(nit);

        if (result.success) {
            if (result.status && result.status !== tenant.alegra_test_set_status) {
                await db.query(
                    'UPDATE tenants SET alegra_test_set_status = $1, updated_at = NOW() WHERE id = $2',
                    [result.status, tenantId]
                );
            }

            res.json({
                success: true,
                status: result.status || 'PENDIENTE',
                isCompleted: result.isCompleted || false,
                data: result.data,
                message: result.message
            });
        } else {
            // Si hay estado local, devolverlo
            if (tenant.alegra_test_set_status && tenant.alegra_test_set_status !== 'PENDIENTE') {
                return res.json({
                    success: true,
                    status: tenant.alegra_test_set_status,
                    isCompleted: false,
                    data: { id: tenant.alegra_test_set_id },
                    message: `Estado local: ${tenant.alegra_test_set_status}`
                });
            }
            res.json({
                success: true,
                status: 'PENDIENTE',
                isCompleted: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error en getTestSetStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Enviar set de pruebas a la DIAN
const sendTestSet = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { testSetId } = req.body;
        const alegraBaseUrl = process.env.ALEGRA_BASE_URL || 'https://api.alegra.com/e-provider/col/v1';
        const sandboxMode = alegraBaseUrl.includes('sandbox-api.alegra.com');
        const sandboxGovernmentId = 'a70562e0-631e-4ceb-aa65-36887b57dc17';

        console.log('═══════════════════════════════════════════════════════════');
        console.log('[CONTROLLER] sendTestSet iniciado');
        console.log('[CONTROLLER] tenantId:', tenantId);
        console.log('[CONTROLLER] testSetId recibido:', testSetId);
        console.log('═══════════════════════════════════════════════════════════');

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        if (!sandboxMode && (!testSetId || String(testSetId).trim().length < 10)) {
            return res.status(400).json({
                success: false,
                error: 'El código TestSetID es obligatorio. Obténlo del portal de la DIAN.'
            });
        }

        // Normalizar TestSetID: si viene sin guiones (32 hex), convertir a formato UUID
        let normalizedTestSetId = sandboxMode
            ? sandboxGovernmentId
            : String(testSetId).trim();
        const hexOnly = normalizedTestSetId.replace(/-/g, '');
        if (/^[0-9a-fA-F]{32}$/.test(hexOnly)) {
            normalizedTestSetId = hexOnly.replace(/([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{12})/, '$1-$2-$3-$4-$5');
        }
        console.log('[CONTROLLER] testSetId normalizado:', normalizedTestSetId);

        // Obtener datos completos del tenant (necesarios para registrar empresa si falta)
        const tenantResult = await db.query(
            'SELECT * FROM tenants WHERE id = $1',
            [tenantId]
        );

        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant no encontrado' });
        }

        const tenant = tenantResult.rows[0];
        console.log('[CONTROLLER] Datos tenant:', {
            id: tenant.id,
            tax_id: tenant.tax_id,
            business_name: tenant.business_name,
            alegra_company_id: tenant.alegra_company_id,
            email: tenant.email
        });

        if (!tenant.tax_id) {
            return res.status(400).json({
                success: false,
                error: 'Primero debes configurar el NIT de tu empresa en Settings'
            });
        }

        // Extraer NIT sin DV
        const nit = tenant.tax_id.split('-')[0].replace(/\D/g, '');
        console.log('[CONTROLLER] NIT extraído (sin DV):', nit);

        // Si la empresa no está registrada en Alegra, registrarla primero (requisito para set de pruebas)
        if (!tenant.alegra_company_id) {
            console.log('[CONTROLLER] Empresa NO registrada en Alegra, intentando registrar...');
            const regResult = await alegraService.createCompany(tenant);
            console.log('[CONTROLLER] Resultado registro empresa:', JSON.stringify(regResult, null, 2));
            if (regResult.success && regResult.alegraCompanyId) {
                await db.query(
                    'UPDATE tenants SET alegra_company_id = $1, updated_at = NOW() WHERE id = $2',
                    [regResult.alegraCompanyId, tenantId]
                );
            } else if (!regResult.success) {
                return res.status(400).json({
                    success: false,
                    error: regResult.error || 'No se pudo registrar la empresa en Alegra. Revisa los datos en Configuración (NIT, Razón Social, dirección, ciudad, departamento).',
                    details: regResult.details
                });
            }
        } else {
            console.log('[CONTROLLER] Empresa YA registrada en Alegra con ID:', tenant.alegra_company_id);
        }

        // Obtener el alegra_company_id actualizado (pudo haberse registrado arriba)
        const updatedTenant = await db.query('SELECT alegra_company_id FROM tenants WHERE id = $1', [tenantId]);
        const alegraCompanyId = updatedTenant.rows[0]?.alegra_company_id || tenant.alegra_company_id;

        // Resetear estado si fue rechazado previamente (permitir reintento)
        if (tenant.alegra_test_set_status === 'RECHAZADO') {
            console.log('[CONTROLLER] Estado previo RECHAZADO, reseteando para reintento...');
            await db.query(
                `UPDATE tenants SET alegra_test_set_status = 'PENDIENTE', alegra_test_set_id = NULL, updated_at = NOW() WHERE id = $1`,
                [tenantId]
            );
        }

        // Enviar set de pruebas a Alegra
        console.log('[CONTROLLER] Llamando a alegraService.createTestSet...');
        const result = await alegraService.createTestSet(normalizedTestSetId, nit, alegraCompanyId);
        console.log('[CONTROLLER] Resultado createTestSet:', JSON.stringify(result, null, 2));

        if (result.success) {
            // Verificar si Alegra devolvió estado REJECTED inmediatamente
            const alegraStatus = result.data?.testSet?.status || result.data?.status || result.status;
            const alegraErrors = result.data?.testSet?.errors || result.data?.errors || [];
            const isRejected = alegraStatus === 'REJECTED';

            const dbStatus = isRejected ? 'RECHAZADO' : 'ENVIADO';
            await db.query(
                `UPDATE tenants
                 SET alegra_test_set_id = $1, alegra_test_set_status = $2, updated_at = NOW()
                 WHERE id = $3`,
                [normalizedTestSetId, dbStatus, tenantId]
            );

            if (isRejected) {
                const dianError = alegraErrors[0] || 'La DIAN rechazó el set de pruebas.';
                return res.json({
                    success: false,
                    message: dianError,
                    error: dianError,
                    status: 'RECHAZADO',
                    data: result.data,
                    hint: 'Verifica en el portal DIAN (catalogo-vpfe-hab.dian.gov.co) que el TestSetId corresponda a tu NIT y que el proveedor seleccionado sea Alegra.'
                });
            }

            res.json({
                success: true,
                message: 'Set de pruebas enviado a la DIAN. Alegra generará y enviará automáticamente las facturas, notas crédito y notas débito de prueba.',
                status: 'ENVIADO',
                data: result.data
            });
        } else {
            // Guardar estado RECHAZADO en BD para que el frontend muestre opción de reintento
            await db.query(
                `UPDATE tenants
                 SET alegra_test_set_id = $1, alegra_test_set_status = 'RECHAZADO', updated_at = NOW()
                 WHERE id = $2`,
                [normalizedTestSetId, tenantId]
            );

            const raw = result.details?.errors?.[0]?.message ?? result.details?.errors?.[0]?.code
                ?? result.details?.message ?? result.details?.error ?? result.error;
            const userMessage = (typeof raw === 'string' ? raw : (raw ? String(raw) : null))
                || 'La DIAN o Alegra rechazó el envío. Verifica el código TestSetID y que tu empresa esté registrada en el portal DIAN.';
            const statusCode = (result.httpStatus === 401 || result.httpStatus === 403) ? result.httpStatus : 400;
            res.status(statusCode).json({
                success: false,
                error: userMessage,
                message: userMessage,
                status: 'RECHAZADO',
                details: result.details,
                hint: 'Verifica en el portal DIAN (catalogo-vpfe-hab.dian.gov.co) que el TestSetId corresponda a tu NIT y que el proveedor seleccionado sea Alegra.'
            });
        }
    } catch (error) {
        console.error('Error en sendTestSet:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Generar documentos de prueba automáticamente (sin enviar a DIAN, solo crear en Crumi)
// Esto es para que el usuario pueda revisar antes de enviar el set real
const generateTestDocuments = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Por ahora retornamos un mensaje indicando que esto generaría documentos de prueba locales
        // La implementación completa crearía 8 facturas, 1 NC y 1 ND en la BD local

        res.json({
            success: true,
            message: 'Funcionalidad de generación automática. Los documentos se crearán localmente para revisión.',
            note: 'Para enviar el set de pruebas real, usa el endpoint /alegra/test-set/send con el TestSetID de la DIAN'
        });
    } catch (error) {
        console.error('Error en generateTestDocuments:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// ESTADO DE FACTURACIÓN
// ============================================

// Retorna el estado completo del flujo de facturación electrónica
const getInvoicingStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const alegraBaseUrl = process.env.ALEGRA_BASE_URL || 'https://api.alegra.com/e-provider/col/v1';
        const sandboxMode = alegraBaseUrl.includes('sandbox-api.alegra.com');
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const tenantResult = await db.query(
            `SELECT needs_electronic_invoice, tax_id, business_name, tax_id_type,
                    alegra_company_id, alegra_test_set_status, alegra_test_set_id,
                    alegra_resolution_number, alegra_resolution_prefix,
                    alegra_resolution_start, alegra_resolution_end, alegra_invoicing_enabled
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

        // Check Alegra registration
        const companyRegistered = !!t.alegra_company_id;
        if (!companyRegistered) missingSteps.push('Registrar empresa en Alegra');

        // Check test set
        const testSetApproved = t.alegra_test_set_status === 'APROBADO';
        if (!testSetApproved) missingSteps.push('Completar set de pruebas DIAN');

        // En sandbox de Alegra la resolución no bloquea la habilitación de pruebas
        const resolutionRequired = !sandboxMode;
        const resolutionConfigured = resolutionRequired ? !!t.alegra_resolution_number : true;
        if (resolutionRequired && !resolutionConfigured) missingSteps.push('Configurar resolución DIAN');

        // Verificar contra Alegra que la resolución esté efectivamente CARGADA en su lado.
        // Tener los datos en BD local no implica que Alegra la conozca: el contribuyente
        // debe asociar el prefijo a "Soluciones Alegra S.A.S" en el portal MUISCA tras
        // aprobar el set de pruebas. Sin ese paso, Alegra responde 404 "Numbering Ranges
        // not found" y DIAN rechaza con FAD05e/FAD06.
        let resolutionRegisteredInAlegra = !resolutionRequired; // sandbox: no aplica
        if (resolutionRequired && companyRegistered && t.tax_id) {
            try {
                const nit = String(t.tax_id).split('-')[0].replace(/\D/g, '');
                const r = await alegraService.getResolutions(nit);
                resolutionRegisteredInAlegra = !!(r?.success && Array.isArray(r.data) && r.data.length > 0);
            } catch (_e) {
                resolutionRegisteredInAlegra = false;
            }
            if (!resolutionRegisteredInAlegra) {
                missingSteps.push('Solicitar resolución de FE de producción en MUISCA y vincular el prefijo a tu proveedor tecnológico (NIT 900559088) en Numeración → Asignación de software');
            }
        }

        const invoicingReady = hasCompanyData && companyRegistered && testSetApproved && resolutionConfigured && resolutionRegisteredInAlegra;

        res.json({
            success: true,
            sandboxMode,
            resolutionRequired,
            needsElectronicInvoice: t.needs_electronic_invoice,
            hasCompanyData,
            companyRegistered,
            testSetStatus: t.alegra_test_set_status || 'PENDIENTE',
            testSetId: t.alegra_test_set_id || null,
            resolutionConfigured,
            resolutionRegisteredInAlegra,
            resolution: resolutionConfigured ? {
                number: t.alegra_resolution_number,
                prefix: t.alegra_resolution_prefix,
                rangeStart: t.alegra_resolution_start,
                rangeEnd: t.alegra_resolution_end
            } : null,
            invoicingEnabled: t.alegra_invoicing_enabled || false,
            invoicingReady,
            missingSteps
        });
    } catch (error) {
        console.error('Error en getInvoicingStatus:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// RESOLUCIONES DIAN
// ============================================

const getResolutions = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const alegraBaseUrl = process.env.ALEGRA_BASE_URL || 'https://api.alegra.com/e-provider/col/v1';
        const sandboxMode = alegraBaseUrl.includes('sandbox-api.alegra.com');
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const tenantResult = await db.query('SELECT tax_id FROM tenants WHERE id = $1', [tenantId]);
        const tenant = tenantResult.rows[0];
        const nit = tenant?.tax_id ? tenant.tax_id.split('-')[0].replace(/\D/g, '') : '';

        if (sandboxMode) {
            return res.json({
                success: true,
                data: [],
                activeResolution: null,
                sandboxMode: true,
                message: 'En sandbox de Alegra no se requiere consultar resolución para pruebas.'
            });
        }

        if (!nit) {
            return res.status(400).json({ success: false, error: 'Primero debes configurar el NIT de la empresa.' });
        }

        const result = await alegraService.getResolutions(nit);

        if (result.success) {
            // Try to find the active resolution and save it to the tenant
            const resolutions = result.data?.resolutions || (Array.isArray(result.data) ? result.data : []);
            const active = resolutions.find(r => r.status === 'ACTIVE' || r.status === 'active') || resolutions[0];

            if (active) {
                await db.query(
                    `UPDATE tenants SET
                        alegra_resolution_number = $1,
                        alegra_resolution_prefix = $2,
                        alegra_resolution_start = $3,
                        alegra_resolution_end = $4,
                        alegra_invoicing_enabled = TRUE,
                        updated_at = NOW()
                     WHERE id = $5`,
                    [
                        active.resolutionNumber || active.number || active.id,
                        active.prefix || '',
                        active.from || active.rangeStart || 0,
                        active.to || active.rangeEnd || 0,
                        tenantId
                    ]
                );
            }

            res.json({
                success: true,
                data: resolutions,
                activeResolution: active || null
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                details: result.details
            });
        }
    } catch (error) {
        console.error('Error en getResolutions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Guardar manualmente una resolución DIAN (cuando Alegra no la expone vía API)
const saveManualResolution = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const {
            prefix,
            resolutionNumber,
            rangeStart,
            rangeEnd,
            validFrom,
            validUntil,
            technicalKey,
            resolutionDate
        } = req.body || {};

        const missing = [];
        if (!prefix) missing.push('prefix');
        if (!resolutionNumber) missing.push('resolutionNumber');
        if (rangeStart === undefined || rangeStart === null || rangeStart === '') missing.push('rangeStart');
        if (rangeEnd === undefined || rangeEnd === null || rangeEnd === '') missing.push('rangeEnd');
        if (!validFrom) missing.push('validFrom');
        if (!validUntil) missing.push('validUntil');
        if (!technicalKey) missing.push('technicalKey');
        if (!resolutionDate) missing.push('resolutionDate');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                error: `Faltan campos requeridos: ${missing.join(', ')}`
            });
        }

        const startInt = parseInt(rangeStart, 10);
        const endInt = parseInt(rangeEnd, 10);
        if (Number.isNaN(startInt) || Number.isNaN(endInt) || endInt < startInt) {
            return res.status(400).json({
                success: false,
                error: 'El rango de numeración es inválido.'
            });
        }

        await db.query(
            `UPDATE tenants SET
                alegra_resolution_number = $1,
                alegra_resolution_prefix = $2,
                alegra_resolution_start = $3,
                alegra_resolution_end = $4,
                alegra_resolution_valid_from = $5,
                alegra_resolution_valid_until = $6,
                alegra_resolution_technical_key = $7,
                alegra_resolution_date = $8,
                alegra_invoicing_enabled = TRUE,
                updated_at = NOW()
             WHERE id = $9`,
            [
                String(resolutionNumber),
                String(prefix),
                startInt,
                endInt,
                validFrom,
                validUntil,
                String(technicalKey),
                resolutionDate,
                tenantId
            ]
        );

        return res.json({
            success: true,
            message: 'Resolución guardada manualmente y facturación electrónica habilitada.'
        });
    } catch (error) {
        console.error('Error en saveManualResolution:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// FACTURACIÓN
// ============================================

// Crear factura: guardar en BD local + enviar a DIAN vía Alegra
const createInvoice = async (req, res) => {
    const client = await db.getClient();
    try {
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id;
        const invoiceData = req.body;

        if (!tenantId) {
            client.release();
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        // Clase de factura: ELECTRONICA (va a DIAN) o INTERNA (solo consecutivo interno)
        const rawClass = String(invoiceData.invoiceClass || invoiceData.invoice_class || 'ELECTRONICA').toUpperCase();
        const invoiceClass = rawClass === 'INTERNA' ? 'INTERNA' : 'ELECTRONICA';

        // Verificar que el tenant esté habilitado (set de pruebas aprobado)
        const tenantResult = await db.query(
            `SELECT alegra_test_set_status, needs_electronic_invoice, alegra_resolution_prefix,
                    alegra_resolution_number, alegra_resolution_start, alegra_resolution_end,
                    alegra_resolution_technical_key, alegra_resolution_valid_from, alegra_resolution_valid_until,
                    alegra_company_id, tax_id, tax_id_type, tax_responsibility, name, business_name, email, phone, address, city, state,
                    postal_code, internal_invoice_prefix
             FROM tenants WHERE id = $1`,
            [tenantId]
        );

        const tenant = tenantResult.rows[0];
        // Solo exige set de pruebas cuando la factura es electrónica
        const needsElectronic = invoiceClass === 'ELECTRONICA' && tenant?.needs_electronic_invoice === true;

        if (needsElectronic && (!tenant || tenant.alegra_test_set_status !== 'APROBADO')) {
            client.release();
            return res.status(400).json({
                success: false,
                error: 'Tu empresa aún no está habilitada para facturar electrónicamente. Completa el set de pruebas primero.',
                testSetStatus: tenant?.alegra_test_set_status || 'PENDIENTE'
            });
        }

        await client.query('BEGIN');

        // Auto-generar número de factura si el frontend no lo manda.
        // Electrónica -> secuencia 'FACTURA'. Interna -> secuencia 'FACTURA_INTERNA' con prefijo del tenant.
        let resolvedInvoiceNumber = invoiceData.number || invoiceData.invoice_number || null;
        if (!resolvedInvoiceNumber) {
            try {
                const seqCode = invoiceClass === 'INTERNA' ? 'FACTURA_INTERNA' : 'FACTURA';
                const customPrefix = invoiceClass === 'INTERNA' ? (tenant?.internal_invoice_prefix || 'INT') : null;
                const seq = await getNextSequence(client, tenantId, seqCode, customPrefix);
                resolvedInvoiceNumber = seq.fullNumber;
            } catch (seqErr) {
                console.warn('[alegraController.createInvoice] No se pudo generar numero via sequence:', seqErr.message);
                // Fallback simple
                resolvedInvoiceNumber = `F-${Date.now()}`;
            }
        }

        // Recalcular totales server-side desde items + globales del payload.
        // Defensa: el cliente NO decide los totales. Si el total enviado difiere del calculado,
        // se usa el del backend y se registra warning.
        const itemsArr = Array.isArray(invoiceData.items) ? invoiceData.items : [];
        let calcSubtotal = 0;
        let calcDiscount = 0;
        let calcTax = 0;
        for (const it of itemsArr) {
            const qty = Number(it.quantity) || 0;
            const unit = Number(it.unitPrice ?? it.price ?? it.unit_price) || 0;
            const discPct = Number(it.discount) || 0;          // % por línea (compat front)
            const taxRate = Number(it.taxRate ?? it.tax ?? it.tax_rate) || 0;
            const lineBase = qty * unit;
            const lineDisc = lineBase * (discPct / 100);
            const lineNet = lineBase - lineDisc;
            const lineTax = lineNet * (taxRate / 100);
            calcSubtotal += lineBase;
            calcDiscount += lineDisc;
            calcTax += lineTax;
        }
        const round2 = (n) => Math.round(n * 100) / 100;
        const impoConsumo = Number(invoiceData.impoConsumo) || 0;
        const wsRate = Number(invoiceData.retentionRate ?? invoiceData.reteFuenteRate) || 0;
        const wsAmount = round2((calcSubtotal - calcDiscount) * (wsRate / 100));
        const wvRate = Number(invoiceData.reteIvaRate) || 0;
        const wvAmount = round2(calcTax * (wvRate / 100));
        const wiRate = Number(invoiceData.icaRate) || 0;          // por mil
        const wiAmount = round2((calcSubtotal - calcDiscount) * (wiRate / 1000));
        const advancesArr = Array.isArray(invoiceData.advances) ? invoiceData.advances : [];
        const advancesTotal = round2(advancesArr.reduce((s, a) => s + (Number(a.amount) || 0), 0));

        const calcTotal = round2(
            calcSubtotal - calcDiscount + calcTax + impoConsumo - wsAmount - wvAmount - wiAmount - advancesTotal
        );
        calcSubtotal = round2(calcSubtotal);
        calcDiscount = round2(calcDiscount);
        calcTax = round2(calcTax);

        const sentTotal = Number(invoiceData.total) || 0;
        if (Math.abs(sentTotal - calcTotal) > 1) {
            console.warn(`[createInvoice] Total cliente=${sentTotal} difiere del calculado=${calcTotal} (factura ${resolvedInvoiceNumber}); se persiste el calculado`);
        }

        const paymentForm = String(invoiceData.paymentForm || invoiceData.payment_form || '').toUpperCase() || null;
        const creditTermDays = Number.isFinite(Number(invoiceData.creditTermDays)) ? Number(invoiceData.creditTermDays) : null;
        const branchId = invoiceData.branchId ? String(invoiceData.branchId) : null;
        const sellerId = Number.isFinite(Number(invoiceData.seller)) ? Number(invoiceData.seller) : (Number.isFinite(Number(invoiceData.sellerId)) ? Number(invoiceData.sellerId) : null);
        const isTestMode = invoiceData.isTestMode === true || invoiceData.is_test_mode === true;

        // 1. Guardar factura en BD local
        const insertResult = await client.query(
            `INSERT INTO invoices (
                tenant_id, invoice_number, invoice_class, client_name, client_document_type,
                client_document_number, client_email, client_phone, client_address,
                client_city, client_department, date, due_date,
                subtotal, tax_amount, discount, total,
                notes, status, payment_method, payment_form, payment_status,
                credit_term_days, branch_id, seller_id, impo_consumo,
                withholding_source, withholding_vat_rate, withholding_vat_amount,
                withholding_ica_rate, withholding_ica_amount, advances_total, is_test_mode,
                created_by, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
                $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, NOW(), NOW()
            ) RETURNING id, invoice_number, invoice_class`,
            [
                tenantId,
                resolvedInvoiceNumber,
                invoiceClass,
                invoiceData.customer?.name || invoiceData.clientName || null,
                invoiceData.customer?.identificationType || invoiceData.clientDocType || null,
                invoiceData.customer?.identification || invoiceData.clientNit || null,
                invoiceData.customer?.email || invoiceData.email || null,
                invoiceData.customer?.phone || invoiceData.clientPhone || null,
                invoiceData.customer?.address?.address || invoiceData.clientAddress || null,
                invoiceData.customer?.address?.city || invoiceData.clientCity || null,
                invoiceData.customer?.address?.department || invoiceData.clientDepartment || null,
                invoiceData.date || new Date().toISOString().split('T')[0],
                invoiceData.dueDate || invoiceData.date || new Date().toISOString().split('T')[0],
                calcSubtotal,
                calcTax,
                calcDiscount,
                calcTotal,
                invoiceData.notes || '',
                'BORRADOR',
                invoiceData.paymentMethod || invoiceData.payment_method || null,
                paymentForm,
                'PENDIENTE',
                creditTermDays,
                branchId,
                sellerId,
                impoConsumo,
                wsAmount,
                wvRate,
                wvAmount,
                wiRate,
                wiAmount,
                advancesTotal,
                isTestMode,
                userId || null
            ]
        );

        const localInvoice = insertResult.rows[0];
        let providerSyncJob = null;

        // Sincronizar invoiceData con totales calculados para el resto del flujo
        // (asiento contable, CxC, auto-recibo, envío DIAN).
        invoiceData.subtotal = calcSubtotal;
        invoiceData.taxAmount = calcTax;
        invoiceData.tax_amount = calcTax;
        invoiceData.discount = calcDiscount;
        invoiceData.total = calcTotal;

        await providerIntegrationService.upsertDocumentLink({
            tenantId,
            providerName: 'alegra',
            localEntityType: 'invoice',
            localEntityId: localInvoice.id,
            localDocumentNumber: localInvoice.invoice_number,
            syncStatus: needsElectronic ? 'PENDING' : 'SYNCED',
            payload: invoiceData,
            metadata: { source: 'alegraController.createInvoice', needsElectronic },
            createdBy: req.user?.id || null,
        });

        // 2. Save invoice items con todos los campos: product_id, service_id, cost_center,
        //    retention_rate/amount, reference, item_type, unit, unit_cost.
        if (invoiceData.items && Array.isArray(invoiceData.items)) {
            for (const item of invoiceData.items) {
                const qty = Number(item.quantity) || 1;
                const unit = Number(item.unitPrice ?? item.price ?? item.unit_price) || 0;
                const discPct = Number(item.discount) || 0;
                const taxRate = Number(item.taxRate ?? item.tax ?? item.tax_rate) || 0;
                const lineBase = qty * unit;
                const lineDisc = round2(lineBase * (discPct / 100));
                const lineNet = lineBase - lineDisc;
                const lineTax = round2(lineNet * (taxRate / 100));
                const lineTotal = round2(lineNet + lineTax);
                const retentionRate = Number(item.retentionRate ?? item.retention_rate) || 0;
                const retentionAmount = round2(lineNet * (retentionRate / 100));
                const productId = Number.isFinite(Number(item.productId ?? item.product_id))
                    ? Number(item.productId ?? item.product_id) : null;
                const serviceId = Number.isFinite(Number(item.serviceId ?? item.service_id))
                    ? Number(item.serviceId ?? item.service_id) : null;
                const itemType = item.itemType || item.item_type || (productId ? 'product' : (serviceId ? 'service' : 'product'));

                await client.query(
                    `INSERT INTO invoice_items (
                        invoice_id, product_id, service_id, item_type,
                        description, reference, quantity, unit, unit_price, unit_cost,
                        tax_rate, tax_amount, discount,
                        retention_rate, retention_amount,
                        subtotal, total, cost_center
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18
                    )`,
                    [
                        localInvoice.id,
                        productId,
                        serviceId,
                        itemType,
                        item.description || item.item || '',
                        item.reference || null,
                        qty,
                        item.unit || null,
                        unit,
                        Number(item.unitCost ?? item.unit_cost) || 0,
                        taxRate,
                        lineTax,
                        lineDisc,
                        retentionRate,
                        retentionAmount,
                        round2(lineNet),
                        lineTotal,
                        item.costCenter || item.cost_center || null
                    ]
                );
            }
        }

        // Persistir anticipos aplicados a esta factura
        if (advancesArr.length > 0) {
            for (const adv of advancesArr) {
                const amount = Number(adv.amount) || 0;
                if (amount <= 0) continue;
                await client.query(
                    `INSERT INTO invoice_advances (tenant_id, invoice_id, amount, reference, created_by)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [tenantId, localInvoice.id, amount, adv.reference || null, userId || null]
                );
            }
        }

        // 2.5 Crear asiento contable automático (Libro Diario)
        try {
            await createJournalFromInvoice(client, tenantId, {
                invoiceId: localInvoice.id,
                invoiceNumber: localInvoice.invoice_number,
                total: invoiceData.total || 0,
                subtotal: invoiceData.subtotal || 0,
                taxAmount: invoiceData.taxAmount || invoiceData.tax_amount || 0,
                discountAmount: invoiceData.discount || 0,
                description: invoiceData.customer?.name || invoiceData.clientName || 'Venta',
                thirdPartyDocument: invoiceData.customer?.identification || invoiceData.customer?.document_number || invoiceData.clientDocumentNumber || null,
                thirdPartyName: invoiceData.customer?.name || invoiceData.clientName || null
            }, invoiceData.items || [], userId);
        } catch (journalErr) {
            console.error('[alegraController.createInvoice] Error creando asiento contable:', journalErr.message);
            // No abortamos la factura por fallo de asiento; queda registro en logs
        }

        // 2.55 Registrar movimientos de kardex OUT por cada item con producto
        try {
            const { recordMovementInline } = require('./kardexController');
            const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
            for (const it of items) {
                const pid = it.productId || it.product_id;
                const qty = Number(it.quantity) || 0;
                if (!pid || qty <= 0) continue;
                try {
                    await recordMovementInline(client, tenantId, {
                        productId: pid,
                        productName: it.description || it.item || '',
                        date: invoiceData.date,
                        type: 'OUT',
                        quantity: qty,
                        unitCost: Number(it.cost) || 0,
                        documentType: 'FACTURA',
                        documentId: localInvoice.id,
                        documentNumber: localInvoice.invoice_number,
                        userId,
                    });
                } catch (kx) {
                    console.warn('[alegraController] kardex OUT skipped:', kx.message);
                }
            }
        } catch (kardexErr) {
            console.error('[alegraController] Error movimiento kardex:', kardexErr.message);
        }

        // 2.6 Crear Cuenta por Cobrar (cartera)
        try {
            await createAccountsReceivableFromInvoice(client, tenantId, {
                invoiceId: localInvoice.id,
                invoiceNumber: localInvoice.invoice_number || String(localInvoice.id),
                clientName: invoiceData.customer?.name || invoiceData.clientName || 'CLIENTE',
                clientDocType: invoiceData.customer?.identificationType || invoiceData.clientDocType || 'CC',
                clientDocumentNumber: invoiceData.customer?.identification || invoiceData.clientNit || null,
                issueDate: invoiceData.date || new Date().toISOString().slice(0, 10),
                dueDate: invoiceData.dueDate || invoiceData.date || new Date().toISOString().slice(0, 10),
                total: Number(invoiceData.total) || 0,
                currency: 'COP',
                notes: invoiceData.notes || null,
            }, userId);
        } catch (arErr) {
            console.error('[alegraController.createInvoice] Error creando cuenta por cobrar:', arErr.message);
        }

        // 2.7 Recibo de caja automático si el pago fue inmediato (efectivo / transferencia / etc.)
        // Toggleable por env: AUTO_RECEIPT_ENABLED=false desactiva (default: activado).
        let autoReceipt = null;
        const AUTO_RECEIPT_ENABLED = String(process.env.AUTO_RECEIPT_ENABLED || 'true').toLowerCase() !== 'false';
        try {
            if (!AUTO_RECEIPT_ENABLED) throw new Error("auto-receipt disabled");
            const singleMethod = invoiceData.paymentMethod || invoiceData.payment_method;
            const methodsArray = Array.isArray(invoiceData.paymentMethods) ? invoiceData.paymentMethods : [];
            const total = Number(invoiceData.total || 0);

            // Normalizar formas de pago: array de {metodo, monto}
            const splits = methodsArray
                .map(fp => ({
                    raw: fp.metodo || fp.method || '',
                    canonical: canonicalMethod(fp.metodo || fp.method || ''),
                    amount: Math.max(Number(fp.monto || fp.amount || 0), 0),
                }))
                .filter(fp => fp.amount > 0);

            const splitsTotal = splits.reduce((s, fp) => s + fp.amount, 0);

            // Decidir si se genera auto-recibo:
            // - Si hay splits con total ≥ total factura → usar splits
            // - Si no hay splits, usar método único si indica pago inmediato
            const useSplits = splits.length > 0 && Math.abs(splitsTotal - total) < 0.5 && total > 0;
            const useSingle = !useSplits && total > 0 && isImmediatePayment(singleMethod);

            if (useSplits || useSingle) {
                const clientName = invoiceData.customer?.name || invoiceData.clientName || 'CLIENTE';
                const clientDocType = invoiceData.customer?.identificationType || invoiceData.clientDocType || 'CC';
                const clientDocNumber = invoiceData.customer?.identification || invoiceData.clientNit || null;
                const paymentDate = invoiceData.date || new Date().toISOString().slice(0, 10);

                // Canonical para el recibo: MIXED si hay >1 split, o el canonical del único método
                const canonicalForReceipt = useSplits && splits.length > 1
                    ? 'MIXED'
                    : (useSplits ? splits[0].canonical : canonicalMethod(singleMethod));

                // Notas: breakdown si hay múltiples formas de pago
                const breakdown = useSplits && splits.length > 1
                    ? splits.map(fp => `${fp.raw} $${fp.amount.toLocaleString('es-CO')}`).join(' + ')
                    : null;
                const notesText = breakdown
                    ? `Pago mixto factura ${localInvoice.invoice_number || localInvoice.id}: ${breakdown}`
                    : `Pago inmediato factura ${localInvoice.invoice_number || localInvoice.id}`;

                const seq = await getNextSequence(client, tenantId, 'RP');
                const receiptNumber = seq.fullNumber;

                const receiptRes = await client.query(
                    `INSERT INTO payment_receipts (
                        tenant_id, receipt_number, client_name, client_document_type,
                        client_document_number, date, total, payment_method, bank_name,
                        reference, notes, status, created_by, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVO', $12, NOW(), NOW()
                    ) RETURNING *`,
                    [
                        tenantId,
                        receiptNumber,
                        clientName,
                        clientDocType,
                        clientDocNumber,
                        paymentDate,
                        total,
                        canonicalForReceipt,
                        invoiceData.bankName || null,
                        invoiceData.transactionReference || invoiceData.reference || null,
                        notesText,
                        userId || null
                    ]
                );
                const receipt = receiptRes.rows[0];

                await client.query(
                    `INSERT INTO payment_receipt_invoices (receipt_id, invoice_id, amount, created_at)
                     VALUES ($1, $2, $3, NOW())`,
                    [receipt.id, localInvoice.id, total]
                );

                // Aplicar pago a la CxC correspondiente
                await client.query(
                    `UPDATE accounts_receivable
                     SET paid_amount = ROUND((paid_amount + $1)::numeric, 2),
                         balance_amount = ROUND(GREATEST(original_amount - (paid_amount + $1), 0)::numeric, 2),
                         status = CASE
                            WHEN GREATEST(original_amount - (paid_amount + $1), 0) <= 0.009 THEN 'PAGADA'
                            WHEN (paid_amount + $1) > 0 THEN 'PARCIAL'
                            ELSE status
                         END,
                         updated_at = NOW()
                     WHERE tenant_id = $2 AND invoice_id = $3`,
                    [total, tenantId, localInvoice.id]
                );

                // Marcar la factura como pagada
                await client.query(
                    `UPDATE invoices SET payment_status = 'PAGADA', updated_at = NOW()
                     WHERE id = $1 AND tenant_id = $2`,
                    [localInvoice.id, tenantId]
                );

                // Asiento: una línea por forma de pago (débito) + crédito a 1305 por el total
                const settingsRes = await client.query(
                    `SELECT * FROM accounting_settings WHERE tenant_id = $1 LIMIT 1`,
                    [tenantId]
                );
                const settings = settingsRes.rows[0] || {};
                const arAccount = settings.accounts_receivable_code || '130505';

                const debitLines = useSplits
                    ? splits.map(fp => ({
                        account_code: accountForCanonical(fp.canonical, settings),
                        debit: fp.amount,
                        credit: 0,
                        description: `Pago ${fp.raw} factura ${localInvoice.invoice_number || localInvoice.id}`,
                        third_party_document: clientDocNumber,
                        third_party_name: clientName,
                    }))
                    : [{
                        account_code: resolveCashOrBankCode(singleMethod, settings),
                        debit: total,
                        credit: 0,
                        description: `Pago ${singleMethod} factura ${localInvoice.invoice_number || localInvoice.id}`,
                        third_party_document: clientDocNumber,
                        third_party_name: clientName,
                    }];

                await accountingCoreService.insertJournalEntry(client, tenantId, {
                    description: `Recibo cobro ${receiptNumber} - ${clientName}`,
                    documentType: 'RECIBO_COBRO',
                    documentId: receipt.id,
                    documentNumber: receiptNumber,
                    entryDate: paymentDate,
                    lines: [
                        ...debitLines,
                        {
                            account_code: arAccount,
                            debit: 0,
                            credit: total,
                            description: `Aplicación cartera recibo ${receiptNumber}`,
                            third_party_document: clientDocNumber,
                            third_party_name: clientName,
                        }
                    ],
                    userId: userId || null,
                });

                autoReceipt = { id: receipt.id, number: receiptNumber, splits: useSplits ? splits : null };
            }
        } catch (receiptErr) {
            if (receiptErr.message !== "auto-receipt disabled") console.error('[alegraController.createInvoice] Error creando recibo automático:', receiptErr.message);
            // No abortamos: la factura ya existe con su causación.
        }

        await client.query('COMMIT');

        // 3. If electronic invoicing is enabled, send to Alegra/DIAN
        // (saveAsDraft=true desde el front salta el envío DIAN aunque sea ELECTRONICA)
        const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');
        let alegraResult = null;
        const isDraft = invoiceData.saveAsDraft === true || invoiceData.save_as_draft === true;
        if (needsElectronic && !isDraft && tenant.alegra_test_set_status === 'APROBADO') {
            alegraResult = await alegraService.createInvoice(invoiceData, {
                tenant,
                sandboxMode
            });

            if (alegraResult.success) {
                // Update local invoice with DIAN data
                await db.query(
                    `UPDATE invoices SET
                        cufe = $1, dian_status = $2, dian_response = $3,
                        status = 'ENVIADA', updated_at = NOW()
                     WHERE id = $4`,
                    [
                        alegraResult.cufe || null,
                        alegraResult.dianStatus || 'ENVIADA',
                        JSON.stringify(alegraResult.data || {}),
                        localInvoice.id
                    ]
                );
            } else {
                // Mark invoice as failed but still saved locally
                await db.query(
                    `UPDATE invoices SET
                        dian_status = 'ERROR', dian_response = $1, updated_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify({ error: alegraResult.error, details: alegraResult.details }), localInvoice.id]
                );
            }
        }

        res.json({
            success: true,
            message: needsElectronic
                ? (alegraResult?.success ? 'Factura guardada y enviada a la DIAN correctamente' : 'Factura guardada localmente. Error al enviar a DIAN.')
                : 'Factura guardada correctamente',
            invoice: {
                id: localInvoice.id,
                invoiceNumber: localInvoice.invoice_number
            },
            autoReceipt,
            dian: alegraResult ? {
                sent: alegraResult.success,
                cufe: alegraResult?.cufe || null,
                dianStatus: alegraResult?.dianStatus || null,
                error: alegraResult?.success ? null : alegraResult?.error,
                data: alegraResult?.data || null
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

// Consultar factura en Alegra
const getInvoice = async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const result = await alegraService.getInvoice(invoiceId);

        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(404).json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('Error en getInvoice:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// REENVIAR FACTURA A DIAN (para borradores o rechazadas)
// ============================================

const sendInvoiceToDian = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { invoiceId } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }
        if (!invoiceId) {
            return res.status(400).json({ success: false, error: 'invoiceId requerido' });
        }

        // 1. Leer factura + tenant
        const invRes = await db.query(
            `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
            [invoiceId, tenantId]
        );
        if (invRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }
        const inv = invRes.rows[0];

        if (inv.dian_status === 'APROBADA') {
            return res.status(400).json({
                success: false,
                error: 'La factura ya está aprobada por la DIAN. No se puede reenviar.'
            });
        }

        const tenantRes = await db.query(
            `SELECT * FROM tenants WHERE id = $1 LIMIT 1`,
            [tenantId]
        );
        const tenant = tenantRes.rows[0];
        if (!tenant) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado' });
        }
        if (tenant.alegra_test_set_status !== 'APROBADO') {
            return res.status(400).json({
                success: false,
                error: 'La facturación electrónica no está habilitada (set de pruebas no aprobado).'
            });
        }

        // 2. Leer líneas
        const itemsRes = await db.query(
            `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC`,
            [invoiceId]
        );
        const items = itemsRes.rows.map(r => ({
            item: r.description || 'Ítem',
            name: r.description || 'Ítem',
            description: r.description || 'Ítem',
            quantity: Number(r.quantity) || 1,
            unitPrice: Number(r.unit_price) || 0,
            price: Number(r.unit_price) || 0,
            tax: Number(r.tax_rate) || 0,
            taxRate: Number(r.tax_rate) || 0,
            taxAmount: Number(r.tax_amount) || 0,
            discount: Number(r.discount) || 0,
            subtotal: Number(r.subtotal) || 0,
            total: Number(r.total) || 0,
            totalLine: Number(r.total) || 0,
            lineBase: Number(r.subtotal) || 0,
            lineTotal: Number(r.total) || 0,
        }));

        // Asignar número DIAN si la factura no lo tiene (debe estar dentro del rango de la resolución)
        let assignedNumber = inv.invoice_number;
        if (!assignedNumber || String(assignedNumber).trim() === '') {
            // Busca el mayor consecutivo numérico ya emitido por este tenant con ese prefijo
            const prefix = tenant.alegra_resolution_prefix || '';
            const rangeStart = Number(tenant.alegra_resolution_start || 1);
            const rangeEnd = Number(tenant.alegra_resolution_end || 999999999);
            const maxRes = await db.query(
                `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS BIGINT)), 0) AS maxnum
                 FROM invoices
                 WHERE tenant_id = $1 AND invoice_number IS NOT NULL AND invoice_number <> ''`,
                [tenantId]
            );
            const localMax = Number(maxRes.rows[0]?.maxnum || 0);
            let next = Math.max(localMax + 1, rangeStart);
            // Si es el primer intento (max=0), arrancamos desde un número alto basado en timestamp
            // para evitar colisión con números ya usados históricamente en el rango autorizado.
            if (localMax === 0) {
                const rangeSize = Math.max(rangeEnd - rangeStart, 1);
                next = rangeStart + (Date.now() % rangeSize);
            }
            if (next > rangeEnd) {
                return res.status(400).json({ success: false, error: 'Se agotó el rango de numeración autorizado por la DIAN. Solicita una nueva resolución.' });
            }
            assignedNumber = `${prefix}${next}`;
            // Persiste para que la factura ya tenga el número
            await db.query(
                `UPDATE invoices SET invoice_number = $1, updated_at = NOW() WHERE id = $2`,
                [assignedNumber, invoiceId]
            );
            inv.invoice_number = assignedNumber;
        }

        // Helpers para normalizar datos al formato Alegra/DIAN
        const toISODate = (d) => {
            if (!d) return new Date().toISOString().slice(0, 10);
            try {
                if (d instanceof Date) return d.toISOString().slice(0, 10);
                const s = String(d);
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                return new Date(s).toISOString().slice(0, 10);
            } catch { return new Date().toISOString().slice(0, 10); }
        };
        // DIAN exige código numérico de municipio de 5 dígitos. Si en DB quedó un
        // nombre (ej. "Bogotá"), lo forzamos a 11001.
        const normalizeCityCode = (c) => {
            const s = String(c || '').trim();
            if (/^\d{5}$/.test(s)) return s;
            return '11001'; // Bogotá D.C.
        };
        const normalizeDeptCode = (d) => {
            const s = String(d || '').trim();
            if (/^\d{2}$/.test(s)) return s;
            return '11'; // Bogotá D.C.
        };
        // Códigos DIAN de método de pago (1 = efectivo, 10 = crédito, etc.)
        const PAYMENT_METHOD_CODE_MAP = {
            'EFECTIVO': '10', 'CASH': '10',
            'TRANSFERENCIA': '42', 'TRANSFER': '42',
            'PSE': '47', 'TARJETA': '48', 'CARD': '48',
            'CHEQUE': '20', 'CHECK': '20',
            'CREDITO': '1', 'OTRO': '1',
        };
        const normalizePaymentMethod = (m) => {
            const s = String(m || '').trim().toUpperCase();
            if (/^\d{1,3}$/.test(s)) return s;
            return PAYMENT_METHOD_CODE_MAP[s] || '10'; // default 10 = contado/efectivo
        };

        const issueDateStr = toISODate(inv.date);
        const dueDateStr = toISODate(inv.due_date);
        const paymentMethodCode = normalizePaymentMethod(inv.payment_method);

        // 3. Rebuild invoiceData minimal
        const invoiceData = {
            number: inv.invoice_number,
            invoice_number: inv.invoice_number,
            customer: {
                identification: inv.client_document_number || '000000',
                identificationType: inv.client_document_type || 'CC',
                dv: '',
                name: inv.client_name || 'Cliente',
                email: inv.client_email || 'sin-email@example.com',
                phone: inv.client_phone || '0000000',
                address: {
                    address: inv.client_address || 'No especificada',
                    city: normalizeCityCode(inv.client_city),
                    department: normalizeDeptCode(inv.client_department),
                    country: 'CO',
                },
            },
            items,
            date: issueDateStr,
            dueDate: dueDateStr,
            subtotal: Number(inv.subtotal) || 0,
            taxAmount: Number(inv.tax_amount) || 0,
            discount: Number(inv.discount) || 0,
            total: Number(inv.total) || 0,
            notes: inv.notes || '',
            // Alegra espera payments[] con paymentMethod numérico + paymentDueDate formato date
            payments: [{
                paymentMethod: paymentMethodCode,
                paymentDueDate: dueDateStr,
                amount: Number(inv.total) || 0,
            }],
            paymentMethod: paymentMethodCode,
            payment_method: paymentMethodCode,
            paymentMeanCode: paymentMethodCode,
            paymentMeans: paymentMethodCode,
        };

        // 4. Enviar a Alegra
        const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');
        const alegraResult = await alegraService.createInvoice(invoiceData, {
            tenant,
            sandboxMode,
        });

        // 5. Actualizar BD según resultado
        if (alegraResult.success) {
            await db.query(
                `UPDATE invoices SET
                    cufe = $1, dian_status = $2, dian_response = $3,
                    status = 'ENVIADA', updated_at = NOW()
                 WHERE id = $4`,
                [
                    alegraResult.cufe || null,
                    alegraResult.dianStatus || 'ENVIADA',
                    JSON.stringify(alegraResult.data || {}),
                    invoiceId,
                ]
            );
            return res.json({
                success: true,
                message: 'Factura enviada a la DIAN correctamente',
                dian: {
                    sent: true,
                    cufe: alegraResult.cufe || null,
                    dianStatus: alegraResult.dianStatus || null,
                    data: alegraResult.data || null,
                },
            });
        } else {
            await db.query(
                `UPDATE invoices SET
                    dian_status = 'ERROR', dian_response = $1, updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify({ error: alegraResult.error, details: alegraResult.details }), invoiceId]
            );
            return res.status(502).json({
                success: false,
                error: alegraResult.error || 'Error enviando a la DIAN',
                details: alegraResult.details || null,
            });
        }
    } catch (error) {
        console.error('[alegraController.sendInvoiceToDian] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// NOTAS CRÉDITO / DÉBITO
// ============================================

const createCreditNote = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const creditNoteData = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const tenantResult = await db.query(
            `SELECT alegra_company_id, alegra_resolution_prefix, alegra_resolution_number,
                    alegra_resolution_start, alegra_resolution_end, tax_id, tax_id_type,
                    tax_responsibility, name, business_name, email, phone, address, city, state, postal_code
             FROM tenants WHERE id = $1`,
            [tenantId]
        );
        const tenant = tenantResult.rows[0];
        const relatedInvoice = creditNoteData.relatedInvoice || {};
        if (!relatedInvoice.number && creditNoteData.relatedInvoiceNumber) {
            const invoiceResult = await db.query(
                `SELECT invoice_number, date, cufe, dian_response
                 FROM invoices
                 WHERE tenant_id = $1 AND invoice_number = $2
                 LIMIT 1`,
                [tenantId, creditNoteData.relatedInvoiceNumber]
            );
            if (invoiceResult.rows[0]) {
                const alegraInvoice = invoiceResult.rows[0].dian_response?.data?.invoice || invoiceResult.rows[0].dian_response?.invoice || {};
                relatedInvoice.number = alegraInvoice.number || Number(String(invoiceResult.rows[0].invoice_number || '').replace(/\D/g, '')) || null;
                relatedInvoice.date = (alegraInvoice.date || invoiceResult.rows[0].date || '').toString().split('T')[0];
                relatedInvoice.cufe = invoiceResult.rows[0].cufe;
            }
        }

        const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');
        const result = await alegraService.createCreditNote({
            ...creditNoteData,
            number: creditNoteData.number || creditNoteData.noteNumber || Date.now(),
            date: creditNoteData.date || creditNoteData.dateIssue,
            customer: {
                identification: creditNoteData.clientNit,
                identificationType: creditNoteData.clientDocType,
                name: creditNoteData.clientName,
                email: creditNoteData.clientEmail
            },
            relatedInvoice,
            items: (creditNoteData.items || []).map((item) => ({
                description: item.description || item.item,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.tax || item.taxRate || 0,
                taxAmount: item.taxAmount || (((Number(item.quantity) || 1) * Number(item.unitPrice || 0)) * (Number(item.tax || item.taxRate || 0) / 100)),
                subtotal: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0))
            }))
        }, { tenant, sandboxMode });

        if (result.success) {
            res.json({
                success: true,
                message: 'Nota crédito enviada a la DIAN correctamente',
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
        const debitNoteData = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesión' });
        }

        const tenantResult = await db.query(
            `SELECT alegra_company_id, alegra_resolution_prefix, alegra_resolution_number,
                    alegra_resolution_start, alegra_resolution_end, tax_id, tax_id_type,
                    tax_responsibility, name, business_name, email, phone, address, city, state, postal_code
             FROM tenants WHERE id = $1`,
            [tenantId]
        );
        const tenant = tenantResult.rows[0];
        const relatedInvoice = debitNoteData.relatedInvoice || {};
        if (!relatedInvoice.number && debitNoteData.relatedInvoiceNumber) {
            const invoiceResult = await db.query(
                `SELECT invoice_number, date, cufe, dian_response
                 FROM invoices
                 WHERE tenant_id = $1 AND invoice_number = $2
                 LIMIT 1`,
                [tenantId, debitNoteData.relatedInvoiceNumber]
            );
            if (invoiceResult.rows[0]) {
                const alegraInvoice = invoiceResult.rows[0].dian_response?.data?.invoice || invoiceResult.rows[0].dian_response?.invoice || {};
                relatedInvoice.number = alegraInvoice.number || Number(String(invoiceResult.rows[0].invoice_number || '').replace(/\D/g, '')) || null;
                relatedInvoice.date = (alegraInvoice.date || invoiceResult.rows[0].date || '').toString().split('T')[0];
                relatedInvoice.cufe = invoiceResult.rows[0].cufe;
            }
        }

        const sandboxMode = (process.env.ALEGRA_BASE_URL || '').includes('sandbox');
        const result = await alegraService.createDebitNote({
            ...debitNoteData,
            number: debitNoteData.number || debitNoteData.noteNumber || Date.now(),
            date: debitNoteData.date || debitNoteData.dateIssue,
            customer: {
                identification: debitNoteData.clientNit,
                identificationType: debitNoteData.clientDocType,
                name: debitNoteData.clientName,
                email: debitNoteData.clientEmail
            },
            relatedInvoice,
            items: (debitNoteData.items || []).map((item) => ({
                description: item.description || item.item,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.tax || item.taxRate || 0,
                taxAmount: item.taxAmount || (((Number(item.quantity) || 1) * Number(item.unitPrice || 0)) * (Number(item.tax || item.taxRate || 0) / 100)),
                subtotal: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0))
            }))
        }, { tenant, sandboxMode });

        if (result.success) {
            res.json({
                success: true,
                message: 'Nota débito enviada a la DIAN correctamente',
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
// CONSULTA ADQUIRENTE DIAN
// ============================================

const lookupAcquirerInfo = async (req, res) => {
    try {
        const { identificationType, identification } = req.query;

        if (!identificationType || !identification) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren identificationType e identification'
            });
        }

        // Mapear tipo amigable a código DIAN
        const { DOC_TYPE_MAP } = require('../services/alegraService');
        const dianType = DOC_TYPE_MAP[identificationType];
        if (!dianType) {
            return res.status(400).json({
                success: false,
                error: `Tipo de documento no reconocido: "${identificationType}". Use: NIT, CC, CE, TI, PP, DIE`
            });
        }

        // Limpiar identificación: quitar DV (parte después del guión) y caracteres no numéricos
        const cleanId = identification.split('-')[0].replace(/\D/g, '');

        if (!cleanId || cleanId.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'El número de identificación debe tener al menos 6 dígitos'
            });
        }

        const result = await alegraService.getAcquirerInfo(dianType, cleanId);

        if (result.success) {
            const response = {
                success: true,
                isRegistered: result.isRegistered,
                receiverName: result.receiverName || '',
                receiverEmail: result.receiverEmail || '',
                message: result.isRegistered
                    ? 'Empresa encontrada en la DIAN'
                    : 'Empresa no encontrada en la DIAN',
                // Datos completos de la empresa en Alegra (si existe)
                companyData: null
            };

            // Intentar obtener datos completos de la empresa en Alegra
            // Buscar primero en nuestra BD si hay un tenant con este NIT que tenga alegra_company_id
            try {
                const tenantRow = await db.query(
                    'SELECT alegra_company_id FROM tenants WHERE tax_id LIKE $1 AND alegra_company_id IS NOT NULL LIMIT 1',
                    [`${cleanId}%`]
                );
                const alegraId = tenantRow.rows[0]?.alegra_company_id;
                console.log('[lookupAcquirerInfo] NIT:', cleanId, '-> alegra_company_id en BD:', alegraId || 'NO ENCONTRADO');

                if (alegraId) {
                    const companyResult = await alegraService.getCompany(alegraId);
                    console.log('[lookupAcquirerInfo] Alegra getCompany resultado:', JSON.stringify(companyResult.data, null, 2));
                    if (companyResult.success && companyResult.data) {
                        const c = companyResult.data.company || companyResult.data;
                        response.companyData = {
                            name: c.name || '',
                            tradeName: c.tradeName || '',
                            identification: c.identification || '',
                            identificationType: c.identificationType || '',
                            dv: c.dv || '',
                            email: c.email || '',
                            phone: c.phone || '',
                            regimeCode: c.regimeCode || '',
                            address: c.address?.address || '',
                            city: c.address?.city || '',
                            department: c.address?.department || '',
                            postalCode: c.address?.postalCode || ''
                        };
                    }
                } else {
                    // Fallback: intentar directamente por identificación en Alegra
                    const companyResult = await alegraService.getCompanyByIdentification(cleanId);
                    if (companyResult.success && companyResult.data) {
                        const c = companyResult.data.company || companyResult.data;
                        response.companyData = {
                            name: c.name || '',
                            tradeName: c.tradeName || '',
                            identification: c.identification || '',
                            identificationType: c.identificationType || '',
                            dv: c.dv || '',
                            email: c.email || '',
                            phone: c.phone || '',
                            regimeCode: c.regimeCode || '',
                            address: c.address?.address || '',
                            city: c.address?.city || '',
                            department: c.address?.department || '',
                            postalCode: c.address?.postalCode || ''
                        };
                    }
                }
            } catch (e) {
                // No es crítico — seguimos con los datos de acquirer-info
                console.log('No se pudo obtener empresa completa de Alegra:', e.message);
            }

            res.json(response);
        } else {
            res.status(500).json({
                success: false,
                error: result.error || 'Error al consultar la DIAN'
            });
        }
    } catch (error) {
        console.error('Error en lookupAcquirerInfo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// TABLAS DIAN
// ============================================

const getDianDepartments = async (req, res) => {
    try {
        const result = await alegraService.getDianDepartments();
        if (result.success) {
            const departments = result.data?.departments || (Array.isArray(result.data) ? result.data : []);
            const normalized = departments.map(d => ({ code: d.code, name: d.value || d.name || d.code }));
            return res.json({ success: true, data: normalized });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getDianMunicipalities = async (req, res) => {
    try {
        const result = await alegraService.getDianMunicipalities();
        if (result.success) {
            const municipalities = result.data?.municipalities || (Array.isArray(result.data) ? result.data : []);
            const normalized = municipalities.map(m => ({
                code: m.code,
                name: m.value || m.name || m.code,
                departmentCode: m.departmentCode || ''
            }));
            return res.json({ success: true, data: normalized });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getDianTaxRegimes = async (req, res) => {
    try {
        const result = await alegraService.getDianTaxRegimes();
        if (result.success) {
            const regimes = result.data?.['tax-regimes'] || (Array.isArray(result.data) ? result.data : []);
            const normalized = regimes.map(r => ({ code: r.code, name: r.value || r.name || r.code }));
            return res.json({ success: true, data: normalized });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getDianIdentificationTypes = async (req, res) => {
    try {
        const result = await alegraService.getDianIdentificationTypes();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============================================
// N�MINA ELECTR�NICA
// ============================================
const PAYROLL_READY_STATUSES = new Set(['preliquidado', 'aprobado', 'transmitido', 'pagado']);
const PAYROLL_FINAL_STATUSES = new Set(['ACEPTADO', 'ENVIADO']);

const normalizePayrollDianStatus = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return 'PENDIENTE';
    if (['ACCEPTED', 'ACEPTADO', 'VALIDADO'].includes(normalized)) return 'ACEPTADO';
    if (['SENT', 'ENVIADO', 'TRANSMITTED'].includes(normalized)) return 'ENVIADO';
    if (['REJECTED', 'RECHAZADO'].includes(normalized)) return 'RECHAZADO';
    if (['ERROR', 'FAILED'].includes(normalized)) return 'ERROR';
    if (['PREPARADO', 'READY'].includes(normalized)) return 'PREPARADO';
    return normalized;
};

const buildPayrollElectronicPayload = ({ tenant, period, liquidation, employee, document }) => ({
    provider: 'alegra',
    company: {
        id: tenant.alegra_company_id || null,
        identification: tenant.tax_id || null,
        identificationType: tenant.tax_id_type || 'NIT',
        businessName: tenant.business_name || tenant.name || null,
        taxResponsibility: tenant.tax_responsibility || null,
        email: tenant.email || null,
        phone: tenant.phone || null,
        address: tenant.address || null,
        city: tenant.city || null,
        department: tenant.state || null,
        postalCode: tenant.postal_code || null
    },
    payrollPeriod: {
        id: period.id,
        year: period.year,
        month: period.month,
        periodType: period.period_type,
        periodNumber: period.period_number,
        startDate: period.start_date,
        endDate: period.end_date,
        paymentDate: period.payment_date
    },
    employee: {
        id: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        documentType: employee.document_type,
        documentNumber: employee.document_number,
        email: employee.email || null,
        phone: employee.phone || null,
        position: employee.position || null,
        department: employee.department || null
    },
    electronicDocument: {
        id: document?.id || null,
        type: document?.document_type || '102',
        consecutive: document?.consecutive || null
    },
    liquidation: {
        id: liquidation.id,
        totalDevengado: Number(liquidation.total_devengado || 0),
        totalDeductions: Number(liquidation.total_deductions || 0),
        netPay: Number(liquidation.net_pay || 0),
        healthEmployee: Number(liquidation.health_employee || 0),
        pensionEmployee: Number(liquidation.pension_employee || 0),
        healthEmployer: Number(liquidation.health_employer || 0),
        pensionEmployer: Number(liquidation.pension_employer || 0),
        arlEmployer: Number(liquidation.arl_employer || 0),
        ccfEmployer: Number(liquidation.ccf_employer || 0),
        transportAllowance: Number(liquidation.transport_allowance || 0),
        bonuses: Number(liquidation.bonuses || 0),
        commissions: Number(liquidation.commissions || 0),
        otherIncome: Number(liquidation.other_income || 0),
        workedDays: Number(liquidation.worked_days || 0),
        salaryDays: Number(liquidation.salary_days || 0),
        baseSalary: Number(liquidation.base_salary || 0)
    }
});

const calculatePayrollPeriodSyncStatus = (statuses = []) => {
    const normalized = statuses.map(normalizePayrollDianStatus);
    if (normalized.length === 0) return 'PENDIENTE';
    if (normalized.every((status) => status === 'ACEPTADO')) return 'ACEPTADO';
    if (normalized.some((status) => status === 'ERROR' || status === 'RECHAZADO')) {
        return normalized.some((status) => PAYROLL_FINAL_STATUSES.has(status)) ? 'PARCIAL' : 'ERROR';
    }
    if (normalized.some((status) => status === 'ENVIADO')) return 'ENVIADO';
    if (normalized.some((status) => status === 'PREPARADO')) return 'PREPARADO';
    return 'PENDIENTE';
};

const loadPayrollPeriodContext = async (tenantId, periodId) => {
    const periodResult = await db.query(
        `SELECT pp.*, t.alegra_company_id, t.tax_id, t.tax_id_type, t.tax_responsibility,
                t.business_name, t.name, t.email, t.phone, t.address, t.city, t.state, t.postal_code
         FROM payroll_periods pp
         JOIN tenants t ON t.id = pp.tenant_id
         WHERE pp.id = $1 AND pp.tenant_id = $2
         LIMIT 1`,
        [periodId, tenantId]
    );

    if (periodResult.rows.length === 0) {
        return null;
    }

    const liquidationsResult = await db.query(
        `SELECT pl.*, e.first_name, e.last_name, e.document_type, e.document_number,
                e.email, e.phone, e.position, e.department
         FROM payroll_liquidations pl
         JOIN employees e ON e.id = pl.employee_id
         WHERE pl.period_id = $1 AND pl.tenant_id = $2
         ORDER BY e.last_name ASC, e.first_name ASC`,
        [periodId, tenantId]
    );

    return {
        period: periodResult.rows[0],
        tenant: periodResult.rows[0],
        liquidations: liquidationsResult.rows
    };
};

const ensurePayrollElectronicDocs = async ({ tenantId, periodId, userId = null }) => {
    const context = await loadPayrollPeriodContext(tenantId, periodId);
    if (!context) {
        throw new Error('Per�odo no encontrado');
    }

    const { period, tenant, liquidations } = context;
    if (!PAYROLL_READY_STATUSES.has(period.status)) {
        throw new Error(`El per�odo debe estar preliquidado o aprobado para preparar n�mina electr�nica. Estado actual: ${period.status}`);
    }
    if (liquidations.length === 0) {
        throw new Error('El per�odo no tiene liquidaciones para preparar n�mina electr�nica');
    }

    const documents = [];

    for (const liquidation of liquidations) {
        const employee = {
            id: liquidation.employee_id,
            first_name: liquidation.first_name,
            last_name: liquidation.last_name,
            document_type: liquidation.document_type,
            document_number: liquidation.document_number,
            email: liquidation.email,
            phone: liquidation.phone,
            position: liquidation.position,
            department: liquidation.department
        };

        const existingResult = await db.query(
            `SELECT *
             FROM payroll_electronic_docs
             WHERE tenant_id = $1 AND period_id = $2 AND liquidation_id = $3
             LIMIT 1`,
            [tenantId, periodId, liquidation.id]
        );

        let document = existingResult.rows[0] || null;
        const consecutive = document?.consecutive || `NE-${periodId}-${liquidation.id}`.slice(0, 20);
        const payload = buildPayrollElectronicPayload({ tenant, period, liquidation, employee, document: { ...document, consecutive } });

        if (document) {
            const updatedResult = await db.query(
                `UPDATE payroll_electronic_docs
                 SET document_type = $1,
                     consecutive = $2,
                     dian_status = CASE WHEN dian_status IN ('ACEPTADO', 'ENVIADO') THEN dian_status ELSE 'PREPARADO' END,
                     dian_response = $3::jsonb
                 WHERE id = $4
                 RETURNING *`,
                [
                    document.document_type || '102',
                    consecutive,
                    JSON.stringify({ provider: 'alegra', preparedAt: new Date().toISOString(), payload }),
                    document.id
                ]
            );
            document = updatedResult.rows[0];
        } else {
            const insertResult = await db.query(
                `INSERT INTO payroll_electronic_docs (
                    tenant_id, period_id, employee_id, liquidation_id,
                    document_type, consecutive, dian_status, dian_response, created_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, 'PREPARADO', $7::jsonb, NOW())
                 RETURNING *`,
                [
                    tenantId,
                    periodId,
                    employee.id,
                    liquidation.id,
                    '102',
                    consecutive,
                    JSON.stringify({ provider: 'alegra', preparedAt: new Date().toISOString(), payload })
                ]
            );
            document = insertResult.rows[0];
        }

        await providerIntegrationService.upsertDocumentLink({
            tenantId,
            providerName: 'alegra',
            localEntityType: 'payroll_electronic_doc',
            localEntityId: document.id,
            localDocumentNumber: document.consecutive,
            syncStatus: PAYROLL_FINAL_STATUSES.has(normalizePayrollDianStatus(document.dian_status)) ? 'SYNCED' : 'PENDING',
            payload,
            metadata: { source: 'alegraController.preparePayrollElectronicPeriod', periodId, employeeId: employee.id },
            createdBy: userId
        });

        documents.push({
            ...document,
            employee_name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
            document_number: employee.document_number,
            payload
        });
    }

    await db.query(
        `UPDATE payroll_periods
         SET dian_status = $1,
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [calculatePayrollPeriodSyncStatus(documents.map((doc) => doc.dian_status)), periodId, tenantId]
    );

    return {
        tenant,
        period,
        documents
    };
};

const getPayrollElectronicStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesi�n' });
        }

        const [tenantResult, statsResult] = await Promise.all([
            db.query(
                `SELECT alegra_company_id, alegra_test_set_status, tax_id, business_name
                 FROM tenants
                 WHERE id = $1
                 LIMIT 1`,
                [tenantId]
            ),
            db.query(
                `SELECT
                    COUNT(*)::int AS total_documents,
                    COUNT(*) FILTER (WHERE dian_status = 'PREPARADO')::int AS prepared_documents,
                    COUNT(*) FILTER (WHERE dian_status = 'ENVIADO')::int AS sent_documents,
                    COUNT(*) FILTER (WHERE dian_status = 'ACEPTADO')::int AS accepted_documents,
                    COUNT(*) FILTER (WHERE dian_status IN ('ERROR', 'RECHAZADO'))::int AS error_documents
                 FROM payroll_electronic_docs
                 WHERE tenant_id = $1`,
                [tenantId]
            )
        ]);

        const tenant = tenantResult.rows[0] || {};
        const stats = statsResult.rows[0] || {};
        const payrollApiPath = alegraService.getPayrollApiPath();

        return res.json({
            success: true,
            data: {
                provider: 'alegra',
                companyRegistered: !!tenant.alegra_company_id,
                testSetStatus: tenant.alegra_test_set_status || 'PENDIENTE',
                hasToken: !!process.env.ALEGRA_API_TOKEN,
                hasPayrollApiPath: !!payrollApiPath,
                payrollApiPathConfigured: payrollApiPath || null,
                readyToSync: !!(tenant.alegra_company_id && process.env.ALEGRA_API_TOKEN && payrollApiPath),
                companyName: tenant.business_name || null,
                taxId: tenant.tax_id || null,
                stats
            }
        });
    } catch (error) {
        console.error('Error en getPayrollElectronicStatus:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const listPayrollElectronicPeriods = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { year, month } = req.query;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesi�n' });
        }

        const params = [tenantId];
        let whereClause = `WHERE pp.tenant_id = $1 AND pp.status IN ('preliquidado', 'aprobado', 'transmitido', 'pagado')`;

        if (year) {
            params.push(Number(year));
            whereClause += ` AND pp.year = $${params.length}`;
        }
        if (month) {
            params.push(Number(month));
            whereClause += ` AND pp.month = $${params.length}`;
        }

        const result = await db.query(
            `SELECT pp.*,
                    COUNT(ped.id)::int AS electronic_documents,
                    COUNT(*) FILTER (WHERE ped.dian_status = 'PREPARADO')::int AS prepared_documents,
                    COUNT(*) FILTER (WHERE ped.dian_status = 'ENVIADO')::int AS sent_documents,
                    COUNT(*) FILTER (WHERE ped.dian_status = 'ACEPTADO')::int AS accepted_documents,
                    COUNT(*) FILTER (WHERE ped.dian_status IN ('ERROR', 'RECHAZADO'))::int AS error_documents
             FROM payroll_periods pp
             LEFT JOIN payroll_electronic_docs ped
               ON ped.period_id = pp.id AND ped.tenant_id = pp.tenant_id
             ${whereClause}
             GROUP BY pp.id
             ORDER BY pp.year DESC, pp.month DESC, pp.period_number DESC`,
            params
        );

        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error en listPayrollElectronicPeriods:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const getPayrollElectronicDocuments = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const { periodId } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesi�n' });
        }

        const result = await db.query(
            `SELECT ped.*, e.first_name, e.last_name, e.document_number,
                    pl.net_pay, pl.total_devengado, pl.total_deductions
             FROM payroll_electronic_docs ped
             JOIN employees e ON e.id = ped.employee_id
             LEFT JOIN payroll_liquidations pl ON pl.id = ped.liquidation_id
             WHERE ped.tenant_id = $1 AND ped.period_id = $2
             ORDER BY e.last_name ASC, e.first_name ASC`,
            [tenantId, periodId]
        );

        return res.json({
            success: true,
            data: result.rows.map((row) => ({
                ...row,
                employee_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
                dian_status: normalizePayrollDianStatus(row.dian_status)
            }))
        });
    } catch (error) {
        console.error('Error en getPayrollElectronicDocuments:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

const preparePayrollElectronicPeriod = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id || null;
        const { periodId } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesi�n' });
        }

        const prepared = await ensurePayrollElectronicDocs({ tenantId, periodId, userId });

        await providerIntegrationService.logSyncEvent({
            tenantId,
            providerName: 'alegra',
            eventType: 'PAYROLL_PREPARED',
            localEntityType: 'payroll_period',
            localEntityId: String(periodId),
            message: `N�mina electr�nica preparada para ${prepared.documents.length} empleados`,
            responsePayload: { documents: prepared.documents.length },
            metadata: { source: 'alegraController.preparePayrollElectronicPeriod' },
            createdBy: userId
        });

        return res.json({
            success: true,
            message: `Documentos preparados para ${prepared.documents.length} empleados`,
            data: prepared.documents
        });
    } catch (error) {
        console.error('Error en preparePayrollElectronicPeriod:', error);
        return res.status(400).json({ success: false, error: error.message });
    }
};

const syncPayrollElectronicPeriod = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id;
        const userId = req.user?.id || null;
        const { periodId } = req.params;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant no encontrado en sesi�n' });
        }

        const payrollApiPath = alegraService.getPayrollApiPath();
        if (!payrollApiPath) {
            return res.status(409).json({
                success: false,
                error: 'Falta configurar ALEGRA_PAYROLL_API_PATH para transmitir n�mina electr�nica a Alegra'
            });
        }

        const prepared = await ensurePayrollElectronicDocs({ tenantId, periodId, userId });
        if (!prepared.tenant.alegra_company_id) {
            return res.status(409).json({
                success: false,
                error: 'La empresa a�n no est� registrada en Alegra'
            });
        }

        const syncResults = [];

        for (const document of prepared.documents) {
            const payload = document.payload || document.dian_response?.payload || {};
            const result = await alegraService.createPayrollElectronicDocument(payload);
            const normalizedStatus = normalizePayrollDianStatus(result.dianStatus || (result.success ? 'ENVIADO' : 'ERROR'));

            const updateResult = await db.query(
                `UPDATE payroll_electronic_docs
                 SET dian_status = $1,
                     cune = COALESCE($2, cune),
                     dian_track_id = COALESCE($3, dian_track_id),
                     dian_response = $4::jsonb,
                     transmitted_at = CASE WHEN $5 THEN NOW() ELSE transmitted_at END
                 WHERE id = $6
                 RETURNING *`,
                [
                    normalizedStatus,
                    result.cune || null,
                    result.trackId || result.externalId || null,
                    JSON.stringify({
                        provider: 'alegra',
                        request: payload,
                        response: result.data || result.details || null,
                        syncedAt: new Date().toISOString(),
                        success: result.success
                    }),
                    result.success,
                    document.id
                ]
            );

            const updatedDoc = updateResult.rows[0];

            await providerIntegrationService.upsertDocumentLink({
                tenantId,
                providerName: 'alegra',
                localEntityType: 'payroll_electronic_doc',
                localEntityId: updatedDoc.id,
                localDocumentNumber: updatedDoc.consecutive,
                externalId: result.externalId || null,
                externalNumber: result.externalNumber || null,
                syncStatus: result.success ? 'SYNCED' : 'ERROR',
                payload,
                lastError: result.success ? null : result.error,
                metadata: { source: 'alegraController.syncPayrollElectronicPeriod', periodId },
                createdBy: userId
            });

            await providerIntegrationService.logSyncEvent({
                tenantId,
                providerName: 'alegra',
                eventType: result.success ? 'PAYROLL_SYNCED' : 'PAYROLL_SYNC_FAILED',
                localEntityType: 'payroll_electronic_doc',
                localEntityId: String(updatedDoc.id),
                externalId: result.externalId || null,
                message: result.success
                    ? `Documento ${updatedDoc.consecutive} sincronizado con Alegra`
                    : `Error sincronizando documento ${updatedDoc.consecutive}: ${result.error}`,
                requestPayload: payload,
                responsePayload: result.data || result.details || null,
                metadata: { source: 'alegraController.syncPayrollElectronicPeriod', periodId },
                createdBy: userId
            });

            syncResults.push({
                ...updatedDoc,
                employee_name: document.employee_name,
                document_number: document.document_number,
                success: result.success,
                error: result.success ? null : result.error
            });
        }

        const aggregateStatus = calculatePayrollPeriodSyncStatus(syncResults.map((item) => item.dian_status));
        await db.query(
            `UPDATE payroll_periods
             SET dian_status = $1,
                 updated_at = NOW()
             WHERE id = $2 AND tenant_id = $3`,
            [aggregateStatus, periodId, tenantId]
        );

        return res.json({
            success: true,
            message: `Sincronizaci�n ejecutada para ${syncResults.length} documentos`,
            data: {
                periodStatus: aggregateStatus,
                results: syncResults
            }
        });
    } catch (error) {
        console.error('Error en syncPayrollElectronicPeriod:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
// ============================================
// EXPORTS
// ============================================
module.exports = {
    // Config
    getConfig,
    getProviderStatus,

    // Empresas
    registerCompany,
    getCompany,

    // Estado de facturación
    getInvoicingStatus,
    getResolutions,
    saveManualResolution,

    // Set de pruebas
    getTestSetStatus,
    sendTestSet,
    generateTestDocuments,

    // Facturación
    createInvoice,
    getInvoice,
    sendInvoiceToDian,

    // Notas
    createCreditNote,
    createDebitNote,

    // N�mina electr�nica
    getPayrollElectronicStatus,
    listPayrollElectronicPeriods,
    getPayrollElectronicDocuments,
    preparePayrollElectronicPeriod,
    syncPayrollElectronicPeriod,

    // Consulta DIAN
    lookupAcquirerInfo,

    // Tablas DIAN
    getDianDepartments,
    getDianMunicipalities,
    getDianTaxRegimes,
    getDianIdentificationTypes
};












