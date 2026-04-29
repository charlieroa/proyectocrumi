const dianService = require('./src/services/dianService');
require('dotenv').config();

const run = async () => {
    try {
        console.log("🚀 Iniciando prueba de integración final (Node -> .NET -> DIAN)...");
        // Generar factura de prueba (invoca a sendInvoiceToDIAN -> sendSoapRequest -> dotnet dian-net-signer)
        const result = await dianService.generateTestInvoice();

        console.log("📊 RESULTADO FINAL:");
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log("✅ PRUEBA EXITOSA: Factura enviada y recibida por DIAN.");
        } else {
            console.log("⚠️ PRUEBA COMPLETADA CON AVISOS (Revisar mensajes de error de negocio DIAN)");
        }
    } catch (e) {
        console.error("❌ ERROR CRITICO EN PRUEBA:", e);
    }
};

run();
