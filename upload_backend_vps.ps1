# Subir backend (Alegra / Set de Pruebas) al VPS crumi.ai
# Backend en produccion: /var/www/backend. Usa PuTTY plink/pscp.
# Ejecutar: .\upload_backend_vps.ps1

$ErrorActionPreference = "Stop"

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"
$BACK_PATH = "/var/www/backend"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo backend (Set de Pruebas) al VPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $pscpPath) -or -not (Test-Path $plinkPath)) {
    Write-Host "No se encontraron plink/pscp en PuTTY. Instala PuTTY o sube los archivos manualmente." -ForegroundColor Red
    Write-Host "Archivos a subir a $BACK_PATH :" -ForegroundColor Yellow
    Write-Host "  back\src\services\alegraService.js"
    Write-Host "  back\src\controllers\alegraController.js"
    Write-Host "Luego en el VPS: pm2 restart backend" -ForegroundColor Cyan
    exit 1
}

$env:PLINK_PROTOCOL = "ssh"
echo y | & $plinkPath -pw $VPS_PASS ${VPS_USER}@${VPS_HOST} "exit" 2>$null

$files = @(
    @("back\src\services\alegraService.js", "$BACK_PATH/src/services/alegraService.js"),
    @("back\src\controllers\alegraController.js", "$BACK_PATH/src/controllers/alegraController.js")
)

foreach ($pair in $files) {
    $local = $pair[0]
    $remote = $pair[1]
    if (Test-Path $local) {
        Write-Host "Subiendo: $local" -ForegroundColor Yellow
        $remoteDir = $remote -replace "/[^/]+$", ""
        & $plinkPath -pw $VPS_PASS ${VPS_USER}@${VPS_HOST} "mkdir -p `"$remoteDir`"" 2>$null
        & $pscpPath -pw $VPS_PASS $local "${VPS_USER}@${VPS_HOST}:$remote"
        if ($LASTEXITCODE -eq 0) { Write-Host "  OK" -ForegroundColor Green } else { Write-Host "  Fallo" -ForegroundColor Red }
    } else {
        Write-Host "No encontrado: $local" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Reiniciando backend (pm2 restart backend)..." -ForegroundColor Cyan
& $plinkPath -pw $VPS_PASS ${VPS_USER}@${VPS_HOST} "cd $BACK_PATH && pm2 restart backend"
Write-Host ""
Write-Host "Listo. Puedes probar el Set de Pruebas en crumi.ai" -ForegroundColor Green
