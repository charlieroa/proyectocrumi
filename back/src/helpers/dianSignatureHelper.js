// src/helpers/dianSignatureHelper.js
// Firma digital XAdES-EPES para documentos electrónicos DIAN

const forge = require('node-forge');
const crypto = require('crypto');
const { create } = require('xmlbuilder2');
const fs = require('fs');
const path = require('path');

// ============================================
// CARGAR CERTIFICADO .P12 / .PFX
// ============================================
const loadCertificate = (p12Path, password) => {
    try {
        const p12Buffer = fs.readFileSync(p12Path);
        const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

        // Extraer clave privada
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;

        // Extraer certificado
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const certificate = certBags[forge.pki.oids.certBag][0].cert;

        return {
            privateKey,
            certificate,
            publicKeyPem: forge.pki.certificateToPem(certificate),
            privateKeyPem: forge.pki.privateKeyToPem(privateKey)
        };
    } catch (error) {
        console.error('❌ Error cargando certificado:', error.message);
        throw new Error(`Error al cargar certificado: ${error.message}`);
    }
};

// ============================================
// GENERAR FIRMA XADES-EPES (Simplificada para pruebas)
// ============================================
const signXML = (xmlString, privateKeyPem, certificatePem) => {
    const SignedXml = require('xml-crypto').SignedXml;

    // Configurar firma
    const sig = new SignedXml();

    // Usar SHA256 para la firma
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';

    // Agregar referencia al documento
    sig.addReference(
        "//*[local-name(.)='Invoice']",
        [
            'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
            'http://www.w3.org/2001/10/xml-exc-c14n#'
        ],
        'http://www.w3.org/2001/04/xmlenc#sha256'
    );

    // Agregar clave privada
    sig.signingKey = privateKeyPem;

    // Agregar información del certificado (KeyInfo)
    sig.keyInfoProvider = {
        getKeyInfo: () => {
            // Limpiar el PEM para obtener solo el contenido base64
            const certBase64 = certificatePem
                .replace('-----BEGIN CERTIFICATE-----', '')
                .replace('-----END CERTIFICATE-----', '')
                .replace(/\s/g, '');

            return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
        },
        getKey: () => privateKeyPem
    };

    // Calcular firma
    sig.computeSignature(xmlString, {
        prefix: 'ds',
        location: {
            reference: "//*[local-name(.)='ExtensionContent'][2]",
            action: 'append'
        }
    });

    return sig.getSignedXml();
};

// ============================================
// GENERAR FIRMA XADES-EPES COMPLETA (Para producción)
// ============================================
const signXMLXades = (xmlString, certData, invoiceData) => {
    const signingTime = new Date().toISOString();
    const signatureId = `xmldsig-${invoiceData.invoiceNumber}`;

    // Crear estructura XAdES
    const xadesSignedProperties = {
        'xades:SignedProperties': {
            '@Id': `${signatureId}-signedprops`,
            'xades:SignedSignatureProperties': {
                'xades:SigningTime': signingTime,
                'xades:SigningCertificate': {
                    'xades:Cert': {
                        'xades:CertDigest': {
                            'ds:DigestMethod': {
                                '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#sha256'
                            },
                            'ds:DigestValue': calculateCertDigest(certData.certificate)
                        },
                        'xades:IssuerSerial': {
                            'ds:X509IssuerName': certData.certificate.issuer.getField('CN').value,
                            'ds:X509SerialNumber': certData.certificate.serialNumber
                        }
                    }
                },
                'xades:SignaturePolicyIdentifier': {
                    'xades:SignaturePolicyId': {
                        'xades:SigPolicyId': {
                            'xades:Identifier': 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf',
                            'xades:Description': 'Política de firma para facturas electrónicas de la República de Colombia'
                        },
                        'xades:SigPolicyHash': {
                            'ds:DigestMethod': {
                                '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#sha256'
                            },
                            'ds:DigestValue': 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y=' // Hash fijo de la política DIAN
                        }
                    }
                },
                'xades:SignerRole': {
                    'xades:ClaimedRoles': {
                        'xades:ClaimedRole': 'supplier'
                    }
                }
            }
        }
    };

    // Para una implementación completa, aquí iría el proceso de firma XAdES-EPES
    // Por ahora usamos la firma simplificada
    return signXML(xmlString, certData.privateKeyPem, certData.publicKeyPem);
};

// ============================================
// CALCULAR DIGEST DEL CERTIFICADO
// ============================================
const calculateCertDigest = (certificate) => {
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const hash = crypto.createHash('sha256').update(certDer, 'binary').digest('base64');
    return hash;
};

// ============================================
// VERIFICAR SI EXISTE CERTIFICADO
// ============================================
const hasCertificate = () => {
    // Prioridad 1: Ruta explícita en variable de entorno
    if (process.env.DIAN_CERTIFICADO_PATH) {
        const envPath = process.env.DIAN_CERTIFICADO_PATH;
        if (fs.existsSync(envPath)) {
            console.log(`✅ Certificado encontrado (ENV): ${envPath}`);
            return {
                exists: true,
                path: envPath,
                filename: path.basename(envPath)
            };
        } else {
            console.warn(`⚠️ Ruta de certificado en ENV no existe: ${envPath}`);
        }
    }

    // Prioridad 2: Buscar en carpeta certificados/
    const certPath = path.join(__dirname, '..', '..', 'certificados');

    if (!fs.existsSync(certPath)) {
        console.log('📁 Carpeta certificados/ no existe');
        return { exists: false, path: null };
    }

    const files = fs.readdirSync(certPath);
    const p12File = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));

    if (p12File) {
        const fullPath = path.join(certPath, p12File);
        console.log(`✅ Certificado encontrado: ${p12File}`);
        return {
            exists: true,
            path: fullPath,
            filename: p12File
        };
    }

    console.log('❌ No se encontró ningún certificado .p12 o .pfx');
    return { exists: false, path: null };
};

// ============================================
// MODO DEMO/PRUEBAS (Sin firma real)
// ============================================
const signXMLDemo = (xmlString) => {
    // Para ambiente de pruebas sin certificado, 
    // agregamos una firma placeholder
    console.log('⚠️ Usando modo DEMO - Sin firma digital real');

    // La DIAN en ambiente de habilitación acepta documentos 
    // para validar la estructura XML aunque la firma no sea válida
    // en las primeras pruebas de conectividad

    return xmlString;
};

module.exports = {
    loadCertificate,
    signXML,
    signXMLXades,
    signXMLDemo,
    hasCertificate,
    calculateCertDigest
};
