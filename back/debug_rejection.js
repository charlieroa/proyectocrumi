require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');
const crypto = require('crypto');

// Config
const DIAN_CONFIG = {
    AMBIENTE: '2',
    SOFTWARE: {
        ID: 'cd7aa0f8-5eb5-49d7-9276-b55a79cfc260',
        PIN: '10223',
        TEST_SET_ID: 'ab2a8cdc-1c35-40b4-9728-3e9537637997'
    },
    RESOLUCION: {
        NUMERO: '18760000001',
        PREFIJO: process.env.DIAN_AMBIENTE === '1' ? (process.env.DIAN_PREFIJO || 'FE') : 'SETP',
        RANGO_DESDE: '990000000', RANGO_HASTA: '995000000'
    },
    EMISOR: {
        NIT: process.env.DIAN_NIT || '79401490', DV: '2', RAZON_SOCIAL: process.env.DIAN_RAZON_SOCIAL || 'LMMC',
        NOMBRE_COMERCIAL: 'LMMC', CIUDAD: 'Bogotá', DEPARTAMENTO: 'Bogotá D.C.', CODIGO_MUNICIPIO: '11001', CODIGO_DEPARTAMENTO: '11', TIPO_PERSONA: '2', RESPONSABILIDADES: ['O-13', 'O-15', 'O-23', 'O-47']
    }
};

const getEndpoint = () => ({ URL: "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl" });

// Helpers
const escapeXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const generateCUFE = (data) => {
    const s = `${data.invoiceNumber}${data.date}${data.time}${data.subtotal.toFixed(2)}01${data.taxAmount1.toFixed(2)}040.00030.00${data.total.toFixed(2)}${data.nitEmisor}${data.numDocAdquiriente}${data.claveTecnica}${data.tipoAmbiente}`;
    return crypto.createHash('sha384').update(s).digest('hex');
};
const generateSoftwareSecurityCode = (swId, pin, num) => crypto.createHash('sha384').update(`${swId}${pin}${num}`).digest('hex');
const generateQRCode = (cude, num, date, val, nit) => `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cude}`;

const compressXMLToBase64 = (xmlContent, filename) => {
    return new Promise((resolve, reject) => {
        const buffers = []; const output = new PassThrough(); output.on('data', c => buffers.push(c)); output.on('end', () => resolve(Buffer.concat(buffers).toString('base64'))); output.on('error', reject);
        const archive = archiver('zip', { zlib: { level: 9 } }); archive.pipe(output); archive.append(xmlContent, { name: filename }); archive.finalize();
    });
};

const buildInvoiceXML = (data, cufe) => {
    const { invoiceNumber, date, time, items, subtotal, taxAmount, total, software, emisor, client, resolucion } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, invoiceNumber);
    const qrCode = generateQRCode(cufe, invoiceNumber, date, total, emisor.NIT);
    const lines = items.map((item, i) => `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="94">${item.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">I-${i}</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions><sts:InvoiceControl><sts:InvoiceAuthorization>${resolucion.NUMERO}</sts:InvoiceAuthorization><sts:AuthorizationPeriod><cbc:StartDate>2019-01-19</cbc:StartDate><cbc:EndDate>2030-01-19</cbc:EndDate></sts:AuthorizationPeriod><sts:AuthorizedInvoices><sts:Prefix>${resolucion.PREFIJO}</sts:Prefix><sts:From>${resolucion.RANGO_DESDE}</sts:From><sts:To>${resolucion.RANGO_HASTA}</sts:To></sts:AuthorizedInvoices></sts:InvoiceControl><sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource><sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider><sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode><sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider><sts:QRCode>${qrCode}</sts:QRCode></sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID><cbc:CustomizationID>10</cbc:CustomizationID><cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID><cbc:ProfileExecutionID>2</cbc:ProfileExecutionID><cbc:ID>${invoiceNumber}</cbc:ID><cbc:UUID schemeID="2" schemeName="CUFE-SHA384">${cufe}</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate><cbc:IssueTime>${time}</cbc:IssueTime><cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric><cac:AccountingSupplierParty><cbc:AdditionalAccountID>2</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:CityName>Bogota</cbc:CityName><cbc:CountrySubentity>Bogota</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</cbc:CompanyID><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cbc:AdditionalAccountID>2</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeName="13" schemeID="${client.dv}">${client.idNumber}</cbc:CompanyID><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingCustomerParty><cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode><cbc:PaymentDueDate>${date}</cbc:PaymentDueDate></cac:PaymentMeans><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`;
}

const signInvoiceXML = async (xmlContent, certPath, password) => {
    // Rely on xadesEpesHelper
    const { signInvoiceXML: signOriginal } = require('./src/helpers/xadesEpesHelper');
    return signOriginal(xmlContent, certPath, password);
};

(async () => {
    try {
        console.log("🐛 Debugging ONE Invoice Rejection... (2019 VERSION)");

        // Data
        const num = (990000000 + Math.floor(Math.random() * 1000000)).toString();
        const client = { name: 'CONSUMIDOR FINAL', idNumber: '222222222222', docType: '13', dv: '2', city: 'Bogota', departamento: 'Bogota D.C.', codigoMunicipio: '11001', codigoDepartamento: '11', direccion: 'Calle 123', email: 'test@crumi.com' };
        const items = [{ description: 'Test', quantity: 1, unitPrice: 1000, lineTotal: 1000, lineBase: 1000, tax: 19, taxVal: 190, code: 'T1' }];
        const subtotal = 1000, taxAmount = 190, total = 1190;
        const data = {
            invoiceNumber: num,
            date: '2019-05-20',   // <--- FORCE 2019 DATE
            time: '12:00:00-05:00',
            items, subtotal, taxAmount, taxAmount1: 190, total, software: DIAN_CONFIG.SOFTWARE, emisor: DIAN_CONFIG.EMISOR, client, resolucion: DIAN_CONFIG.RESOLUCION, nitEmisor: DIAN_CONFIG.EMISOR.NIT, claveTecnica: DIAN_CONFIG.SOFTWARE.PIN, numDocAdquiriente: client.idNumber, tipoAmbiente: '2'
        };

        // Build & Sign
        console.log("   Building XML for " + num);
        let xml = buildInvoiceXML(data, generateCUFE(data));

        console.log("   Signing...");
        const p12 = path.join(__dirname, 'certificados', fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12')));
        xml = await signInvoiceXML(xml, p12, process.env.DIAN_CERTIFICADO_PASSWORD);

        // Send
        console.log("   Sending to " + getEndpoint().URL);
        const zip = await compressXMLToBase64(xml, `${num}.xml`);

        const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
        const p12Path = p12;
        const password = process.env.DIAN_CERTIFICADO_PASSWORD;
        const url = getEndpoint().URL;
        const testSetId = DIAN_CONFIG.SOFTWARE.TEST_SET_ID;
        const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendTestSetAsync" "${zip}" "${num}.zip" "${testSetId}" "${url}"`;

        const { stdout, stderr } = await execPromise(cmd, { cwd: __dirname });
        console.log("NET STDERR:", stderr);

        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");

        if (start !== -1) {
            const jsonPart = stdout.substring(start + 16, end).trim();
            console.log("👇 DIAN RESPONSE JSON 👇");
            console.log(jsonPart);
            fs.writeFileSync('response_debug.json', jsonPart);
        } else {
            console.log("👇 RAW STDOUT 👇");
            console.log(stdout);
            fs.writeFileSync('response_debug_raw.txt', stdout);
        }

    } catch (e) {
        console.error("💥 CRASH:", e);
    }
})();
