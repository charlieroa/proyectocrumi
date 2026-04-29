/**
 * Verificar estado de FE1 en DIAN
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Leer ZipKey del resultado
const result = JSON.parse(fs.readFileSync('FE1_result.json'));
const ZIPKEY = result.zipKey;
console.log('🔍 Consultando estado para ZipKey:', ZIPKEY);

const DOTNET_DLL = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const run = async () => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';

    const cmd = `dotnet "${DOTNET_DLL}" "${p12Path}" "${password}" "GetStatusZip" "${ZIPKEY}" "dummy" "null" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname, timeout: 60000, maxBuffer: 10 * 1024 * 1024 });

        // Buscar JSON
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");

        if (start !== -1 && end !== -1) {
            const json = JSON.parse(stdout.substring(start + 16, end).trim());
            console.log('\n📨 ESTADO FACTURA FE1:');
            console.log('   Success:', json.success);
            console.log('   Message:', json.message);

            // Guardar resultado
            fs.writeFileSync('FE1_status.json', JSON.stringify(json, null, 2));
            console.log('\n   Guardado en FE1_status.json');
        } else {
            console.log('No se encontró JSON en respuesta');
            console.log(stdout);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
};

run();
