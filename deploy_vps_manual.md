# Instrucciones para Desplegar en VPS

## Opción 1: Usar el script automático

1. Copia el archivo `deploy_vps.sh` al VPS:
   ```bash
   scp deploy_vps.sh root@38.242.209.6:/root/
   ```

2. Conéctate al VPS:
   ```bash
   ssh root@38.242.209.6
   # Password: 53121C4rl0
   ```

3. Ejecuta el script:
   ```bash
   chmod +x deploy_vps.sh
   ./deploy_vps.sh
   ```

## Opción 2: Comandos manuales

### Conectarse al VPS
```bash
ssh root@38.242.209.6
# Password: 53121C4rl0
```

### Actualizar Frontend
```bash
# Navegar al directorio del frontend (ajusta la ruta según tu configuración)
cd /root/crumifront  # o la ruta donde tengas el proyecto

# Obtener los últimos cambios
git fetch origin
git pull origin main

# Instalar dependencias si es necesario
npm install

# Construir el proyecto
npm run build
```

### Actualizar Backend
```bash
# Navegar al directorio del backend
cd /root/crumiback  # o la ruta donde tengas el proyecto

# Obtener los últimos cambios
git fetch origin
git pull origin main

# Instalar dependencias si es necesario
npm install
```

### Reiniciar Servicios

**Si usas PM2:**
```bash
pm2 restart all
pm2 list  # Verificar que estén corriendo
```

**Si usas systemctl:**
```bash
systemctl restart crumiback
# o
systemctl restart node
```

**Si usas otro método:**
- Detén el proceso actual
- Inicia nuevamente el servidor

## Verificar el despliegue

1. **Frontend**: Verifica que el build se haya completado correctamente
2. **Backend**: Verifica que el servidor esté respondiendo:
   ```bash
   curl http://localhost:5000/api/health  # o el puerto que uses
   ```

## Notas importantes

- Asegúrate de que las variables de entorno estén configuradas correctamente
- Si hay errores, revisa los logs:
  - PM2: `pm2 logs`
  - systemctl: `journalctl -u nombre-del-servicio`
- El frontend necesita ser servido por un servidor web (nginx, apache, etc.) o por el mismo Node.js
