// src/services/dianService.js
// Servicio para conexión con Web Services de la DIAN

const soap = require('soap');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const forge = require('node-forge');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec); // Promisify exec

const { DIAN_CONFIG, getEndpoint } = require('../config/dianConfig');
const { generateCUFE, buildInvoiceXML } = require('../helpers/dianHelper');
const { signXMLDemo, signXML, hasCertificate, loadCertificate } = require('../helpers/dianSignatureHelper');
const { signInvoiceXML, canSign } = require('../helpers/xadesEpesHelper');
// WSSecurityHelper ya no se usa aquí directamente
// const WSSecurityHelper = require('../helpers/wsSecurityHelper'); 

// Configuración de certificados
const CERT_DIR = path.join(__dirname, '../../certificados');
const DOTNET_DLL_PATH = path.join(__dirname, '../../dian-net-signer/bin/Debug/net8.0/dian-net-signer.dll');
const JAVA_SOAP_DIR = path.join(__dirname, '../../'); // Ejecutar desde raiz del back

const loadCertCredentials = () => {
    try {
        const files = fs.readdirSync(CERT_DIR);
        const p12File = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
        if (!p12File) throw new Error('No se encontró archivo .p12 en certificados');

        const p12Path = path.join(CERT_DIR, p12File);
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;

        // Leer binario
        const p12Asn1 = forge.asn1.fromDer(fs.readFileSync(p12Path, 'binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

        // Get Key
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
        const keyPem = forge.pki.privateKeyToPem(privateKey);

        // Get Cert
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certificate = certBags[forge.pki.oids.certBag][0].cert;
        const certPem = forge.pki.certificateToPem(certificate);

        return { keyPem, certPem, password };
    } catch (error) {
        console.warn('⚠️ No se pudieron cargar credenciales P12:', error.message);
        throw error;
    }
};

// buildSoapEnvelope ya no se usa
const buildSoapEnvelope = () => { };

const sendSoapRequest = async (methodName, params) => {
    try {
        console.log(`📨 Enviando SOAP Request (.NET Core WCF): ${methodName}`);

        // 1. Obtener credenciales P12
        const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
        if (!p12File) throw new Error("No P12 found");
        const p12Path = path.join(CERT_DIR, p12File);
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;

        // 2. Preparar argumentos
        // Args: <p12Path> <password> <methodName> <xmlBase64> <fileName> <testSetId> <url>
        const xmlBase64 = params.contentFile;
        const fileName = params.fileName;
        const testSetId = params.testSetId || "null";
        const url = getEndpoint().URL;

        // Validar integridad de argumentos
        if (/[&|;<>]/.test(fileName) || /[&|;<>]/.test(methodName)) {
            throw new Error("Invalid characters in arguments");
        }

        // 3. Ejecutar .NET Client
        // dotnet <dll> <args...>
        const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "${methodName}" "${xmlBase64}" "${fileName}" "${testSetId}" "${url}"`;

        console.log(`   🔷 Ejecutando DianSigner .NET... (URL: ${url})`);

        const { stdout, stderr } = await execPromise(cmd, {
            cwd: JAVA_SOAP_DIR,
            timeout: 120000,
            maxBuffer: 20 * 1024 * 1024
        });

        // .NET puede imprimir warnings en stderr pero funcionar bien.
        if (stderr && !stderr.includes("Build succeeded")) {
            // Ignoramos warnings de build si usamos 'dotnet run', pero aqui usamos dll direct.
            // Solo logueamos si parece error crítico
            // console.warn('   ⚠️ .NET stderr:', stderr);
        }

        console.log('📥 Respuesta .NET recibida');
        return await parseSoapResponse(stdout);

    } catch (error) {
        console.error('❌ Error enviando request SOAP (.NET):', error.message);
        throw error;
    }
};

const parseSoapResponse = async (stdout) => {
    // Buscar bloque JSON
    const startMarker = "---JSON_START---";
    const endMarker = "---JSON_END---";

    const startIndex = stdout.indexOf(startMarker);
    const endIndex = stdout.indexOf(endMarker);

    if (startIndex === -1 || endIndex === -1) {
        // Fallback: Check for raw error or fault
        if (stdout.includes("Exception:") || stdout.includes("Error:")) {
            throw new Error("NET Client Error: " + stdout);
        }
        throw new Error("Invalid response format from .NET client (No JSON block found)");
    }

    const jsonStr = stdout.substring(startIndex + startMarker.length, endIndex).trim();

    try {
        const result = JSON.parse(jsonStr);
        console.log("🔍 NET CLIENT RAW JSON:", JSON.stringify(result, null, 2)); // DEBUG

        // Mapear a estructura esperada por el backend original
        // El codigo antiguo esperaba: { SendTestSetAsyncResult: { ... } }
        // Nuestro JSON trae: { success, message, zipKey, documentKey }

        /* 
           Estructura deseada Legacy:
           {
               SendTestSetAsyncResult: {
                   ErrorMessageList: [ message ],
                   ZipKey: zipKey,
                   IsValid: success,
                   StatusMessage: message
               }
           }
        */

        const mappedResult = {
            ErrorMessageList: result.success ? [] : [result.message],
            ZipKey: result.zipKey,
            TrackId: result.documentKey, // Sometimes returned here
            IsValid: result.success,
            StatusMessage: result.message,
            XmlDocumentKey: result.documentKey
        };

        // Detectar si fue TestSet o BillAsync (aunque el formato JSON es unificado)
        // Si zipKey existe, asumimos TestSet o BillAsync success

        return {
            SendTestSetAsyncResult: mappedResult,
            SendBillAsyncResult: mappedResult // Dual compatibility
        };

    } catch (e) {
        throw new Error("Failed to parse .NET response JSON: " + e.message);
    }
};

const initSoapClient = async () => {
    // Retornamos un objeto dummy compatible o nulo, ya que usamos axios directo
    return {};
};

const compressXMLToBase64 = (xmlContent, filename = 'factura.xml') => {
    return new Promise((resolve, reject) => {
        const buffers = [];
        const output = new PassThrough();

        output.on('data', chunk => buffers.push(chunk));
        output.on('end', () => {
            const buffer = Buffer.concat(buffers);
            resolve(buffer.toString('base64'));
        });
        output.on('error', reject);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        archive.append(xmlContent, { name: filename });
        archive.finalize();
    });
};

const sendInvoiceToDIAN = async (invoiceData) => {
    const emisor = DIAN_CONFIG.EMISOR;
    const software = DIAN_CONFIG.SOFTWARE;
    const resolucion = DIAN_CONFIG.RESOLUCION;

    const invoiceNumber = `${resolucion.PREFIJO}${invoiceData.consecutivo}`;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = `${now.toTimeString().split(' ')[0]}-05:00`;

    const cufeData = {
        invoiceNumber,
        date,
        time,
        subtotal: invoiceData.subtotal,
        taxAmount1: invoiceData.taxAmount,
        taxAmount2: 0,
        taxAmount3: 0,
        total: invoiceData.total,
        nitEmisor: emisor.NIT,
        tipoDocAdquiriente: invoiceData.client.docType || '13',
        numDocAdquiriente: invoiceData.client.idNumber,
        claveTecnica: software.CLAVE_TECNICA,
        tipoAmbiente: DIAN_CONFIG.AMBIENTE
    };

    const cufe = generateCUFE(cufeData);
    console.log('🔐 CUFE generado:', cufe);

    const xmlData = {
        ...invoiceData,
        invoiceNumber,
        prefijo: resolucion.PREFIJO,
        date,
        time,
        dueDate: invoiceData.dueDate || date
    };

    let xmlContent = buildInvoiceXML(xmlData, cufe);

    // Firma XAdES
    const signCheck = canSign();
    const isDemoMode = !signCheck.canSign || process.env.DIAN_DEMO_MODE === 'true';

    if (isDemoMode) {
        console.log('🧪 MODO DEMO - Firmando mock');
        xmlContent = signXMLDemo(xmlContent);
    } else {
        console.log('🔏 Firmando (XAdES Java)...');
        try {
            xmlContent = await signInvoiceXML(xmlContent, signCheck.certPath, process.env.DIAN_CERTIFICADO_PASSWORD);
        } catch (e) {
            console.error('Error firmando:', e);
            throw e;
        }
    }

    // Comprimir ZIP para DIAN (importante: nombre de archivo dentro del zip)
    const zipContent = await compressXMLToBase64(xmlContent, `${invoiceNumber}.xml`);

    console.log(`🌍 AMBIENTE actual: "${DIAN_CONFIG.AMBIENTE}" (tipo: ${typeof DIAN_CONFIG.AMBIENTE})`);
    const method = DIAN_CONFIG.AMBIENTE === '2' ? 'SendTestSetAsync' : 'SendBillAsync';
    console.log(`📡 Método SOAP seleccionado: ${method}`);

    let params = {};
    if (method === 'SendTestSetAsync') {
        params = {
            fileName: `${invoiceNumber}.zip`, // La DIAN espera .zip aqui
            contentFile: zipContent,
            testSetId: software.TEST_SET_ID
        };
    } else {
        params = {
            fileName: `${invoiceNumber}.zip`,
            contentFile: zipContent
        };
    }

    if (isDemoMode && process.env.DIAN_DEMO_MODE === 'true') {
        console.log('✅ DEMO MODE: Simulando envío exitoso');
        return { success: true, message: 'Simulated success' };
    }

    try {
        console.log(`📤 Enviando a DIAN: método=${method}, factura=${invoiceNumber}`);
        const result = await sendSoapRequest(method, params);

        console.log('📥 Respuesta DIAN cruda:', JSON.stringify(result, null, 2));

        // Extract trackId/zipKey from the response structure
        // The .NET client returns: { SendBillAsyncResult: { ZipKey, TrackId, ... } }
        // Or for test: { SendTestSetAsyncResult: { ZipKey, TrackId, ... } }
        const asyncResult = result.SendBillAsyncResult || result.SendTestSetAsyncResult || {};
        console.log('📦 asyncResult:', JSON.stringify(asyncResult, null, 2));

        // Try multiple paths to find the trackId/zipKey
        const trackId = asyncResult.ZipKey || asyncResult.TrackId || result.zipKey || result.documentKey || '';
        console.log(`🔑 TrackId extraído: "${trackId}"`);

        return {
            success: result.success !== false,  // ✅ Handle both true and undefined as success
            dianResponse: result,
            cufe: cufe,
            invoiceNumber: invoiceNumber,
            trackId: trackId,
            zipKey: trackId,
            xmlPath: ''
        };
    } catch (e) {
        return {
            success: false,
            error: e.message,
            soapFault: e.response?.data,
            cufe: cufe,
            invoiceNumber: invoiceNumber
        };
    }
};

const getDocumentStatus = async (trackId) => {
    try {
        console.log(`🔎 Consultando estado DIAN para TrackID: ${trackId}`);
        // TRUCO: Pasamos el TrackID en 'contentFile' (3er arg) porque así lo programamos en C# para GetStatus
        const params = {
            fileName: 'status_query', // Dummy
            contentFile: trackId
        };

        const result = await sendSoapRequest('GetStatus', params);
        return {
            success: result.success, // isValid en la respuesta DIAN
            message: result.message,
            dianResponse: result
        };
    } catch (e) {
        console.error('Error consultando estado:', e);
        return { success: false, error: e.message };
    }
};

const getDocumentByCUFE = async (cufe) => { return { success: false }; };
const getTestSetStatus = async () => { return { success: false }; };

// Función helper para generar factura de prueba
const generateTestInvoice = async (consecutivo = 990000001) => {
    // Datos mock
    const testInvoiceData = {
        consecutivo,
        subtotal: 100000,
        taxAmount: 19000,
        discountAmount: 0,
        total: 119000,
        paymentMethod: 'Contado',
        paymentMeanCode: '10',
        notes: 'Factura prueba DIAN',
        client: {
            name: 'CONSUMIDOR FINAL',
            idNumber: '222222222222',
            docType: '13',
            email: 'test@test.com',
            direccion: 'Calle 123',
            ciudad: 'Bogotá',
            departamento: 'Bogotá D.C.',
            codigoMunicipio: '11001',
            codigoDepartamento: '11',
            tipoPersona: '2'
        },
        items: [
            {
                item: 'Producto Prueba',
                description: 'Desc',
                reference: 'TEST-01',
                quantity: 1,
                unitPrice: 100000,
                lineBase: 100000,
                discount: 0,
                tax: 19,
                taxVal: 19000,
                lineTotal: 119000
            }
        ]
    };
    const result = await sendInvoiceToDIAN(testInvoiceData);
    console.log("📥 RESPUESTA RAW .NET:", JSON.stringify(result, null, 2)); // 🔍 DEBUG COMPLETO
    if (result.success) {
        // Assuming result.dianResponse contains the parsed .NET response
        const parsed = result.dianResponse.SendBillAsyncResult || result.dianResponse.SendTestSetAsyncResult;
        return {
            success: true,
            message: 'Enviado a DIAN',
            invoiceNumber: testInvoiceData.consecutivo,
            cufe: parsed.XmlDocumentKey || 'PENDIENTE_POR_DIAN',
            trackId: parsed.XmlDocumentKey, // En SendTestSetAsync el key suele ser el trackID
            xmlPath: 'N/A', // Placeholder
            dianResponse: result // DEBUG: Include full response
        };
    } else {
        return result; // Return the error result directly
    }
};

module.exports = {
    initSoapClient,
    sendInvoiceToDIAN,
    getDocumentStatus,
    getDocumentByCUFE,
    getTestSetStatus,
    generateTestInvoice,
    compressXMLToBase64
};
