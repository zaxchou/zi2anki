@echo off
echo Stopping Zi2Anki...
:: 通过窗口名精确杀进程（只杀本应用启动的进程）
taskkill /f /fi "WINDOWTITLE eq Zi2Anki-Backend" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Zi2Anki-Frontend" >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done.
pause
