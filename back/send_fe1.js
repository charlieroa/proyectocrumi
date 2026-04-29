/**
 * Envía la primera factura de producción: FE1
 * Monto: $4,000 COP base (total $4,760 con IVA)
 */
require('dotenv').config();
process.env.DIAN_AMBIENTE = '1';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');

const { DIAN_CONFIG, getEndpoint } = require('./src/config/dianConfig');
const { generateCUFE, buildInvoiceXML } = require('./src/helpers/dianHelper');
const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');

console.log('========================================');
console.log('🔴 ENVIANDO PRIMERA FACTURA: FE1');
console.log('========================================');
console.log('Ambiente:', DIAN_CONFIG.AMBIENTE);
console.log('Endpoint:', getEndpoint().URL);
console.log('========================================\n');

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const compressXMLToBase64 = (xmlContent, filename) => {
    return new Promise((resolve, reject) => {
        const buffers = [];
        const output = new PassThrough();
        output.on('data', c => buffers.push(c));
        output.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
        output.on('error', reject);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        archive.append(xmlContent, { name: filename });
        archive.finalize();
    });
};

const sendSoap = async (xmlBase64, filename) => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = getEndpoint().URL;

    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendBillAsync" "${xmlBase64}" "${filename}" "null" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname, timeout: 120000, maxBuffer: 20 * 1024 * 1024 });
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start === -1) return { success: false, message: "NET ERROR: " + stdout };
        return JSON.parse(stdout.substring(start + 16, end).trim());
    } catch (e) {
        return { success: false, error: e.message };
    }
};

const run = async () => {
    // CONSECUTIVO = 1 (primera factura de la resolución)
    const consecutivo = '1';
    const invoiceNumber = `${DIAN_CONFIG.RESOLUCION.PREFIJO}${consecutivo}`;

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = `${now.toTimeString().split(' ')[0]}-05:00`;

    console.log(`📄 Factura: ${invoiceNumber}`);
    console.log(`📅 Fecha: ${date}`);
    console.log(`💰 Total: $4,760 COP (base $4,000 + IVA $760)`);

    // Datos de la factura - MONTO PEQUEÑO
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
        notes: 'Factura electronica CRUMI',
        client: {
            name: 'CONSUMIDOR FINAL',
            idNumber: '222222222222',
            docType: '13',
            dv: '0',
            email: 'consumidor@crumi.co',
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
            description: 'Factura de prueba produccion',
            reference: 'PROD-001',
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

    // Verificar firma
    const signCheck = canSign();
    if (!signCheck.canSign) {
        console.error('❌ No se puede firmar:', signCheck.reason);
        return;
    }

    // Firmar
    console.log('\n🔏 Firmando XML...');
    try {
        xml = await signInvoiceXML(xml, signCheck.certPath, process.env.DIAN_CERTIFICADO_PASSWORD);
    } catch (e) {
        console.error('❌ Error firmando:', e.message);
        return;
    }

    // Guardar XML firmado
    fs.writeFileSync(`FE1_signed.xml`, xml);
    console.log('📁 XML firmado guardado: FE1_signed.xml');

    // Comprimir y enviar
    console.log('\n📤 Enviando a DIAN producción...');
    const zipContent = await compressXMLToBase64(xml, `${invoiceNumber}.xml`);
    const result = await sendSoap(zipContent, `${invoiceNumber}.zip`);

    console.log('\n========================================');
    console.log('📨 RESPUESTA DIAN:');
    console.log('========================================');
    console.log(JSON.stringify(result, null, 2));

    // Guardar resultado
    fs.writeFileSync('FE1_result.json', JSON.stringify(result, null, 2));

    if (result.success) {
        console.log('\n✅ FACTURA FE1 ENVIADA EXITOSAMENTE');
        console.log('   ZipKey:', result.zipKey);
        console.log('   Document Key:', result.documentKey);
    } else {
        console.log('\n❌ ERROR EN ENVÍO');
        console.log('   Mensaje:', result.message || result.error);
    }
};

run().catch(console.error);
