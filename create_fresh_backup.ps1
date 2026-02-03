# Create fresh PostgreSQL backup with user-provided passwords
$passwords = @('53121C4rl0$', '53121C4rl0$@')
$pgDumpPath = "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "crumi_bd_fresh_backup_$timestamp.sql"

Write-Host "Creating FRESH PostgreSQL backup with current data..." -ForegroundColor Cyan
Write-Host "Database: crumi_bd"
Write-Host "Output: $backupFile`n"

foreach ($pwd in $passwords) {
    Write-Host "Attempting with password variant..." -ForegroundColor Yellow
    
    # Try using environment variable directly (some systems prefer this)
    $env:PGPASSWORD = $pwd
    
    # Run pg_dump with verbose error output
    $errorOutput = ""
    try {
        & $pgDumpPath --username=postgres --host=localhost --port=5432 --format=plain --file=$backupFile crumi_bd 2>&1 | Tee-Object -Variable errorOutput | Out-Null
    }
    catch {
        $errorOutput = $_.Exception.Message
    }
    
    # Check if backup was successful
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile)) {
        $fileSize = (Get-Item $backupFile).Length
        if ($fileSize -gt 10000) {
            Write-Host "`n✓ SUCCESS! Fresh backup created." -ForegroundColor Green
            Write-Host "  File: $backupFile"
            Write-Host "  Size: $([math]::Round($fileSize / 1KB, 2)) KB ($([math]::Round($fileSize / 1MB, 2)) MB)"
            
            # Show some stats
            $lineCount = (Get-Content $backupFile | Measure-Object -Line).Lines
            Write-Host "  Lines: $lineCount"
            
            # Compress to ZIP
            Write-Host "`nCompressing to ZIP..." -ForegroundColor Cyan
            $zipFile = "crumi_bd_fresh_backup_$timestamp.zip"
            Compress-Archive -Path $backupFile -DestinationPath $zipFile -Force
            
            $zipSize = (Get-Item $zipFile).Length
            Write-Host "✓ ZIP created: $zipFile"
            Write-Host "  Size: $([math]::Round($zipSize / 1KB, 2)) KB ($([math]::Round($zipSize / 1MB, 2)) MB)"
            Write-Host "  Compression: $([math]::Round(($zipSize / $fileSize) * 100, 1))%"
            
            Write-Host "`n✓ Fresh backup ready for upload to VPS!" -ForegroundColor Green
            exit 0
        }
    }
    
    # Log error for debugging
    if ($errorOutput) {
        Write-Host "  Error: $($errorOutput -join ' ')" -ForegroundColor Red
    }
    
    # Clean up failed attempt
    if (Test-Path $backupFile) {
        Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n✗ ERROR: Could not create backup with provided passwords" -ForegroundColor Red
Write-Host "Please verify the PostgreSQL password and try again."
exit 1
