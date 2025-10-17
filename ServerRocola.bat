@echo off
cd /d "%~dp0"
echo ===============================
echo 🎶 Iniciando Rocola Web Local
echo ===============================

:: 🔹 Inicia el proxy de búsqueda (Python)
start "" /B cmd /C "python proxy_search.py"

:: 🔹 Inicia el backend Node (Express)
start "" /B cmd /C "nodemon server2.js"

:: 🔹 Abre el front servido por Node (no como archivo)
timeout /t 3 >nul
start "" http://localhost:5055/index.html

pause
