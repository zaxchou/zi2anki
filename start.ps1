$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Zi2Anki - Starting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[0/3] Killing old node processes ..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$pgReady = & "$pgBin\pg_isready.exe" -h localhost 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] PostgreSQL is not running!" -ForegroundColor Red
    Write-Host "  Start it manually: net start postgresql-x64-16"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[1/3] Starting backend (:3001) ..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath "node" -ArgumentList "node_modules\tsx\dist\cli.mjs","server\index.ts" -NoNewWindow -PassThru
Start-Sleep -Seconds 4

Write-Host "[2/3] Starting frontend (:3000) ..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath "node" -ArgumentList "node_modules\vite\bin\vite.js","--port","3000" -NoNewWindow -PassThru
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "Stopping ..." -ForegroundColor Yellow
    if ($backendJob) { Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue }
    if ($frontendJob) { Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue }
}
