@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:menu
cls
echo =============================================
echo   Zi2Anki Server Manager
echo =============================================
echo   [1] Start All  (Backend 3001 + Frontend 3000)
echo   [2] Restart All
echo   [3] Stop All
echo   [4] Backend Only (3001)
echo   [5] Frontend Only (3000)
echo   [0] Exit
echo =============================================
set /p choice="> "

if "%choice%"=="0" exit /b
if "%choice%"=="1" call :kill && call :start_backend && call :start_frontend && goto menu
if "%choice%"=="2" call :kill && timeout /t 2 /nobreak >nul && call :start_backend && call :start_frontend && goto menu
if "%choice%"=="3" call :kill && goto menu
if "%choice%"=="4" call :start_backend && goto menu
if "%choice%"=="5" call :start_frontend && goto menu
goto menu

:start_backend
echo [INFO] Starting backend on :3001 ...
start "Zi2Anki-Backend" cmd /c "npx tsx server\index.ts"
timeout /t 3 /nobreak >nul
curl -s -o nul http://localhost:3001/api/decks >nul 2>&1
if %errorlevel% equ 0 (echo [ OK ] Backend ready) else (echo [WARN] Backend not responding yet)
goto :eof

:start_frontend
echo [INFO] Starting frontend on :3000 ...
start "Zi2Anki-Frontend" cmd /c "npx vite --port 3000"
timeout /t 3 /nobreak >nul
curl -s -o nul http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (echo [ OK ] Frontend ready) else (echo [WARN] Frontend not responding yet)
goto :eof

:kill
echo [INFO] Stopping existing services ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Zi2Anki-Backend*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Zi2Anki-Frontend*" >nul 2>&1
echo [ OK ] Stopped
goto :eof
