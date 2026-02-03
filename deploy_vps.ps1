# Script PowerShell para desplegar en VPS
# Ejecutar: .\deploy_vps.ps1

$ErrorActionPreference = 'Stop'

$VPS_HOST = '38.242.209.6'
$VPS_USER = 'root'
$VPS_PASS = '53121C4rl0'

Write-Host '==========================================' -ForegroundColor Cyan
Write-Host 'Desplegando cambios en VPS' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host 'Instalando modulo Posh-SSH...' -ForegroundColor Yellow
    try {
        Install-Module -Name Posh-SSH -Force -Scope CurrentUser -SkipPublisherCheck -ErrorAction Stop
    } catch {
        Write-Host 'No se pudo instalar Posh-SSH. Si ya lo tienes, continuando...' -ForegroundColor Yellow
    }
}

Import-Module Posh-SSH -ErrorAction Stop

$SecurePassword = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($VPS_USER, $SecurePassword)

Write-Host 'Conectando al VPS...' -ForegroundColor Yellow

$Session = $null
try {
    $Session = New-SSHSession -ComputerName $VPS_HOST -Credential $Credential -AcceptKey
} catch {
    Write-Host 'Error al conectar al VPS' -ForegroundColor Red
    exit 1
}

if (-not $Session) {
    Write-Host 'No se pudo conectar al VPS' -ForegroundColor Red
    exit 1
}

Write-Host 'Conectado exitosamente' -ForegroundColor Green
Write-Host ''

$cmdLines = @(
    'echo "=========================================="',
    'echo "Actualizando Backend..."',
    'echo "=========================================="',
    'BACKEND_DIR="/var/www/backend"',
    'if [ -d "$BACKEND_DIR" ]; then',
    '  cd "$BACKEND_DIR"',
    '  pwd',
    '  git fetch origin',
    '  git checkout fix/listado-usuarios-superadmin-clean 2>/dev/null || git checkout -b fix/listado-usuarios-superadmin-clean origin/fix/listado-usuarios-superadmin-clean',
    '  git pull origin fix/listado-usuarios-superadmin-clean',
    '  npm install --production',
    '  echo "Backend actualizado"',
    'else',
    '  echo "No se encontro el directorio del backend"',
    'fi',
    'echo ""',
    'echo "Reiniciando servicios..."',
    'pm2 restart backend',
    'pm2 list',
    'echo "Despliegue completado"'
)
$commands = $cmdLines -join "`n"

Write-Host 'Ejecutando comandos en el VPS...' -ForegroundColor Yellow
$result = Invoke-SSHCommand -SessionId $Session.SessionId -Command $commands

Write-Host ''
Write-Host $result.Output

if ($result.ExitStatus -eq 0) {
    Write-Host ''
    Write-Host 'Despliegue completado exitosamente' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host 'Hubo errores durante el despliegue' -ForegroundColor Red
    if ($result.Error) { Write-Host $result.Error }
}

Remove-SSHSession -SessionId $Session.SessionId | Out-Null
