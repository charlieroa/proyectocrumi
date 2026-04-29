const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const run = async () => {
    // Buscar certificado
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;

    // Parametros para GetNumberingRange
    const method = "GetNumberingRange";
    const nit = "902006720"; // NIT Emisor
    const softwareId = "2e596e42-daf8-48ef-83d8-b6e9d02c090e"; // ID Software
    const url = "https://vpfe.dian.gov.co/WcfDianCustomerServices.svc"; // URL Producción

    // Comando:
    // args[3] = zipContent -> NIT
    // args[4] = fileName -> SoftwareID
    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "${method}" "${nit}" "${softwareId}" "dummy" "${url}"`;

    console.log('🚀 Fetching Technical Key from DIAN...');
    // console.log(cmd); 

    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) console.error(`Stderr: ${stderr}`);

        console.log(stdout);

        // Parsear para encontrar la Key
        if (stdout.includes('---NUMBERING_RANGE_START---')) {
            const lines = stdout.split('\n');
            lines.forEach(line => {
                if (line.includes('Key:') && line.includes('Res:')) {
                    console.log('✅ FOUND POTENTIAL KEY:');
                    console.log(line.trim());
                }
            });
        }
    });
};

run();
