@echo off
cd /d "%~dp0backend"
title 🚀 Rocola Web - Localhost
color 0A

echo ===============================
echo 🎶 Iniciando Rocola Web Local
echo ===============================

echo 🔍 Buscando proceso en puerto 3443...

set FOUND=0

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3443" ^| findstr LISTENING') do (
    echo ❌ Cerrando proceso PID %%a
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)

if "%FOUND%"=="0" (
    echo 🟢 Puerto 3443 libre
)

timeout /t 1 >nul

start "" /b cmd /c "timeout /t 2 >nul & start https://192.168.0.134:3443"

echo 🟢 Iniciando servidor Node (puerto 3443)...
nodemon server2.js

pause
