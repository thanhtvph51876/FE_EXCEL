param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    Write-Error "Missing DATABASE_URL. Run from backend venv or pass -DatabaseUrl."
    exit 1
}
if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file not found: $BackupFile"
    exit 1
}

pg_restore --clean --if-exists --dbname=$DatabaseUrl $BackupFile
Write-Host "Database restored from $BackupFile"
