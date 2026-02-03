# Script para subir fix de taskController.js al VPS
# Ejecutar: .\upload_taskcontroller_fix.ps1

$ErrorActionPreference = "Continue"

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo fix de taskController.js al VPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Instalar módulo Posh-SSH si no está instalado
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Instalando módulo Posh-SSH..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser -SkipPublisherCheck
}

Import-Module Posh-SSH

# Crear credenciales
$SecurePassword = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($VPS_USER, $SecurePassword)

Write-Host "Conectando al VPS..." -ForegroundColor Yellow

# Conectar al VPS
$Session = New-SSHSession -ComputerName $VPS_HOST -Credential $Credential -AcceptKey

if (-not $Session) {
    Write-Host "✗ Error al conectar al VPS" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Conectado exitosamente" -ForegroundColor Green
Write-Host ""

# Usar ruta conocida del backend
$backPath = "/var/www/backend"

Write-Host "Usando ruta del backend: $backPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo taskController.js..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$localFile = "back\src\controllers\taskController.js"
$remoteFile = "$backPath/src/controllers/taskController.js"

if (Test-Path $localFile) {
    Write-Host "Subiendo: taskController.js" -ForegroundColor Yellow
    Write-Host "  De: $localFile" -ForegroundColor Gray
    Write-Host "  A:  $remoteFile" -ForegroundColor Gray
    
    # Crear directorio remoto si no existe
    $remoteDir = "$backPath/src/controllers"
    $mkdirCmd = "mkdir -p `"$remoteDir`""
    $mkdirResult = Invoke-SSHCommand -SessionId $Session.SessionId -Command $mkdirCmd
    
    # Subir archivo
    try {
        Set-SCPFile -ComputerName $VPS_HOST -Credential $Credential -LocalFile $localFile -RemotePath $remoteFile -AcceptKey
        Write-Host "  ✓ Subido exitosamente" -ForegroundColor Green
    }
    catch {
        Write-Host "  ✗ Error: $_" -ForegroundColor Red
        Remove-SSHSession -SessionId $Session.SessionId | Out-Null
        exit 1
    }
} else {
    Write-Host "✗ No se encontró el archivo: $localFile" -ForegroundColor Red
    Remove-SSHSession -SessionId $Session.SessionId | Out-Null
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Reiniciando backend..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Reiniciar backend con pm2
Write-Host "Reiniciando backend (pm2)..." -ForegroundColor Yellow
$restartResult = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 restart backend"
Write-Host $restartResult.Output

# Verificar estado
Write-Host ""
Write-Host "Verificando estado del backend..." -ForegroundColor Yellow
$statusResult = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 list"
Write-Host $statusResult.Output

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✓ Proceso completado" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Los logs del backend ahora mostrarán información de debugging" -ForegroundColor Cyan
Write-Host "Verifica los logs con: pm2 logs backend" -ForegroundColor Cyan
Write-Host ""

# Cerrar sesión
Remove-SSHSession -SessionId $Session.SessionId | Out-Null
