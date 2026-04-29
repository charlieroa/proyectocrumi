# Configuración de OpenAI para CRUMI

## Pasos para configurar la API key de OpenAI

1. **Crear o editar el archivo `.env` en la carpeta `front/`**:
   ```bash
   cd front
   ```

2. **Agregar la siguiente línea al archivo `.env`** (sin espacios alrededor del =):
   ```
   REACT_APP_OPENAI_API_KEY=tu-api-key-aqui
   ```
   
   **Nota**: Obtén tu API key desde https://platform.openai.com/api-keys

3. **IMPORTANTE: Reiniciar el servidor de desarrollo**:
   ```bash
   # Detén el servidor actual (Ctrl+C)
   # Luego reinicia:
   npm start
   ```
   
   ⚠️ **Las variables de entorno en React solo se leen al iniciar el servidor. Si agregas la variable mientras el servidor está corriendo, debes reiniciarlo.**

4. **Verificar la configuración (opcional)**:
   ```bash
   node verificar-openai.js
   ```

## Funcionalidades

### Chat del Landing (Público)
- **Ubicación**: `/` (página principal)
- **Propósito**: Vender los servicios de CRUMI
- **Características**:
  - Explica qué es CRUMI
  - Presenta los servicios (facturación electrónica, nómina, etc.)
  - Responde preguntas sobre la plataforma
  - Pitch de ventas optimizado

### Asistente IA Interno
- **Ubicación**: `/asistente-ia` o desde el botón flotante
- **Propósito**: Ayudar con tareas administrativas
- **Características**:
  - Crear facturas, notas crédito/débito
  - Generar nómina
  - Consultar reportes
  - **Ejecutar Set de Pruebas DIAN**: Puedes pedirle "generar set de pruebas" o "ejecutar set de pruebas DIAN" y lo ejecutará automáticamente

## Notas

- La API key debe comenzar con `REACT_APP_` para que React la reconozca
- Después de agregar la variable de entorno, es necesario reiniciar el servidor
- El servicio usa el modelo `gpt-4o-mini` por defecto (más económico y rápido)
