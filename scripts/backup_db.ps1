param(
    [string]$OutputDir = ".\backups",
    [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
    Write-Error "Missing DATABASE_URL. Run from backend venv or pass -DatabaseUrl."
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDir "excelai-db-$timestamp.dump"
pg_dump --format=custom --file=$target $DatabaseUrl
Write-Host "Database backup written to $target"
