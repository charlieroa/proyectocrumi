# Script para subir integración Alegra al VPS
# Requiere: Posh-SSH

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Subiendo Integracion Alegra al VPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Instalar Posh-SSH si no existe
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Instalando Posh-SSH..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser -SkipPublisherCheck
}

Import-Module Posh-SSH

# Credenciales
$SecurePassword = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($VPS_USER, $SecurePassword)

# Conectar
Write-Host "Conectando al VPS..." -ForegroundColor Yellow
$Session = New-SSHSession -ComputerName $VPS_HOST -Credential $Credential -AcceptKey

if (-not $Session) {
    Write-Host "Error al conectar" -ForegroundColor Red
    exit 1
}

Write-Host "Conectado OK" -ForegroundColor Green
Write-Host ""

# Rutas
$frontPath = "/var/www/frontend"
$backPath = "/var/www/backend"

# Archivos a subir
$files = @(
    @{ local = "back\src\services\alegraService.js"; remote = "$backPath/src/services/alegraService.js" },
    @{ local = "back\src\controllers\alegraController.js"; remote = "$backPath/src/controllers/alegraController.js" },
    @{ local = "back\src\routes\alegraRoutes.js"; remote = "$backPath/src/routes/alegraRoutes.js" },
    @{ local = "back\src\migrations\runMigrations.js"; remote = "$backPath/src/migrations/runMigrations.js" },
    @{ local = "back\src\index.js"; remote = "$backPath/src/index.js" },
    @{ local = "back\.env"; remote = "$backPath/.env" },
    @{ local = "front\src\pages\income\SalesInvoice\tabs\SetPruebasTab.tsx"; remote = "$frontPath/src/pages/income/SalesInvoice/tabs/SetPruebasTab.tsx" }
)

# Crear directorio migrations si no existe
Write-Host "Creando directorios..." -ForegroundColor Yellow
Invoke-SSHCommand -SessionId $Session.SessionId -Command "mkdir -p $backPath/src/migrations" | Out-Null

foreach ($file in $files) {
    $localPath = $file.local
    $remotePath = $file.remote
    
    if (Test-Path $localPath) {
        Write-Host "Subiendo: $localPath" -ForegroundColor Yellow
        Write-Host "  -> $remotePath" -ForegroundColor Gray
        
        try {
            Set-SCPItem -ComputerName $VPS_HOST -Credential $Credential -Path $localPath -Destination $remotePath -AcceptKey
            Write-Host "  OK" -ForegroundColor Green
        }
        catch {
            Write-Host "  ERROR: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "No encontrado: $localPath" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Reiniciando backend con PM2..." -ForegroundColor Cyan
$result = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 restart backend"
Write-Host $result.Output -ForegroundColor Gray

Write-Host ""
Write-Host "Verificando logs del backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$logs = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 logs backend --lines 20 --nostream"
Write-Host $logs.Output -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Integracion Alegra subida!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ve a Settings y completa los datos fiscales de tu empresa." -ForegroundColor Cyan
Write-Host "Luego ve a Facturacion > Set de Pruebas para iniciar la habilitacion." -ForegroundColor Cyan

Remove-SSHSession -SessionId $Session.SessionId | Out-Null
