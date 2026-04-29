// src/helpers/dianHelper.js
// Helper completo para Facturación Electrónica DIAN Colombia
// Genera XML UBL 2.1, CUFE, y estructura para firma digital

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { DIAN_CONFIG, calcularDV } = require('../config/dianConfig');

// ============================================
// GENERAR CUFE (Código Único de Factura Electrónica)
// ============================================
const generateCUFE = (data) => {
    const {
        invoiceNumber,      // NumFac
        date,               // FecFac (YYYY-MM-DD)
        time,               // HorFac (HH:MM:SS-05:00)
        subtotal,           // ValFac (Base imponible)
        taxCode1 = '01',    // CodImp1 (IVA)
        taxAmount1 = 0,     // ValImp1
        taxCode2 = '04',    // CodImp2 (INC)
        taxAmount2 = 0,     // ValImp2
        taxCode3 = '03',    // CodImp3 (ICA)
        taxAmount3 = 0,     // ValImp3
        total,              // ValTot
        nitEmisor,          // NitOFE
        tipoDocAdquiriente, // NumAdq (tipo doc)
        numDocAdquiriente,  // NumAdq (número)
        claveTecnica,       // Clave técnica del software
        tipoAmbiente        // 1 = Producción, 2 = Pruebas
    } = data;

    // Formato: NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 + 
    //          CodImp3 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmb
    const cufeString = [
        invoiceNumber,
        date,
        time,
        subtotal.toFixed(2),
        taxCode1,
        taxAmount1.toFixed(2),
        taxCode2,
        taxAmount2.toFixed(2),
        taxCode3,
        taxAmount3.toFixed(2),
        total.toFixed(2),
        nitEmisor,
        numDocAdquiriente,
        claveTecnica,
        tipoAmbiente
    ].join('');

    console.log('🔐 Cadena CUFE:', cufeString);

    return crypto.createHash('sha384').update(cufeString).digest('hex');
};

// ============================================
// GENERAR CUDE (Para Notas Crédito/Débito)
// ============================================
const generateCUDE = (data) => {
    const cudeString = [
        data.noteNumber,
        data.date,
        data.time,
        data.subtotal.toFixed(2),
        '01', data.taxAmount1.toFixed(2),
        '04', data.taxAmount2.toFixed(2),
        '03', data.taxAmount3.toFixed(2),
        data.total.toFixed(2),
        data.nitEmisor,
        data.numDocAdquiriente,
        data.pin,
        data.tipoAmbiente
    ].join('');

    return crypto.createHash('sha384').update(cudeString).digest('hex');
};

// ============================================
// GENERAR CÓDIGO DE SEGURIDAD DEL SOFTWARE
// ============================================
const generateSoftwareSecurityCode = (softwareId, pin, invoiceNumber) => {
    const codeString = `${softwareId}${pin}${invoiceNumber}`;
    return crypto.createHash('sha384').update(codeString).digest('hex');
};

// ============================================
// GENERAR CÓDIGO QR
// ============================================
const generateQRCode = (cufe, invoiceNumber, date, total, nit) => {
    const baseUrl = DIAN_CONFIG.AMBIENTE === '1'
        ? 'https://catalogo-vpfe.dian.gov.co/document/searchqr'
        : 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr';

    return `${baseUrl}?documentkey=${cufe}`;
};

// ============================================
// ESCAPAR CARACTERES XML
// ============================================
const escapeXml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

// ============================================
// CONSTRUIR XML DE FACTURA UBL 2.1 DIAN
// ============================================
const buildInvoiceXML = (invoiceData, cufe) => {
    const {
        invoiceNumber,
        prefijo,
        date,
        time,
        dueDate,
        items,
        client,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        paymentMethod,
        paymentMeanCode,
        notes
    } = invoiceData;

    const emisor = DIAN_CONFIG.EMISOR;
    const resolucion = DIAN_CONFIG.RESOLUCION;
    const software = DIAN_CONFIG.SOFTWARE;

    // Código de seguridad del software
    const softwareSecurityCode = invoiceData.softwareSecurityCode || generateSoftwareSecurityCode(software.ID, software.PIN, invoiceNumber);

    // URL QR
    const qrCode = generateQRCode(cufe, invoiceNumber, date, total, emisor.NIT);

    // Generar líneas de items
    const invoiceLines = items.map((item, index) => `
    <cac:InvoiceLine>
        <cbc:ID>${index + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${item.unitCode || '94'}">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="COP">${(item.lineBase || item.lineTotal).toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="COP">${(item.taxVal || 0).toFixed(2)}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="COP">${(item.lineBase || 0).toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="COP">${(item.taxVal || 0).toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:Percent>${(item.tax || 19).toFixed(2)}</cbc:Percent>
                    <cac:TaxScheme>
                        <cbc:ID>01</cbc:ID>
                        <cbc:Name>IVA</cbc:Name>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description>${escapeXml(item.description || item.item)}</cbc:Description>
            <cac:StandardItemIdentification>
                <cbc:ID schemeID="999" schemeName="Estándar de adopción del contribuyente">${escapeXml(item.reference || `ITEM-${index + 1}`)}</cbc:ID>
            </cac:StandardItemIdentification>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="COP">${(item.unitPrice || 0).toFixed(2)}</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="${item.unitCode || '94'}">1</cbc:BaseQuantity>
        </cac:Price>
    </cac:InvoiceLine>`).join('');

    // XML completo con namespaces como atributos
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
         xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
         xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
         xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#"
         xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
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
                        <sts:ProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</sts:ProviderID>
                        <sts:SoftwareID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${software.ID}</sts:SoftwareID>
                    </sts:SoftwareProvider>
                    <sts:SoftwareSecurityCode schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)">${softwareSecurityCode}</sts:SoftwareSecurityCode>
                    <sts:AuthorizationProvider>
                        <sts:AuthorizationProviderID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="4" schemeName="31">800197268</sts:AuthorizationProviderID>
                    </sts:AuthorizationProvider>
                    <sts:QRCode>${qrCode}</sts:QRCode>
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
    <cbc:ProfileExecutionID>${DIAN_CONFIG.AMBIENTE}</cbc:ProfileExecutionID>
    <cbc:ID>${invoiceNumber}</cbc:ID>
    <cbc:UUID schemeID="${DIAN_CONFIG.AMBIENTE}" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
    <cbc:IssueDate>${date}</cbc:IssueDate>
    <cbc:IssueTime>${time}</cbc:IssueTime>
    <cbc:DueDate>${dueDate || date}</cbc:DueDate>
    <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
    <cbc:Note>${escapeXml(notes || '')}</cbc:Note>
    <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
    <cbc:LineCountNumeric>${items.length}</cbc:LineCountNumeric>
    <cac:InvoicePeriod>
        <cbc:StartDate>${date}</cbc:StartDate>
        <cbc:EndDate>${date}</cbc:EndDate>
        <cbc:DescriptionCode>1</cbc:DescriptionCode>
    </cac:InvoicePeriod>
    <cac:AccountingSupplierParty>
        <cbc:AdditionalAccountID>${emisor.TIPO_PERSONA}</cbc:AdditionalAccountID>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(emisor.NOMBRE_COMERCIAL)}</cbc:Name>
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
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID>
                <cbc:TaxLevelCode listName="48">${emisor.RESPONSABILIDADES.join(';')}</cbc:TaxLevelCode>
                <cac:RegistrationAddress>
                    <cbc:ID>${emisor.CODIGO_MUNICIPIO}</cbc:ID>
                    <cbc:CityName>${escapeXml(emisor.CIUDAD)}</cbc:CityName>
                    <cbc:CountrySubentity>${escapeXml(emisor.DEPARTAMENTO)}</cbc:CountrySubentity>
                    <cbc:CountrySubentityCode>${emisor.CODIGO_DEPARTAMENTO}</cbc:CountrySubentityCode>
                    <cac:AddressLine>
                        <cbc:Line>${escapeXml(emisor.DIRECCION)}</cbc:Line>
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
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${emisor.DV}" schemeName="31">${emisor.NIT}</cbc:CompanyID>
                <cac:CorporateRegistrationScheme>
                    <cbc:ID>${resolucion.PREFIJO}</cbc:ID>
                </cac:CorporateRegistrationScheme>
            </cac:PartyLegalEntity>
            <cac:Contact>
                <cbc:Telephone>${emisor.TELEFONO}</cbc:Telephone>
                <cbc:ElectronicMail>${emisor.EMAIL}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cbc:AdditionalAccountID>${client.tipoPersona || '2'}</cbc:AdditionalAccountID>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name>${escapeXml(client.name)}</cbc:Name>
            </cac:PartyName>
            <cac:PhysicalLocation>
                <cac:Address>
                    <cbc:ID>${client.codigoMunicipio || '11001'}</cbc:ID>
                    <cbc:CityName>${escapeXml(client.ciudad || 'Bogotá')}</cbc:CityName>
                    <cbc:CountrySubentity>${escapeXml(client.departamento || 'Bogotá D.C.')}</cbc:CountrySubentity>
                    <cbc:CountrySubentityCode>${client.codigoDepartamento || '11'}</cbc:CountrySubentityCode>
                    <cac:AddressLine>
                        <cbc:Line>${escapeXml(client.direccion || 'Sin dirección')}</cbc:Line>
                    </cac:AddressLine>
                    <cac:Country>
                        <cbc:IdentificationCode>CO</cbc:IdentificationCode>
                        <cbc:Name languageID="es">Colombia</cbc:Name>
                    </cac:Country>
                </cac:Address>
            </cac:PhysicalLocation>
            <cac:PartyTaxScheme>
                <cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv || calcularDV(client.idNumber)}" schemeName="${client.docType || '13'}">${client.idNumber}</cbc:CompanyID>
                <cbc:TaxLevelCode listName="48">O-99</cbc:TaxLevelCode>
                <cac:TaxScheme>
                    <cbc:ID>01</cbc:ID>
                    <cbc:Name>IVA</cbc:Name>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)" schemeID="${client.dv || calcularDV(client.idNumber)}" schemeName="${client.docType || '13'}">${client.idNumber}</cbc:CompanyID>
            </cac:PartyLegalEntity>
            <cac:Contact>
                <cbc:ElectronicMail>${client.email || ''}</cbc:ElectronicMail>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingCustomerParty>
    <cac:PaymentMeans>
        <cbc:ID>${paymentMeanCode || '10'}</cbc:ID>
        <cbc:PaymentMeansCode>${paymentMethod === 'Credito' ? '2' : '1'}</cbc:PaymentMeansCode>
        <cbc:PaymentDueDate>${dueDate || date}</cbc:PaymentDueDate>
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:Percent>${(subtotal > 0 ? ((taxAmount / subtotal) * 100) : 0).toFixed(2)}</cbc:Percent>
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
        <cbc:AllowanceTotalAmount currencyID="COP">${(discountAmount || 0).toFixed(2)}</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
${invoiceLines}
</Invoice>`;

    return xml;
};

// ============================================
// EXPORTAR
// ============================================
module.exports = {
    generateCUFE,
    generateCUDE,
    buildInvoiceXML,
    generateSoftwareSecurityCode,
    generateQRCode
};