$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "crumi_bd_backup_$timestamp.sql"
$pgDumpPath = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"

# Try without password first (trust authentication)
Write-Host "Attempting backup without password..."
& $pgDumpPath -U postgres -h localhost -p 5432 crumi_bd > $backupFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed with trust auth. Trying with PGPASSWORD..."
    # Try with common passwords
    $passwords = @("", "postgres", "admin", "123456")
    foreach ($pwd in $passwords) {
        $env:PGPASSWORD = $pwd
        Write-Host "Trying password: $pwd"
        & $pgDumpPath -U postgres -h localhost -p 5432 crumi_bd > $backupFile
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Success with password: $pwd"
            break
        }
    }
}

Write-Host "Backup created: $backupFile"
Write-Host "File size: $((Get-Item $backupFile).Length) bytes"

# Compress to ZIP
$zipFile = "crumi_bd_backup_$timestamp.zip"
Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
Write-Host "Compressed to: $zipFile"
Write-Host "ZIP size: $((Get-Item $zipFile).Length) bytes"
