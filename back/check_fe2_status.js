/**
 * Verificar estado de FE2 en DIAN
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const result = JSON.parse(fs.readFileSync('FE2_result.json'));
const TRACK_ID = result.zipKey;

console.log('🔍 Verificando FE2 en DIAN...');
console.log('   TrackID:', TRACK_ID);

const DOTNET_DLL = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const run = async () => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';

    const cmd = `dotnet "${DOTNET_DLL}" "${p12Path}" "${password}" "GetStatus" "${TRACK_ID}" "dummy" "null" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname, timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

        // Buscar StatusCode
        const statusMatch = stdout.match(/Status Code: (\d+)/);
        const messageMatch = stdout.match(/Status Message: (.+)/);

        console.log('\n📨 ESTADO FE2:');
        if (statusMatch) console.log('   StatusCode:', statusMatch[1]);
        if (messageMatch) console.log('   Message:', messageMatch[1]);

        // Buscar JSON
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start !== -1 && end !== -1) {
            const json = JSON.parse(stdout.substring(start + 16, end).trim());
            console.log('   Success:', json.success);
            fs.writeFileSync('FE2_status.json', JSON.stringify(json, null, 2));
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
};

run();
