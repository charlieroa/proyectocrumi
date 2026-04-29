/**
 * Script de prueba que simula el flujo completo del invoiceController
 * usando sendInvoiceToDIAN del dianService
 */
require('dotenv').config();

// Forzar producción
process.env.DIAN_AMBIENTE = '1';

const { sendInvoiceToDIAN } = require('./src/services/dianService');
const { DIAN_CONFIG } = require('./src/config/dianConfig');

console.log('========================================');
console.log('🔴 TEST: Flujo Backend Producción');
console.log('========================================');
console.log('Ambiente:', DIAN_CONFIG.AMBIENTE);
console.log('Prefijo:', DIAN_CONFIG.RESOLUCION.PREFIJO);
console.log('========================================\n');

const testBackendFlow = async () => {
    // Datos exactamente como los enviaría el frontend
    const invoiceData = {
        consecutivo: Date.now().toString().slice(-6), // Número único
        subtotal: 100000,
        taxAmount: 19000,
        discountAmount: 0,
        total: 119000,
        paymentMethod: 'Contado',
        paymentMeanCode: '10',
        notes: 'Factura de prueba backend',
        dueDate: null,
        client: {
            name: 'CONSUMIDOR FINAL',
            idNumber: '222222222222',
            docType: '13',
            email: 'test@crumi.co',
            direccion: 'Carrera 7 No. 71-21',
            ciudad: 'Bogotá',
            departamento: 'Bogotá D.C.',
            codigoMunicipio: '11001',
            codigoDepartamento: '11',
            tipoPersona: '2',
            telefono: '6017654321'
        },
        items: [{
            item: 'Servicio de Software',
            description: 'Licencia mensual CRUMI',
            reference: 'SOFT-001',
            quantity: 1,
            unitPrice: 100000,
            lineBase: 100000,
            discount: 0,
            discountVal: 0,
            tax: 19,
            taxVal: 19000,
            lineTotal: 119000
        }]
    };

    console.log('📤 Enviando factura de prueba a DIAN...');
    console.log('   Consecutivo:', invoiceData.consecutivo);
    console.log('   Total:', invoiceData.total);

    try {
        const result = await sendInvoiceToDIAN(invoiceData);

        console.log('\n========================================');
        console.log('📨 RESULTADO:');
        console.log('========================================');
        console.log('Success:', result.success);
        console.log('Invoice Number:', result.invoiceNumber);
        console.log('CUFE:', result.cufe);
        console.log('Track ID:', result.trackId || 'N/A');
        console.log('ZipKey:', result.zipKey || 'N/A');

        if (result.dianResponse) {
            console.log('\n📦 dianResponse completo:');
            console.log(JSON.stringify(result.dianResponse, null, 2));
        }

        if (result.error) {
            console.log('\n❌ Error:', result.error);
        }

        // Guardar resultado
        const fs = require('fs');
        fs.writeFileSync('backend_flow_result.json', JSON.stringify(result, null, 2));
        console.log('\n✅ Resultado guardado en backend_flow_result.json');

    } catch (e) {
        console.error('💥 Error en flujo:', e.message);
        console.error(e.stack);
    }
};

testBackendFlow();
