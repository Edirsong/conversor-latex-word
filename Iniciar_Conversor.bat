@echo off
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%
start /min "Conversor LaTeX-Word (no cerrar - minimizar esta ventana)" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:4173
