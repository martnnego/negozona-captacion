import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { toast } from '../components/toast';
import { openAutomationHelpModal } from '../components/automation-help-modal';
import { openAutomationStepDrawer } from '../components/automation-step-drawer';
import { openAutomationExecutionDrawer } from '../components/automation-execution-drawer';
import { createAudienceSegmenter } from '../components/automation-audience-segmenter';
import { renderAutomations } from './automations';
import { formatDate, formatDateTime, toLocalDateTimeInputValue } from '../utils/date-format';

export async function renderAutomationDetail(automationId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-6 animate-fade-in font-sans pb-12';

  wrapper.innerHTML = `
    <!-- Top Back Navigation & Help -->
    <div class="flex items-center justify-between border-b border-neutral-200 pb-3">
      <button id="btn-back-automations" class="text-xs font-mono font-bold text-neutral-600 hover:text-primary cursor-pointer flex items-center gap-1.5 transition-colors">
        ← Volver a Automatizaciones
      </button>

      <div class="flex items-center gap-3">
        <button id="btn-show-help" class="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-mono font-bold rounded-lg border border-neutral-200 cursor-pointer flex items-center gap-1.5 transition-colors">
          <span>ℹ️ ¿Cómo funciona?</span>
        </button>

        <button id="btn-save-flow" class="px-4 py-1.5 bg-primary hover:bg-neutral-900 text-white text-xs font-mono font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2">
          <span>💾 Guardar Cambios</span>
        </button>
      </div>
    </div>

    <!-- Automation Header Card -->
    <div class="bg-neutral-900 text-white p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md border border-neutral-800">
      <div class="flex flex-col gap-2 max-w-xl">
        <div class="flex items-center gap-3 flex-wrap">
          <input type="text" id="auto-name-input" class="bg-transparent border-b border-neutral-700 hover:border-neutral-500 focus:border-white text-xl font-bold font-display text-white px-1 py-0.5 outline-none transition-colors w-full sm:w-auto" value="Cargando..." />
          <span id="auto-status-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-800 text-neutral-300">...</span>
        </div>
        <input type="text" id="auto-desc-input" class="bg-transparent text-xs text-neutral-400 border-b border-transparent hover:border-neutral-800 focus:border-neutral-700 px-1 py-0.5 outline-none w-full" placeholder="Añade una descripción sobre este flujo..." />
      </div>

      <div class="flex items-center gap-6 border-t md:border-t-0 md:border-l border-neutral-800 pt-4 md:pt-0 md:pl-6 text-xs font-mono shrink-0">
        <!-- Active Switch -->
        <div class="flex flex-col gap-1 items-start">
          <span class="text-[9px] text-neutral-400 uppercase">Estado del Flujo</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="switch-is-active" class="sr-only peer">
            <div class="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span id="switch-label" class="ml-2 text-xs font-bold font-mono text-neutral-300">Inactiva</span>
          </label>
        </div>

        <!-- Re-entry Toggle -->
        <div class="flex flex-col gap-1 items-start" title="Si está activado, un mismo contacto o lead podrá ingresar y ejecutar este flujo nuevamente cada vez que se dispare el evento. Si está desactivado, solo se ejecutará una única vez por contacto.">
          <div class="flex items-center gap-1">
            <span class="text-[9px] text-neutral-400 uppercase">Reingreso</span>
            <span class="text-[10px] text-neutral-400 cursor-help" title="Si está activado, un mismo contacto o lead podrá ingresar y ejecutar este flujo nuevamente cada vez que se dispare el evento. Si está desactivado, solo se ejecutará una única vez por contacto.">ℹ️</span>
          </div>
          <label class="flex items-center gap-2 cursor-pointer" title="Permitir que un contacto vuelva a entrar al flujo si ocurre el disparador más de una vez">
            <input type="checkbox" id="check-allow-reentry" class="rounded border-neutral-700 text-primary focus:ring-0 cursor-pointer">
            <span class="text-xs text-neutral-300 select-none">Permitir reingreso</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 3 Tabs Navigation Bar -->
    <div class="flex items-center gap-1 border-b border-neutral-200 overflow-x-auto text-xs font-mono font-bold uppercase">
      <button class="auto-tab px-5 py-3 border-b-2 border-primary text-primary flex items-center gap-2 cursor-pointer" data-tab="flow">
        <span>⚡ Flujo</span>
        <span id="tab-steps-count" class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full">0</span>
      </button>
      <button class="auto-tab px-5 py-3 text-neutral-500 hover:text-primary flex items-center gap-2 border-b-2 border-transparent cursor-pointer" data-tab="executions">
        <span>👥 Ejecuciones</span>
        <span id="tab-execs-count" class="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full">0</span>
      </button>
      <button class="auto-tab px-5 py-3 text-neutral-500 hover:text-primary flex items-center gap-2 border-b-2 border-transparent cursor-pointer" data-tab="stats">
        <span>📊 Estadísticas</span>
      </button>
    </div>

    <!-- Tab Content Container -->
    <div id="tab-content" class="min-h-[400px]">
      <div class="py-16 text-center text-neutral-400 font-mono text-xs animate-pulse">
        🔄 Cargando detalle de la automatización...
      </div>
    </div>
  `;

  // Back button
  wrapper.querySelector('#btn-back-automations').addEventListener('click', () => {
    if (window.location.hash === '#automations') {
      const view = renderAutomations();
      wrapper.replaceWith(view);
    } else {
      window.location.hash = '#automations';
    }
  });

  // Help modal
  wrapper.querySelector('#btn-show-help').addEventListener('click', openAutomationHelpModal);

  let automation = null;
  let steps = [];
  let executions = [];
  let currentTab = 'flow';
  let isDirty = false;
  let isTriggerCollapsed = false;

  // Tab switching
  wrapper.querySelectorAll('.auto-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      wrapper.querySelectorAll('.auto-tab').forEach(b => {
        b.className = 'auto-tab px-5 py-3 text-neutral-500 hover:text-primary flex items-center gap-2 border-b-2 border-transparent cursor-pointer';
      });
      btn.className = 'auto-tab px-5 py-3 border-b-2 border-primary text-primary flex items-center gap-2 cursor-pointer';
      currentTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  await loadAutomationData();

  // Save changes button
  wrapper.querySelector('#btn-save-flow').addEventListener('click', async () => {
    await saveAutomationFlow();
  });

  // Active switch change
  wrapper.querySelector('#switch-is-active').addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    wrapper.querySelector('#switch-label').textContent = isChecked ? 'Activa' : 'Inactiva';
    wrapper.querySelector('#switch-label').className = isChecked ? 'ml-2 text-xs font-bold font-mono text-emerald-400' : 'ml-2 text-xs font-bold font-mono text-neutral-300';
    
    if (automation) {
      automation.is_active = isChecked;
      automation.status = isChecked ? 'active' : 'paused';
      await supabase.from('automations').update({
        is_active: isChecked,
        status: isChecked ? 'active' : 'paused',
        updated_at: new Date().toISOString()
      }).eq('id', automation.id);
      toast.show(isChecked ? 'Automatización activada' : 'Automatización pausada', 'info');
      updateHeaderBadges();
    }
  });

  // Re-entry checkbox change
  wrapper.querySelector('#check-allow-reentry').addEventListener('change', (e) => {
    if (automation) {
      automation.allow_reentry = e.target.checked;
      isDirty = true;
    }
  });

  // Name & desc input changes
  wrapper.querySelector('#auto-name-input').addEventListener('input', (e) => {
    if (automation) {
      automation.name = e.target.value;
      isDirty = true;
    }
  });
  wrapper.querySelector('#auto-desc-input').addEventListener('input', (e) => {
    if (automation) {
      automation.description = e.target.value;
      isDirty = true;
    }
  });

  async function loadAutomationData() {
    try {
      // 1. Fetch automation
      const { data: autoData, error: autoErr } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .single();

      if (autoErr || !autoData) throw new Error(autoErr?.message || 'Automatización no encontrada');
      automation = autoData;

      // 2. Fetch steps
      const { data: stepData } = await supabase
        .from('automation_steps')
        .select('*')
        .eq('automation_id', automationId)
        .order('step_order', { ascending: true });

      steps = stepData || [];

      // 3. Fetch executions count & list
      const { data: execData } = await supabase
        .from('automation_executions')
        .select(`
          *,
          leads(company, source),
          contacts(first_name, last_name, phone, email)
        `)
        .eq('automation_id', automationId)
        .order('created_at', { ascending: false });

      executions = execData || [];

      populateHeaderData();
      renderActiveTab();

    } catch (err) {
      wrapper.querySelector('#tab-content').innerHTML = `
        <div class="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          ⚠️ Error al cargar automatización: ${err.message}
        </div>
      `;
    }
  }

  function populateHeaderData() {
    wrapper.querySelector('#auto-name-input').value = automation.name || 'Sin título';
    wrapper.querySelector('#auto-desc-input').value = automation.description || '';
    
    const switchElem = wrapper.querySelector('#switch-is-active');
    const switchLabel = wrapper.querySelector('#switch-label');
    switchElem.checked = !!automation.is_active;
    switchLabel.textContent = automation.is_active ? 'Activa' : 'Inactiva';
    switchLabel.className = automation.is_active ? 'ml-2 text-xs font-bold font-mono text-emerald-400' : 'ml-2 text-xs font-bold font-mono text-neutral-300';

    wrapper.querySelector('#check-allow-reentry').checked = !!automation.allow_reentry;

    wrapper.querySelector('#tab-steps-count').textContent = steps.length;
    wrapper.querySelector('#tab-execs-count').textContent = executions.length;

    updateHeaderBadges();
  }

  function updateHeaderBadges() {
    const badge = wrapper.querySelector('#auto-status-badge');
    if (automation.is_active) {
      badge.textContent = '⚡ ACTIVA';
      badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      badge.textContent = '⏸️ INACTIVA';
      badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-800 text-neutral-400 border border-neutral-700';
    }
  }

  function renderActiveTab() {
    const container = wrapper.querySelector('#tab-content');

    if (currentTab === 'flow') {
      renderFlowTab(container);
    } else if (currentTab === 'executions') {
      renderExecutionsTab(container);
    } else if (currentTab === 'stats') {
      renderStatsTab(container);
    }
  }

  // Helper to validate flow duration against recurrence interval
  function checkFlowDurationVsRecurrence(stepsList, currentAutomation) {
    let totalDelayMinutes = 0;
    stepsList.forEach(s => {
      if (s.step_type === 'delay' && s.config) {
        const dur = parseInt(s.config.duration, 10) || 0;
        const unit = s.config.unit || 'minutes';
        if (unit === 'minutes') totalDelayMinutes += dur;
        else if (unit === 'hours') totalDelayMinutes += dur * 60;
        else if (unit === 'days') totalDelayMinutes += dur * 1440;
      }
    });

    let recurrenceIntervalMinutes = null;
    if (currentAutomation.trigger_type === 'scheduled_recurring') {
      const rc = currentAutomation.recurrence_config || {};
      const freqVal = parseInt(rc.frequency_value, 10) || 1;
      const freqUnit = rc.frequency_unit || 'days';
      if (freqUnit === 'minutes') recurrenceIntervalMinutes = freqVal;
      else if (freqUnit === 'hours') recurrenceIntervalMinutes = freqVal * 60;
      else if (freqUnit === 'days') recurrenceIntervalMinutes = freqVal * 1440;
      else if (freqUnit === 'weeks') recurrenceIntervalMinutes = freqVal * 10080;
      else if (freqUnit === 'months') recurrenceIntervalMinutes = freqVal * 43200;
    }

    const hasOverlap = recurrenceIntervalMinutes !== null && totalDelayMinutes >= recurrenceIntervalMinutes;

    return {
      totalDelayMinutes,
      recurrenceIntervalMinutes,
      hasOverlap
    };
  }

  function formatMinutesHuman(mins) {
    if (mins === 0) return '0 min';
    if (mins < 60) return `${mins} min`;
    if (mins < 1440) {
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `${hrs} h ${rem} min` : `${hrs} h`;
    }
    const days = Math.floor(mins / 1440);
    const remHrs = Math.floor((mins % 1440) / 60);
    return remHrs > 0 ? `${days} d ${remHrs} h` : `${days} día(s)`;
  }

  // ==========================================
  // TAB 1: FLUJO (EDITOR VISUAL VERTICAL)
  // ==========================================
  function renderFlowTab(container) {
    const triggerLabels = {
      lead_created: { title: 'Lead Creado', icon: '📥', desc: 'Se activa automáticamente al ingresar un nuevo lead' },
      contact_created: { title: 'Contacto Creado', icon: '👤', desc: 'Se activa cuando se crea o asocia un nuevo contacto' },
      lead_stage_changed: { title: 'Cambio de Etapa', icon: '🗂️', desc: 'Se activa cuando un lead cambia de fase en el pipeline' },
      scheduled_once: { title: 'Ejecución Puntual', icon: '📅', desc: 'Se ejecuta una única vez en la fecha y hora seleccionada (Hora Argentina UTC-3)' },
      scheduled_recurring: { title: 'Ejecución Recurrente', icon: '🔄', desc: 'Se repite periódicamente según el intervalo programado' }
    };

    const currentTrigger = triggerLabels[automation.trigger_type] || triggerLabels.lead_created;
    const stages = cache.getStages() || [];
    const durCheck = checkFlowDurationVsRecurrence(steps, automation);

    // Ensure recurrence config defaults
    if (!automation.recurrence_config) {
      automation.recurrence_config = {
        frequency_value: 1,
        frequency_unit: 'days',
        start_date: new Date().toISOString(),
        end_type: 'never',
        max_iterations: 5
      };
    }

    container.innerHTML = `
      <div class="max-w-2xl mx-auto flex flex-col items-center gap-0 py-6 animate-fade-in">
        
        <!-- Overlap Alert Banner if Invalid -->
        ${durCheck.hasOverlap ? `
          <div class="w-full mb-4 p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl text-rose-900 shadow-sm flex items-start gap-3 animate-fade-in">
            <span class="text-2xl shrink-0">⚠️</span>
            <div class="space-y-1">
              <strong class="font-bold text-sm block text-rose-950">Restricción de Solapamiento Detectada</strong>
              <p class="text-xs text-rose-800 leading-relaxed">
                La suma de esperas del flujo (<strong>${formatMinutesHuman(durCheck.totalDelayMinutes)}</strong>) es <strong>mayor o igual</strong> al intervalo de repetición programado (<strong>${formatMinutesHuman(durCheck.recurrenceIntervalMinutes)}</strong>).
              </p>
              <p class="text-[11px] text-rose-700 font-medium">
                👉 Para evitar ejecuciones concurrentes simultáneas sobre los mismos contactos, debes reducir la duración de las esperas (delays) o aumentar el intervalo de repetición.
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Trigger Node Card -->
        <div class="w-full bg-white border-2 border-emerald-500 rounded-2xl p-5 shadow-sm relative group hover:shadow-md transition-all space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold shrink-0">
                ${currentTrigger.icon}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[10px] font-mono font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Disparador de Inicio</span>
                  <span class="text-xs font-bold text-neutral-800">${currentTrigger.title}</span>
                  ${isTriggerCollapsed ? `
                    <span class="text-[9px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                      🎯 ${automation.audience_type === 'all' ? 'Todos los contactos' : (automation.audience_type === 'static_segment' ? 'Segmento Estático' : 'Segmento Dinámico')}
                    </span>
                  ` : ''}
                </div>
                <p class="text-[11px] text-neutral-500 mt-0.5">${currentTrigger.desc}</p>
              </div>
            </div>

            <!-- Trigger Type Select & Collapse Toggle -->
            <div class="flex items-center gap-2 shrink-0">
              <select id="select-flow-trigger" class="cohere-select text-xs font-mono font-bold">
                <option value="lead_created" ${automation.trigger_type === 'lead_created' ? 'selected' : ''}>📥 Lead Creado</option>
                <option value="contact_created" ${automation.trigger_type === 'contact_created' ? 'selected' : ''}>👤 Contacto Creado</option>
                <option value="lead_stage_changed" ${automation.trigger_type === 'lead_stage_changed' ? 'selected' : ''}>🗂️ Cambio de Etapa</option>
                <option value="scheduled_once" ${automation.trigger_type === 'scheduled_once' ? 'selected' : ''}>📅 Ejecución Puntual</option>
                <option value="scheduled_recurring" ${automation.trigger_type === 'scheduled_recurring' ? 'selected' : ''}>🔄 Ejecución Recurrente</option>
              </select>

              <button type="button" id="btn-toggle-trigger-collapse" class="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[10px] font-mono font-bold rounded-lg border border-neutral-200 cursor-pointer transition-colors shadow-2xs flex items-center gap-1" title="${isTriggerCollapsed ? 'Desplegar configuración de disparador y audiencia' : 'Plegar configuración'}">
                <span>${isTriggerCollapsed ? '▼ Desplegar' : '▲ Plegar'}</span>
              </button>
            </div>
          </div>

          <!-- Collapsible Body Container (Forms & Audience Segmenter) -->
          <div id="trigger-collapsible-body" class="${isTriggerCollapsed ? 'hidden' : 'space-y-4'}">
            <!-- Trigger Specific Config: Stage Change -->
            ${automation.trigger_type === 'lead_stage_changed' ? `
              <div class="pt-3 border-t border-neutral-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label class="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Desde Etapa:</label>
                  <select id="trigger-from-stage" class="cohere-select text-xs w-full">
                    <option value="">(Cualquier etapa)</option>
                    ${stages.map(s => `<option value="${s.id}" ${automation.trigger_config?.from_stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block text-[9px] font-mono uppercase text-neutral-400 mb-1">Hacia Etapa:</label>
                  <select id="trigger-to-stage" class="cohere-select text-xs w-full">
                    <option value="">(Cualquier etapa)</option>
                    ${stages.map(s => `<option value="${s.id}" ${automation.trigger_config?.to_stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                  </select>
                </div>
              </div>
            ` : ''}

            <!-- Trigger Specific Config: Scheduled Once (Ejecución Puntual) -->
            ${automation.trigger_type === 'scheduled_once' ? `
              <div class="pt-3 border-t border-neutral-100 space-y-3">
                <div class="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                  <label class="block text-[10px] font-mono font-bold uppercase text-blue-900">
                    📅 Fecha y Hora de Ejecución (Hora Argentina - UTC-3) *
                  </label>
                  <input type="datetime-local" id="input-scheduled-at" class="cohere-input text-xs w-full font-mono bg-white" value="${toLocalDateTimeInputValue(automation.scheduled_at)}" />
                  <p class="text-[10px] text-blue-700">
                    ℹ️ Al llegar esta fecha y hora, se creará una ejecución individual para cada contacto del segmento seleccionado y luego la automatización finalizará.
                  </p>
                </div>
              </div>
            ` : ''}

            <!-- Trigger Specific Config: Scheduled Recurring (Ejecución Recurrente) -->
            ${automation.trigger_type === 'scheduled_recurring' ? `
              <div class="pt-3 border-t border-neutral-100 space-y-3">
                <div class="p-4 bg-purple-50/60 border border-purple-200 rounded-xl space-y-3">
                  <label class="block text-[10px] font-mono font-bold uppercase text-purple-950">
                    🔄 Programación de Frecuencia y Repetición
                  </label>

                  <!-- Frequency -->
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-1 font-bold">Repetir cada:</label>
                      <input type="number" id="input-recurrence-val" min="1" max="365" class="cohere-input text-xs w-full bg-white font-mono" value="${automation.recurrence_config?.frequency_value || 1}" />
                    </div>
                    <div>
                      <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-1 font-bold">Unidad:</label>
                      <select id="select-recurrence-unit" class="cohere-select text-xs w-full bg-white">
                        <option value="minutes" ${automation.recurrence_config?.frequency_unit === 'minutes' ? 'selected' : ''}>Minutos</option>
                        <option value="hours" ${automation.recurrence_config?.frequency_unit === 'hours' ? 'selected' : ''}>Horas</option>
                        <option value="days" ${automation.recurrence_config?.frequency_unit === 'days' ? 'selected' : ''}>Días</option>
                        <option value="weeks" ${automation.recurrence_config?.frequency_unit === 'weeks' ? 'selected' : ''}>Semanas</option>
                        <option value="months" ${automation.recurrence_config?.frequency_unit === 'months' ? 'selected' : ''}>Meses</option>
                      </select>
                    </div>
                  </div>

                  <!-- Start Date -->
                  <div>
                    <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-1 font-bold">Comenzar el (Hora Argentina):</label>
                    <input type="datetime-local" id="input-recurrence-start" class="cohere-input text-xs w-full bg-white font-mono" value="${toLocalDateTimeInputValue(automation.recurrence_config?.start_date || automation.next_run_at)}" />
                  </div>

                  <!-- End Conditions -->
                  <div class="space-y-1.5 pt-2 border-t border-purple-200/60">
                    <label class="block text-[9px] font-mono uppercase text-neutral-500 font-bold">Finalización:</label>
                    
                    <div class="space-y-1.5 text-xs text-neutral-800">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="rec_end_type" value="never" ${(!automation.recurrence_config?.end_type || automation.recurrence_config?.end_type === 'never') ? 'checked' : ''} class="accent-primary" />
                        <span>Indefinido (sin límite de repeticiones)</span>
                      </label>

                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="rec_end_type" value="after_iterations" ${automation.recurrence_config?.end_type === 'after_iterations' ? 'checked' : ''} class="accent-primary" />
                        <span>Finalizar tras</span>
                        <input type="number" id="input-rec-max-iter" min="1" max="1000" class="cohere-input text-xs w-16 bg-white py-0.5 text-center font-mono" value="${automation.recurrence_config?.max_iterations || 5}" />
                        <span>repeticiones</span>
                      </label>

                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="rec_end_type" value="on_date" ${automation.recurrence_config?.end_type === 'on_date' ? 'checked' : ''} class="accent-primary" />
                        <span>Finalizar en fecha límite:</span>
                        <input type="datetime-local" id="input-rec-end-date" class="cohere-input text-xs bg-white py-0.5 font-mono" value="${toLocalDateTimeInputValue(automation.recurrence_config?.end_date)}" />
                      </label>
                    </div>
                  </div>

                  <!-- Timing & Duration Info Pill -->
                  <div class="pt-2 border-t border-purple-200/60 flex items-center justify-between text-[10px] font-mono">
                    <span class="text-neutral-500">Duración esperas del flujo: <strong>${formatMinutesHuman(durCheck.totalDelayMinutes)}</strong></span>
                    <span class="${durCheck.hasOverlap ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}">
                      ${durCheck.hasOverlap ? '❌ Conflicto de Solapamiento' : '✓ Intervalo Válido'}
                    </span>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Audience Segmenter Container -->
            <div id="trigger-audience-segmenter-container" class="pt-2"></div>
          </div>
        </div>

        <!-- Timeline Connector Line & Add Step Button at 0 -->
        <div class="flex flex-col items-center py-2 relative">
          <div class="w-0.5 h-6 bg-neutral-300"></div>
          <button class="btn-insert-step w-7 h-7 rounded-full bg-white hover:bg-primary text-neutral-500 hover:text-white border border-neutral-300 hover:border-primary flex items-center justify-center text-sm font-bold shadow-xs transition-all cursor-pointer my-1 z-10" data-insert-index="0" title="Agregar paso aquí">
            +
          </button>
          <div class="w-0.5 h-6 bg-neutral-300"></div>
        </div>

        <!-- Step Nodes List -->
        <div id="steps-timeline-list" class="w-full flex flex-col items-center gap-0">
          ${steps.map((step, idx) => {
            const stepTypeMap = {
              send_whatsapp: { title: 'Enviar WhatsApp', icon: '💬', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              send_email: { title: 'Enviar Email', icon: '✉️', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200' },
              delay: { title: 'Esperar Tiempo', icon: '⏳', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
              change_stage: { title: 'Cambiar Etapa', icon: '🗂️', badgeBg: 'bg-purple-50 text-purple-700 border-purple-200' },
              add_comment: { title: 'Comentario Interno', icon: '📝', badgeBg: 'bg-neutral-100 text-neutral-700 border-neutral-200' }
            };

            const tInfo = stepTypeMap[step.step_type] || stepTypeMap.send_whatsapp;

            let stepSummary = '';
            if (step.step_type === 'send_whatsapp') {
              const recMode = step.config?.recipient_mode === 'all_contacts' ? 'Todos los contactos' : 'Contacto principal';
              stepSummary = `Plantilla Meta: <strong>${step.config?.template_name || '-'}</strong> <span class="text-neutral-400">• Para: ${recMode}</span>`;
            } else if (step.step_type === 'send_email') {
              const recMode = step.config?.recipient_mode === 'all_contacts' ? 'Todos los contactos' : 'Contacto principal';
              const sender = step.config?.sender_email || 'Predeterminado';
              stepSummary = `Asunto: <em>"${step.config?.subject || '-'}"</em> <span class="text-neutral-400">• De: ${sender} • Para: ${recMode}</span>`;
            } else if (step.step_type === 'delay') {
              const unitMap = { minutes: 'minutos', hours: 'horas', days: 'días' };
              stepSummary = `Pausar por <strong>${step.config?.duration || 1} ${unitMap[step.config?.unit] || 'minutos'}</strong>`;
            } else if (step.step_type === 'change_stage') {
              const targetStage = stages.find(s => s.id === step.config?.to_stage_id);
              stepSummary = `Mover a: <strong>${targetStage?.name || 'Etapa no encontrada'}</strong>`;
            } else if (step.step_type === 'add_comment') {
              stepSummary = `Nota: <em>"${(step.config?.comment || '').slice(0, 45)}..."</em>`;
            }

            return `
              <div class="w-full flex flex-col items-center">
                <!-- Step Card -->
                <div class="w-full bg-white border border-neutral-200 hover:border-neutral-300 rounded-2xl p-4 shadow-xs relative group transition-all">
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-3">
                      <div class="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center text-base shrink-0">
                        ${tInfo.icon}
                      </div>
                      <div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${tInfo.badgeBg}">Paso #${idx + 1} • ${tInfo.title}</span>
                          <h4 class="text-xs font-bold text-neutral-900">${step.name || tInfo.title}</h4>
                        </div>
                        <p class="text-[11px] text-neutral-600 mt-1 font-mono">${stepSummary}</p>
                      </div>
                    </div>

                    <!-- Step Action Buttons -->
                    <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      ${idx > 0 ? `
                        <button class="btn-move-step-up w-7 h-7 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs cursor-pointer" data-index="${idx}" title="Mover arriba">
                          ▲
                        </button>
                      ` : ''}
                      ${idx < steps.length - 1 ? `
                        <button class="btn-move-step-down w-7 h-7 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center text-xs cursor-pointer" data-index="${idx}" title="Mover abajo">
                          ▼
                        </button>
                      ` : ''}
                      <button class="btn-edit-step px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors" data-index="${idx}">
                        ✏️ Editar
                      </button>
                      <button class="btn-delete-step w-7 h-7 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 flex items-center justify-center text-xs cursor-pointer transition-colors" data-index="${idx}" title="Eliminar paso">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Connector Line & Add Step Button below -->
                <div class="flex flex-col items-center py-2 relative">
                  <div class="w-0.5 h-6 bg-neutral-300"></div>
                  <button class="btn-insert-step w-7 h-7 rounded-full bg-white hover:bg-primary text-neutral-500 hover:text-white border border-neutral-300 hover:border-primary flex items-center justify-center text-sm font-bold shadow-xs transition-all cursor-pointer my-1 z-10" data-insert-index="${idx + 1}" title="Agregar paso aquí">
                    +
                  </button>
                  <div class="w-0.5 h-6 bg-neutral-300"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- End of Flow Node Card -->
        <div class="w-full max-w-sm bg-neutral-100 border border-neutral-300 rounded-xl p-3 text-center shadow-xs">
          <span class="text-[10px] font-mono font-bold uppercase text-neutral-500">🏁 Fin del Flujo de Automatización</span>
          <p class="text-[10px] text-neutral-400 mt-0.5">El contacto finaliza la ejecución con éxito</p>
        </div>

      </div>
    `;

    // Embed Audience Segmenter
    const segContainer = container.querySelector('#trigger-audience-segmenter-container');
    if (segContainer) {
      const segmenterElem = createAudienceSegmenter({
        audienceType: automation.audience_type || 'dynamic_segment',
        audienceFilters: automation.audience_filters || {},
        onChange: ({ audience_type, audience_filters }) => {
          automation.audience_type = audience_type;
          automation.audience_filters = audience_filters;
          isDirty = true;
        }
      });
      segContainer.appendChild(segmenterElem);
    }

    // Trigger collapse toggle handler
    const btnToggleTrigger = container.querySelector('#btn-toggle-trigger-collapse');
    if (btnToggleTrigger) {
      btnToggleTrigger.addEventListener('click', () => {
        isTriggerCollapsed = !isTriggerCollapsed;
        renderFlowTab(container);
      });
    }

    // Trigger select change handler
    const triggerSelect = container.querySelector('#select-flow-trigger');
    triggerSelect.addEventListener('change', (e) => {
      automation.trigger_type = e.target.value;
      isDirty = true;
      renderFlowTab(container);
    });

    // Stage selectors if stage trigger
    const fromStageSelect = container.querySelector('#trigger-from-stage');
    const toStageSelect = container.querySelector('#trigger-to-stage');
    if (fromStageSelect) {
      fromStageSelect.addEventListener('change', (e) => {
        if (!automation.trigger_config) automation.trigger_config = {};
        automation.trigger_config.from_stage_id = e.target.value || null;
        isDirty = true;
      });
    }
    if (toStageSelect) {
      toStageSelect.addEventListener('change', (e) => {
        if (!automation.trigger_config) automation.trigger_config = {};
        automation.trigger_config.to_stage_id = e.target.value || null;
        isDirty = true;
      });
    }

    // Scheduled Once input handler
    const scheduledAtInput = container.querySelector('#input-scheduled-at');
    if (scheduledAtInput) {
      scheduledAtInput.addEventListener('change', (e) => {
        if (e.target.value) {
          automation.scheduled_at = new Date(e.target.value).toISOString();
        } else {
          automation.scheduled_at = null;
        }
        isDirty = true;
      });
    }

    // Scheduled Recurring input handlers
    const recValInput = container.querySelector('#input-recurrence-val');
    const recUnitSelect = container.querySelector('#select-recurrence-unit');
    const recStartInput = container.querySelector('#input-recurrence-start');
    const recMaxIterInput = container.querySelector('#input-rec-max-iter');
    const recEndDateInput = container.querySelector('#input-rec-end-date');
    const recEndRadios = container.querySelectorAll('input[name="rec_end_type"]');

    if (recValInput) {
      recValInput.addEventListener('input', (e) => {
        automation.recurrence_config.frequency_value = parseInt(e.target.value, 10) || 1;
        isDirty = true;
        renderFlowTab(container);
      });
    }
    if (recUnitSelect) {
      recUnitSelect.addEventListener('change', (e) => {
        automation.recurrence_config.frequency_unit = e.target.value;
        isDirty = true;
        renderFlowTab(container);
      });
    }
    if (recStartInput) {
      recStartInput.addEventListener('change', (e) => {
        if (e.target.value) {
          const iso = new Date(e.target.value).toISOString();
          automation.recurrence_config.start_date = iso;
          automation.next_run_at = iso;
        }
        isDirty = true;
      });
    }
    if (recMaxIterInput) {
      recMaxIterInput.addEventListener('input', (e) => {
        automation.recurrence_config.max_iterations = parseInt(e.target.value, 10) || 1;
        isDirty = true;
      });
    }
    if (recEndDateInput) {
      recEndDateInput.addEventListener('change', (e) => {
        automation.recurrence_config.end_date = e.target.value ? new Date(e.target.value).toISOString() : null;
        isDirty = true;
      });
    }
    recEndRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        automation.recurrence_config.end_type = e.target.value;
        isDirty = true;
      });
    });

    // Insert Step Button handlers
    container.querySelectorAll('.btn-insert-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const insertIndex = parseInt(btn.dataset.insertIndex, 10);
        openAutomationStepDrawer({
          step: null,
          defaultType: 'send_whatsapp',
          onSave: (newStepData) => {
            steps.splice(insertIndex, 0, newStepData);
            recalcStepOrders();
            isDirty = true;
            wrapper.querySelector('#tab-steps-count').textContent = steps.length;
            renderFlowTab(container);
          }
        });
      });
    });

    // Edit Step Button handlers
    container.querySelectorAll('.btn-edit-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const targetStep = steps[idx];
        openAutomationStepDrawer({
          step: targetStep,
          onSave: (updatedStepData) => {
            steps[idx] = { ...targetStep, ...updatedStepData };
            recalcStepOrders();
            isDirty = true;
            renderFlowTab(container);
          }
        });
      });
    });

    // Move step up/down handlers
    container.querySelectorAll('.btn-move-step-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          const temp = steps[idx];
          steps[idx] = steps[idx - 1];
          steps[idx - 1] = temp;
          recalcStepOrders();
          isDirty = true;
          renderFlowTab(container);
        }
      });
    });

    container.querySelectorAll('.btn-move-step-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx < steps.length - 1) {
          const temp = steps[idx];
          steps[idx] = steps[idx + 1];
          steps[idx + 1] = temp;
          recalcStepOrders();
          isDirty = true;
          renderFlowTab(container);
        }
      });
    });

    // Delete step handlers
    container.querySelectorAll('.btn-delete-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (confirm(`¿Eliminar el Paso #${idx + 1}?`)) {
          steps.splice(idx, 1);
          recalcStepOrders();
          isDirty = true;
          wrapper.querySelector('#tab-steps-count').textContent = steps.length;
          renderFlowTab(container);
        }
      });
    });
  }

  function recalcStepOrders() {
    steps.forEach((s, idx) => {
      s.step_order = idx + 1;
    });
  }

  // ==========================================
  // TAB 2: EJECUCIONES
  // ==========================================
  function renderExecutionsTab(container) {
    let filterStatus = 'all';
    let searchQuery = '';

    container.innerHTML = `
      <div class="flex flex-col gap-4 animate-fade-in">
        
        <!-- Filter and Search Bar -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
          <div class="relative w-full sm:w-72">
            <span class="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none">🔍</span>
            <input type="text" id="exec-search" class="cohere-input !pl-9 text-xs w-full" placeholder="Buscar contacto o empresa..." />
          </div>

          <div class="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-[10px] font-mono font-bold uppercase" id="exec-filter-tabs">
            <button class="exec-tab-btn px-3 py-1.5 rounded-md bg-neutral-900 text-white shadow-xs" data-status="all">Todas (${executions.length})</button>
            <button class="exec-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="running">⚡ En Proceso</button>
            <button class="exec-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="waiting">⏳ En Espera</button>
            <button class="exec-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="completed">✅ Finalizadas</button>
            <button class="exec-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="failed">❌ Errores</button>
            <button class="exec-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="cancelled">🛑 Canceladas</button>
          </div>
        </div>

        <!-- Executions Table -->
        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-neutral-900 text-white font-mono text-[10px] uppercase tracking-wider border-b border-neutral-800">
                  <th class="py-3 px-4">Contacto / Lead</th>
                  <th class="py-3 px-4">Estado</th>
                  <th class="py-3 px-4">Paso Actual</th>
                  <th class="py-3 px-4">Iniciado</th>
                  <th class="py-3 px-4">Última Actividad</th>
                  <th class="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody id="executions-table-body" class="divide-y divide-neutral-200 text-xs font-medium">
                <!-- Executions Rows -->
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    const searchInput = container.querySelector('#exec-search');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderExecutionsRows();
    });

    container.querySelectorAll('.exec-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.exec-tab-btn').forEach(b => {
          b.className = 'exec-tab-btn px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200';
        });
        btn.className = 'exec-tab-btn px-3 py-1.5 rounded-md bg-neutral-900 text-white shadow-xs';
        filterStatus = btn.dataset.status;
        renderExecutionsRows();
      });
    });

    renderExecutionsRows();

    function renderExecutionsRows() {
      const tbody = container.querySelector('#executions-table-body');
      
      const filtered = executions.filter(ex => {
        if (filterStatus !== 'all' && ex.status !== filterStatus) return false;
        if (searchQuery) {
          const contactName = ex.contacts ? `${ex.contacts.first_name || ''} ${ex.contacts.last_name || ''}`.toLowerCase() : '';
          const company = (ex.leads?.company || '').toLowerCase();
          const phone = (ex.contacts?.phone || '').toLowerCase();
          const email = (ex.contacts?.email || '').toLowerCase();
          if (!contactName.includes(searchQuery) && !company.includes(searchQuery) && !phone.includes(searchQuery) && !email.includes(searchQuery)) {
            return false;
          }
        }
        return true;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="py-12 text-center text-neutral-400 font-mono text-xs">
              No hay ejecuciones que coincidan con los filtros.
            </td>
          </tr>
        `;
        return;
      }

      const statusBadges = {
        running: '<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-blue-100 text-blue-800">⚡ En Proceso</span>',
        waiting: '<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-100 text-amber-800">⏳ En Espera</span>',
        completed: '<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800">✅ Finalizada</span>',
        failed: '<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-100 text-rose-800">❌ Error</span>',
        cancelled: '<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-neutral-100 text-neutral-600">🛑 Cancelada</span>'
      };

      tbody.innerHTML = filtered.map(ex => {
        const contactName = ex.contacts ? `${ex.contacts.first_name || ''} ${ex.contacts.last_name || ''}`.trim() : null;
        const displayName = contactName || ex.leads?.company || 'Sin nombre';
        const currentStepObj = steps.find(s => s.step_order === ex.current_step_order);
        const stepDesc = ex.status === 'completed' 
          ? 'Todos los pasos completados' 
          : currentStepObj ? `Paso #${ex.current_step_order}: ${currentStepObj.name}` : `Paso #${ex.current_step_order || 1}`;

        return `
          <tr class="hover:bg-neutral-50 transition-colors cursor-pointer row-view-exec" data-id="${ex.id}">
            <td class="py-3 px-4">
              <div class="font-bold text-neutral-900">${displayName}</div>
              <div class="text-[10px] text-neutral-400 font-mono">${ex.contacts?.phone || ex.contacts?.email || ex.leads?.company || '-'}</div>
            </td>
            <td class="py-3 px-4">
              ${statusBadges[ex.status] || ex.status}
            </td>
            <td class="py-3 px-4">
              <div class="font-mono text-[11px] text-neutral-700">${stepDesc}</div>
            </td>
            <td class="py-3 px-4 font-mono text-[11px] text-neutral-500">
              ${formatDateTime(ex.started_at || ex.created_at)}
            </td>
            <td class="py-3 px-4 font-mono text-[11px] text-neutral-500">
              ${formatDateTime(ex.updated_at || ex.created_at)}
            </td>
            <td class="py-3 px-4 text-right">
              <button class="px-3 py-1 bg-neutral-100 hover:bg-primary hover:text-white text-neutral-700 text-[10px] font-mono font-bold uppercase rounded-md transition-colors cursor-pointer btn-open-exec" data-id="${ex.id}">
                Ver Detalle →
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.btn-open-exec, .row-view-exec').forEach(elem => {
        elem.addEventListener('click', (e) => {
          const id = elem.dataset.id;
          if (id) {
            openAutomationExecutionDrawer(id, () => loadAutomationData());
          }
        });
      });
    }
  }

  // ==========================================
  // TAB 3: ESTADÍSTICAS
  // ==========================================
  function renderStatsTab(container) {
    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const running = executions.filter(e => e.status === 'running' || e.status === 'waiting').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const cancelled = executions.filter(e => e.status === 'cancelled').length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    container.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in">
        
        <!-- KPI Cards Grid -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
            <span class="text-[10px] font-mono uppercase text-neutral-500">Entraron</span>
            <strong class="text-2xl font-bold font-mono text-neutral-900">${total.toLocaleString()}</strong>
            <span class="text-[10px] text-neutral-400">Total ejecuciones</span>
          </div>

          <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
            <span class="text-[10px] font-mono uppercase text-emerald-600">Finalizaron</span>
            <strong class="text-2xl font-bold font-mono text-emerald-600">${completed.toLocaleString()}</strong>
            <span class="text-[10px] text-emerald-500 font-mono">${completionRate}% tasa de éxito</span>
          </div>

          <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
            <span class="text-[10px] font-mono uppercase text-blue-600">En proceso</span>
            <strong class="text-2xl font-bold font-mono text-blue-600">${running.toLocaleString()}</strong>
            <span class="text-[10px] text-neutral-400">Activas / En espera</span>
          </div>

          <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
            <span class="text-[10px] font-mono uppercase text-rose-600">Errores</span>
            <strong class="text-2xl font-bold font-mono text-rose-600">${failed.toLocaleString()}</strong>
            <span class="text-[10px] text-neutral-400">Requieren revisión</span>
          </div>

          <div class="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-1">
            <span class="text-[10px] font-mono uppercase text-neutral-500">Cancelados</span>
            <strong class="text-2xl font-bold font-mono text-neutral-600">${cancelled.toLocaleString()}</strong>
            <span class="text-[10px] text-neutral-400">Detenidas manualmente</span>
          </div>
        </div>

        <!-- Funnel Step-by-Step Breakdown -->
        <div class="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <h4 class="text-sm font-bold text-neutral-900 font-display">Desglose de Pasos del Flujo</h4>
              <p class="text-xs text-neutral-500">Distribución de contactos a lo largo de cada etapa de la automatización</p>
            </div>
            <span class="text-xs font-mono font-bold text-neutral-500">Total Flujo: ${steps.length} pasos</span>
          </div>

          ${steps.length === 0 ? `
            <div class="py-8 text-center text-neutral-400 font-mono text-xs">
              No hay pasos configurados en el flujo todavía.
            </div>
          ` : `
            <div class="space-y-3 pt-2">
              ${steps.map((step, idx) => {
                const passedCount = executions.filter(e => e.current_step_order >= step.step_order || e.status === 'completed').length;
                const percentage = total > 0 ? Math.round((passedCount / total) * 100) : 0;

                return `
                  <div class="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div class="flex items-center gap-2 font-bold text-neutral-800">
                        <span class="font-mono text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded">#${idx + 1}</span>
                        <span>${step.name}</span>
                      </div>
                      <div class="font-mono text-[11px] text-neutral-600">
                        <strong>${passedCount}</strong> de ${total} contactos (${percentage}%)
                      </div>
                    </div>
                    <!-- Progress Bar -->
                    <div class="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }

  async function saveAutomationFlow() {
    try {
      // Validate recurrence overlap constraint
      const durCheck = checkFlowDurationVsRecurrence(steps, automation);
      if (durCheck.hasOverlap) {
        toast.show(`Conflicto de solapamiento: Las esperas del flujo duran ${formatMinutesHuman(durCheck.totalDelayMinutes)} y superan el intervalo de repetición (${formatMinutesHuman(durCheck.recurrenceIntervalMinutes)}). Por favor ajusta los delays o la frecuencia.`, 'error');
        return;
      }

      toast.show('Guardando cambios...', 'info');

      // Si el disparador es puntual o recurrente con fecha, asegurar que quede activo en base de datos
      let targetIsActive = automation.is_active ?? true;
      let targetStatus = automation.status || 'active';

      if (automation.trigger_type === 'scheduled_once') {
        if (automation.scheduled_at) {
          targetIsActive = true;
          targetStatus = 'active';
          automation.is_active = true;
          automation.status = 'active';
        }
      } else if (automation.trigger_type === 'scheduled_recurring') {
        targetIsActive = true;
        targetStatus = 'active';
        automation.is_active = true;
        automation.status = 'active';
      }

      // 1. Update automations row
      const { error: autoUpdErr } = await supabase
        .from('automations')
        .update({
          name: automation.name,
          description: automation.description,
          trigger_type: automation.trigger_type,
          trigger_config: automation.trigger_config || {},
          allow_reentry: !!automation.allow_reentry,
          audience_type: automation.audience_type || 'dynamic_segment',
          audience_filters: automation.audience_filters || {},
          is_active: targetIsActive,
          status: targetStatus,
          scheduled_at: automation.trigger_type === 'scheduled_once' ? automation.scheduled_at : null,
          recurrence_config: automation.trigger_type === 'scheduled_recurring' ? automation.recurrence_config : {},
          next_run_at: automation.trigger_type === 'scheduled_recurring' ? (automation.next_run_at || automation.recurrence_config?.start_date || new Date().toISOString()) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', automation.id);

      if (autoUpdErr) throw autoUpdErr;

      // 2. Sync steps: delete removed, update existing, insert new
      const existingStepIds = steps.filter(s => s.id).map(s => s.id);

      if (existingStepIds.length > 0) {
        await supabase
          .from('automation_steps')
          .delete()
          .eq('automation_id', automation.id)
          .not('id', 'in', `(${existingStepIds.join(',')})`);
      } else {
        await supabase
          .from('automation_steps')
          .delete()
          .eq('automation_id', automation.id);
      }

      // Upsert steps
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const stepPayload = {
          automation_id: automation.id,
          step_order: i + 1,
          step_type: s.step_type,
          name: s.name,
          config: s.config || {},
          updated_at: new Date().toISOString()
        };

        if (s.id) {
          await supabase.from('automation_steps').update(stepPayload).eq('id', s.id);
        } else {
          const { data: insertedStep } = await supabase.from('automation_steps').insert(stepPayload).select().single();
          if (insertedStep) s.id = insertedStep.id;
        }
      }

      isDirty = false;
      toast.show('Flujo de automatización guardado con éxito', 'success');
      await loadAutomationData();

    } catch (err) {
      toast.show('Error al guardar flujo: ' + err.message, 'error');
    }
  }

  return wrapper;
}
