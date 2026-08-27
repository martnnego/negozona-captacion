import { supabase, fetchAllRows } from '../lib/supabase';
import { cache } from '../lib/cache';

/**
 * Componente modular de segmentación de audiencia para automatizaciones.
 * Idéntico a la experiencia del asistente de campañas (Paso 2 Audiencia).
 * 
 * @param {Object} options
 * @param {string} options.audienceType - 'dynamic_segment' | 'static_segment' | 'all'
 * @param {Object} options.audienceFilters - Filtros actuales { pipeline_stage_id, country, days_inactive, selected_contact_ids, selected_lead_ids }
 * @param {Function} options.onChange - Callback cuando cambian los filtros o tipo de audiencia
 * @returns {HTMLElement}
 */
export function createAudienceSegmenter({ audienceType = 'dynamic_segment', audienceFilters = {}, onChange }) {
  const container = document.createElement('div');
  container.className = 'w-full bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs font-sans text-xs space-y-4';

  let currentType = audienceType || 'dynamic_segment';
  let currentFilters = {
    pipeline_stage_id: audienceFilters.pipeline_stage_id || '',
    country: audienceFilters.country || '',
    days_inactive: audienceFilters.days_inactive || '',
    selected_contact_ids: Array.isArray(audienceFilters.selected_contact_ids) ? [...audienceFilters.selected_contact_ids] : [],
    selected_lead_ids: Array.isArray(audienceFilters.selected_lead_ids) ? [...audienceFilters.selected_lead_ids] : []
  };

  let allLeadsRows = [];
  let allLinksRows = [];
  let allContactsRows = [];
  let contactsMap = new Map();
  let linksByLead = new Map();

  let fetchedContactItems = [];
  let qualifyingItems = [];
  let searchQuery = '';

  let pipelineStages = cache.getStages() || [];
  const countriesList = ['Argentina', 'Chile', 'España', 'México', 'Uruguay'];

  container.innerHTML = `
    <div class="flex items-center justify-between border-b border-neutral-200 pb-3">
      <div class="flex items-center gap-2">
        <span class="text-base">🎯</span>
        <div>
          <h4 class="font-bold text-neutral-900 font-mono text-[11px] uppercase tracking-wider">Segmentación de Audiencia</h4>
          <p class="text-[10px] text-neutral-500">Define sobre qué prospectos y contactos aplicará esta automatización</p>
        </div>
      </div>
      
      <!-- Live Count Pill -->
      <div class="flex items-center gap-2 px-3 py-1 bg-neutral-900 text-white rounded-full font-mono text-[10px] shadow-2xs">
        <span class="text-emerald-400">●</span>
        <span id="seg-live-counter" class="font-bold">Calculando...</span>
      </div>
    </div>

    <!-- Audience Mode Selector -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      <label class="p-3 border rounded-xl cursor-pointer flex items-start gap-2.5 transition-all ${currentType === 'dynamic_segment' ? 'border-primary bg-primary/5 shadow-2xs' : 'border-neutral-200 hover:border-neutral-300'}">
        <input type="radio" name="seg_aud_type" value="dynamic_segment" ${currentType === 'dynamic_segment' ? 'checked' : ''} class="mt-0.5 accent-primary cursor-pointer" />
        <div>
          <strong class="block text-neutral-900 text-[11px]">⚡ Segmento Dinámico</strong>
          <span class="block text-[10px] text-neutral-500 mt-0.5 leading-tight">Filtra automáticamente a los prospectos al momento exacto de cada ejecución.</span>
        </div>
      </label>

      <label class="p-3 border rounded-xl cursor-pointer flex items-start gap-2.5 transition-all ${currentType === 'static_segment' ? 'border-primary bg-primary/5 shadow-2xs' : 'border-neutral-200 hover:border-neutral-300'}">
        <input type="radio" name="seg_aud_type" value="static_segment" ${currentType === 'static_segment' ? 'checked' : ''} class="mt-0.5 accent-primary cursor-pointer" />
        <div>
          <strong class="block text-neutral-900 text-[11px]">📌 Segmento Estático</strong>
          <span class="block text-[10px] text-neutral-500 mt-0.5 leading-tight">Permite buscar y seleccionar una lista fija y congelada de destinatarios.</span>
        </div>
      </label>

      <label class="p-3 border rounded-xl cursor-pointer flex items-start gap-2.5 transition-all ${currentType === 'all' ? 'border-primary bg-primary/5 shadow-2xs' : 'border-neutral-200 hover:border-neutral-300'}">
        <input type="radio" name="seg_aud_type" value="all" ${currentType === 'all' ? 'checked' : ''} class="mt-0.5 accent-primary cursor-pointer" />
        <div>
          <strong class="block text-neutral-900 text-[11px]">👥 Todos los Contactos</strong>
          <span class="block text-[10px] text-neutral-500 mt-0.5 leading-tight">Aplica a todos los contactos activos registrados en el CRM.</span>
        </div>
      </label>
    </div>

    <!-- Filter Criteria Form -->
    <div id="seg-filters-container" class="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3 ${currentType === 'all' ? 'hidden' : ''}">
      <div class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Reglas de Filtrado de Leads</div>
      
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-1 font-bold">Etapa del Pipeline</label>
          <select id="seg-filter-stage" class="cohere-select text-xs w-full">
            <option value="">Todas las etapas (${pipelineStages.length})</option>
            ${pipelineStages.map(s => `<option value="${s.id}" ${currentFilters.pipeline_stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-1 font-bold">País</label>
          <select id="seg-filter-country" class="cohere-select text-xs w-full">
            <option value="">Todos los países</option>
            ${countriesList.map(c => `<option value="${c}" ${currentFilters.country === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-1 font-bold">Inactividad Comercial</label>
          <select id="seg-filter-inactivity" class="cohere-select text-xs w-full">
            <option value="">Sin filtro de inactividad</option>
            <option value="7" ${currentFilters.days_inactive === '7' ? 'selected' : ''}>Más de 7 días sin gestión</option>
            <option value="15" ${currentFilters.days_inactive === '15' ? 'selected' : ''}>Más de 15 días sin gestión</option>
            <option value="30" ${currentFilters.days_inactive === '30' ? 'selected' : ''}>Más de 30 días sin gestión</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Static Checklist Table (Visible only for static_segment) -->
    <div id="seg-static-container" class="space-y-2.5 ${currentType === 'static_segment' ? '' : 'hidden'}">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] font-bold text-neutral-700 uppercase">Selección de Contactos:</span>
          <span id="seg-selected-count-badge" class="px-2 py-0.5 bg-primary/10 text-primary font-mono font-bold text-[9px] rounded-full">
            0 seleccionados
          </span>
        </div>

        <div class="flex items-center gap-1.5">
          <button type="button" id="btn-seg-select-all" class="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 font-mono text-[9px] font-bold rounded cursor-pointer transition-colors shadow-2xs">
            Seleccionar Todos
          </button>
          <button type="button" id="btn-seg-deselect-all" class="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 font-mono text-[9px] font-bold rounded cursor-pointer transition-colors shadow-2xs">
            Deseleccionar Todos
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="relative w-full">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs pointer-events-none">🔍</span>
        <input type="text" id="seg-contact-search" class="cohere-input text-xs w-full !pl-8" placeholder="Buscar por nombre, empresa o teléfono..." />
      </div>

      <!-- Scrollable List of Contacts -->
      <div id="seg-checklist-box" class="max-h-56 overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100 bg-neutral-50/50 text-xs">
        <div class="p-6 text-center text-neutral-400 font-mono text-xs animate-pulse">
          🔄 Cargando lista de contactos...
        </div>
      </div>
    </div>
  `;

  // Attach Event Listeners
  const radioTypes = container.querySelectorAll('input[name="seg_aud_type"]');
  const filtersContainer = container.querySelector('#seg-filters-container');
  const staticContainer = container.querySelector('#seg-static-container');
  const filterStage = container.querySelector('#seg-filter-stage');
  const filterCountry = container.querySelector('#seg-filter-country');
  const filterInactivity = container.querySelector('#seg-filter-inactivity');
  const searchInput = container.querySelector('#seg-contact-search');
  const btnSelectAll = container.querySelector('#btn-seg-select-all');
  const btnDeselectAll = container.querySelector('#btn-seg-deselect-all');

  radioTypes.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentType = e.target.value;
      
      container.querySelectorAll('input[name="seg_aud_type"]').forEach(r => {
        const label = r.closest('label');
        if (r.checked) {
          label.className = 'p-3 border rounded-xl cursor-pointer flex items-start gap-2.5 transition-all border-primary bg-primary/5 shadow-2xs';
        } else {
          label.className = 'p-3 border rounded-xl cursor-pointer flex items-start gap-2.5 transition-all border-neutral-200 hover:border-neutral-300';
        }
      });

      if (currentType === 'all') {
        filtersContainer.classList.add('hidden');
        staticContainer.classList.add('hidden');
      } else if (currentType === 'dynamic_segment') {
        filtersContainer.classList.remove('hidden');
        staticContainer.classList.add('hidden');
      } else if (currentType === 'static_segment') {
        filtersContainer.classList.remove('hidden');
        staticContainer.classList.remove('hidden');
      }

      triggerChange();
      evaluateAndRender();
    });
  });

  filterStage.addEventListener('change', (e) => {
    currentFilters.pipeline_stage_id = e.target.value;
    triggerChange();
    evaluateAndRender();
  });

  filterCountry.addEventListener('change', (e) => {
    currentFilters.country = e.target.value;
    triggerChange();
    evaluateAndRender();
  });

  filterInactivity.addEventListener('change', (e) => {
    currentFilters.days_inactive = e.target.value;
    triggerChange();
    evaluateAndRender();
  });

  searchInput.addEventListener('input', (e) => {
    searchQuery = (e.target.value || '').toLowerCase().trim();
    renderStaticChecklist();
  });

  btnSelectAll.addEventListener('click', () => {
    currentFilters.selected_contact_ids = qualifyingItems.map(c => c.contact_id).filter(Boolean);
    currentFilters.selected_lead_ids = qualifyingItems.map(c => c.itemKey);
    updateSelectedCountBadge();
    renderStaticChecklist();
    triggerChange();
  });

  btnDeselectAll.addEventListener('click', () => {
    currentFilters.selected_contact_ids = [];
    currentFilters.selected_lead_ids = [];
    updateSelectedCountBadge();
    renderStaticChecklist();
    triggerChange();
  });

  function triggerChange() {
    if (typeof onChange === 'function') {
      onChange({
        audience_type: currentType,
        audience_filters: currentFilters
      });
    }
  }

  function updateSelectedCountBadge() {
    const badge = container.querySelector('#seg-selected-count-badge');
    if (badge) {
      const count = currentFilters.selected_lead_ids?.length || currentFilters.selected_contact_ids?.length || 0;
      badge.textContent = `${count} seleccionados`;
    }
  }

  async function loadDataAndInit() {
    try {
      // Ensure pipeline stages
      if (!pipelineStages || pipelineStages.length === 0) {
        const { data: stages } = await supabase.from('pipeline_stages').select('*').order('position', { ascending: true });
        pipelineStages = stages || [];
        const stageSelect = container.querySelector('#seg-filter-stage');
        if (stageSelect) {
          stageSelect.innerHTML = `
            <option value="">Todas las etapas (${pipelineStages.length})</option>
            ${pipelineStages.map(s => `<option value="${s.id}" ${currentFilters.pipeline_stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          `;
        }
      }

      // Fetch leads, links, and contacts using fetchAllRows exactly like Campaigns
      const [leadsData, linksData, contactsData] = await Promise.all([
        fetchAllRows('leads', 'id, company, country, primary_contact_id, pipeline_stage_id, updated_at, created_at'),
        fetchAllRows('lead_contacts_link', 'lead_id, contact_id', { orderCol: 'lead_id' }),
        fetchAllRows('contacts', 'id, first_name, last_name, phone, email')
      ]);

      allLeadsRows = leadsData || [];
      allLinksRows = linksData || [];
      allContactsRows = contactsData || [];

      if (allLeadsRows.length === 0 && cache.isLoaded && cache.leads) {
        allLeadsRows = cache.leads;
      }

      contactsMap.clear();
      allContactsRows.forEach(c => contactsMap.set(c.id, c));
      if (cache.isLoaded && cache.contacts) {
        cache.contacts.forEach((c, id) => {
          if (!contactsMap.has(id)) contactsMap.set(id, c);
        });
      }

      linksByLead.clear();
      allLinksRows.forEach(link => {
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

      evaluateAndRender();

    } catch (err) {
      console.error('Error loading contacts for segmenter:', err);
      const counter = container.querySelector('#seg-live-counter');
      if (counter) counter.textContent = 'Error al calcular';
    }
  }

  function evaluateAndRender() {
    const now = new Date().getTime();
    let leadRows = [...allLeadsRows];

    if (currentType !== 'all') {
      // Stage filter
      if (currentFilters.pipeline_stage_id) {
        leadRows = leadRows.filter(l => l.pipeline_stage_id === currentFilters.pipeline_stage_id);
      }

      // Country filter
      if (currentFilters.country) {
        const targetCountry = currentFilters.country.trim().toLowerCase();
        leadRows = leadRows.filter(l => (l.country || '').trim().toLowerCase() === targetCountry);
      }

      // Inactivity filter
      if (currentFilters.days_inactive) {
        const daysAgo = now - parseInt(currentFilters.days_inactive, 10) * 24 * 60 * 60 * 1000;
        leadRows = leadRows.filter(l => {
          const upTime = l.updated_at ? new Date(l.updated_at).getTime() : (l.created_at ? new Date(l.created_at).getTime() : 0);
          return upTime <= daysAgo;
        });
      }
    }

    // Build contact checklist items
    const contactItems = [];

    for (const l of leadRows) {
      const companyName = l.company ? l.company.trim() : '';
      const contactIds = [...(linksByLead.get(l.id) || [])];

      if (l.primary_contact_id && !contactIds.includes(l.primary_contact_id)) {
        contactIds.unshift(l.primary_contact_id);
      }

      const linkedContacts = contactIds.map(cId => contactsMap.get(cId)).filter(Boolean);

      if (linkedContacts.length > 0) {
        linkedContacts.forEach(c => {
          const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Contacto sin nombre';
          const phoneNum = c.phone || '';
          const emailAddr = c.email || '';

          contactItems.push({
            itemKey: `${l.id}_${c.id}`,
            lead_id: l.id,
            contact_id: c.id,
            name: fullName,
            company: companyName,
            phone: phoneNum,
            email: emailAddr,
            pipeline_stage_id: l.pipeline_stage_id,
            searchableText: `${fullName} ${companyName} ${phoneNum} ${emailAddr}`.toLowerCase()
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
          email: '',
          pipeline_stage_id: l.pipeline_stage_id,
          searchableText: `${title}`.toLowerCase()
        });
      }
    }

    qualifyingItems = contactItems;

    // Default static selection if empty
    if (currentType === 'static_segment') {
      if (!currentFilters.selected_lead_ids || currentFilters.selected_lead_ids.length === 0) {
        currentFilters.selected_lead_ids = qualifyingItems.map(item => item.itemKey);
        currentFilters.selected_contact_ids = qualifyingItems.map(item => item.contact_id).filter(Boolean);
      }
    }

    const liveCounter = container.querySelector('#seg-live-counter');
    if (currentType === 'static_segment') {
      const selectedTotal = currentFilters.selected_lead_ids?.length || 0;
      liveCounter.textContent = `${selectedTotal} seleccionados`;
    } else {
      liveCounter.textContent = `${qualifyingItems.length} contactos calificados`;
    }

    updateSelectedCountBadge();

    if (currentType === 'static_segment') {
      renderStaticChecklist();
    }
  }

  function renderStaticChecklist() {
    const listBox = container.querySelector('#seg-checklist-box');
    if (!listBox) return;

    let displayList = qualifyingItems;
    if (searchQuery) {
      displayList = displayList.filter(item => item.searchableText.includes(searchQuery));
    }

    if (displayList.length === 0) {
      listBox.innerHTML = `
        <div class="p-6 text-center text-neutral-400 font-mono text-xs">
          No hay contactos que coincidan con la búsqueda o los filtros actuales.
        </div>
      `;
      return;
    }

    listBox.innerHTML = displayList.map(item => {
      const isChecked = (currentFilters.selected_lead_ids && currentFilters.selected_lead_ids.includes(item.itemKey)) ||
                        (item.contact_id && currentFilters.selected_contact_ids && currentFilters.selected_contact_ids.includes(item.contact_id));
      const company = item.company ? `(${item.company})` : '';

      return `
        <label class="p-2.5 hover:bg-white flex items-center justify-between gap-3 cursor-pointer transition-colors">
          <div class="flex items-center gap-2.5 min-w-0">
            <input type="checkbox" class="seg-contact-check accent-primary cursor-pointer" data-key="${item.itemKey}" data-cid="${item.contact_id || ''}" ${isChecked ? 'checked' : ''} />
            <div class="truncate">
              <span class="font-bold text-neutral-800">${item.name}</span>
              <span class="text-[11px] text-neutral-500 font-mono">${company}</span>
            </div>
          </div>
          <div class="text-[10px] font-mono text-neutral-400 shrink-0">
            ${item.phone || item.email || 'Sin datos'}
          </div>
        </label>
      `;
    }).join('');

    listBox.querySelectorAll('.seg-contact-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const itemKey = e.target.dataset.key;
        const cid = e.target.dataset.cid;

        if (!currentFilters.selected_lead_ids) currentFilters.selected_lead_ids = [];
        if (!currentFilters.selected_contact_ids) currentFilters.selected_contact_ids = [];

        if (e.target.checked) {
          if (!currentFilters.selected_lead_ids.includes(itemKey)) {
            currentFilters.selected_lead_ids.push(itemKey);
          }
          if (cid && !currentFilters.selected_contact_ids.includes(cid)) {
            currentFilters.selected_contact_ids.push(cid);
          }
        } else {
          currentFilters.selected_lead_ids = currentFilters.selected_lead_ids.filter(k => k !== itemKey);
          if (cid) {
            currentFilters.selected_contact_ids = currentFilters.selected_contact_ids.filter(id => id !== cid);
          }
        }

        updateSelectedCountBadge();
        const liveCounter = container.querySelector('#seg-live-counter');
        liveCounter.textContent = `${currentFilters.selected_lead_ids.length} seleccionados`;
        triggerChange();
      });
    });
  }

  loadDataAndInit();

  return container;
}
