@echo off
echo Buscando el servidor del Conversor (puerto 4173)...
set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :4173 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>&1
  set FOUND=1
)
if "%FOUND%"=="1" (
  echo Servidor detenido correctamente.
) else (
  echo No se encontro ningun servidor corriendo en el puerto 4173.
)
pause
