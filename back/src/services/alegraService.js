// src/services/alegraService.js
// Servicio de integración con API de Alegra Proveedor Electrónico

const axios = require('axios');

// Configuración desde variables de entorno
const ALEGRA_BASE_URL = process.env.ALEGRA_BASE_URL || 'https://api.alegra.com/e-provider/col/v1';
const ALEGRA_TOKEN = process.env.ALEGRA_API_TOKEN;

// Cliente Axios configurado para Alegra
const alegraClient = axios.create({
    baseURL: ALEGRA_BASE_URL,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ALEGRA_TOKEN}`
    },
    timeout: 30000 // 30 segundos
});

// Interceptor para logs
alegraClient.interceptors.request.use(config => {
    console.log(`📤 [Alegra] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
});

alegraClient.interceptors.response.use(
    response => {
        console.log(`📥 [Alegra] ${response.status} OK`);
        return response;
    },
    error => {
        console.error(`❌ [Alegra] Error:`, error.response?.data || error.message);
        throw error;
    }
);

// ============================================
// HELPERS DE NORMALIZACIÓN PARA ALEGRA / DIAN
// ============================================
// Alegra valida el payload contra un JSON schema con tipos estrictos.
// Estas helpers convierten lo que recibimos del front (texto libre, fechas
// ISO con hora, prefijos en el número de factura) al formato exacto que
// pide DIAN.

const formatDianDate = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const extractNumericId = (value) => {
    if (value === null || value === undefined) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
};

// Mapas de conceptos DIAN. Aceptan:
// - Códigos numéricos directos ("1".."6" para NC, "1".."4" para ND)
// - Etiquetas en español que usan los formularios actuales
const NC_LABEL_TO_CODE = {
    'devolución': '1',
    'devolucion': '1',
    'devolucion parcial': '1',
    'devolución parcial': '1',
    'devolución de mercancía por defecto': '1',
    'devolucion de mercancia por defecto': '1',
    'devolucion total': '2',
    'devolución total': '2',
    'anulación': '2',
    'anulacion': '2',
    'anulación de factura electrónica': '2',
    'anulacion de factura electronica': '2',
    'anulación de la operación': '2',
    'anulacion de la operacion': '2',
    'anulación parcial': '2',
    'anulacion parcial': '2',
    'rebaja': '3',
    'descuento': '3',
    'descuento por pronto pago': '3',
    'descuento no aplicado': '3',
    'rebaja o descuento': '3',
    'ajuste de precios': '4',
    'ajuste por error': '4',
    'error en el precio': '4',
    'error en cantidad': '4',
    'descuento adicional': '5',
    'otro': '6',
    'otros': '6',
};

const ND_LABEL_TO_CODE = {
    'intereses': '1',
    'intereses de mora': '1',
    'mora': '1',
    'gastos por cobrar': '2',
    'gastos de cobranza': '2',
    'cargo por financiación': '2',
    'cargo por financiacion': '2',
    'cambio del valor': '3',
    'ajuste al valor facturado': '3',
    'ajuste al valor facturado (por exceso no facturado)': '3',
    'diferencia cambiaria': '3',
    'anulación total de la factura': '3',
    'anulacion total de la factura': '3',
    'otro': '4',
    'otros': '4',
};

const toDianConceptCode = (input, { kind, fallback }) => {
    const validCodes = kind === 'credit'
        ? new Set(['1', '2', '3', '4', '5', '6'])
        : new Set(['1', '2', '3', '4']);
    if (input === null || input === undefined) return fallback;
    const raw = String(input).trim();
    if (!raw) return fallback;
    if (validCodes.has(raw)) return raw;
    const map = kind === 'credit' ? NC_LABEL_TO_CODE : ND_LABEL_TO_CODE;
    const normalized = raw.toLowerCase();
    if (map[normalized]) return map[normalized];
    // Si vino texto libre con un dígito al inicio (ej. "2 - Anulación"), úsalo
    const m = raw.match(/^\s*([1-6])/);
    if (m && validCodes.has(m[1])) return m[1];
    return fallback;
};

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
    // Aliases comunes
    'Nit': '31',
    'nit': '31',
    'Cedula': '13',
    'cedula': '13',
    'Cédula': '13',
    'Cédula de Ciudadanía': '13',
    'Cedula de Ciudadania': '13',
    'Pasaporte': '41',
    'pasaporte': '41',
    'Cedula de Extranjeria': '22',
    'Cédula de Extranjería': '22',
    'Tarjeta de Identidad': '12',
    // Codigos DIAN directos (ya son validos)
    '31': '31',
    '13': '13',
    '22': '22',
    '12': '12',
    '41': '41',
    '42': '42',
    '91': '91',
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

const getNumericDocumentNumber = (value) => {
    return Number(String(value || '').replace(/\D/g, '')) || 0;
};

const normalizeProviderNumber = ({
    value,
    sandboxMode = false,
    minNumber = null,
    maxNumber = null,
    preferRange = false
}) => {
    let numeric = getNumericDocumentNumber(value);

    if (!numeric) {
        numeric = Number(String(Date.now()).slice(-9));
    }

    // Clamp al rango DIAN siempre que esté configurado (no solo en sandbox).
    // Sin esto, cuando `value` viene vacío, numeric = Date.now().slice(-9) ~ 4xx millones,
    // que excede el rango habitual 1-5,000,000 del set de pruebas y DIAN responde FAD05c.
    if (preferRange && minNumber) {
        if (numeric < minNumber) {
            const rangeSize = Math.max((maxNumber || minNumber + 1000000) - minNumber, 1);
            numeric = minNumber + (Date.now() % rangeSize);
        }
        if (maxNumber && numeric > maxNumber) {
            const rangeSize = Math.max((maxNumber - minNumber), 1);
            numeric = minNumber + (numeric % rangeSize);
        }
    } else if (sandboxMode && numeric < 100000) {
        numeric = Number(String(Date.now()).slice(-9));
    }

    return numeric;
};

const isProviderDocumentAccepted = (document) => {
    const legalStatus = String(document?.legalStatus || '').toUpperCase();
    const status = String(document?.status || '').toUpperCase();

    if (legalStatus === 'REJECTED') return false;
    if (status === 'REJECTED' || status === 'ERROR') return false;
    return true;
};

const getSandboxCompanyDefaults = (tenant = {}) => ({
    identificationNumber: '900559088',
    dv: '2',
    name: 'Soluciones Alegra S.A.S',
    email: tenant.email || 'pruebas@example.com',
    address: 'Cra. 13 #12-12 Edificio A & A',
    city: '11001',
    department: '11',
    country: 'CO',
    postalCode: tenant.postal_code || '110111',
    regimeCode: 'R-99-PN',
    resolutionNumber: '18760000001',
    resolutionPrefix: 'SETP',
    resolutionMin: 990000000,
    resolutionMax: 995000000,
    resolutionStartDate: '2019-01-19',
    resolutionEndDate: '2030-01-19',
    technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c'
});

// ============================================
// MAPEO DE NOMBRES A CÓDIGOS DIAN (fallback)
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
    // Cundinamarca (25)
    'bogota': '11001', 'bogotá': '11001', 'chia': '25175', 'chía': '25175', 'cajica': '25126', 'cajicá': '25126',
    'zipaquira': '25899', 'zipaquirá': '25899', 'soacha': '25754', 'facatativa': '25269', 'facatativá': '25269',
    'girardot': '25307', 'fusagasuga': '25290', 'fusagasugá': '25290', 'mosquera': '25473',
    'madrid': '25430', 'funza': '25286', 'cota': '25214', 'tocancipa': '25817', 'tocancipá': '25817',
    'la calera': '25377', 'sibate': '25740', 'sibaté': '25740', 'tabio': '25785', 'tenjo': '25799',
    'sopo': '25758', 'sopó': '25758', 'guasca': '25322', 'gachancipa': '25295', 'gachancipá': '25295',
    // Antioquia (05)
    'medellin': '05001', 'medellín': '05001', 'bello': '05088', 'itagui': '05360', 'itagüí': '05360',
    'envigado': '05266', 'sabaneta': '05631', 'rionegro': '05615', 'la estrella': '05380',
    'copacabana': '05212', 'girardota': '05308', 'barbosa': '05079', 'caldas': '05129',
    // Atlántico (08)
    'barranquilla': '08001', 'soledad': '08758', 'malambo': '08433',
    // Bolívar (13)
    'cartagena': '13001', 'turbaco': '13836', 'magangue': '13430', 'magangué': '13430',
    // Valle del Cauca (76)
    'cali': '76001', 'palmira': '76520', 'buenaventura': '76109', 'tulua': '76834', 'tuluá': '76834',
    'buga': '76111', 'cartago': '76147', 'yumbo': '76892', 'jamundi': '76364', 'jamundí': '76364',
    // Santander (68)
    'bucaramanga': '68001', 'floridablanca': '68276', 'giron': '68307', 'girón': '68307',
    'piedecuesta': '68547', 'barrancabermeja': '68081',
    // Norte de Santander (54)
    'cucuta': '54001', 'cúcuta': '54001', 'pamplona': '54518', 'ocaña': '54498', 'ocana': '54498',
    // Risaralda (66)
    'pereira': '66001', 'dosquebradas': '66170', 'santa rosa de cabal': '66682',
    // Caldas (17)
    'manizales': '17001', 'la dorada': '17380', 'chinchina': '17174', 'chinchiná': '17174',
    // Tolima (73)
    'ibague': '73001', 'ibagué': '73001', 'espinal': '73268', 'melgar': '73449',
    // Huila (41)
    'neiva': '41001', 'pitalito': '41551', 'garzon': '41306', 'garzón': '41306',
    // Meta (50)
    'villavicencio': '50001', 'acacias': '50006', 'acacías': '50006', 'granada': '50313',
    // Nariño (52)
    'pasto': '52001', 'tumaco': '52835', 'ipiales': '52356',
    // Cauca (19)
    'popayan': '19001', 'popayán': '19001', 'santander de quilichao': '19698',
    // Boyacá (15)
    'tunja': '15001', 'duitama': '15238', 'sogamoso': '15759', 'chiquinquira': '15176', 'chiquinquirá': '15176',
    // Córdoba (23)
    'monteria': '23001', 'montería': '23001', 'lorica': '23417', 'cerete': '23162', 'cereté': '23162',
    // Magdalena (47)
    'santa marta': '47001', 'cienaga': '47189', 'ciénaga': '47189',
    // Cesar (20)
    'valledupar': '20001', 'aguachica': '20013',
    // La Guajira (44)
    'riohacha': '44001', 'maicao': '44430',
    // Sucre (70)
    'sincelejo': '70001', 'corozal': '70215',
    // Quindío (63)
    'armenia': '63001', 'calarca': '63130', 'calarcá': '63130',
};

// ============================================
// 1. CREAR EMPRESA EN ALEGRA
// ============================================
const createCompany = async (tenantData) => {
    // Extraer NIT sin DV si viene con guión
    let identification = tenantData.tax_id || '';
    let dv = '';
    
    if (identification.includes('-')) {
        const parts = identification.split('-');
        identification = parts[0].replace(/\D/g, '');
        dv = parts[1] || calcularDV(identification);
    } else {
        identification = identification.replace(/\D/g, '');
        dv = calcularDV(identification);
    }

    // Mapear tipo de documento
    const identificationType = DOC_TYPE_MAP[tenantData.tax_id_type] || '31'; // Default NIT

    // Extraer códigos DIAN de city y state
    let cityCode = tenantData.city || '';
    let departmentCode = tenantData.state || '';
    
    // Si city es solo números, usarlo directamente
    if (cityCode && !/^\d+$/.test(cityCode)) {
        // Intentar extraer código entre paréntesis
        const cityMatch = cityCode.match(/\((\d+)\)/);
        if (cityMatch) {
            cityCode = cityMatch[1];
        } else {
            // Buscar en el diccionario de nombres
            const normalizedCity = cityCode.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            cityCode = CITY_NAME_TO_CODE[normalizedCity] || CITY_NAME_TO_CODE[cityCode.toLowerCase().trim()] || cityCode;
        }
    }
    
    // Si department es solo números, usarlo directamente
    if (departmentCode && !/^\d+$/.test(departmentCode)) {
        // Intentar extraer código entre paréntesis
        const deptMatch = departmentCode.match(/\((\d+)\)/);
        if (deptMatch) {
            departmentCode = deptMatch[1];
        } else {
            // Buscar en el diccionario de nombres
            const normalizedDept = departmentCode.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            departmentCode = DEPARTMENT_NAME_TO_CODE[normalizedDept] || DEPARTMENT_NAME_TO_CODE[departmentCode.toLowerCase().trim()] || departmentCode;
        }
    }

    // LOG para debug
    console.log('[ALEGRA createCompany] Datos del tenant:');
    console.log('  - city original:', tenantData.city, '-> código:', cityCode);
    console.log('  - state original:', tenantData.state, '-> código:', departmentCode);

    const payload = {
        name: tenantData.business_name || tenantData.name,
        tradeName: tenantData.name || tenantData.business_name,
        identification: identification,
        dv: dv,
        type: 'associated',
        useAlegraCertificate: true, // Alegra firma por nosotros
        identificationType: identificationType,
        organizationType: 1, // Persona jurídica por defecto
        regimeCode: mapRegimeCode(tenantData.tax_responsibility),
        email: tenantData.email,
        phone: tenantData.phone || '',
        address: {
            address: tenantData.address || '',
            // Alegra espera códigos DIAN como strings directos
            city: cityCode,
            department: departmentCode,
            country: 'CO',
            postalCode: tenantData.postal_code || ''
        }
    };

    // Agregar actividades económicas si existen
    if (tenantData.economic_activities) {
        payload.economicActivities = Array.isArray(tenantData.economic_activities) 
            ? tenantData.economic_activities 
            : [tenantData.economic_activities];
    }

    console.log('[ALEGRA createCompany] Payload a enviar:', JSON.stringify(payload, null, 2));

    try {
        const response = await alegraClient.post('/companies', payload);
        console.log('[ALEGRA createCompany] ✅ Respuesta exitosa:', response.data);
        return {
            success: true,
            data: response.data,
            alegraCompanyId: response.data?.id || response.data?.identification
        };
    } catch (error) {
        console.log('[ALEGRA createCompany] ❌ Error:', error.response?.status, error.response?.data);
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// ============================================
// 2. CONSULTAR EMPRESA EN ALEGRA
// ============================================
const getCompany = async (companyId) => {
    try {
        const response = await alegraClient.get(`/companies/${companyId}`);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// ============================================
// 3. SET DE PRUEBAS
// ============================================
const createTestSet = async (testSetId, companyIdentification, alegraCompanyId) => {
    // Alegra exige que governmentId sea el UUID del set de pruebas DIAN, no el NIT.
    // Validamos antes de pegarle al endpoint para evitar el error "governmentId does not match pattern".
    const UUID_RE = /^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$/;
    if (!testSetId || !UUID_RE.test(String(testSetId))) {
        return {
            success: false,
            error: 'TestSetId inválido: debe ser el UUID emitido por la DIAN (no el NIT). Configúralo en tenants.alegra_test_set_id.',
            errorCode: 'INVALID_TEST_SET_ID',
        };
    }
    const payload = {
        type: 'invoices',
        governmentId: testSetId, // UUID del TestSet DIAN
    };
    // Si tenemos el Alegra company ID, incluirlo (requerido por Alegra)
    if (alegraCompanyId) {
        payload.company = { id: alegraCompanyId };
    }

    // LOG DETALLADO: Mostrar exactamente qué se envía a Alegra
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[ALEGRA SET DE PRUEBAS] Enviando request...');
    console.log('[ALEGRA] URL Base:', ALEGRA_BASE_URL);
    console.log('[ALEGRA] Endpoint: POST /test-sets');
    console.log('[ALEGRA] Token (primeros 10 chars):', ALEGRA_TOKEN ? ALEGRA_TOKEN.substring(0, 10) + '...' : 'NO CONFIGURADO');
    console.log('[ALEGRA] Payload:', JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════════════════════════');

    try {
        const response = await alegraClient.post('/test-sets', payload);
        console.log('[ALEGRA] ✅ Respuesta exitosa:', JSON.stringify(response.data, null, 2));
        return {
            success: true,
            data: response.data,
            status: response.data?.status || 'ENVIADO',
            message: 'Set de pruebas enviado a la DIAN'
        };
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        // LOG DETALLADO DEL ERROR
        console.log('═══════════════════════════════════════════════════════════');
        console.log('[ALEGRA] ❌ ERROR en Set de Pruebas');
        console.log('[ALEGRA] HTTP Status:', status);
        console.log('[ALEGRA] Headers respuesta:', JSON.stringify(error.response?.headers || {}, null, 2));
        console.log('[ALEGRA] Data completa:', JSON.stringify(data, null, 2));
        console.log('[ALEGRA] Error message:', error.message);
        console.log('═══════════════════════════════════════════════════════════');
        
        let message = null;
        let errorCode = null;
        
        if (data) {
            // Extraer código de error de Alegra
            if (data.errors && Array.isArray(data.errors) && data.errors[0]) {
                const first = data.errors[0];
                errorCode = first.code || null;
                message = (typeof first === 'string' ? first : (first.message || first.msg || first.code || first.error));
                console.log('[ALEGRA] Código error Alegra:', errorCode);
                console.log('[ALEGRA] Mensaje error:', message);
            }
            if (!message && (data.message || data.error || data.detail || data.details)) {
                message = data.message || data.error || data.detail || (typeof data.details === 'string' ? data.details : data.details?.message);
            }
            if (!message && data.title) message = data.title;
            if (!message && typeof data === 'object') {
                const str = JSON.stringify(data);
                if (str.length > 10) message = str.slice(0, 400);
            }
        }
        if (!message && (status === 401 || status === 403)) {
            message = 'Token de Alegra inválido o expirado. Revisa ALEGRA_API_TOKEN en el servidor.';
        }
        if (!message) message = error.message || 'Error al comunicar con Alegra.';
        
        return {
            success: false,
            error: message,
            errorCode: errorCode,
            details: data,
            httpStatus: status
        };
    }
};

// Consultar estado del set de pruebas por governmentId (NIT)
const getTestSetByGovernmentId = async (governmentId) => {
    try {
        const response = await alegraClient.get('/test-sets', { params: { governmentId } });
        return {
            success: true,
            data: response.data,
            status: response.data?.status,
            isCompleted: response.data?.status === 'APROBADO'
        };
    } catch (error) {
        // Si es 404, significa que no hay set de pruebas
        if (error.response?.status === 404) {
            return {
                success: true,
                data: null,
                status: 'PENDIENTE',
                isCompleted: false,
                message: 'No se ha iniciado el set de pruebas'
            };
        }
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// ============================================
// CONSULTAR ADQUIRENTE EN DIAN (acquirer-info)
// ============================================
const getAcquirerInfo = async (identificationType, identification) => {
    try {
        const response = await alegraClient.get('/acquirer-info', {
            params: { identificationType, identificationNumber: identification }
        });
        return {
            success: true,
            isRegistered: true,
            receiverName: response.data?.name || response.data?.receiverName || '',
            receiverEmail: response.data?.email || response.data?.receiverEmail || ''
        };
    } catch (error) {
        // 404 = no encontrado en DIAN (no es error)
        if (error.response?.status === 404) {
            return {
                success: true,
                isRegistered: false
            };
        }
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// ============================================
// BUSCAR EMPRESA EN ALEGRA POR IDENTIFICACIÓN (NIT)
// ============================================
const getCompanyByIdentification = async (identification) => {
    try {
        // Listar todas las empresas y filtrar por NIT
        const response = await alegraClient.get('/companies');
        if (response.data?.companies) {
            const cleanId = identification.replace(/\D/g, '');
            const match = response.data.companies.find(c =>
                c.identification && c.identification.replace(/\D/g, '') === cleanId
            );
            if (match) {
                console.log('[Alegra] Empresa encontrada por NIT:', match.identification, '->', match.name);
                return { success: true, data: match };
            }
        }
        return { success: false, notFound: true };
    } catch (error) {
        console.log('[Alegra] getCompanyByIdentification error:', error.response?.status, error.message);
        return { success: false, error: error.message };
    }
};

// Consultar set de pruebas por ID
const getTestSet = async (testSetId) => {
    try {
        const response = await alegraClient.get(`/test-sets/${testSetId}`);
        return {
            success: true,
            data: response.data,
            status: response.data?.status
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// ============================================
// 4. FACTURA ELECTRÓNICA
// ============================================
const createInvoice = async (invoiceData, context = {}) => {
    // ── MOCK MODE ──
    // ALEGRA_MOCK_MODE=true en .env hace que devolvamos éxito fake sin hit a DIAN.
    // Útil mientras el tenant no tenga resolución de producción real.
    if (String(process.env.ALEGRA_MOCK_MODE || '').toLowerCase() === 'true') {
        const number = invoiceData.number || invoiceData.invoice_number || `MOCK-${Date.now()}`;
        const fakeCufe = require('crypto')
            .createHash('sha1')
            .update(`${number}|${invoiceData.date}|${invoiceData.total}|${Date.now()}`)
            .digest('hex')
            .toUpperCase()
            .padEnd(96, '0')
            .slice(0, 96);
        console.log(`[Alegra MOCK] Factura ${number} devuelve éxito simulado.`);
        return {
            success: true,
            cufe: fakeCufe,
            dianStatus: 'APROBADA_MOCK',
            data: {
                number,
                mock: true,
                message: 'Modo mock: no se envió a DIAN real. CUFE generado localmente.'
            }
        };
    }
    /*
    invoiceData debe contener:
    - number: número de factura (ej: "FE-001")
    - date: fecha (YYYY-MM-DD)
    - dueDate: fecha vencimiento
    - customer: { identification, dv, name, email, address, phone, identificationType }
    - items: [{ description, quantity, unitPrice, taxRate }]
    - notes: observaciones
    - paymentMethod: código método de pago DIAN
    - paymentMeans: código medio de pago DIAN
    */

    const tenant = context.tenant || {};
    const sandboxMode = !!context.sandboxMode;
    const sandboxDefaults = getSandboxCompanyDefaults(tenant);
    const companyIdentification = (tenant.tax_id || sandboxDefaults.identificationNumber).split('-')[0].replace(/\D/g, '') || sandboxDefaults.identificationNumber;
    const companyDv = (tenant.tax_id || '').includes('-')
        ? String((tenant.tax_id || '').split('-')[1] || sandboxDefaults.dv)
        : calcularDV(companyIdentification || sandboxDefaults.identificationNumber) || sandboxDefaults.dv;
    const resolutionMin = Number(tenant.alegra_resolution_start || (sandboxMode ? sandboxDefaults.resolutionMin : 990000000));
    const resolutionMax = Number(tenant.alegra_resolution_end || (sandboxMode ? sandboxDefaults.resolutionMax : 995000000));
    const cleanNumber = normalizeProviderNumber({
        value: invoiceData.number || invoiceData.invoice_number,
        sandboxMode,
        minNumber: resolutionMin,
        maxNumber: resolutionMax,
        preferRange: true
    });
    const customerIdentification = invoiceData.customer?.identification || invoiceData.clientNit || '';
    const customerDocType = DOC_TYPE_MAP[invoiceData.customer?.identificationType || invoiceData.clientDocType] || invoiceData.customer?.identificationType || '13';
    const customerName = invoiceData.customer?.name || invoiceData.clientName || 'CONSUMIDOR FINAL';
    const customerEmail = invoiceData.customer?.email || invoiceData.email || invoiceData.clientEmail || 'cliente@example.com';
    const customerPhone = invoiceData.customer?.phone || invoiceData.clientPhone || '';
    const customerAddress = invoiceData.customer?.address || {
        address: invoiceData.clientAddress || 'Calle 10 # 10-10',
        city: invoiceData.clientCity || '11001',
        department: invoiceData.clientDepartment || '11',
        country: 'CO',
        postalCode: invoiceData.clientPostalCode || '110111'
    };
    const lineExtensionAmount = Number(invoiceData.subtotal || 0);
    const taxExclusiveAmount = Number(invoiceData.subtotal || 0);
    const taxInclusiveAmount = Number(invoiceData.total || 0);
    const payableAmount = Number(invoiceData.total || 0);
    const paymentForm = (invoiceData.paymentMethod === 'Credito' || invoiceData.paymentMethod === 'Crédito' || invoiceData.payment_method === 'Credito' || invoiceData.payment_method === 'Crédito') ? '2' : '1';

    const payload = {
        number: cleanNumber,
        date: invoiceData.date,
        dueDate: invoiceData.dueDate || invoiceData.date,
        documentType: '01',
        operationType: '10', // Estándar
        company: {
            id: tenant.alegra_company_id,
            organizationType: tenant.organization_type || 1,
            identificationType: DOC_TYPE_MAP[tenant.tax_id_type] || '31',
            identificationNumber: sandboxMode ? sandboxDefaults.identificationNumber : companyIdentification,
            dv: sandboxMode ? sandboxDefaults.dv : companyDv,
            name: sandboxMode ? sandboxDefaults.name : (tenant.business_name || tenant.name || 'Empresa'),
            regimeCode: sandboxMode ? sandboxDefaults.regimeCode : mapRegimeCode(tenant.tax_responsibility),
            taxScheme: {
                id: '01',
                name: 'IVA'
            },
            email: sandboxMode ? sandboxDefaults.email : (tenant.email || 'hola2@crumi.com'),
            phone: tenant.phone || '3000000000',
            tradeName: tenant.name || tenant.business_name || 'Empresa',
            address: {
                address: sandboxMode ? sandboxDefaults.address : (tenant.address || 'Calle 1 # 1-1'),
                city: sandboxMode ? sandboxDefaults.city : (tenant.city || '11001'),
                department: sandboxMode ? sandboxDefaults.department : (tenant.state || '11'),
                country: sandboxMode ? sandboxDefaults.country : 'CO',
                postalCode: sandboxMode ? sandboxDefaults.postalCode : (tenant.postal_code || '110111')
            }
        },
        resolution: {
            prefix: tenant.alegra_resolution_prefix || (sandboxMode ? sandboxDefaults.resolutionPrefix : 'SETP'),
            resolutionNumber: tenant.alegra_resolution_number || (sandboxMode ? sandboxDefaults.resolutionNumber : '18760000001'),
            minNumber: resolutionMin,
            maxNumber: resolutionMax,
            // DIAN exige formato ISO "YYYY-MM-DD". node-pg devuelve columnas DATE como Date object
            // que al serializar por JSON queda "YYYY-MM-DDTHH:mm:ss.sssZ" — Alegra rechaza con
            // "does not conform to date format". Forzamos slice(0,10) para garantizar el formato.
            startDate: (() => {
                const v = tenant.alegra_resolution_valid_from || (sandboxMode ? sandboxDefaults.resolutionStartDate : invoiceData.date);
                if (v instanceof Date) return v.toISOString().slice(0, 10);
                return String(v || '').slice(0, 10);
            })(),
            endDate: (() => {
                const v = tenant.alegra_resolution_valid_until || (sandboxMode ? sandboxDefaults.resolutionEndDate : (invoiceData.dueDate || invoiceData.date));
                if (v instanceof Date) return v.toISOString().slice(0, 10);
                return String(v || '').slice(0, 10);
            })(),
            // La columna canónica es `alegra_resolution_technical_key` (la otorga DIAN).
            // Se mantienen alias para compatibilidad con tenants legacy.
            technicalKey: tenant.alegra_resolution_technical_key
                || tenant.alegra_technical_key
                || (sandboxMode ? sandboxDefaults.technicalKey : 'sandbox')
        },
        customer: {
            identificationNumber: customerIdentification,
            dv: invoiceData.customer?.dv || calcularDV(customerIdentification),
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            identificationType: customerDocType,
            address: customerAddress,
            taxScheme: {
                id: '01',
                name: 'IVA'
            }
        },
        items: invoiceData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            price: item.unitPrice,
            code: item.code || item.sku || 'SERV001',
            unitCode: item.unitCode || '94',
            subtotal: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || item.price || 0)),
            taxAmount: item.taxAmount || 0,
            standardCode: {
                id: item.standardCode?.id || '999',
                identificationId: item.standardCode?.identificationId || item.code || item.sku || 'SERV001'
            },
            sellersItemIdentification: {
                id: item.code || item.sku || 'SERV001'
            },
            // Para IVA 0% se debe declarar el bloque IVA EXENTO (taxCode '01', porcentaje 0).
            // Si se omite, DIAN responde FAU04 "Base Imponible distinta a la suma de líneas".
            taxes: [{
                taxCode: '01',
                taxPercentage: String(item.taxRate || 0),
                taxableAmount: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || item.price || 0)),
                taxAmount: item.taxAmount || 0
            }]
        })),
        totalAmounts: {
            grossTotal: lineExtensionAmount,
            taxableTotal: taxExclusiveAmount,
            taxTotal: Number(invoiceData.taxAmount || invoiceData.tax_amount || 0),
            discountTotal: Number(invoiceData.discount || 0),
            chargeTotal: 0,
            advanceTotal: 0,
            payableTotal: payableAmount
        },
        payments: [
            {
                paymentForm,
                paymentMethod: invoiceData.paymentMeans || invoiceData.paymentMeanCode || '10',
                paymentDueDate: invoiceData.dueDate || invoiceData.date
            }
        ],
        additionalDocumentReference: sandboxMode
            ? { number: String(cleanNumber), issueDate: invoiceData.date }
            : { number: String(cleanNumber), issueDate: invoiceData.date },
        notes: invoiceData.notes || ''
    };

    try {
        const response = await alegraClient.post('/invoices', payload);
        const invoice = response.data?.invoice || response.data || {};
        const accepted = isProviderDocumentAccepted(invoice);
        return {
            success: accepted,
            data: response.data,
            cufe: invoice.cufe || response.data?.cufe,
            dianStatus: invoice.status || response.data?.dianStatus,
            legalStatus: invoice.legalStatus || null,
            invoiceId: invoice.id || response.data?.id,
            error: accepted ? null : (invoice.governmentResponse?.errorMessages?.join(' | ') || invoice.governmentResponse?.message || 'La DIAN rechazó la factura')
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// Consultar factura
const getInvoice = async (invoiceId) => {
    try {
        const response = await alegraClient.get(`/invoices/${invoiceId}`);
        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// ============================================
// 5. NOTA CRÉDITO ELECTRÓNICA
// ============================================
const createCreditNote = async (creditNoteData, context = {}) => {
    // NC_ND_MOCK_PATCH_v1
    if (String(process.env.ALEGRA_MOCK_MODE || '').toLowerCase() === 'true') {
        const number = creditNoteData.number || ('NC-MOCK-' + Date.now());
        const fakeCude = require('crypto')
            .createHash('sha1')
            .update(number + '|' + creditNoteData.date + '|' + Date.now())
            .digest('hex')
            .toUpperCase()
            .padEnd(96, '0')
            .slice(0, 96);
        console.log('[Alegra MOCK] NotaCrédito ' + number + ' devuelve éxito simulado.');
        return {
            success: true,
            cude: fakeCude,
            cufe: fakeCude,
            dianStatus: 'APROBADA_MOCK',
            data: { number, mock: true, message: 'Modo mock: NC no enviada a DIAN real. CUDE generado localmente.' }
        };
    }

    /*
    creditNoteData debe contener:
    - number: número de nota crédito
    - date: fecha
    - relatedInvoice: { number, cufe } - factura a la que aplica
    - customer: datos del cliente
    - items: líneas de la nota
    - correctionConcept: código concepto de corrección DIAN
    - notes: observaciones
    */

    const tenant = context.tenant || {};
    const sandboxDefaults = getSandboxCompanyDefaults(tenant);
    const companyIdentification = (tenant.tax_id || sandboxDefaults.identificationNumber).split('-')[0].replace(/\D/g, '') || sandboxDefaults.identificationNumber;
    const companyDv = (tenant.tax_id || '').includes('-')
        ? String((tenant.tax_id || '').split('-')[1] || sandboxDefaults.dv)
        : calcularDV(companyIdentification || sandboxDefaults.identificationNumber) || sandboxDefaults.dv;
    const cleanNumber = normalizeProviderNumber({
        value: creditNoteData.number,
        sandboxMode: !!context.sandboxMode
    });
    const customerIdentification = creditNoteData.customer?.identification || creditNoteData.clientNit || '';
    const customerAddress = creditNoteData.customer?.address || {
        address: creditNoteData.clientAddress || 'Calle 10 # 10-10',
        city: creditNoteData.clientCity || '11001',
        department: creditNoteData.clientDepartment || '11',
        country: 'CO',
        postalCode: creditNoteData.clientPostalCode || '110111'
    };
    const conceptCode = toDianConceptCode(creditNoteData.correctionConcept, { kind: 'credit', fallback: '2' });
    const noteDate = formatDianDate(creditNoteData.date) || formatDianDate(new Date());
    const relatedInvoice = creditNoteData.relatedInvoice || {};
    const associatedNumber = extractNumericId(relatedInvoice.number) ?? extractNumericId(relatedInvoice.id);
    const associatedDate = formatDianDate(relatedInvoice.date) || noteDate;
    const associatedUuid = relatedInvoice.cufe ? String(relatedInvoice.cufe) : '';

    const payload = {
        number: cleanNumber,
        date: noteDate,
        documentType: '91',
        company: {
            id: tenant.alegra_company_id,
            organizationType: tenant.organization_type || 1,
            identificationType: DOC_TYPE_MAP[tenant.tax_id_type] || '31',
            identificationNumber: context.sandboxMode ? sandboxDefaults.identificationNumber : companyIdentification,
            dv: context.sandboxMode ? sandboxDefaults.dv : companyDv,
            name: context.sandboxMode ? sandboxDefaults.name : (tenant.business_name || tenant.name || 'Empresa'),
            regimeCode: context.sandboxMode ? sandboxDefaults.regimeCode : mapRegimeCode(tenant.tax_responsibility),
            taxScheme: {
                id: '01',
                name: 'IVA'
            },
            email: context.sandboxMode ? sandboxDefaults.email : (tenant.email || 'hola2@crumi.com'),
            phone: tenant.phone || '3000000000',
            tradeName: tenant.name || tenant.business_name || 'Empresa',
            address: {
                address: context.sandboxMode ? sandboxDefaults.address : (tenant.address || 'Calle 1 # 1-1'),
                city: context.sandboxMode ? sandboxDefaults.city : (tenant.city || '11001'),
                department: context.sandboxMode ? sandboxDefaults.department : (tenant.state || '11'),
                country: context.sandboxMode ? sandboxDefaults.country : 'CO',
                postalCode: context.sandboxMode ? sandboxDefaults.postalCode : (tenant.postal_code || '110111')
            }
        },
        customer: {
            identificationNumber: customerIdentification,
            dv: creditNoteData.customer?.dv || calcularDV(customerIdentification),
            name: creditNoteData.customer.name,
            email: creditNoteData.customer.email,
            identificationType: DOC_TYPE_MAP[creditNoteData.customer.identificationType] || creditNoteData.customer.identificationType || '13',
            address: customerAddress,
            taxScheme: {
                id: '01',
                name: 'IVA'
            }
        },
        items: creditNoteData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            price: item.unitPrice,
            code: item.code || item.sku || 'SERV001',
            unitCode: item.unitCode || '94',
            subtotal: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0)),
            taxAmount: item.taxAmount || 0,
            standardCode: {
                id: item.standardCode?.id || '999',
                identificationId: item.standardCode?.identificationId || item.code || item.sku || 'SERV001'
            },
            sellersItemIdentification: {
                id: item.code || item.sku || 'SERV001'
            },
            taxes: item.taxRate > 0 ? [{
                taxCode: '01',
                taxPercentage: String(item.taxRate),
                taxableAmount: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0)),
                taxAmount: item.taxAmount || 0
            }] : []
        })),
        associatedDocuments: [{
            date: associatedDate,
            documentType: '01',
            number: associatedNumber ?? 0,
            uuid: associatedUuid
        }],
        conceptCode,
        totalAmounts: {
            grossTotal: Number(creditNoteData.items?.reduce((sum, item) => sum + (Number(item.subtotal) || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0))), 0) || 0),
            taxableTotal: Number(creditNoteData.items?.reduce((sum, item) => sum + (Number(item.subtotal) || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0))), 0) || 0),
            taxTotal: Number(creditNoteData.items?.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0) || 0),
            discountTotal: 0,
            chargeTotal: 0,
            advanceTotal: 0,
            payableTotal: Number(creditNoteData.items?.reduce((sum, item) => sum + (Number(item.subtotal || 0) + Number(item.taxAmount || 0)), 0) || 0)
        },
        payments: [
            {
                paymentForm: '1',
                paymentMethod: creditNoteData.paymentMeans || creditNoteData.paymentMeanCode || '10',
                paymentDueDate: noteDate
            }
        ],
        discrepancyResponse: {
            correctionConcept: conceptCode
        },
        notes: creditNoteData.notes || ''
    };

    try {
        const response = await alegraClient.post('/credit-notes', payload);
        const creditNote = response.data?.creditNote || response.data || {};
        const accepted = isProviderDocumentAccepted(creditNote);
        return {
            success: accepted,
            data: response.data,
            cude: creditNote.cude || response.data?.cude,
            dianStatus: creditNote.status || response.data?.dianStatus,
            legalStatus: creditNote.legalStatus || null,
            error: accepted ? null : (creditNote.governmentResponse?.errorMessages?.join(' | ') || creditNote.governmentResponse?.message || 'La DIAN rechazó la nota crédito')
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// ============================================
// 6. NOTA DÉBITO ELECTRÓNICA
// ============================================
const createDebitNote = async (debitNoteData, context = {}) => {
    // NC_ND_MOCK_PATCH_v1
    if (String(process.env.ALEGRA_MOCK_MODE || '').toLowerCase() === 'true') {
        const number = debitNoteData.number || ('ND-MOCK-' + Date.now());
        const fakeCude = require('crypto')
            .createHash('sha1')
            .update(number + '|' + debitNoteData.date + '|' + Date.now())
            .digest('hex')
            .toUpperCase()
            .padEnd(96, '0')
            .slice(0, 96);
        console.log('[Alegra MOCK] NotaDébito ' + number + ' devuelve éxito simulado.');
        return {
            success: true,
            cude: fakeCude,
            cufe: fakeCude,
            dianStatus: 'APROBADA_MOCK',
            data: { number, mock: true, message: 'Modo mock: ND no enviada a DIAN real. CUDE generado localmente.' }
        };
    }

    /*
    debitNoteData debe contener:
    - number: número de nota débito
    - date: fecha
    - relatedInvoice: { number, cufe } - factura a la que aplica
    - customer: datos del cliente
    - items: líneas de la nota
    - correctionConcept: código concepto de corrección DIAN
    - notes: observaciones
    */

    const tenant = context.tenant || {};
    const sandboxDefaults = getSandboxCompanyDefaults(tenant);
    const companyIdentification = (tenant.tax_id || sandboxDefaults.identificationNumber).split('-')[0].replace(/\D/g, '') || sandboxDefaults.identificationNumber;
    const companyDv = (tenant.tax_id || '').includes('-')
        ? String((tenant.tax_id || '').split('-')[1] || sandboxDefaults.dv)
        : calcularDV(companyIdentification || sandboxDefaults.identificationNumber) || sandboxDefaults.dv;
    const cleanNumber = normalizeProviderNumber({
        value: debitNoteData.number,
        sandboxMode: !!context.sandboxMode
    });
    const customerIdentification = debitNoteData.customer?.identification || debitNoteData.clientNit || '';
    const customerAddress = debitNoteData.customer?.address || {
        address: debitNoteData.clientAddress || 'Calle 10 # 10-10',
        city: debitNoteData.clientCity || '11001',
        department: debitNoteData.clientDepartment || '11',
        country: 'CO',
        postalCode: debitNoteData.clientPostalCode || '110111'
    };
    const conceptCode = toDianConceptCode(debitNoteData.correctionConcept, { kind: 'debit', fallback: '1' });
    const noteDate = formatDianDate(debitNoteData.date) || formatDianDate(new Date());
    const relatedInvoice = debitNoteData.relatedInvoice || {};
    const associatedNumber = extractNumericId(relatedInvoice.number) ?? extractNumericId(relatedInvoice.id);
    const associatedDate = formatDianDate(relatedInvoice.date) || noteDate;
    const associatedUuid = relatedInvoice.cufe ? String(relatedInvoice.cufe) : '';

    const payload = {
        number: cleanNumber,
        date: noteDate,
        documentType: '92',
        company: {
            id: tenant.alegra_company_id,
            organizationType: tenant.organization_type || 1,
            identificationType: DOC_TYPE_MAP[tenant.tax_id_type] || '31',
            identificationNumber: context.sandboxMode ? sandboxDefaults.identificationNumber : companyIdentification,
            dv: context.sandboxMode ? sandboxDefaults.dv : companyDv,
            name: context.sandboxMode ? sandboxDefaults.name : (tenant.business_name || tenant.name || 'Empresa'),
            regimeCode: context.sandboxMode ? sandboxDefaults.regimeCode : mapRegimeCode(tenant.tax_responsibility),
            taxScheme: {
                id: '01',
                name: 'IVA'
            },
            email: context.sandboxMode ? sandboxDefaults.email : (tenant.email || 'hola2@crumi.com'),
            phone: tenant.phone || '3000000000',
            tradeName: tenant.name || tenant.business_name || 'Empresa',
            address: {
                address: context.sandboxMode ? sandboxDefaults.address : (tenant.address || 'Calle 1 # 1-1'),
                city: context.sandboxMode ? sandboxDefaults.city : (tenant.city || '11001'),
                department: context.sandboxMode ? sandboxDefaults.department : (tenant.state || '11'),
                country: context.sandboxMode ? sandboxDefaults.country : 'CO',
                postalCode: context.sandboxMode ? sandboxDefaults.postalCode : (tenant.postal_code || '110111')
            }
        },
        customer: {
            identificationNumber: customerIdentification,
            dv: debitNoteData.customer?.dv || calcularDV(customerIdentification),
            name: debitNoteData.customer.name,
            email: debitNoteData.customer.email,
            identificationType: DOC_TYPE_MAP[debitNoteData.customer.identificationType] || debitNoteData.customer.identificationType || '13',
            address: customerAddress,
            taxScheme: {
                id: '01',
                name: 'IVA'
            }
        },
        items: debitNoteData.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            price: item.unitPrice,
            code: item.code || item.sku || 'SERV001',
            unitCode: item.unitCode || '94',
            subtotal: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0)),
            taxAmount: item.taxAmount || 0,
            standardCode: {
                id: item.standardCode?.id || '999',
                identificationId: item.standardCode?.identificationId || item.code || item.sku || 'SERV001'
            },
            sellersItemIdentification: {
                id: item.code || item.sku || 'SERV001'
            },
            taxes: item.taxRate > 0 ? [{
                taxCode: '01',
                taxPercentage: String(item.taxRate),
                taxableAmount: item.subtotal || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0)),
                taxAmount: item.taxAmount || 0
            }] : []
        })),
        associatedDocuments: [{
            date: associatedDate,
            documentType: '01',
            number: associatedNumber ?? 0,
            uuid: associatedUuid
        }],
        conceptCode,
        totalAmounts: {
            grossTotal: Number(debitNoteData.items?.reduce((sum, item) => sum + (Number(item.subtotal) || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0))), 0) || 0),
            taxableTotal: Number(debitNoteData.items?.reduce((sum, item) => sum + (Number(item.subtotal) || ((Number(item.quantity) || 1) * Number(item.unitPrice || 0))), 0) || 0),
            taxTotal: Number(debitNoteData.items?.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0) || 0),
            discountTotal: 0,
            chargeTotal: 0,
            advanceTotal: 0,
            payableTotal: Number(debitNoteData.items?.reduce((sum, item) => sum + (Number(item.subtotal || 0) + Number(item.taxAmount || 0)), 0) || 0)
        },
        payments: [
            {
                paymentForm: '1',
                paymentMethod: debitNoteData.paymentMeans || debitNoteData.paymentMeanCode || '10',
                paymentDueDate: noteDate
            }
        ],
        discrepancyResponse: {
            correctionConcept: conceptCode
        },
        notes: debitNoteData.notes || ''
    };

    try {
        const response = await alegraClient.post('/debit-notes', payload);
        const debitNote = response.data?.debitNote || response.data || {};
        const accepted = isProviderDocumentAccepted(debitNote);
        return {
            success: accepted,
            data: response.data,
            cude: debitNote.cude || response.data?.cude,
            dianStatus: debitNote.status || response.data?.dianStatus,
            legalStatus: debitNote.legalStatus || null,
            error: accepted ? null : (debitNote.governmentResponse?.errorMessages?.join(' | ') || debitNote.governmentResponse?.message || 'La DIAN rechazó la nota débito')
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// ============================================
// 7. RESOLUCIONES DIAN
// ============================================
const getResolutions = async (companyIdentification) => {
    try {
        const cleanId = (companyIdentification || '').toString().replace(/\D/g, '');
        const response = await alegraClient.get(`/resolutions/${cleanId}`);
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// ============================================
// 8. TABLAS DIAN (Helpers)
// ============================================
const getDianDepartments = async () => {
    try {
        const response = await alegraClient.get('/dian/departments');
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const getDianMunicipalities = async () => {
    try {
        const response = await alegraClient.get('/dian/municipalities');
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

const getDianTaxRegimes = async () => {
    // Alegra no expone /dian/tax-regimes, devolvemos los códigos DIAN estándar
    return {
        success: true,
        data: {
            'tax-regimes': [
                { code: 'O-13', value: 'Gran Contribuyente' },
                { code: 'O-15', value: 'Autorretenedor' },
                { code: 'O-23', value: 'Agente de retención IVA' },
                { code: 'O-47', value: 'Régimen Simple de Tributación' },
                { code: 'O-48', value: 'Responsable de IVA' },
                { code: 'O-49', value: 'No responsable de IVA' },
                { code: 'R-99-PN', value: 'No aplica – Otros' },
            ]
        }
    };
};

const getDianIdentificationTypes = async () => {
    try {
        const response = await alegraClient.get('/dian/identification-types');
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// ============================================
// HELPER: Mapear código de régimen
// ============================================
const mapRegimeCode = (taxResponsibility) => {
    if (!taxResponsibility) return 'R-99-PN';

    // If already a DIAN code, return as-is
    const validCodes = ['O-13', 'O-15', 'O-23', 'O-47', 'O-48', 'O-49', 'R-99-PN'];
    if (validCodes.includes(taxResponsibility)) return taxResponsibility;

    const lower = taxResponsibility.toLowerCase();
    // "no responsable" must be checked before "responsable"
    if (lower.includes('no responsable')) return 'O-49';
    if (lower.includes('responsable') || lower.includes('iva')) return 'O-48';
    if (lower.includes('simple')) return 'O-47';
    if (lower.includes('gran contribuyente')) return 'O-13';
    if (lower.includes('autorretenedor')) return 'O-15';
    if (lower.includes('agente de retención')) return 'O-23';

    return 'R-99-PN'; // Default
};

// ============================================
// NÓMINA ELECTRÓNICA
// ============================================
const getPayrollApiPath = () => process.env.ALEGRA_PAYROLL_API_PATH || '';

const createPayrollElectronicDocument = async (documentData) => {
    const apiPath = getPayrollApiPath();

    if (!apiPath) {
        return {
            success: false,
            error: 'ALEGRA_PAYROLL_API_PATH no está configurado en el servidor'
        };
    }

    try {
        const response = await alegraClient.post(apiPath, documentData);
        const payload = response.data || {};
        const document = payload.data || payload.document || payload;

        return {
            success: true,
            data: payload,
            externalId: document.id || document.uuid || document.documentId || null,
            externalNumber: document.number || document.consecutive || document.documentNumber || null,
            cune: document.cune || document.CUNE || null,
            dianStatus: document.status || document.dianStatus || payload.status || 'ENVIADO',
            trackId: document.trackId || document.dianTrackId || payload.trackId || null
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data || null
        };
    }
};

// ============================================
// 7. DOCUMENTO SOPORTE ELECTRÓNICO (DS)
// ============================================
// Endpoint: POST /e-provider/col/v1/support-documents
// Resolución: cada tenant debe tener su propio rango DS autorizado por DIAN.
// Se carga desde tenants.alegra_ds_resolution_* (distinto al de factura de venta).
//
// Alegra espera en el payload:
//   - resolution  (rango DS autorizado)
//   - company     (el adquiriente = mi empresa, la que emite el DS)
//   - supplier    (el prestador no obligado a facturar)
//   - items, payments, totalAmounts, notes
// ============================================
const buildCompanyBlock = (tenant, sandboxMode, sandboxDefaults) => {
    const companyIdentification = (tenant.tax_id || sandboxDefaults.identificationNumber).split('-')[0].replace(/\D/g, '') || sandboxDefaults.identificationNumber;
    const companyDv = (tenant.tax_id || '').includes('-')
        ? String((tenant.tax_id || '').split('-')[1] || sandboxDefaults.dv)
        : calcularDV(companyIdentification || sandboxDefaults.identificationNumber) || sandboxDefaults.dv;
    return {
        id: tenant.alegra_company_id,
        organizationType: tenant.organization_type || 1,
        identificationType: DOC_TYPE_MAP[tenant.tax_id_type] || '31',
        identificationNumber: sandboxMode ? sandboxDefaults.identificationNumber : companyIdentification,
        dv: sandboxMode ? sandboxDefaults.dv : companyDv,
        name: sandboxMode ? sandboxDefaults.name : (tenant.business_name || tenant.name || 'Empresa'),
        regimeCode: sandboxMode ? sandboxDefaults.regimeCode : mapRegimeCode(tenant.tax_responsibility),
        taxScheme: { id: '01', name: 'IVA' },
        email: sandboxMode ? sandboxDefaults.email : (tenant.email || 'hola2@crumi.com'),
        phone: tenant.phone || '3000000000',
        tradeName: tenant.name || tenant.business_name || 'Empresa',
        address: {
            address: sandboxMode ? sandboxDefaults.address : (tenant.address || 'Calle 1 # 1-1'),
            city: sandboxMode ? sandboxDefaults.city : (tenant.city || '11001'),
            department: sandboxMode ? sandboxDefaults.department : (tenant.state || '11'),
            country: sandboxMode ? sandboxDefaults.country : 'CO',
            postalCode: sandboxMode ? sandboxDefaults.postalCode : (tenant.postal_code || '110111')
        }
    };
};

const buildDsSupplierBlock = (supplier) => {
    const identificationNumber = String(supplier.identification || supplier.identificationNumber || '').replace(/\D/g, '');
    const identificationType = DOC_TYPE_MAP[supplier.identificationType] || supplier.identificationType || '13';
    const dv = identificationType === '31' ? (supplier.dv || calcularDV(identificationNumber)) : undefined;
    return {
        identificationNumber,
        ...(dv ? { dv } : {}),
        identificationType,
        organizationType: supplier.organizationType || (identificationType === '31' ? 1 : 2),
        name: supplier.name || 'Prestador',
        regimeCode: supplier.regimeCode || '49',
        taxScheme: { id: '01', name: 'IVA' },
        email: supplier.email || 'noreply@crumi.com',
        phone: supplier.phone || '0000000000',
        address: {
            address: supplier.address?.address || supplier.address || 'Sin direccion',
            city: supplier.address?.city || supplier.city || '11001',
            department: supplier.address?.department || supplier.department || '11',
            country: supplier.address?.country || 'CO',
            postalCode: supplier.address?.postalCode || supplier.postalCode || '110111'
        }
    };
};

const buildDsResolutionBlock = (tenant, fallbackStartDate) => {
    const toIsoDate = (v) => {
        if (!v) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v).slice(0, 10);
    };
    const resolutionMin = Number(tenant.alegra_ds_resolution_start || 1);
    const resolutionMax = Number(tenant.alegra_ds_resolution_end || 100000);
    return {
        prefix: tenant.alegra_ds_resolution_prefix || 'DS',
        resolutionNumber: tenant.alegra_ds_resolution_number || '',
        minNumber: resolutionMin,
        maxNumber: resolutionMax,
        startDate: toIsoDate(tenant.alegra_ds_resolution_valid_from || fallbackStartDate),
        endDate: toIsoDate(tenant.alegra_ds_resolution_valid_until || fallbackStartDate),
        technicalKey: tenant.alegra_ds_technical_key || 'sandbox'
    };
};

const buildDsItems = (items) => (items || []).map((item, idx) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const subtotal = Number(item.subtotal != null ? item.subtotal : (quantity * unitPrice));
    const taxRate = Number(item.taxRate || 0);
    const taxAmount = Number(item.taxAmount != null ? item.taxAmount : Math.round(subtotal * taxRate) / 100);
    const code = item.code || item.sku || `DSITEM-${idx + 1}`;
    return {
        description: item.description || 'Servicio/compra',
        quantity,
        price: unitPrice,
        code,
        unitCode: item.unitCode || '94',
        subtotal,
        taxAmount,
        standardCode: {
            id: item.standardCode?.id || '999',
            identificationId: item.standardCode?.identificationId || code
        },
        sellersItemIdentification: { id: code },
        taxes: taxRate > 0 ? [{
            taxCode: '01',
            taxPercentage: String(taxRate),
            taxableAmount: subtotal,
            taxAmount
        }] : []
    };
});

const createSupportDocument = async (dsData, context = {}) => {
    // ── MOCK MODE ──
    if (String(process.env.ALEGRA_MOCK_MODE || '').toLowerCase() === 'true') {
        const number = dsData.number || `DS-MOCK-${Date.now()}`;
        const fakeCuds = require('crypto')
            .createHash('sha1')
            .update(`${number}|${dsData.date}|${dsData.total}|${Date.now()}`)
            .digest('hex')
            .toUpperCase()
            .padEnd(96, '0')
            .slice(0, 96);
        console.log(`[Alegra MOCK] DS ${number} devuelve éxito simulado.`);
        return {
            success: true,
            cuds: fakeCuds,
            dianStatus: 'APROBADO_MOCK',
            data: { number, mock: true, message: 'Modo mock: DS no enviado a DIAN real. CUDS generado localmente.' }
        };
    }

    const tenant = context.tenant || {};
    const sandboxMode = !!context.sandboxMode;
    const sandboxDefaults = getSandboxCompanyDefaults(tenant);

    const resolutionMin = Number(tenant.alegra_ds_resolution_start || 1);
    const resolutionMax = Number(tenant.alegra_ds_resolution_end || 100000);
    const cleanNumber = normalizeProviderNumber({
        value: dsData.number,
        sandboxMode,
        minNumber: resolutionMin,
        maxNumber: resolutionMax,
        preferRange: true
    });

    const subtotal = Number(dsData.subtotal || 0);
    const taxTotal = Number(dsData.taxAmount || 0);
    const payable = Number(dsData.total || (subtotal + taxTotal));

    const payload = {
        number: cleanNumber,
        date: dsData.date,
        dueDate: dsData.dueDate || dsData.date,
        documentType: '05', // 05 = Documento Soporte segun codigos DIAN
        operationType: dsData.operationType || '10',
        company: buildCompanyBlock(tenant, sandboxMode, sandboxDefaults),
        resolution: buildDsResolutionBlock(tenant, dsData.date),
        supplier: buildDsSupplierBlock(dsData.supplier || {}),
        items: buildDsItems(dsData.items),
        totalAmounts: {
            grossTotal: subtotal,
            taxableTotal: subtotal,
            taxTotal,
            discountTotal: Number(dsData.discount || 0),
            chargeTotal: 0,
            advanceTotal: 0,
            payableTotal: payable
        },
        payments: [{
            paymentForm: dsData.paymentForm || '1',
            paymentMethod: dsData.paymentMethod || '10',
            paymentDueDate: dsData.dueDate || dsData.date
        }],
        notes: dsData.notes || ''
    };

    try {
        const response = await alegraClient.post('/support-documents', payload);
        const doc = response.data?.supportDocument || response.data || {};
        const accepted = isProviderDocumentAccepted(doc);
        return {
            success: accepted,
            data: response.data,
            cuds: doc.cuds || doc.CUDS || response.data?.cuds,
            dianStatus: doc.status || response.data?.dianStatus,
            legalStatus: doc.legalStatus || null,
            documentId: doc.id || response.data?.id,
            number: cleanNumber,
            error: accepted ? null : (doc.governmentResponse?.errorMessages?.join(' | ') || doc.governmentResponse?.message || 'La DIAN rechazó el documento soporte')
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// Nota de Ajuste al Documento Soporte (anulacion / correccion)
// Endpoint: POST /e-provider/col/v1/adjustment-note-support-documents
const createAdjustmentNoteSupportDocument = async (naData, context = {}) => {
    if (String(process.env.ALEGRA_MOCK_MODE || '').toLowerCase() === 'true') {
        const number = naData.number || `NADS-MOCK-${Date.now()}`;
        const fakeCuds = require('crypto').createHash('sha1')
            .update(`${number}|${naData.date}|${Date.now()}`).digest('hex')
            .toUpperCase().padEnd(96, '0').slice(0, 96);
        console.log(`[Alegra MOCK] NA-DS ${number} devuelve éxito simulado.`);
        return {
            success: true,
            cuds: fakeCuds,
            dianStatus: 'APROBADO_MOCK',
            data: { number, mock: true }
        };
    }

    const tenant = context.tenant || {};
    const sandboxMode = !!context.sandboxMode;
    const sandboxDefaults = getSandboxCompanyDefaults(tenant);

    const subtotal = Number(naData.subtotal || 0);
    const taxTotal = Number(naData.taxAmount || 0);
    const payable = Number(naData.total || (subtotal + taxTotal));

    const payload = {
        number: naData.number,
        prefix: naData.prefix || tenant.alegra_ds_resolution_prefix || 'DS',
        date: naData.date,
        company: buildCompanyBlock(tenant, sandboxMode, sandboxDefaults),
        supplier: buildDsSupplierBlock(naData.supplier || {}),
        invoiceDocumentReference: {
            number: naData.originalNumber,
            cuds: naData.originalCuds,
            issueDate: naData.originalDate
        },
        discrepancies: naData.discrepancies || [{
            reference: '1',
            correctionConceptCode: naData.correctionConceptCode || '1',
            description: naData.reason || 'Anulacion del documento soporte'
        }],
        items: buildDsItems(naData.items),
        totalAmounts: {
            grossTotal: subtotal,
            taxableTotal: subtotal,
            taxTotal,
            discountTotal: 0,
            chargeTotal: 0,
            advanceTotal: 0,
            payableTotal: payable
        },
        payments: [{
            paymentForm: '1',
            paymentMethod: '10',
            paymentDueDate: naData.date
        }],
        notes: naData.notes || naData.reason || ''
    };

    try {
        const response = await alegraClient.post('/adjustment-note-support-documents', payload);
        const doc = response.data?.adjustmentNote || response.data || {};
        const accepted = isProviderDocumentAccepted(doc);
        return {
            success: accepted,
            data: response.data,
            cuds: doc.cuds || doc.CUDS || response.data?.cuds,
            dianStatus: doc.status || response.data?.dianStatus,
            documentId: doc.id || response.data?.id,
            error: accepted ? null : (doc.governmentResponse?.errorMessages?.join(' | ') || 'La DIAN rechazó la nota de ajuste')
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            details: error.response?.data
        };
    }
};

// Descargar PDF/XML del DS electronico emitido
const getSupportDocumentFile = async (documentId, fileType = 'pdf') => {
    try {
        const response = await alegraClient.get(`/support-documents/${documentId}/files/${fileType}`);
        return { success: true, data: response.data };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
    // Empresas
    createCompany,
    getCompany,

    // Set de pruebas
    createTestSet,
    getTestSet,
    getTestSetByGovernmentId,

    // Facturación
    createInvoice,
    getInvoice,

    // Resoluciones
    getResolutions,

    // Notas
    createCreditNote,
    createDebitNote,
    createPayrollElectronicDocument,

    // Documento Soporte Electronico
    createSupportDocument,
    createAdjustmentNoteSupportDocument,
    getSupportDocumentFile,

    // Tablas DIAN
    getDianDepartments,
    getDianMunicipalities,
    getDianTaxRegimes,
    getDianIdentificationTypes,

    // Consulta DIAN
    getAcquirerInfo,
    getCompanyByIdentification,

    // Helpers
    calcularDV,
    mapRegimeCode,
    DOC_TYPE_MAP,
    getPayrollApiPath
};
