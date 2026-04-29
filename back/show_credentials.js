require('dotenv').config();
console.log(`\n🔑 Credenciales para Asociar Software:\n`);
console.log(`Software ID: ${process.env.DIAN_SOFTWARE_ID}`);
console.log(`PIN (Clave): ${process.env.DIAN_PIN}`);
console.log(`\n(Copia y pega estos valores en el portal de la DIAN)\n`);
