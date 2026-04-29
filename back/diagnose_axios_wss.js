const fs = require('fs');
const path = require('path');
const axios = require('axios');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const CERT_DIR = path.join(__dirname, 'certificados');
const OUTPUT_DIR = path.join(__dirname, 'diagnostico_output');

// Configuración DIAN
const URL_DIAN = 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc';
const ACTION = 'http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync';

// 1. CARGAR CERTIFICADO
const loadCert = () => {
    const files = fs.readdirSync(CERT_DIR);
    const p12File = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;

    const p12Asn1 = forge.asn1.fromDer(fs.readFileSync(p12Path).toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    const keyPem = forge.pki.privateKeyToPem(privateKey);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certificate = certBags[forge.pki.oids.certBag][0].cert;
    const certPem = forge.pki.certificateToPem(certificate);

    // Certificado sin headers para BinarySecurityToken
    const certBase64 = certPem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\r\n/g, '')
        .replace(/\n/g, '');

    return { keyPem, certBase64, password };
};

// 2. CONSTRUIR TIMESTAMP XML
const createTimestampXml = (created, expires, id) => {
    return `<u:Timestamp u:Id="${id}" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><u:Created>${created}</u:Created><u:Expires>${expires}</u:Expires></u:Timestamp>`;
};

// 3. FIRMAR TIMESTAMP
const signTimestamp = (timestampXml, keyPem, certId) => {
    const sig = new SignedXml();
    sig.signingKey = keyPem;
    sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    sig.addReference("//*[local-name(.)='Timestamp']",
        ["http://www.w3.org/2001/10/xml-exc-c14n#"],
        "http://www.w3.org/2001/04/xmlenc#sha256"
    );

    // KeyInfo personalizado para referenciar BinarySecurityToken
    sig.keyInfoProvider = {
        getKeyInfo: () => {
            return `<o:SecurityTokenReference><o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#${certId}"/></o:SecurityTokenReference>`;
        }
    };

    sig.computeSignature(timestampXml);
    return sig.getSignatureXml();
};

// 4. CARGAR ZIP (Ya generado antes)
const loadZipBase64 = () => {
    const zipPath = path.join(OUTPUT_DIR, 'test_signed.zip');
    // Nota: diagnose_soap_wsse.js creaba buffer pero no guardaba zip.
    // Necesito re-crear zip aqui o asumir que existe.
    // Para simplificar, voy a leer el XML firmado y zipearlo en memoria de nuevo. (Duplicación de lógica necesaria)
    const JSZip = require('jszip');
    const xmlPath = path.join(OUTPUT_DIR, 'test_signed.xml');
    if (!fs.existsSync(xmlPath)) throw new Error('Falta test_signed.xml');

    // Este paso es async, lo muevo al main
    return { xmlPath, JSZip };
};

const run = async () => {
    try {
        console.log('1. Cargando credenciales...');
        const { keyPem, certBase64 } = loadCert();

        console.log('2. Preparando ZIP...');
        const { xmlPath, JSZip } = loadZipBase64();
        console.log('   XML Path:', xmlPath);

        if (!fs.existsSync(xmlPath)) throw new Error('XML no existe');

        const zip = new JSZip();
        zip.file('SETP990000099.xml', fs.readFileSync(xmlPath));
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const contentFile = zipBuffer.toString('base64');
        console.log('   ZIP generado, longitud:', contentFile.length);

        console.log('3. Construyendo WS-Security...');
        const now = new Date();
        const created = now.toISOString();
        const expires = new Date(now.getTime() + (5 * 60 * 1000)).toISOString();
        const tsId = '_0';
        const certId = uuidv4(); // Usar uuidv4

        console.log('   Timestamp:', created);
        const timestampXml = createTimestampXml(created, expires, tsId);

        // xml-crypto necesita el namespace xmlns:u declarado en el contexto o en el elemento.
        // Mi createTimestampXml ya lo tiene.

        console.log('   Firmando Timestamp...');
        const signatureXml = signTimestamp(timestampXml, keyPem, certId);
        console.log('   Firma generada');

        // Construir Header Security completo
        const securityHeader =
            `<o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    ${timestampXml}
    <o:BinarySecurityToken u:Id="${certId}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${certBase64}</o:BinarySecurityToken>
    ${signatureXml}
</o:Security>`;

        console.log('4. Construyendo SOAP Envelope...');
        const soapBody =
            `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia">
    <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
        <wsa:Action>${ACTION}</wsa:Action>
        <wsa:To>${URL_DIAN}</wsa:To>
        ${securityHeader}
    </soap:Header>
    <soap:Body>
        <wcf:SendTestSetAsync>
            <wcf:fileName>SETP990000099.zip</wcf:fileName>
            <wcf:contentFile>${contentFile}</wcf:contentFile>
            <wcf:testSetId>88820f4b-017e-4623-afc6-66444d32f50f</wcf:testSetId>
        </wcf:SendTestSetAsync>
    </soap:Body>
</soap:Envelope>`;

        console.log('5. Enviando request con AXIOS...');
        const response = await axios.post(URL_DIAN, soapBody, {
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'User-Agent': 'NodeJS-Client-Manual'
            }
        });

        console.log('✅ RESPUESTA SUCCESS:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ ERROR RESPUESTA:');
        if (error.response) {
            console.error('STATUS:', error.response.status);
            console.error('DATA:', error.response.data);
            fs.writeFileSync('axios_error.xml', error.response.data);
        } else {
            console.error(error.message);
        }
    }
};

run();
