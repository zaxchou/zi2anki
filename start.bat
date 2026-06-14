@echo off
cd /d "%~dp0"

echo =============================================
echo   Zi2Anki - Start All Services
echo =============================================

echo.
echo [1/2] Starting backend on :3001 ...
start "Zi2Anki-Backend" /D "%~dp0" npx tsx server\index.ts
timeout /t 4 /nobreak >nul
echo       Backend: http://localhost:3001

echo.
echo [2/2] Starting frontend on :3000 ...
start "Zi2Anki-Frontend" /D "%~dp0" npx vite --port 3000
timeout /t 3 /nobreak >nul
echo       Frontend: http://localhost:3000

echo.
echo =============================================
echo   All services started!
echo   Open http://localhost:3000
echo =============================================

timeout /t 5 /nobreak >nul
