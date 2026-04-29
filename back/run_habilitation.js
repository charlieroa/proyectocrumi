console.log("🚀 Iniciando diagnóstico de script...");

try {
    require('dotenv').config();
    console.log("✅ dotenv cargado");
} catch (e) { console.error("❌ Falló dotenv", e); }

try {
    const dianServicePath = './src/services/dianService';
    console.log(`📦 Cargando servicio desde: ${dianServicePath}`);
    const { generateTestInvoice } = require(dianServicePath);
    console.log("✅ dianService cargado correctamente");

    (async () => {
        console.log("⚙️  Ejecutando proceso de habilitación...");
        // Rango 990000000 - 995000000
        const consecutivo = 990000000 + Math.floor(Math.random() * 5000) + 1;
        console.log(`📄 Generando Factura Set Pruebas #${consecutivo}...`);

        try {
            const result = await generateTestInvoice(consecutivo);
            console.log("\n📡 RESPUESTA SERVIDOR:");
            console.log(JSON.stringify(result, null, 2));

            if (result.success) {
                console.log("\n✅ Documento aceptado/enviado. Verifica el portal.");
            } else {
                console.log("\n❌ Habilitación fallida:", result.message || "Error desconocido");
            }
        } catch (execError) {
            console.error("💥 Error en ejecución:", execError);
        }
    })();

} catch (e) {
    console.error("💥 ERROR CRÍTICO CARGANDO MÓDULOS:");
    console.error(e.message);
    if (e.code === 'MODULE_NOT_FOUND') {
        console.error("🔍 Módulo no encontrado. Stack:", e.requireStack);
    }
}
