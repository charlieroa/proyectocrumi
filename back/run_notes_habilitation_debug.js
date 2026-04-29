console.log("🚀 Debugging Script Start...");

try {
    require('dotenv').config();
    const fs = require('fs');
    const path = require('path');
    const util = require('util');
    const { exec } = require('child_process');
    const execPromise = util.promisify(exec);
    const archiver = require('archiver'); // Test import
    const { PassThrough } = require('stream');

    console.log("✅ Modules imported.");

    const { DIAN_CONFIG, getEndpoint } = require('./src/config/dianConfig');
    const { generateCUDE } = require('./src/helpers/dianHelper');
    const { signInvoiceXML, canSign } = require('./src/helpers/xadesEpesHelper');
    const { buildCreditNoteXML } = require('./src/helpers/creditNoteTemplate');
    const { buildDebitNoteXML } = require('./src/helpers/debitNoteTemplate');

    console.log("✅ Custom helpers imported.");

    const DOTNET_DLL_PATH = path.join(__dirname, './dian-net-signer/bin/Debug/net8.0/dian-net-signer.dll');
    const CERT_DIR = path.join(__dirname, './certificados');

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
        // ... (Same implementation)
        const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
        const p12Path = path.join(CERT_DIR, p12File);
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;
        const url = getEndpoint().URL;
        const testSetId = DIAN_CONFIG.SOFTWARE.TEST_SET_ID;
        const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendTestSetAsync" "${xmlBase64}" "${filename}" "${testSetId}" "${url}"`;
        const { stdout } = await execPromise(cmd, { cwd: __dirname });
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start === -1) throw new Error("Net Client Error output: " + stdout);
        return JSON.parse(stdout.substring(start + 16, end).trim());
    };

    (async () => {
        console.log("🚀 Main logic start");

        try {
            // ... (Simplified logic for test)
            const REF_INVOICE = 'SETP990004176';
            const dataKey = { // Minimal Data Mock
                noteNumber: '990009999',
                refInvoiceNumber: REF_INVOICE,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0] + '-05:00',
                items: [{ description: 'test', quantity: 1, unitPrice: 1000, lineTotal: 1000, lineBase: 1000, tax: 19, taxVal: 190, code: 'T1' }],
                subtotal: 1000, taxAmount: 190, total: 1190,
                notes: 'Test',
                software: DIAN_CONFIG.SOFTWARE,
                emisor: DIAN_CONFIG.EMISOR,
                client: { name: 'Test', idNumber: '222222222222', docType: '13', dv: '2', city: 'Bog', depto: 'Bog' },
                resolucion: DIAN_CONFIG.RESOLUCION,
                pin: DIAN_CONFIG.SOFTWARE.PIN,
                tipoAmbiente: '2',
                numDocAdquiriente: '222222222222', nitEmisor: DIAN_CONFIG.EMISOR.NIT
            };

            console.log("🔨 Building XML...");
            const cude = generateCUDE(dataKey);
            const xml = buildCreditNoteXML(dataKey, cude);
            console.log("✍️ Signing XML...");
            const { certPath } = canSign();
            const signedXml = await signInvoiceXML(xml, certPath, process.env.DIAN_CERTIFICADO_PASSWORD);
            console.log("📦 Zipping...");
            const zip = await compressXMLToBase64(signedXml, 'test.xml');
            console.log("📨 Sending...");
            const res = await sendSoap(zip, 'test.zip');
            console.log("Result:", res);

        } catch (inner) {
            console.error("💥 Inner Logic Error:", inner);
        }
    })();

} catch (e) {
    console.error("💥 Top Level Error:", e);
}
