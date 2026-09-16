@echo off
setlocal
title Sistema de Solucion de Incidencias - Servidor Colaborativo

echo =========================================================================
echo    SISTEMA DE SOLUCION DE INCIDENCIAS - TABLERO QUINCENAL
echo =========================================================================
echo  Iniciando servidor local para Logistica, Administracion y TI...
echo.

cd /d "%~dp0"

:: Verificar que Python este instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Python en el sistema o PATH.
    pause
    exit /b 1
)

:: Iniciar navegador tras 2 segundos
start "" cmd /c "timeout /t 2 >nul & start http://localhost:5000"

:: Ejecutar servidor colaborativo
python servidor_colaborativo.py

pause
endlocal

