# Try multiple authentication methods
$pgDumpPath = 'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe'
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "crumi_bd_backup_$timestamp.sql"

Write-Host "Attempting PostgreSQL backup with different methods..." -ForegroundColor Cyan

# Method 1: Try with Windows user (peer/ident authentication)
Write-Host "`nMethod 1: Windows authentication"
& $pgDumpPath -h localhost -p 5432 -d crumi_bd -f $backupFile 2>&1 | Out-Null
if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 1000)) {
    Write-Host "SUCCESS with Windows auth!" -ForegroundColor Green
    $fileSize = (Get-Item $backupFile).Length
    Write-Host "Size: $([math]::Round($fileSize / 1MB, 3)) MB"
    $zipFile = "crumi_bd_backup_$timestamp.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    Write-Host "ZIP: $zipFile ($([math]::Round((Get-Item $zipFile).Length / 1MB, 3)) MB)"
    exit 0
}
if (Test-Path $backupFile) { Remove-Item $backupFile -Force }

# Method 2: Try with current Windows username
$winUser = $env:USERNAME
Write-Host "`nMethod 2: Windows user ($winUser)"
& $pgDumpPath -U $winUser -h localhost -p 5432 -d crumi_bd -f $backupFile 2>&1 | Out-Null
if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 1000)) {
    Write-Host "SUCCESS with user $winUser!" -ForegroundColor Green
    $fileSize = (Get-Item $backupFile).Length
    Write-Host "Size: $([math]::Round($fileSize / 1MB, 3)) MB"
    $zipFile = "crumi_bd_backup_$timestamp.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    Write-Host "ZIP: $zipFile ($([math]::Round((Get-Item $zipFile).Length / 1MB, 3)) MB)"
    exit 0
}
if (Test-Path $backupFile) { Remove-Item $backupFile -Force }

# Method 3: Check if pgAdmin exists and can backup
$pgAdminPath = "C:\Program Files\pgAdmin 4"
if (Test-Path $pgAdminPath) {
    Write-Host "`nMethod 3: pgAdmin found at $pgAdminPath"
    Write-Host "Consider using pgAdmin to create backup manually"
}

Write-Host "`nAll automatic methods failed." -ForegroundColor Yellow
Write-Host "Finding pg_hba.conf location for troubleshooting..."

# Find pg_hba.conf
$psqlPath = 'C:\Program Files\PostgreSQL\15\bin\psql.exe'
$hbaQuery = "SHOW hba_file;"
Write-Host "Checking PostgreSQL config..."

exit 1
