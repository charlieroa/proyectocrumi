/**
 * Envía factura FE3
 * 1. Receptor: CRUMI S.A.S (Auto-factura para descartar error de Consumidor Final)
 * 2. Responsabilidad: O-48 (Responsable de IVA) en lugar de O-47
 * 3. Formato de archivo: Correcto (face_f...)
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
console.log('🔴 FACTURA FE3 - AUTO-ENVÍO + CORRECCIÓN O-48');
console.log('========================================');

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
    const consecutivo = '3'; // FE3
    const invoiceNumber = `${DIAN_CONFIG.RESOLUCION.PREFIJO}${consecutivo}`;
    const dianFilenames = generateDianFilename(DIAN_CONFIG.EMISOR.NIT, consecutivo);

    console.log(`📄 Factura: ${invoiceNumber}`);

    const now = new Date();
    const date = now.toISOString().split('T')[0]; // Debería ser 2026-01-01
    const time = `${now.toTimeString().split(' ')[0]}-05:00`;

    // OVERRIDE: Usar O-48 en lugar de O-47
    // Modificamos DIAN_CONFIG en memoria para este script
    DIAN_CONFIG.RESPONSABILIDADES = ['O-48'];

    // Datos: Auto-factura
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
        notes: 'Factura prueba FE3 - Autoenvio',
        client: {
            // DATOS DEL MISMO EMISOR (CRUMI)
            name: 'CRUMI S.A.S',
            idNumber: '902006720',
            docType: '31', // NIT
            dv: '4',       // DV de 902006720 es 4
            email: 'hola@crumi.ai',
            direccion: 'Centro Empresarial San Roque Oficina 301',
            ciudad: 'Cajicá',
            departamento: 'Cundinamarca',
            codigoMunicipio: '25126',
            codigoDepartamento: '25',
            tipoPersona: '1', // Jurídica
            telefono: '3174379260'
        },
        items: [{
            item: 'Prueba FE3',
            description: 'Prueba Auto-envio O-48',
            reference: 'PROD-003',
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
    let xml = buildInvoiceXML(invoiceData, cufe);

    // HACK: buildInvoiceXML usa DIAN_CONFIG.RESPONSABILIDADES, verificamos si 'O-48' está en XML
    if (!xml.includes('>O-48<')) {
        console.log('⚠️ Reemplazando O-47 por O-48 manualmente en XML...');
        xml = xml.replace('>O-47<', '>O-48<');
    }

    const signCheck = canSign();
    if (!signCheck.canSign) return console.error('No sign');
    xml = await signInvoiceXML(xml, signCheck.certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

    fs.writeFileSync(dianFilenames.xml, xml);

    const zipContent = await compressXMLToBase64(xml, dianFilenames.xml);
    const result = await sendSoap(zipContent, dianFilenames.zip);

    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync('FE3_result.json', JSON.stringify(result, null, 2));

    if (result.success !== false && result.zipKey) {
        console.log('\n✅ FE3 Enviada. ZipKey:', result.zipKey);

        // CHECK IDMEDIATO
        console.log('🔍 Verificando estado...');
        const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12'));
        const p12 = path.join(CERT_DIR, p12File);
        const dotnet = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
        const pwd = process.env.DIAN_CERTIFICADO_PASSWORD;
        const cmdStatus = `dotnet "${dotnet}" "${p12}" "${pwd}" "GetStatus" "${result.zipKey}" "dummy" "null" "https://vpfe.dian.gov.co/WcfDianCustomerServices.svc"`;

        try {
            const { stdout } = await execPromise(cmdStatus, { timeout: 60000 });
            console.log(stdout);
        } catch (e) { console.error(e.message); }
    }
};

run().catch(console.error);
