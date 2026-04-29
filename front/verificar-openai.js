// Script para verificar que la API key de OpenAI esté configurada
// Ejecutar: node verificar-openai.js

require('dotenv').config({ path: '.env' });

const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

console.log('\n🔍 Verificando configuración de OpenAI...\n');

if (!apiKey) {
  console.log('❌ ERROR: REACT_APP_OPENAI_API_KEY no está configurada');
  console.log('\n📝 Pasos para configurar:');
  console.log('1. Crea o edita el archivo .env en la carpeta front/');
  console.log('2. Agrega esta línea:');
  console.log('   REACT_APP_OPENAI_API_KEY=sk-proj-tu-api-key-aqui');
  console.log('3. Reinicia el servidor: npm start\n');
  process.exit(1);
}

if (apiKey.length < 20) {
  console.log('⚠️  ADVERTENCIA: La API key parece ser muy corta');
  console.log('   Verifica que sea correcta\n');
}

if (apiKey.startsWith('sk-proj-')) {
  console.log('✅ API Key encontrada y parece válida');
  console.log(`   Longitud: ${apiKey.length} caracteres`);
  console.log(`   Prefijo: ${apiKey.substring(0, 20)}...`);
  console.log('\n✅ Configuración correcta. Reinicia el servidor si acabas de agregar la key.\n');
} else {
  console.log('⚠️  ADVERTENCIA: La API key no tiene el formato esperado (debería empezar con sk-proj-)');
  console.log('   Verifica que sea correcta\n');
}
