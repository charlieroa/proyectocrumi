@echo off
echo ========================================
echo Subiendo Integracion Alegra al VPS
echo ========================================
echo.
echo Archivos a subir:
echo - back/src/services/alegraService.js
echo - back/src/controllers/alegraController.js
echo - back/src/routes/alegraRoutes.js
echo - back/src/migrations/runMigrations.js
echo - back/src/index.js
echo - back/.env
echo - front/src/pages/income/SalesInvoice/tabs/SetPruebasTab.tsx
echo.
echo ----------------------------------------
echo VPS: root@38.242.209.6
echo Password: 53121C4rl0
echo ----------------------------------------
echo.
echo Rutas en el VPS:
echo   Backend: /var/www/backend/
echo   Frontend: /var/www/frontend/
echo.
echo INSTRUCCIONES:
echo 1. Usa WinSCP o FileZilla para conectarte al VPS
echo 2. Sube los archivos a sus rutas correspondientes
echo 3. Ejecuta en el VPS: pm2 restart backend
echo.
echo O ejecuta estos comandos SCP uno por uno:
echo.
echo scp back\src\services\alegraService.js root@38.242.209.6:/var/www/backend/src/services/
echo scp back\src\controllers\alegraController.js root@38.242.209.6:/var/www/backend/src/controllers/
echo scp back\src\routes\alegraRoutes.js root@38.242.209.6:/var/www/backend/src/routes/
echo scp back\src\migrations\runMigrations.js root@38.242.209.6:/var/www/backend/src/migrations/
echo scp back\src\index.js root@38.242.209.6:/var/www/backend/src/
echo scp back\.env root@38.242.209.6:/var/www/backend/
echo scp front\src\pages\income\SalesInvoice\tabs\SetPruebasTab.tsx root@38.242.209.6:/var/www/frontend/src/pages/income/SalesInvoice/tabs/
echo.
echo Luego en el VPS ejecuta: pm2 restart backend
echo.
pause
