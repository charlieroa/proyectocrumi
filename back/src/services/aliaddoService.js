// src/services/aliaddoService.js
// Servicio de integración con API de Aliaddo - Facturación Electrónica Colombia

const axios = require('axios');

// Configuración desde variables de entorno
const ALIADDO_BASE_URL = process.env.ALIADDO_BASE_URL || 'https://isv.aliaddo.net/api/v1/public/documents';
const ALIADDO_API_KEY = process.env.ALIADDO_API_KEY;

// Cliente Axios configurado para Aliaddo
const aliaddoClient = axios.create({
    baseURL: ALIADDO_BASE_URL,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': ALIADDO_API_KEY
    },
    timeout: 60000 // 60 segundos (DIAN puede tardar)
});

// Interceptor para logs
aliaddoClient.interceptors.request.use(config => {
    console.log(`[Aliaddo] ${config.method?.toUpperCase()} ${config.baseURL}${config.url || ''}`);
    return config;
});

aliaddoClient.interceptors.response.use(
    response => {
        console.log(`[Aliaddo] ${response.status} OK`);
        return response;
    },
    error => {
        console.error(`[Aliaddo] Error:`, error.response?.status, error.response?.data || error.message);
        throw error;
    }
);

// ============================================
// MAPEO DE TIPOS DE DOCUMENTO DIAN
// ============================================
const DOC_TYPE_MAP = {
    'NIT': '31',
    'CC': '13',
    'CE': '22',
    'TI': '12',
    'PP': '41',
    'DIE': '42',
    'NUIP': '91',
    'Nit': '31', 'nit': '31',
    'Cedula': '13', 'cedula': '13', 'Cédula': '13',
    'Cédula de Ciudadanía': '13', 'Cedula de Ciudadania': '13',
    'Pasaporte': '41', 'pasaporte': '41',
    'Cedula de Extranjeria': '22', 'Cédula de Extranjería': '22',
    'Tarjeta de Identidad': '12',
    '31': '31', '13': '13', '22': '22', '12': '12',
    '41': '41', '42': '42', '91': '91', '11': '11',
};

// ============================================
// HELPER: Calcular DV del NIT
// ============================================
const calcularDV = (nit) => {
    if (!nit) return '';
    const nitLimpio = nit.toString().replace(/\D/g, '');
    if (nitLimpio.length === 0) return '';

    const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    const nitStr = nitLimpio.padStart(15, '0');
    let suma = 0;

    for (let i = 0; i < 15; i++) {
        suma += parseInt(nitStr[14 - i]) * primos[i];
    }

    const residuo = suma % 11;
    return residuo > 1 ? (11 - residuo).toString() : residuo.toString();
};

// ============================================
// HELPER: Mapear código de régimen
// ============================================
const mapRegimeCode = (taxResponsibility) => {
    if (!taxResponsibility) return '49'; // No responsable de IVA
    const validCodes = ['48', '49'];
    if (validCodes.includes(taxResponsibility)) return taxResponsibility;

    const lower = taxResponsibility.toLowerCase();
    if (lower.includes('no responsable')) return '49';
    if (lower.includes('responsable') || lower.includes('iva')) return '48';
    return '49';
};

// ============================================
// HELPER: Mapear responsabilidades fiscales
// ============================================
const mapResponsibilities = (taxResponsibility) => {
    if (!taxResponsibility) return 'R-99-PN';
    const validCodes = ['O-13', 'O-15', 'O-23', 'O-47', 'O-48', 'O-49', 'R-99-PN'];
    if (validCodes.includes(taxResponsibility)) return taxResponsibility;

    const lower = taxResponsibility.toLowerCase();
    if (lower.includes('gran contribuyente')) return 'O-13';
    if (lower.includes('autorretenedor')) return 'O-15';
    if (lower.includes('agente de retención') || lower.includes('agente de retencion')) return 'O-23';
    if (lower.includes('simple')) return 'O-47';
    if (lower.includes('no responsable')) return 'R-99-PN';
    if (lower.includes('responsable')) return 'O-48';
    return 'R-99-PN';
};

// ============================================
// HELPER: Mapear tipo de persona
// ============================================
const mapPersonType = (docType) => {
    const code = DOC_TYPE_MAP[docType] || docType;
    return code === '31' ? '1' : '2'; // 1=Jurídica (NIT), 2=Natural
};

// ============================================
// MAPEO DE DEPARTAMENTOS Y CIUDADES
// ============================================
const DEPARTMENT_NAME_TO_CODE = {
    'amazonas': '91', 'antioquia': '05', 'arauca': '81', 'atlantico': '08', 'atlántico': '08',
    'bogota': '11', 'bogotá': '11', 'bolivar': '13', 'bolívar': '13', 'boyaca': '15', 'boyacá': '15',
    'caldas': '17', 'caqueta': '18', 'caquetá': '18', 'casanare': '85', 'cauca': '19',
    'cesar': '20', 'choco': '27', 'chocó': '27', 'cordoba': '23', 'córdoba': '23',
    'cundinamarca': '25', 'guainia': '94', 'guainía': '94', 'guaviare': '95', 'huila': '41',
    'la guajira': '44', 'guajira': '44', 'magdalena': '47', 'meta': '50', 'nariño': '52', 'narino': '52',
    'norte de santander': '54', 'putumayo': '86', 'quindio': '63', 'quindío': '63',
    'risaralda': '66', 'san andres': '88', 'san andrés': '88', 'santander': '68',
    'sucre': '70', 'tolima': '73', 'valle del cauca': '76', 'valle': '76', 'vaupes': '97', 'vaupés': '97',
    'vichada': '99'
};

const CITY_NAME_TO_CODE = {
    'bogota': '11001', 'bogotá': '11001', 'chia': '25175', 'chía': '25175', 'cajica': '25126', 'cajicá': '25126',
    'zipaquira': '25899', 'zipaquirá': '25899', 'soacha': '25754', 'facatativa': '25269', 'facatativá': '25269',
    'girardot': '25307', 'fusagasuga': '25290', 'fusagasugá': '25290', 'mosquera': '25473',
    'madrid': '25430', 'funza': '25286', 'cota': '25214', 'tocancipa': '25817', 'tocancipá': '25817',
    'medellin': '05001', 'medellín': '05001', 'bello': '05088', 'itagui': '05360', 'itagüí': '05360',
    'envigado': '05266', 'sabaneta': '05631', 'rionegro': '05615',
    'barranquilla': '08001', 'soledad': '08758',
    'cartagena': '13001',
    'cali': '76001', 'palmira': '76520', 'buenaventura': '76109',
    'bucaramanga': '68001', 'floridablanca': '68276',
    'cucuta': '54001', 'cúcuta': '54001',
    'pereira': '66001', 'dosquebradas': '66170',
    'manizales': '17001',
    'ibague': '73001', 'ibagué': '73001',
    'neiva': '41001',
    'villavicencio': '50001',
    'pasto': '52001',
    'popayan': '19001', 'popayán': '19001',
    'tunja': '15001',
    'monteria': '23001', 'montería': '23001',
    'santa marta': '47001',
    'valledupar': '20001',
    'sincelejo': '70001',
    'armenia': '63001',
};

// ============================================
// HELPER: Resolver código de ciudad/departamento
// ============================================
const resolveCityCode = (city) => {
    if (!city) return '';
    if (/^\d+$/.test(city)) return city;
    const match = city.match(/\((\d+)\)/);
    if (match) return match[1];
    const normalized = city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return CITY_NAME_TO_CODE[normalized] || CITY_NAME_TO_CODE[city.toLowerCase().trim()] || '';
};

const resolveDeptCode = (dept) => {
    if (!dept) return '';
    if (/^\d+$/.test(dept)) return dept;
    const match = dept.match(/\((\d+)\)/);
    if (match) return match[1];
    const normalized = dept.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return DEPARTMENT_NAME_TO_CODE[normalized] || DEPARTMENT_NAME_TO_CODE[dept.toLowerCase().trim()] || '';
};

// ============================================
// CONSTRUIR OBJETO CUSTOMER PARA ALIADDO
// ============================================
const buildCustomer = (customerData) => {
    const docTypeCode = DOC_TYPE_MAP[customerData.identificationType || customerData.docType] || '13';
    const identification = (customerData.identification || customerData.idNumber || '').toString().split('-')[0].replace(/\D/g, '');
    const isNIT = docTypeCode === '31';
    const dv = customerData.dv || (isNIT ? calcularDV(identification) : '0');
    const personType = isNIT ? '1' : '2';
    const regimeType = mapRegimeCode(customerData.regimeType || customerData.taxResponsibility);
    const responsibilities = mapResponsibilities(customerData.responsibilities || customerData.taxResponsibility);

    const name = customerData.name || customerData.companyName || 'CONSUMIDOR FINAL';
    const firstName = customerData.firstName || (personType === '2' ? name.split(' ').slice(0, -1).join(' ') || name : name);
    const lastName = customerData.lastName || (personType === '2' ? name.split(' ').slice(-1)[0] || '' : '');

    const cityCode = resolveCityCode(customerData.cityCode || customerData.city || customerData.billingCityCode);
    const deptCode = resolveDeptCode(customerData.departmentCode || customerData.department || customerData.billingRegionCode);

    return {
        companyName: name,
        personType: personType,
        regimeType: regimeType,
        firstName: firstName,
        lastName: lastName,
        identification: identification,
        digitCheck: dv,
        identificationTypeCode: docTypeCode,
        email: customerData.email || '',
        phone: customerData.phone || customerData.telefono || '',
        merchantRegistration: '',
        responsibleFor: isNIT ? '' : 'ZZ',
        responsibilities: responsibilities,
        economicActivities: customerData.economicActivities || '',
        billingAddress: customerData.address || customerData.direccion || '',
        billingCountryName: 'Colombia',
        billingCountryCode: 'CO',
        billingRegionName: customerData.departmentName || customerData.departamento || '',
        billingRegionCode: deptCode,
        billingCityName: customerData.cityName || customerData.ciudad || '',
        billingCityCode: cityCode,
        billingPostalCode: customerData.postalCode || '',
        billingNeighborhood: '',
        billingPhone: customerData.phone || '',
        billingContactName: '',
        shippingAddress: '',
        shippingCountryName: '',
        shippingCountryCode: '',
        shippingRegionName: '',
        shippingRegionCode: '',
        shippingCityName: '',
        shippingCityCode: '',
        shippingPostalCode: '',
        shippingNeighborhood: '',
        shippingPhone: '',
        shippingContactName: ''
    };
};

// ============================================
// CONSTRUIR ITEMS PARA ALIADDO
// ============================================
const buildInvoiceDetails = (items) => {
    return items.map(item => {
        const price = Number(item.unitPrice || item.price || 0);
        const quantity = Number(item.quantity || 1);
        const taxRate = Number(item.taxRate || item.tax || 0);
        const discountPercent = Number(item.discount || item.discountPercent || 0);

        const lineBase = price * quantity;
        const discountAmount = lineBase * (discountPercent / 100);

        // Impuestos por unidad (Aliaddo requiere impuesto POR UNIDAD, no total)
        const taxPerUnit = taxRate > 0 ? price * (taxRate / 100) : 0;

        const detail = {
            standardType: '',
            standardCode: '',
            itemCode: item.reference || item.itemCode || item.code || 'PROD-001',
            itemName: item.item || item.description || item.itemName || 'Producto',
            itemModel: '',
            description: item.description || item.item || item.itemName || 'Producto',
            brandName: '',
            itemCodeSupplier: '',
            isPresent: false,
            unitMeasurementCode: item.unitMeasurementCode || '94', // 94 = Unidad
            unitMeasurementName: '',
            price: price.toFixed(2),
            quantity: quantity.toFixed(2),
            discounts: [],
            charges: [],
            taxes: [],
            withholdings: []
        };

        // Agregar descuento si existe
        if (discountPercent > 0 && discountAmount > 0) {
            detail.discounts.push({
                name: 'Descuento',
                type: 'P',
                rate: discountPercent,
                amount: Number(discountAmount.toFixed(2))
            });
        }

        // Agregar IVA si existe (por unidad)
        if (taxRate > 0) {
            detail.taxes.push({
                name: 'IVA',
                code: '01',
                type: 'P',
                rate: taxRate,
                amount: Number(taxPerUnit.toFixed(6))
            });
        }

        return detail;
    });
};

// ============================================
// 1. CREAR FACTURA ELECTRÓNICA
// ============================================
const createInvoice = async (invoiceData, resolution) => {
    const customer = buildCustomer(invoiceData.customer || invoiceData.client || {});
    const items = buildInvoiceDetails(invoiceData.items || []);

    // Calcular total sin impuestos ni retenciones
    let totalAmount = 0;
    for (const item of invoiceData.items || []) {
        const price = Number(item.unitPrice || item.price || 0);
        const qty = Number(item.quantity || 1);
        const disc = Number(item.discount || 0);
        const lineBase = price * qty;
        const discVal = lineBase * (disc / 100);
        totalAmount += lineBase - discVal;
    }

    const payload = {
        code: invoiceData.code || '01', // 01 = Factura nacional
        format: 'Estandar',
        emailSender: '',
        consecutive: invoiceData.consecutive || invoiceData.number || '',
        externalNumber: invoiceData.externalNumber || '',
        currencyCode: invoiceData.currencyCode || 'COP',
        currencyRate: 0,
        date: invoiceData.date || new Date().toISOString().split('T')[0],
        dateDue: invoiceData.dueDate || invoiceData.dateDue || invoiceData.date || new Date().toISOString().split('T')[0],
        dateStart: '',
        dateEnd: '',
        typeOfOperation: invoiceData.typeOfOperation || '10', // 10 = Estándar
        dueDiligence: '',
        incoterms: '',
        deliveryTerms: '',
        terms: invoiceData.terms || '',
        remark: '',
        observation: invoiceData.notes || invoiceData.observation || '',
        termDay: 0,
        paymentMeanCode: invoiceData.paymentMeanCode || '10', // 10 = Efectivo
        branch: {
            name: '', address: '', phone: '',
            countryCode: '', countryName: '',
            departamentCode: '', departamentName: '',
            cityCode: '', cityName: ''
        },
        resolution: {
            resolutionKey: resolution.resolutionKey || '',
            resolutionPrefix: resolution.resolutionPrefix || resolution.prefix || '',
            resolutionNumber: resolution.resolutionNumber || resolution.number || '',
            resolutionRangeInitial: resolution.resolutionRangeInitial || resolution.rangeStart || '',
            resolutionRangeFinal: resolution.resolutionRangeFinal || resolution.rangeEnd || '',
            resolutionValidFrom: resolution.resolutionValidFrom || resolution.validFrom || '',
            resolutionValidUntil: resolution.resolutionValidUntil || resolution.validUntil || ''
        },
        customer: customer,
        invoiceDetails: items,
        totals: {
            amount: Number(totalAmount.toFixed(2)),
            prepaymentAmount: Number(invoiceData.prepaymentAmount || 0)
        },
        discounts: [],
        charges: [],
        customFields: invoiceData.customFields || []
    };

    console.log('[Aliaddo] Enviando factura:', JSON.stringify(payload, null, 2).substring(0, 2000));

    try {
        const response = await aliaddoClient.post('', payload);
        const data = response.data;
        return {
            success: true,
            data: data,
            cufe: data?.cufe || data?.CUFE || null,
            consecutive: data?.consecutive || payload.consecutive,
            dianStatus: data?.dianDeliveryStatus || data?.status || 'sent',
            trackId: data?.trackId || null,
            pdfUrl: data?.pdfUrl || null,
            xmlUrl: data?.xmlUrl || null
        };
    } catch (error) {
        return handleAliaddoError(error);
    }
};

// ============================================
// 2. CREAR NOTA CRÉDITO ELECTRÓNICA
// ============================================
const createCreditNote = async (creditNoteData, resolution) => {
    const customer = buildCustomer(creditNoteData.customer || creditNoteData.client || {});
    const items = buildInvoiceDetails(creditNoteData.items || []);

    let totalAmount = 0;
    for (const item of creditNoteData.items || []) {
        const price = Number(item.unitPrice || item.price || 0);
        const qty = Number(item.quantity || 1);
        totalAmount += price * qty;
    }

    const payload = {
        format: 'Estandar',
        emailSender: '',
        concept: creditNoteData.concept || creditNoteData.correctionConcept || '2', // 2=Anulación
        consecutive: creditNoteData.consecutive || creditNoteData.number || '',
        externalNumber: '',
        currencyCode: creditNoteData.currencyCode || 'COP',
        currencyRate: 0,
        date: creditNoteData.date || new Date().toISOString().split('T')[0],
        dateStart: '',
        dateEnd: '',
        typeOfOperation: creditNoteData.typeOfOperation || '20', // 20=Referencia factura
        terms: creditNoteData.terms || '',
        remark: '',
        observation: creditNoteData.notes || creditNoteData.observation || '',
        // Factura referenciada
        invoicePrefix: creditNoteData.invoicePrefix || creditNoteData.relatedInvoice?.prefix || resolution.resolutionPrefix || '',
        invoiceConsecutive: creditNoteData.invoiceConsecutive || creditNoteData.relatedInvoice?.consecutive || creditNoteData.relatedInvoice?.number || '',
        invoiceCufe: creditNoteData.invoiceCufe || creditNoteData.relatedInvoice?.cufe || '',
        invoiceDate: creditNoteData.invoiceDate || creditNoteData.relatedInvoice?.date || '',
        branch: {
            name: '', address: '', phone: '',
            countryCode: '', countryName: '',
            departamentCode: '', departamentName: '',
            cityCode: '', cityName: ''
        },
        resolution: {
            resolutionKey: resolution.resolutionKey || '',
            resolutionPrefix: resolution.resolutionPrefix || resolution.prefix || '',
            resolutionNumber: resolution.resolutionNumber || resolution.number || '',
            resolutionRangeInitial: resolution.resolutionRangeInitial || resolution.rangeStart || '',
            resolutionRangeFinal: resolution.resolutionRangeFinal || resolution.rangeEnd || '',
            resolutionValidFrom: resolution.resolutionValidFrom || resolution.validFrom || '',
            resolutionValidUntil: resolution.resolutionValidUntil || resolution.validUntil || ''
        },
        customer: customer,
        invoiceNoteDetails: items,
        totals: {
            amount: Number(totalAmount.toFixed(2)),
            prepaymentAmount: 0
        },
        discounts: [],
        charges: [],
        customFields: []
    };

    console.log('[Aliaddo] Enviando nota crédito:', JSON.stringify(payload, null, 2).substring(0, 2000));

    try {
        const response = await aliaddoClient.post('', payload);
        const data = response.data;
        return {
            success: true,
            data: data,
            cude: data?.cude || data?.CUDE || null,
            consecutive: data?.consecutive || payload.consecutive,
            dianStatus: data?.dianDeliveryStatus || data?.status || 'sent'
        };
    } catch (error) {
        return handleAliaddoError(error);
    }
};

// ============================================
// 3. CREAR NOTA DÉBITO ELECTRÓNICA
// ============================================
const createDebitNote = async (debitNoteData, resolution) => {
    const customer = buildCustomer(debitNoteData.customer || debitNoteData.client || {});
    const items = buildInvoiceDetails(debitNoteData.items || []);

    let totalAmount = 0;
    for (const item of debitNoteData.items || []) {
        const price = Number(item.unitPrice || item.price || 0);
        const qty = Number(item.quantity || 1);
        totalAmount += price * qty;
    }

    const payload = {
        format: 'Estandar',
        emailSender: '',
        concept: debitNoteData.concept || debitNoteData.correctionConcept || '1', // 1=Intereses
        consecutive: debitNoteData.consecutive || debitNoteData.number || '',
        externalNumber: '',
        currencyCode: debitNoteData.currencyCode || 'COP',
        currencyRate: 0,
        date: debitNoteData.date || new Date().toISOString().split('T')[0],
        dateStart: '',
        dateEnd: '',
        typeOfOperation: debitNoteData.typeOfOperation || '30', // 30=Referencia factura
        terms: debitNoteData.terms || '',
        remark: '',
        observation: debitNoteData.notes || debitNoteData.observation || '',
        // Factura referenciada
        invoicePrefix: debitNoteData.invoicePrefix || debitNoteData.relatedInvoice?.prefix || resolution.resolutionPrefix || '',
        invoiceConsecutive: debitNoteData.invoiceConsecutive || debitNoteData.relatedInvoice?.consecutive || debitNoteData.relatedInvoice?.number || '',
        invoiceCufe: debitNoteData.invoiceCufe || debitNoteData.relatedInvoice?.cufe || '',
        invoiceDate: debitNoteData.invoiceDate || debitNoteData.relatedInvoice?.date || '',
        branch: {
            name: '', address: '', phone: '',
            countryCode: '', countryName: '',
            departamentCode: '', departamentName: '',
            cityCode: '', cityName: ''
        },
        resolution: {
            resolutionKey: resolution.resolutionKey || '',
            resolutionPrefix: resolution.resolutionPrefix || resolution.prefix || '',
            resolutionNumber: resolution.resolutionNumber || resolution.number || '',
            resolutionRangeInitial: resolution.resolutionRangeInitial || resolution.rangeStart || '',
            resolutionRangeFinal: resolution.resolutionRangeFinal || resolution.rangeEnd || '',
            resolutionValidFrom: resolution.resolutionValidFrom || resolution.validFrom || '',
            resolutionValidUntil: resolution.resolutionValidUntil || resolution.validUntil || ''
        },
        customer: customer,
        invoiceNoteDetails: items,
        totals: {
            amount: Number(totalAmount.toFixed(2)),
            prepaymentAmount: 0
        },
        discounts: [],
        charges: [],
        customFields: []
    };

    console.log('[Aliaddo] Enviando nota débito:', JSON.stringify(payload, null, 2).substring(0, 2000));

    try {
        const response = await aliaddoClient.post('', payload);
        const data = response.data;
        return {
            success: true,
            data: data,
            cude: data?.cude || data?.CUDE || null,
            consecutive: data?.consecutive || payload.consecutive,
            dianStatus: data?.dianDeliveryStatus || data?.status || 'sent'
        };
    } catch (error) {
        return handleAliaddoError(error);
    }
};

// ============================================
// 4. CONSULTAR ESTADO DE DOCUMENTO
// ============================================
const getDocumentStatus = async (consecutive) => {
    try {
        const response = await aliaddoClient.get(`/${consecutive}`);
        return {
            success: true,
            data: response.data,
            dianStatus: response.data?.dianDeliveryStatus || response.data?.status,
            cufe: response.data?.cufe || response.data?.CUFE
        };
    } catch (error) {
        if (error.response?.status === 404) {
            return { success: false, notFound: true, error: 'Documento no encontrado' };
        }
        return handleAliaddoError(error);
    }
};

// ============================================
// HELPER: Manejar errores de Aliaddo
// ============================================
const handleAliaddoError = (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    let message = null;

    if (data) {
        if (typeof data === 'string') {
            message = data;
        } else if (data.message) {
            message = data.message;
        } else if (data.errors && Array.isArray(data.errors)) {
            message = data.errors.map(e => typeof e === 'string' ? e : (e.message || e.code || JSON.stringify(e))).join('; ');
        } else if (data.error) {
            message = data.error;
        } else {
            message = JSON.stringify(data).slice(0, 500);
        }
    }

    if (!message && (status === 401 || status === 403)) {
        message = 'API Key de Aliaddo inválida o expirada. Revisa ALIADDO_API_KEY en el servidor.';
    }
    if (!message) message = error.message || 'Error al comunicar con Aliaddo.';

    // Retry logic para status 500 con "Service Unavailable" o "Internal Server Error"
    const shouldRetry = status === 500 && data?.dianDeliveryStatus === 'error' &&
        (message.includes('Service Unavailable') || message.includes('Internal Server Error'));

    return {
        success: false,
        error: message,
        details: data,
        httpStatus: status,
        shouldRetry: shouldRetry
    };
};

// ============================================
// TABLAS DIAN (locales, no requieren API)
// ============================================
const getDianTaxRegimes = () => ({
    success: true,
    data: [
        { code: '48', name: 'Responsable de IVA' },
        { code: '49', name: 'No responsable de IVA' }
    ]
});

const getDianResponsibilities = () => ({
    success: true,
    data: [
        { code: 'O-13', name: 'Gran Contribuyente' },
        { code: 'O-15', name: 'Autorretenedor' },
        { code: 'O-23', name: 'Agente de retención IVA' },
        { code: 'O-47', name: 'Régimen Simple de Tributación' },
        { code: 'O-48', name: 'Responsable de IVA' },
        { code: 'O-49', name: 'No responsable de IVA' },
        { code: 'R-99-PN', name: 'No aplica - Otros' },
    ]
});

const getDianIdentificationTypes = () => ({
    success: true,
    data: [
        { code: '11', name: 'Registro civil' },
        { code: '12', name: 'Tarjeta de identidad' },
        { code: '13', name: 'Cédula de ciudadanía' },
        { code: '21', name: 'Tarjeta de extranjería' },
        { code: '22', name: 'Cédula de extranjería' },
        { code: '31', name: 'NIT' },
        { code: '41', name: 'Pasaporte' },
        { code: '42', name: 'Documento de identificación extranjero' },
        { code: '47', name: 'PEP' },
        { code: '48', name: 'PPT' },
        { code: '50', name: 'NIT de otro país' },
        { code: '91', name: 'NUIP' }
    ]
});

const getDianDocumentTypes = () => ({
    success: true,
    data: [
        { code: '01', name: 'Factura de venta nacional' },
        { code: '02', name: 'Factura de exportación' },
        { code: '03', name: 'Factura por contingencia facturador' },
        { code: '04', name: 'Factura por contingencia DIAN' }
    ]
});

const getDianPaymentMethods = () => ({
    success: true,
    data: [
        { code: '1', name: 'Instrumento no definido' },
        { code: '10', name: 'Efectivo' },
        { code: '20', name: 'Cheque' },
        { code: '30', name: 'Transferencia crédito' },
        { code: '31', name: 'Transferencia débito' },
        { code: '42', name: 'Consignación bancaria' },
        { code: '47', name: 'Transferencia débito bancaria' },
        { code: '48', name: 'Tarjeta crédito' },
        { code: '49', name: 'Tarjeta débito' },
        { code: 'ZZZ', name: 'Acuerdo mutuo' }
    ]
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
    // Documentos
    createInvoice,
    createCreditNote,
    createDebitNote,
    getDocumentStatus,

    // Tablas DIAN
    getDianTaxRegimes,
    getDianResponsibilities,
    getDianIdentificationTypes,
    getDianDocumentTypes,
    getDianPaymentMethods,

    // Helpers
    calcularDV,
    mapRegimeCode,
    mapResponsibilities,
    mapPersonType,
    buildCustomer,
    DOC_TYPE_MAP,
    resolveCityCode,
    resolveDeptCode
};
