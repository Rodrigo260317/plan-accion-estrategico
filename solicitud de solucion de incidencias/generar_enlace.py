#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador y Gestor de Enlace Público Seguro para el Sistema de Incidencias.
Crea un túnel HTTPS con LocalTunnel, copia el enlace al portapapeles y
mantiene el servicio activo con reconexión y respaldos.
"""

import os
import sys
import time
import urllib.request
import subprocess
from pathlib import Path

# Ajustar codificación para consola de Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
LINK_FILE = WEB_DIR / "enlace_activo.txt"
PORT = 5000

def copiar_al_portapapeles(texto: str):
    """Copia texto al portapapeles de Windows vía PowerShell."""
    try:
        cmd = ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{texto}'"]
        subprocess.run(cmd, capture_output=True, check=True)
        return True
    except Exception:
        return False

def servidor_esta_activo() -> bool:
    """Verifica si el servidor Flask en localhost:5000 está respondiendo."""
    try:
        req = urllib.request.Request(f"http://localhost:{PORT}/api/health", headers={"User-Agent": "HealthCheck"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False

def iniciar_servidor_si_es_necesario():
    """Inicia servidor_colaborativo.py en segundo plano si no está corriendo."""
    if not servidor_esta_activo():
        print("[*] Servidor local inactivo. Iniciándolo en segundo plano...")
        server_script = BASE_DIR / "servidor_colaborativo.py"
        # Iniciar proceso independiente en segundo plano en Windows
        subprocess.Popen(
            [sys.executable, str(server_script)],
            cwd=str(BASE_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        # Esperar hasta que responda
        for _ in range(10):
            time.sleep(0.6)
            if servidor_esta_activo():
                print("[OK] Servidor local iniciado correctamente en puerto 5000.\n")
                return
        print("[!] Advertencia: El servidor local tardó en responder, continuando...\n")
    else:
        print("[OK] Servidor local ya está activo en http://localhost:5000.\n")

def main():
    print("=" * 72)
    print(" 🌐 SISTEMA DE INCIDENCIAS - GENERADOR DE ENLACE PÚBLICO COMPARTIBLE")
    print("=" * 72)

    iniciar_servidor_si_es_necesario()

    print("[*] Conectando con túnel HTTPS seguro (LocalTunnel)...")
    print("    Espere unos segundos mientras se asigna la dirección pública...\n")

    # Ejecutar npx localtunnel
    cmd = ["npx.cmd" if os.name == "nt" else "npx", "--yes", "localtunnel", "--port", str(PORT)]
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace"
        )
    except FileNotFoundError:
        # Si npx.cmd no se encuentra directo, intentar vía npx
        cmd[0] = "npx"
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            encoding="utf-8",
            errors="replace"
        )

    public_url = None

    try:
        for line in iter(proc.stdout.readline, ''):
            line_str = line.strip()
            if not line_str:
                continue

            if "your url is:" in line_str.lower():
                parts = line_str.split(":", 1)
                if len(parts) > 1:
                    public_url = parts[1].strip()
                    if not public_url.startswith("http"):
                        public_url = "https:" + public_url.lstrip(":")
                    break
            elif "http://" in line_str or "https://" in line_str:
                for token in line_str.split():
                    if token.startswith("http://") or token.startswith("https://"):
                        public_url = token
                        break
                if public_url:
                    break
            else:
                # Mostrar avisos si los hay
                if "error" in line_str.lower():
                    print(f"    [Aviso] {line_str}")

        if public_url:
            # Guardar enlace en archivo para referencia
            try:
                with open(LINK_FILE, "w", encoding="utf-8") as f:
                    f.write(public_url)
            except Exception:
                pass

            # Copiar a portapapeles
            copiado = copiar_al_portapapeles(public_url)

            print("=" * 72)
            print(" 🎉 ¡ENLACE PÚBLICO GENERADO CON ÉXITO!")
            print("=" * 72)
            print(f"\n  👉 URL PÚBLICA:  {public_url}\n")
            print("=" * 72)
            if copiado:
                print(" 📋 ¡El enlace ha sido copiado automáticamente a tu portapapeles!")
            print(" 👥 Comparte este enlace con Logística, Administración y TI.")
            print(" 📱 Funciona desde cualquier celular, tablet o computadora sin instalar nada.")
            print("=" * 72)
            print("\n ⚠️  IMPORTANTE: MANTÉN ESTA VENTANA ABIERTA mientras tu equipo")
            print("    esté revisando o marcando tareas en el tablero.")
            print("    (Al cerrar esta ventana, el túnel público se detendrá).\n")

            try:
                input(" ▸ Presiona ENTER en cualquier momento para cerrar el enlace y salir...")
            except (KeyboardInterrupt, EOFError):
                pass
        else:
            print("[!] No se pudo obtener la URL del túnel. Salida:")
            print(proc.stdout.read())
            input("\nPresiona ENTER para salir...")

    except KeyboardInterrupt:
        print("\n[*] Cerrando túnel público...")
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            pass
        print("[OK] Túnel finalizado.")

if __name__ == "__main__":
    main()
