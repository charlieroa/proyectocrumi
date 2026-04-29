require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');

const { DIAN_CONFIG, getEndpoint } = require('./src/config/dianConfig');
const { generateCUDE } = require('./src/helpers/dianHelper');
const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');
const { buildCreditNoteXML } = require('./src/helpers/creditNoteTemplate');
const { buildDebitNoteXML } = require('./src/helpers/debitNoteTemplate');

const DOTNET_DLL_PATH = path.join(__dirname, './dian-net-signer/bin/Debug/net8.0/dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, './certificados');

// --- HELPER ZIP ---
const compressXMLToBase64 = (xmlContent, filename) => {
    return new Promise((resolve, reject) => {
        const buffers = [];
        const output = new PassThrough();
        output.on('data', chunk => buffers.push(chunk));
        output.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
        output.on('error', reject);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        archive.append(xmlContent, { name: filename });
        archive.finalize();
    });
};

// --- HELPER SOAP (NET CLIENT) ---
const sendSoap = async (xmlBase64, filename) => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = getEndpoint().URL;
    const testSetId = DIAN_CONFIG.SOFTWARE.TEST_SET_ID;

    // NOTE: Habilitation always uses SendTestSetAsync
    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendTestSetAsync" "${xmlBase64}" "${filename}" "${testSetId}" "${url}"`;

    const { stdout } = await execPromise(cmd, { cwd: __dirname });

    // Parse JSON
    const start = stdout.indexOf("---JSON_START---");
    const end = stdout.indexOf("---JSON_END---");
    if (start === -1) throw new Error("Net Client Error output: " + stdout);
    return JSON.parse(stdout.substring(start + 16, end).trim());
};

// --- MAIN RUNNER ---
(async () => {
    console.log("🚀 INICIANDO ENVÍO DE NOTAS (NC/ND) PARA HABILITACIÓN");

    const REF_INVOICE = 'SETP990004176'; // Una factura que sabemos que enviamos
    const REF_INVOICE_NUM = '990004176';

    // Configuración Base
    const emisor = DIAN_CONFIG.EMISOR;
    const client = {
        name: 'Cliente Prueba Habilitacion',
        idNumber: '222222222222',
        docType: '13',
        dv: '2',
        email: 'test@dian.gov.co',
        tipoPersona: '2',
        ciudad: 'Bogotá',
        departamento: 'Bogotá D.C.',
        codigoMunicipio: '11001',
        codigoDepartamento: '11',
        direccion: 'Calle 123'
    };

    const items = [{
        description: 'Item de prueba nota',
        quantity: 1,
        unitPrice: 1000,
        lineBase: 1000,
        tax: 19,
        taxVal: 190,
        lineTotal: 1000,
        code: 'TEST-01'
    }];

    const subtotal = 1000;
    const taxAmount = 190;
    const total = 1190;

    // ------------------------------------
    // ENVIAR 3 NOTAS CRÉDITO
    // ------------------------------------
    for (let i = 0; i < 3; i++) {
        const rnd = Math.floor(Math.random() * 5000) + 1;
        const noteNum = 990000000 + rnd;
        console.log(`\n📄 [NC ${i + 1}] Generando Nota Crédito ${noteNum}...`);

        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0] + '-05:00';

        const data = {
            noteNumber: noteNum.toString(),
            refInvoiceNumber: REF_INVOICE,
            date, time, items, subtotal, taxAmount, total,
            notes: 'Nota Credito Prueba Habilitacion',
            software: DIAN_CONFIG.SOFTWARE,
            emisor, client, resolucion: DIAN_CONFIG.RESOLUCION,
            pin: DIAN_CONFIG.SOFTWARE.PIN,
            tipoAmbiente: '2',
            numDocAdquiriente: client.idNumber,
            nitEmisor: emisor.NIT
        };

        // CUDE
        const cude = generateCUDE(data);
        // XML
        let xml = buildCreditNoteXML(data, cude);
        // FIRMA
        const { certPath } = canSign();
        xml = await signInvoiceXML(xml, certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

        // ZIP
        const zip = await compressXMLToBase64(xml, `${noteNum}.xml`); // NC suele usar prefijo, pero en SETP es laxo

        // SEND
        try {
            const res = await sendSoap(zip, `${noteNum}.zip`);
            if (res.success && res.dianResponse?.IsValid) console.log("   ✅ ACEPTADA");
            else {
                console.log("   ❌ RECHAZADA");
                console.log(JSON.stringify(res.dianResponse));
            }
        } catch (e) { console.error("   💥 Error envio:", e.message); }

        await new Promise(r => setTimeout(r, 2000));
    }

    // ------------------------------------
    // ENVIAR 3 NOTAS DÉBITO
    // ------------------------------------
    for (let i = 0; i < 3; i++) {
        const rnd = Math.floor(Math.random() * 5000) + 1;
        const noteNum = 990000000 + rnd + 50000; // Offset para no chocar
        console.log(`\n📄 [ND ${i + 1}] Generando Nota Débito ${noteNum}...`);

        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0] + '-05:00';

        const data = {
            noteNumber: noteNum.toString(),
            refInvoiceNumber: REF_INVOICE,
            date, time, items, subtotal, taxAmount, total,
            notes: 'Nota Debito Prueba Habilitacion',
            software: DIAN_CONFIG.SOFTWARE,
            emisor, client, resolucion: DIAN_CONFIG.RESOLUCION,
            pin: DIAN_CONFIG.SOFTWARE.PIN,
            tipoAmbiente: '2',
            numDocAdquiriente: client.idNumber,
            nitEmisor: emisor.NIT
        };

        // CUDE
        const cude = generateCUDE(data);
        // XML
        let xml = buildDebitNoteXML(data, cude); // Usar plantilla Debito
        // FIRMA
        const { certPath } = canSign();
        xml = await signInvoiceXML(xml, certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

        // ZIP
        const zip = await compressXMLToBase64(xml, `${noteNum}.xml`);

        // SEND
        try {
            const res = await sendSoap(zip, `${noteNum}.zip`);
            if (res.success && res.dianResponse?.IsValid) console.log("   ✅ ACEPTADA");
            else {
                console.log("   ❌ RECHAZADA");
                console.log(JSON.stringify(res.dianResponse));
            }
        } catch (e) { console.error("   💥 Error envio:", e.message); }

        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n🏁 Proceso de Notas finalizado.");

})();
