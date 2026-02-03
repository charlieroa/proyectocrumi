#!/bin/bash

echo "=========================================="
echo "Actualizando Crumi en VPS"
echo "=========================================="

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para verificar éxito del último comando
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ Error en: $1${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}1. Deteniendo servicios...${NC}"
pm2 stop all
check_success "Servicios detenidos"

echo -e "\n${YELLOW}2. Actualizando BACKEND...${NC}"
cd /home/crumiback || cd /home/vps/crumiback || { echo "Backend directory not found"; exit 1; }
git fetch origin
check_success "Git fetch backend"

git reset --hard origin/main
check_success "Git reset backend"

npm install
check_success "NPM install backend"

echo -e "\n${YELLOW}3. Actualizando FRONTEND...${NC}"
cd /home/crumifront || cd /home/vps/crumifront || { echo "Frontend directory not found"; exit 1; }
git fetch origin
check_success "Git fetch frontend"

git reset --hard origin/main
check_success "Git reset frontend"

npm install
check_success "NPM install frontend"

echo -e "\n${YELLOW}4. Construyendo frontend...${NC}"
npm run build
check_success "Build frontend"

echo -e "\n${YELLOW}5. Reiniciando servicios...${NC}"
cd /home/crumiback || cd /home/vps/crumiback
pm2 restart all || pm2 start src/server.js --name crumi-backend
check_success "Backend reiniciado"

pm2 save
check_success "PM2 configuración guardada"

echo -e "\n${YELLOW}6. Recargando Nginx...${NC}"
nginx -t && systemctl reload nginx
check_success "Nginx recargado"

echo -e "\n${GREEN}=========================================="
echo "✓ Despliegue completado exitosamente!"
echo "==========================================${NC}"

echo -e "\n${YELLOW}Verificación:${NC}"
echo "1. Abre http://38.242.209.6 en tu navegador"
echo "2. Deberías ver 'Crumi - Facturación Inteligente con IA'"
echo "3. NO deberías ver 'TupelukeriA'"

pm2 status
