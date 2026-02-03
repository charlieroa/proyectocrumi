$passwords = @('53121C4rl0$', '53121C4rl0$@')
$pgDumpPath = 'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe'
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "crumi_bd_fresh_backup_$timestamp.sql"

Write-Host "Creating FRESH backup of crumi_bd..." -ForegroundColor Cyan

foreach ($pass in $passwords) {
    Write-Host "Trying password option..."
    
    $env:PGPASSWORD = $pass
    
    & $pgDumpPath -U postgres -h localhost -p 5432 -d crumi_bd -f $backupFile 2>&1 | Out-Null
    
    if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 10000)) {
        $fileSize = (Get-Item $backupFile).Length
        Write-Host "SUCCESS! Backup created" -ForegroundColor Green
        Write-Host "File: $backupFile"
        Write-Host "Size: $([math]::Round($fileSize / 1MB, 2)) MB"
        
        # Compress
        $zipFile = "crumi_bd_fresh_backup_$timestamp.zip"
        Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
        
        $zipSize = (Get-Item $zipFile).Length
        Write-Host "ZIP: $zipFile"
        Write-Host "ZIP Size: $([math]::Round($zipSize / 1MB, 2)) MB"
        
        exit 0
    }
    
    if (Test-Path $backupFile) {
        Remove-Item $backupFile -Force
    }
}

Write-Host "ERROR: Backup failed with both passwords" -ForegroundColor Red
exit 1
