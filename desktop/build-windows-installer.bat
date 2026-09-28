@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Bayan ERP - Building Protected Windows Installer (.exe)
echo ========================================================
echo.

echo [1/3] Checking dependencies...
call npm.cmd install

echo.
echo [2/3] Compiling and protecting source code (V8 Bytecode)...
call npm.cmd run protect

echo.
echo [3/3] Packaging installer (BayanERP-Setup.exe)...
call npm.cmd run build:exe

echo.
echo ========================================================
echo   SUCCESS! Installer ready in: dist-desktop\
echo ========================================================
echo.
pause
