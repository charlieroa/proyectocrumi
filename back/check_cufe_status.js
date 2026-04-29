/**
 * Consultar estado usando el CUFE directamente
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// CUFE de FE1 (extraído del XML)
const CUFE = '0977c66c9df21509ada1f8c0b56c0ea952a3692b26699a1df018f3eaa4ec936b4df0e987583f9eec5241bd01ea92332e';

console.log('🔍 Consultando estado con CUFE...');
console.log('   CUFE:', CUFE);

const DOTNET_DLL = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const run = async () => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';

    // Usar GetStatus con CUFE
    const cmd = `dotnet "${DOTNET_DLL}" "${p12Path}" "${password}" "GetStatus" "${CUFE}" "dummy" "null" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname, timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

        console.log('\n📨 RESPUESTA DIAN CON CUFE:');

        // Buscar StatusCode
        const statusMatch = stdout.match(/Status Code: (\d+)/);
        const messageMatch = stdout.match(/Status Message: (.+)/);

        if (statusMatch) console.log('   StatusCode:', statusMatch[1]);
        if (messageMatch) console.log('   Message:', messageMatch[1]);

        // Buscar JSON
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start !== -1 && end !== -1) {
            const json = JSON.parse(stdout.substring(start + 16, end).trim());
            fs.writeFileSync('FE1_cufe_status.json', JSON.stringify(json, null, 2));
            console.log('\n   JSON guardado en FE1_cufe_status.json');
        }

        fs.writeFileSync('FE1_cufe_status_full.txt', stdout);
        console.log('   Log completo en FE1_cufe_status_full.txt');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
};

run();
