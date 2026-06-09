param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$StorageDir = ".\backend\storage"
)

if (-not (Test-Path $BackupFile)) {
    Write-Error "Storage backup not found: $BackupFile"
    exit 1
}

New-Item -ItemType Directory -Force -Path $StorageDir | Out-Null
Expand-Archive -Path $BackupFile -DestinationPath $StorageDir -Force
Write-Host "Storage restored to $StorageDir"
