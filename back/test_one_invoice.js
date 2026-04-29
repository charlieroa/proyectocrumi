require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');
const crypto = require('crypto');

// ====================== CONFIG ======================
const TODAY = new Date().toISOString().split('T')[0];
const NOW_TIME = new Date().toTimeString().split(' ')[0] + '-05:00';

const DIAN_CONFIG = {
    AMBIENTE: '2',
    SOFTWARE: {
        ID: 'cd7aa0f8-5eb5-49d7-9276-b55a79cfc260',
        PIN: '10225',
        CLAVE_TECNICA: 'fc8eac422eba16e22ffd8c6f5',
        TEST_SET_ID: 'ab2a8cdc-1c35-40b4-9728-3e9537637997'
    },
    RESOLUCION: {
        NUMERO: '18760000001',
        PREFIJO: 'SETP',
        RANGO_DESDE: '990000000',
        RANGO_HASTA: '995000000'
    },
    EMISOR: {
        NIT: '902006720',
        DV: '4',
        RAZON_SOCIAL: 'CRUMI S.A.S',
    }
};

// Helpers
const escapeXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const generateCUFE = (data) => {
    const s = `${data.invoiceNumber}${data.date}${data.time}${data.subtotal.toFixed(2)}01${data.taxAmount.toFixed(2)}040.00030.00${data.total.toFixed(2)}${data.nitEmisor}${data.numDocAdquiriente}${data.claveTecnica}${data.tipoAmbiente}`;
    console.log(`   📝 String CUFE: ${s.substring(0, 100)}...`);
    return crypto.createHash('sha384').update(s).digest('hex');
};

const generateSoftwareSecurityCode = (swId, pin, num) => crypto.createHash('sha384').update(`${swId}${pin}${num}`).digest('hex');

const compressXMLToBase64 = (xmlContent, filename) => {
    return new Promise((resolve, reject) => {
        const buffers = []; const output = new PassThrough();
        output.on('data', c => buffers.push(c));
        output.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
        output.on('error', reject);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        archive.append(xmlContent, { name: filename });
        archive.finalize();
    });
};

const signInvoiceXML = async (xmlContent, certPath, password) => {
    const { signInvoiceXML: signOriginal } = require('./src/helpers/xadesEpesHelper');
    return signOriginal(xmlContent, certPath, password);
};

const sendSoap = async (xmlBase64, filename) => {
    const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
    const CERT_DIR = path.join(__dirname, 'certificados');
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl";
    const testSetId = DIAN_CONFIG.SOFTWARE.TEST_SET_ID;
    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendTestSetAsync" "${xmlBase64}" "${filename}" "${testSetId}" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname });
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start === -1) return { success: false, message: "NET ERROR: " + stdout.substring(0, 500) };
        return JSON.parse(stdout.substring(start + 16, end).trim());
    } catch (e) {
        return { success: false, error: e.message };
    }
};

const buildInvoiceXML = (data, cufe) => {
    const { invoiceNumber, date, time, items, subtotal, taxAmount, total, software, emisor, client, resolucion } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, invoiceNumber);
    const qrCode = `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cufe}`;

    const lines = items.map((item, i) => `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="94">${item.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">ITEM-${i + 1}</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ext:UBLExtensions>
<ext:UBLExtension><ext:ExtensionContent>
<sts:DianExtensions>
<sts:InvoiceControl>
<sts:InvoiceAuthorization>${resolucion.NUMERO}</sts:InvoiceAuthorization>
<sts:AuthorizationPeriod><cbc:StartDate>2019-01-19</cbc:StartDate><cbc:EndDate>2030-01-19</cbc:EndDate></sts:AuthorizationPeriod>
<sts:AuthorizedInvoices><sts:Prefix>${resolucion.PREFIJO}</sts:Prefix><sts:From>${resolucion.RANGO_DESDE}</sts:From><sts:To>${resolucion.RANGO_HASTA}</sts:To></sts:AuthorizedInvoices>
</sts:InvoiceControl>
<sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource>
<sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider>
<sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode>
<sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider>
<sts:QRCode>${qrCode}</sts:QRCode>
</sts:DianExtensions>
</ext:ExtensionContent></ext:UBLExtension>
<ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
</ext:UBLExtensions>
<cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
<cbc:CustomizationID>10</cbc:CustomizationID>
<cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
<cbc:ProfileExecutionID>2</cbc:ProfileExecutionID>
<cbc:ID>${invoiceNumber}</cbc:ID>
<cbc:UUID schemeID="2" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
<cbc:IssueDate>${date}</cbc:IssueDate>
<cbc:IssueTime>${time}</cbc:IssueTime>
<cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
<cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
<cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric>
<cac:AccountingSupplierParty>
<cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
<cac:Party>
<cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName>
<cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:PostalZone>110111</cbc:PostalZone><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Principal 123</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation>
<cac:PartyTaxScheme>
<cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName>
<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID>
<cbc:TaxLevelCode listName="48">O-99</cbc:TaxLevelCode>
<cac:RegistrationAddress><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:PostalZone>110111</cbc:PostalZone><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Principal 123</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:RegistrationAddress>
<cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
</cac:PartyTaxScheme>
<cac:PartyLegalEntity>
<cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName>
<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID>
<cac:CorporateRegistrationScheme><cbc:ID>${resolucion.PREFIJO}</cbc:ID></cac:CorporateRegistrationScheme>
</cac:PartyLegalEntity>
<cac:Contact><cbc:ElectronicMail>hola@crumi.ai</cbc:ElectronicMail></cac:Contact>
</cac:Party>
</cac:AccountingSupplierParty>
<cac:AccountingCustomerParty>
<cbc:AdditionalAccountID>2</cbc:AdditionalAccountID>
<cac:Party>
<cac:PartyIdentification><cbc:ID schemeName="13">${client.idNumber}</cbc:ID></cac:PartyIdentification>
<cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName>
<cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Cliente 456</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation>
<cac:PartyTaxScheme>
<cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID>
<cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode>
<cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No causa</cbc:Name></cac:TaxScheme>
</cac:PartyTaxScheme>
<cac:PartyLegalEntity>
<cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID>
</cac:PartyLegalEntity>
<cac:Contact><cbc:ElectronicMail>cliente@test.com</cbc:ElectronicMail></cac:Contact>
</cac:Party>
</cac:AccountingCustomerParty>
<cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode><cbc:PaymentDueDate>${date}</cbc:PaymentDueDate></cac:PaymentMeans>
<cac:TaxTotal>
<cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
<cbc:RoundingAmount currencyID="COP">0.00</cbc:RoundingAmount>
<cac:TaxSubtotal>
<cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount>
<cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
<cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory>
</cac:TaxSubtotal>
</cac:TaxTotal>
<cac:LegalMonetaryTotal>
<cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
<cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
<cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
<cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount>
</cac:LegalMonetaryTotal>
${lines}
</Invoice>`;
};

(async () => {
    console.log("🧪 PRUEBA DE UNA SOLA FACTURA");
    console.log("============================");
    console.log(`📅 Fecha: ${TODAY} ${NOW_TIME}`);
    console.log(`🏢 NIT Emisor: ${DIAN_CONFIG.EMISOR.NIT}-${DIAN_CONFIG.EMISOR.DV}`);
    console.log(`🔑 Software ID: ${DIAN_CONFIG.SOFTWARE.ID}`);
    console.log(`🔐 PIN: ${DIAN_CONFIG.SOFTWARE.PIN}`);
    console.log(`🔑 Clave Técnica: ${DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA}`);
    console.log(`📋 TestSetId: ${DIAN_CONFIG.SOFTWARE.TEST_SET_ID}`);
    console.log("");

    // Usar un número de factura único basado en timestamp
    const timestamp = Date.now().toString().slice(-6);
    const invoiceNum = `SETP99012${timestamp}`;

    const client = { name: 'CONSUMIDOR FINAL', idNumber: '222222222222', dv: '0' };
    const items = [{ description: 'Servicio de Prueba', quantity: 1, unitPrice: 10000, lineTotal: 10000, lineBase: 10000, tax: 19, taxVal: 1900, code: 'SRV001' }];
    const subtotal = 10000, taxAmount = 1900, total = 11900;

    const data = {
        invoiceNumber: invoiceNum,
        date: TODAY,
        time: NOW_TIME,
        items, subtotal, taxAmount, total,
        software: DIAN_CONFIG.SOFTWARE,
        emisor: DIAN_CONFIG.EMISOR,
        client,
        resolucion: DIAN_CONFIG.RESOLUCION,
        nitEmisor: DIAN_CONFIG.EMISOR.NIT,
        claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA,  // <-- CLAVE TÉCNICA, no PIN
        numDocAdquiriente: client.idNumber,
        tipoAmbiente: '2'
    };

    console.log(`📄 Factura: ${invoiceNum}`);
    console.log(`   Subtotal: ${subtotal}, IVA: ${taxAmount}, Total: ${total}`);

    // Generar CUFE
    const cufe = generateCUFE(data);
    console.log(`   CUFE: ${cufe.substring(0, 50)}...`);

    // Construir XML
    const xmlContent = buildInvoiceXML(data, cufe);

    // Guardar XML para inspección
    const xmlPath = path.join(__dirname, 'test_single_invoice.xml');
    fs.writeFileSync(xmlPath, xmlContent);
    console.log(`   📁 XML guardado en: ${xmlPath}`);

    // Firmar
    console.log("   🔏 Firmando...");
    const p12 = path.join(__dirname, 'certificados', fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12')));
    const signedXml = await signInvoiceXML(xmlContent, p12, process.env.DIAN_CERTIFICADO_PASSWORD);

    // Guardar XML firmado
    const signedXmlPath = path.join(__dirname, 'test_single_invoice_signed.xml');
    fs.writeFileSync(signedXmlPath, signedXml);
    console.log(`   📁 XML firmado guardado en: ${signedXmlPath}`);

    // Enviar
    console.log("   📤 Enviando a DIAN...");
    const compressed = await compressXMLToBase64(signedXml, `${invoiceNum}.xml`);
    const result = await sendSoap(compressed, `${invoiceNum}.zip`);

    console.log("\n📋 RESPUESTA DIAN:");
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.zipKey) {
        console.log("\n✅ DOCUMENTO RECIBIDO POR DIAN");
        console.log(`   ZipKey: ${result.zipKey}`);
        console.log("\n👉 Ahora ve al portal DIAN y verifica si este documento fue ACEPTADO");
    } else {
        console.log("\n❌ ERROR EN ENVÍO");
        console.log(`   Mensaje: ${result.error || result.message || 'Desconocido'}`);
    }
})();
