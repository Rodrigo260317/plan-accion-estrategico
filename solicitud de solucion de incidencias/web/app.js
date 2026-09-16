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
  apiBaseUrl: ''
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

// Configuración de sincronización en la nube 24/7 (permite colaboración sin servidor local)
const CLOUD_SYNC_CONFIG = {
  enabled: true,
  apiUrl: 'https://api.restful-api.dev/objects/ff808181a09d98f701a0ac3bff4a209b',
  pollIntervalMs: 4000,
  githubPagesUrl: 'https://rodrigo260317.github.io/plan-accion-estrategico/'
};

let cloudPollTimer = null;
let isSyncingToCloud = false;

// ==========================================================================
// CONEXIÓN Y CARGA DE DATOS
// ==========================================================================
async function checkBackendConnection() {
  // 1. Verificar si hay un servidor Flask local corriendo
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/health', { method: 'GET', cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      AppState.isConnectedToBackend = true;
      AppState.isCloudSyncActive = false;
      updateSyncBadge(true, 'Servidor Local (En línea)');
      return;
    }
  } catch (err) {
    // No hay backend local, continuar a verificar la nube
  }

  // 2. Verificar sincronización en la nube 24/7 (para GitHub Pages y uso remoto sin PC encendida)
  try {
    const cloudRes = await fetch(CLOUD_SYNC_CONFIG.apiUrl, { method: 'GET', cache: 'no-store' });
    if (cloudRes.ok) {
      AppState.isConnectedToBackend = false;
      AppState.isCloudSyncActive = true;
      updateSyncBadge(true, 'En la Nube (Sincronizado 24/7)');
      startCloudSyncPolling();
      return;
    }
  } catch (cloudErr) {
    console.warn('No se pudo conectar con la API de sincronización en nube:', cloudErr);
  }

  // 3. Si todo falla, modo local navegador
  AppState.isConnectedToBackend = false;
  AppState.isCloudSyncActive = false;
  updateSyncBadge(false, 'Modo Local (Navegador)');
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

async function loadIncidentsData() {
  try {
    // 1. Intentar cargar desde el backend local si está activo
    if (AppState.isConnectedToBackend) {
      const response = await fetch('/api/data', { cache: 'no-store' });
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
      const fileResponse = await fetch('datos_incidencias.json', { cache: 'no-store' });
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

async function applyCloudSyncState(boardData) {
  try {
    const res = await fetch(CLOUD_SYNC_CONFIG.apiUrl, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return;
    const cloudObj = await res.json();
    const completedList = (cloudObj.data && cloudObj.data.completadas) ? cloudObj.data.completadas : [];
    
    if (boardData && boardData.areas) {
      boardData.areas.forEach(area => {
        area.tareas.forEach(task => {
          task.completada = completedList.includes(task.id);
        });
      });
    }
  } catch (e) {
    console.warn('Error al aplicar estado de la nube:', e);
  }
}

function startCloudSyncPolling() {
  if (cloudPollTimer) clearInterval(cloudPollTimer);
  cloudPollTimer = setInterval(async () => {
    if (!AppState.isCloudSyncActive || !AppState.data || !AppState.data.areas || isSyncingToCloud) return;
    try {
      const res = await fetch(CLOUD_SYNC_CONFIG.apiUrl, { method: 'GET', cache: 'no-store' });
      if (!res.ok) return;
      const cloudObj = await res.json();
      const completedList = (cloudObj.data && cloudObj.data.completadas) ? cloudObj.data.completadas : [];

      let hasChanges = false;
      AppState.data.areas.forEach(area => {
        area.tareas.forEach(task => {
          const shouldBeCompleted = completedList.includes(task.id);
          if (task.completada !== shouldBeCompleted) {
            task.completada = shouldBeCompleted;
            hasChanges = true;
            // Actualizar visualmente la tarjeta si existe en el DOM
            const card = document.getElementById(`card-${task.id}`);
            const chk = document.getElementById(`chk-${task.id}`);
            if (card) {
              if (shouldBeCompleted) card.classList.add('completed');
              else card.classList.remove('completed');
            }
            if (chk) chk.checked = shouldBeCompleted;
          }
        });
      });

      if (hasChanges) {
        renderProgressMetrics();
        saveToLocalStorage(AppState.data);
      }
    } catch (err) {
      // Error silencioso en sondeo periódico
    }
  }, CLOUD_SYNC_CONFIG.pollIntervalMs);
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
    try {
      await fetch('/api/task/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: areaId, task_id: taskId, completed: isChecked })
      });
    } catch (e) {
      console.error('Error sincronizando con backend:', e);
    }
  }

  // 5. Si la sincronización en la nube 24/7 está activa (para GitHub Pages y uso sin PC)
  if (AppState.isCloudSyncActive) {
    syncCompletedTasksToCloud();
  }
};

async function syncCompletedTasksToCloud() {
  if (!AppState.data || !AppState.data.areas) return;
  isSyncingToCloud = true;
  try {
    const completedIds = [];
    AppState.data.areas.forEach(a => {
      a.tareas.forEach(t => {
        if (t.completada) completedIds.push(t.id);
      });
    });

    await fetch(CLOUD_SYNC_CONFIG.apiUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tablero Incidencias Clinica JTB - Estado Colaborativo',
        data: {
          id_reunion: AppState.data.metadata ? AppState.data.metadata.id_reunion : 'reunion_quincenal',
          completadas: completedIds,
          ultima_actualizacion: new Date().toISOString(),
          actualizado_por: 'Colaborador'
        }
      })
    });
  } catch (err) {
    console.warn('Error al guardar en la nube 24/7:', err);
  } finally {
    setTimeout(() => { isSyncingToCloud = false; }, 600);
  }
}


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

  // 4. Toggle Panel de Estrategia e Innovaciones
  const toggleStrategyBtn = document.getElementById('toggleStrategyHubBtn');
  const strategyGrid = document.getElementById('strategyGrid');
  const strategyHubToggleText = document.getElementById('strategyHubToggleText');
  const strategyHubToggleIcon = document.getElementById('strategyHubToggleIcon');
  if (toggleStrategyBtn && strategyGrid) {
    toggleStrategyBtn.addEventListener('click', () => {
      const isCollapsed = strategyGrid.classList.toggle('collapsed');
      if (strategyHubToggleText) {
        strategyHubToggleText.textContent = isCollapsed ? 'Mostrar Panel' : 'Ocultar Panel';
      }
      if (strategyHubToggleIcon) {
        strategyHubToggleIcon.setAttribute('data-lucide', isCollapsed ? 'chevron-down' : 'chevron-up');
        initLucideIcons();
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
  document.getElementById('btnShareModal')?.addEventListener('click', () => {
    const urlInput = document.getElementById('shareUrlInput');
    if (urlInput) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        urlInput.value = CLOUD_SYNC_CONFIG.githubPagesUrl;
      } else {
        urlInput.value = window.location.href;
      }
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
