@echo off
cd /d "%~dp0"

echo ========================================
echo   Zi2Anki - Starting
echo ========================================
echo.

echo [0/3] Killing old node processes ...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo   Done.
echo.

set PG_BIN=C:\Program Files\PostgreSQL\16\bin

"%PG_BIN%\pg_isready.exe" -h localhost >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL is not running!
    echo   Start it manually: net start postgresql-x64-16
    echo.
    pause
    exit /b 1
)

set NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2\node.exe

echo [1/3] Starting backend (:3001) ...
start "Zi2Anki-Backend" "%NODE%" node_modules\tsx\dist\cli.mjs server\index.ts
timeout /t 4 /nobreak >nul

echo [2/3] Starting frontend (:3000) ...
start "Zi2Anki-Frontend" "%NODE%" node_modules\vite\bin\vite.js --port 3000

echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:3000
echo.
echo   Close the windows to stop.
echo.
pause
