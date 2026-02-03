# Script para subir cambios al VPS crumi.ai
# Ejecutar: .\upload_changes.ps1

$ErrorActionPreference = "Stop"

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"
# Un solo front y un solo back en el VPS (sin /root/crumifront ni /root/crumiback)
$frontPath = "/var/www/frontend"
$backPath = "/var/www/backend"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo cambios al VPS crumi.ai" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Frontend: $frontPath | Backend: $backPath" -ForegroundColor Gray
Write-Host ""

# Instalar módulo Posh-SSH si no está instalado
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "Instalando módulo Posh-SSH..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser -SkipPublisherCheck
}

Import-Module Posh-SSH

try {
    # Crear credenciales
    $SecurePassword = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
    $Credential = New-Object System.Management.Automation.PSCredential($VPS_USER, $SecurePassword)
    
    Write-Host "Conectando al VPS..." -ForegroundColor Yellow
    
    # Conectar al VPS
    $Session = New-SSHSession -ComputerName $VPS_HOST -Credential $Credential -AcceptKey
    
    if ($Session) {
        Write-Host "✓ Conectado exitosamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "Subiendo archivos modificados..." -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Archivos a subir
        $filesToUpload = @(
            @{
                Local = "front\src\pages\Landing\index.tsx"
                Remote = "$frontPath/src/pages/Landing/index.tsx"
                Description = "Landing page con asistente IA"
            },
            @{
                Local = "front\src\services\openaiService.ts"
                Remote = "$frontPath/src/services/openaiService.ts"
                Description = "Servicio OpenAI"
            },
            @{
                Local = "front\.env"
                Remote = "$frontPath/.env"
                Description = "Variables de entorno frontend (OpenAI API key)"
            },
            @{
                Local = "back\src\config\alegraConfig.js"
                Remote = "$backPath/src/config/alegraConfig.js"
                Description = "Configuración Alegra (producción)"
            },
            @{
                Local = "back\.env"
                Remote = "$backPath/.env"
                Description = "Variables de entorno backend (Alegra)"
            }
        )
        
        foreach ($file in $filesToUpload) {
            if (Test-Path $file.Local) {
                Write-Host "Subiendo: $($file.Description)" -ForegroundColor Yellow
                Write-Host "  Local: $($file.Local)" -ForegroundColor Gray
                Write-Host "  Remote: $($file.Remote)" -ForegroundColor Gray
                
                try {
                    # Crear directorio remoto si no existe
                    $remoteDir = Split-Path $file.Remote -Parent
                    $mkdirCmd = "mkdir -p `"$remoteDir`""
                    Invoke-SSHCommand -SessionId $Session.SessionId -Command $mkdirCmd | Out-Null
                    
                    # Subir archivo usando SCP
                    Set-SCPFile -ComputerName $VPS_HOST -Credential $Credential -LocalFile $file.Local -RemotePath $file.Remote -AcceptKey
                    Write-Host "  ✓ Subido exitosamente" -ForegroundColor Green
                }
                catch {
                    Write-Host "  ✗ Error al subir: $_" -ForegroundColor Red
                }
            } else {
                Write-Host "⚠ Archivo no encontrado: $($file.Local)" -ForegroundColor Yellow
            }
            Write-Host ""
        }
        
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host "Build frontend y reinicio backend..." -ForegroundColor Cyan
        Write-Host "==========================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Solo backend en PM2. Frontend lo sirve nginx desde build.
        $buildFront = "cd $frontPath && npm run build"
        Write-Host "Ejecutando: $buildFront" -ForegroundColor Yellow
        $r1 = Invoke-SSHCommand -SessionId $Session.SessionId -Command $buildFront
        if ($r1.ExitStatus -eq 0) { Write-Host "  ✓ Frontend build OK" -ForegroundColor Green } else { Write-Host "  ⚠ Build: $($r1.Output)" -ForegroundColor Yellow }
        
        Write-Host "Ejecutando: pm2 restart backend" -ForegroundColor Yellow
        $r2 = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pm2 restart backend"
        if ($r2.ExitStatus -eq 0) { Write-Host "  ✓ Backend reiniciado" -ForegroundColor Green } else { Write-Host "  ⚠ $($r2.Output)" -ForegroundColor Yellow }
        
        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "✓ Proceso completado" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verifica: https://crumi.ai | https://api.crumi.ai" -ForegroundColor Cyan
        Write-Host ""
        
        # Cerrar sesión
        Remove-SSHSession -SessionId $Session.SessionId | Out-Null
        
    } else {
        Write-Host "✗ Error al conectar al VPS" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host ""
    Write-Host "✗ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica:" -ForegroundColor Yellow
    Write-Host "  1. Que el VPS esté accesible" -ForegroundColor Gray
    Write-Host "  2. Que las credenciales sean correctas" -ForegroundColor Gray
    Write-Host "  3. Que tengas conexión a internet" -ForegroundColor Gray
    exit 1
}
