@echo off
chcp 65001 >nul
title تشغيل نظام بيان ERP
cd /d "%~dp0"

echo ========================================================
echo   جاري تشغيل نظام بيان ERP على جهازك المحلي...
echo ========================================================
echo.

start "" "http://localhost:3000"
node server/index.js
pause
