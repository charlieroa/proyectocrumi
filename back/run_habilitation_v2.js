require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');
const crypto = require('crypto');

// ====================== CONFIG CORRECTO V2 ======================
const TODAY = new Date().toISOString().split('T')[0];
const NOW_TIME = new Date().toTimeString().split(' ')[0] + '-05:00';

const DIAN_CONFIG = {
    AMBIENTE: '2',
    SOFTWARE: {
        ID: 'cd7aa0f8-5eb5-49d7-9276-b55a79cfc260',
        PIN: '10225',
        CLAVE_TECNICA: 'fc8eac422eba16e22ffd8c6f5', // <-- CLAVE TÉCNICA PARA CUFE (diferente al PIN!)
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
        DV: '4',  // <-- DV CORRECTO CALCULADO
        RAZON_SOCIAL: 'CRUMI S.A.S',
        NOMBRE_COMERCIAL: 'CRUMI',
        CIUDAD: 'Bogotá', DEPARTAMENTO: 'Bogotá D.C.', CODIGO_MUNICIPIO: '11001', CODIGO_DEPARTAMENTO: '11', TIPO_PERSONA: '1',
        RESPONSABILIDADES: ['O-13', 'O-15', 'O-23', 'O-47']
    }
};

// Helpers
const escapeXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const generateCUFE = (data) => {
    // CUFE usa Clave Técnica, NO el PIN
    const s = `${data.invoiceNumber}${data.date}${data.time}${data.subtotal.toFixed(2)}01${data.taxAmount1.toFixed(2)}040.00030.00${data.total.toFixed(2)}${data.nitEmisor}${data.numDocAdquiriente}${data.claveTecnica}${data.tipoAmbiente}`;
    return crypto.createHash('sha384').update(s).digest('hex');
};
const generateCUDE = (data) => {
    const s = `${data.noteNumber}${data.date}${data.time}${data.subtotal.toFixed(2)}01${data.taxAmount.toFixed(2)}040.00030.00${data.total.toFixed(2)}${data.emisor.NIT}${data.numDocAdquiriente}${data.pin}${data.tipoAmbiente}`;
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
        const start = stdout.indexOf("---JSON_START---"); const end = stdout.indexOf("---JSON_END---");
        if (start === -1) return { success: false, message: "NET ERROR: " + stdout };
        return JSON.parse(stdout.substring(start + 16, end).trim());
    } catch (e) { return { success: false, error: e.message }; }
};

// XML Builders
const buildInvoiceXML = (data, cufe) => {
    const { invoiceNumber, date, time, items, subtotal, taxAmount, total, software, emisor, client, resolucion } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, invoiceNumber);
    const qrCode = generateQRCode(cufe, invoiceNumber, date, total, emisor.NIT);
    const lines = items.map((item, i) => `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="94">${item.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">I-${i}</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions><sts:InvoiceControl><sts:InvoiceAuthorization>${resolucion.NUMERO}</sts:InvoiceAuthorization><sts:AuthorizationPeriod><cbc:StartDate>2019-01-19</cbc:StartDate><cbc:EndDate>2030-01-19</cbc:EndDate></sts:AuthorizationPeriod><sts:AuthorizedInvoices><sts:Prefix>${resolucion.PREFIJO}</sts:Prefix><sts:From>${resolucion.RANGO_DESDE}</sts:From><sts:To>${resolucion.RANGO_HASTA}</sts:To></sts:AuthorizedInvoices></sts:InvoiceControl><sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource><sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider><sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode><sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider><sts:QRCode>${qrCode}</sts:QRCode></sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID><cbc:CustomizationID>10</cbc:CustomizationID><cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID><cbc:ProfileExecutionID>2</cbc:ProfileExecutionID><cbc:ID>${invoiceNumber}</cbc:ID><cbc:UUID schemeID="2" schemeName="CUFE-SHA384">${cufe}</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate><cbc:IssueTime>${time}</cbc:IssueTime><cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric><cac:AccountingSupplierParty><cbc:AdditionalAccountID>1</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:PostalZone>110111</cbc:PostalZone><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Principal 123</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID><cbc:TaxLevelCode listName="48">O-99</cbc:TaxLevelCode><cac:RegistrationAddress><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:PostalZone>110111</cbc:PostalZone><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Principal 123</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:RegistrationAddress><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID><cac:CorporateRegistrationScheme><cbc:ID>${resolucion.PREFIJO}</cbc:ID></cac:CorporateRegistrationScheme></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>hola@crumi.ai</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cbc:AdditionalAccountID>2</cbc:AdditionalAccountID><cac:Party><cac:PartyIdentification><cbc:ID schemeName="13">${client.idNumber}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Cliente 456</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID><cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No causa</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>cliente@test.com</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingCustomerParty><cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode><cbc:PaymentDueDate>${date}</cbc:PaymentDueDate></cac:PaymentMeans><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cbc:RoundingAmount currencyID="COP">0.00</cbc:RoundingAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`;
};

const buildCreditNoteXML = (data, cude) => {
    const { noteNumber, refInvoiceNumber, refCUFE, date, time, items, subtotal, taxAmount, total, notes, software, resolucion, emisor, client } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, noteNumber);
    const qrCode = generateQRCode(cude, noteNumber, date, total, emisor.NIT);
    const lines = items.map((item, index) => `<cac:CreditNoteLine><cbc:ID>${index + 1}</cbc:ID><cbc:CreditedQuantity unitCode="94">${item.quantity}</cbc:CreditedQuantity><cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>${item.tax.toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">${item.code}</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price></cac:CreditNoteLine>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions><sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource><sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider><sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode><sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider><sts:QRCode>${qrCode}</sts:QRCode></sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID><cbc:CustomizationID>20</cbc:CustomizationID><cbc:ProfileID>DIAN 2.1: Nota Crédito de Factura Electrónica de Venta</cbc:ProfileID><cbc:ProfileExecutionID>2</cbc:ProfileExecutionID><cbc:ID>${noteNumber}</cbc:ID><cbc:UUID schemeID="2" schemeName="CUDE-SHA384">${cude}</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate><cbc:IssueTime>${time}</cbc:IssueTime><cbc:CreditNoteTypeCode>91</cbc:CreditNoteTypeCode><cbc:Note>${escapeXml(notes)}</cbc:Note><cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric><cac:DiscrepancyResponse><cbc:ReferenceID>${refInvoiceNumber}</cbc:ReferenceID><cbc:ResponseCode>2</cbc:ResponseCode><cbc:Description>Anulacion de factura</cbc:Description></cac:DiscrepancyResponse><cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${refInvoiceNumber}</cbc:ID><cbc:UUID schemeName="CUFE-SHA384">${refCUFE}</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference><cac:AccountingSupplierParty><cbc:AdditionalAccountID>1</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Principal 123</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID><cbc:TaxLevelCode listName="48">O-99</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>hola@crumi.ai</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cbc:AdditionalAccountID>2</cbc:AdditionalAccountID><cac:Party><cac:PartyIdentification><cbc:ID schemeName="13">${client.idNumber}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Cliente 456</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID><cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No causa</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>cliente@test.com</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingCustomerParty><cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>10</cbc:PaymentMeansCode><cbc:PaymentDueDate>${date}</cbc:PaymentDueDate></cac:PaymentMeans><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cbc:RoundingAmount currencyID="COP">0.00</cbc:RoundingAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</CreditNote>`;
};

const buildDebitNoteXML = (data, cude) => {
    const { noteNumber, refInvoiceNumber, refCUFE, date, time, items, subtotal, taxAmount, total, notes, software, resolucion, emisor, client } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, noteNumber);
    const qrCode = generateQRCode(cude, noteNumber, date, total, emisor.NIT);
    const lines = items.map((item, index) => `<cac:DebitNoteLine><cbc:ID>${index + 1}</cbc:ID><cbc:DebitedQuantity unitCode="94">${item.quantity}</cbc:DebitedQuantity><cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>${item.tax.toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">${item.code}</cbc:ID></cac:StandardItemIdentification></cac:Item><cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price></cac:DebitNoteLine>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><sts:DianExtensions><sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource><sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider><sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode><sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider><sts:QRCode>${qrCode}</sts:QRCode></sts:DianExtensions></ext:ExtensionContent></ext:UBLExtension><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions><cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID><cbc:CustomizationID>30</cbc:CustomizationID><cbc:ProfileID>DIAN 2.1: Nota Débito de Factura Electrónica de Venta</cbc:ProfileID><cbc:ProfileExecutionID>2</cbc:ProfileExecutionID><cbc:ID>${noteNumber}</cbc:ID><cbc:UUID schemeID="2" schemeName="CUDE-SHA384">${cude}</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate><cbc:IssueTime>${time}</cbc:IssueTime><cbc:DebitNoteTypeCode>92</cbc:DebitNoteTypeCode><cbc:Note>${escapeXml(notes)}</cbc:Note><cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric><cac:DiscrepancyResponse><cbc:ReferenceID>${refInvoiceNumber}</cbc:ReferenceID><cbc:ResponseCode>1</cbc:ResponseCode><cbc:Description>Intereses</cbc:Description></cac:DiscrepancyResponse><cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${refInvoiceNumber}</cbc:ID><cbc:UUID schemeName="CUFE-SHA384">${refCUFE}</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference><cac:AccountingSupplierParty><cbc:AdditionalAccountID>1</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Principal 123</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID><cbc:TaxLevelCode listName="48">O-99</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>hola@crumi.ai</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingSupplierParty><cac:AccountingCustomerParty><cbc:AdditionalAccountID>2</cbc:AdditionalAccountID><cac:Party><cac:PartyIdentification><cbc:ID schemeName="13">${client.idNumber}</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:ID>11001</cbc:ID><cbc:CityName>Bogotá, D.C.</cbc:CityName><cbc:CountrySubentity>Bogotá</cbc:CountrySubentity><cbc:CountrySubentityCode>11</cbc:CountrySubentityCode><cac:AddressLine><cbc:Line>Calle Cliente 456</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID><cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode><cac:TaxScheme><cbc:ID>ZZ</cbc:ID><cbc:Name>No causa</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv}" schemeName="13">${client.idNumber}</cbc:CompanyID></cac:PartyLegalEntity><cac:Contact><cbc:ElectronicMail>cliente@test.com</cbc:ElectronicMail></cac:Contact></cac:Party></cac:AccountingCustomerParty><cac:TaxTotal><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cbc:RoundingAmount currencyID="COP">0.00</cbc:RoundingAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:RequestedMonetaryTotal><cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount></cac:RequestedMonetaryTotal>${lines}</DebitNote>`;
};

const run = async () => {
    console.log(`🚀 BATCH V2 CORREGIDO - NIT: ${DIAN_CONFIG.EMISOR.NIT}-${DIAN_CONFIG.EMISOR.DV} (${DIAN_CONFIG.EMISOR.RAZON_SOCIAL})`);
    console.log(`📅 Fecha: ${TODAY} ${NOW_TIME}`);
    console.log(`🔑 Software ID: ${DIAN_CONFIG.SOFTWARE.ID}`);
    console.log(`🔐 PIN: ${DIAN_CONFIG.SOFTWARE.PIN}`);
    console.log(`📋 TestSetId: ${DIAN_CONFIG.SOFTWARE.TEST_SET_ID}\n`);

    const client = { name: 'CONSUMIDOR FINAL', idNumber: '222222222222', docType: '13', dv: '0' };
    const items = [{ description: 'Servicio de Prueba DIAN', quantity: 1, unitPrice: 10000, lineTotal: 10000, lineBase: 10000, tax: 19, taxVal: 1900, code: 'SRV001' }];
    const subtotal = 10000, taxAmount = 1900, total = 11900;

    let successCount = 0, failCount = 0;

    // NUMEROS NUEVOS para evitar duplicados (V3 - empezamos desde 990080000)
    const BASE_FC = 990080000;
    const BASE_NC = 990090000;
    const BASE_ND = 990100000;

    // Almacenar CUFEs de facturas para usarlos en NC/ND
    const invoiceCUFEs = [];
    const invoiceNumbers = [];

    // 1. FACTURAS (30)
    console.log("📄 === FACTURAS (30) ===");
    for (let i = 1; i <= 30; i++) {
        const num = `SETP${BASE_FC + i}`;
        const data = {
            invoiceNumber: num, date: TODAY, time: NOW_TIME,
            items, subtotal, taxAmount, taxAmount1: 1900, total,
            software: DIAN_CONFIG.SOFTWARE, emisor: DIAN_CONFIG.EMISOR, client, resolucion: DIAN_CONFIG.RESOLUCION,
            nitEmisor: DIAN_CONFIG.EMISOR.NIT, claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA, numDocAdquiriente: client.idNumber, tipoAmbiente: '2'
        };

        const cufe = generateCUFE(data);
        invoiceCUFEs.push(cufe);
        invoiceNumbers.push(num);

        let xml = buildInvoiceXML(data, cufe);
        const p12 = path.join(__dirname, 'certificados', fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12')));
        xml = await signInvoiceXML(xml, p12, process.env.DIAN_CERTIFICADO_PASSWORD);
        const res = await sendSoap(await compressXMLToBase64(xml, `${num}.xml`), `${num}.zip`);

        if (res.success && res.zipKey) { console.log(`   ✅ [${i}/30] ${num}`); successCount++; }
        else { console.log(`   ❌ [${i}/30] ${num} - ${res.error || res.message || ''}`); failCount++; }
        await new Promise(r => setTimeout(r, 600));
    }

    // 2. NOTAS CRÉDITO (10)
    console.log("\n💳 === NOTAS CRÉDITO (10) ===");
    for (let i = 1; i <= 10; i++) {
        const num = `SETP${BASE_NC + i}`;
        const refNum = invoiceNumbers[i - 1];
        const refCUFE = invoiceCUFEs[i - 1];

        const data = {
            noteNumber: num, refInvoiceNumber: refNum, refCUFE, date: TODAY, time: NOW_TIME,
            notes: 'Nota Crédito por anulación', items, subtotal, taxAmount, total,
            software: DIAN_CONFIG.SOFTWARE, emisor: DIAN_CONFIG.EMISOR, client, resolucion: DIAN_CONFIG.RESOLUCION,
            pin: DIAN_CONFIG.SOFTWARE.PIN, tipoAmbiente: '2', numDocAdquiriente: client.idNumber
        };

        let xml = buildCreditNoteXML(data, generateCUDE(data));
        const p12 = path.join(__dirname, 'certificados', fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12')));
        xml = await signInvoiceXML(xml, p12, process.env.DIAN_CERTIFICADO_PASSWORD);
        const res = await sendSoap(await compressXMLToBase64(xml, `${num}.xml`), `${num}.zip`);

        if (res.success && res.zipKey) { console.log(`   ✅ [${i}/10] ${num}`); successCount++; }
        else { console.log(`   ❌ [${i}/10] ${num} - ${res.error || res.message || ''}`); failCount++; }
        await new Promise(r => setTimeout(r, 600));
    }

    // 3. NOTAS DÉBITO (10)
    console.log("\n📈 === NOTAS DÉBITO (10) ===");
    for (let i = 1; i <= 10; i++) {
        const num = `SETP${BASE_ND + i}`;
        const refNum = invoiceNumbers[i - 1];
        const refCUFE = invoiceCUFEs[i - 1];

        const data = {
            noteNumber: num, refInvoiceNumber: refNum, refCUFE, date: TODAY, time: NOW_TIME,
            notes: 'Nota Débito por intereses', items, subtotal, taxAmount, total,
            software: DIAN_CONFIG.SOFTWARE, emisor: DIAN_CONFIG.EMISOR, client, resolucion: DIAN_CONFIG.RESOLUCION,
            pin: DIAN_CONFIG.SOFTWARE.PIN, tipoAmbiente: '2', numDocAdquiriente: client.idNumber
        };

        let xml = buildDebitNoteXML(data, generateCUDE(data));
        const p12 = path.join(__dirname, 'certificados', fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12')));
        xml = await signInvoiceXML(xml, p12, process.env.DIAN_CERTIFICADO_PASSWORD);
        const res = await sendSoap(await compressXMLToBase64(xml, `${num}.xml`), `${num}.zip`);

        if (res.success && res.zipKey) { console.log(`   ✅ [${i}/10] ${num}`); successCount++; }
        else { console.log(`   ❌ [${i}/10] ${num} - ${res.error || res.message || ''}`); failCount++; }
        await new Promise(r => setTimeout(r, 600));
    }

    console.log(`\n🏁 COMPLETADO: ${successCount} exitosos, ${failCount} fallidos de 50 total`);
};

run();
