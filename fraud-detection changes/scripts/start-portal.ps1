# Start Decision Intelligence Portal (production-like stack)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Starting portal stack (postgres, clickhouse, app-backend, frontend)..." -ForegroundColor Cyan
docker compose --profile app up -d postgres clickhouse app-backend frontend

Write-Host "Waiting for services to become healthy..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8400/health" -TimeoutSec 3
    if ($h.status -eq "ok") { break }
  } catch { Start-Sleep -Seconds 3 }
}

Write-Host ""
Write-Host "Portal ready:" -ForegroundColor Green
Write-Host "  UI:      http://localhost:3013"
Write-Host "  Login:   admin / admin2024!"
Write-Host "  API:     http://localhost:8400/health"
Write-Host ""
