const { SignedXml } = require('xml-crypto');
const { v4: uuidv4 } = require('uuid');
const forge = require('node-forge');
const fs = require('fs');

/**
 * Helper para generar encabezado WS-Security para SOAP DIAN
 */
class WSSecurityHelper {
    constructor(privateKeyPem, certificatePem, password) {
        this.privateKeyPem = privateKeyPem;
        this.certificatePem = certificatePem;
        this.password = password;

        // Limpiar certificado para BinarySecurityToken
        this.certBase64 = this.certificatePem
            .replace(/-----BEGIN CERTIFICATE-----/g, '')
            .replace(/-----END CERTIFICATE-----/g, '')
            .replace(/\r\n/g, '')
            .replace(/\n/g, '');
    }

    createTimestampXml(created, expires, id) {
        return `<wsu:Timestamp wsu:Id="${id}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"><wsu:Created>${created}</wsu:Created><wsu:Expires>${expires}</wsu:Expires></wsu:Timestamp>`;
    }

    signTimestamp(timestampXml, certId) {
        const sig = new SignedXml();
        sig.signingKey = this.privateKeyPem;
        sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

        // Ajustar xpath para wsu:Timestamp
        sig.addReference("//*[local-name(.)='Timestamp']",
            ["http://www.w3.org/2001/10/xml-exc-c14n#"],
            "http://www.w3.org/2001/04/xmlenc#sha256",
            undefined,
            undefined,
            undefined,
            false
        );

        sig.keyInfoProvider = {
            getKeyInfo: () => {
                return `<wsse:SecurityTokenReference><wsse:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#${certId}"/></wsse:SecurityTokenReference>`;
            }
        };

        sig.computeSignature(timestampXml);
        return sig.getSignatureXml();
    }

    generateSecurityHeader() {
        const now = new Date();
        const created = now.toISOString();
        const expires = new Date(now.getTime() + (60 * 1000)).toISOString();
        const tsId = '_0';
        const certId = uuidv4();

        const timestampXml = this.createTimestampXml(created, expires, tsId);
        const signatureXml = this.signTimestamp(timestampXml, certId);

        return `<wsse:Security s:mustUnderstand="1" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:s="http://www.w3.org/2003/05/soap-envelope">
    ${timestampXml}
    <wsse:BinarySecurityToken wsu:Id="${certId}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${this.certBase64}</wsse:BinarySecurityToken>
    ${signatureXml}
</wsse:Security>`;
    }
}

module.exports = WSSecurityHelper;
