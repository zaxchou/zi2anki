@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   Zi2Anki - Starting
echo ========================================
echo.

set PG_BIN=C:\Program Files\PostgreSQL\16\bin

REM Check PostgreSQL
"%PG_BIN%\pg_isready.exe" -h localhost >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL is not running!
    echo   Start it manually:
    echo   1. net start postgresql-x64-16
    echo   2. Or: Services ^> start "postgresql-x64-16"
    echo.
    pause
    exit /b 1
)

echo [1/2] Starting backend (:3001) ...
start "Zi2Anki-Backend" npx tsx server/index.ts

timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend (:3000) ...
start "Zi2Anki-Frontend" npx vite --port 3000

echo.
echo   Backend: http://localhost:3001
echo   Frontend: http://localhost:3000
echo.
echo   Close the windows to stop.
echo.
pause
