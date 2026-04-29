// src/config/dianConfig.js
// Configuración para Facturación Electrónica DIAN Colombia - LIVE

require('dotenv').config();

const DIAN_CONFIG = {
    // ============================================
    // AMBIENTE (1 = Producción, 2 = Habilitación/Pruebas)
    // ============================================
    AMBIENTE: process.env.DIAN_AMBIENTE || '2',

    // ============================================
    // ENDPOINTS DIAN
    // ============================================
    ENDPOINTS: {
        // Ambiente de Habilitación (Pruebas)
        HABILITACION: {
            WSDL: 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl',
            URL: 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc'
        },
        // Ambiente de Producción
        PRODUCCION: {
            WSDL: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc?wsdl',
            URL: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc'
        }
    },

    // ============================================
    // DATOS DEL SOFTWARE (Set de Pruebas DIAN)
    // ============================================
    SOFTWARE: {
        ID: process.env.DIAN_SOFTWARE_ID || '2e596e42-daf8-48ef-83d8-b6e9d02c090e',
        PIN: process.env.DIAN_PIN || '10226',
        // Clave Válida (Producción 1001-5000) - HARDCODED to bypass .env
        CLAVE_TECNICA: '85cfe5435c77853e84caaa79e14216a9c68c21',
        TEST_SET_ID: process.env.DIAN_TEST_SET_ID || 'ed07049c-361b-437e-8d26-b8440959db15'
    },

    // ============================================
    // DATOS DE RESOLUCIÓN DE NUMERACIÓN
    // ============================================
    RESOLUCION: {
        // En Producción (1) usa valores de producción. En Pruebas (2), usa valores de prueba.
        NUMERO: (process.env.DIAN_AMBIENTE === '1') ? (process.env.DIAN_RESOLUCION || '18764104177257') : '18760000001',
        PREFIJO: (process.env.DIAN_AMBIENTE === '1') ? (process.env.DIAN_PREFIJO || 'SET') : 'SETP',
        RANGO_DESDE: (process.env.DIAN_AMBIENTE === '1') ? (process.env.DIAN_RANGO_DESDE || '1001') : '990000000',
        RANGO_HASTA: (process.env.DIAN_AMBIENTE === '1') ? (process.env.DIAN_RANGO_HASTA || '5000') : '995000000',
        FECHA_DESDE: (process.env.DIAN_AMBIENTE === '1') ? (process.env.DIAN_FECHA_DESDE || '2026-01-02') : '2019-01-19',
        FECHA_HASTA: (process.env.DIAN_AMBIENTE === '1') ? (process.env.DIAN_FECHA_HASTA || '2028-01-02') : '2030-01-19'
    },

    // ============================================
    // DATOS DEL EMISOR (Crumi S.A.S)
    // ============================================
    EMISOR: {
        NIT: process.env.DIAN_NIT_EMISOR || '902006720',
        DV: process.env.DIAN_DV_EMISOR || '1', // Dígito de verificación (calcular)
        TIPO_DOCUMENTO: '31', // 31 = NIT
        TIPO_PERSONA: '1', // 1 = Jurídica, 2 = Natural
        REGIMEN: '48', // 48 = Responsable de IVA, 49 = No responsable
        RAZON_SOCIAL: process.env.DIAN_RAZON_SOCIAL || 'BOLTI S.A.S',
        NOMBRE_COMERCIAL: process.env.DIAN_NOMBRE_COMERCIAL || 'BOLTI',

        // Ubicación
        DIRECCION: process.env.DIAN_DIRECCION || 'Centro Empresarial San Roque Oficina 301',
        CIUDAD: process.env.DIAN_CIUDAD || 'Cajicá',
        DEPARTAMENTO: process.env.DIAN_DEPARTAMENTO || 'Cundinamarca',
        CODIGO_MUNICIPIO: process.env.DIAN_CODIGO_MUNICIPIO || '25126', // Código DANE Cajicá
        CODIGO_DEPARTAMENTO: process.env.DIAN_CODIGO_DEPARTAMENTO || '25', // Código DANE Cundinamarca
        PAIS: 'CO',

        // Contacto
        TELEFONO: process.env.DIAN_TELEFONO || '3174379260',
        EMAIL: process.env.DIAN_EMAIL || 'hola@crumi.ai',

        // Responsabilidades fiscales
        RESPONSABILIDADES: ['O-47'] // O-47 = Régimen Simple, O-48 = IVA, etc.
    },

    // ============================================
    // TIPOS DE DOCUMENTO ELECTRÓNICO
    // ============================================
    TIPOS_DOCUMENTO: {
        FACTURA_VENTA: '01',
        FACTURA_EXPORTACION: '02',
        FACTURA_CONTINGENCIA: '03',
        NOTA_CREDITO: '91',
        NOTA_DEBITO: '92'
    },

    // ============================================
    // CÓDIGOS DE IMPUESTOS
    // ============================================
    IMPUESTOS: {
        IVA: {
            ID: '01',
            NOMBRE: 'IVA',
            PORCENTAJE_GENERAL: 19
        },
        INC: {
            ID: '04',
            NOMBRE: 'INC',
            PORCENTAJE_GENERAL: 8
        },
        ICA: {
            ID: '03',
            NOMBRE: 'ICA'
        }
    },

    // ============================================
    // MÉTODOS DE PAGO DIAN
    // ============================================
    METODOS_PAGO: {
        CONTADO: '1',
        CREDITO: '2'
    },

    MEDIOS_PAGO: {
        EFECTIVO: '10',
        CHEQUE: '20',
        TRANSFERENCIA: '31',
        CONSIGNACION: '42',
        TARJETA_DEBITO: '47',
        TARJETA_CREDITO: '48',
        BONOS: '49',
        MUTUO_ACUERDO: 'ZZZ'
    }
};

// Función auxiliar para calcular dígito de verificación del NIT
const calcularDV = (nit) => {
    const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    const nitStr = nit.toString().padStart(15, '0');
    let suma = 0;

    for (let i = 0; i < 15; i++) {
        suma += parseInt(nitStr[14 - i]) * primos[i];
    }

    const residuo = suma % 11;
    return residuo > 1 ? 11 - residuo : residuo;
};

// Calcular DV del emisor si no está configurado
if (!process.env.DIAN_DV_EMISOR) {
    DIAN_CONFIG.EMISOR.DV = calcularDV(DIAN_CONFIG.EMISOR.NIT).toString();
}

// Función para obtener el endpoint según el ambiente
const getEndpoint = () => {
    return DIAN_CONFIG.AMBIENTE === '1'
        ? DIAN_CONFIG.ENDPOINTS.PRODUCCION
        : DIAN_CONFIG.ENDPOINTS.HABILITACION;
};

module.exports = {
    DIAN_CONFIG,
    calcularDV,
    getEndpoint
};