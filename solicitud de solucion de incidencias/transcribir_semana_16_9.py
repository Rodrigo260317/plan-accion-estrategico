#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Transcriptor optimizado de alto rendimiento para la reunión 16-9
Escribe la transcripción en tiempo real a disco con marcas de tiempo y texto continuo.
"""

import sys
import time
from pathlib import Path
from faster_whisper import WhisperModel

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

AUDIO_PATH = Path(r"c:\Users\Usuario\Downloads\actividades programadas en reuniones\solicitud de solucion de incidencias\audio\Secion semana 16-9.m4a")
OUT_DIR = Path(r"c:\Users\Usuario\Downloads\actividades programadas en reuniones\solicitud de solucion de incidencias\transcripciones")
OUT_DIR.mkdir(parents=True, exist_ok=True)

OUT_TIMED = OUT_DIR / "Secion_semana_16-9_con_tiempo.txt"
OUT_PLAIN = OUT_DIR / "Secion_semana_16-9_completo.txt"

def format_ts(seconds):
    s = int(seconds)
    return f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}"

print(f"[*] Cargando modelo Whisper (base, int8, 8 threads)...", flush=True)
model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=8)

print(f"[*] Iniciando transcripción de {AUDIO_PATH.name}...", flush=True)
start_t = time.time()

segments, info = model.transcribe(
    str(AUDIO_PATH),
    language="es",
    beam_size=1,
    vad_filter=True,
    vad_parameters=dict(min_silence_duration_ms=400)
)

total_duration = info.duration
print(f"[*] Duración total detectada: {format_ts(total_duration)} ({total_duration:.1f}s)", flush=True)

with open(OUT_TIMED, "w", encoding="utf-8") as f_timed, open(OUT_PLAIN, "w", encoding="utf-8") as f_plain:
    f_timed.write(f"TRANSCRIPCIÓN DE LA REUNIÓN: {AUDIO_PATH.name}\n")
    f_timed.write(f"Duración: {format_ts(total_duration)}\n")
    f_timed.write("=" * 65 + "\n\n")

    count = 0
    for s in segments:
        count += 1
        t_start = format_ts(s.start)
        t_end = format_ts(s.end)
        text = s.text.strip()
        
        timed_line = f"[{t_start} -> {t_end}] {text}"
        f_timed.write(timed_line + "\n")
        f_timed.flush()
        
        f_plain.write(text + " ")
        f_plain.flush()

        if count % 15 == 0 or count == 1:
            pct = (s.end / total_duration) * 100 if total_duration > 0 else 0
            elapsed = time.time() - start_t
            speed = s.end / elapsed if elapsed > 0 else 0
            eta = (total_duration - s.end) / speed if speed > 0 else 0
            print(f"[{format_ts(s.end)} | {pct:4.1f}%] {timed_line[:75]}... (Velocidad: {speed:.1f}x, ETA: {int(eta//60)}m{int(eta%60)}s)", flush=True)

elapsed_total = time.time() - start_t
print(f"\n[OK] ¡Transcripción completada en {elapsed_total/60:.2f} minutos! ({count} segmentos)", flush=True)
print(f"     Guardado en: {OUT_PLAIN}", flush=True)
