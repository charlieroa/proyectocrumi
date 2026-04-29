const { SignedXml } = require('xml-crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

require('dotenv').config();

const CERT_DIR = path.join(__dirname, 'certificados');

const loadCert = () => {
    try {
        const files = fs.readdirSync(CERT_DIR);
        const p12File = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
        if (!p12File) throw new Error('No .p12 found in ' + CERT_DIR);

        const p12Path = path.join(CERT_DIR, p12File);
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;

        const p12Asn1 = forge.asn1.fromDer(fs.readFileSync(p12Path).toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

        // Get key
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
        const keyPem = forge.pki.privateKeyToPem(privateKey);

        return keyPem;
    } catch (e) {
        console.error('Error loading cert:', e);
        return null;
    }
};

const run = () => {
    try {
        console.log('Starting test...');
        const keyPem = loadCert();
        if (!keyPem) return;

        console.log('Key extracted OK');

        const xml = '<u:Timestamp u:Id="_0" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><u:Created>2025-01-01T00:00:00.000Z</u:Created></u:Timestamp>';

        const sig = new SignedXml();
        sig.signingKey = keyPem;
        sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
        sig.keyInfoProvider = {
            getKeyInfo: () => "<wsse:SecurityTokenReference></wsse:SecurityTokenReference>"
        };

        // Add reference to Timestamp with Id="_0"
        // NOTA: Para que xml-crypto encuentre el ID, debemos decirle dónde buscar el atributo Id.
        // Pero u:Id es standard.
        // Argumentos: xpath, transforms, digestAlgorithm, uri, digestValue, inclusiveNamespacesPrefixList, isEmptyUri, isBinary, forceURISets

        sig.addReference("//*[local-name(.)='Timestamp']",
            ["http://www.w3.org/2001/10/xml-exc-c14n#"],
            "http://www.w3.org/2001/04/xmlenc#sha256",
            "#_0"
        );

        console.log('Computing signature...');
        sig.computeSignature(xml);
        console.log('Signature generated OK');
        console.log(sig.getSignatureXml());
        console.log('SUCCESS');

    } catch (e) {
        console.error('ERROR:', e.message);
        console.error(e.stack);
    }
};

run();
