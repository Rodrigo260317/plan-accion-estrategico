/**
 * ==========================================================================
 * SISTEMA DE GESTIÓN Y SOLUCIÓN DE INCIDENCIAS QUINCENAL
 * Lógica Reactiva del Tablero Colaborativo (Logística, Administración y TI)
 * ==========================================================================
 */

// Estado global de la aplicación
const AppState = {
  data: null,
  activeFilter: 'all',          // 'all' | 'logistica' | 'administracion' | 'ti'
  priorityFilter: 'all',        // 'all' | 'Alta' | 'Media' | 'Normal'
  statusFilter: 'all',          // 'all' | 'pending' | 'completed'
  searchQuery: '',
  activeSolutionTask: null,
  isConnectedToBackend: false,
  isCloudSyncActive: false,
  serverVersion: 0,
  apiBaseUrl: ''
};

// Controladores de sincronización
let backendPollTimer = null;
let isSyncingToBackend = false;
let cloudEventSource = null;
const mySessionId = 'usr_' + Math.random().toString(36).substr(2, 9);

// Configuración de sincronización permanente en la nube 24/7 (Sin servidor local ni PC encendida)
const CLOUD_SYNC_CONFIG = {
  githubPagesUrl: 'https://rodrigo260317.github.io/plan-accion-estrategico/',
  // Canal SSE/PubSub en tiempo real de alta velocidad sin límites de peticiones
  pubsubUrl: 'https://ntfy.sh/plan_accion_estrategico_jtb_sync_2026',
  firebaseDbUrl: localStorage.getItem('firebase_rtdb_url') || ''
};

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initLucideIcons();
  setupEventListeners();
  await checkBackendConnection();
  await loadIncidentsData();
});

function initLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ==========================================================================
// CONEXIÓN Y CARGA DE DATOS
// ==========================================================================
async function checkBackendConnection() {
  // 1. Verificar si hay un servidor local corriendo
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Bypass-Tunnel-Reminder': '1',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const healthData = await res.json();
      AppState.isConnectedToBackend = true;
      AppState.isCloudSyncActive = false;
      AppState.serverVersion = healthData.version || 0;
      updateSyncBadge(true, 'Servidor en Vivo (Sincronizado)');
      startBackendSyncPolling();
      return;
    }
  } catch (err) {
    // Modo nube activado automáticamente
  }

  // 2. Modo 100% Nube 24/7 (Para GitHub Pages y uso remoto sin necesidad de PC)
  AppState.isConnectedToBackend = false;
  AppState.isCloudSyncActive = true;

  // Si existe URL de Google Firebase configurada por el usuario, activarla
  if (CLOUD_SYNC_CONFIG.firebaseDbUrl && initFirebaseRealtimeSync(CLOUD_SYNC_CONFIG.firebaseDbUrl)) {
    updateSyncBadge(true, 'En la Nube (Google Firebase 24/7)');
  } else {
    // Conectar canal de eventos en vivo SSE 24/7 de cero configuración
    initCloudRealtimeStream();
    updateSyncBadge(true, 'En la Nube (Sincronizado 24/7)');
  }
}

function updateSyncBadge(online, text) {
  const syncStatus = document.getElementById('syncStatus');
  if (!syncStatus) return;
  const syncLabel = syncStatus.querySelector('.sync-label');
  const syncDot = syncStatus.querySelector('.sync-dot');

  if (syncLabel) syncLabel.textContent = text;
  if (online) {
    syncStatus.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    if (syncDot) {
      syncDot.style.background = '#10b981';
      syncDot.style.boxShadow = '0 0 8px #10b981';
    }
  } else {
    syncStatus.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    if (syncDot) {
      syncDot.style.background = '#f59e0b';
      syncDot.style.boxShadow = '0 0 8px #f59e0b';
    }
  }
}

function flashSyncBadge(text) {
  const syncStatus = document.getElementById('syncStatus');
  if (!syncStatus) return;
  const syncLabel = syncStatus.querySelector('.sync-label');
  const originalText = AppState.isConnectedToBackend ? 'Servidor en Vivo (Sincronizado)' : 'En línea';

  if (syncLabel) syncLabel.textContent = text;
  syncStatus.classList.add('pulse-active');
  setTimeout(() => {
    syncStatus.classList.remove('pulse-active');
    if (syncLabel) syncLabel.textContent = originalText;
  }, 2200);
}

// --------------------------------------------------------------------------
// SONDEO REACTIVO EN VIVO PARA MULTI-USUARIO (TIEMPO REAL < 1.5 SEGUNDOS)
// --------------------------------------------------------------------------
function startBackendSyncPolling() {
  if (backendPollTimer) clearInterval(backendPollTimer);
  backendPollTimer = setInterval(async () => {
    if (!AppState.isConnectedToBackend || isSyncingToBackend || !AppState.data || !AppState.data.areas) return;

    try {
      const res = await fetch('/api/sync/state', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Bypass-Tunnel-Reminder': '1',
          'Cache-Control': 'no-cache'
        }
      });

      if (!res.ok) {
        if (res.status === 404 || res.status === 502 || res.status === 503) {
          updateSyncBadge(false, 'Reconectando servidor...');
        }
        return;
      }

      const syncState = await res.json();
      if (!syncState || !syncState.completed_tasks) return;

      updateSyncBadge(true, 'Servidor en Vivo (Sincronizado)');

      // Si la versión del servidor cambió, actualizar los cambios realizados por otros usuarios
      if (syncState.version !== AppState.serverVersion) {
        AppState.serverVersion = syncState.version;
        const remoteCompleted = new Set(syncState.completed_tasks);
        const changedTasks = [];

        AppState.data.areas.forEach(area => {
          area.tareas.forEach(task => {
            const shouldBeCompleted = remoteCompleted.has(task.id);
            if (task.completada !== shouldBeCompleted) {
              task.completada = shouldBeCompleted;
              changedTasks.push({ id: task.id, completed: shouldBeCompleted });
            }
          });
        });

        if (changedTasks.length > 0) {
          // Reflejar visualmente en el DOM sin recargar
          changedTasks.forEach(({ id, completed }) => {
            const card = document.getElementById(`card-${id}`);
            const chk = document.getElementById(`chk-${id}`);
            if (card) {
              if (completed) card.classList.add('completed');
              else card.classList.remove('completed');

              // Microanimación de pulso colaborativo
              card.classList.add('task-updated-remotely');
              setTimeout(() => card.classList.remove('task-updated-remotely'), 1600);
            }
            if (chk) chk.checked = completed;
          });

          // Recalcular métricas de progreso de inmediato
          renderProgressMetrics();
          updateFilterCounts();
          saveToLocalStorage(AppState.data);

          flashSyncBadge(`Actualizado en vivo (${changedTasks.length} ${changedTasks.length === 1 ? 'cambio' : 'cambios'})`);
        }
      }
    } catch (err) {
      // Silencioso ante pérdidas transitorias de red
    }
  }, 1400); // 1.4 segundos para respuesta inmediata sin saturar
}

async function loadIncidentsData() {
  try {
    // 1. Intentar cargar desde el backend local si está activo
    if (AppState.isConnectedToBackend) {
      const response = await fetch('/api/data', {
        cache: 'no-store',
        headers: { 'Bypass-Tunnel-Reminder': '1', 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        AppState.data = await response.json();
        saveToLocalStorage(AppState.data);
        renderFullBoard();
        return;
      }
    }

    // 2. Cargar desde datos_incidencias.json relativo
    let jsonData = null;
    try {
      const fileResponse = await fetch('datos_incidencias.json', {
        cache: 'no-store',
        headers: { 'Bypass-Tunnel-Reminder': '1' }
      });
      if (fileResponse.ok) {
        jsonData = await fileResponse.json();
      }
    } catch (e) {
      console.warn('No se pudo cargar datos_incidencias.json relativo, usando caché o nube', e);
    }

    if (!jsonData) {
      jsonData = loadFromLocalStorage();
    }

    if (jsonData) {
      // Si la sincronización en la nube está activa, consultar el estado remoto
      if (AppState.isCloudSyncActive) {
        await applyCloudSyncState(jsonData);
      } else {
        const savedLocal = loadFromLocalStorage();
        if (savedLocal && savedLocal.metadata && jsonData.metadata && savedLocal.metadata.id_reunion === jsonData.metadata.id_reunion) {
          mergeCompletedStates(jsonData, savedLocal);
        }
      }

      AppState.data = jsonData;
      renderFullBoard();
      return;
    }

    // 3. Respaldo desde LocalStorage si falló todo
    const cachedData = loadFromLocalStorage();
    if (cachedData) {
      AppState.data = cachedData;
      renderFullBoard();
      return;
    }
  } catch (error) {
    console.warn('Cargando datos desde caché local por error de red:', error);
    const cached = loadFromLocalStorage();
    if (cached) {
      AppState.data = cached;
      renderFullBoard();
    }
  }
}

// ==========================================================================
// SINCRONIZACIÓN EN LA NUBE 24/7 (SSE / WEBSOCKETS / GOOGLE FIREBASE)
// ==========================================================================

function initCloudRealtimeStream() {
  if (cloudEventSource) cloudEventSource.close();

  // 1. Reconstruir estado reciente desde el bus de eventos en la nube
  fetchPastCloudActions();

  // 2. Conectar stream de eventos en vivo Server-Sent Events (SSE) 24/7
  try {
    cloudEventSource = new EventSource(CLOUD_SYNC_CONFIG.pubsubUrl + '/sse');

    cloudEventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg.message) return;
        const action = JSON.parse(msg.message);

        // Evitar procesar mis propias acciones ya aplicadas
        if (action.sender === mySessionId) return;

        if (action.type === 'TASK_TOGGLE' && action.taskId) {
          applyRemoteTaskToggle(action.areaId, action.taskId, action.completed, true);
        }
      } catch (e) {}
    };

    cloudEventSource.onerror = () => {
      // EventSource se reconecta automáticamente en segundo plano
    };
  } catch (e) {
    console.warn('Error conectando canal SSE en vivo:', e);
  }
}

async function fetchPastCloudActions() {
  try {
    const res = await fetch(CLOUD_SYNC_CONFIG.pubsubUrl + '/json?poll=1&since=all', { cache: 'no-store' });
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.trim().split('\n');

    lines.forEach(line => {
      try {
        const item = JSON.parse(line);
        if (item.message) {
          const action = JSON.parse(item.message);
          if (action.type === 'TASK_TOGGLE' && action.taskId) {
            applyRemoteTaskToggle(action.areaId, action.taskId, action.completed, false);
          }
        }
      } catch (e) {}
    });

    renderProgressMetrics();
    updateFilterCounts();
    saveToLocalStorage(AppState.data);
  } catch (e) {}
}

function applyRemoteTaskToggle(areaId, taskId, completed, showAnimation = true) {
  if (!AppState.data || !AppState.data.areas) return;

  let foundTask = null;
  for (const area of AppState.data.areas) {
    const t = area.tareas.find(x => x.id === taskId);
    if (t) {
      foundTask = t;
      break;
    }
  }

  if (!foundTask) return;
  if (foundTask.completada === completed) return;

  foundTask.completada = completed;

  const card = document.getElementById(`card-${taskId}`);
  const chk = document.getElementById(`chk-${taskId}`);

  if (card) {
    if (completed) card.classList.add('completed');
    else card.classList.remove('completed');

    if (showAnimation) {
      card.classList.add('task-updated-remotely');
      setTimeout(() => card.classList.remove('task-updated-remotely'), 1600);
    }
  }
  if (chk) chk.checked = completed;

  if (showAnimation) {
    renderProgressMetrics();
    updateFilterCounts();
    saveToLocalStorage(AppState.data);
    flashSyncBadge('Actualizado en la Nube 24/7');
  }
}

async function broadcastCloudTaskToggle(areaId, taskId, isChecked) {
  const payload = {
    type: 'TASK_TOGGLE',
    areaId: areaId,
    taskId: taskId,
    completed: isChecked,
    sender: mySessionId,
    timestamp: Date.now()
  };

  // 1. Si Firebase está activo, persistir en Google Firebase
  if (window.firebaseAppDb) {
    try {
      window.firebaseAppDb.ref('incidencias/completadas/' + taskId).set(isChecked);
    } catch (e) {}
  }

  // 2. Transmitir en el canal de eventos SSE en la nube en tiempo real
  try {
    fetch(CLOUD_SYNC_CONFIG.pubsubUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

function initFirebaseRealtimeSync(dbUrl) {
  try {
    if (!window.firebase) return false;
    let url = dbUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    if (!url.endsWith('/')) url += '/';

    if (!firebase.apps.length) {
      firebase.initializeApp({ databaseURL: url });
    }
    window.firebaseAppDb = firebase.database();

    // Escuchar cambios en vivo sobre las tareas
    window.firebaseAppDb.ref('incidencias/completadas').on('value', (snapshot) => {
      const val = snapshot.val();
      if (!val || !AppState.data) return;

      let hasChanges = false;
      AppState.data.areas.forEach(area => {
        area.tareas.forEach(task => {
          const isComp = Boolean(val[task.id]);
          if (task.completada !== isComp) {
            task.completada = isComp;
            hasChanges = true;
            const card = document.getElementById(`card-${task.id}`);
            const chk = document.getElementById(`chk-${task.id}`);
            if (card) {
              if (isComp) card.classList.add('completed');
              else card.classList.remove('completed');
              card.classList.add('task-updated-remotely');
              setTimeout(() => card.classList.remove('task-updated-remotely'), 1600);
            }
            if (chk) chk.checked = isComp;
          }
        });
      });

      if (hasChanges) {
        renderProgressMetrics();
        updateFilterCounts();
        saveToLocalStorage(AppState.data);
        flashSyncBadge('Sincronizado vía Google Firebase');
      }
    });

    updateSyncBadge(true, 'En la Nube (Google Firebase 24/7)');
    return true;
  } catch (err) {
    console.warn('Error inicializando Firebase:', err);
    return false;
  }
}

function mergeCompletedStates(targetData, sourceData) {
  if (!sourceData.areas || !targetData.areas) return;
  const completedMap = {};
  sourceData.areas.forEach(area => {
    area.tareas.forEach(task => {
      completedMap[task.id] = task.completada;
    });
  });

  targetData.areas.forEach(area => {
    area.tareas.forEach(task => {
      if (completedMap.hasOwnProperty(task.id)) {
        task.completada = completedMap[task.id];
      }
    });
  });
}

function saveToLocalStorage(data) {
  try {
    localStorage.setItem('incidencias_data_cache', JSON.stringify(data));
  } catch (e) {
    console.error('Error guardando en localStorage:', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem('incidencias_data_cache');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ==========================================================================
// RENDERIZADO COMPLETO DEL TABLERO
// ==========================================================================
function renderFullBoard() {
  if (!AppState.data) return;

  renderExecutiveHeader();
  renderProgressMetrics();
  renderInnovationsAndImprovements();
  renderTasksColumns();
  updateFilterCounts();
  initLucideIcons();
}

// 1. Resumen Ejecutivo y Metadatos de la Reunión
function renderExecutiveHeader() {
  const meta = AppState.data.metadata || {};
  
  const meetingTitle = document.getElementById('meetingTitle');
  const meetingDate = document.getElementById('meetingDate');
  const meetingSummary = document.getElementById('meetingSummary');
  const countdownText = document.getElementById('countdownText');
  const sprintBadge = document.getElementById('sprintBadge');
  const requirementsContainer = document.getElementById('requirementsContainer');

  if (meetingTitle && meta.titulo_reunion) meetingTitle.textContent = meta.titulo_reunion;
  if (meetingDate && meta.fecha_reunion) meetingDate.innerHTML = `<i data-lucide="calendar"></i> ${meta.fecha_reunion}`;
  if (meetingSummary && meta.resumen_ejecutivo) meetingSummary.textContent = meta.resumen_ejecutivo;
  if (sprintBadge && meta.periodo_sprint) sprintBadge.textContent = `Sprint: ${meta.periodo_sprint}`;
  
  if (countdownText && meta.dias_restantes_sprint !== undefined) {
    countdownText.textContent = `${meta.dias_restantes_sprint} días para la próxima reunión`;
  }

  // Requerimientos Clave
  if (requirementsContainer && AppState.data.requerimientos_resumidos) {
    requirementsContainer.innerHTML = AppState.data.requerimientos_resumidos
      .map(req => `<div class="req-pill">${escapeHtml(req)}</div>`)
      .join('');
  }
}

// 2. Escala de Avance & KPIs
function renderProgressMetrics() {
  if (!AppState.data.areas) return;

  let totalTasks = 0;
  let completedTasks = 0;

  const areaMetrics = {};

  AppState.data.areas.forEach(area => {
    const areaTotal = area.tareas.length;
    const areaCompleted = area.tareas.filter(t => t.completada).length;
    const areaPct = areaTotal > 0 ? Math.round((areaCompleted / areaTotal) * 100) : 0;

    areaMetrics[area.id] = {
      total: areaTotal,
      completed: areaCompleted,
      percent: areaPct
    };

    totalTasks += areaTotal;
    completedTasks += areaCompleted;
  });

  const globalPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Actualizar métrica global
  const globalPercentNumber = document.getElementById('globalPercentNumber');
  const globalProgressBar = document.getElementById('globalProgressBar');

  if (globalPercentNumber) globalPercentNumber.textContent = `${globalPct}%`;
  if (globalProgressBar) globalProgressBar.style.width = `${globalPct}%`;

  // Actualizar áreas individuales
  ['logistica', 'administracion', 'ti'].forEach(id => {
    const metrics = areaMetrics[id] || { total: 0, completed: 0, percent: 0 };
    const countsEl = document.getElementById(`${id}Counts`);
    const percentEl = document.getElementById(`${id}Percent`);
    const barEl = document.getElementById(`${id}ProgressBar`);

    if (countsEl) countsEl.textContent = `${metrics.completed}/${metrics.total} tareas`;
    if (percentEl) percentEl.textContent = `${metrics.percent}%`;
    if (barEl) barEl.style.width = `${metrics.percent}%`;
  });

  // Confetti si alcanza el 100%
  if (globalPct === 100 && totalTasks > 0) {
    triggerCelebrationConfetti();
  }
}

// 3. Mapeo de Innovaciones y Mejoras
function renderInnovationsAndImprovements() {
  const innovationsList = document.getElementById('innovationsList');
  const improvementsList = document.getElementById('improvementsList');

  if (innovationsList && AppState.data.nuevas_innovaciones) {
    innovationsList.innerHTML = AppState.data.nuevas_innovaciones.map(inn => `
      <div class="strategy-card">
        <div class="strategy-card-top">
          <span class="strategy-card-title">${escapeHtml(inn.titulo)}</span>
          <span class="badge badge-purple">${escapeHtml(inn.impacto || 'Innovación')}</span>
        </div>
        <p class="strategy-card-desc">${escapeHtml(inn.descripcion)}</p>
        <div class="strategy-card-footer">
          <span>Estado: <strong>${escapeHtml(inn.estado || 'Propuesta')}</strong></span>
        </div>
      </div>
    `).join('');
  }

  if (improvementsList && AppState.data.mejoras_implementar) {
    improvementsList.innerHTML = AppState.data.mejoras_implementar.map(mej => `
      <div class="strategy-card">
        <div class="strategy-card-top">
          <span class="strategy-card-title">${escapeHtml(mej.titulo)}</span>
          <span class="badge badge-cyan">${escapeHtml(mej.area_lider || 'Mejora')}</span>
        </div>
        <p class="strategy-card-desc">${escapeHtml(mej.descripcion)}</p>
        <div class="strategy-card-footer">
          <span>Beneficio: <strong>${escapeHtml(mej.beneficio || 'Optimización')}</strong></span>
        </div>
      </div>
    `).join('');
  }
}

// 4. Tablero de Tareas con Checkboxes Grandes y Soluciones IA
function renderTasksColumns() {
  const gridContainer = document.getElementById('boardColumnsGrid');
  if (!gridContainer || !AppState.data.areas) return;

  gridContainer.innerHTML = '';

  AppState.data.areas.forEach(area => {
    // Si hay un filtro por área activo y no coincide, no mostrar la columna
    if (AppState.activeFilter !== 'all' && AppState.activeFilter !== area.id) {
      return;
    }

    // Filtrar las tareas según búsqueda, prioridad y estado
    const filteredTasks = area.tareas.filter(task => {
      // Filtro de estado
      if (AppState.statusFilter === 'pending' && task.completada) return false;
      if (AppState.statusFilter === 'completed' && !task.completada) return false;

      // Filtro de prioridad
      if (AppState.priorityFilter !== 'all' && task.prioridad !== AppState.priorityFilter) return false;

      // Filtro de búsqueda
      if (AppState.searchQuery.trim() !== '') {
        const q = AppState.searchQuery.toLowerCase();
        const inTitle = task.titulo.toLowerCase().includes(q);
        const inDesc = task.descripcion.toLowerCase().includes(q);
        const inId = task.id.toLowerCase().includes(q);
        const inDiag = task.posible_solucion && task.posible_solucion.diagnostico ? task.posible_solucion.diagnostico.toLowerCase().includes(q) : false;
        if (!inTitle && !inDesc && !inId && !inDiag) return false;
      }

      return true;
    });

    const colEl = document.createElement('div');
    colEl.className = `board-column col-${area.id}`;

    colEl.innerHTML = `
      <div class="column-header-bar">
        <div class="col-brand">
          <span class="col-emoji">${area.icono || '📌'}</span>
          <span class="col-title">${escapeHtml(area.nombre)}</span>
        </div>
        <span class="col-badge">${filteredTasks.length} ${filteredTasks.length === 1 ? 'actividad' : 'actividades'}</span>
      </div>

      <div class="tasks-cards-container" id="tasks-container-${area.id}">
        ${filteredTasks.length > 0 
          ? filteredTasks.map(task => renderTaskCardHtml(task, area)).join('') 
          : `<div class="empty-tasks-state">
               <i data-lucide="inbox"></i>
               <p>No hay tareas que coincidan con los filtros actuales.</p>
             </div>`
        }
      </div>
    `;

    gridContainer.appendChild(colEl);
  });
}

function renderTaskCardHtml(task, area) {
  const priorityClass = `priority-${(task.prioridad || 'normal').toLowerCase()}`;
  const isCompleted = task.completada ? 'completed' : '';
  const isChecked = task.completada ? 'checked' : '';
  const timeLabel = task.proyeccion_tiempo ? task.proyeccion_tiempo.etiqueta : 'Sprint quincenal';

  return `
    <div class="task-card ${isCompleted}" id="card-${task.id}" data-task-id="${task.id}" data-area-id="${area.id}">
      <div class="task-card-header">
        <div class="custom-checkbox-wrapper">
          <input 
            type="checkbox" 
            class="custom-checkbox" 
            id="chk-${task.id}" 
            ${isChecked}
            onchange="toggleTaskCompletion('${area.id}', '${task.id}', this.checked)"
            title="Marcar como realizada"
          />
        </div>
        <div class="task-text-group">
          <div class="task-title">${escapeHtml(task.titulo)}</div>
          <div class="task-desc">${escapeHtml(task.descripcion)}</div>
        </div>
      </div>

      <div class="task-card-meta">
        <span class="badge-task-id">${task.id}</span>
        <span class="badge-priority ${priorityClass}">● ${task.prioridad || 'Normal'}</span>
        <span class="badge-time"><i data-lucide="clock"></i> ${escapeHtml(timeLabel)}</span>
      </div>

      <div class="task-card-actions">
        <button class="btn-ai-solution" onclick="openSolutionModal('${area.id}', '${task.id}')">
          <i data-lucide="sparkles"></i>
          <span>Ver Solución Sugerida (IA)</span>
        </button>
      </div>
    </div>
  `;
}

// 5. Conteo de los filtros de rol
function updateFilterCounts() {
  if (!AppState.data.areas) return;

  let countAll = 0;
  const counts = { logistica: 0, administracion: 0, ti: 0 };

  AppState.data.areas.forEach(area => {
    counts[area.id] = area.tareas.length;
    countAll += area.tareas.length;
  });

  const elAll = document.getElementById('countAll');
  const elLog = document.getElementById('countLogistica');
  const elAdm = document.getElementById('countAdministracion');
  const elTi = document.getElementById('countTi');

  if (elAll) elAll.textContent = countAll;
  if (elLog) elLog.textContent = counts.logistica || 0;
  if (elAdm) elAdm.textContent = counts.administracion || 0;
  if (elTi) elTi.textContent = counts.ti || 0;
}

// ==========================================================================
// INTERACCIÓN Y MANEJO DE CHECKS (PERSISTENCIA Y SYNC)
// ==========================================================================
window.toggleTaskCompletion = async function(areaId, taskId, isChecked) {
  if (!AppState.data || !AppState.data.areas) return;

  // 1. Actualizar estado en memoria
  const area = AppState.data.areas.find(a => a.id === areaId);
  if (area) {
    const task = area.tareas.find(t => t.id === taskId);
    if (task) {
      task.completada = isChecked;
    }
  }

  // 2. Actualizar visualmente la tarjeta de inmediato
  const card = document.getElementById(`card-${taskId}`);
  if (card) {
    if (isChecked) {
      card.classList.add('completed');
    } else {
      card.classList.remove('completed');
    }
  }

  // 3. Recalcular escala de avance
  renderProgressMetrics();
  saveToLocalStorage(AppState.data);

  // 4. Si está conectado al servidor colaborativo local, sincronizar en tiempo real
  if (AppState.isConnectedToBackend) {
    isSyncingToBackend = true;
    try {
      const res = await fetch('/api/task/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': '1',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ area_id: areaId, task_id: taskId, completed: isChecked })
      });
      if (res.ok) {
        const resData = await res.json();
        if (resData.version) {
          AppState.serverVersion = resData.version;
        }
        flashSyncBadge('Guardado y Sincronizado');
      }
    } catch (e) {
      console.error('Error sincronizando con backend:', e);
      updateSyncBadge(false, 'Error de Sincronización');
    } finally {
      setTimeout(() => { isSyncingToBackend = false; }, 350);
    }
  }

  // 5. Transmitir SIEMPRE al canal en la nube 24/7 (para GitHub Pages y colaboradores remotos)
  broadcastCloudTaskToggle(areaId, taskId, isChecked);
};


// ==========================================================================
// MODAL DE POSIBLE SOLUCIÓN PROPUESTA POR IA
// ==========================================================================
window.openSolutionModal = function(areaId, taskId) {
  if (!AppState.data || !AppState.data.areas) return;

  const area = AppState.data.areas.find(a => a.id === areaId);
  if (!area) return;

  const task = area.tareas.find(t => t.id === taskId);
  if (!task) return;

  AppState.activeSolutionTask = { areaId, taskId, task };

  const modal = document.getElementById('solutionModal');
  const modalTaskTitle = document.getElementById('modalTaskTitle');
  const modalTaskId = document.getElementById('modalTaskId');
  const modalPriorityTag = document.getElementById('modalPriorityTag');
  const modalDeadlineTag = document.getElementById('modalDeadlineTag');
  const modalAreaBadge = document.getElementById('modalAreaBadge');
  const modalDiagnosticText = document.getElementById('modalDiagnosticText');
  const modalStepsList = document.getElementById('modalStepsList');
  const modalToolsTags = document.getElementById('modalToolsTags');
  const modalImpactText = document.getElementById('modalImpactText');
  const modalToggleActionText = document.getElementById('modalToggleActionText');

  modalTaskTitle.textContent = task.titulo;
  modalTaskId.textContent = task.id;
  modalPriorityTag.textContent = `Prioridad: ${task.prioridad || 'Normal'}`;
  modalDeadlineTag.textContent = task.proyeccion_tiempo ? `⏱️ ${task.proyeccion_tiempo.etiqueta}` : '⏱️ Sprint quincenal';
  modalAreaBadge.innerHTML = `<i data-lucide="cpu"></i> ${area.icono} Solución IA - ${area.nombre}`;

  const sol = task.posible_solucion || {};
  modalDiagnosticText.textContent = sol.diagnostico || 'Diagnóstico preliminar basado en la discusión de la reunión quincenal.';

  // Pasos de acción
  if (sol.propuesta_accion && sol.propuesta_accion.length > 0) {
    modalStepsList.innerHTML = sol.propuesta_accion.map(step => `<li>${escapeHtml(step)}</li>`).join('');
  } else {
    modalStepsList.innerHTML = `<li>Paso 1: Evaluar requerimiento con el líder de área.</li><li>Paso 2: Ejecutar plan de resolución antes de la próxima reunión quincenal.</li>`;
  }

  // Herramientas sugeridas
  if (sol.herramientas_sugeridas && sol.herramientas_sugeridas.length > 0) {
    modalToolsTags.innerHTML = sol.herramientas_sugeridas.map(t => `<span class="tool-tag">${escapeHtml(t)}</span>`).join('');
  } else {
    modalToolsTags.innerHTML = `<span class="tool-tag">Herramientas estándar del área</span>`;
  }

  // Impacto
  modalImpactText.textContent = sol.impacto_esperado || 'Resolución directa de la incidencia y mitigación de cuellos de botella.';

  // Botón de acción toggle en el modal
  modalToggleActionText.textContent = task.completada ? 'Marcar como Pendiente' : 'Marcar como Realizada';

  modal.classList.add('active');
  initLucideIcons();
};

function closeSolutionModal() {
  const modal = document.getElementById('solutionModal');
  if (modal) modal.classList.remove('active');
  AppState.activeSolutionTask = null;
}

// ==========================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  // 1. Pestañas de Filtro de Área
  document.querySelectorAll('.role-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.activeFilter = btn.dataset.filter;
      renderTasksColumns();
      initLucideIcons();
    });
  });

  // 2. Buscador en Tiempo Real
  const searchInput = document.getElementById('taskSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', AppState.searchQuery.trim() === '');
      }
      renderTasksColumns();
      initLucideIcons();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      AppState.searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      renderTasksColumns();
      initLucideIcons();
    });
  }

  // 3. Dropdowns de Prioridad y Estado
  const priorityFilterSelect = document.getElementById('priorityFilterSelect');
  if (priorityFilterSelect) {
    priorityFilterSelect.addEventListener('change', (e) => {
      AppState.priorityFilter = e.target.value;
      renderTasksColumns();
      initLucideIcons();
    });
  }

  const statusFilterSelect = document.getElementById('statusFilterSelect');
  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', (e) => {
      AppState.statusFilter = e.target.value;
      renderTasksColumns();
      initLucideIcons();
    });
  }

  // 4. Toggle Detalles y Acuerdos de la reunión (abajo)
  const btnToggleBottom = document.getElementById('btnToggleBottomDetails');
  const bottomWrapper = document.getElementById('bottomDetailsWrapper');
  const toggleDetailsText = document.getElementById('toggleDetailsText');
  const toggleDetailsIcon = document.getElementById('toggleDetailsIcon');
  if (btnToggleBottom && bottomWrapper) {
    btnToggleBottom.addEventListener('click', () => {
      const isCollapsed = bottomWrapper.classList.toggle('collapsed');
      if (toggleDetailsText) {
        toggleDetailsText.textContent = isCollapsed ? 'Ver Síntesis y Acuerdos' : 'Ocultar Síntesis y Acuerdos';
      }
      if (toggleDetailsIcon) {
        toggleDetailsIcon.setAttribute('data-lucide', isCollapsed ? 'chevron-down' : 'chevron-up');
        initLucideIcons();
      }
      if (!isCollapsed) {
        bottomWrapper.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // 5. Modales - Cerrar al hacer clic en backdrop o botón de cierre
  document.getElementById('btnCloseSolutionModal')?.addEventListener('click', closeSolutionModal);
  document.getElementById('solutionModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'solutionModal') closeSolutionModal();
  });

  // Botón para marcar tarea desde el modal de solución
  document.getElementById('btnToggleCompletedFromModal')?.addEventListener('click', () => {
    if (!AppState.activeSolutionTask) return;
    const { areaId, taskId, task } = AppState.activeSolutionTask;
    const nextState = !task.completada;
    toggleTaskCompletion(areaId, taskId, nextState);
    const chk = document.getElementById(`chk-${taskId}`);
    if (chk) chk.checked = nextState;
    closeSolutionModal();
  });

  // Copiar solución sugerida
  document.getElementById('btnCopySolution')?.addEventListener('click', () => {
    if (!AppState.activeSolutionTask) return;
    const { task } = AppState.activeSolutionTask;
    const sol = task.posible_solucion || {};
    const textToCopy = `📌 INCIDENCIA: ${task.titulo} (${task.id})
🔍 DIAGNÓSTICO: ${sol.diagnostico || 'N/A'}
📋 PLAN DE ACCIÓN:
${(sol.propuesta_accion || []).map(s => '• ' + s).join('\n')}
🛠️ HERRAMIENTAS: ${(sol.herramientas_sugeridas || []).join(', ')}
🎯 IMPACTO: ${sol.impacto_esperado || 'N/A'}`;

    navigator.clipboard.writeText(textToCopy).then(() => {
      const btn = document.getElementById('btnCopySolution');
      btn.innerHTML = `<i data-lucide="check"></i> <span>¡Copiado!</span>`;
      initLucideIcons();
      setTimeout(() => {
        btn.innerHTML = `<i data-lucide="copy"></i> <span>Copiar Solución</span>`;
        initLucideIcons();
      }, 2000);
    });
  });

  // 6. Modal Nueva Reunión
  const newMeetingModal = document.getElementById('newMeetingModal');
  document.getElementById('btnOpenNewMeetingModal')?.addEventListener('click', () => {
    newMeetingModal.classList.add('active');
  });
  document.getElementById('btnCloseMeetingModal')?.addEventListener('click', () => {
    newMeetingModal.classList.remove('active');
  });
  document.getElementById('btnCancelMeetingModal')?.addEventListener('click', () => {
    newMeetingModal.classList.remove('active');
  });

  // Pestañas del modal de nueva reunión
  document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Subida de audio / Drag & Drop
  setupAudioUploadEvents();

  // Importar JSON
  setupJsonImportEvents();

  // 7. Modal Compartir
  const shareModal = document.getElementById('shareModal');
  document.getElementById('btnShareModal')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('shareUrlInput');
    const localWifiInput = document.getElementById('localWifiUrlInput');
    const passNotice = document.getElementById('tunnelPasswordNotice');
    const passCode = document.getElementById('tunnelPasswordCode');
    const mainLabel = document.getElementById('shareBoxMainLabel');

    // Valor predeterminado
    let activeShareUrl = window.location.href;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      activeShareUrl = CLOUD_SYNC_CONFIG.githubPagesUrl;
    }

    // Si estamos conectados al backend, consultar información del túnel e IP local
    if (AppState.isConnectedToBackend) {
      try {
        const infoRes = await fetch('/api/tunnel/info', {
          headers: { 'Bypass-Tunnel-Reminder': '1', 'Cache-Control': 'no-cache' }
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (info.tunnel_url) {
            activeShareUrl = info.tunnel_url;
            if (mainLabel) mainLabel.textContent = '🌐 Enlace Público en Vivo (Túnel HTTPS):';
          } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            activeShareUrl = window.location.href;
            if (mainLabel) mainLabel.textContent = '🌐 Enlace Público en Vivo:';
          }
          if (info.local_network_url && localWifiInput) {
            localWifiInput.value = info.local_network_url;
          }
        }
      } catch (err) {
        console.warn('No se pudo obtener información del túnel:', err);
      }

      // Intentar leer enlace_activo.txt para verificar si hay contraseña/IP de túnel
      try {
        const linkRes = await fetch('enlace_activo.txt', {
          cache: 'no-store',
          headers: { 'Bypass-Tunnel-Reminder': '1' }
        });
        if (linkRes.ok) {
          const linkRaw = await linkRes.text();
          if (linkRaw.trim().startsWith('{')) {
            const parsed = JSON.parse(linkRaw);
            if (parsed.url) activeShareUrl = parsed.url;
            if (parsed.ip_password && passNotice && passCode) {
              passCode.textContent = parsed.ip_password;
              passNotice.style.display = 'flex';
            }
            if (parsed.local_wifi_url && localWifiInput) {
              localWifiInput.value = parsed.local_wifi_url;
            }
          } else if (linkRaw.trim().startsWith('http')) {
            activeShareUrl = linkRaw.trim();
          }
        }
      } catch (err) {}
    }

    if (urlInput) {
      urlInput.value = activeShareUrl;
    }
    shareModal.classList.add('active');
  });

  document.getElementById('btnCloseShareModal')?.addEventListener('click', () => {
    shareModal.classList.remove('active');
  });
  document.getElementById('btnCloseShareModalFooter')?.addEventListener('click', () => {
    shareModal.classList.remove('active');
  });

  document.getElementById('btnCopyShareUrl')?.addEventListener('click', () => {
    const urlInput = document.getElementById('shareUrlInput');
    if (urlInput) {
      navigator.clipboard.writeText(urlInput.value).then(() => {
        const copyText = document.getElementById('copyUrlText');
        if (copyText) copyText.textContent = '¡Enlace Copiado!';
        setTimeout(() => {
          if (copyText) copyText.textContent = 'Copiar Enlace';
        }, 2000);
      });
    }
  });

  document.getElementById('btnCopyLocalWifi')?.addEventListener('click', () => {
    const wifiInput = document.getElementById('localWifiUrlInput');
    if (wifiInput) {
      navigator.clipboard.writeText(wifiInput.value).then(() => {
        const btn = document.getElementById('btnCopyLocalWifi');
        if (btn) btn.textContent = '¡Copiado!';
        setTimeout(() => {
          if (btn) btn.textContent = 'Copiar';
        }, 2000);
      });
    }
  });

  document.getElementById('btnCopyTunnelPass')?.addEventListener('click', () => {
    const passCode = document.getElementById('tunnelPasswordCode');
    if (passCode) {
      navigator.clipboard.writeText(passCode.textContent.trim()).then(() => {
        const btn = document.getElementById('btnCopyTunnelPass');
        if (btn) btn.textContent = '¡Copiado!';
        setTimeout(() => {
          if (btn) btn.textContent = 'Copiar';
        }, 2000);
      });
    }
  });

  // Conexión y guardado de URL de Google Firebase Realtime Database
  const fbInput = document.getElementById('firebaseDbUrlInput');
  const fbStatus = document.getElementById('firebaseStatusText');
  if (fbInput && CLOUD_SYNC_CONFIG.firebaseDbUrl) {
    fbInput.value = CLOUD_SYNC_CONFIG.firebaseDbUrl;
    if (fbStatus) fbStatus.textContent = '✅ Conectado a base de datos de Google Firebase.';
  }

  document.getElementById('btnSaveFirebaseUrl')?.addEventListener('click', () => {
    if (!fbInput) return;
    const url = fbInput.value.trim();
    if (!url) {
      localStorage.removeItem('firebase_rtdb_url');
      CLOUD_SYNC_CONFIG.firebaseDbUrl = '';
      if (fbStatus) fbStatus.textContent = '🟢 Usando canal Cloud Pub/Sub en vivo por defecto.';
      initCloudRealtimeStream();
      return;
    }
    localStorage.setItem('firebase_rtdb_url', url);
    CLOUD_SYNC_CONFIG.firebaseDbUrl = url;
    const ok = initFirebaseRealtimeSync(url);
    if (ok) {
      if (fbStatus) fbStatus.textContent = '✅ Conectado con éxito a tu base de datos de Google Firebase.';
      const btn = document.getElementById('btnSaveFirebaseUrl');
      if (btn) btn.textContent = '¡Conectado!';
      setTimeout(() => { if (btn) btn.textContent = 'Conectar'; }, 2000);
    } else {
      if (fbStatus) fbStatus.textContent = '⚠️ Verifica que la URL termine en .firebaseio.com';
    }
  });

  // Copiar Prompt Maestro
  document.getElementById('btnCopyMasterPrompt')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('PROMPT_MAESTRO_ANALISIS.txt');
      let promptText = '';
      if (resp.ok) {
        promptText = await resp.text();
      } else {
        promptText = 'Abre el archivo PROTOCOLO_FLUJO_IA.md para copiar el prompt maestro.';
      }
      await navigator.clipboard.writeText(promptText);
      alert('¡Prompt maestro copiado al portapapeles! Ya puedes pegarlo en ChatGPT, Claude o Gemini.');
    } catch (e) {
      alert('Puedes consultar y copiar el archivo PROTOCOLO_FLUJO_IA.md directamente.');
    }
  });
}

// Eventos de Ingesta de Audio
function setupAudioUploadEvents() {
  const dropzone = document.getElementById('audioDropzone');
  const fileInput = document.getElementById('audioFileInput');
  const banner = document.getElementById('selectedFileBanner');
  const fileName = document.getElementById('selectedFileName');
  const startBtn = document.getElementById('btnStartAudioProcess');
  const progressBox = document.getElementById('processProgressBox');
  const statusText = document.getElementById('processStatusText');

  let selectedFile = null;

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleAudioFileSelected(e.target.files[0]);
      }
    });
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleAudioFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  function handleAudioFileSelected(file) {
    selectedFile = file;
    if (banner && fileName) {
      fileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      banner.classList.remove('hidden');
    }
  }

  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (!selectedFile) {
        alert('Por favor selecciona o arrastra un archivo de audio primero.');
        return;
      }

      if (!AppState.isConnectedToBackend) {
        alert('Para procesar el audio automáticamente con Faster-Whisper, inicia el servidor ejecutando "iniciar_sistema.bat" o corre "ejecutar_procesamiento_audio.bat". Alternativamente puedes pegar la transcripción o el JSON en la pestaña 2.');
        return;
      }

      startBtn.disabled = true;
      if (progressBox) progressBox.classList.remove('hidden');
      if (statusText) statusText.textContent = 'Subiendo audio y procesando con transcriptor e IA...';

      const formData = new FormData();
      formData.append('audio', selectedFile);
      const modelSelect = document.getElementById('transcribeModelSelect');
      if (modelSelect) formData.append('model', modelSelect.value);

      try {
        const resp = await fetch('/api/process_audio', {
          method: 'POST',
          body: formData
        });

        if (resp.ok) {
          const newBoardData = await resp.json();
          AppState.data = newBoardData;
          saveToLocalStorage(newBoardData);
          renderFullBoard();
          document.getElementById('newMeetingModal').classList.remove('active');
          alert('¡Reunión procesada y actualizada con éxito!');
        } else {
          const err = await resp.json();
          alert('Error procesando audio: ' + (err.error || 'Error desconocido en el servidor'));
        }
      } catch (err) {
        alert('Error de conexión con el procesador de audio: ' + err.message);
      } finally {
        startBtn.disabled = false;
        if (progressBox) progressBox.classList.add('hidden');
      }
    });
  }
}

// Eventos de Importación JSON
function setupJsonImportEvents() {
  const applyBtn = document.getElementById('btnApplyJsonImport');
  const jsonInput = document.getElementById('jsonImportInput');
  const loadSampleBtn = document.getElementById('btnLoadSampleJson');

  if (loadSampleBtn && jsonInput) {
    loadSampleBtn.addEventListener('click', () => {
      jsonInput.value = JSON.stringify(AppState.data, null, 2);
    });
  }

  if (applyBtn && jsonInput) {
    applyBtn.addEventListener('click', async () => {
      const raw = jsonInput.value.trim();
      if (!raw) {
        alert('Por favor pega el código JSON.');
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed.areas || !Array.isArray(parsed.areas)) {
          throw new Error('El JSON debe contener un arreglo "areas" con Logística, Administración y TI.');
        }

        AppState.data = parsed;
        saveToLocalStorage(parsed);

        // Si el backend está disponible, enviar para persistir en archivo
        if (AppState.isConnectedToBackend) {
          try {
            await fetch('/api/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(parsed)
            });
          } catch (e) {
            console.warn('No se pudo sincronizar el nuevo JSON con el archivo del servidor:', e);
          }
        }

        renderFullBoard();
        document.getElementById('newMeetingModal').classList.remove('active');
        alert('¡Tablero actualizado correctamente con los nuevos datos!');
      } catch (err) {
        alert('JSON inválido o estructura incorrecta:\n' + err.message);
      }
    });
  }
}

// Celebración de Confeti al 100%
function triggerCelebrationConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

// Utilidad anti-XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
