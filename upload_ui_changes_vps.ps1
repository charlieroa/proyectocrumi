# Subir cambios de UI (sidebar, top bar, avatar, settings) al VPS crumi.ai
# Frontend en produccion: /var/www/frontend
# Usa PuTTY plink/pscp. Ejecutar: .\upload_ui_changes_vps.ps1

$ErrorActionPreference = "Stop"

$VPS_HOST = "38.242.209.6"
$VPS_USER = "root"
$VPS_PASS = "53121C4rl0"
$FRONT_PATH = "/var/www/frontend"

$plinkPath = "C:\Program Files\PuTTY\plink.exe"
$pscpPath = "C:\Program Files\PuTTY\pscp.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Subiendo cambios de UI al VPS (crumi.ai)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $pscpPath) -or -not (Test-Path $plinkPath)) {
    Write-Host "No se encontraron plink/pscp en PuTTY. Instala PuTTY o sube los archivos manualmente." -ForegroundColor Red
    Write-Host "Archivos a subir a $FRONT_PATH :" -ForegroundColor Yellow
    Write-Host "  front\src\Layouts\Sidebar.tsx"
    Write-Host "  front\src\Layouts\VerticalLayouts\index.tsx"
    Write-Host "  front\src\Components\Common\ProfileDropdown.tsx"
    Write-Host "  front\src\pages\Pages\Profile\Settings\Settings.tsx"
    Write-Host "  front\src\assets\scss\config\material\custom.scss"
    Write-Host "  front\src\assets\scss\config\material\_variables-custom.scss"
    Write-Host "Luego en el VPS: cd $FRONT_PATH && npm run build" -ForegroundColor Cyan
    exit 1
}

# Aceptar host key la primera vez
$env:PLINK_PROTOCOL = "ssh"
echo y | & $plinkPath -pw $VPS_PASS ${VPS_USER}@${VPS_HOST} "exit" 2>$null

# Archivos: Local -> Remote
$files = @(
    @("front\src\index.tsx", "$FRONT_PATH/src/index.tsx"),
    @("front\src\Routes\index.tsx", "$FRONT_PATH/src/Routes/index.tsx"),
    @("front\src\Layouts\index.tsx", "$FRONT_PATH/src/Layouts/index.tsx"),
    @("front\src\Layouts\Sidebar.tsx", "$FRONT_PATH/src/Layouts/Sidebar.tsx"),
    @("front\src\Layouts\VerticalLayouts\index.tsx", "$FRONT_PATH/src/Layouts/VerticalLayouts/index.tsx"),
    @("front\src\Components\Common\ErrorBoundary.tsx", "$FRONT_PATH/src/Components/Common/ErrorBoundary.tsx"),
    @("front\src\Components\Common\ProfileDropdown.tsx", "$FRONT_PATH/src/Components/Common/ProfileDropdown.tsx"),
    @("front\src\pages\Pages\Profile\Settings\Settings.tsx", "$FRONT_PATH/src/pages/Pages/Profile/Settings/Settings.tsx"),
    @("front\src\assets\scss\config\material\custom.scss", "$FRONT_PATH/src/assets/scss/config/material/custom.scss"),
    @("front\src\assets\scss\config\material\_variables-custom.scss", "$FRONT_PATH/src/assets/scss/config/material/_variables-custom.scss"),
    @("front\src\pages\Pages\Profile\Settings\datostenant.tsx", "$FRONT_PATH/src/pages/Pages/Profile/Settings/datostenant.tsx"),
    @("front\src\Layouts\LayoutMenuData.tsx", "$FRONT_PATH/src/Layouts/LayoutMenuData.tsx"),
    @("front\src\pages\Crm\CompaniesList.tsx", "$FRONT_PATH/src/pages/Crm/CompaniesList.tsx"),
    @("front\src\pages\Tasks\KanbanBoard\MainPage.tsx", "$FRONT_PATH/src/pages/Tasks/KanbanBoard/MainPage.tsx"),
    @("front\src\pages\Tasks\KanbanBoard\index.tsx", "$FRONT_PATH/src/pages/Tasks/KanbanBoard/index.tsx"),
    @("front\src\services\auth.ts", "$FRONT_PATH/src/services/auth.ts"),
    @("front\src\services\taskService.ts", "$FRONT_PATH/src/services/taskService.ts"),
    @("front\public\index.html", "$FRONT_PATH/public/index.html")
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
Write-Host "Construyendo frontend (npm run build)..." -ForegroundColor Cyan
& $plinkPath -pw $VPS_PASS ${VPS_USER}@${VPS_HOST} "cd $FRONT_PATH && npm run build"
& $plinkPath -pw $VPS_PASS ${VPS_USER}@${VPS_HOST} "chown -R www-data:www-data $FRONT_PATH/build"
Write-Host ""
Write-Host "Listo. Verifica: https://crumi.ai" -ForegroundColor Green
