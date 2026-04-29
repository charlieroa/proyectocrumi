/**
 * Consultar estado de factura en DIAN usando GetStatusZip
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ZIPKEY = '2a375f01-5e27-4dbb-b5c4-357c60c6ca3a';

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const run = async () => {
    console.log('🔍 Consultando estado DIAN para ZipKey:', ZIPKEY);

    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc';

    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "GetStatusZip" "${ZIPKEY}" "dummy" "null" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname, timeout: 60000 });
        console.log('\n📨 RESPUESTA COMPLETA:');
        console.log(stdout);

        // Guardar
        fs.writeFileSync('status_result_full.txt', stdout);
        console.log('\n✅ Guardado en status_result_full.txt');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
};

run();
