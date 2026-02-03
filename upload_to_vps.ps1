# Script para subir archivos al VPS usando SCP
# Requiere: tener instalado OpenSSH o usar Posh-SSH

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Subiendo cambios al VPS crumi.ai" -ForegroundColor Cyan
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
Write-Host "Conectando..." -ForegroundColor Yellow
$Session = New-SSHSession -ComputerName $VPS_HOST -Credential $Credential -AcceptKey

if (-not $Session) {
    Write-Host "Error al conectar" -ForegroundColor Red
    exit 1
}

Write-Host "Conectado OK" -ForegroundColor Green
Write-Host ""

# Archivos a subir
$files = @(
    "front\src\pages\Landing\index.tsx",
    "front\src\services\openaiService.ts",
    "front\.env",
    "back\src\config\alegraConfig.js",
    "back\.env"
)

# Rutas remotas: un solo front y un solo back
$frontPath = "/var/www/frontend"
$backPath = "/var/www/backend"

foreach ($localFile in $files) {
    if (Test-Path $localFile) {
        Write-Host "Subiendo: $localFile" -ForegroundColor Yellow
        
        # Determinar ruta remota
        if ($localFile -like "front\*") {
            $remoteFile = $localFile -replace "front\\", "$frontPath/"
            $remoteFile = $remoteFile -replace "\\", "/"
        }
        elseif ($localFile -like "back\*") {
            $remoteFile = $localFile -replace "back\\", "$backPath/"
            $remoteFile = $remoteFile -replace "\\", "/"
        }
        
        Write-Host "  -> $remoteFile" -ForegroundColor Gray
        
        # Crear directorio remoto
        $remoteDir = $remoteFile.Substring(0, $remoteFile.LastIndexOf("/"))
        Invoke-SSHCommand -SessionId $Session.SessionId -Command "mkdir -p $remoteDir" | Out-Null
        
        # Subir archivo
        try {
            Set-SCPFile -ComputerName $VPS_HOST -Credential $Credential -LocalFile $localFile -RemotePath $remoteFile -AcceptKey
            Write-Host "  OK" -ForegroundColor Green
        }
        catch {
            Write-Host "  ERROR: $_" -ForegroundColor Red
        }
    }
    else {
        Write-Host "No encontrado: $localFile" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Reiniciando servicios..." -ForegroundColor Cyan

# Reiniciar backend (solo hay un proceso: backend)
Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 restart backend" | Out-Null

# Rebuild frontend
Write-Host "Reconstruyendo frontend..." -ForegroundColor Yellow
Invoke-SSHCommand -SessionId $Session.SessionId -Command "cd $frontPath && npm run build" | Out-Null

Write-Host ""
Write-Host "Completado!" -ForegroundColor Green
Write-Host "Verifica: https://crumi.ai" -ForegroundColor Cyan

Remove-SSHSession -SessionId $Session.SessionId | Out-Null
