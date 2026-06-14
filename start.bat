@echo off
cd /d "%~dp0"

:menu
cls
echo =============================================
echo   Zi2Anki Server Manager
echo =============================================
echo   [1] Start All  (Backend 3001 + Frontend 3000)
echo   [2] Restart All
echo   [3] Stop All
echo   [0] Exit
echo =============================================
set /p choice="> "

if "%choice%"=="0" exit /b
if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto restart
if "%choice%"=="3" goto stop
goto menu

:start_all
call :stop
call :start_backend
call :start_frontend
goto menu

:restart
call :stop
timeout /t 2 /nobreak >nul
call :start_backend
call :start_frontend
goto menu

:stop
echo Stopping ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Zi2Anki*" >nul 2>&1
echo Done.
goto :eof

:start_backend
echo Starting backend ...
start "Zi2Anki-Backend" cmd /c "cd /d %~dp0 && npx tsx server/index.ts"
timeout /t 4 /nobreak >nul
echo Backend: http://localhost:3001
goto :eof

:start_frontend
echo Starting frontend ...
start "Zi2Anki-Frontend" cmd /c "cd /d %~dp0 && npx vite --port 3000"
timeout /t 3 /nobreak >nul
echo Frontend: http://localhost:3000
goto :eof
