# Test PostgreSQL connection and create backup
$env:PGPASSWORD = '53121C4rl0$'
$pgDumpPath = 'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe'
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "crumi_db_fresh_$timestamp.sql"

Write-Host "Testing PostgreSQL connection..." -ForegroundColor Cyan
Write-Host "Database: crumi_db"
Write-Host "Port: 5433"
Write-Host "User: postgres"
Write-Host "Host: localhost"
Write-Host ""

# Test connection first
$psqlPath = 'C:\Program Files\PostgreSQL\15\bin\psql.exe'
Write-Host "Testing connection with psql..."
$testResult = & $psqlPath -U postgres -h localhost -p 5433 -d crumi_db -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Connection successful!" -ForegroundColor Green
    Write-Host $testResult
}
else {
    Write-Host "Connection failed!" -ForegroundColor Red
    Write-Host $testResult
    Write-Host ""
    Write-Host "Trying to list databases on port 5433..."
    & $psqlPath -U postgres -h localhost -p 5433 -l 2>&1
    exit 1
}

Write-Host ""
Write-Host "Creating backup..." -ForegroundColor Cyan

# Create backup
& $pgDumpPath -U postgres -h localhost -p 5433 -d crumi_db -f $backupFile -v 2>&1

if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 10000)) {
    $fileSize = (Get-Item $backupFile).Length
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Backup file: $backupFile"
    Write-Host "Size: $([math]::Round($fileSize / 1MB, 2)) MB"
    
    # Compress
    $zipFile = "crumi_db_fresh_$timestamp.zip"
    Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
    Write-Host "ZIP file: $zipFile"
    Write-Host "ZIP size: $([math]::Round((Get-Item $zipFile).Length / 1MB, 2)) MB"
    exit 0
}
else {
    Write-Host ""
    Write-Host "Backup failed!" -ForegroundColor Red
    if (Test-Path $backupFile) {
        Write-Host "File created but too small: $((Get-Item $backupFile).Length) bytes"
        Get-Content $backupFile | Select-Object -First 20
    }
    exit 1
}
