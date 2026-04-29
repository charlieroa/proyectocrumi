/**
 * Script para consultar estado de factura en DIAN por ZipKey
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config();

// ZipKey de la última factura enviada
const ZIPKEY = '903fa2b6-d2828f4bbb-951c-9c71b6378'; // Del production_response.json

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const checkStatus = async () => {
    console.log('🔍 Consultando estado en DIAN para ZipKey:', ZIPKEY);

    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;

    // URL de producción
    const url = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';

    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "GetStatusZip" "${ZIPKEY}" "dummy" "null" "${url}"`;

    try {
        const { stdout, stderr } = await execPromise(cmd, { cwd: __dirname, timeout: 60000 });
        console.log('\n📨 RESPUESTA DIAN:');
        console.log(stdout);

        // Extraer JSON
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start !== -1 && end !== -1) {
            const json = stdout.substring(start + 16, end).trim();
            const result = JSON.parse(json);
            console.log('\n✅ Resultado parseado:');
            console.log(JSON.stringify(result, null, 2));
            fs.writeFileSync('status_check_result.json', JSON.stringify(result, null, 2));
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
};

checkStatus();
