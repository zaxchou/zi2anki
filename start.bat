@echo off
set "NODE_BIN=C:\Users\zax\.workbuddy\binaries\node\versions\22.22.2"
set "NPX=%NODE_BIN%\npx.cmd"

cd /d "%~dp0"

echo Zi2Anki - Starting services...
echo.

:: Backend
echo @echo off > "%TEMP%\zi2anki_be.bat"
echo cd /d "%~dp0" >> "%TEMP%\zi2anki_be.bat"
echo echo === Zi2Anki Backend ^(:3001^) === >> "%TEMP%\zi2anki_be.bat"
echo "%NPX%" tsx server\index.ts >> "%TEMP%\zi2anki_be.bat"
echo pause >> "%TEMP%\zi2anki_be.bat"
start "Zi2Anki-Backend" "%TEMP%\zi2anki_be.bat"

:: Frontend
echo @echo off > "%TEMP%\zi2anki_fe.bat"
echo cd /d "%~dp0" >> "%TEMP%\zi2anki_fe.bat"
echo echo === Zi2Anki Frontend ^(:3000^) === >> "%TEMP%\zi2anki_fe.bat"
echo "%NPX%" vite --port 3000 >> "%TEMP%\zi2anki_fe.bat"
echo pause >> "%TEMP%\zi2anki_fe.bat"
start "Zi2Anki-Frontend" "%TEMP%\zi2anki_fe.bat"

echo Backend  : http://localhost:3001
echo Frontend : http://localhost:3000
echo.
pause
