@echo off
cd /d "%~dp0"

echo ========================================
echo   Zi2Anki - Starting
echo ========================================
echo.

echo [0/4] Killing ALL node processes (wmic + taskkill) ...
:: 先用 wmic 杀（更彻底，能杀后台进程）
wmic process where "name='node.exe'" delete >nul 2>&1
timeout /t 2 /nobreak >nul
:: 再用 taskkill 补刀（防止 wmic 遗漏）
taskkill /f /im node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

:: 确认端口空闲（使用更精确的匹配，避免误杀）
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo   [WARN] Port 3000 still in use, force killing...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 "') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)
netstat -ano | findstr ":3001 " >nul 2>&1
if %errorlevel% equ 0 (
    echo   [WARN] Port 3001 still in use, force killing...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 "') do (
        taskkill /f /pid %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)
echo   Done.
echo.

echo [1/4] Clearing tsx cache ...
if exist "%TEMP%\tsx" rmdir /s /q "%TEMP%\tsx" 2>nul
if exist "%LOCALAPPDATA%\tsx" rmdir /s /q "%LOCALAPPDATA%\tsx" 2>nul
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

echo [2/4] Starting backend (:3001) ...
:: 使用 node --import tsx（不用 tsx CLI），避免 tsx 缓存问题
start "Zi2Anki-Backend" "%NODE%" "--import" "tsx/register" "server/index.ts"

:: 等待后端就绪（固定等 8 秒，简单可靠）
echo   Waiting for backend...
timeout /t 8 /nobreak >nul
echo   Done.
echo.

echo [3/4] Starting frontend (:3000) ...
start "Zi2Anki-Frontend" "%NODE%" node_modules\vite\bin\vite.js --port 3000

echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:3000
echo.
echo   Close the windows to stop.
echo.
pause
