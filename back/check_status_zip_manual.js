require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

const TRACK_ID = 'bcb11e36-e4f3-4f6a-aaf3-9932ca0140f0';
const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const checkZipStatus = async () => {
    try {
        console.log(`🔎 Consultando GetStatusZip para TrackID: ${TRACK_ID}`);

        const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
        const p12Path = path.join(CERT_DIR, p12File);
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;
        const url = "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl";

        // Args: <p12Path> <password> <methodName> <xmlBase64> <fileName> <testSetId> <url>
        // Para GetStatusZip, pasamos el TRACK_ID en el 4to argumento (xmlBase64/contentFile) como hack, igual que GetStatus
        const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "GetStatusZip" "${TRACK_ID}" "status_query" "null" "${url}"`;

        const { stdout } = await execPromise(cmd, { cwd: __dirname });

        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");

        if (start !== -1 && end !== -1) {
            const jsonStr = stdout.substring(start + 16, end).trim();
            console.log("RESPONSE:", jsonStr);
            fs.writeFileSync('dian_zip_status.json', jsonStr);
        } else {
            console.log("RAW OUTPUT:", stdout);
        }

    } catch (e) {
        console.error("ERROR:", e);
    }
};

checkZipStatus();
