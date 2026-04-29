/**
 * Script para probar envío de factura en PRODUCCIÓN
 * ⚠️ CUIDADO: Este script envía facturas REALES a la DIAN
 */
const fs = require('fs');
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);
const archiver = require('archiver');
const { PassThrough } = require('stream');
const crypto = require('crypto');
require('dotenv').config();

// Forzar ambiente de producción
process.env.DIAN_AMBIENTE = '1';

// Cargar config después de setear el ambiente
const { DIAN_CONFIG, getEndpoint } = require('./src/config/dianConfig');
const { signInvoiceXML } = require('./src/helpers/xadesEpesHelper');

console.log('========================================');
console.log('🔴 MODO PRODUCCIÓN - FACTURAS REALES');
console.log('========================================');
console.log('Ambiente:', DIAN_CONFIG.AMBIENTE);
console.log('Resolución:', DIAN_CONFIG.RESOLUCION.NUMERO);
console.log('Prefijo:', DIAN_CONFIG.RESOLUCION.PREFIJO);
console.log('Endpoint:', getEndpoint().URL);
console.log('========================================');

const escapeXml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const generateCUFE = (data) => {
    const valImp1 = data.taxAmount1.toFixed(2);
    const valImp2 = (0).toFixed(2);
    const valImp3 = (0).toFixed(2);
    const s = `${data.invoiceNumber}${data.date}${data.time}${data.subtotal.toFixed(2)}01${valImp1}04${valImp2}03${valImp3}${data.total.toFixed(2)}${data.nitEmisor}${data.numDocAdquiriente}${data.claveTecnica}${data.tipoAmbiente}`;
    console.log('🔐 Cadena CUFE:', s);
    return crypto.createHash('sha384').update(s).digest('hex');
};

const generateSoftwareSecurityCode = (swId, pin, num) => crypto.createHash('sha384').update(`${swId}${pin}${num}`).digest('hex');
const generateQRCode = (cufe) => `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`;

const buildInvoiceXML = (data, cufe) => {
    const { invoiceNumber, date, time, items, subtotal, taxAmount, total, software, emisor, client, resolucion } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, invoiceNumber);
    const qrCode = generateQRCode(cufe);

    const lines = items.map((item, i) => `
    <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="94">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="COP">${item.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="COP">${item.lineBase.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="COP">${item.taxVal.toFixed(2)}</cbc:TaxAmount>
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
            <cbc:Description>${escapeXml(item.description)}</cbc:Description>
            <cac:StandardItemIdentification>
                <cbc:ID schemeID="999">I-${i}</cbc:ID>
            </cac:StandardItemIdentification>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity>
        </cac:Price>
    </cac:InvoiceLine>`).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <sts:DianExtensions>
                    <sts:InvoiceControl>
                        <sts:InvoiceAuthorization>${resolucion.NUMERO}</sts:InvoiceAuthorization>
                        <sts:AuthorizationPeriod>
                            <cbc:StartDate>${resolucion.FECHA_DESDE}</cbc:StartDate>
                            <cbc:EndDate>${resolucion.FECHA_HASTA}</cbc:EndDate>
                        </sts:AuthorizationPeriod>
                        <sts:AuthorizedInvoices>
                            <sts:Prefix>${resolucion.PREFIJO}</sts:Prefix>
                            <sts:From>${resolucion.RANGO_DESDE}</sts:From>
                            <sts:To>${resolucion.RANGO_HASTA}</sts:To>
                        </sts:AuthorizedInvoices>
                    </sts:InvoiceControl>
                    <sts:InvoiceSource>
                        <cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
                    </sts:InvoiceSource>
                    <sts:SoftwareProvider>
                        <sts:ProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</sts:ProviderID>
                        <sts:SoftwareID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${software.ID}</sts:SoftwareID>
                    </sts:SoftwareProvider>
                    <sts:SoftwareSecurityCode schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${softwareSecurityCode}</sts:SoftwareSecurityCode>
                    <sts:AuthorizationProvider>
                        <sts:AuthorizationProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="4">800197268</sts:AuthorizationProviderID>
                    </sts:AuthorizationProvider>
                    <sts:QRCode>${qrCode}</sts:QRCode>
                </sts:DianExtensions>
            </ext:ExtensionContent>
        </ext:UBLExtension>
        <ext:UBLExtension>
            <ext:ExtensionContent/>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>10</cbc:CustomizationID>
    <cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
    <cbc:ProfileExecutionID>1</cbc:ProfileExecutionID>
    <cbc:ID>${invoiceNumber}</cbc:ID>
    <cbc:UUID schemeID="1" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
    <cbc:IssueDate>${date}</cbc:IssueDate>
    <cbc:IssueTime>${time}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
    <cbc:Note>Factura de Produccion CRUMI</cbc:Note>
    <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric>
    <cac:AccountingSupplierParty>
        <cbc:AdditionalAccountID>1</cbc:AdditionalAccountID>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name>
            </cac:PartyName>
            <cac:PhysicalLocation>
                <cac:Address>
                    <cbc:ID>${emisor.CODIGO_MUNICIPIO}</cbc:ID>
                    <cbc:CityName>${escapeXml(emisor.CIUDAD)}</cbc:CityName>
                    <cbc:PostalZone>${emisor.CODIGO_MUNICIPIO}</cbc:PostalZone>
                    <cbc:CountrySubentity>${escapeXml(emisor.DEPARTAMENTO)}</cbc:CountrySubentity>
                    <cbc:CountrySubentityCode>${emisor.CODIGO_DEPARTAMENTO}</cbc:CountrySubentityCode>
                    <cac:AddressLine>
                        <cbc:Line>${escapeXml(emisor.DIRECCION)}</cbc:Line>
                    </cac:AddressLine>
                    <cac:Country>
                        <cbc:IdentificationCode>CO</cbc:IdentificationCode>
                        <cbc:Name languageID="es">Colombia</cbc:Name>
                    </cac:Country>
                </cac:Address>
            </cac:PhysicalLocation>
            <cac:PartyTaxScheme>
                <cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</cbc:CompanyID>
                <cbc:TaxLevelCode listName="48">${emisor.RESPONSABILIDADES.join(';')}</cbc:TaxLevelCode>
                <cac:TaxScheme>
                    <cbc:ID>01</cbc:ID>
                    <cbc:Name>IVA</cbc:Name>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</cbc:CompanyID>
                <cac:CorporateRegistrationScheme>
                    <cbc:ID>${resolucion.PREFIJO}</cbc:ID>
                </cac:CorporateRegistrationScheme>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cbc:AdditionalAccountID>2</cbc:AdditionalAccountID>
        <cac:Party>
            <cac:PartyIdentification> 
                 <cbc:ID schemeName="${client.docType}" schemeID="${client.dv}" schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${client.idNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>${escapeXml(client.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PhysicalLocation>
                <cac:Address>
                    <cbc:ID>${client.codigoMunicipio}</cbc:ID>
                    <cbc:CityName>${escapeXml(client.city)}</cbc:CityName>
                    <cbc:PostalZone>${client.codigoMunicipio}</cbc:PostalZone>
                    <cbc:CountrySubentity>${escapeXml(client.departamento)}</cbc:CountrySubentity>
                    <cbc:CountrySubentityCode>${client.codigoDepartamento}</cbc:CountrySubentityCode>
                    <cac:AddressLine>
                        <cbc:Line>${escapeXml(client.direccion)}</cbc:Line>
                    </cac:AddressLine>
                    <cac:Country>
                        <cbc:IdentificationCode>CO</cbc:IdentificationCode>
                        <cbc:Name languageID="es">Colombia</cbc:Name>
                    </cac:Country>
                </cac:Address>
            </cac:PhysicalLocation>
            <cac:PartyTaxScheme>
                <cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="${client.dv}">${client.idNumber}</cbc:CompanyID>
                <cbc:TaxLevelCode listName="48">R-99-PN</cbc:TaxLevelCode>
                <cac:TaxScheme>
                    <cbc:ID>01</cbc:ID>
                    <cbc:Name>IVA</cbc:Name>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeName="31" schemeID="${client.dv}">${client.idNumber}</cbc:CompanyID>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:PaymentMeans>
        <cbc:ID>1</cbc:ID>
        <cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>
        <cbc:PaymentDueDate>${date}</cbc:PaymentDueDate>
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
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
        <cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
    ${lines}
</Invoice>`;
};

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

const DOTNET_DLL_PATH = path.join(__dirname, 'dian-net-signer', 'bin', 'Debug', 'net8.0', 'dian-net-signer.dll');
const CERT_DIR = path.join(__dirname, 'certificados');

const sendSoap = async (xmlBase64, filename) => {
    const p12File = fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12') || f.endsWith('.pfx'));
    const p12Path = path.join(CERT_DIR, p12File);
    const password = process.env.DIAN_CERTIFICADO_PASSWORD;
    const url = getEndpoint().URL;

    // En producción usamos SendBillAsync (no SendTestSetAsync)
    const cmd = `dotnet "${DOTNET_DLL_PATH}" "${p12Path}" "${password}" "SendBillAsync" "${xmlBase64}" "${filename}" "null" "${url}"`;

    try {
        const { stdout } = await execPromise(cmd, { cwd: __dirname });
        const start = stdout.indexOf("---JSON_START---");
        const end = stdout.indexOf("---JSON_END---");
        if (start === -1) return { success: false, message: "NET ERROR: " + stdout, dianResponse: { IsValid: false } };
        return JSON.parse(stdout.substring(start + 16, end).trim());
    } catch (e) {
        return { success: false, error: e.message, dianResponse: { IsValid: false } };
    }
};

const run = async () => {
    console.log('\n🔴 ENVIANDO FACTURA DE PRODUCCIÓN...\n');

    // Datos de prueba - en producción real vendrían de la BD
    const client = {
        name: 'CONSUMIDOR FINAL',
        idNumber: '222222222222',
        docType: '13',
        dv: '7',
        city: 'Bogota',
        departamento: 'Bogota D.C.',
        codigoMunicipio: '11001',
        codigoDepartamento: '11',
        direccion: 'Calle 123',
        email: 'test@crumi.com'
    };

    const items = [{
        description: 'Servicio de Prueba Produccion',
        quantity: 1,
        unitPrice: 1000,
        lineTotal: 1000,
        lineBase: 1000,
        tax: 19,
        taxVal: 190,
        code: 'PROD-01'
    }];

    const subtotal = 1000, taxAmount = 190, total = 1190;

    // Número de factura - IMPORTANTE: empezar desde 1 para producción
    const invoiceNumber = DIAN_CONFIG.RESOLUCION.PREFIJO + '1';

    console.log(`📄 Factura: ${invoiceNumber}`);

    const now = new Date();
    const data = {
        invoiceNumber,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0] + '-05:00',
        items, subtotal, taxAmount, taxAmount1: 190, total,
        software: DIAN_CONFIG.SOFTWARE,
        emisor: DIAN_CONFIG.EMISOR,
        client,
        resolucion: DIAN_CONFIG.RESOLUCION,
        nitEmisor: DIAN_CONFIG.EMISOR.NIT,
        claveTecnica: DIAN_CONFIG.SOFTWARE.CLAVE_TECNICA,
        numDocAdquiriente: client.idNumber,
        tipoAmbiente: '1'  // PRODUCCIÓN
    };

    try {
        const cufe = generateCUFE(data);
        console.log('🔐 CUFE:', cufe);

        let xml = buildInvoiceXML(data, cufe);

        // Guardar XML sin firmar para debug
        fs.writeFileSync('production_invoice_unsigned.xml', xml);

        // Firmar
        const p12 = path.join(CERT_DIR, fs.readdirSync(CERT_DIR).find(f => f.endsWith('.p12')));
        xml = await signInvoiceXML(xml, p12, process.env.DIAN_CERTIFICADO_PASSWORD);

        // Guardar XML firmado
        fs.writeFileSync('production_invoice_signed.xml', xml);

        // Comprimir y enviar
        const res = await sendSoap(await compressXMLToBase64(xml, `${invoiceNumber}.xml`), `${invoiceNumber}.zip`);

        console.log('\n📨 RESPUESTA DIAN:');
        console.log(JSON.stringify(res, null, 2));

        fs.writeFileSync('production_response.json', JSON.stringify(res, null, 2));

        if (res.success) {
            console.log('\n✅ FACTURA ENVIADA EXITOSAMENTE');
            console.log('   ZipKey:', res.zipKey);
        } else {
            console.log('\n❌ ERROR EN ENVÍO');
            console.log('   Mensaje:', res.message || res.error);
        }

    } catch (e) {
        console.error('💥 Error:', e.message);
    }
};

run();
