/**
 * PLAN DE ACCIÓN Y REQUERIMIENTOS ESTRATÉGICOS
 * Motor Inteligente de Segmentación y Asignación de Actividades por Área
 */

// Datos iniciales exactamente extraídos del documento original
const INITIAL_COLUMNS_DATA = [
  {
    id: "admin",
    title: "ADMINISTRADORA GENERAL",
    subtitle: "(Persona 2)",
    icon: "👩‍💼",
    tasks: [
      {
        id: "adm-1",
        text: "Reunirse con la abogada (Dra. Solange) para fijar límites legales de cosmiatría (cero agujas/HIFU).",
        completed: false,
        priority: "alta"
      },
      {
        id: "adm-2",
        text: "Instruir a Counter para que el 100% de complicaciones pasen directo a la Dra. Principal.",
        completed: false,
        priority: "alta"
      },
      {
        id: "adm-3",
        text: "Dar feedback a Romina (uso de celular, permanencia en cabina y apoyo post-Mounjaro).",
        completed: false,
        priority: "media"
      },
      {
        id: "adm-4",
        text: "Coordinar coaching de ventas para Gustavo (empalme de tratamientos y no limitar dosis).",
        completed: false,
        priority: "media"
      },
      {
        id: "adm-5",
        text: "Entregar formato de productividad a la Dra. Stefany.",
        completed: false,
        priority: "media"
      },
      {
        id: "adm-6",
        text: "Notificar nuevas reglas de cabina (prohibido poner llave y no retener el iPad).",
        completed: false,
        priority: "alta"
      },
      {
        id: "adm-7",
        text: "Reunirse hoy para reestructurar la tarifa/programa de Mounjaro (bajar de $660).",
        completed: false,
        priority: "alta"
      },
      {
        id: "adm-8",
        text: "Coordinar con SkinCeuticals las fechas de capacitación para las doctoras.",
        completed: false,
        priority: "normal"
      },
      {
        id: "adm-9",
        text: "Negociar con Amelia (proveedora de Láser Pico) el reclamo/soporte por la falla del equipo.",
        completed: false,
        priority: "alta"
      },
      {
        id: "adm-10",
        text: "Diseñar la estrategia de paciente incógnito para analizar a la competencia (Smart Esthetic).",
        completed: false,
        priority: "normal"
      }
    ]
  },
  {
    id: "logistica",
    title: "LOGÍSTICA / OPERACIONES",
    subtitle: "(Persona 4 / Soporte)",
    icon: "📦",
    tasks: [
      {
        id: "log-1",
        text: "Supervisar finalización de la cafetería y mueblería (sillón/muebles de espera) en 3er Piso.",
        completed: false,
        priority: "alta"
      },
      {
        id: "log-2",
        text: "Coordinar con Juan Carlos la instalación del granito en el área de exosomas.",
        completed: false,
        priority: "alta"
      },
      {
        id: "log-3",
        text: "Mantener sellado el cuarto de paso (\"X\") para evitar polvo en zonas limpias.",
        completed: false,
        priority: "media"
      },
      {
        id: "log-4",
        text: "Comprar 2 camillas color tierra/marrón para los consultorios de abajo.",
        completed: false,
        priority: "media"
      },
      {
        id: "log-5",
        text: "Trasladar las 3 camillas blancas hacia las cabinas del 3er piso.",
        completed: false,
        priority: "media"
      },
      {
        id: "log-6",
        text: "Reportar stock crítico mensual: identificar productos por vencer y asegurar reposición de alta rotación (ej. Phyto Corrective).",
        completed: false,
        priority: "alta"
      },
      {
        id: "log-7",
        text: "Mandar a producir los gafetes/colgantes físicos para el personal con el código QR.",
        completed: false,
        priority: "normal"
      }
    ]
  },
  {
    id: "sistemas",
    title: "SISTEMAS / TI",
    subtitle: "(Persona 3 / Sistemas)",
    icon: "💻",
    tasks: [
      {
        id: "sis-1",
        text: "Desarrollar el formulario rápido de satisfacción (máx. 4 preguntas) con validación por DNI del paciente.",
        completed: false,
        priority: "alta"
      },
      {
        id: "sis-2",
        text: "Generar los códigos QR individuales por colaborador/área vinculados a la base de datos para medir el bono de S/ 500.",
        completed: false,
        priority: "alta"
      },
      {
        id: "sis-3",
        text: "Armar reporte operativo para Cosmiatría en base a horas trabajadas (meta 192 h), desglose por día/semana y pacientes atendidos (sin montos de facturación).",
        completed: false,
        priority: "media"
      },
      {
        id: "sis-4",
        text: "Consolidar ventas, costos y márgenes desglosados por laboratorio (ej. SkinCeuticals / Blue CR Trading vs. otros).",
        completed: false,
        priority: "media"
      },
      {
        id: "sis-5",
        text: "Crear el sistema/hoja de consolidación de atención diaria para la Dra. Stefany.",
        completed: false,
        priority: "media"
      },
      {
        id: "sis-6",
        text: "Evaluar factibilidad técnica de una alarma/alerta de ocupabilidad para saber en tiempo real qué máquinas están encendidas y cruzarlas con la agenda.",
        completed: false,
        priority: "normal"
      }
    ]
  }
];

// Estado de la aplicación
const STORAGE_KEY = "plan_accion_estrategico_data_v1";
const API_KEY_STORAGE = "gemini_api_key_v1";

let appData = loadData();
let currentFilter = "all";
let currentSearch = "";
let geminiApiKey = localStorage.getItem(API_KEY_STORAGE) || "";

// Variables para captura de Audio & Asistente de Voz
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let audioContext = null;
let analyser = null;
let animFrameId = null;
let recordingTimerInterval = null;
let recordingSeconds = 0;
let speechRecognizer = null;
let liveTranscribedSentences = [];

// Cargar o inicializar datos
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error al leer localStorage, restaurando datos iniciales", e);
    }
  }
  return JSON.parse(JSON.stringify(INITIAL_COLUMNS_DATA));
}

// Guardar datos
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// Inicialización de la aplicación
document.addEventListener("DOMContentLoaded", () => {
  renderBoard();
  updateMetrics();
  setupEventListeners();
  setupVisualizerBars();
  initSpeechRecognitionFallback();

  if (window.lucide) {
    lucide.createIcons();
  }
});

// Configuración de escuchadores de eventos
function setupEventListeners() {
  // Búsqueda
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value.toLowerCase().trim();
    renderBoard();
  });

  // Filtros de estado (Todas, Pendientes, Completadas)
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderBoard();
    });
  });

  // Formulario para nueva actividad manual
  const newForm = document.getElementById("newActivityForm");
  newForm.addEventListener("submit", handleAddActivity);

  // Botón Restablecer
  const resetBtn = document.getElementById("resetDataBtn");
  resetBtn.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que deseas restablecer todas las actividades al estado inicial?")) {
      appData = JSON.parse(JSON.stringify(INITIAL_COLUMNS_DATA));
      saveData();
      renderBoard();
      updateMetrics();
      showToast("Datos restablecidos con éxito.", "info");
    }
  });

  // Botón Exportar CSV
  const exportBtn = document.getElementById("exportCsvBtn");
  exportBtn.addEventListener("click", exportToCSV);

  // Control del Micrófono Flotante
  const floatingMicBtn = document.getElementById("floatingMicBtn");
  floatingMicBtn.addEventListener("click", toggleVoiceRecording);

  const finishRecordingBtn = document.getElementById("finishRecordingBtn");
  finishRecordingBtn.addEventListener("click", stopAndProcessVoiceRecording);

  const cancelRecordingBtn = document.getElementById("cancelRecordingBtn");
  cancelRecordingBtn.addEventListener("click", cancelVoiceRecording);

  // Configuración de Gemini API Key Modal
  const apiKeySettingsBtn = document.getElementById("apiKeySettingsBtn");
  const apiKeyModal = document.getElementById("apiKeyModal");
  const closeApiKeyModal = document.getElementById("closeApiKeyModal");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const removeApiKeyBtn = document.getElementById("removeApiKeyBtn");
  const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");

  apiKeySettingsBtn.addEventListener("click", () => {
    geminiApiKeyInput.value = geminiApiKey;
    apiKeyModal.classList.remove("hidden");
  });

  closeApiKeyModal.addEventListener("click", () => {
    apiKeyModal.classList.add("hidden");
  });

  saveApiKeyBtn.addEventListener("click", () => {
    geminiApiKey = geminiApiKeyInput.value.trim();
    localStorage.setItem(API_KEY_STORAGE, geminiApiKey);
    apiKeyModal.classList.add("hidden");
    showToast(geminiApiKey ? "API Key de Gemini configurada correctamente" : "API Key borrada", "success");
  });

  removeApiKeyBtn.addEventListener("click", () => {
    geminiApiKey = "";
    geminiApiKeyInput.value = "";
    localStorage.removeItem(API_KEY_STORAGE);
    apiKeyModal.classList.add("hidden");
    showToast("API Key eliminada.", "info");
  });

  // Responsive window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      renderBoard();
    }, 150);
  });
}

// Renderizar las 3 columnas y sus tareas
function renderBoard() {
  const container = document.getElementById("boardColumnsContainer");
  container.innerHTML = "";

  appData.forEach((col) => {
    const filteredTasks = col.tasks.filter((t) => {
      const matchesSearch = t.text.toLowerCase().includes(currentSearch);
      if (!matchesSearch) return false;

      if (currentFilter === "pending") return !t.completed;
      if (currentFilter === "completed") return t.completed;
      return true;
    });

    const completedCount = col.tasks.filter((t) => t.completed).length;
    const totalCount = col.tasks.length;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const isMobile = window.innerWidth <= 768;
    const isCollapsedOnMobile = isMobile && !col.isExpandedOnMobile;

    const colCard = document.createElement("div");
    colCard.className = `column-card ${isCollapsedOnMobile ? "collapsed" : ""}`;
    colCard.dataset.colId = col.id;

    colCard.innerHTML = `
      <div class="column-header" data-col-id="${col.id}">
        <div class="column-header-content">
          <h2 class="column-title">
            <span class="column-icon">${col.icon}</span>
            ${col.title}
          </h2>
          <div class="column-subtitle">${col.subtitle}</div>
          <div class="column-counter-badge">
            ${completedCount}/${totalCount} completadas (${percent}%)
          </div>
        </div>
        <div class="column-accordion-icon">
          <i data-lucide="chevron-down"></i>
        </div>
      </div>
      <ul class="task-list" id="list-${col.id}"></ul>
    `;

    // Evento para colapsar/desplegar en móvil
    const colHeader = colCard.querySelector(".column-header");
    colHeader.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        col.isExpandedOnMobile = !col.isExpandedOnMobile;
        colCard.classList.toggle("collapsed", !col.isExpandedOnMobile);
      }
    });

    const taskListUl = colCard.querySelector(`#list-${col.id}`);

    if (filteredTasks.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.style.padding = "1.5rem 0.5rem";
      emptyMsg.style.textAlign = "center";
      emptyMsg.style.color = "#628784";
      emptyMsg.style.fontSize = "0.85rem";
      emptyMsg.style.fontStyle = "italic";
      emptyMsg.innerText = currentSearch || currentFilter !== "all" 
        ? "No hay actividades con este filtro." 
        : "Sin actividades en esta área.";
      taskListUl.appendChild(emptyMsg);
    } else {
      filteredTasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "completed" : ""} ${task.isNew ? "just-added" : ""}`;
        li.dataset.taskId = task.id;

        const priorityLabel = task.priority === "alta" ? "Alta" : task.priority === "normal" ? "Normal" : "Media";
        const priorityClass = `badge-${task.priority || "media"}`;

        li.innerHTML = `
          <div class="custom-checkbox">
            <i data-lucide="check"></i>
          </div>
          <div class="task-content">
            <div class="task-text">${escapeHtml(task.text)}</div>
            <div class="task-meta">
              <span class="task-badge ${priorityClass}">
                ${priorityLabel}
              </span>
              ${task.source === "ai" ? `<span class="task-badge badge-ai"><i data-lucide="sparkles" style="width:10px;height:10px"></i> Segmentado por IA</span>` : ""}
              ${task.deadline ? `<span class="task-badge badge-date">📅 ${task.deadline}</span>` : ""}
            </div>
          </div>
          <div class="task-actions">
            <button class="btn-task-delete" title="Eliminar actividad" data-action="delete">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;

        li.addEventListener("click", (e) => {
          if (e.target.closest('[data-action="delete"]')) {
            e.stopPropagation();
            deleteTask(col.id, task.id);
            return;
          }
          toggleTask(col.id, task.id);
        });

        taskListUl.appendChild(li);
      });
    }

    container.appendChild(colCard);
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Alternar estado completado
function toggleTask(colId, taskId) {
  const col = appData.find((c) => c.id === colId);
  if (!col) return;
  const task = col.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  saveData();
  renderBoard();
  updateMetrics();

  if (task.completed) {
    showToast(`✓ Actividad marcada como completada`, "success");
    checkAllCompletedCelebration();
  }
}

// Eliminar tarea
function deleteTask(colId, taskId) {
  const col = appData.find((c) => c.id === colId);
  if (!col) return;
  
  if (confirm("¿Estás seguro de eliminar esta actividad?")) {
    col.tasks = col.tasks.filter((t) => t.id !== taskId);
    saveData();
    renderBoard();
    updateMetrics();
    showToast("Actividad eliminada", "info");
  }
}

// Agregar nueva actividad manual
function handleAddActivity(e) {
  e.preventDefault();
  const areaSelect = document.getElementById("activityArea");
  const prioritySelect = document.getElementById("activityPriority");
  const deadlineInput = document.getElementById("activityDeadline");
  const textInput = document.getElementById("activityText");

  const areaId = areaSelect.value;
  const priority = prioritySelect.value;
  const deadline = deadlineInput.value;
  const text = textInput.value.trim();

  if (!text) {
    alert("Por favor ingresa una descripción para la actividad.");
    return;
  }

  const col = appData.find((c) => c.id === areaId);
  if (!col) return;

  const newTask = {
    id: "task-" + Date.now(),
    text: text,
    completed: false,
    priority: priority,
    deadline: deadline || null,
    isNew: true
  };

  col.tasks.push(newTask);
  saveData();
  renderBoard();
  updateMetrics();

  textInput.value = "";
  deadlineInput.value = "";
  showToast("¡Nueva actividad agregada exitosamente!", "success");

  const targetCol = document.querySelector(`[data-col-id="${areaId}"]`);
  if (targetCol) {
    targetCol.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Actualizar barra de progreso general y por área
function updateMetrics() {
  let totalTasks = 0;
  let totalCompleted = 0;

  const areasListContainer = document.getElementById("areasProgressList");
  areasListContainer.innerHTML = "";

  appData.forEach((col) => {
    const colTotal = col.tasks.length;
    const colCompleted = col.tasks.filter((t) => t.completed).length;
    const colPercent = colTotal > 0 ? Math.round((colCompleted / colTotal) * 100) : 0;

    totalTasks += colTotal;
    totalCompleted += colCompleted;

    const metricItem = document.createElement("div");
    metricItem.className = "area-metric-item";
    metricItem.innerHTML = `
      <div class="area-metric-header">
        <span class="area-name">${col.icon} ${col.title}</span>
        <span class="area-stats">${colCompleted} / ${colTotal} <strong class="area-percent">(${colPercent}%)</strong></span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar area-fill" style="width: ${colPercent}%;"></div>
      </div>
    `;
    areasListContainer.appendChild(metricItem);
  });

  const globalPercent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  document.getElementById("globalPercentText").innerText = `${globalPercent}%`;
  document.getElementById("globalCountText").innerText = `${totalCompleted} de ${totalTasks} actividades realizadas`;
  document.getElementById("globalProgressBar").style.width = `${globalPercent}%`;
}

// Celebración con confetti si se llega al 100%
function checkAllCompletedCelebration() {
  let totalTasks = 0;
  let totalCompleted = 0;

  appData.forEach((col) => {
    totalTasks += col.tasks.length;
    totalCompleted += col.tasks.filter((t) => t.completed).length;
  });

  if (totalTasks > 0 && totalTasks === totalCompleted) {
    if (typeof confetti === "function") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 } });
      }, 250);
    }
  }
}

// Exportar datos a formato CSV (Compatible con Excel)
function exportToCSV() {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "Área;Responsable;Actividad;Prioridad;Fecha Límite;Estado\n";

  appData.forEach((col) => {
    col.tasks.forEach((t) => {
      const area = `"${col.title.replace(/"/g, '""')}"`;
      const resp = `"${col.subtitle.replace(/"/g, '""')}"`;
      const desc = `"${t.text.replace(/"/g, '""')}"`;
      const prio = `"${(t.priority || "Media").toUpperCase()}"`;
      const dead = `"${t.deadline || "-"}"`;
      const status = `"${t.completed ? "COMPLETADA" : "PENDIENTE"}"`;

      csvContent += `${area};${resp};${desc};${prio};${dead};${status}\n`;
    });
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `plan_accion_estrategico_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Plan exportado a CSV exitosamente", "success");
}

/* ==========================================================================
   SISTEMA DE GRABACIÓN DE AUDIO & ASISTENTE IA PARA REUNIONES
   ========================================================================== */

function setupVisualizerBars() {
  const container = document.getElementById("visualizerContainer");
  container.innerHTML = "";
  for (let i = 0; i < 24; i++) {
    const bar = document.createElement("div");
    bar.className = "audio-bar";
    container.appendChild(bar);
  }
}

function initSpeechRecognitionFallback() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    speechRecognizer = new SpeechRec();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = true;
    speechRecognizer.lang = "es-ES";

    speechRecognizer.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          if (transcript) {
            liveTranscribedSentences.push(transcript);
          }
        }
      }
    };

    speechRecognizer.onerror = (e) => {
      console.warn("Reconocimiento de voz advertencia:", e.error);
    };
  }
}

async function toggleVoiceRecording() {
  if (isRecording) {
    stopAndProcessVoiceRecording();
  } else {
    startVoiceRecording();
  }
}

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000
      }
    });

    audioStream = stream;
    audioChunks = [];
    liveTranscribedSentences = [];

    startAudioVisualizer(stream);

    if (speechRecognizer) {
      try {
        speechRecognizer.start();
      } catch (err) {
        console.log("SpeechRecognizer:", err);
      }
    }

    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
      } else {
        mimeType = '';
      }
    }

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(250);
    isRecording = true;

    const micBtn = document.getElementById("floatingMicBtn");
    micBtn.classList.add("recording");
    document.getElementById("voiceRecordingModal").classList.remove("hidden");

    recordingSeconds = 0;
    document.getElementById("recordingTimer").innerText = "00:00";
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
      recordingSeconds++;
      const m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
      const s = String(recordingSeconds % 60).padStart(2, '0');
      document.getElementById("recordingTimer").innerText = `${m}:${s}`;
    }, 1000);

    showToast("🎙️ Grabando reunión... Conversen con naturalidad", "info");

  } catch (err) {
    console.error("Error al iniciar micrófono:", err);
    if (err.name === 'NotAllowedError') {
      alert("Por favor permite el acceso al micrófono en la barra de tu navegador.");
    } else {
      alert("No se pudo iniciar el micrófono: " + err.message);
    }
  }
}

function startAudioVisualizer(stream) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bars = document.querySelectorAll(".audio-bar");
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateBars = () => {
      if (!analyser || !isRecording) return;
      analyser.getByteFrequencyData(dataArray);

      bars.forEach((bar, index) => {
        const val = dataArray[index % dataArray.length];
        const percent = Math.max(15, Math.min(100, (val / 255) * 100));
        bar.style.height = `${percent}%`;
      });

      animFrameId = requestAnimationFrame(updateBars);
    };

    updateBars();
  } catch (e) {
    console.warn("Visualizador Web Audio no soportado:", e);
  }
}

function stopAudioVisualizer() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close().catch(() => {});
  }
  const bars = document.querySelectorAll(".audio-bar");
  bars.forEach(b => b.style.height = "15%");
}

function cancelVoiceRecording() {
  if (isRecording) {
    isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (speechRecognizer) {
      try { speechRecognizer.stop(); } catch(e){}
    }
    if (audioStream) {
      audioStream.getTracks().forEach(t => t.stop());
    }
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    stopAudioVisualizer();

    document.getElementById("floatingMicBtn").classList.remove("recording");
    document.getElementById("voiceRecordingModal").classList.add("hidden");
    showToast("Grabación cancelada", "info");
  }
}

async function stopAndProcessVoiceRecording() {
  if (!isRecording) return;

  isRecording = false;
  if (recordingTimerInterval) clearInterval(recordingTimerInterval);
  document.getElementById("floatingMicBtn").classList.remove("recording");
  document.getElementById("voiceRecordingModal").classList.add("hidden");
  stopAudioVisualizer();

  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch(e){}
  }

  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
  }

  // Esperar a que el reconocedor termine de procesar los últimos fragmentos
  await new Promise(r => setTimeout(r, 400));
  const fullTranscript = liveTranscribedSentences.join(" ").trim();

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      await processMeetingAudioWithAI(audioBlob, fullTranscript);
    };
    mediaRecorder.stop();
  } else {
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    await processMeetingAudioWithAI(audioBlob, fullTranscript);
  }
}

// Procesar el audio o transcripción con IA
async function processMeetingAudioWithAI(audioBlob, transcriptText) {
  const overlay = document.getElementById("aiProcessingOverlay");
  const stepText = document.getElementById("aiProcessingStep");
  overlay.classList.remove("hidden");

  try {
    stepText.innerText = "Analizando conversación y segmentando requerimientos por responsable...";

    let extractedTasks = [];

    // 1. Si el usuario configuró su Gemini API Key, usamos Gemini para transcripción y segmentación de alta precisión
    if (geminiApiKey) {
      stepText.innerText = "Segmentando tareas con Gemini AI...";
      try {
        if (audioBlob && audioBlob.size > 2000) {
          extractedTasks = await sendAudioToGemini(audioBlob, geminiApiKey);
        } else if (transcriptText) {
          extractedTasks = await sendTextToGemini(transcriptText, geminiApiKey);
        }
      } catch (geminiError) {
        console.warn("Fallo en Gemini API, usando motor de segmentación inteligente:", geminiError);
        extractedTasks = smartSegmentAndClassifyMeetingSpeech(transcriptText);
      }
    } else {
      // 2. Si no hay Gemini API Key, usamos el potente motor semántico de segmentación conversacional
      if (transcriptText.length > 5) {
        extractedTasks = smartSegmentAndClassifyMeetingSpeech(transcriptText);
      } else {
        const userPrompt = prompt(
          "Pega o dicta la conversación de la reunión para segmentar y distribuir a cada área:"
        );
        if (userPrompt && userPrompt.trim()) {
          extractedTasks = smartSegmentAndClassifyMeetingSpeech(userPrompt);
        } else {
          throw new Error("No se detectó audio suficiente ni transcripción.");
        }
      }
    }

    if (!extractedTasks || extractedTasks.length === 0) {
      throw new Error("No se lograron extraer acuerdos estructurados. Intenta nuevamente.");
    }

    // Insertar las tareas segmentadas en sus columnas correspondientes
    let addedCount = 0;
    const areasSummary = {};

    extractedTasks.forEach((item) => {
      const targetCol = appData.find((col) => col.id === item.area) || appData[0];
      const newTask = {
        id: "ai-task-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        text: item.title,
        completed: false,
        priority: item.priority || "media",
        deadline: item.deadline || null,
        source: "ai",
        isNew: true
      };
      targetCol.tasks.unshift(newTask);
      addedCount++;
      areasSummary[targetCol.title] = (areasSummary[targetCol.title] || 0) + 1;
    });

    saveData();
    renderBoard();
    updateMetrics();

    showToast(`🎉 ¡${addedCount} actividades segmentadas y distribuidas exitosamente!`, "success");

  } catch (error) {
    console.error("Error en procesamiento IA:", error);
    alert("Aviso de IA: " + error.message);
  } finally {
    overlay.classList.add("hidden");
  }
}

/**
 * MOTOR AVANZADO DE SEGMENTACIÓN SEMÁNTICA CONVERSACIONAL (ESPAÑOL)
 * Detecta cuando en una reunión se habla de corrido asignando tareas a múltiples personas:
 * Ej: "una para el área administrativa que tiene que... el de logística tiene que... y tú el de sistemas tienes que..."
 */
function smartSegmentAndClassifyMeetingSpeech(rawText) {
  if (!rawText || !rawText.trim()) return [];

  // Normalizar texto
  let text = rawText.replace(/\s+/g, " ").trim();

  // Limpiar muletillas iniciales de reunión
  text = text.replace(/^(bueno|bien|mira|entonces|ok|hola|escuchen|tenemos proyectado que|se van a realizar|vamos a hacer|se acordó que)\s+/i, "");

  // Detectores de transición de rol / área
  // Patrones que introducen a cada área:
  // - "una para (el área de)? (administración|administradora|persona 2)..."
  // - "el de (logística|operaciones|persona 4)..."
  // - "(y )?tú el de (sistemas|ti|persona 3)..."
  // - "para el área de..."
  // - "por parte de..."
  // - "en cuanto a..."
  
  const roleMarkers = [
    {
      regex: /(?:(?:y\s+)?(?:tú\s+)?(?:el|la|para\s+el\s+área|para\s+la|en\s+el\s+área\s+de|por\s+parte\s+de|al\s+área\s+de)\s+)?(?:de\s+)?(administrativa|administradora|administración|persona\s*2|gerencia|legal)\s*(?:que\s+tiene\s+que|tiene\s+que|debe|se\s+encarga\s+de|le\s+toca|va\s+a)?/gi,
      area: "admin"
    },
    {
      regex: /(?:(?:y\s+)?(?:tú\s+)?(?:el|la|para\s+el\s+área|para\s+la|en\s+el\s+área\s+de|por\s+parte\s+de|al\s+área\s+de)\s+)?(?:de\s+)?(logística|operaciones|persona\s*4|almacén|soporte|mantenimiento)\s*(?:que\s+tiene\s+que|tiene\s+que|debe|se\s+encarga\s+de|le\s+toca|va\s+a)?/gi,
      area: "logistica"
    },
    {
      regex: /(?:(?:y\s+)?(?:tú\s+)?(?:el|la|para\s+el\s+área|para\s+la|en\s+el\s+área\s+de|por\s+parte\s+de|al\s+área\s+de)\s+)?(?:de\s+)?(sistemas|ti|persona\s*3|desarrollo|informática|programación)\s*(?:que\s+tiene\s+que|tiene\s+que|debe|se\s+encarga\s+de|le\s+toca|va\s+a)?/gi,
      area: "sistemas"
    }
  ];

  // Identificar todas las posiciones de cambio de área
  const matches = [];

  roleMarkers.forEach(({ regex, area }) => {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        endIndex: regex.lastIndex,
        area: area,
        matchedText: match[0]
      });
    }
  });

  // Ordenar por aparición en el discurso
  matches.sort((a, b) => a.index - b.index);

  const rawSegments = [];

  if (matches.length > 0) {
    // Si hay segmentos encontrados por mención de rol/área
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const start = current.endIndex;
      const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;

      let content = text.substring(start, end).trim();
      if (content.length > 5) {
        rawSegments.push({
          area: current.area,
          raw: content
        });
      }
    }
  } else {
    // Si no hubo menciones directas de nombres de área, separar por conectores lógicos de tareas
    const splits = text.split(/(?:\. |\bprimero\b|\bsegundo\b|\btercero\b|\bademás\b|\btambién\b|\bpor otro lado\b|\botra actividad es\b)/i);
    splits.forEach(s => {
      const clean = s.trim();
      if (clean.length > 10) {
        rawSegments.push({
          area: detectAreaFromKeywords(clean),
          raw: clean
        });
      }
    });
  }

  // Si aún no hay segmentos, usar el texto completo clasificado
  if (rawSegments.length === 0) {
    rawSegments.push({
      area: detectAreaFromKeywords(text),
      raw: text
    });
  }

  // Refinar y limpiar cada tarea individual
  const structuredTasks = [];

  rawSegments.forEach(seg => {
    let cleanTask = cleanConversationalActionItem(seg.raw);
    if (cleanTask.length > 8) {
      let priority = "media";
      const lower = cleanTask.toLowerCase();
      if (lower.match(/(urgente|hoy|inmediato|crítico|ya|abogada|reclamo|prohibido|100%)/)) {
        priority = "alta";
      } else if (lower.match(/(rutina|cuando se pueda|evaluar|capacitación)/)) {
        priority = "normal";
      }

      structuredTasks.push({
        title: cleanTask,
        area: seg.area,
        priority: priority,
        deadline: null
      });
    }
  });

  return structuredTasks;
}

// Limpiar muletillas conversacionales y formatear como acción ejecutiva
function cleanConversationalActionItem(text) {
  let s = text;
  // Quitar muletillas al inicio de la frase ("este", "realizar este", "encargarse de", "tienes que", "que es")
  s = s.replace(/^(?:que\s+)?(?:tiene\s+que|debe|deben|se\s+encarga\s+de|encargarse\s+de|le\s+toca|va\s+a|realizar\s+este|realizar|hacer)\s+/i, "");
  s = s.replace(/^(?:este|la|el|un|una)\s+(?=reorganización|limpieza|crear|revisión|compra|coordinación|desarrollo)/i, "");

  // Quitar frases de cierre conversacional ("que es justo lo que acabas de realizar y es lo que estamos haciendo en prueba")
  s = s.replace(/(?:,\s*)?(?:que\s+es\s+justo|y\s+eso\s+es|lo\s+que\s+estamos\s+haciendo|en\s+esta\s+reunión\s+que\s+es).*$/i, "");
  s = s.replace(/(?:,\s*)?(?:para\s+que\s+todo\s+esté\s+listo|por\s+favor|cuanto\s+antes).*$/i, "");

  s = s.trim();

  // Capitalizar primera letra y asegurar punto final
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!s.endsWith('.')) s += '.';
  }

  return s;
}

// Clasificador por palabras clave
function detectAreaFromKeywords(text) {
  const lower = text.toLowerCase();
  if (lower.match(/(sistema|ti|qr|código|formulario|reporte|excel|base de datos|dni|software|web|computadora|ocupabilidad|alarma|aplicativo|programar)/)) {
    return "sistemas";
  }
  if (lower.match(/(camilla|mueble|sillón|cafetería|granito|piso|stock|producto|comprar|trasladar|gafete|almacén|logística|operaciones|limpieza|proveedor)/)) {
    return "logistica";
  }
  return "admin";
}

// Envío a Gemini de Audio directo
async function sendAudioToGemini(audioBlob, apiKey) {
  const base64Audio = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/webm';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const systemInstruction = `Eres un asistente ejecutivo experto en reuniones y asignación de responsabilidades.
Escucha la reunión o audio grabado. Separa minuciosamente CADA actividad para CADA persona o área mencionada.
Clasifica cada tarea EXACTAMENTE en una de las siguientes 3 áreas:
- 'admin': Para Administradora General (cuestiones legales, contratos, directivas, tarifas, coaching, reclamos a proveedores, reuniones gerenciales, reorganización de personal).
- 'logistica': Para Logística / Operaciones (limpieza de almacén, camillas, muebles, cafetería, granito, control de stock y vencimientos, gafetes).
- 'sistemas': Para Sistemas / TI (creación de aplicativos web, formularios, códigos QR, bases de datos, reportes, alarmas).

Devuelve JSON estructurado:
{
  "tasks": [
    {
      "title": "Acción concisa y profesional",
      "area": "admin" | "logistica" | "sistemas",
      "priority": "alta" | "media" | "normal",
      "deadline": null
    }
  ]
}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType.split(';')[0],
              data: base64Audio
            }
          },
          {
            text: "Interpreta y segmenta todas las tareas asignadas en esta reunión para cada una de las 3 áreas."
          }
        ]
      }
    ],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(rawJson);
  return parsed.tasks || [];
}

// Envío a Gemini de Texto Transcript
async function sendTextToGemini(textPrompt, apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const systemInstruction = `Eres un asistente ejecutivo. Analiza el siguiente texto de reunión.
Identifica y separa TODAS las actividades individuales para cada área:
- 'admin': Administradora General (legal, personal, tarifas, directivas).
- 'logistica': Logística / Operaciones (almacén, limpieza, camillas, compras, stock).
- 'sistemas': Sistemas / TI (desarrollo web, formularios, reportes, QR).

Devuelve JSON con la lista de tareas en 'tasks'.`;

  const payload = {
    contents: [{ parts: [{ text: textPrompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: { responseMimeType: "application/json" }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Error en Gemini");
  const result = await response.json();
  const rawJson = result.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(rawJson);
  return parsed.tasks || [];
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Mostrar Toast
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px) scale(0.95)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Sanitizar HTML
function escapeHtml(string) {
  const div = document.createElement("div");
  div.innerText = string;
  return div.innerHTML;
}
