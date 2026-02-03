# Test PostgreSQL passwords provided by user
$passwords = @("53121C4rl0$", "53121C4rl0$@")
$pgDumpPath = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'

Write-Host "Creating PostgreSQL backup..."

foreach ($pwd in $passwords) {
    Write-Host "`nTrying password..."
    
    # Create pgpass file
    $pgpassContent = "localhost:5432:*:postgres:$pwd"
    $pgpassPath = "$env:APPDATA\postgresql\pgpass.conf"
    
    # Create directory if it doesn't exist
    $pgpassDir = Split-Path $pgpassPath
    if (!(Test-Path $pgpassDir)) {
        New-Item -ItemType Directory -Path $pgpassDir -Force | Out-Null
    }
    
    # Write pgpass file
    Set-Content -Path $pgpassPath -Value $pgpassContent -Force
    
    # Set environment variables
    $env:PGPASSFILE = $pgpassPath
    $env:PGPASSWORD = $pwd
    
    # Create backup
    $backupFile = "crumi_bd_backup_$timestamp.sql"
    & $pgDumpPath -U postgres -h localhost -p 5432 -d crumi_bd -f $backupFile 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile) -and (Get-Item $backupFile).Length -gt 1000) {
        Write-Host "SUCCESS! Backup created." -ForegroundColor Green
        $backupSize = (Get-Item $backupFile).Length
        Write-Host "Backup file: $backupFile"
        Write-Host "Size: $([math]::Round($backupSize / 1MB, 2)) MB"
        
        # Compress to ZIP
        Write-Host "`nCompressing to ZIP..."
        $zipFile = "crumi_bd_backup_$timestamp.zip"
        Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
        
        $zipSize = (Get-Item $zipFile).Length
        Write-Host "ZIP file: $zipFile"
        Write-Host "ZIP size: $([math]::Round($zipSize / 1MB, 2)) MB"
        Write-Host "Compression ratio: $([math]::Round(($zipSize / $backupSize) * 100, 1))%"
        
        Write-Host "`nBackup ready for upload to VPS!" -ForegroundColor Green
        exit 0
    }
    else {
        if (Test-Path $backupFile) {
            Remove-Item $backupFile -Force
        }
    }
}

Write-Host "`nERROR: Backup failed with both passwords!" -ForegroundColor Red
exit 1
