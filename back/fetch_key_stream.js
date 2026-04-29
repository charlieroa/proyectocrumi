const { spawn } = require('child_process');
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

    const method = "GetNumberingRange";
    const nit = "902006720";
    const softwareId = "2e596e42-daf8-48ef-83d8-b6e9d02c090e";
    const url = "https://vpfe.dian.gov.co/WcfDianCustomerServices.svc";

    const args = [
        DOTNET_DLL_PATH,
        p12Path,
        password,
        method,
        nit,
        softwareId,
        "dummy",
        url
    ];

    console.log('🚀 Fetching Technical Key (Stream Mode)...');

    // Use spawn instead of exec to stream output
    const child = spawn('dotnet', args, { cwd: __dirname });

    const logStream = fs.createWriteStream('debug_key_full.log');

    child.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(text); // Print to console
        logStream.write(text);      // Write to file
    });

    child.stderr.on('data', (data) => {
        const text = data.toString();
        process.stderr.write(text);
        logStream.write(`STDERR: ${text}`);
    });

    child.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        logStream.end();
    });
};

run();
