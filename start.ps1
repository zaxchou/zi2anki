$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Zi2Anki - Starting" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[0/4] Killing old node processes ..." -ForegroundColor Yellow
# 先用 PowerShell 杀进程（更彻底）
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
# 再用端口验证确保没有残留
$portsToCheck = @(3000, 3001)
foreach ($port in $portsToCheck) {
    $conn = netstat -ano | Select-String ":$port "
    if ($conn) {
        Write-Host "  [WARN] Port $port still in use, force killing..." -ForegroundColor Yellow
        $pidLine = $conn -split '\s+' | Select-Object -Last 1
        if ($pidLine) { Stop-Process -Id $pidLine -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    }
}
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

Write-Host "[1/4] Clearing tsx cache ..." -ForegroundColor Yellow
Remove-Item -Path "$env:TEMP\tsx" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:LOCALAPPDATA\tsx" -Recurse -Force -ErrorAction SilentlyContinue
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

$nodeExe = "$env:USERPROFILE\.workbuddy\binaries\node\versions\22.22.2\node.exe"

Write-Host "[2/4] Starting backend (:3001) ..." -ForegroundColor Yellow
# 使用 node --import tsx（不用 tsx CLI），避免 tsx 缓存问题
$backendJob = Start-Process -FilePath $nodeExe -ArgumentList "--import","tsx","server/index.ts" -NoNewWindow -PassThru
Start-Sleep -Seconds 8
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

Write-Host "[3/4] Starting frontend (:3000) ..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath $nodeExe -ArgumentList "node_modules/vite/bin/vite.js","--port","3000" -NoNewWindow -PassThru

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
