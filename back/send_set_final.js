/**
 * Envía factura SET1010 (Prueba Final)
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
const { generateCUFE, buildInvoiceXML, generateSoftwareSecurityCode } = require('./src/helpers/dianHelper');
const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');

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
    // FORCE CONFIG OVERRIDE (Protección contra .env sucio)
    DIAN_CONFIG.SOFTWARE.PIN = '10226';
    DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA = '85cfe5435c77853e84caaa79e14216a9c68c21';
    DIAN_CONFIG.RESOLUCION.NUMERO = '18764104177257';

    const consecutivo = '1010'; // SAME NUMBER
    const invoiceNumber = consecutivo; // NO PREFIX 'SET'
    const dianFilenames = generateDianFilename(DIAN_CONFIG.EMISOR.NIT, consecutivo);

    const now = new Date();
    const date = '2026-01-04'; // Today
    const time = '12:00:00-05:00'; // HARDCODED FIXED TIME

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
        notes: 'Prueba SET1010',
        client: {
            name: 'CONSUMIDOR FINAL',
            idNumber: '222222222222',
            docType: '13',
            dv: '0',
            email: 'billing@company.com',
            direccion: 'Calle 123',
            ciudad: 'Bogotá, D.C.',
            departamento: 'Bogotá',
            codigoMunicipio: '11001',
            codigoDepartamento: '11',
            tipoPersona: '2',
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

    // Generate UPPERCASE Security Code
    const rawSecCode = generateSoftwareSecurityCode(
        DIAN_CONFIG.SOFTWARE.ID,
        DIAN_CONFIG.SOFTWARE.PIN,
        invoiceNumber
    );
    const secCodeUpper = rawSecCode.toUpperCase();
    console.log(`DEBUG: Security Code (Upper): ${secCodeUpper}`);

    // Inject into invoiceData for dianHelper to use
    invoiceData.softwareSecurityCode = secCodeUpper;

    const cufeData = {
        invoiceNumber,
        date,
        time,
        subtotal: invoiceData.subtotal,
        taxAmount1: invoiceData.taxAmount, // IVA
        taxAmount2: 0,
        taxAmount3: 0,
        total: invoiceData.total,
        nitEmisor: DIAN_CONFIG.EMISOR.NIT,
        tipoDocAdquiriente: invoiceData.client.idNumber,
        numDocAdquiriente: invoiceData.client.idNumber,
        claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA.toUpperCase(), // Convert claveTecnica to uppercase
        tipoAmbiente: DIAN_CONFIG.AMBIENTE
    };

    // DEBUG LOG
    const cufe = generateCUFE(cufeData).toUpperCase(); // Convert CUFE to uppercase
    console.log(`DEBUG: CUFE Hash: ${cufe}`);
    console.log(`DEBUG: Key: ${cufeData.claveTecnica}`);

    // Build XML (Internal generation of QR/SecCode)
    const xml = buildInvoiceXML(invoiceData, cufe);

    // Sign
    const signCheck = canSign();
    if (!signCheck.canSign) return console.error('No se puede firmar');
    const signedXml = await signInvoiceXML(xml, signCheck.certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

    // Save
    fs.writeFileSync('SET1010_sent.xml', signedXml);

    // Send
    const zipContent = await compressXMLToBase64(signedXml, dianFilenames.xml);
    const result = await sendSoap(zipContent, dianFilenames.zip);

    console.log('\n📡 RESPUESTA:');
    console.log(JSON.stringify(result, null, 2));

    // Get Status
    if (result.zipKey) {
        console.log('\n🔍 CONSULTANDO ESTADO...');
        const p12Path = path.join(CERT_DIR, fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12')));
        const cmdStatus = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${process.env.DIAN_CERTIFICADO_PASSWORD}" "GetStatus" "${result.zipKey}" "dummy" "null" "${getEndpoint().URL}"`;
        try {
            const { stdout } = await execPromise(cmdStatus, { timeout: 60000 });
            console.log(stdout); // Contains RAW XML
        } catch (e) { console.error(e.message); }
    }
};

run().catch(console.error);
