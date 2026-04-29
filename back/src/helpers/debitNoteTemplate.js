const { DIAN_CONFIG, calcularDV } = require('../config/dianConfig');
const { generateCUDE, generateSoftwareSecurityCode, generateQRCode } = require('./dianHelper');

const escapeXml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

const buildDebitNoteXML = (data, cude) => {
    const { noteNumber, refInvoiceNumber, date, time, items, subtotal, taxAmount, total, notes, software, emisor, client } = data;
    const softwareSecurityCode = generateSoftwareSecurityCode(software.ID, software.PIN, noteNumber);
    const qrCode = generateQRCode(cude, noteNumber, date, total, emisor.NIT);

    // Items
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
                <cac:TaxCategory>
                    <cbc:Percent>${item.tax.toFixed(2)}</cbc:Percent>
                    <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description>${escapeXml(item.description)}</cbc:Description>
             <cac:StandardItemIdentification>
                <cbc:ID schemeID="999">${item.code}</cbc:ID>
            </cac:StandardItemIdentification>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="COP">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
            <cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity>
        </cac:Price>
    </cac:DebitNoteLine>`).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2"
           xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
           xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
           xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
           xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1"
           xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent>
                <sts:DianExtensions>
                     <sts:InvoiceSource>
                       <cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
                    </sts:InvoiceSource>
                    <sts:SoftwareProvider>
                        <sts:ProviderID schemeAgencyID="195" schemeName="31">${emisor.NIT}</sts:ProviderID>
                        <sts:SoftwareID>${software.ID}</sts:SoftwareID>
                    </sts:SoftwareProvider>
                    <sts:SoftwareSecurityCode>${softwareSecurityCode}</sts:SoftwareSecurityCode>
                    <sts:AuthorizationProvider>
                         <sts:AuthorizationProviderID schemeAgencyID="195" schemeName="31">800197268</sts:AuthorizationProviderID>
                    </sts:AuthorizationProvider>
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
    <cac:DiscrepancyResponse>
        <cbc:ReferenceID>${refInvoiceNumber}</cbc:ReferenceID>
        <cbc:ResponseCode>3</cbc:ResponseCode>
        <cbc:Description>Otros Conceptos</cbc:Description>
    </cac:DiscrepancyResponse>
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>${refInvoiceNumber}</cbc:ID>
             <cbc:UUID schemeName="CUFE-SHA384">000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000</cbc:UUID>
            <cbc:IssueDate>${date}</cbc:IssueDate>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>
    <cac:AccountingSupplierParty>
        <cbc:AdditionalAccountID>${emisor.TIPO_PERSONA}</cbc:AdditionalAccountID>
         <cac:Party>
            <cac:PartyName><cbc:Name>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:Name></cac:PartyName>
             <cac:PhysicalLocation><cac:Address><cbc:CityName>${emisor.CIUDAD}</cbc:CityName><cbc:CountrySubentity>${emisor.DEPARTAMENTO}</cbc:CountrySubentity><cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode></cac:Country></cac:Address></cac:PhysicalLocation>
            <cac:PartyTaxScheme>
                <cbc:RegistrationName>${escapeXml(emisor.RAZON_SOCIAL)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeName="31" schemeID="${emisor.DV}">${emisor.NIT}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
            </cac:PartyTaxScheme>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cbc:AdditionalAccountID>${client.docType === 'NIT' ? '1' : '2'}</cbc:AdditionalAccountID>
        <cac:Party>
            <cac:PartyName><cbc:Name>${escapeXml(client.name)}</cbc:Name></cac:PartyName>
            <cac:PartyTaxScheme>
                <cbc:RegistrationName>${escapeXml(client.name)}</cbc:RegistrationName>
                <cbc:CompanyID schemeAgencyID="195" schemeName="${client.docType}" schemeID="${client.dv}">${client.idNumber}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
            </cac:PartyTaxScheme>
        </cac:Party>
    </cac:AccountingCustomerParty>
     <cac:TaxTotal>
        <cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="COP">${taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                 <cbc:Percent>19.00</cbc:Percent>
                 <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:RequestedMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="COP">${subtotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="COP">${total.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="COP">${total.toFixed(2)}</cbc:PayableAmount>
    </cac:RequestedMonetaryTotal>
    ${lines}
</DebitNote>`;
};

module.exports = { buildDebitNoteXML };
