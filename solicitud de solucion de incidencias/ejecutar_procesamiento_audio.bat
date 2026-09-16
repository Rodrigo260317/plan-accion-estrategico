@echo off
setlocal
title Procesar Audio de Reunion Quincenal con IA

echo =========================================================================
echo    PROCESADOR AUTOMATICO DE REUNIONES QUINCENALES CON IA
echo =========================================================================
echo.

cd /d "%~dp0"

:: Si el usuario arrastro un archivo sobre este .bat
if not "%~1"=="" (
    echo [*] Procesando archivo arrastrado: %~1
    python procesador_reunion.py --audio "%~1" --save-transcript
    goto :fin
)

:: Buscar audios en la carpeta audio/
set "AUDIO_ENCONTRADO="
for %%F in (audio\*.mp3 audio\*.wav audio\*.m4a audio\*.mp4 audio\*.aac) do (
    set "AUDIO_ENCONTRADO=%%F"
    goto :audio_listo
)

:audio_listo
if defined AUDIO_ENCONTRADO (
    echo [*] Se detecto el audio: %AUDIO_ENCONTRADO%
    echo [*] Iniciando transcripcion con Faster-Whisper, correccion fonetica y estructuracion...
    echo.
    python procesador_reunion.py --audio "%AUDIO_ENCONTRADO%" --save-transcript
) else (
    echo [!] No se encontro ningun archivo de audio en la carpeta 'audio\'.
    echo.
    echo  INSTRUCCIONES:
    echo  1. Copia tu grabacion (.mp3, .m4a, .wav o .mp4) dentro de la carpeta:
    echo     "%~dp0audio\"
    echo  2. O simplemente arrastra tu archivo de audio encima de este archivo .bat
    echo  3. Vuelve a ejecutar este script.
    echo.
)

:fin
echo.
echo =========================================================================
echo  Proceso finalizado. Puedes abrir el tablero ejecutando 'iniciar_sistema.bat'.
echo =========================================================================
echo.
pause
endlocal

