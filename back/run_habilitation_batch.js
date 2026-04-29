require('dotenv').config();
const { generateTestInvoice } = require('./src/services/dianService');

(async () => {
    console.log("🚀 INICIANDO RÁFAGA DE HABILITACIÓN (10 DOCS)");

    for (let i = 0; i < 30; i++) {
        const consecutivo = 990000000 + Math.floor(Math.random() * 100000) + 1;
        console.log(`\n📄 [${i + 1}/10] Enviando Factura Test #${consecutivo}...`);

        try {
            const result = await generateTestInvoice(consecutivo);

            if (result.success && result.dianResponse?.dianResponse?.SendTestSetAsyncResult?.IsValid) {
                console.log("   ✅ ACEPTADA (Síncrono)");
            } else {
                console.log("   ❌ ERROR / RECHAZO");
                console.log("Detail:", JSON.stringify(result.dianResponse || result));
            }
        } catch (e) {
            console.error("   💥 Excepción:", e.message);
        }

        // Esperar 2 segundos entre envíos
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n🏁 Ráfaga completada.");
})();
