@echo off
cd /d "%~dp0"

echo Zi2Anki - Starting services...
echo.

:: Backend batch file (separate to avoid quoting issues)
(
echo @echo off
echo cd /d "%~dp0"
echo echo === Zi2Anki Backend ^(:3001^) ===
echo npx tsx server\index.ts
echo pause
) > "%TEMP%\zi2anki_be.bat"

:: Frontend batch file
(
echo @echo off
echo cd /d "%~dp0"
echo echo === Zi2Anki Frontend ^(:3000^) ===
echo npx vite --port 3000
echo pause
) > "%TEMP%\zi2anki_fe.bat"

start "Zi2Anki-Backend" cmd /k "%TEMP%\zi2anki_be.bat"
start "Zi2Anki-Frontend" cmd /k "%TEMP%\zi2anki_fe.bat"

echo Backend  : http://localhost:3001
echo Frontend : http://localhost:3000
echo.
echo Close this window or press any key to exit.
pause >nul
