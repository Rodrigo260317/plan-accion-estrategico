# 🏢 Proyecto: Solicitud de Solución de Incidencias y Tablero Quincenal

> **Gestión Colaborativa y Automatizada con IA para Logística 🚚, Administración 🏢 y Área de TI 💻.**

Este proyecto resuelve de forma integral la necesidad de transformar el audio de las reuniones quincenales en un plan de acción colaborativo, interactivo y con soluciones técnicas listas para ejecutar.

---

## 🌟 Características Principales

1. **Flujo de Audio Inteligente con Corrección de Transcripción:**
   - Transcripción rápida local mediante `Faster-Whisper` (sin enviar datos privados a servidores externos si no se desea).
   - **Capa de Corrección Fonética y Semántica:** Detecta y corrige los fallos típicos de los transcriptores de voz (nombres propios, siglas de sistemas, términos técnicos como *TI, ERP, SLA, deploy, backup, deadlock, conteo ciego, counter*, etc.).
2. **Extracción y Segmentación Automática:**
   - **🚀 Nuevas Innovaciones Mapeadas** para el ciclo.
   - **📈 Mejoras de Procesos a Implementar** con impacto cuantificado.
   - **📋 Requerimientos Resumidos** concisos y directos a la acción.
   - **👥 Tareas Segmentadas para 3 Roles:**
     - 🚚 **Logística:** Abastecimiento, stock, auditorías ciegas y control de proveedores.
     - 🏢 **Administración:** Convenios, márgenes, atención al cliente, capacitación y contratos.
     - 💻 **Área de TI:** Bugs concurrentes, bases de datos, seguridad 2FA, backups e integraciones.
3. **💡 Apartado de Posibles Soluciones (IA):**
   - Cada tarea cuenta con su propuesta de solución estructurada:
     - Diagnóstico y causa raíz.
     - Plan de acción paso a paso (Pasos 1, 2 y 3).
     - Herramientas recomendadas.
     - Impacto esperado.
4. **🌐 Plataforma Web Colaborativa con Escala de Avance:**
   - Checklists ergonómicos con casillas grandes (32px x 32px).
   - Escala de avance global (%) y barras de progreso independientes por cada área.
   - Proyecciones de tiempo quincenal (fechas meta y días de esfuerzo estimados).
   - Persistencia y sincronización en tiempo real (Local Storage + API REST).
5. **📜 Protocolo Escrito Repetible para Cualquier Otra IA:**
   - Documento maestro `PROTOCOLO_FLUJO_IA.md` y `PROMPT_MAESTRO_ANALISIS.txt` listo para copiar y pegar en **ChatGPT, Claude, DeepSeek o Gemini** cuando desees usar otra IA en una ventana aparte.
   - Pestaña de importación directa en la web: pegas el JSON de la IA y el tablero se actualiza en 1 segundo.
6. **🔗 Despliegue y Enlace Compartible:**
   - Script con 1 clic para generar una URL pública HTTPS (`compartir_enlace.bat`) para compartir con el equipo por WhatsApp, Teams o correo.

---

## 📁 Estructura del Proyecto

```
solicitud de solucion de incidencias/
│
├── audio/                                # Carpeta para colocar los audios de las reuniones
├── web/                                  # Plataforma Web Colaborativa
│   ├── index.html                        # Tablero interactivo principal
│   ├── styles.css                        # Estilos modernos Dark Glassmorphism
│   ├── app.js                            # Lógica reactiva de checks, métricas y modales
│   ├── datos_incidencias.json            # Base de datos viva quincenal
│   ├── PROTOCOLO_FLUJO_IA.md             # Guía accesible desde la web
│   └── PROMPT_MAESTRO_ANALISIS.txt       # Prompt listo para copiar
│
├── procesador_reunion.py                 # Pipeline de audio: transcribe, corrige y estructura
├── servidor_colaborativo.py              # Backend Flask (guarda checks y sirve la web)
├── PROTOCOLO_FLUJO_IA.md                 # Documentación completa del protocolo
├── PROMPT_MAESTRO_ANALISIS.txt           # Prompt maestro para copiar a otras IAs
├── iniciar_sistema.bat                   # Inicia el servidor y abre el navegador
├── compartir_enlace.bat                  # Genera enlace público HTTPS para compartir
└── ejecutar_procesamiento_audio.bat      # Procesa el audio con 1 solo clic
```

---

## 🚀 ¿Cómo se Usa?

### Opción 1: Flujo Rápido "Solo Mandar Audio" (1 Clic)
1. Coloca tu archivo de audio grabado (`.mp3`, `.m4a`, `.wav` o `.mp4`) dentro de la carpeta `audio/`.
2. Haz doble clic en **`ejecutar_procesamiento_audio.bat`**.
3. El sistema transcribirá, limpiará errores de fonética y actualizará el archivo `datos_incidencias.json`.
4. Haz doble clic en **`iniciar_sistema.bat`** para ver el tablero con todas las tareas asignadas y sus soluciones.

### Opción 2: Usar Otra IA (ChatGPT, Claude, DeepSeek o Gemini)
1. Copia el contenido de **`PROMPT_MAESTRO_ANALISIS.txt`**.
2. Pégalo en tu chat con la otra IA y adjunta tu audio o transcripción.
3. Copia el bloque `JSON` que te devolverá la IA.
4. En el tablero web, haz clic en **"Nuevo Audio / Datos"** ➔ Pestaña **"2. Pegar JSON / Salida de Otra IA"** ➔ Presiona **"Aplicar y Actualizar Tablero"**.

### Opción 3: Compartir con el Equipo (Logística, Administración, TI)
1. Haz doble clic en **`compartir_enlace.bat`**.
2. Copia la URL HTTPS que aparecerá en pantalla.
3. Envíala a los 3 colaboradores para que puedan marcar sus tareas y revisar las soluciones desde su PC o celular.
