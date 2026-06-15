param(
    [string]$StorageDir = ".\backend\storage",
    [string]$OutputDir = ".\backups"
)

if (-not (Test-Path $StorageDir)) {
    Write-Error "Storage directory not found: $StorageDir"
    exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path $OutputDir "excelai-storage-$timestamp.zip"
Compress-Archive -Path (Join-Path $StorageDir "*") -DestinationPath $target -Force
Write-Host "Storage backup written to $target"
