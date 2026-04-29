/**
 * Genera XML de prueba para análisis detallado
 * Monto: $4,000 COP base (total ~$4,760 con IVA)
 */
require('dotenv').config();
process.env.DIAN_AMBIENTE = '1';

const fs = require('fs');
const path = require('path');
const { DIAN_CONFIG } = require('./src/config/dianConfig');
const { generateCUFE, buildInvoiceXML } = require('./src/helpers/dianHelper');
const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');

console.log('========================================');
console.log('🔍 ANÁLISIS DE XML PARA DIAN');
console.log('========================================');
console.log('Ambiente:', DIAN_CONFIG.AMBIENTE);
console.log('Prefijo:', DIAN_CONFIG.RESOLUCION.PREFIJO);
console.log('Resolución:', DIAN_CONFIG.RESOLUCION.NUMERO);
console.log('========================================\n');

const run = async () => {
    const consecutivo = Date.now().toString().slice(-5);
    const invoiceNumber = `${DIAN_CONFIG.RESOLUCION.PREFIJO}${consecutivo}`;

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = `${now.toTimeString().split(' ')[0]}-05:00`;

    console.log(`📄 Generando factura: ${invoiceNumber}`);
    console.log(`📅 Fecha: ${date}`);
    console.log(`🕐 Hora: ${time}`);

    // Datos con monto pequeño ($4,000)
    const invoiceData = {
        consecutivo,
        invoiceNumber,
        prefijo: DIAN_CONFIG.RESOLUCION.PREFIJO,
        date,
        time,
        dueDate: date,
        subtotal: 4000,
        taxAmount: 760,
        discountAmount: 0,
        total: 4760,
        paymentMethod: 'Contado',
        paymentMeanCode: '10',
        notes: 'Factura de prueba CRUMI',
        client: {
            name: 'CONSUMIDOR FINAL',
            idNumber: '222222222222',
            docType: '13',
            dv: '0',
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
            item: 'Servicio de Prueba',
            description: 'Prueba facturación CRUMI',
            reference: 'TEST-001',
            quantity: 1,
            unitPrice: 4000,
            lineBase: 4000,
            lineTotal: 4000,
            discount: 0,
            discountVal: 0,
            tax: 19,
            taxVal: 760
        }]
    };

    // Generar CUFE
    const cufeData = {
        invoiceNumber,
        date,
        time,
        subtotal: invoiceData.subtotal,
        taxAmount1: invoiceData.taxAmount,
        taxAmount2: 0,
        taxAmount3: 0,
        total: invoiceData.total,
        nitEmisor: DIAN_CONFIG.EMISOR.NIT,
        tipoDocAdquiriente: invoiceData.client.docType,
        numDocAdquiriente: invoiceData.client.idNumber,
        claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA,
        tipoAmbiente: DIAN_CONFIG.AMBIENTE
    };

    const cufe = generateCUFE(cufeData);
    console.log(`\n🔐 CUFE: ${cufe}`);

    // Generar XML
    let xml = buildInvoiceXML(invoiceData, cufe);

    // Guardar XML sin firmar
    const xmlPath = path.join(__dirname, `test_xml_unsigned_${invoiceNumber}.xml`);
    fs.writeFileSync(xmlPath, xml);
    console.log(`\n📁 XML sin firmar guardado: ${xmlPath}`);

    // Verificar firma
    const signCheck = canSign();
    console.log(`\n🔏 Puede firmar: ${signCheck.canSign}`);
    if (signCheck.canSign) {
        console.log(`   Certificado: ${signCheck.certPath}`);
    }

    // Firmar si es posible
    if (signCheck.canSign) {
        try {
            xml = await signInvoiceXML(xml, signCheck.certPath, process.env.DIAN_CERTIFICADO_PASSWORD);
            const signedPath = path.join(__dirname, `test_xml_signed_${invoiceNumber}.xml`);
            fs.writeFileSync(signedPath, xml);
            console.log(`📁 XML firmado guardado: ${signedPath}`);
        } catch (e) {
            console.error('❌ Error firmando:', e.message);
        }
    }

    // Mostrar estructura del XML
    console.log('\n========================================');
    console.log('📝 ANÁLISIS DE ESTRUCTURA XML:');
    console.log('========================================');

    // Verificar elementos críticos
    const checkElement = (name, pattern) => {
        const match = xml.match(pattern);
        if (match) {
            console.log(`✅ ${name}: ${match[1] || 'OK'}`);
        } else {
            console.log(`❌ ${name}: NO ENCONTRADO`);
        }
    };

    checkElement('UBLVersionID', /<cbc:UBLVersionID>([^<]+)/);
    checkElement('CustomizationID', /<cbc:CustomizationID>([^<]+)/);
    checkElement('ProfileID', /<cbc:ProfileID>([^<]+)/);
    checkElement('ProfileExecutionID', /<cbc:ProfileExecutionID>([^<]+)/);
    checkElement('Invoice ID', /<cbc:ID>([^<]+)/);
    checkElement('UUID (CUFE)', /<cbc:UUID[^>]*>([^<]+)/);
    checkElement('IssueDate', /<cbc:IssueDate>([^<]+)/);
    checkElement('IssueTime', /<cbc:IssueTime>([^<]+)/);
    checkElement('InvoiceTypeCode', /<cbc:InvoiceTypeCode>([^<]+)/);
    checkElement('DocumentCurrencyCode', /<cbc:DocumentCurrencyCode>([^<]+)/);
    checkElement('LineCountNumeric', /<cbc:LineCountNumeric>([^<]+)/);

    console.log('\n--- DIAN Extensions ---');
    checkElement('InvoiceAuthorization', /<sts:InvoiceAuthorization>([^<]+)/);
    checkElement('AuthorizationPeriod StartDate', /<cbc:StartDate>([^<]+)/);
    checkElement('AuthorizationPeriod EndDate', /<cbc:EndDate>([^<]+)/);
    checkElement('Prefix', /<sts:Prefix>([^<]+)/);
    checkElement('From', /<sts:From>([^<]+)/);
    checkElement('To', /<sts:To>([^<]+)/);
    checkElement('ProviderID', /<sts:ProviderID[^>]*>([^<]+)/);
    checkElement('SoftwareID', /<sts:SoftwareID[^>]*>([^<]+)/);
    checkElement('SoftwareSecurityCode', /<sts:SoftwareSecurityCode[^>]*>([^<]+)/);
    checkElement('AuthorizationProviderID', /<sts:AuthorizationProviderID[^>]*>([^<]+)/);

    console.log('\n--- Supplier (Emisor) ---');
    checkElement('Supplier RegistrationName', /<cac:AccountingSupplierParty>[\s\S]*?<cbc:RegistrationName>([^<]+)/);
    checkElement('Supplier CompanyID', /<cac:AccountingSupplierParty>[\s\S]*?<cbc:CompanyID[^>]*>([^<]+)/);

    console.log('\n--- Customer (Cliente) ---');
    checkElement('Customer Name', /<cac:AccountingCustomerParty>[\s\S]*?<cbc:Name>([^<]+)/);
    checkElement('Customer ID', /<cac:AccountingCustomerParty>[\s\S]*?<cbc:CompanyID[^>]*>([^<]+)/);

    console.log('\n--- Totales ---');
    checkElement('TaxAmount', /<cac:TaxTotal>[\s\S]*?<cbc:TaxAmount[^>]*>([^<]+)/);
    checkElement('LineExtensionAmount', /<cbc:LineExtensionAmount[^>]*>([^<]+)/);
    checkElement('PayableAmount', /<cbc:PayableAmount[^>]*>([^<]+)/);

    console.log('\n--- Firma Digital ---');
    checkElement('Signature', /<ds:Signature/);
    checkElement('SignedInfo', /<ds:SignedInfo/);
    checkElement('SignatureValue', /<ds:SignatureValue/);
    checkElement('X509Certificate', /<ds:X509Certificate/);

    console.log('\n✅ Análisis completo. Revisa los archivos XML generados.');
};

run().catch(console.error);
