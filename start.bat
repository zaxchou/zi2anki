@echo off
chcp 65001 >nul
title Zi2Anki 服务管理
cd /d "%~dp0"

:menu
cls
echo ╔════════════════════════════════╗
echo ║     Zi2Anki · 服务管理        ║
echo ╠════════════════════════════════╣
echo ║  [1] 启动服务 (后端 + 前端)   ║
echo ║  [2] 重启服务                 ║
echo ║  [3] 停止所有服务             ║
echo ║  [4] 仅启动后端 (3001)       ║
echo ║  [5] 仅启动前端 (3000)       ║
echo ║  [0] 退出                     ║
echo ╚════════════════════════════════╝
echo.
set /p choice="请选择: "

if "%choice%"=="0" exit /b
if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto restart
if "%choice%"=="3" goto kill
if "%choice%"=="4" goto start_backend
if "%choice%"=="5" goto start_frontend
goto menu

:: ===== 启动全部 =====
:start_all
call :kill_procs
call :start_backend
call :start_frontend
goto menu

:: ===== 重启 =====
:restart
call :kill_procs
timeout /t 2 /nobreak >nul
call :start_backend
call :start_frontend
goto menu

:: ===== 停止 =====
:kill
call :kill_procs
echo 已停止所有服务
timeout /t 1 >nul
goto menu

:: ===== 仅后端 =====
:start_backend
echo [启动] 后端服务 (3001)...
start "Zi2Anki-Backend" cmd /c "npx tsx server\index.ts"
timeout /t 3 /nobreak >nul
curl -s -o nul http://localhost:3001/api/decks >nul 2>&1 && echo         后端已就绪 ✓ || echo         ⚠ 后端未响应，可能还在加载
goto :eof

:: ===== 仅前端 =====
:start_frontend
echo [启动] 前端服务 (3000)...
start "Zi2Anki-Frontend" cmd /c "npx vite --port 3000"
timeout /t 3 /nobreak >nul
curl -s -o nul http://localhost:3000 >nul 2>&1 && echo         前端已就绪 ✓ || echo         ⚠ 前端未响应，可能还在加载
goto :eof

:: ===== 杀进程 =====
:kill_procs
echo [清理] 关闭已有服务进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)
:: 关闭之前的命令行窗口
taskkill /f /fi "WINDOWTITLE eq Zi2Anki-Backend*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Zi2Anki-Frontend*" >nul 2>&1
goto :eof
