#!/bin/bash
# Script de deployment completo para Crumi
set -e

echo "=== Buscando repositorios ==="
BACKEND=$(find /home /root /var/www -type d -name ".git" 2>/dev/null | grep -i back | head -1 | xargs dirname)
FRONTEND=$(find /home /root /var/www -type d -name ".git" 2>/dev/null | grep -i front | head -1 | xargs dirname)

echo "Backend encontrado en: $BACKEND"
echo "Frontend encontrado en: $FRONTEND"

if [ -z "$BACKEND" ] || [ -z "$FRONTEND" ]; then
    echo "ERROR: No se encontraron los repositorios"
    echo "Buscando todos los directorios git..."
    find /home /root /var/www -type d -name ".git" 2>/dev/null
    exit 1
fi

echo ""
echo "=== Actualizando BACKEND ==="
cd "$BACKEND"
echo "Directorio actual: $(pwd)"
echo "Remote actual:"
git remote -v
git remote set-url origin https://github.com/charlieroa/crumiback.git
echo "Nuevo remote:"
git remote -v
git fetch origin
git reset --hard origin/main
npm install

echo ""
echo "=== Actualizando FRONTEND ==="
cd "$FRONTEND"
echo "Directorio actual: $(pwd)"
echo "Remote actual:"
git remote -v
git remote set-url origin https://github.com/charlieroa/crumifront.git
echo "Nuevo remote:"
git remote -v
git fetch origin
git reset --hard origin/main
npm install
npm run build

echo ""
echo "=== Reiniciando servicios ==="
pm2 restart all || pm2 start "$BACKEND/src/server.js" --name crumi-backend
pm2 save
systemctl reload nginx || service nginx reload

echo ""
echo "=== DEPLOYMENT COMPLETADO ==="
echo "Verifica: http://38.242.209.6"
pm2 status
