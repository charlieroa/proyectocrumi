#!/bin/bash
set -e

echo "=== CONFIGURANDO BACKEND CRUMI ==="

# Instalar dependencias npm
cd /home/vps/crumiback
echo "Instalando dependencias npm..."
npm install

# Configurar base de datos PostgreSQL
echo "Configurando base de datos PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE crumi;" 2>/dev/null || echo "BD crumi ya existe"
sudo -u postgres psql -c "CREATE USER crumiuser WITH PASSWORD 'Crumi2024!';" 2>/dev/null || echo "Usuario crumiuser ya existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE crumi TO crumiuser;"
sudo -u postgres psql -c "ALTER DATABASE crumi OWNER TO crumiuser;"

# Crear archivo .env básico si no existe
if [ ! -f .env ]; then
    echo "Creando archivo .env..."
    cat > .env << 'ENVEOF'
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crumi
DB_USER=crumiuser
DB_PASSWORD=Crumi2024!

# Server
PORT=5000
NODE_ENV=production

# JWT
JWT_SECRET=crumi-secret-key-2024-super-secure-change-in-production

# CORS
FRONTEND_URL=http://185.177.116.213
ENVEOF
fi

echo "=== BACKEND CONFIGURADO ==="
echo "Siguiente: iniciar con PM2"
