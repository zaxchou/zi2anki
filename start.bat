@echo off
cd /d "%~dp0"

echo ========================================
echo   Zi2Anki - 启动
echo ========================================
echo.

REM 后端
echo [1/2] 启动后端 (:3001) ...
start "Zi2Anki-Backend" cmd /c "npx tsx server/index.ts & pause"

timeout /t 3 /nobreak >nul

REM 前端
echo [2/2] 启动前端 (:3000) ...
start "Zi2Anki-Frontend" cmd /c "npx vite --port 3000 & pause"

echo.
echo   后端: http://localhost:3001
echo   前端: http://localhost:3000
echo.
echo   关闭方式：关闭对应窗口即可
echo.
pause
