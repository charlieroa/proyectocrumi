# Script para conectar por SSH y ejecutar comandos
# Usa Posh-SSH para manejar la conexión

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"

Write-Host "Conectando al VPS..." -ForegroundColor Yellow

# Intentar cargar Posh-SSH
try {
    Import-Module Posh-SSH -ErrorAction Stop
    Write-Host "Posh-SSH cargado" -ForegroundColor Green
}
catch {
    Write-Host "Instalando Posh-SSH..." -ForegroundColor Yellow
    try {
        Install-Module -Name Posh-SSH -Force -Scope CurrentUser -SkipPublisherCheck -AllowClobber
        Import-Module Posh-SSH
        Write-Host "Posh-SSH instalado y cargado" -ForegroundColor Green
    }
    catch {
        Write-Host "Error instalando Posh-SSH. Instala manualmente:" -ForegroundColor Red
        Write-Host "Install-Module -Name Posh-SSH -Scope CurrentUser" -ForegroundColor Yellow
        exit 1
    }
}

# Crear credenciales
$SecurePassword = ConvertTo-SecureString $VPS_PASS -AsPlainText -Force
$Credential = New-Object System.Management.Automation.PSCredential($VPS_USER, $SecurePassword)

# Conectar
Write-Host "Estableciendo conexión SSH..." -ForegroundColor Yellow
try {
    $Session = New-SSHSession -ComputerName $VPS_HOST -Credential $Credential -AcceptKey -ErrorAction Stop
    
    if ($Session) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "CONECTADO EXITOSAMENTE AL VPS" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Host: $VPS_HOST" -ForegroundColor Cyan
        Write-Host "Usuario: $VPS_USER" -ForegroundColor Cyan
        Write-Host "Session ID: $($Session.SessionId)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Ejecutando comando de prueba..." -ForegroundColor Yellow
        
        # Comando de prueba
        $result = Invoke-SSHCommand -SessionId $Session.SessionId -Command "pwd && whoami && ls -la /root | head -5"
        Write-Host $result.Output
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "Listo para ejecutar comandos" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "La sesion esta activa. Puedes decirme que hacer." -ForegroundColor Yellow
        Write-Host ""
        
        # Guardar Session ID en variable global para uso posterior
        $global:VPS_Session = $Session
        
        return $Session
    }
}
catch {
    Write-Host "Error al conectar: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifica:" -ForegroundColor Yellow
    Write-Host "  1. Que el VPS este accesible" -ForegroundColor Gray
    Write-Host "  2. Que las credenciales sean correctas" -ForegroundColor Gray
    Write-Host "  3. Que tengas conexion a internet" -ForegroundColor Gray
    exit 1
}
