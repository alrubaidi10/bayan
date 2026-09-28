@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Starting Bayan ERP Local Server...
echo ========================================================
echo.

start "" "http://localhost:3000"
call node.exe server/index.js

echo.
pause
