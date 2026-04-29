const soap = require('soap');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const JSZip = require('jszip');

// CONFIG
require('dotenv').config();
const CERT_DIR = path.join(__dirname, 'certificados');
const OUTPUT_DIR = path.join(__dirname, 'diagnostico_output');

// 1. CARGAR P12 Y EXTRAER KEY/CERT
const loadCert = () => {
    const files = fs.readdirSync(CERT_DIR);
    const p12File = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;

    const p12Asn1 = forge.asn1.fromDer(fs.readFileSync(p12Path).toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Get Private Key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    const keyPem = forge.pki.privateKeyToPem(privateKey);

    // Get Certificate
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certificate = certBags[forge.pki.oids.certBag][0].cert;
    const certPem = forge.pki.certificateToPem(certificate);

    return { keyPem, certPem, password };
};

// 2. CREAR ZIP DEL XML ANTERIOR
const createZip = async () => {
    // Reusar el XML firmado que generamos con Java
    const xmlPath = path.join(OUTPUT_DIR, 'test_signed.xml');
    if (!fs.existsSync(xmlPath)) throw new Error('Ejecuta diagnose_dian_isolated.js primero para generar el XML firmado');

    const zip = new JSZip();
    zip.file('SETP990000099.xml', fs.readFileSync(xmlPath));
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return zipBuffer;
};

// 3. ENVIAR CON SOAP + WS-SECURITY
const run = async () => {
    try {
        console.log('1. Cargando credenciales...');
        const { keyPem, certPem, password } = loadCert();

        console.log('2. Generando ZIP...');
        const zipBuffer = await createZip();

        console.log('3. Configurando cliente SOAP...');
        // Usar WSDL local
        const url = path.join(__dirname, 'dian.wsdl'); // Local WSDL

        console.log('   Loading local WSDL:', url);
        let client;
        try {
            client = await soap.createClientAsync(url, {
                forceSoap12Headers: true,
                wsdl_headers: {
                    'User-Agent': 'NodeJS-Client'
                }
            });
            console.log('   Client created OK');
        } catch (err) {
            console.error('   ❌ Error creating SOAP client:', err.message);
            throw err;
        }

        console.log('   Setting security...');
        // Configurar WS-Security
        const wsSecurity = new soap.WSSecurityCert(keyPem, certPem, password, {
            hasTimeStamp: true,
            signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
            signatureTransformations: ['http://www.w3.org/2001/10/xml-exc-c14n#']
        });

        client.setSecurity(wsSecurity);

        // Argumentos - Importante: node-soap a veces necesita el orden correcto
        const args = {
            fileName: 'SETP990000099.zip',
            contentFile: zipBuffer.toString('base64'),
            testSetId: '88820f4b-017e-4623-afc6-66444d32f50f'
        };

        console.log('4. Enviando SendTestSetAsync...');

        // Forzar header soap 1.2 y Action
        client.addHttpHeader('Content-Type', 'application/soap+xml; charset=utf-8; action="http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync"');

        client.SendTestSetAsync(args, (err, result, rawResponse, soapHeader, rawRequest) => {
            console.log('--- REQUEST ---');
            // console.log(rawRequest); 

            if (err) {
                console.error('❌ Error SOAP:', err.message);
                if (err.response) {
                    console.error('STATUS:', err.response.status);
                    // console.error('BODY:', err.response.data);
                    fs.writeFileSync('soap_response_error.xml', err.response.data);
                    console.error('Error body saved to soap_response_error.xml');
                }
                const fault = err.root?.Envelope?.Body?.Fault;
                if (fault) {
                    console.error('SOAP FAULT:', JSON.stringify(fault, null, 2));
                }
            } else {
                console.log('✅ ÉXITO!');
                console.log(JSON.stringify(result, null, 2));
                fs.writeFileSync('soap_response_success.json', JSON.stringify(result, null, 2));
            }
        });

    } catch (e) {
        console.error('ERROR FATAL:', e);
    }
};

run();
