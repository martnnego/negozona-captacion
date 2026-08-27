import { supabase } from '../lib/supabase';
import { toast } from '../components/toast';
import { openAutomationHelpModal } from '../components/automation-help-modal';
import { renderAutomationDetail } from './automation-detail';
import { formatDate, formatDateTime } from '../utils/date-format';

export function renderAutomations() {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-6 animate-fade-in font-sans pb-12';

  wrapper.innerHTML = `
    <!-- Header Area -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xl">🤖</span>
          <h2 class="text-xl font-bold text-primary font-display">Automatizaciones</h2>
        </div>
        <p class="text-xs text-neutral-500 mt-1">Diseña y administra flujos automáticos de mensajes, esperas y transiciones de etapas.</p>
      </div>

      <div class="flex items-center gap-2.5 self-start sm:self-auto">
        <button id="btn-open-help-modal" class="px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-mono text-xs font-bold rounded-lg border border-neutral-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5">
          <span>ℹ️ ¿Cómo funciona?</span>
        </button>

        <button id="btn-new-automation" class="px-5 py-2.5 bg-primary hover:bg-neutral-900 text-white font-mono text-xs font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2">
          <span>+ Nueva Automatización</span>
        </button>
      </div>
    </div>

    <!-- KPI Summary Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="automations-kpi-bar">
      <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
        <span class="text-[10px] font-mono uppercase text-neutral-500">Automatizaciones</span>
        <strong class="text-2xl font-bold font-mono text-neutral-900" id="kpi-total-autos">0</strong>
        <span class="text-[10px] text-neutral-400">Total creadas</span>
      </div>

      <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
        <span class="text-[10px] font-mono uppercase text-emerald-600">Flujos Activos</span>
        <strong class="text-2xl font-bold font-mono text-emerald-600" id="kpi-active-autos">0</strong>
        <span class="text-[10px] text-emerald-500 font-mono">En funcionamiento</span>
      </div>

      <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
        <span class="text-[10px] font-mono uppercase text-blue-600">En Ejecución</span>
        <strong class="text-2xl font-bold font-mono text-blue-600" id="kpi-running-execs">0</strong>
        <span class="text-[10px] text-neutral-400">Contactos en proceso</span>
      </div>

      <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
        <span class="text-[10px] font-mono uppercase text-neutral-500">Ejecuciones Totales</span>
        <strong class="text-2xl font-bold font-mono text-neutral-900" id="kpi-total-execs">0</strong>
        <span class="text-[10px] text-neutral-400">Historial acumulado</span>
      </div>
    </div>

    <!-- Filters & Search Bar -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
      <!-- Search Input -->
      <div class="relative w-full sm:w-72">
        <span class="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none z-10">🔍</span>
        <input type="text" id="auto-search-input" class="cohere-input !pl-9 text-xs w-full" placeholder="Buscar por nombre o descripción..." />
      </div>

      <!-- Trigger & Status Filter Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-[10px] font-mono font-bold uppercase" id="auto-filter-tabs">
        <button class="filter-tab-btn px-3 py-1.5 rounded-md bg-neutral-900 text-white shadow-xs" data-filter="all">Todas</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="active">⚡ Activas</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="paused">⏸️ Inactivas</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="lead_created">📥 Lead Creado</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="contact_created">👤 Contacto Creado</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="lead_stage_changed">🗂️ Cambio Etapa</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="scheduled_once">📅 Puntual</button>
        <button class="filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-filter="scheduled_recurring">🔄 Recurrente</button>
      </div>
    </div>

    <!-- Automations Data Table -->
    <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-neutral-900 text-white font-mono text-[10px] uppercase tracking-wider border-b border-neutral-800">
              <th class="py-3 px-4">Automatización</th>
              <th class="py-3 px-4">Disparador</th>
              <th class="py-3 px-4">Pasos</th>
              <th class="py-3 px-4">Estado</th>
              <th class="py-3 px-4">Ejecuciones</th>
              <th class="py-3 px-4">Creado</th>
              <th class="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="automations-table-body" class="divide-y divide-neutral-200 text-xs font-medium">
            <tr>
              <td colspan="7" class="py-12 text-center text-neutral-400">
                <span class="animate-pulse">🔄 Cargando automatizaciones...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach help modal
  wrapper.querySelector('#btn-open-help-modal').addEventListener('click', openAutomationHelpModal);

  // Attach new automation creation
  wrapper.querySelector('#btn-new-automation').addEventListener('click', () => {
    openNewAutomationModal();
  });

  let allAutomations = [];
  let allStepsMap = new Map();
  let allExecsMap = new Map();
  let currentFilter = 'all';
  let searchQuery = '';

  // Attach search
  wrapper.querySelector('#auto-search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTableRows();
  });

  // Attach filter tabs
  wrapper.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrapper.querySelectorAll('.filter-tab-btn').forEach(b => {
        b.className = 'filter-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200';
      });
      btn.className = 'filter-tab-btn px-3 py-1.5 rounded-md bg-neutral-900 text-white shadow-xs';
      currentFilter = btn.dataset.filter;
      renderTableRows();
    });
  });

  loadAutomationsData();

  async function loadAutomationsData() {
    try {
      // 1. Fetch automations
      const { data: autos, error: autoErr } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: false });

      if (autoErr) throw autoErr;
      allAutomations = autos || [];

      // 2. Fetch steps counts
      const { data: stepsData } = await supabase
        .from('automation_steps')
        .select('id, automation_id');

      allStepsMap.clear();
      (stepsData || []).forEach(s => {
        const count = allStepsMap.get(s.automation_id) || 0;
        allStepsMap.set(s.automation_id, count + 1);
      });

      // 3. Fetch execution stats
      const { data: execsData } = await supabase
        .from('automation_executions')
        .select('id, automation_id, status');

      allExecsMap.clear();
      let runningCount = 0;
      let totalExecsCount = 0;

      (execsData || []).forEach(e => {
        totalExecsCount++;
        if (e.status === 'running' || e.status === 'waiting') runningCount++;
        
        const existing = allExecsMap.get(e.automation_id) || { total: 0, active: 0, completed: 0, failed: 0 };
        existing.total++;
        if (e.status === 'running' || e.status === 'waiting') existing.active++;
        if (e.status === 'completed') existing.completed++;
        if (e.status === 'failed') existing.failed++;
        allExecsMap.set(e.automation_id, existing);
      });

      // Update KPI Tiles
      wrapper.querySelector('#kpi-total-autos').textContent = allAutomations.length;
      wrapper.querySelector('#kpi-active-autos').textContent = allAutomations.filter(a => a.is_active).length;
      wrapper.querySelector('#kpi-running-execs').textContent = runningCount;
      wrapper.querySelector('#kpi-total-execs').textContent = totalExecsCount;

      renderTableRows();

    } catch (err) {
      wrapper.querySelector('#automations-table-body').innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-rose-500 text-xs">
            ⚠️ Error al cargar automatizaciones: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  function renderTableRows() {
    const tbody = wrapper.querySelector('#automations-table-body');

    const filtered = allAutomations.filter(a => {
      if (currentFilter === 'active' && !a.is_active) return false;
      if (currentFilter === 'paused' && a.is_active) return false;
      if (['lead_created', 'contact_created', 'lead_stage_changed'].includes(currentFilter) && a.trigger_type !== currentFilter) return false;

      if (searchQuery) {
        const name = (a.name || '').toLowerCase();
        const desc = (a.description || '').toLowerCase();
        if (!name.includes(searchQuery) && !desc.includes(searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-neutral-400 font-mono text-xs">
            ${allAutomations.length === 0 ? `
              <div class="flex flex-col items-center gap-2">
                <span class="text-2xl">🤖</span>
                <span class="font-bold text-neutral-700">No hay automatizaciones creadas todavía</span>
                <p class="text-[11px] text-neutral-500">Crea tu primer flujo para automatizar envíos de WhatsApp, emails y cambios de etapa.</p>
                <button id="btn-empty-create" class="mt-2 px-4 py-2 bg-primary hover:bg-neutral-900 text-white rounded-lg font-mono text-xs font-bold uppercase transition-colors cursor-pointer">
                  + Crear Primera Automatización
                </button>
              </div>
            ` : 'No se encontraron automatizaciones que coincidan con la búsqueda.'}
          </td>
        </tr>
      `;

      const emptyBtn = tbody.querySelector('#btn-empty-create');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openNewAutomationModal());
      return;
    }

    const triggerBadges = {
      lead_created: '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">📥 Lead Creado</span>',
      contact_created: '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">👤 Contacto Creado</span>',
      lead_stage_changed: '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">🗂️ Cambio de Etapa</span>',
      scheduled_once: '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">📅 Ejecución Puntual</span>',
      scheduled_recurring: '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🔄 Recurrente</span>'
    };

    tbody.innerHTML = filtered.map(a => {
      const stepsCount = allStepsMap.get(a.id) || 0;
      const execStats = allExecsMap.get(a.id) || { total: 0, active: 0, completed: 0, failed: 0 };

      return `
        <tr class="hover:bg-neutral-50/80 transition-colors">
          <!-- Name & Description -->
          <td class="py-3 px-4">
            <div class="font-bold text-neutral-900 hover:text-primary cursor-pointer btn-enter-detail" data-id="${a.id}">
              ${a.name}
            </div>
            ${a.description ? `<div class="text-[11px] text-neutral-500 truncate max-w-xs">${a.description}</div>` : ''}
          </td>

          <!-- Trigger -->
          <td class="py-3 px-4">
            ${triggerBadges[a.trigger_type] || a.trigger_type}
          </td>

          <!-- Steps count -->
          <td class="py-3 px-4 font-mono text-[11px]">
            <span class="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 font-bold">
              ${stepsCount} ${stepsCount === 1 ? 'paso' : 'pasos'}
            </span>
          </td>

          <!-- Active Switch -->
          <td class="py-3 px-4">
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer switch-row-active" data-id="${a.id}" ${a.is_active ? 'checked' : ''}>
              <div class="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </td>

          <!-- Executions Counters -->
          <td class="py-3 px-4 font-mono text-[11px]">
            <div class="flex items-center gap-2">
              <strong class="text-neutral-900">${execStats.total}</strong>
              ${execStats.active > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-100 text-blue-700 font-bold animate-pulse">${execStats.active} act.</span>` : ''}
              ${execStats.failed > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-700 font-bold">${execStats.failed} err</span>` : ''}
            </div>
          </td>

          <!-- Created Date -->
          <td class="py-3 px-4 font-mono text-[11px] text-neutral-500">
            ${formatDateTime(a.created_at)}
          </td>

          <!-- Actions -->
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button class="px-3 py-1 bg-primary hover:bg-neutral-900 text-white rounded-md text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer btn-enter-detail" data-id="${a.id}">
                Ver / Editar →
              </button>
              <button class="w-7 h-7 rounded-md hover:bg-neutral-100 text-neutral-500 flex items-center justify-center text-xs transition-colors cursor-pointer btn-duplicate-auto" data-id="${a.id}" title="Duplicar automatización">
                📋
              </button>
              <button class="w-7 h-7 rounded-md hover:bg-rose-50 text-neutral-400 hover:text-rose-600 flex items-center justify-center text-xs transition-colors cursor-pointer btn-delete-auto" data-id="${a.id}" title="Eliminar">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Enter detail handlers
    tbody.querySelectorAll('.btn-enter-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.hash = `#automation-detail?id=${id}`;
      });
    });

    // Toggle active switch
    tbody.querySelectorAll('.switch-row-active').forEach(sw => {
      sw.addEventListener('change', async (e) => {
        const id = sw.dataset.id;
        const isChecked = e.target.checked;
        try {
          await supabase.from('automations').update({
            is_active: isChecked,
            status: isChecked ? 'active' : 'paused',
            updated_at: new Date().toISOString()
          }).eq('id', id);

          toast.show(isChecked ? 'Automatización activada' : 'Automatización pausada', 'info');
          const auto = allAutomations.find(a => a.id === id);
          if (auto) {
            auto.is_active = isChecked;
            auto.status = isChecked ? 'active' : 'paused';
          }
          wrapper.querySelector('#kpi-active-autos').textContent = allAutomations.filter(a => a.is_active).length;
        } catch (err) {
          toast.show('Error al cambiar estado: ' + err.message, 'error');
          sw.checked = !isChecked;
        }
      });
    });

    // Duplicate automation handler
    tbody.querySelectorAll('.btn-duplicate-auto').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const target = allAutomations.find(a => a.id === id);
        if (!target) return;

        try {
          toast.show('Duplicando automatización...', 'info');

          // 1. Insert duplicated automation
          const { data: newAuto, error: dupErr } = await supabase.from('automations').insert({
            name: `${target.name} (Copia)`,
            description: target.description,
            trigger_type: target.trigger_type,
            trigger_config: target.trigger_config,
            is_active: false,
            status: 'draft',
            allow_reentry: target.allow_reentry
          }).select().single();

          if (dupErr) throw dupErr;

          // 2. Fetch target steps
          const { data: origSteps } = await supabase
            .from('automation_steps')
            .select('*')
            .eq('automation_id', id)
            .order('step_order', { ascending: true });

          if (origSteps && origSteps.length > 0) {
            const stepsToInsert = origSteps.map(s => ({
              automation_id: newAuto.id,
              step_order: s.step_order,
              step_type: s.step_type,
              name: s.name,
              config: s.config
            }));
            await supabase.from('automation_steps').insert(stepsToInsert);
          }

          toast.show('Automatización duplicada con éxito', 'success');
          await loadAutomationsData();
        } catch (err) {
          toast.show('Error al duplicar: ' + err.message, 'error');
        }
      });
    });

    // Delete automation handler
    tbody.querySelectorAll('.btn-delete-auto').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const target = allAutomations.find(a => a.id === id);
        if (!target) return;

        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la automatización "${target.name}"? Se borrarán sus pasos e historial.`)) {
          try {
            await supabase.from('automations').delete().eq('id', id);
            toast.show('Automatización eliminada', 'info');
            await loadAutomationsData();
          } catch (err) {
            toast.show('Error al eliminar: ' + err.message, 'error');
          }
        }
      });
    });
  }

  // Modal to create new automation
  function openNewAutomationModal() {
    const existing = document.getElementById('modal-new-auto-container');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-new-auto-container';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans';

    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-scale-up">
        <div class="px-6 py-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🤖</span>
            <div>
              <h3 class="text-sm font-bold font-display text-neutral-900">Nueva Automatización</h3>
              <p class="text-[11px] text-neutral-500">Define el nombre y el evento que iniciará el flujo</p>
            </div>
          </div>
          <button id="btn-close-new-auto-modal" class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer font-mono">
            ✕
          </button>
        </div>

        <div class="p-6 space-y-4 text-xs">
          <div>
            <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Nombre del Flujo</label>
            <input type="text" id="new-auto-name" class="cohere-input text-xs w-full" placeholder="Ej: Bienvenida y Catálogo a Nuevos Leads" />
          </div>

          <div>
            <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Descripción (Opcional)</label>
            <textarea id="new-auto-desc" rows="2" class="cohere-input text-xs w-full" placeholder="Envía un WhatsApp de bienvenida, espera 10 minutos y envía un correo con el catálogo..."></textarea>
          </div>

          <div>
            <label class="block font-bold text-neutral-700 mb-1.5 font-mono text-[10px] uppercase tracking-wider">Disparador de Inicio (Trigger)</label>
            <div class="grid grid-cols-1 gap-2" id="new-auto-trigger-options">
              <label class="p-3 rounded-xl border border-primary bg-primary/5 text-primary flex items-start gap-3 cursor-pointer">
                <input type="radio" name="new_trigger" value="lead_created" checked class="mt-0.5 text-primary">
                <div>
                  <strong class="block font-bold text-neutral-900">📥 Lead Creado</strong>
                  <span class="text-[11px] text-neutral-500">Se dispara automáticamente cuando entra un nuevo lead al CRM.</span>
                </div>
              </label>

              <label class="p-3 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-start gap-3 cursor-pointer">
                <input type="radio" name="new_trigger" value="contact_created" class="mt-0.5 text-primary">
                <div>
                  <strong class="block font-bold text-neutral-900">👤 Contacto Creado</strong>
                  <span class="text-[11px] text-neutral-500">Se activa cuando se agrega una nueva persona con datos de contacto.</span>
                </div>
              </label>

              <label class="p-3 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-start gap-3 cursor-pointer">
                <input type="radio" name="new_trigger" value="lead_stage_changed" class="mt-0.5 text-primary">
                <div>
                  <strong class="block font-bold text-neutral-900">🗂️ Cambio de Etapa de Pipeline</strong>
                  <span class="text-[11px] text-neutral-500">Se activa cuando un lead es movido en el embudo comercial.</span>
                </div>
              </label>

              <label class="p-3 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-start gap-3 cursor-pointer">
                <input type="radio" name="new_trigger" value="scheduled_once" class="mt-0.5 text-primary">
                <div>
                  <strong class="block font-bold text-neutral-900">📅 Ejecución Puntual (Programada)</strong>
                  <span class="text-[11px] text-neutral-500">Se ejecuta una sola vez en una fecha y hora específica para los contactos del segmento.</span>
                </div>
              </label>

              <label class="p-3 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-start gap-3 cursor-pointer">
                <input type="radio" name="new_trigger" value="scheduled_recurring" class="mt-0.5 text-primary">
                <div>
                  <strong class="block font-bold text-neutral-900">🔄 Ejecución Recurrente</strong>
                  <span class="text-[11px] text-neutral-500">Se ejecuta de forma periódica con intervalo configurable (días, semanas, etc.).</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <button id="btn-cancel-new-auto" class="px-4 py-2 text-xs font-mono font-bold text-neutral-600 hover:text-neutral-900 cursor-pointer">
            Cancelar
          </button>
          <button id="btn-submit-new-auto" class="px-6 py-2.5 bg-primary hover:bg-neutral-900 text-white font-mono text-xs font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2">
            <span>Crear y Abrir Editor →</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btn-close-new-auto-modal').addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-new-auto').addEventListener('click', closeModal);

    // Trigger visual selection
    modal.querySelectorAll('input[name="new_trigger"]').forEach(radio => {
      radio.addEventListener('change', () => {
        modal.querySelectorAll('label').forEach(lbl => {
          lbl.className = 'p-3 rounded-xl border border-neutral-200 hover:border-neutral-300 flex items-start gap-3 cursor-pointer';
        });
        radio.closest('label').className = 'p-3 rounded-xl border border-primary bg-primary/5 text-primary flex items-start gap-3 cursor-pointer';
      });
    });

    modal.querySelector('#btn-submit-new-auto').addEventListener('click', async () => {
      const name = modal.querySelector('#new-auto-name').value.trim();
      const desc = modal.querySelector('#new-auto-desc').value.trim();
      const trigger = modal.querySelector('input[name="new_trigger"]:checked')?.value || 'lead_created';

      if (!name) {
        toast.show('Por favor ingresa un nombre para la automatización', 'error');
        return;
      }

      try {
        const { data: newAuto, error: createErr } = await supabase.from('automations').insert({
          name,
          description: desc,
          trigger_type: trigger,
          trigger_config: {},
          is_active: false,
          status: 'draft',
          allow_reentry: false
        }).select().single();

        if (createErr) throw createErr;

        closeModal();
        toast.show('Automatización creada', 'success');

        window.location.hash = `#automation-detail?id=${newAuto.id}`;

      } catch (e) {
        toast.show('Error al crear automatización: ' + e.message, 'error');
      }
    });
  }

  return wrapper;
}
