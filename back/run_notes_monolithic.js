require('dotenv').config();
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ====================== CONFIG ======================
const DIAN_CONFIG = {
    AMBIENTE: '2',
    SOFTWARE: {
        ID: process.env.DIAN_SOFTWARE_ID || '9e3fa0be-3172-41da-95f9-931df402183c',
        PIN: process.env.DIAN_PIN || '10223',
        TEST_SET_ID: process.env.DIAN_TEST_SET_ID || 'f4b78506-f6a7-4a26-8690-80f5461349f6'
    },
    RESOLUCION: {
        NUMERO: '18760000001',
        FECHA_DESDE: '2019-01-19',
        FECHA_HASTA: '2030-01-19',
        PREFIJO: process.env.DIAN_AMBIENTE === '1' ? (process.env.DIAN_PREFIJO || 'FE') : 'SETP',
        RANGO_DESDE: '990000000',
        RANGO_HASTA: '995000000'
    },
    EMISOR: {
        NIT: process.env.DIAN_NIT || '79401490', // Default from logs
        DV: '2',
        RAZON_SOCIAL: process.env.DIAN_RAZON_SOCIAL || 'LUIS MIGUEL MORENO CARDONA',
        NOMBRE_COMERCIAL: process.env.DIAN_NOMBRE_COMERCIAL || 'LMMC',
        CIUDAD: 'Bogotá',
        DEPARTAMENTO: 'Bogotá D.C.',
        DIRECCION: 'Calle 123',
        CODIGO_MUNICIPIO: '11001',
        CODIGO_DEPARTAMENTO: '11',
        TIPO_PERSONA: '2', // PJ
        RESPONSABILIDADES: ['O-13', 'O-15', 'O-23', 'O-47'],
        TELEFONO: '3000000000',
        EMAIL: 'test@crumi.com'
    }
};

const getEndpoint = () => ({ URL: "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl" });

// ====================== HELPERS ======================
const escapeXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const generateCUDE = (data) => {
    // CUDE: NumDoc + Fec + Hor + ValSub + CodImp1+ValImp1 + ... + ValTot + NitEmisor + NumAdq + Pin + Amb
    // Simplified for logic
    const s = `${data.noteNumber}${data.date}${data.time}${data.subtotal.toFixed(2)}01${data.taxAmount.toFixed(2)}040.00030.00${data.total.toFixed(2)}${data.emisor.NIT}${data.numDocAdquiriente}${data.pin}${data.tipoAmbiente}`;
    return crypto.createHash('sha384').update(s).digest('hex');
};
const generateSoftwareSecurityCode = (swId, pin, num) => crypto.createHash('sha384').update(`${swId}${pin}${num}`).digest('hex');
const generateQRCode = (cude, num, date, val, nit) => `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cude}`;

// ====================== TEMPLATES ======================
const buildCreditNoteXML = (data, cude) => {
    const { noteNumber, refInvoiceNumber, date, time, items, subtotal, taxAmount, total, notes, software, resolucion, emisor, client } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, noteNumber);
    const qrCode = generateQRCode(cude, noteNumber, date, total, emisor.NIT);
    const lines = items.map((item, index) => `
    <cac:CreditNoteLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:CreditedQuantity unitCode="94">${item.quantity}</cbc:CreditedQuantity>
        <cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory><cbc:Percent>${item.tax.toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">${item.code}</cbc:ID></cac:StandardItemIdentification></cac:Item>
        <cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price>
    </cac:CreditNoteLine>`).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <sts:DianExtensions>
                    <sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource>
                    <sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider>
                    <sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode>
                    <sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider>
                    <sts:QRCode>${qrCode}</sts:QRCode>
                </sts:DianExtensions>
            </ext:ExtensionContent>
        </ext:UBLExtension>
        <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>20</cbc:CustomizationID>
    <cbc:ProfileID>DIAN 2.1: Nota Crédito de Factura Electrónica de Venta</cbc:ProfileID>
    <cbc:ProfileExecutionID>${DIAN_CONFIG.AMBIENTE}</cbc:ProfileExecutionID>
    <cbc:ID>${noteNumber}</cbc:ID>
    <cbc:UUID schemeID="${DIAN_CONFIG.AMBIENTE}" schemeName="CUDE-SHA384">${cude}</cbc:UUID>
    <cbc:IssueDate>${date}</cbc:IssueDate>
    <cbc:IssueTime>${time}</cbc:IssueTime>
    <cbc:CreditNoteTypeCode>91</cbc:CreditNoteTypeCode>
    <cbc:Note>${escapeXml(notes)}</cbc:Note>
    <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric>
    <cac:DiscrepancyResponse><cbc:ReferenceID>${refInvoiceNumber}</cbc:ReferenceID><cbc:ResponseCode>2</cbc:ResponseCode><cbc:Description>Anulacion de factura electronica</cbc:Description></cac:DiscrepancyResponse>
    <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${refInvoiceNumber}</cbc:ID><cbc:UUID schemeName="CUFE-SHA384">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>
    <cac:AccountingSupplierParty><cbc:AdditionalAccountID>${emisor.TIPO_PERSONA}</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:CityName>${emisor.CIUDAD}</cbc:CityName><cbc:CountrySubentity>${emisor.DEPARTAMENTO}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</cbc:CompanyID><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty><cbc:AdditionalAccountID>${client.docType === 'NIT' ? '1' : '2'}</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeName="${client.docType}" schemeID="${client.dv}">${client.idNumber}</cbc:CompanyID><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingCustomerParty>
    <cac:PaymentMeans><cbc:ID>1</cbc:ID><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode><cbc:PaymentDueDate>${date}</cbc:PaymentDueDate></cac:PaymentMeans>
    <cac:TaxTotal><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
    <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount></cac:LegalMonetaryTotal>
    ${lines}
</CreditNote>`;
};

const buildDebitNoteXML = (data, cude) => {
    const { noteNumber, refInvoiceNumber, date, time, items, subtotal, taxAmount, total, notes, software, resolucion, emisor, client } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, noteNumber);
    const qrCode = generateQRCode(cude, noteNumber, date, total, emisor.NIT);
    const lines = items.map((item, index) => `
    <cac:DebitNoteLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:DebitedQuantity unitCode="94">${item.quantity}</cbc:DebitedQuantity>
        <cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory><cbc:Percent>${item.tax.toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item><cbc:Description>${escapeXml(item.description)}</cbc:Description><cac:StandardItemIdentification><cbc:ID schemeID="999">${item.code}</cbc:ID></cac:StandardItemIdentification></cac:Item>
        <cac:Price><cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount><cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity></cac:Price>
    </cac:DebitNoteLine>`).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <sts:DianExtensions>
                    <sts:InvoiceSource><cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode></sts:InvoiceSource>
                    <sts:SoftwareProvider><sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID><sts:SoftwareID>${software.ID}</sts:SoftwareID></sts:SoftwareProvider>
                    <sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode>
                    <sts:AuthorizationProvider><sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID></sts:AuthorizationProvider>
                    <sts:QRCode>${qrCode}</sts:QRCode>
                </sts:DianExtensions>
            </ext:ExtensionContent>
        </ext:UBLExtension>
        <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>30</cbc:CustomizationID>
    <cbc:ProfileID>DIAN 2.1: Nota Débito de Factura Electrónica de Venta</cbc:ProfileID>
    <cbc:ProfileExecutionID>${DIAN_CONFIG.AMBIENTE}</cbc:ProfileExecutionID>
    <cbc:ID>${noteNumber}</cbc:ID>
    <cbc:UUID schemeID="${DIAN_CONFIG.AMBIENTE}" schemeName="CUDE-SHA384">${cude}</cbc:UUID>
    <cbc:IssueDate>${date}</cbc:IssueDate>
    <cbc:IssueTime>${time}</cbc:IssueTime>
    <cbc:DebitNoteTypeCode>92</cbc:DebitNoteTypeCode>
    <cbc:Note>${escapeXml(notes)}</cbc:Note>
    <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric>
    <cac:DiscrepancyResponse><cbc:ReferenceID>${refInvoiceNumber}</cbc:ReferenceID><cbc:ResponseCode>3</cbc:ResponseCode><cbc:Description>Otros Conceptos</cbc:Description></cac:DiscrepancyResponse>
    <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${refInvoiceNumber}</cbc:ID><cbc:UUID schemeName="CUFE-SHA384">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</cbc:UUID><cbc:IssueDate>${date}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>
    <cac:AccountingSupplierParty><cbc:AdditionalAccountID>${emisor.TIPO_PERSONA}</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName><cac:PhysicalLocation><cac:Address><cbc:CityName>${emisor.CIUDAD}</cbc:CityName><cbc:CountrySubentity>${emisor.DEPARTAMENTO}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country></cac:Address></cac:PhysicalLocation><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</cbc:CompanyID><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty><cbc:AdditionalAccountID>${client.docType === 'NIT' ? '1' : '2'}</cbc:AdditionalAccountID><cac:Party><cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName><cac:PartyTaxScheme><cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName><cbc:CompanyID schemeAgencyID="195" schemeName="${client.docType}" schemeID="${client.dv}">${client.idNumber}</cbc:CompanyID><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme></cac:Party></cac:AccountingCustomerParty>
     <cac:TaxTotal><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount><cac:TaxCategory><cbc:Percent>19.00</cbc:Percent><cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
    <cac:RequestedMonetaryTotal><cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount></cac:RequestedMonetaryTotal>
    ${lines}
</DebitNote>`;
};

// ====================== SIGNER ======================
const signInvoiceXML = async (xmlContent, certPath, password) => {
    // Usamos el Java Signer del proyecto, llamandolo via shell como hace xadesEpesHelper
    // Para simplificar, asumimos que xadesEpesHelper funciona bien y lo importamos? 
    // Si importamos, arriesgamos el error circular.
    // Vamos a importar xadesEpesHelper PERO asegurandonos que no dependa de nada raro localmente.
    // xadesEpesHelper require './dianSignatureHelper' y './wsSecurityHelper'.
    // dianSignatureHelper require 'node-forge'.

    // Mejor intento usar el helper original para la firma, ya que el resto es lo que fallaba
    const { signInvoiceXML: signOriginal } = require('./src/helpers/xadesEpesHelper');
    return signOriginal(xmlContent, certPath, password);
};

const compressXMLToBase64 = (xmlContent, filename) => {
    return new Promise((resolve, reject) => {
        const buffers = [];
        const output = new PassThrough();
        output.on('data', chunk => buffers.push(chunk));
        output.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
        output.on('error', reject);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        archive.append(xmlContent, { name: filename });
        archive.finalize();
    });
};

const sendSoap = async (xmlBase64, filename) => {
    const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
    const CERT_DIR = path.join(__dirname, 'certificados');
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = getEndpoint().URL;
    const testSetId = DIAN_CONFIG.SOFTWARE.TEST_SET_ID;
    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendTestSetAsync" "${xmlBase64}" "${filename}" "${testSetId}" "${url}"`;
    const { stdout } = await execPromise(cmd, { cwd: __dirname });
    const start = stdout.indexOf("---JSON_START---");
    const end = stdout.indexOf("---JSON_END---");
    if (start === -1) throw new Error("Net Client Error output: " + stdout);
    return JSON.parse(stdout.substring(start + 16, end).trim());
};

(async () => {
    console.log("🚀 MONOLITHIC RUNNER START");
    try {
        const REF_INVOICE = 'SETP990004176';

        // --- 10+2 CREDIT NOTES ---
        for (let i = 0; i < 12; i++) {
            const noteNum = (990008000 + i).toString();
            console.log(`\n💳 NC ${noteNum}`);
            const data = {
                noteNumber: noteNum, refInvoiceNumber: REF_INVOICE,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0] + '-05:00',
                items: [{ description: 'Test', quantity: 1, unitPrice: 1000, lineTotal: 1000, lineBase: 1000, tax: 19, taxVal: 190, code: 'T1' }],
                subtotal: 1000, taxAmount: 190, total: 1190, notes: 'Test',
                software: DIAN_CONFIG.SOFTWARE, emisor: DIAN_CONFIG.EMISOR,
                client: { name: 'Test', idNumber: '222222222222', docType: '13', dv: '2' },
                resolucion: DIAN_CONFIG.RESOLUCION, pin: DIAN_CONFIG.SOFTWARE.PIN, tipoAmbiente: '2', numDocAdquiriente: '222222222222', nitEmisor: DIAN_CONFIG.EMISOR.NIT
            };
            const cude = generateCUDE(data);
            let xml = buildCreditNoteXML(data, cude);

            // Sign using imported helper (hope it works)
            const p12File = fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
            xml = await signInvoiceXML(xml, path.join(__dirname, 'certificados', p12File), process.env.DIAN_CERTIFICADO_PASSWORD);

            const zip = await compressXMLToBase64(xml, `${noteNum}.xml`);
            const res = await sendSoap(zip, `${noteNum}.zip`);
            if (res.success && res.dianResponse?.IsValid) console.log("   ✅ ACEPTADA");
            else console.log("   ❌ RECHAZADA", JSON.stringify(res.dianResponse));
        }

        // --- 10+2 DEBIT NOTES ---
        for (let i = 0; i < 12; i++) {
            const noteNum = (990009000 + i).toString();
            console.log(`\n📈 ND ${noteNum}`);
            const data = {
                noteNumber: noteNum, refInvoiceNumber: REF_INVOICE,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0] + '-05:00',
                items: [{ description: 'Test', quantity: 1, unitPrice: 1000, lineTotal: 1000, lineBase: 1000, tax: 19, taxVal: 190, code: 'T1' }],
                subtotal: 1000, taxAmount: 190, total: 1190, notes: 'Test',
                software: DIAN_CONFIG.SOFTWARE, emisor: DIAN_CONFIG.EMISOR,
                client: { name: 'Test', idNumber: '222222222222', docType: '13', dv: '2' },
                resolucion: DIAN_CONFIG.RESOLUCION, pin: DIAN_CONFIG.SOFTWARE.PIN, tipoAmbiente: '2', numDocAdquiriente: '222222222222', nitEmisor: DIAN_CONFIG.EMISOR.NIT
            };
            const cude = generateCUDE(data);
            let xml = buildDebitNoteXML(data, cude);
            const p12File = fs.readdirSync(path.join(__dirname, 'certificados')).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
            xml = await signInvoiceXML(xml, path.join(__dirname, 'certificados', p12File), process.env.DIAN_CERTIFICADO_PASSWORD);

            const zip = await compressXMLToBase64(xml, `${noteNum}.xml`);
            const res = await sendSoap(zip, `${noteNum}.zip`);
            if (res.success && res.dianResponse?.IsValid) console.log("   ✅ ACEPTADA");
            else console.log("   ❌ RECHAZADA", JSON.stringify(res.dianResponse));
        }

    } catch (e) { console.error(e); }
})();
