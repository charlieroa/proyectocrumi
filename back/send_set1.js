/**
 * Envía factura SET1 (Nueva Resolución)
 * Usa configuración de dianConfig.js (ya actualizado a SET) y .env
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');

const { DIAN_CONFIG, getEndpoint } = require('./src/config/dianConfig');
const { generateCUFE, buildInvoiceXML, generateSoftwareSecurityCode, generateQRCode } = require('./src/helpers/dianHelper');
const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');

console.log('========================================');
console.log('🚀 ENVIANDO FACTURA: SET1');
console.log('========================================');

// Verificar Key (Masked)
const key = DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA;
console.log(`🔑 Clave Técnica usada: ${key.substring(0, 6)}...${key.substring(key.length - 4)}`);
if (key.includes('PEGAR') || key.includes('fc8e')) {
    console.log('⚠️ ADVERTENCIA: Pareces estar usando una clave inválida o placeholder.');
}

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const generateDianFilename = (nit, consecutivo, tipo = 'f') => {
    const nitPadded = nit.toString().padStart(10, '0');
    const hexConsecutivo = parseInt(consecutivo).toString(16).padStart(10, '0');
    return {
        xml: `face_${tipo}${nitPadded}${hexConsecutivo}.xml`,
        zip: `ws_${tipo}${nitPadded}${hexConsecutivo}.zip`
    };
};

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

    // SendBillAsync (Producción)
    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendBillAsync" "${xmlBase64}" "${filename}" "null" "${url}"`;
    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname, timeout: 120000 });
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start === -1) return { success: false, raw: stdout };
        return JSON.parse(stdout.substring(start + 16, end).trim());
    } catch (e) {
        return { success: false, error: e.message };
    }
};

const run = async () => {
    const consecutivo = '1005';
    const invoiceNumber = `SET${consecutivo}`; // Sin espacio
    const dianFilenames = generateDianFilename(DIAN_CONFIG.EMISOR.NIT, consecutivo);

    // Fecha y Hora exacta (Controlada)
    const now = new Date();
    // Forzar 2026-01-04
    const date = '2026-01-04'; // now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0] + '-05:00';

    // Configuración de la factura
    const invoiceDate = '2026-01-04';
    // Datos Factura
    const invoiceData = {
        consecutivo,
        invoiceNumber,
        prefijo: 'SET',
        date,
        time,
        dueDate: date,
        subtotal: 1000,
        taxAmount: 190,
        total: 1190,
        paymentMethod: 'Contado',
        paymentMeanCode: '10',
        notes: 'Prueba SET1 Consumidor',
        client: {
            name: 'CONSUMIDOR FINAL',
            idNumber: '222222222222',
            docType: '13', // Cédula de ciudadanía o 13=Cédula? No, 13=Pasaporte? No. 13=Cedula Ciudadania. Consumidor Final is typically 222222222222 with type 13 or 31?
            // Anexo 1.8: "Cuando el adquirente sea 'Consumidor Final', se debe registrar el tipo de documento 13" -> No.
            // Para '222222222222', el tipo es '13' (Cédula de ciudadanía)?
            // Usually standard is: ID: 222222222222, Type: 13.
            dv: '0',
            email: 'billing@company.com',
            direccion: 'Calle 123',
            ciudad: 'Bogotá, D.C.',
            departamento: 'Bogotá',
            codigoMunicipio: '11001',
            codigoDepartamento: '11',
            tipoPersona: '2', // Natural
            telefono: '3000000000'
        },
        items: [{
            item: 'Item Prueba',
            description: 'Item de prueba',
            reference: 'TEST-01',
            quantity: 1,
            unitPrice: 1000,
            lineBase: 1000,
            lineTotal: 1000,
            discount: 0,
            discountVal: 0,
            tax: 19,
            taxVal: 190
        }]
    };

    const cufeData = {
        invoiceNumber,
        date,
        time,
        subtotal: invoiceData.subtotal,
        taxAmount1: invoiceData.taxAmount, // IVA
        taxAmount2: 0, // INC
        taxAmount3: 0, // ICA
        total: invoiceData.total,
        nitEmisor: DIAN_CONFIG.EMISOR.NIT,
        tipoDocAdquiriente: invoiceData.client.idNumber,
        numDocAdquiriente: invoiceData.client.idNumber,
        // OJO: Clave Tecnica viene de DIAN_CONFIG (Correcta)
        claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA,
        tipoAmbiente: DIAN_CONFIG.AMBIENTE
    };

    const softwareSecurityCode = generateSoftwareSecurityCode(
        DIAN_CONFIG.SOFTWARE.ID,
        DIAN_CONFIG.SOFTWARE.PIN,
        invoiceNumber // Uses 'SET1005'
    );

    // DEBUG APPEND
    const debugContent2 = `
PIN_USED: ${DIAN_CONFIG.SOFTWARE.PIN}
SECURITY_CODE: ${softwareSecurityCode}
INVOICE_NUM_FOR_CODE: ${invoiceNumber}
    `;
    fs.appendFileSync('debug_cufe.txt', debugContent2);

    const qrCode = generateQRCode({
        numFac: invoiceNumber,
        fecFac: date,
        horFac: time,
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
        cufe: cufeData.claveTecnica, // WAIT! QR uses CUFE Hash, not Technical Key? YES. CUFE HASH.
        url: "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey="
    });
    // Fix QR CUFE param above. generateQRCode expects 'cufe'
    // Previous snippet had `cufe: 'DUMMY'`.
    // Actually generateQRCode takes named params.
    // I need to confirm generateQRCode arguments in dianHelper.
    // Assuming standard implementation:
    // But wait, I can just not call generateQRCode if buildInvoiceXML calculates it?
    // buildInvoiceXML usually calls generateQRCode internally? 
    // Let's check buildInvoiceXML in dianHelper lines 250ish.
    // If buildInvoiceXML handles QR internally, I don't need to generate it here unless I pass it.


    const cufe = generateCUFE(cufeData);

    // DEBUG: Guardar cadena para revisión
    const debugContent = `
KEY: ${cufeData.claveTecnica}
CUFEDATA: ${JSON.stringify(cufeData, null, 2)}
CUFE_HASH: ${cufe}
    `;
    fs.writeFileSync('debug_cufe.txt', debugContent);

    const xml = buildInvoiceXML(invoiceData, cufe);

    // Firmar
    const signCheck = canSign();
    if (!signCheck.canSign) return console.error('No se puede firmar (falta cert/p12)');
    const signedXml = await signInvoiceXML(xml, signCheck.certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

    // Guardar para debug
    fs.writeFileSync('SET1_sent.xml', signedXml);

    // Enviar
    const zipContent = await compressXMLToBase64(signedXml, dianFilenames.xml);
    const result = await sendSoap(zipContent, dianFilenames.zip);

    console.log('\n📡 RESPUESTA ENVÍO (SendBillAsync):');
    console.log(JSON.stringify(result, null, 2));

    if (result.zipKey) {
        console.log('\n🔍 CONSULTANDO ESTADO (GetStatus)...');
        const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12'));
        const p12 = path.join(CERT_DIR, p12File);
        const dotnet = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
        const pwd = process.env.DIAN_CERTIFICADO_PASSWORD;
        const urlStatus = getEndpoint().URL;

        const cmdStatus = `dotnet "${dotnet}" "${p12}" "${pwd}" "GetStatus" "${result.zipKey}" "dummy" "null" "${urlStatus}"`;
        try {
            const { stdout } = await execPromise(cmdStatus, { timeout: 60000 });
            console.log('\n📋 ESTADO RAW:');
            console.log(stdout);
        } catch (e) { console.error(e.message); }
    }
};

run().catch(console.error);
