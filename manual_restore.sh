#!/bin/bash
echo "Buscando archivo de respaldo crumi_backup.sql..."

# Buscar en /tmp o /home o /root
FILE=$(find /tmp /home /root -name "crumi_backup.sql" 2>/dev/null | head -n 1)

if [ -z "$FILE" ]; then
    echo "❌ ERROR: No encontré crumi_backup.sql en el servidor."
    echo "Por favor sube el archivo 'back/crumi_backup.sql' al servidor (puedes arrastrarlo al VNC si soporta, o usar SCP)."
else
    echo "✅ Encontrado en: $FILE"
    echo "Iniciando restauración..."
    sudo -u postgres psql -d crumi < "$FILE"
    echo "✅ Restauración completada."
fi
