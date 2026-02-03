# Test different PostgreSQL passwords
$passwords = @("postgres", "admin", "123456", "root", "password", "")
$pgDumpPath = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'

Write-Host "Testing PostgreSQL passwords..."

foreach ($pwd in $passwords) {
    Write-Host "`nTesting password: '$pwd'"
    
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
    
    # Also try PGPASSFILE environment variable
    $env:PGPASSFILE = $pgpassPath
    $env:PGPASSWORD = $pwd
    
    # Test connection
    $testFile = "test_backup_$timestamp.sql"
    & $pgDumpPath -U postgres -h localhost -p 5432 -d crumi_bd -f $testFile 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $testFile) -and (Get-Item $testFile).Length -gt 1000) {
        Write-Host "SUCCESS! Password is: '$pwd'" -ForegroundColor Green
        Write-Host "Backup file size: $((Get-Item $testFile).Length) bytes"
        
        # Create final backup with timestamp
        $finalBackup = "crumi_bd_backup_$timestamp.sql"
        Move-Item -Path $testFile -Destination $finalBackup -Force
        
        # Compress to ZIP
        $zipFile = "crumi_bd_backup_$timestamp.zip"
        Compress-Archive -Path $finalBackup -DestinationPath $zipFile -Force
        
        Write-Host "`nFinal backup: $finalBackup"
        Write-Host "ZIP file: $zipFile ($(((Get-Item $zipFile).Length / 1MB).ToString('0.00')) MB)"
        
        exit 0
    }
    else {
        if (Test-Path $testFile) {
            Remove-Item $testFile -Force
        }
    }
}

Write-Host "`nERROR: None of the passwords worked!" -ForegroundColor Red
Write-Host "Please enter the correct PostgreSQL password for user 'postgres'"
