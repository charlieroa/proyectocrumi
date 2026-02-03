# Create fresh backup with CORRECT credentials from .env
$env:PGPASSWORD = '53121C4rl0$'
$pgDumpPath = 'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe'
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "crumi_db_fresh_$timestamp.sql"

Write-Host "Creating FRESH backup with correct credentials..." -ForegroundColor Cyan
Write-Host "Database: crumi_db"
Write-Host "Port: 5433"
Write-Host "User: postgres"
Write-Host ""

# Use CORRECT port 5433 and database name crumi_db
& $pgDumpPath -U postgres -h localhost -p 5433 -d crumi_db -f $backupFile

if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 10000)) {
    $fileSize = (Get-Item $backupFile).Length
    Write-Host "SUCCESS! Fresh backup created" -ForegroundColor Green
    Write-Host "File: $backupFile"
    Write-Host "Size: $([math]::Round($fileSize / 1KB, 2)) KB ($([math]::Round($fileSize / 1MB, 2)) MB)"
    
    # Count lines for verification
    $lines = (Get-Content $backupFile | Measure-Object -Line).Lines
    Write-Host "Lines: $lines"
    
    # Compress to ZIP
    Write-Host ""
    Write-Host "Compressing to ZIP..." -ForegroundColor Cyan
    $zipFile = "crumi_db_fresh_$timestamp.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    
    $zipSize = (Get-Item $zipFile).Length
    Write-Host "SUCCESS! ZIP created" -ForegroundColor Green
    Write-Host "File: $zipFile"
    Write-Host "Size: $([math]::Round($zipSize / 1KB, 2)) KB ($([math]::Round($zipSize / 1MB, 2)) MB)"
    Write-Host "Compression ratio: $([math]::Round(($zipSize / $fileSize) * 100, 1))%"
    
    Write-Host ""
    Write-Host "Ready to upload to VPS!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "ERROR: Backup failed or file too small" -ForegroundColor Red
    if (Test-Path $backupFile) {
        Write-Host "File size: $((Get-Item $backupFile).Length) bytes"
    }
    exit 1
}
