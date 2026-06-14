@echo off
cd /d "%~dp0"

echo =============================================
echo   Zi2Anki - Start All Services
echo =============================================

echo.
echo [1/2] Starting backend (:3001) ...
start "Zi2Anki-Backend" /d "%~dp0" cmd /k npx tsx server/index.ts
timeout /t 4 /nobreak >nul

echo.
echo [2/2] Starting frontend (:3000) ...
start "Zi2Anki-Frontend" /d "%~dp0" cmd /k npx vite --port 3000
timeout /t 3 /nobreak >nul

echo.
echo [OK] http://localhost:3000
pause
