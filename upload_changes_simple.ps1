# Script simplificado para subir cambios al VPS crumi.ai
# Ejecutar: .\upload_changes_simple.ps1

$ErrorActionPreference = "Continue"

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo cambios al VPS crumi.ai" -ForegroundColor Cyan
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

# Detectar rutas del proyecto
Write-Host "Detectando estructura del proyecto..." -ForegroundColor Yellow
$detectResult = Invoke-SSHCommand -SessionId $Session.SessionId -Command "find /root /home /var/www -type d -name 'crumi*' 2>/dev/null | head -5"
Write-Host $detectResult.Output

# Rutas comunes (ajustar según tu estructura)
$frontPath = "/var/www/frontend"
$backPath = "/var/www/backend"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo archivos..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Archivos a subir - SOLO taskController.js con fix
$files = @(
    @{Local="back\src\controllers\taskController.js"; Remote="$backPath/src/controllers/taskController.js"; Desc="TaskController con fix de listado usuarios"}
)

foreach ($file in $files) {
    if (Test-Path $file.Local) {
        Write-Host "Subiendo: $($file.Desc)" -ForegroundColor Yellow
        Write-Host "  De: $($file.Local)" -ForegroundColor Gray
        Write-Host "  A:  $($file.Remote)" -ForegroundColor Gray
        
        # Crear directorio remoto
        $remoteDir = $file.Remote.Substring(0, $file.Remote.LastIndexOf('/'))
        $mkdirCmd = "mkdir -p `"$remoteDir`""
        $mkdirResult = Invoke-SSHCommand -SessionId $Session.SessionId -Command $mkdirCmd
        
        # Subir archivo
        try {
            Set-SCPFile -ComputerName $VPS_HOST -Credential $Credential -LocalFile $file.Local -RemotePath $file.Remote -AcceptKey
            Write-Host "  ✓ Subido exitosamente" -ForegroundColor Green
        }
        catch {
            Write-Host "  ✗ Error: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "⚠ No encontrado: $($file.Local)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Reiniciando servicios..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Reiniciar backend
Write-Host "Reiniciando backend..." -ForegroundColor Yellow
$restartBack = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 restart backend"
Write-Host $restartBack.Output

# Verificar logs
Write-Host ""
Write-Host "Verificando estado..." -ForegroundColor Yellow
$statusResult = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 list"
Write-Host $statusResult.Output

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✓ Proceso completado" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Verifica en: https://crumi.ai" -ForegroundColor Cyan
Write-Host ""

# Cerrar sesión
Remove-SSHSession -SessionId $Session.SessionId | Out-Null
