import { supabase, fetchAllRows } from '../lib/supabase';
import { auth } from '../lib/auth';
import { cache } from '../lib/cache';
import { toast } from './toast';

export function openCampaignWizardModal(onSuccess) {
  let currentStep = 1;
  const totalSteps = 6;

  // Wizard State
  const campaignData = {
    name: '',
    description: '',
    channel: 'whatsapp',
    phone_number_id: '',
    objective: 'promocion',
    audience_type: 'dynamic_segment',
    audience_filters: { pipeline_stage_id: '', days_inactive: '', country: '', selected_lead_ids: [] },
    template_name: '',
    template_language: 'es_AR',
    template_components: [],
    variable_mappings: {}, // { "1": { field: "lead.first_name", fallback: "Cliente" } }
    send_type: 'immediate',
    scheduled_at: '',
    options: {
      stop_on_mass_error: true,
      auto_retry: true,
      valid_whatsapp_only: true
    }
  };

  // Cached data
  let phoneNumbers = [];
  let metaTemplates = [];
  let pipelineStages = [];
  let estimatedAudienceCount = 0;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans';
  
  modalOverlay.innerHTML = `
    <div class="bg-white border border-neutral-200 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-mono text-sm font-bold">📢</div>
          <div>
            <h3 class="font-mono text-sm font-bold uppercase tracking-wide">Asistente de Creación de Campañas</h3>
            <p class="text-[10px] text-neutral-400">Paso <span id="wiz-step-num">1</span> de 6: <span id="wiz-step-title" class="font-semibold text-white">Información General</span></p>
          </div>
        </div>
        <button id="btn-close-wiz" class="text-neutral-400 hover:text-white text-lg cursor-pointer px-2 py-1">✕</button>
      </div>

      <!-- Step Indicator Bar -->
      <div class="bg-neutral-100 border-b border-neutral-200 px-6 py-2 flex items-center justify-between">
        <div class="flex items-center gap-2 text-[10px] font-mono font-bold uppercase w-full">
          <div class="wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-primary text-white" data-step="1">1. General</div>
          <div class="wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-neutral-200 text-neutral-500" data-step="2">2. Audiencia</div>
          <div class="wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-neutral-200 text-neutral-500" data-step="3">3. Contenido</div>
          <div class="wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-neutral-200 text-neutral-500" data-step="4">4. Envío</div>
          <div class="wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-neutral-200 text-neutral-500" data-step="5">5. Opciones</div>
          <div class="wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-neutral-200 text-neutral-500" data-step="6">6. Resumen</div>
        </div>
      </div>

      <!-- Modal Body (Dynamic Step Content) -->
      <div id="wiz-body" class="p-6 overflow-y-auto flex-1 bg-neutral-50/50">
        <div class="flex items-center justify-center py-12 text-neutral-400">
          <span class="animate-pulse mr-2">🔄</span> Cargando asistente...
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-white border-t border-neutral-200 flex items-center justify-between">
        <button id="btn-prev-wiz" class="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          ← Anterior
        </button>

        <div class="flex items-center gap-3">
          <button id="btn-cancel-wiz" class="px-4 py-2 text-neutral-500 hover:text-neutral-800 text-xs font-mono font-bold uppercase cursor-pointer">
            Cancelar
          </button>
          <button id="btn-next-wiz" class="px-6 py-2 bg-primary hover:bg-neutral-900 text-white text-xs font-mono font-bold uppercase rounded-lg tracking-wider transition-colors cursor-pointer flex items-center gap-2">
            <span>Siguiente</span> →
          </button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(modalOverlay);

  const wizBody = modalOverlay.querySelector('#wiz-body');
  const wizStepNum = modalOverlay.querySelector('#wiz-step-num');
  const wizStepTitle = modalOverlay.querySelector('#wiz-step-title');
  const btnPrev = modalOverlay.querySelector('#btn-prev-wiz');
  const btnNext = modalOverlay.querySelector('#btn-next-wiz');
  const btnClose = modalOverlay.querySelector('#btn-close-wiz');
  const btnCancel = modalOverlay.querySelector('#btn-cancel-wiz');

  btnClose.addEventListener('click', () => modalOverlay.remove());
  btnCancel.addEventListener('click', () => modalOverlay.remove());

  // Load prerequisites from DB / Proxy
  initWizardData();

  async function getAuthHeaders() {
    const session = await auth.getSession();
    return { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
  }

  function updatePhoneSelectUI() {
    const selectEl = wizBody.querySelector('#select-phone-num');
    if (!selectEl) return;
    selectEl.innerHTML = phoneNumbers.length === 0 ? `<option value="">Cargando números...</option>` : phoneNumbers.map(num => `
      <option value="${num.id}" ${num.id === campaignData.phone_number_id ? 'selected' : ''}>
        📞 ${num.verified_name || num.display_phone_number || num.id} (${num.display_phone_number || ''})
      </option>
    `).join('');
  }

  async function initWizardData() {
    renderStep(1);

    try {
      // 1. Fetch active phone numbers from local DB fast (instant)
      const { data: dbNumbers } = await supabase
        .from('whatsapp_numbers')
        .select('*')
        .eq('is_active', true);

      if (dbNumbers && dbNumbers.length > 0) {
        phoneNumbers = dbNumbers.map(n => ({
          id: n.phone_number_id,
          verified_name: n.verified_name,
          display_phone_number: n.display_phone_number
        }));
        if (!campaignData.phone_number_id || !phoneNumbers.some(n => n.id === campaignData.phone_number_id)) {
          campaignData.phone_number_id = phoneNumbers[0].id;
        }
        updatePhoneSelectUI();
      }

      // 2. Fetch pipeline stages from cache or DB
      if (cache.stages && cache.stages.size > 0) {
        pipelineStages = Array.from(cache.stages.values());
      } else {
        const { data: stages } = await supabase.from('pipeline_stages').select('*').order('position', { ascending: true });
        pipelineStages = stages || [];
      }

      // 3. Background sync numbers from proxy if active
      getAuthHeaders().then(headers => {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/numbers`, { headers })
          .then(res => res.json())
          .then(numData => {
            if (numData.data && Array.isArray(numData.data) && numData.data.length > 0) {
              const activeProxyNums = numData.data.filter(pn => {
                const matchedDb = (dbNumbers || []).find(dbn => dbn.phone_number_id === pn.id);
                return matchedDb ? matchedDb.is_active : !pn.display_phone_number?.startsWith('+1 555');
              });
              if (activeProxyNums.length > 0) {
                phoneNumbers = activeProxyNums;
                if (!campaignData.phone_number_id || !phoneNumbers.some(n => n.id === campaignData.phone_number_id)) {
                  campaignData.phone_number_id = phoneNumbers[0].id;
                }
                updatePhoneSelectUI();
              }
            }
          }).catch(() => {});
      }).catch(() => {});

      await fetchTemplates();
    } catch (err) {
      console.error('Error initializing wizard data:', err);
    }
  }

  async function fetchTemplates() {
    if (!campaignData.phone_number_id && phoneNumbers.length > 0) {
      campaignData.phone_number_id = phoneNumbers[0].id;
    }
    try {
      const headers = await getAuthHeaders();
      const tRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/templates?phone_number_id=${campaignData.phone_number_id || ''}`, { headers });
      const tData = await tRes.json().catch(() => ({}));
      metaTemplates = tData.data || [];
    } catch (e) {
      console.error('Error fetching templates:', e);
    }
  }

  function updateStepPills() {
    modalOverlay.querySelectorAll('.wiz-step-pill').forEach(pill => {
      const step = parseInt(pill.dataset.step, 10);
      if (step === currentStep) {
        pill.className = 'wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-primary text-white shadow-xs font-bold';
      } else if (step < currentStep) {
        pill.className = 'wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-emerald-100 text-emerald-800 font-medium';
      } else {
        pill.className = 'wiz-step-pill flex-1 py-1 px-2 text-center rounded-sm bg-neutral-200 text-neutral-500 font-medium';
      }
    });

    wizStepNum.textContent = currentStep;
    btnPrev.disabled = currentStep === 1;

    if (currentStep === totalSteps) {
      btnNext.innerHTML = `<span>🚀 Programar Campaña</span>`;
      btnNext.classList.remove('bg-primary');
      btnNext.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    } else {
      btnNext.innerHTML = `<span>Siguiente</span> →`;
      btnNext.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      btnNext.classList.add('bg-primary');
    }
  }

  async function renderStep(step) {
    currentStep = step;
    updateStepPills();

    switch (step) {
      case 1:
        renderStep1();
        break;
      case 2:
        await renderStep2();
        break;
      case 3:
        await renderStep3();
        break;
      case 4:
        renderStep4();
        break;
      case 5:
        renderStep5();
        break;
      case 6:
        renderStep6();
        break;
    }
  }

  // ----------------------------------------------------
  // STEP 1: Información General
  // ----------------------------------------------------
  function renderStep1() {
    wizStepTitle.textContent = 'Información General';
    wizBody.innerHTML = `
      <div class="flex flex-col gap-5 max-w-2xl mx-auto">
        <div class="flex flex-col gap-1">
          <label class="font-mono text-[10px] font-bold text-primary uppercase">Nombre de la Campaña *</label>
          <input type="text" id="input-name" class="cohere-input text-xs font-medium" placeholder="Ej. Promo Loteos Julio 2026" value="${campaignData.name}" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-mono text-[10px] font-bold text-neutral-600 uppercase">Descripción u Objetivo Comercial</label>
          <textarea id="input-desc" rows="2" class="cohere-input text-xs" placeholder="Breve nota sobre la estrategia o audiencia objetivo...">${campaignData.description}</textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Canal -->
          <div class="flex flex-col gap-2">
            <label class="font-mono text-[10px] font-bold text-primary uppercase">Canal de Envío *</label>
            <div class="grid grid-cols-2 gap-2">
              <label class="p-3 border ${campaignData.channel === 'whatsapp' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex items-center gap-2 transition-all">
                <input type="radio" name="wiz_channel" value="whatsapp" ${campaignData.channel === 'whatsapp' ? 'checked' : ''} class="accent-primary" />
                <div>
                  <span class="block text-xs font-bold text-primary">🟢 WhatsApp</span>
                  <span class="block text-[9px] text-neutral-500">Meta MM API</span>
                </div>
              </label>
              <label class="p-3 border ${campaignData.channel === 'email' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex items-center gap-2 transition-all">
                <input type="radio" name="wiz_channel" value="email" ${campaignData.channel === 'email' ? 'checked' : ''} class="accent-primary" />
                <div>
                  <span class="block text-xs font-bold text-neutral-700">✉️ Email</span>
                  <span class="block text-[9px] text-neutral-400">En desarrollo</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Número Remitente -->
          <div class="flex flex-col gap-2 ${campaignData.channel === 'whatsapp' ? '' : 'hidden'}" id="sender-num-container">
            <label class="font-mono text-[10px] font-bold text-primary uppercase">Número Remitente (WhatsApp) *</label>
            <select id="select-phone-num" class="cohere-input text-xs font-medium">
              ${phoneNumbers.length === 0 ? `<option value="">Cargando números...</option>` : phoneNumbers.map(num => `
                <option value="${num.id}" ${num.id === campaignData.phone_number_id ? 'selected' : ''}>
                  📞 ${num.verified_name || num.display_phone_number || num.id} (${num.display_phone_number || ''})
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Objetivo -->
        <div class="flex flex-col gap-2 border-t border-neutral-200 pt-3">
          <label class="font-mono text-[10px] font-bold text-neutral-600 uppercase">Objetivo de Campaña</label>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${[
              { id: 'promocion', label: 'Promoción' },
              { id: 'difusion', label: 'Difusión' },
              { id: 'reactivacion', label: 'Reactivación' },
              { id: 'fidelizacion', label: 'Fidelización' },
              { id: 'recordatorio', label: 'Recordatorio' },
              { id: 'seguimiento', label: 'Seguimiento' },
              { id: 'notificacion', label: 'Notificación' },
              { id: 'otro', label: 'Otro' }
            ].map(obj => `
              <label class="p-2 border ${campaignData.objective === obj.id ? 'border-primary bg-primary/5 text-primary' : 'border-neutral-200 text-neutral-600'} rounded-md cursor-pointer text-xs font-medium flex items-center gap-1.5 transition-colors">
                <input type="radio" name="wiz_objective" value="${obj.id}" ${campaignData.objective === obj.id ? 'checked' : ''} class="accent-primary" />
                <span>${obj.label}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Event listeners
    wizBody.querySelector('#input-name').addEventListener('input', (e) => campaignData.name = e.target.value);
    wizBody.querySelector('#input-desc').addEventListener('input', (e) => campaignData.description = e.target.value);

    wizBody.querySelectorAll('input[name="wiz_channel"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        campaignData.channel = e.target.value;
        const senderContainer = wizBody.querySelector('#sender-num-container');
        if (campaignData.channel === 'whatsapp') {
          senderContainer.classList.remove('hidden');
        } else {
          senderContainer.classList.add('hidden');
        }
      });
    });

    const selectPhone = wizBody.querySelector('#select-phone-num');
    if (selectPhone) {
      selectPhone.addEventListener('change', async (e) => {
        campaignData.phone_number_id = e.target.value;
        await fetchTemplates();
      });
    }

    wizBody.querySelectorAll('input[name="wiz_objective"]').forEach(radio => {
      radio.addEventListener('change', (e) => campaignData.objective = e.target.value);
    });
  }

  // ----------------------------------------------------
  // STEP 2: Audiencia
  // ----------------------------------------------------
  // ----------------------------------------------------
  // STEP 2: Audiencia & Segmentación
  // ----------------------------------------------------
  async function renderStep2() {
    wizStepTitle.textContent = 'Audiencia y Segmentación';

    // Ensure pipeline stages are loaded
    if (!pipelineStages || pipelineStages.length === 0) {
      if (cache.stages && cache.stages.size > 0) {
        pipelineStages = Array.from(cache.stages.values());
      } else {
        const { data: stages } = await supabase.from('pipeline_stages').select('*').order('position', { ascending: true });
        pipelineStages = stages || [];
      }
    }

    if (!campaignData.audience_filters.selected_lead_ids) {
      campaignData.audience_filters.selected_lead_ids = [];
    }

    // Build exact countries list requested
    const countriesList = ['Argentina', 'Chile', 'España', 'México', 'Uruguay'];

    wizBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <!-- Left: Filters Setup & Contact Picker -->
        <div class="md:col-span-2 flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="font-mono text-[10px] font-bold text-primary uppercase">Tipo de Audiencia</label>
            <div class="flex flex-col gap-2">
              <label class="p-3 border ${campaignData.audience_type === 'dynamic_segment' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex items-start gap-3">
                <input type="radio" name="wiz_aud_type" value="dynamic_segment" ${campaignData.audience_type === 'dynamic_segment' ? 'checked' : ''} class="mt-1 accent-primary" />
                <div>
                  <strong class="block text-xs text-primary">⚡ Crear Segmento Dinámico (Recomendado)</strong>
                  <span class="block text-[10px] text-neutral-500">Filtra automáticamente a los prospectos al momento exacto de iniciar la ejecución de envíos.</span>
                </div>
              </label>

              <label class="p-3 border ${campaignData.audience_type === 'static_segment' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex items-start gap-3">
                <input type="radio" name="wiz_aud_type" value="static_segment" ${campaignData.audience_type === 'static_segment' ? 'checked' : ''} class="mt-1 accent-primary" />
                <div>
                  <strong class="block text-xs text-neutral-800">📌 Crear Segmento Actual (Estático)</strong>
                  <span class="block text-[10px] text-neutral-500">Permite tildar y congelar la lista exacta de destinatarios.</span>
                </div>
              </label>

              <label class="p-3 border ${campaignData.audience_type === 'all' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex items-start gap-3">
                <input type="radio" name="wiz_aud_type" value="all" ${campaignData.audience_type === 'all' ? 'checked' : ''} class="mt-1 accent-primary" />
                <div>
                  <strong class="block text-xs text-neutral-800">${campaignData.channel === 'email' ? '✉️ Todos los Contactos con Email' : '👥 Todos los Contactos con Teléfono'}</strong>
                  <span class="block text-[10px] text-neutral-500">Envía a todos los prospectos activos registrados en el CRM.</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Filter Criteria -->
          <div class="p-4 bg-white border border-neutral-200 rounded-lg flex flex-col gap-3">
            <h5 class="font-mono text-[9px] font-bold text-neutral-600 uppercase border-b border-neutral-200 pb-1">Reglas de Filtrado de Leads</h5>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Etapa del Pipeline</label>
                <select id="filter-stage" class="cohere-input text-xs">
                  <option value="">Todas las etapas (${pipelineStages.length})</option>
                  ${pipelineStages.map(st => `<option value="${st.id}" ${campaignData.audience_filters.pipeline_stage_id === st.id ? 'selected' : ''}>${st.name}</option>`).join('')}
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">País</label>
                <select id="filter-country" class="cohere-input text-xs">
                  <option value="">Todos los países</option>
                  ${countriesList.map(c => `<option value="${c}" ${campaignData.audience_filters.country === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Inactividad Comercial</label>
                <select id="filter-inactivity" class="cohere-input text-xs">
                  <option value="">Sin filtro de inactividad</option>
                  <option value="7" ${campaignData.audience_filters.days_inactive === '7' ? 'selected' : ''}>Más de 7 días sin gestión</option>
                  <option value="15" ${campaignData.audience_filters.days_inactive === '15' ? 'selected' : ''}>Más de 15 días sin gestión</option>
                  <option value="30" ${campaignData.audience_filters.days_inactive === '30' ? 'selected' : ''}>Más de 30 días sin gestión</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Static Segment Contact List (Only shown when static_segment is active) -->
          <div id="static-contacts-container" class="p-4 bg-white border border-neutral-200 rounded-lg flex flex-col gap-3 ${campaignData.audience_type === 'static_segment' ? '' : 'hidden'}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
              <div>
                <h5 class="font-mono text-[10px] font-bold text-primary uppercase">Destinatarios del Segmento Estático</h5>
                <span class="text-[10px] text-neutral-500">Tilda o destilda los contactos que quieres incluir en el envío.</span>
              </div>
              
              <div class="flex items-center gap-2">
                <span id="selected-contacts-count-badge" class="px-2 py-0.5 bg-primary/10 text-primary font-mono font-bold text-[10px] rounded-full">
                  0 seleccionados
                </span>
                <button id="btn-toggle-select-all" class="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-mono text-[10px] font-bold rounded cursor-pointer transition-colors">
                  Deseleccionar Todos
                </button>
              </div>
            </div>

            <!-- Contact Search Filter -->
            <div class="relative w-full">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs pointer-events-none z-10">🔍</span>
              <input type="text" id="contact-list-search" class="cohere-input text-xs w-full !pl-9" style="padding-left: 2.25rem !important;" placeholder="Buscar contacto por nombre, empresa o teléfono..." />
            </div>

            <!-- Contacts Checklist Box -->
            <div id="contacts-checklist-box" class="max-h-60 overflow-y-auto border border-neutral-200 rounded-md divide-y divide-neutral-100 bg-neutral-50 text-xs">
              <div class="p-4 text-center text-neutral-400 font-mono text-xs">
                <span class="animate-pulse">🔄 Cargando contactos del segmento...</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Right: Live Count Panel -->
        <div class="bg-neutral-900 text-white p-5 rounded-xl flex flex-col justify-between shadow-md h-fit">
          <div class="flex flex-col gap-3">
            <span class="font-mono text-[9px] font-bold text-primary uppercase tracking-wider">Cálculo de Audiencia en Vivo</span>
            <div class="py-4 border-y border-neutral-800">
              <span class="text-3xl font-mono font-bold text-white block" id="aud-live-count">...</span>
              <span class="text-[10px] text-neutral-400 block mt-1" id="aud-live-sub">contactos seleccionados para envío</span>
            </div>

            <div class="flex flex-col gap-2 text-xs">
              <div class="flex items-center justify-between text-emerald-400 font-mono text-[10px]">
                <span>✓ Filtros aplicados</span>
                <span>En tiempo real</span>
              </div>
              <div class="flex items-center justify-between text-neutral-400 font-mono text-[10px]">
                <span>${campaignData.channel === 'email' ? '✉️ Email Mailing' : '⚡ WhatsApp habilitado'}</span>
                <span>${campaignData.channel === 'email' ? 'Gmail API' : 'Cloud API'}</span>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-neutral-800 text-[9px] text-neutral-400 italic">
            ℹ️ En modo estático, la campaña se enviará únicamente a los contactos tildados en el listado.
          </div>
        </div>

      </div>
    `;

    // Dynamic Aud calculation & load contacts
    let fetchedLeads = [];
    let leadSearchQuery = '';

    const staticContainer = wizBody.querySelector('#static-contacts-container');
    const filterStage = wizBody.querySelector('#filter-stage');
    const filterCountry = wizBody.querySelector('#filter-country');
    const filterInactivity = wizBody.querySelector('#filter-inactivity');
    const contactSearch = wizBody.querySelector('#contact-list-search');
    const btnToggleAll = wizBody.querySelector('#btn-toggle-select-all');

    wizBody.querySelectorAll('input[name="wiz_aud_type"]').forEach(radio => {
      radio.addEventListener('change', async (e) => {
        campaignData.audience_type = e.target.value;
        if (campaignData.audience_type === 'static_segment') {
          staticContainer.classList.remove('hidden');
          await reloadContactsList();
        } else {
          staticContainer.classList.add('hidden');
          calculateAudienceLiveCount();
        }
      });
    });

    filterStage.addEventListener('change', async (e) => {
      campaignData.audience_filters.pipeline_stage_id = e.target.value;
      if (campaignData.audience_type === 'static_segment') {
        await reloadContactsList();
      } else {
        calculateAudienceLiveCount();
      }
    });

    if (filterCountry) {
      filterCountry.addEventListener('change', async (e) => {
        campaignData.audience_filters.country = e.target.value;
        if (campaignData.audience_type === 'static_segment') {
          await reloadContactsList();
        } else {
          calculateAudienceLiveCount();
        }
      });
    }

    filterInactivity.addEventListener('change', async (e) => {
      campaignData.audience_filters.days_inactive = e.target.value;
      if (campaignData.audience_type === 'static_segment') {
        await reloadContactsList();
      } else {
        calculateAudienceLiveCount();
      }
    });

    if (contactSearch) {
      contactSearch.addEventListener('input', (e) => {
        leadSearchQuery = e.target.value.toLowerCase().trim();
        renderContactsChecklist();
      });
    }

    if (btnToggleAll) {
      btnToggleAll.addEventListener('click', () => {
        const visibleItems = getFilteredLeads();
        const visibleKeys = visibleItems.map(l => l.itemKey || l.id);
        const allSelected = visibleKeys.length > 0 && visibleKeys.every(key => campaignData.audience_filters.selected_lead_ids.includes(key));

        if (allSelected) {
          campaignData.audience_filters.selected_lead_ids = campaignData.audience_filters.selected_lead_ids.filter(key => !visibleKeys.includes(key));
        } else {
          const set = new Set([...campaignData.audience_filters.selected_lead_ids, ...visibleKeys]);
          campaignData.audience_filters.selected_lead_ids = Array.from(set);
        }

        renderContactsChecklist();
        updateSelectedCountUI();
      });
    }

    if (campaignData.audience_type === 'static_segment') {
      await reloadContactsList();
    } else {
      calculateAudienceLiveCount();
    }

    async function reloadContactsList() {
      const checklistBox = wizBody.querySelector('#contacts-checklist-box');
      if (checklistBox) {
        checklistBox.innerHTML = `
          <div class="p-4 text-center text-neutral-400 font-mono text-xs">
            <span class="animate-pulse">🔄 Cargando contactos...</span>
          </div>
        `;
      }

      try {
        // 1. Fetch ALL leads, links, and contacts using paginated fetchAllRows to ensure zero rows are missed
        const [leadsData, linksData, contactsData] = await Promise.all([
          fetchAllRows('leads', 'id, company, country, primary_contact_id, pipeline_stage_id, updated_at, created_at'),
          fetchAllRows('lead_contacts_link', 'lead_id, contact_id', { orderCol: 'lead_id' }),
          fetchAllRows('contacts', 'id, first_name, last_name, phone, email')
        ]);

        let leadRows = leadsData || [];
        const linksRows = linksData || [];
        const contactsRows = contactsData || [];

        // Fallback to cache if database leads query returned empty
        if (leadRows.length === 0 && cache.isLoaded && cache.leads) {
          leadRows = cache.leads;
        }

        // Map contacts by ID
        const contactsMap = new Map();
        contactsRows.forEach(c => contactsMap.set(c.id, c));
        if (cache.isLoaded && cache.contacts) {
          cache.contacts.forEach((c, id) => {
            if (!contactsMap.has(id)) contactsMap.set(id, c);
          });
        }

        // Apply stage filter if selected
        const f = campaignData.audience_filters;
        if (f.pipeline_stage_id) {
          leadRows = leadRows.filter(l => l.pipeline_stage_id === f.pipeline_stage_id);
        }
        if (f.country) {
          const targetCountry = f.country.trim().toLowerCase();
          leadRows = leadRows.filter(l => (l.country || '').trim().toLowerCase() === targetCountry);
        }
        if (f.days_inactive) {
          const daysAgo = new Date(Date.now() - parseInt(f.days_inactive, 10) * 24 * 60 * 60 * 1000).getTime();
          leadRows = leadRows.filter(l => {
            const upTime = l.updated_at ? new Date(l.updated_at).getTime() : 0;
            return upTime <= daysAgo;
          });
        }

        // Map links by lead_id
        const linksByLead = new Map();
        linksRows.forEach(link => {
          if (!linksByLead.has(link.lead_id)) linksByLead.set(link.lead_id, []);
          if (!linksByLead.get(link.lead_id).includes(link.contact_id)) {
            linksByLead.get(link.lead_id).push(link.contact_id);
          }
        });
        if (cache.isLoaded && cache.links) {
          cache.links.forEach(link => {
            if (!linksByLead.has(link.lead_id)) linksByLead.set(link.lead_id, []);
            if (!linksByLead.get(link.lead_id).includes(link.contact_id)) {
              linksByLead.get(link.lead_id).push(link.contact_id);
            }
          });
        }

        // Build contact checklist items
        const contactItems = [];

        for (const l of leadRows) {
          const companyName = l.company ? l.company.trim() : '';
          const contactIds = [...(linksByLead.get(l.id) || [])];

          // Include primary_contact_id if not already listed
          if (l.primary_contact_id && !contactIds.includes(l.primary_contact_id)) {
            contactIds.unshift(l.primary_contact_id);
          }

          const linkedContacts = contactIds.map(cId => contactsMap.get(cId)).filter(Boolean);

          if (linkedContacts.length > 0) {
            linkedContacts.forEach(c => {
              const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Contacto sin nombre';
              const phoneNum = c.phone || '';
              const emailAddr = c.email || '';

              const displayTitle = fullName;
              const contactInfoStr = campaignData.channel === 'email' ? `✉️ ${emailAddr || 'Sin email'}` : `📞 ${phoneNum || 'Sin teléfono'}`;
              const displaySubtitle = companyName ? `${companyName} • ${contactInfoStr}` : contactInfoStr;

              contactItems.push({
                itemKey: `${l.id}_${c.id}`,
                lead_id: l.id,
                contact_id: c.id,
                name: fullName,
                company: companyName,
                phone: phoneNum,
                displayTitle,
                displaySubtitle,
                pipeline_stage_id: l.pipeline_stage_id,
                searchableText: `${fullName} ${companyName} ${phoneNum}`.toLowerCase()
              });
            });
          } else {
            const title = companyName || 'Prospecto sin nombre';
            contactItems.push({
              itemKey: `${l.id}_lead`,
              lead_id: l.id,
              contact_id: null,
              name: title,
              company: companyName,
              phone: '',
              displayTitle: title,
              displaySubtitle: 'Sin contactos ni teléfono asignado',
              pipeline_stage_id: l.pipeline_stage_id,
              searchableText: `${title}`.toLowerCase()
            });
          }
        }

        fetchedLeads = contactItems;

        // Select all contact itemKeys by default if none explicitly set
        if (!campaignData.audience_filters.selected_lead_ids || campaignData.audience_filters.selected_lead_ids.length === 0) {
          campaignData.audience_filters.selected_lead_ids = fetchedLeads.map(item => item.itemKey);
        }

        renderContactsChecklist();
        updateSelectedCountUI();
      } catch (err) {
        console.error('Error in reloadContactsList:', err);
      }
    }

    function normalizeStr(str) {
      if (!str) return '';
      return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    function getFilteredLeads() {
      if (!leadSearchQuery) return fetchedLeads;
      const queryNorm = normalizeStr(leadSearchQuery);
      return fetchedLeads.filter(l => normalizeStr(l.searchableText).includes(queryNorm));
    }

    function renderContactsChecklist() {
      const checklistBox = wizBody.querySelector('#contacts-checklist-box');
      if (!checklistBox) return;

      const leads = getFilteredLeads();

      if (leads.length === 0) {
        checklistBox.innerHTML = `
          <div class="p-4 text-center text-neutral-400 text-xs">
            No se encontraron contactos que coincidan con la búsqueda.
          </div>
        `;
        return;
      }

      checklistBox.innerHTML = leads.map(l => {
        const isChecked = campaignData.audience_filters.selected_lead_ids.includes(l.itemKey || l.id);
        const stageObj = pipelineStages.find(s => s.id === l.pipeline_stage_id);

        return `
          <label class="p-2.5 flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors select-none">
            <div class="flex items-center gap-2.5 min-w-0">
              <input type="checkbox" data-item-key="${l.itemKey || l.id}" class="chk-lead-select accent-primary w-4 h-4 rounded cursor-pointer" ${isChecked ? 'checked' : ''} />
              <div class="flex flex-col min-w-0">
                <span class="font-bold text-neutral-800 text-xs truncate">${l.displayTitle}</span>
                <span class="text-[10px] text-neutral-500 truncate">${l.displaySubtitle}</span>
              </div>
            </div>

            <span class="text-[9px] font-mono font-bold px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded-full shrink-0 ml-2">
              ${stageObj ? stageObj.name : (cache.getStage ? cache.getStage(l.pipeline_stage_id)?.name : null) || 'Sin etapa'}
            </span>
          </label>
        `;
      }).join('');

      checklistBox.querySelectorAll('.chk-lead-select').forEach(chk => {
        chk.addEventListener('change', (e) => {
          const key = chk.dataset.itemKey;
          if (e.target.checked) {
            if (!campaignData.audience_filters.selected_lead_ids.includes(key)) {
              campaignData.audience_filters.selected_lead_ids.push(key);
            }
          } else {
            campaignData.audience_filters.selected_lead_ids = campaignData.audience_filters.selected_lead_ids.filter(k => k !== key);
          }
          updateSelectedCountUI();
        });
      });
    }

    function updateSelectedCountUI() {
      const selectedCount = campaignData.audience_filters.selected_lead_ids.length;
      const totalCount = fetchedLeads.length;

      const badge = wizBody.querySelector('#selected-contacts-count-badge');
      if (badge) {
        badge.textContent = `${selectedCount} de ${totalCount} seleccionados`;
      }

      const liveCountEl = wizBody.querySelector('#aud-live-count');
      if (liveCountEl) {
        liveCountEl.textContent = selectedCount.toLocaleString();
      }

      const btnToggle = wizBody.querySelector('#btn-toggle-select-all');
      if (btnToggle) {
        const visibleItems = getFilteredLeads();
        const visibleKeys = visibleItems.map(l => l.itemKey || l.id);
        const allSelected = visibleKeys.length > 0 && visibleKeys.every(key => campaignData.audience_filters.selected_lead_ids.includes(key));
        btnToggle.textContent = allSelected ? 'Deseleccionar Todos' : 'Seleccionar Todos';
      }
    }
  }

  async function calculateAudienceLiveCount() {
    const liveCountEl = wizBody.querySelector('#aud-live-count');
    if (!liveCountEl) return;
    liveCountEl.textContent = '...';

    try {
      let query = supabase.from('leads').select('id', { count: 'exact', head: true });
      const f = campaignData.audience_filters;
      if (f.pipeline_stage_id) query = query.eq('pipeline_stage_id', f.pipeline_stage_id);
      if (f.country) query = query.ilike('country', f.country);
      if (f.days_inactive) {
        const daysAgo = new Date(Date.now() - parseInt(f.days_inactive, 10) * 24 * 60 * 60 * 1000).toISOString();
        query = query.lte('updated_at', daysAgo);
      }

      const { count } = await query;
      estimatedAudienceCount = count || 0;
      liveCountEl.textContent = estimatedAudienceCount.toLocaleString();
    } catch (e) {
      liveCountEl.textContent = '0';
    }
  }

  // ----------------------------------------------------
  // STEP 3: Contenido & Plantilla
  // ----------------------------------------------------
  async function renderStep3() {
    wizStepTitle.textContent = 'Contenido del Mensaje y Remitentes';

    if (campaignData.channel === 'email') {
      const { data: emailTemplates } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      const allProfiles = cache.getProfiles() || [];
      let senderProfiles = allProfiles.filter(p => p.is_mailing_sender);
      if (senderProfiles.length === 0) senderProfiles = allProfiles;

      wizBody.innerHTML = `
        <div class="flex flex-col gap-6 max-w-2xl mx-auto font-sans text-xs">
          <!-- Template Selector -->
          <div class="flex flex-col gap-2">
            <label for="select-email-tmpl-wiz" class="font-mono text-[10px] font-bold text-primary uppercase">Plantilla de Email *</label>
            <select id="select-email-tmpl-wiz" class="cohere-input text-xs font-medium">
              <option value="">-- Seleccionar Plantilla de Email --</option>
              ${(emailTemplates || []).map(t => `<option value="${t.id}" ${t.id === campaignData.email_template_id ? 'selected' : ''}>📄 ${t.name}</option>`).join('')}
            </select>
          </div>

          <!-- Subject & Body Preview -->
          <div id="email-tmpl-preview-box" class="p-4 bg-white border border-neutral-200 rounded-lg flex flex-col gap-2 shadow-inner min-h-[120px]">
            <span class="text-neutral-400 italic">Selecciona una plantilla para ver su previsualización...</span>
          </div>

          <!-- Commercial Senders Strategy -->
          <div class="flex flex-col gap-3 border-t border-neutral-200 pt-4">
            <label class="font-mono text-[10px] font-bold text-primary uppercase">Estrategia de Asignación de Remitente Comercial *</label>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label class="p-3 border ${campaignData.sender_strategy === 'lead_owner' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <input type="radio" name="wiz_sender_strategy" value="lead_owner" ${campaignData.sender_strategy === 'lead_owner' ? 'checked' : ''} class="accent-primary" />
                  <span class="font-bold text-primary text-xs">Comercial del Lead</span>
                </div>
                <span class="text-[10px] text-neutral-500">Envía desde la cuenta del comercial asignado a cada lead.</span>
              </label>

              <label class="p-3 border ${campaignData.sender_strategy === 'single' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <input type="radio" name="wiz_sender_strategy" value="single" ${campaignData.sender_strategy === 'single' ? 'checked' : ''} class="accent-primary" />
                  <span class="font-bold text-primary text-xs">Remitente Único</span>
                </div>
                <span class="text-[10px] text-neutral-500">Envía todos los emails de la campaña desde un único comercial.</span>
              </label>

              <label class="p-3 border ${campaignData.sender_strategy === 'round_robin' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-lg cursor-pointer flex flex-col gap-1">
                <div class="flex items-center gap-2">
                  <input type="radio" name="wiz_sender_strategy" value="round_robin" ${campaignData.sender_strategy === 'round_robin' ? 'checked' : ''} class="accent-primary" />
                  <span class="font-bold text-primary text-xs">Round-Robin</span>
                </div>
                <span class="text-[10px] text-neutral-500">Distribuye equitativamente los contactos entre los comerciales seleccionados.</span>
              </label>
            </div>

            <!-- Sender Profiles Selection Box -->
            <div id="senders-selection-container" class="mt-2 flex flex-col gap-2">
              <label class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Comerciales Remitentes Autorizados:</label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-neutral-50 p-3 rounded-lg border border-neutral-200 max-h-40 overflow-y-auto">
                ${senderProfiles.map(p => `
                  <label class="flex items-center gap-2 cursor-pointer text-xs">
                    <input type="checkbox" class="wiz-sender-checkbox accent-primary" value="${p.id}" ${(!campaignData.sender_profile_ids || campaignData.sender_profile_ids.includes(p.id)) ? 'checked' : ''} />
                    <span class="truncate">👔 ${p.full_name || p.email} (${p.mailing_email || p.email})</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      const selectTmpl = wizBody.querySelector('#select-email-tmpl-wiz');
      const previewBox = wizBody.querySelector('#email-tmpl-preview-box');

      selectTmpl.addEventListener('change', (e) => {
        campaignData.email_template_id = e.target.value;
        const tmpl = (emailTemplates || []).find(t => t.id === campaignData.email_template_id);
        if (tmpl) {
          campaignData.template_name = tmpl.name;
          previewBox.innerHTML = `
            <div><span class="font-bold text-neutral-800">Asunto:</span> ${tmpl.subject}</div>
            <div class="text-neutral-600 border-t border-neutral-100 pt-2 leading-relaxed whitespace-pre-wrap">${tmpl.body_html.replace(/<[^>]*>?/gm, '')}</div>
          `;
        } else {
          previewBox.innerHTML = `<span class="text-neutral-400 italic">Selecciona una plantilla para ver su previsualización...</span>`;
        }
      });

      if (campaignData.email_template_id) {
        selectTmpl.dispatchEvent(new Event('change'));
      }

      wizBody.querySelectorAll('input[name="wiz_sender_strategy"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          campaignData.sender_strategy = e.target.value;
        });
      });

      wizBody.querySelectorAll('.wiz-sender-checkbox').forEach(chk => {
        chk.addEventListener('change', () => {
          const checked = Array.from(wizBody.querySelectorAll('.wiz-sender-checkbox:checked')).map(c => c.value);
          campaignData.sender_profile_ids = checked;
        });
      });

      return;
    }

    if (metaTemplates.length === 0) {
      wizBody.innerHTML = `
        <div class="p-8 text-center text-neutral-400 font-mono text-xs">
          <span class="animate-pulse">🔄 Cargando plantillas aprobadas de Meta...</span>
        </div>
      `;
      await fetchTemplates();
    }

    wizBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Left: Template & Variables Mapping -->
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-mono text-[10px] font-bold text-primary uppercase">Plantilla de WhatsApp (Meta Approved) *</label>
            <select id="select-template" class="cohere-input text-xs font-medium">
              <option value="">-- Seleccionar Plantilla --</option>
              ${metaTemplates.map(t => `<option value="${t.name}" ${t.name === campaignData.template_name ? 'selected' : ''}>📄 ${t.name} (${t.language || 'es_AR'})</option>`).join('')}
            </select>
          </div>

          <div id="variables-mapping-container" class="flex flex-col gap-3 border-t border-neutral-200 pt-3">
            <span class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Mapeo de Variables Dinámicas y Fallbacks</span>
            <div id="var-mapping-list" class="flex flex-col gap-3">
              <p class="text-neutral-400 text-xs italic">Selecciona una plantilla para resolver sus variables dinámicas ({{1}}, {{2}}...)</p>
            </div>
          </div>
        </div>

        <!-- Right: Interactive WhatsApp Chat Preview -->
        <div class="bg-[#efeae2] p-4 rounded-xl border border-neutral-300 shadow-inner flex flex-col justify-between min-h-[320px]">
          <div class="bg-[#075e54] text-white p-2.5 rounded-t-lg flex items-center gap-2 text-xs font-mono font-bold shadow-xs">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>Vista Previa en Vivo (WhatsApp)</span>
          </div>

          <div class="bg-white p-3.5 rounded-lg shadow-sm max-w-[90%] self-start my-auto border border-neutral-100 flex flex-col gap-2 text-xs font-sans">
            <p id="chat-preview-text" class="whitespace-pre-line text-neutral-800 leading-relaxed">
              Selecciona una plantilla para previsualizar el mensaje...
            </p>
            <span class="text-[9px] text-neutral-400 text-right self-end">10:42 AM ✔️✔️</span>
          </div>

          <div class="text-[9px] text-neutral-500 font-mono text-center pt-2 border-t border-neutral-300/50">
            ℹ️ Las variables se reemplazarán automáticamente con los datos del Lead o con el valor por defecto configurado.
          </div>
        </div>

      </div>
    `;

    const selectTemplate = wizBody.querySelector('#select-template');
    selectTemplate.addEventListener('change', (e) => {
      campaignData.template_name = e.target.value;
      const selectedT = metaTemplates.find(t => t.name === campaignData.template_name);
      if (selectedT) {
        campaignData.template_components = selectedT.components || [];
        campaignData.template_language = selectedT.language || 'es_AR';
      }
      renderVariablesMapping();
    });

    if (campaignData.template_name) {
      renderVariablesMapping();
    }
  }

  function renderVariablesMapping() {
    const listContainer = wizBody.querySelector('#var-mapping-list');
    const previewText = wizBody.querySelector('#chat-preview-text');
    if (!listContainer) return;

    const selectedT = metaTemplates.find(t => t.name === campaignData.template_name);
    if (!selectedT) {
      listContainer.innerHTML = `<p class="text-neutral-400 text-xs italic">Selecciona una plantilla para resolver sus variables dinámicas.</p>`;
      if (previewText) previewText.textContent = 'Selecciona una plantilla...';
      return;
    }

    // Extract body component
    const bodyComp = (selectedT.components || []).find((c) => c.type === 'BODY');
    const bodyTextStr = bodyComp?.text || 'Mensaje de plantilla sin cuerpo de texto.';

    // Check for Media Header
    const headerMediaComp = (selectedT.components || []).find((c) => c.type === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(c.format));
    let mediaHeaderHtml = '';

    if (headerMediaComp) {
      const mediaLabel = headerMediaComp.format === 'IMAGE' ? 'Imagen' : headerMediaComp.format === 'VIDEO' ? 'Video' : 'Documento';
      const mediaAccept = headerMediaComp.format === 'IMAGE' ? 'image/*' : headerMediaComp.format === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx,.xlsx';

      mediaHeaderHtml = `
        <div class="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-col gap-2 mb-3">
          <label class="font-mono text-[10px] font-bold text-primary uppercase flex items-center gap-1.5">
            <span>🖼️</span> <span>${mediaLabel} de Encabezado de la Campaña (Requerida)</span>
          </label>
          <div class="flex flex-col gap-2">
            <div>
              <span class="text-[9px] text-neutral-500 font-medium block mb-1">Cargar desde tu PC:</span>
              <input type="file" id="wiz-header-file" accept="${mediaAccept}" class="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer w-full" />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[9px] text-neutral-400 uppercase font-bold">o URL directa:</span>
              <input type="url" id="wiz-header-url" placeholder="https://..." value="${campaignData.options?.header_media_url || ''}" class="cohere-input text-xs flex-1 py-1" />
            </div>
          </div>
          <div id="wiz-header-media-preview" class="${campaignData.options?.header_media_url ? '' : 'hidden'} mt-1">
            <img src="${campaignData.options?.header_media_url || ''}" alt="Vista previa" class="max-h-28 rounded border border-neutral-200 object-cover" />
          </div>
        </div>
      `;
    }

    // Extract variables {{1}}, {{2}}, etc.
    const matches = [...bodyTextStr.matchAll(/\{\{(\d+)\}\}/g)];
    const varNumbers = [...new Set(matches.map(m => m[1]))];

    let varsMappingHtml = '';
    if (varNumbers.length === 0) {
      varsMappingHtml = `<p class="text-emerald-600 text-xs font-medium">✓ Esta plantilla no requiere variables dinámicas en el cuerpo.</p>`;
    } else {
      varsMappingHtml = varNumbers.map(num => {
        const existing = campaignData.variable_mappings[num] || { field: 'lead.first_name', fallback: 'Cliente' };
        campaignData.variable_mappings[num] = existing;

        return `
          <div class="p-3 bg-white border border-neutral-200 rounded-lg flex flex-col gap-2">
            <span class="font-mono text-[9px] font-bold text-primary uppercase">Variable {{${num}}}</span>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label class="font-mono text-[8px] text-neutral-500 uppercase">Campo del Lead</label>
                <select data-var-num="${num}" class="var-field-select cohere-input text-xs">
                  <option value="lead.first_name" ${existing.field === 'lead.first_name' ? 'selected' : ''}>Nombre (lead.first_name)</option>
                  <option value="lead.company" ${existing.field === 'lead.company' ? 'selected' : ''}>Empresa (lead.company)</option>
                  <option value="lead.phone" ${existing.field === 'lead.phone' ? 'selected' : ''}>Teléfono (lead.phone)</option>
                  <option value="static:Texto" ${existing.field.startsWith('static:') ? 'selected' : ''}>Texto Fijo</option>
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-mono text-[8px] text-neutral-500 uppercase">Valor Fallback (Por defecto)</label>
                <input type="text" data-var-num="${num}" class="var-fallback-input cohere-input text-xs" placeholder="Ej. Cliente / Estimado" value="${existing.fallback || ''}" />
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    listContainer.innerHTML = mediaHeaderHtml + varsMappingHtml;

    // Media header input listeners
    if (headerMediaComp) {
      const fileInput = listContainer.querySelector('#wiz-header-file');
      const urlInput = listContainer.querySelector('#wiz-header-url');
      const imgPreview = listContainer.querySelector('#wiz-header-media-preview img');
      const previewContainer = listContainer.querySelector('#wiz-header-media-preview');

      if (fileInput) {
        fileInput.addEventListener('change', () => {
          if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (urlInput) urlInput.value = '';
            campaignData.header_file = file;
            if (file.type.startsWith('image/') && imgPreview && previewContainer) {
              imgPreview.src = URL.createObjectURL(file);
              previewContainer.classList.remove('hidden');
            } else if (previewContainer) {
              previewContainer.classList.add('hidden');
            }
          }
        });
      }

      if (urlInput) {
        urlInput.addEventListener('input', () => {
          const url = urlInput.value.trim();
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            if (fileInput) fileInput.value = '';
            campaignData.header_file = null;
            campaignData.options = { ...(campaignData.options || {}), header_media_url: url };
            if (headerMediaComp.format === 'IMAGE' && imgPreview && previewContainer) {
              imgPreview.src = url;
              previewContainer.classList.remove('hidden');
            }
          } else if (previewContainer) {
            previewContainer.classList.add('hidden');
          }
        });
      }
    }

    // Update listeners
    listContainer.querySelectorAll('.var-field-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const num = e.target.dataset.varNum;
        campaignData.variable_mappings[num].field = e.target.value;
        updatePreview(bodyTextStr);
      });
    });

    listContainer.querySelectorAll('.var-fallback-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const num = e.target.dataset.varNum;
        campaignData.variable_mappings[num].fallback = e.target.value;
        updatePreview(bodyTextStr);
      });
    });

    updatePreview(bodyTextStr);
  }

  function updatePreview(bodyTextStr) {
    const previewText = wizBody.querySelector('#chat-preview-text');
    if (!previewText) return;

    let rendered = bodyTextStr;
    Object.keys(campaignData.variable_mappings).forEach(num => {
      const config = campaignData.variable_mappings[num];
      const sampleVal = config.fallback || `[Variable {{${num}}}]`;
      rendered = rendered.replace(new RegExp(`\\{\\{${num}\\}\\}`, 'g'), sampleVal);
    });

    previewText.textContent = rendered;
  }

  // ----------------------------------------------------
  // STEP 4: Programación del Envío
  // ----------------------------------------------------
  function renderStep4() {
    wizStepTitle.textContent = 'Programación del Envío';

    const defaultDate = new Date().toISOString().split('T')[0];
    const defaultTime = '10:00';

    wizBody.innerHTML = `
      <div class="flex flex-col gap-6 max-w-xl mx-auto">
        <div class="flex flex-col gap-3">
          <label class="font-mono text-[10px] font-bold text-primary uppercase">Momento de Ejecución</label>

          <label class="p-4 border ${campaignData.send_type === 'immediate' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-xl cursor-pointer flex items-center gap-3">
            <input type="radio" name="wiz_send_type" value="immediate" ${campaignData.send_type === 'immediate' ? 'checked' : ''} class="accent-primary" />
            <div>
              <strong class="block text-xs text-primary">⚡ Enviar Inmediatamente</strong>
              <span class="block text-[10px] text-neutral-500">La campaña comenzará a procesarse en lotes tan pronto como confirmes el asistente.</span>
            </div>
          </label>

          <label class="p-4 border ${campaignData.send_type === 'scheduled' ? 'border-primary bg-primary/5' : 'border-neutral-200'} rounded-xl cursor-pointer flex items-center gap-3">
            <input type="radio" name="wiz_send_type" value="scheduled" ${campaignData.send_type === 'scheduled' ? 'checked' : ''} class="accent-primary" />
            <div>
              <strong class="block text-xs text-neutral-800">📅 Programar para Fecha y Hora Específica</strong>
              <span class="block text-[10px] text-neutral-500">La campaña permanecerá en estado Programada hasta la hora indicada.</span>
            </div>
          </label>
        </div>

        <div id="scheduled-datetime-container" class="${campaignData.send_type === 'scheduled' ? '' : 'hidden'} p-4 bg-white border border-neutral-200 rounded-xl grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Fecha de Envío *</label>
            <input type="date" id="input-sched-date" class="cohere-input text-xs" value="${defaultDate}" min="${defaultDate}" />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Hora de Envío (GMT-3) *</label>
            <input type="time" id="input-sched-time" class="cohere-input text-xs" value="${defaultTime}" />
          </div>
        </div>
      </div>
    `;

    wizBody.querySelectorAll('input[name="wiz_send_type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        campaignData.send_type = e.target.value;
        const container = wizBody.querySelector('#scheduled-datetime-container');
        if (campaignData.send_type === 'scheduled') {
          container.classList.remove('hidden');
        } else {
          container.classList.add('hidden');
          campaignData.scheduled_at = '';
        }
      });
    });
  }

  // ----------------------------------------------------
  // STEP 5: Opciones Operativas
  // ----------------------------------------------------
  function renderStep5() {
    wizStepTitle.textContent = 'Opciones de Control y Protección';

    wizBody.innerHTML = `
      <div class="flex flex-col gap-5 max-w-xl mx-auto">
        <h5 class="font-mono text-[10px] font-bold text-primary uppercase">Reglas de Ejecución (${campaignData.channel.toUpperCase()})</h5>

        ${campaignData.channel === 'whatsapp' ? `
          <div class="flex flex-col gap-3">
            <label class="p-3 border border-neutral-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-neutral-50">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-bold text-neutral-800">🛑 Detener ante Error Masivo</span>
                <span class="text-[10px] text-neutral-500">Pausa automáticamente la campaña si el porcentaje de rechazo en un lote supera el 20%.</span>
              </div>
              <input type="checkbox" id="opt-mass-error" ${campaignData.options.stop_on_mass_error ? 'checked' : ''} class="w-4 h-4 accent-primary" />
            </label>

            <label class="p-3 border border-neutral-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-neutral-50">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-bold text-neutral-800">🔄 Reintentar Automáticamente</span>
                <span class="text-[10px] text-neutral-500">Reintenta en el siguiente ciclo los mensajes que sufrieron fallos temporales de red.</span>
              </div>
              <input type="checkbox" id="opt-retry" ${campaignData.options.auto_retry ? 'checked' : ''} class="w-4 h-4 accent-primary" />
            </label>

            <label class="p-3 border border-neutral-200 rounded-lg flex items-center justify-between cursor-pointer hover:bg-neutral-50">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-bold text-neutral-800">📱 Filtrar Contactos sin WhatsApp Válido</span>
                <span class="text-[10px] text-neutral-500">Omite de la cola de envíos aquellos teléfonos con formato inválido o incompletos.</span>
              </div>
              <input type="checkbox" id="opt-valid-wa" ${campaignData.options.valid_whatsapp_only ? 'checked' : ''} class="w-4 h-4 accent-primary" />
            </label>
          </div>
        ` : `
          <p class="text-xs text-neutral-500 italic">Opciones avanzadas de email disponibles próximamente.</p>
        `}
      </div>
    `;

    const optMass = wizBody.querySelector('#opt-mass-error');
    const optRetry = wizBody.querySelector('#opt-retry');
    const optValid = wizBody.querySelector('#opt-valid-wa');

    if (optMass) optMass.addEventListener('change', (e) => campaignData.options.stop_on_mass_error = e.target.checked);
    if (optRetry) optRetry.addEventListener('change', (e) => campaignData.options.auto_retry = e.target.checked);
    if (optValid) optValid.addEventListener('change', (e) => campaignData.options.valid_whatsapp_only = e.target.checked);
  }

  // ----------------------------------------------------
  // STEP 6: Resumen y Confirmación
  // ----------------------------------------------------
  function renderStep6() {
    wizStepTitle.textContent = 'Resumen y Confirmación Final';

    const selectedPhoneObj = phoneNumbers.find(p => p.id === campaignData.phone_number_id) || {};
    const selectedPhoneLabel = selectedPhoneObj.verified_name || selectedPhoneObj.display_phone_number || campaignData.phone_number_id;

    const selectedCount = (campaignData.audience_filters.selected_lead_ids || []).length;
    const finalRecipientsCount = campaignData.audience_type === 'static_segment' ? selectedCount : estimatedAudienceCount;
    
    let audienceTypeLabel = '⚡ Segmento Dinámico';
    if (campaignData.audience_type === 'static_segment') {
      audienceTypeLabel = `📌 Segmento Estático (${selectedCount} tildados)`;
    } else if (campaignData.audience_type === 'all') {
      audienceTypeLabel = '🌐 Todos los Leads';
    }

    wizBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Summary Cards -->
        <div class="flex flex-col gap-3">
          <div class="p-4 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3 shadow-xs">
            <h5 class="font-mono text-[10px] font-bold text-primary uppercase border-b border-neutral-200 pb-1">Ficha de la Campaña</h5>
            
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Nombre</span>
                <strong class="text-neutral-800">${campaignData.name || 'Sin Nombre'}</strong>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Canal</span>
                <span class="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">🟢 ${campaignData.channel.toUpperCase()}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Tipo de Audiencia</span>
                <span class="font-bold text-primary text-xs">${audienceTypeLabel}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Número Remitente</span>
                <span class="font-mono text-neutral-700">${selectedPhoneLabel}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Objetivo</span>
                <span class="capitalize text-neutral-700">${campaignData.objective}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Plantilla</span>
                <span class="font-mono text-primary font-bold">${campaignData.template_name || 'N/A'}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Momento de Envío</span>
                <span class="font-bold text-neutral-800">${campaignData.send_type === 'immediate' ? '⚡ Inmediato' : '📅 Programado'}</span>
              </div>
            </div>
          </div>

          <!-- Cost & Audience Estimation -->
          <div class="p-4 bg-neutral-900 text-white rounded-xl flex justify-between items-center shadow-xs">
            <div>
              <span class="font-mono text-[9px] text-neutral-400 uppercase block">Destinatarios Seleccionados</span>
              <strong class="text-2xl font-mono text-white">${finalRecipientsCount.toLocaleString()}</strong>
            </div>

            <div class="text-right">
              <span class="font-mono text-[9px] text-neutral-400 uppercase block">Costo Estimado</span>
              <span class="text-emerald-400 font-mono text-sm font-bold">Gratis (Marketing Lite)</span>
            </div>
          </div>
        </div>

        <!-- Preview Card -->
        <div class="p-4 bg-neutral-100 border border-neutral-200 rounded-xl flex flex-col gap-2">
          <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">Vista Previa Final</span>
          <div class="p-3 bg-white border border-neutral-200 rounded-lg text-xs font-sans text-neutral-800 leading-relaxed">
            ${campaignData.template_name ? `Plantilla Meta: <strong>${campaignData.template_name}</strong>` : 'Sin plantilla seleccionada.'}
          </div>
        </div>

      </div>
    `;
  }

  // ----------------------------------------------------
  // NAVIGATION & SUBMISSION
  // ----------------------------------------------------
  btnNext.addEventListener('click', async () => {
    // Validate Current Step
    if (currentStep === 1) {
      if (!campaignData.name.trim()) {
        toast.show('Por favor ingresa un nombre para la campaña', 'error');
        return;
      }
      if (campaignData.channel === 'whatsapp' && !campaignData.phone_number_id) {
        toast.show('Selecciona un número remitente de WhatsApp', 'error');
        return;
      }
    }

    if (currentStep === 3) {
      if (campaignData.channel === 'whatsapp' && !campaignData.template_name) {
        toast.show('Por favor selecciona una plantilla de WhatsApp', 'error');
        return;
      }
    }

    if (currentStep === 4 && campaignData.send_type === 'scheduled') {
      const dateVal = wizBody.querySelector('#input-sched-date')?.value;
      const timeVal = wizBody.querySelector('#input-sched-time')?.value;
      if (!dateVal || !timeVal) {
        toast.show('Por favor ingresa la fecha y hora de programación', 'error');
        return;
      }
      campaignData.scheduled_at = new Date(`${dateVal}T${timeVal}:00`).toISOString();
    }

    if (currentStep < totalSteps) {
      await renderStep(currentStep + 1);
    } else {
      // Final Submit
      await submitCampaign();
    }
  });

  btnPrev.addEventListener('click', async () => {
    if (currentStep > 1) {
      await renderStep(currentStep - 1);
    }
  });

  async function submitCampaign() {
    btnNext.disabled = true;
    btnNext.textContent = 'Guardando...';

    try {
      if (campaignData.header_file) {
        btnNext.textContent = 'Subiendo imagen/archivo...';
        const file = campaignData.header_file;
        const fileExt = file.name.split('.').pop();
        const filePath = `campaigns/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage.from('whatsapp-media').upload(filePath, file);
        if (uploadErr) {
          toast.show(`Error al subir archivo de encabezado de la campaña: ${uploadErr.message}`, 'error');
          btnNext.disabled = false;
          btnNext.textContent = 'Crear y Lanzar Campaña 🚀';
          return;
        }

        const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
        const mediaUrl = publicUrlData?.publicUrl || null;
        campaignData.options = { ...(campaignData.options || {}), header_media_url: mediaUrl };
      }

      const user = await auth.getCurrentUser();
      const payload = {
        phone_number_id: campaignData.phone_number_id || 'email_channel',
        name: campaignData.name.trim(),
        description: campaignData.description.trim(),
        channel: campaignData.channel,
        objective: campaignData.objective,
        status: campaignData.send_type === 'immediate' ? 'programada' : 'programada',
        send_type: campaignData.send_type,
        scheduled_at: campaignData.send_type === 'scheduled' ? campaignData.scheduled_at : new Date().toISOString(),
        audience_type: campaignData.audience_type,
        audience_filters: campaignData.audience_filters,
        template_name: campaignData.template_name,
        template_language: campaignData.template_language,
        template_components: campaignData.template_components,
        variable_mappings: campaignData.variable_mappings,
        email_template_id: campaignData.email_template_id || null,
        sender_strategy: campaignData.sender_strategy || 'lead_owner',
        sender_profile_ids: campaignData.sender_profile_ids || [],
        options: campaignData.options,
        created_by: user?.id
      };

      const { data, error } = await supabase
        .from('campaigns')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // Insert campaign creation notification for team members
      try {
        const { data: profiles } = await supabase.from('profiles').select('id');
        if (profiles && profiles.length > 0) {
          const notifs = profiles.map(p => ({
            user_id: p.id,
            title: `📢 Nueva Campaña Creada: "${data.name}"`,
            message: `Canal ${data.channel ? data.channel.toUpperCase() : 'WHATSAPP'} · Objetivo: ${data.objective || 'General'}.`,
            type: 'campaign_created',
            is_read: false
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch (nErr) {
        console.error('Error inserting campaign notification:', nErr);
      }

      toast.show('¡Campaña creada y programada con éxito!', 'success');
      modalOverlay.remove();
      if (onSuccess) onSuccess(data);

      // Trigger appropriate runner based on channel
      const headers = await getAuthHeaders();
      const runnerEndpoint = campaignData.channel === 'email' ? 'email-campaign-runner' : 'whatsapp-campaign-runner';
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${runnerEndpoint}`, {
        method: 'POST',
        headers
      }).catch(() => {});

    } catch (err) {
      console.error('Error submitting campaign:', err);
      toast.show('Error al crear campaña: ' + err.message, 'error');
    } finally {
      btnNext.disabled = false;
    }
  }
}
