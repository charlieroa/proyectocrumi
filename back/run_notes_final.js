require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');

// Imports
const { DIAN_CONFIG, getEndpoint } = require('./src/config/dianConfig');
const { generateCUDE } = require('./src/helpers/dianHelper');
const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');
const { buildCreditNoteXML } = require('./src/helpers/creditNoteTemplate');
const { buildDebitNoteXML } = require('./src/helpers/debitNoteTemplate');

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

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

const sendSoap = async (xmlBase64, filename) => {
    try {
        const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
        if (!p12File) throw new Error("No P12 found in " + CERT_DIR);

        const p12Path = path.join(CERT_DIR, p12File);
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;
        const url = getEndpoint().URL;
        const testSetId = DIAN_CONFIG.SOFTWARE.TEST_SET_ID;

        const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendTestSetAsync" "${xmlBase64}" "${filename}" "${testSetId}" "${url}"`;

        const { stdout } = await execPromise(cmd, { cwd: __dirname });

        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start === -1) throw new Error("Net Client Error output (" + stdout.length + "): " + stdout.substring(0, 200));
        return JSON.parse(stdout.substring(start + 16, end).trim());
    } catch (e) {
        throw new Error("SOAP Error: " + e.message);
    }
};

(async () => {
    console.log("🚀 STARTING NOTES...");
    try {
        const REF_INVOICE = 'SETP990004176'; // Refija o random
        const emisor = DIAN_CONFIG.EMISOR;
        const client = {
            name: 'Cliente Habilitacion', idNumber: '222222222222', docType: '13', dv: '2',
            city: 'Bogota', departamento: 'Bogota D.C.', codigoMunicipio: '11001', codigoDepartamento: '11', direccion: 'Calle 123', email: 'a@a.com'
        };
        const items = [{
            description: 'Item Test', quantity: 1, unitPrice: 1000, lineBase: 1000, lineTotal: 1000,
            tax: 19, taxVal: 190, code: 'TEST1'
        }];
        const subtotal = 1000, taxAmount = 190, total = 1190;

        // Loop 5 NC
        for (let i = 0; i < 5; i++) {
            const noteNum = (990010000 + Math.floor(Math.random() * 10000)).toString();
            console.log(`\n📄 Generando NC ${noteNum}...`);

            const data = {
                noteNumber: noteNum, refInvoiceNumber: REF_INVOICE,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0] + '-05:00',
                items, subtotal, taxAmount, total, notes: 'Test Habilitacion',
                software: DIAN_CONFIG.SOFTWARE, emisor, client, resolucion: DIAN_CONFIG.RESOLUCION,
                pin: DIAN_CONFIG.SOFTWARE.PIN, tipoAmbiente: '2', numDocAdquiriente: client.idNumber, nitEmisor: emisor.NIT
            };

            const cude = generateCUDE(data);
            let xml = buildCreditNoteXML(data, cude);

            // Sign
            const { certPath } = canSign();
            xml = await signInvoiceXML(xml, certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

            // Zip & Send
            const zip = await compressXMLToBase64(xml, `${noteNum}.xml`);
            const res = await sendSoap(zip, `${noteNum}.zip`);

            if (res.success && res.dianResponse?.IsValid) console.log("   ✅ ACEPTADA");
            else console.error("   ❌ RECHAZADA:", JSON.stringify(res));

            await new Promise(r => setTimeout(r, 1500));
        }

        // Loop 5 ND
        for (let i = 0; i < 5; i++) {
            const noteNum = (990020000 + Math.floor(Math.random() * 10000)).toString();
            console.log(`\n📄 Generando ND ${noteNum}...`);

            const data = {
                noteNumber: noteNum, refInvoiceNumber: REF_INVOICE,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0] + '-05:00',
                items, subtotal, taxAmount, total, notes: 'Test Habilitacion',
                software: DIAN_CONFIG.SOFTWARE, emisor, client, resolucion: DIAN_CONFIG.RESOLUCION,
                pin: DIAN_CONFIG.SOFTWARE.PIN, tipoAmbiente: '2', numDocAdquiriente: client.idNumber, nitEmisor: emisor.NIT
            };

            const cude = generateCUDE(data);
            let xml = buildDebitNoteXML(data, cude);

            const { certPath } = canSign();
            xml = await signInvoiceXML(xml, certPath, process.env.DIAN_CERTIFICADO_PASSWORD);

            const zip = await compressXMLToBase64(xml, `${noteNum}.xml`);
            const res = await sendSoap(zip, `${noteNum}.zip`);

            if (res.success && res.dianResponse?.IsValid) console.log("   ✅ ACEPTADA");
            else console.error("   ❌ RECHAZADA:", JSON.stringify(res));

            await new Promise(r => setTimeout(r, 1500));
        }

    } catch (e) {
        console.error("💥 CRASH:", e.stack);
    }
})();
