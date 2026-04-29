// src/helpers/xadesEpesHelper.js
// Firma digital XAdES-EPES para DIAN Colombia
// Usa firmador Java xades4j para firma real

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// ============================================
// CONSTANTES
// ============================================
const CERT_DIR = path.join(__dirname, '..', '..', 'certificados');
const FIRMADOR_JAR = path.join(CERT_DIR, 'firmador.jar');
const TEMP_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'xmls');

// ============================================
// VERIFICAR SI PUEDE FIRMAR
// ============================================
const canSign = () => {
    // Verificar que existe el JAR
    if (!fs.existsSync(FIRMADOR_JAR)) {
        return { canSign: false, reason: 'firmador.jar no encontrado en certificados/' };
    }

    // Verificar que existe carpeta certificados
    if (!fs.existsSync(CERT_DIR)) {
        return { canSign: false, reason: 'Carpeta certificados no existe' };
    }

    // Buscar archivo .p12
    const files = fs.readdirSync(CERT_DIR);
    const p12File = files.find(f => f.endsWith('.p12') || f.endsWith('.pfx'));

    if (!p12File) {
        return { canSign: false, reason: 'No se encontró archivo .p12 o .pfx' };
    }

    // Verificar password
    if (!process.env.DIAN_CERTIFICADO_PASSWORD) {
        return { canSign: false, reason: 'Variable DIAN_CERTIFICADO_PASSWORD no configurada' };
    }

    return {
        canSign: true,
        certPath: path.join(CERT_DIR, p12File),
        certFile: p12File,
        jarPath: FIRMADOR_JAR
    };
};

// ============================================
// FIRMAR XML CON JAVA XADES4J
// ============================================
const signInvoiceXML = async (xmlContent, certPath, password) => {
    console.log('🔏 Iniciando firma XAdES-EPES con Java xades4j...');

    // 1. Crear archivos temporales
    const timestamp = Date.now();
    const inputFile = path.join(TEMP_DIR, `temp_input_${timestamp}.xml`);
    const outputFile = path.join(TEMP_DIR, `temp_signed_${timestamp}.xml`);

    try {
        // 2. Guardar XML sin firmar
        // Primero limpiar el placeholder
        const xmlClean = xmlContent.replace(
            /<!-- Espacio reservado para firma digital XAdES-EPES -->/,
            ''
        );
        fs.writeFileSync(inputFile, xmlClean, 'utf8');
        console.log(`   📄 XML temporal: ${inputFile}`);

        // 3. Ejecutar firmador Java
        // Uso: java -jar firmador.jar <certPath> <password> <xmlIn> <xmlOut>
        const javaCmd = `java -jar "${FIRMADOR_JAR}" "${certPath}" "${password}" "${inputFile}" "${outputFile}"`;

        console.log('   ☕ Ejecutando firmador Java...');

        const { stdout, stderr } = await execPromise(javaCmd, {
            cwd: CERT_DIR,
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024
        });

        if (stdout) console.log('   📝 Java stdout:', stdout.substring(0, 200));
        if (stderr && !stderr.includes('Picked up')) {
            console.warn('   ⚠️ Java stderr:', stderr.substring(0, 200));
        }

        // 4. Leer XML firmado
        if (!fs.existsSync(outputFile)) {
            throw new Error('El firmador no generó el archivo de salida');
        }

        const signedXml = fs.readFileSync(outputFile, 'utf8');
        console.log('   ✅ XML firmado correctamente con xades4j');

        // 5. Limpiar archivos temporales
        try {
            fs.unlinkSync(inputFile);
            fs.unlinkSync(outputFile);
        } catch (e) {
            // Ignorar errores de limpieza
        }

        return signedXml;

    } catch (error) {
        console.error('   ❌ Error en firma Java:', error.message);

        // Limpiar archivos temporales en caso de error
        try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (e) {
            // Ignorar
        }

        throw error;
    }
};

// ============================================
// CONSTANTES DIAN (para referencia)
// ============================================
const DIAN_POLICY = {
    IDENTIFIER: 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf',
    DESCRIPTION: 'Política de firma para facturas electrónicas de la República de Colombia',
    DIGEST_VALUE: 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y=',
    DIGEST_METHOD: 'http://www.w3.org/2001/04/xmlenc#sha256'
};

module.exports = {
    signInvoiceXML,
    canSign,
    DIAN_POLICY
};
