const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const JSZip = require('jszip');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ============================================
// CONFIGURACIÓN
// ============================================
require('dotenv').config();

const CERT_DIR = path.join(__dirname, 'certificados');
const FIRMADOR_JAR = path.join(CERT_DIR, 'firmador.jar');
const OUTPUT_DIR = path.join(__dirname, 'diagnostico_output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// ============================================
// FUNCIONES AUXILIARES
// ============================================
const sha384 = (str) => crypto.createHash('sha384').update(str).digest('hex');

const getCertPassword = () => process.env.DIAN_CERTIFICADO_PASSWORD;

const getP12Path = () => {
    const files = fs.readdirSync(CERT_DIR);
    const p12 = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    return path.join(CERT_DIR, p12);
};

// ============================================
// 1. GENERAR XML DE PRUEBA (Simplificado)
// ============================================
const generateTestXML = () => {
    const invoiceNumber = 'SETP990000099'; // Número nuevo para evitar duplicados
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].split('.')[0] + '-05:00';

    // Estos valores deben coincidir con tu set de pruebas
    const NIT = '902006720';
    const SOFTWARE_ID = '3e633a21-86c8-4646-ba4d-b11ddb1446';
    const PIN = '75315';
    const TECH_KEY = 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c';

    const softwareSecurityCode = sha384(`${SOFTWARE_ID}${PIN}${invoiceNumber}`);

    // CUFE: NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmb
    // ValFac=1000.00, ValImp1=190.00, ValTot=1190.00, NumAdq=222222222222, TipoAmb=2
    const cufeRaw = `${invoiceNumber}${date}${time}1000.0001190.00040.00030.001190.00${NIT}222222222222${TECH_KEY}2`;
    const cufe = sha384(cufeRaw);

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" 
xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" 
xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" 
xmlns:ds="http://www.w3.org/2000/09/xmldsig#" 
xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" 
xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" 
xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" 
xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#">
<ext:UBLExtensions>
<ext:UBLExtension>
<ext:ExtensionContent>
<sts:DianExtensions>
<sts:InvoiceControl>
<sts:InvoiceAuthorization>18760000001</sts:InvoiceAuthorization>
<sts:AuthorizationPeriod>
<cbc:StartDate>2019-01-19</cbc:StartDate>
<cbc:EndDate>2030-01-19</cbc:EndDate>
</sts:AuthorizationPeriod>
<sts:AuthorizedInvoices>
<sts:Prefix>SETP</sts:Prefix>
<sts:From>990000000</sts:From>
<sts:To>995000000</sts:To>
</sts:AuthorizedInvoices>
</sts:InvoiceControl>
<sts:InvoiceSource>
<cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
</sts:InvoiceSource>
<sts:SoftwareProvider>
<sts:ProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="4" schemeName="31">${NIT}</sts:ProviderID>
<sts:SoftwareID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${SOFTWARE_ID}</sts:SoftwareID>
</sts:SoftwareProvider>
<sts:SoftwareSecurityCode schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${softwareSecurityCode}</sts:SoftwareSecurityCode>
<sts:AuthorizationProvider>
<sts:AuthorizationProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="4" schemeName="31">800197268</sts:AuthorizationProviderID>
</sts:AuthorizationProvider>
<sts:QRCode>https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cufe}</sts:QRCode>
</sts:DianExtensions>
</ext:ExtensionContent>
</ext:UBLExtension>
<ext:UBLExtension>
<ext:ExtensionContent>
<!-- Espacio reservado para firma digital XAdES-EPES -->
</ext:ExtensionContent>
</ext:UBLExtension>
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
<cbc:LineCountNumeric>1</cbc:LineCountNumeric>
<cac:InvoicePeriod>
<cbc:StartDate>${date}</cbc:StartDate>
<cbc:EndDate>${date}</cbc:EndDate>
<cbc:DescriptionCode>1</cbc:DescriptionCode>
</cac:InvoicePeriod>
<cac:AccountingSupplierParty>
<cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
<cac:Party>
<cac:PartyTaxScheme>
<cbc:RegistrationName>CRUMI S.A.S</cbc:RegistrationName>
<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="4" schemeName="31">${NIT}</cbc:CompanyID>
<cbc:TaxLevelCode listName="48">O-47</cbc:TaxLevelCode>
<cac:RegistrationAddress>
<cbc:ID>25126</cbc:ID>
<cbc:CityName>Cajica</cbc:CityName>
<cbc:CountrySubentity>Cundinamarca</cbc:CountrySubentity>
<cbc:CountrySubentityCode>25</cbc:CountrySubentityCode>
<cac:AddressLine>
<cbc:Line>Centro Empresarial</cbc:Line>
</cac:AddressLine>
<cac:Country>
<cbc:IdentificationCode>CO</cbc:IdentificationCode>
<cbc:Name languageID="es">Colombia</cbc:Name>
</cac:Country>
</cac:RegistrationAddress>
<cac:TaxScheme>
<cbc:ID>01</cbc:ID>
<cbc:Name>IVA</cbc:Name>
</cac:TaxScheme>
</cac:PartyTaxScheme>
</cac:Party>
</cac:AccountingSupplierParty>
<cac:AccountingCustomerParty>
<cbc:AdditionalAccountID>2</cbc:AdditionalAccountID>
<cac:Party>
<cac:PartyTaxScheme>
<cbc:RegistrationName>CONSUMIDOR FINAL</cbc:RegistrationName>
<cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="7" schemeName="13">222222222222</cbc:CompanyID>
<cbc:TaxLevelCode listName="48">O-99</cbc:TaxLevelCode>
<cac:TaxScheme>
<cbc:ID>01</cbc:ID>
<cbc:Name>IVA</cbc:Name>
</cac:TaxScheme>
</cac:PartyTaxScheme>
</cac:Party>
</cac:AccountingCustomerParty>
<cac:PaymentMeans>
<cbc:ID>1</cbc:ID>
<cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>
<cbc:PaymentDueDate>${date}</cbc:PaymentDueDate>
</cac:PaymentMeans>
<cac:TaxTotal>
<cbc:TaxAmount currencyID="COP">190.00</cbc:TaxAmount>
<cac:TaxSubtotal>
<cbc:TaxableAmount currencyID="COP">1000.00</cbc:TaxableAmount>
<cbc:TaxAmount currencyID="COP">190.00</cbc:TaxAmount>
<cac:TaxCategory>
<cbc:Percent>19.00</cbc:Percent>
<cac:TaxScheme>
<cbc:ID>01</cbc:ID>
<cbc:Name>IVA</cbc:Name>
</cac:TaxScheme>
</cac:TaxCategory>
</cac:TaxSubtotal>
</cac:TaxTotal>
<cac:LegalMonetaryTotal>
<cbc:LineExtensionAmount currencyID="COP">1000.00</cbc:LineExtensionAmount>
<cbc:TaxExclusiveAmount currencyID="COP">1000.00</cbc:TaxExclusiveAmount>
<cbc:TaxInclusiveAmount currencyID="COP">1190.00</cbc:TaxInclusiveAmount>
<cbc:PayableAmount currencyID="COP">1190.00</cbc:PayableAmount>
</cac:LegalMonetaryTotal>
<cac:InvoiceLine>
<cbc:ID>1</cbc:ID>
<cbc:InvoicedQuantity unitCode="94">1</cbc:InvoicedQuantity>
<cbc:LineExtensionAmount currencyID="COP">1000.00</cbc:LineExtensionAmount>
<cac:TaxTotal>
<cbc:TaxAmount currencyID="COP">190.00</cbc:TaxAmount>
<cac:TaxSubtotal>
<cbc:TaxableAmount currencyID="COP">1000.00</cbc:TaxableAmount>
<cbc:TaxAmount currencyID="COP">190.00</cbc:TaxAmount>
<cac:TaxCategory>
<cbc:Percent>19.00</cbc:Percent>
<cac:TaxScheme>
<cbc:ID>01</cbc:ID>
<cbc:Name>IVA</cbc:Name>
</cac:TaxScheme>
</cac:TaxCategory>
</cac:TaxSubtotal>
</cac:TaxTotal>
<cac:Item>
<cbc:Description>Prueba Diagnostico</cbc:Description>
</cac:Item>
<cac:Price>
<cbc:PriceAmount currencyID="COP">1000.00</cbc:PriceAmount>
</cac:Price>
</cac:InvoiceLine>
</Invoice>`;
};

// ============================================
// 2. FIRMAR XML (Java)
// ============================================
const signXML = async (xmlPath, outputPath) => {
    console.log('FIRMANDO XML...');
    const p12 = getP12Path();
    const pass = getCertPassword();
    const cmd = `java -jar "${FIRMADOR_JAR}" "${p12}" "${pass}" "${xmlPath}" "${outputPath}"`;

    await execPromise(cmd, { cwd: CERT_DIR });
    console.log('XML Firmado OK');
};

// ============================================
// 3. COMPRIMIR XML
// ============================================
const zipXML = async (xmlPath, filename) => {
    console.log('COMPRIMIENDO XML...');
    const zip = new JSZip();
    const content = fs.readFileSync(xmlPath);
    zip.file(filename, content);
    const zipped = await zip.generateAsync({ type: 'nodebuffer' });
    return zipped;
};

// ============================================
// 4. ENVIAR A DIAN
// ============================================
const sendToDian = async (zipBuffer, filename) => {
    console.log('ENVIANDO A DIAN...');
    const contentInfo = zipBuffer.toString('base64');

    const soapBody = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wcf="http://wcf.dian.colombia">
   <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
      <wsa:Action>http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync</wsa:Action>
      <wsa:To>https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc</wsa:To>
   </soap:Header>
   <soap:Body>
      <wcf:SendTestSetAsync>
         <wcf:fileName>${filename}.zip</wcf:fileName>
         <wcf:contentFile>${contentInfo}</wcf:contentFile>
         <wcf:testSetId>88820f4b-017e-4623-afc6-66444d32f50f</wcf:testSetId>
      </wcf:SendTestSetAsync>
   </soap:Body>
</soap:Envelope>`;

    try {
        const response = await axios.post(
            'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
            soapBody,
            {
                headers: {
                    'Content-Type': 'application/soap+xml;charset=UTF-8;action="http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync"',
                    'User-Agent': 'Apache-HttpClient/4.5.5 (Java/12.0.1)'
                }
            }
        );
        console.log('RESPUESTA DIAN (Success):');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('RESPUESTA DIAN (Error):');
        if (error.response) {
            console.error('STATUS:', error.response.status);
            fs.writeFileSync('error_dian.xml', error.response.data);
            console.log('Error completo guardado en error_dian.xml');
        } else {
            console.error(error.message);
        }
    }
};

// ============================================
// MAIN
// ============================================
const run = async () => {
    try {
        const xml = generateTestXML();
        const xmlPath = path.join(OUTPUT_DIR, 'test_unsigned.xml');
        const signedPath = path.join(OUTPUT_DIR, 'test_signed.xml');

        fs.writeFileSync(xmlPath, xml);
        await signXML(xmlPath, signedPath);

        const zipBuffer = await zipXML(signedPath, 'SETP990000099.xml');
        await sendToDian(zipBuffer, 'SETP990000099');

    } catch (e) {
        console.error('ERROR FATAL:', e);
    }
};

run();
