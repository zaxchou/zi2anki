@echo off
echo Stopping Zi2Anki...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" 2^>nul') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Zi2Anki*" >nul 2>&1
echo Done.
pause
