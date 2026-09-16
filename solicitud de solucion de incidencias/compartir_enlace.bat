@echo off
setlocal
cd /d "%~dp0"
title Sistema de Incidencias - Enlace Publico Compartible

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Python o agregalo a las variables de entorno.
    pause
    exit /b 1
)

python generar_enlace.py
if %errorlevel% neq 0 (
    echo.
    echo Ocurrio un problema al ejecutar el generador de enlace.
    pause
)
endlocal
