@echo off
set "NODE_DIR=C:\Users\zax\.workbuddy\binaries\node\versions\22.22.2"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%~dp0"

echo Zi2Anki - Starting services...
echo.

(
echo @echo off
echo set "PATH=%NODE_DIR%;%%PATH%%"
echo cd /d "%~dp0"
echo echo === Zi2Anki Backend ^(:3001^) ===
echo npx tsx server\index.ts
echo pause
) > "%TEMP%\zi2anki_be.bat"

(
echo @echo off
echo set "PATH=%NODE_DIR%;%%PATH%%"
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
pause
