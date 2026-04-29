/**
 * Consultar estado detallado de FE1 usando GetStatus
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const result = JSON.parse(fs.readFileSync('FE1_result.json'));
const TRACK_ID = result.zipKey;

console.log('🔍 Consultando estado con GetStatus...');
console.log('   TrackID:', TRACK_ID);

const DOTNET_DLL = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const run = async () => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';

    // Usar GetStatus en lugar de GetStatusZip
    const cmd = `dotnet "${DOTNET_DLL}" "${p12Path}" "${password}" "GetStatus" "${TRACK_ID}" "dummy" "null" "${url}"`;

    try {
        const { stdout, stderr } = await execPromise(cmd, { cwd: __dirname, timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

        console.log('\n📨 RESPUESTA COMPLETA DIAN:');
        console.log(stdout);

        // Guardar
        fs.writeFileSync('FE1_getstatus_full.txt', stdout);

        // Buscar JSON
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start !== -1 && end !== -1) {
            const json = JSON.parse(stdout.substring(start + 16, end).trim());
            fs.writeFileSync('FE1_getstatus.json', JSON.stringify(json, null, 2));
            console.log('\n📄 JSON guardado en FE1_getstatus.json');
            console.log('   Success:', json.success);
            console.log('   Message:', json.message);
        }

        if (stderr) {
            console.error('STDERR:', stderr);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
};

run();
