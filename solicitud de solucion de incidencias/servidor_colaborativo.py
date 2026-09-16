#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Servidor Colaborativo en Vivo para el Sistema de Gestión de Incidencias
Permite que Logística, Administración y TI trabajen en tiempo real con persistencia
y procesamiento automático de audios de reuniones quincenales.
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory

# Ajustar codificación para consola Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
AUDIO_DIR = BASE_DIR / "audio"
DATA_FILE = WEB_DIR / "datos_incidencias.json"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)
WEB_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(WEB_DIR), static_url_path="")

# --------------------------------------------------------------------------
# RUTAS ESTÁTICAS DE LA APLICACIÓN WEB
# --------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(str(WEB_DIR), "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    target = WEB_DIR / path
    if target.exists() and not target.is_dir():
        return send_from_directory(str(WEB_DIR), path)
    return send_from_directory(str(WEB_DIR), "index.html")

# --------------------------------------------------------------------------
# API REST COLABORATIVA
# --------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Incidencias Colaborativas Backend"})

@app.route("/api/data", methods=["GET"])
def get_data():
    if not DATA_FILE.exists():
        return jsonify({"error": "No se encontró el archivo de datos"}), 404
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Error leyendo datos: {str(e)}"}), 500

@app.route("/api/data", methods=["POST"])
def update_data():
    try:
        payload = request.get_json()
        if not payload or "areas" not in payload:
            return jsonify({"error": "Estructura de datos inválida"}), 400
        
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        
        return jsonify({"success": True, "message": "Datos guardados correctamente"})
    except Exception as e:
        return jsonify({"error": f"Error guardando datos: {str(e)}"}), 500

@app.route("/api/task/toggle", methods=["POST"])
def toggle_task():
    """Actualiza el estado completado de una tarea atómicamente."""
    try:
        req = request.get_json()
        area_id = req.get("area_id")
        task_id = req.get("task_id")
        completed = req.get("completed", False)

        if not area_id or not task_id:
            return jsonify({"error": "Parámetros incompletos"}), 400

        if not DATA_FILE.exists():
            return jsonify({"error": "Archivo de datos no existe"}), 404

        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)

        found = False
        for area in data.get("areas", []):
            if area.get("id") == area_id:
                for task in area.get("tareas", []):
                    if task.get("id") == task_id:
                        task["completada"] = bool(completed)
                        found = True
                        break
            if found:
                break

        if not found:
            return jsonify({"error": "Tarea o área no encontrada"}), 404

        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return jsonify({
            "success": True,
            "area_id": area_id,
            "task_id": task_id,
            "completada": completed
        })
    except Exception as e:
        return jsonify({"error": f"Error actualizando tarea: {str(e)}"}), 500

@app.route("/api/process_audio", methods=["POST"])
def process_audio():
    """Recibe archivo de audio, lo guarda y corre el procesador inteligente."""
    if "audio" not in request.files:
        return jsonify({"error": "No se envió ningún archivo de audio"}), 400

    file = request.files["audio"]
    if file.filename == "":
        return jsonify({"error": "Nombre de archivo vacío"}), 400

    model = request.form.get("model", "base")
    filename = Path(file.filename).name
    save_path = AUDIO_DIR / filename
    file.save(str(save_path))

    print(f"[*] Audio guardado en: {save_path}")
    print(f"[*] Ejecutando procesador_reunion.py (Modelo: {model})...")

    # Ejecutar script procesador
    script_path = BASE_DIR / "procesador_reunion.py"
    cmd = [
        sys.executable,
        str(script_path),
        "--audio", str(save_path),
        "--model", model
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=600)
        if result.returncode != 0:
            print(f"[!] Error ejecutando procesador: {result.stderr}")
            return jsonify({"error": f"Fallo en procesador: {result.stderr}"}), 500

        # Cargar los datos recién generados
        if DATA_FILE.exists():
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                updated_data = json.load(f)
            return jsonify(updated_data)
        else:
            return jsonify({"error": "No se generó el archivo de datos"}), 500

    except Exception as e:
        return jsonify({"error": f"Excepción durante el procesamiento: {str(e)}"}), 500

# --------------------------------------------------------------------------
# PUNTO DE ENTRADA
# --------------------------------------------------------------------------
def main():
    port = int(os.environ.get("PORT", 5000))
    print("=" * 65)
    print(" 🚀 SISTEMA DE SOLUCIÓN DE INCIDENCIAS - SERVIDOR EN VIVO")
    print("=" * 65)
    print(f" ▸ Acceso local en navegador: http://localhost:{port}")
    print(f" ▸ Directorio Web:            {WEB_DIR}")
    print(f" ▸ Base de Datos JSON:        {DATA_FILE}")
    print("=" * 65)
    print(" ▸ Presiona Ctrl+C para detener el servidor.\n")
    app.run(host="0.0.0.0", port=port, debug=False)

if __name__ == "__main__":
    main()
