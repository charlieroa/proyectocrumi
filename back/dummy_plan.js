const { v4: uuidv4 } = require('uuid');
const dianService = require('./src/services/dianService');
const invoiceController = require('./src/controllers/invoiceController'); // Reuse logic if possible, or manual
const DIAN_CONFIG = require('./src/config/dianConfig');

// DATA PARA FACTURA SET99
const invoiceData = {
    number: 99, // SET99
    date: '2026-01-02',
    time: '12:00:00',
    total: 15000.00,
    subtotal: 12605.04,
    taxAmount: 2394.96,
    client: {
        name: 'CONSUMIDOR FINAL',
        idType: '13',
        idNumber: '222222222222',
        email: 'billing@company.com'
    }
    // ... items would be generated inside service or mocked here
    // For simplicity, we use the service "createAndSignInvoice" if it accepts this data
};

const run = async () => {
    console.log(`🚀 Iniciando prueba de envío factura SET${invoiceData.number} (Producción)...`);

    // Verificamos Config
    console.log('Resolución:', DIAN_CONFIG.RESOLUCION.NUMERO);
    console.log('Prefijo:', DIAN_CONFIG.RESOLUCION.PREFIJO);
    console.log('Clave Técnica:', DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA);

    try {
        // Necesitamos construir el XML completo. Reutilizamos lógica de send_set1.js pero cambiando el numero
        // Copiando lo esencial de send_set1.js
        const { getSoftwareSecurityCode, getQRCode, generateCUFE } = require('./src/helpers/dianHelper');
        const fs = require('fs');
        const path = require('path');
        const { exec } = require('child_process');

        // 1. Datos CUFE
        const prefijo = DIAN_CONFIG.RESOLUCION.PREFIJO;
        const numFactura = `${prefijo}${invoiceData.number}`;
        const cufeData = {
            invoiceNumber: numFactura,
            date: invoiceData.date,
            time: invoiceData.time + '-05:00',
            subtotal: invoiceData.subtotal,
            taxAmount1: invoiceData.taxAmount, // IVA
            total: invoiceData.total,
            nitEmisor: DIAN_CONFIG.EMISOR.NIT,
            tipoDocAdquiriente: invoiceData.client.idNumber, // Ojo: Consumidor final 222...
            numDocAdquiriente: invoiceData.client.idNumber,
            claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA,
            tipoAmbiente: DIAN_CONFIG.AMBIENTE
        };

        const cufe = generateCUFE(cufeData);
        console.log('🔑 CUFE Generado:', cufe);

        const softwareSecurityCode = getSoftwareSecurityCode(
            DIAN_CONFIG.SOFTWARE.ID,
            DIAN_CONFIG.SOFTWARE.PIN,
            numFactura
        );

        const qrCode = getQRCode({
            numFac: numFactura,
            fecFac: invoiceData.date,
            horFac: invoiceData.time + '-05:00', // Update 2026: format might need offset
            valFac: invoiceData.subtotal,
            codImp1: '01',
            valImp1: invoiceData.taxAmount,
            valImp2: '04',
            valImp2: 0,
            valImp3: '03',
            valImp3: 0,
            valTot: invoiceData.total,
            nitOfe: DIAN_CONFIG.EMISOR.NIT,
            numAdq: invoiceData.client.idNumber,
            cufe: cufe,
            url: "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=" // Base URL
        });

        // 2. Generar XML (Simplificado, usando template string o funcion helper si existe)
        // Para asegurar consistencia, voy a leer el XML de send_set1.js y reemplazar valores.
        // Es un hack rápido pero efectivo.

        /* 
           NOTA: Como no tengo el XML builder a mano en este script, 
           voy a asumir que el usuario prefiere que modifique send_set1.js para que use el número 99 
           en lugar de reescribir todo el logic de XML aqui.
           
           Mejor estrategia: Modificar send_set1.js para aceptar un argumento de Numero o hardcodearlo a 99.
        */

    } catch (error) {
        console.error('Error:', error);
    }
};

// Instead of this script, I will modify send_set1.js to use consecutive 99
console.log("Switching strategy: Modifying send_set1.js to use SET99");
