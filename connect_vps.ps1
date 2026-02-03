# Script para conectar al VPS usando plink (PuTTY)
$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"
$PLINK = "C:\Program Files\PuTTY\plink.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Conectando al VPS crumi.ai..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que plink existe
if (-not (Test-Path $PLINK)) {
    Write-Host "Error: plink.exe no encontrado en $PLINK" -ForegroundColor Red
    exit 1
}

# Comando de prueba
Write-Host "Ejecutando comando de prueba..." -ForegroundColor Yellow
$testCmd = "pwd && whoami && echo '=== CONECTADO EXITOSAMENTE ==='"
$result = & $PLINK -ssh -pw $VPS_PASS "$VPS_USER@$VPS_HOST" $testCmd

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "CONECTADO AL VPS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host $result
Write-Host ""
Write-Host "Listo para ejecutar comandos." -ForegroundColor Yellow
Write-Host "Dime que hacer." -ForegroundColor Cyan
Write-Host ""

# Variables globales para uso posterior
$global:VPS_PLINK = $PLINK
$global:VPS_HOST = $VPS_HOST
$global:VPS_USER = $VPS_USER
$global:VPS_PASS = $VPS_PASS

Write-Host "Variables globales configuradas." -ForegroundColor Green
Write-Host "Puedo ejecutar comandos usando plink." -ForegroundColor Gray
