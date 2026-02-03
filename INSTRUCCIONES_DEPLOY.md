# Instrucciones para subir cambios al VPS crumi.ai

## Opción 1: Usando SCP (recomendado)

Ejecuta estos comandos en PowerShell o CMD:

```powershell
# 1. Subir archivos del frontend
scp front\src\pages\Landing\index.tsx root@38.242.209.6:/root/crumifront/src/pages/Landing/index.tsx
scp front\src\services\openaiService.ts root@38.242.209.6:/root/crumifront/src/services/openaiService.ts
scp front\.env root@38.242.209.6:/root/crumifront/.env

# 2. Subir archivos del backend
scp back\src\config\alegraConfig.js root@38.242.209.6:/root/crumiback/src/config/alegraConfig.js
scp back\.env root@38.242.209.6:/root/crumiback/.env

# Cuando pida contraseña, usa: 53121C4rl0
```

## Opción 2: Conectar por SSH y hacer los cambios manualmente

```powershell
ssh root@38.242.209.6
# Contraseña: 53121C4rl0
```

Luego en el servidor:

```bash
# Navegar a los directorios
cd /root/crumifront
cd /root/crumiback

# Reiniciar servicios
pm2 restart all

# Reconstruir frontend
cd /root/crumifront
npm run build

# Reiniciar nginx si es necesario
systemctl restart nginx
```

## Archivos modificados que necesitas subir:

1. **Frontend:**
   - `front/src/pages/Landing/index.tsx` - Landing page con asistente IA mejorado
   - `front/src/services/openaiService.ts` - Servicio OpenAI con mejor manejo de errores
   - `front/.env` - Variables de entorno (incluye REACT_APP_OPENAI_API_KEY)

2. **Backend:**
   - `back/src/config/alegraConfig.js` - Configuración de Alegra en producción
   - `back/.env` - Variables de entorno (incluye ALEGRA_AMBIENTE y ALEGRA_TOKEN)

## Después de subir:

1. Reinicia el backend: `pm2 restart all` o `systemctl restart crumi-backend`
2. Reconstruye el frontend: `cd /root/crumifront && npm run build`
3. Reinicia nginx: `systemctl restart nginx`
4. Verifica en: https://crumi.ai
