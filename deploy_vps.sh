#!/bin/bash

# Script para desplegar cambios en el VPS
# Ejecutar en el VPS: bash deploy_vps.sh

echo "=========================================="
echo "Desplegando cambios en VPS"
echo "=========================================="

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para verificar si un comando fue exitoso
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        exit 1
    fi
}

# Detectar rutas de los proyectos
# Ajusta estas rutas según tu configuración del VPS
FRONTEND_PATH="/root/crumifront"
BACKEND_PATH="/root/crumiback"

# Si no existen en /root, buscar en otras ubicaciones comunes
if [ ! -d "$FRONTEND_PATH" ]; then
    echo -e "${YELLOW}Buscando frontend...${NC}"
    FRONTEND_PATH=$(find /root /home /var/www -name "crumifront" -type d 2>/dev/null | head -1)
    if [ -z "$FRONTEND_PATH" ]; then
        echo -e "${RED}No se encontró el directorio del frontend${NC}"
        echo "Por favor, especifica la ruta manualmente editando este script"
        exit 1
    fi
fi

if [ ! -d "$BACKEND_PATH" ]; then
    echo -e "${YELLOW}Buscando backend...${NC}"
    BACKEND_PATH=$(find /root /home /var/www -name "crumiback" -type d 2>/dev/null | head -1)
    if [ -z "$BACKEND_PATH" ]; then
        echo -e "${RED}No se encontró el directorio del backend${NC}"
        echo "Por favor, especifica la ruta manualmente editando este script"
        exit 1
    fi
fi

echo -e "${GREEN}Frontend encontrado en: $FRONTEND_PATH${NC}"
echo -e "${GREEN}Backend encontrado en: $BACKEND_PATH${NC}"

# ==========================================
# ACTUALIZAR FRONTEND
# ==========================================
echo ""
echo "=========================================="
echo "Actualizando Frontend..."
echo "=========================================="

cd "$FRONTEND_PATH" || exit 1
check_status "Cambiando a directorio frontend"

git fetch origin
check_status "Fetch de cambios remotos"

git pull origin main
check_status "Pull de cambios"

# Instalar dependencias si hay cambios en package.json
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json\|package-lock.json"; then
    echo -e "${YELLOW}Instalando dependencias del frontend...${NC}"
    npm install
    check_status "Instalación de dependencias"
fi

# Construir el proyecto
echo -e "${YELLOW}Construyendo frontend...${NC}"
npm run build
check_status "Build del frontend"

# ==========================================
# ACTUALIZAR BACKEND
# ==========================================
echo ""
echo "=========================================="
echo "Actualizando Backend..."
echo "=========================================="

cd "$BACKEND_PATH" || exit 1
check_status "Cambiando a directorio backend"

git fetch origin
check_status "Fetch de cambios remotos"

git pull origin main
check_status "Pull de cambios"

# Instalar dependencias si hay cambios en package.json
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json\|package-lock.json"; then
    echo -e "${YELLOW}Instalando dependencias del backend...${NC}"
    npm install
    check_status "Instalación de dependencias"
fi

# ==========================================
# REINICIAR SERVICIOS
# ==========================================
echo ""
echo "=========================================="
echo "Reiniciando servicios..."
echo "=========================================="

# Intentar reiniciar con PM2
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Reiniciando servicios con PM2...${NC}"
    pm2 restart all
    check_status "Reinicio con PM2"
    pm2 list
elif command -v systemctl &> /dev/null; then
    echo -e "${YELLOW}Reiniciando servicios con systemctl...${NC}"
    # Ajusta los nombres de los servicios según tu configuración
    systemctl restart crumiback 2>/dev/null || systemctl restart node 2>/dev/null || echo "Servicio no encontrado"
    check_status "Reinicio con systemctl"
else
    echo -e "${YELLOW}No se encontró PM2 ni systemctl. Reinicia manualmente los servicios.${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✓ Despliegue completado${NC}"
echo "=========================================="
echo ""
echo "Verifica que los servicios estén corriendo:"
echo "  - Frontend: Verifica que el build se haya completado"
echo "  - Backend: Verifica que el servidor esté respondiendo"
echo ""
