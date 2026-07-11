import { supabase, fetchAllLeads } from '../lib/supabase';
import { cache } from '../lib/cache';
import { renderStageCards } from '../components/stage-cards';
import { renderFilters } from '../components/filters';
import { renderPagination } from '../components/pagination';
import { renderLeadRow } from '../components/lead-row';
import { renderLeadDetail } from './lead-detail';
import { modal } from '../components/modal';
import { toast } from '../components/toast';


export function renderLeadsTable(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none';

  // State
  let leads = [];
  let stageCounts = {};
  let totalRows = 0;
  let currentPage = 1;
  let rowsPerPage = parseInt(localStorage.getItem('table_rows_per_page')) || 25;
  let sortColumn = 'created_at';
  let sortAscending = false;
  // Period filter: 30, 90, 180 days, or 0 = all time
  let periodDays = parseInt(localStorage.getItem('table_period_days') || '30');
  let activePipelineMode = localStorage.getItem('crm_active_pipeline_mode') || 'comercial'; // 'comercial' or 'franquiday'

  let activeFilters = {
    search: '',
    stageId: '',
    assignedTo: '',
    country: '',
    valoracion: ''
  };

  const selectedLeadIds = new Set();
  const isAdmin = currentUser?.profile?.role === 'super_admin';

  // Top Section Structure
  container.innerHTML = `
    <!-- Header Title -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6">
      <div class="flex flex-col md:flex-row md:items-center gap-4">
        <div>
          <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Embudo de Captación</h2>
          <p class="text-xs text-muted-slate mt-1">Gestión administrativa y asignación de leads de expansión</p>
        </div>

        <!-- Pipeline Mode Toggle Switch -->
        <div class="flex items-center bg-neutral-100 p-0.5 rounded-full border border-neutral-200 select-none max-w-fit mt-1 md:mt-0" id="pipeline-mode-toggle">
          <button data-mode="comercial" class="mode-btn px-3 py-1 rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            activePipelineMode === 'comercial'
              ? 'bg-white shadow-xs text-primary'
              : 'text-[#616161] hover:text-primary'
          }">💼 Comercial</button>
          <button data-mode="franquiday" class="mode-btn px-3 py-1 rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
            activePipelineMode === 'franquiday'
              ? 'bg-white shadow-xs text-primary'
              : 'text-[#616161] hover:text-primary'
          }">🎪 Franquiday</button>
        </div>
      </div>
      
      <!-- Period Filter + Actions -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 select-none">
        <!-- Period Pills -->
        <div class="flex items-center gap-1" id="period-pills">
          ${[{label:'30 días', val:30}, {label:'90 días', val:90}, {label:'180 días', val:180}, {label:'Todo', val:0}].map(p => `
            <button data-period="${p.val}" class="period-btn px-3 py-1.5 border rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
              periodDays === p.val
                ? 'bg-primary border-primary text-white'
                : 'bg-white border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary'
            }">${p.label}</button>
          `).join('')}
        </div>
        <div class="flex items-center gap-3">
        <button id="add-lead-btn" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 shadow-xs flex items-center gap-1.5 focus:outline-none">
          <span>+ Nueva Empresa</span>
        </button>
        </div>
      </div>
    </div>

    <!-- Stage Metrics cards -->
    <div id="stage-cards-container"></div>

    <!-- Filters container -->
    <div id="filters-container"></div>

    <!-- Table Container -->
    <div class="relative bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col min-h-[300px]">
      <div class="overflow-x-auto flex-1">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
              <th class="px-4 py-3 text-center shrink-0 w-12">
                <input type="checkbox" id="master-checkbox" class="rounded-xs border-neutral-300 text-primary focus:ring-primary h-3.5 w-3.5" />
              </th>
              <th data-col="first_name" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Nombre</th>
              <th data-col="company" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Empresa</th>
              <th data-col="country" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">País</th>
              <th data-col="email" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Email</th>
              <th data-col="phone" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Teléfono</th>
              <th data-col="pipeline_stage_id" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Etapa</th>
              <th data-col="assigned_to" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Comercial</th>
              <th data-col="fecha_ultimo_contacto" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Última Gestión</th>
              <th data-col="valoracion" class="sort-header px-6 py-3 cursor-pointer hover:text-primary transition-colors">Val.</th>
            </tr>
          </thead>
          <tbody id="leads-tbody" class="divide-y divide-[#e5e7eb]">
            <!-- Row items go here -->
            <tr>
              <td colspan="10" class="py-12 text-center text-xs text-neutral-400 font-sans">
                Cargando leads...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Container -->
      <div id="pagination-container" class="px-6"></div>
    </div>
  `;

  // Attach pipeline mode toggle handler
  container.querySelectorAll('#pipeline-mode-toggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePipelineMode = btn.dataset.mode;
      localStorage.setItem('crm_active_pipeline_mode', activePipelineMode);
      
      // Update UI styles
      container.querySelectorAll('#pipeline-mode-toggle .mode-btn').forEach(b => {
        b.className = b.className.replace('bg-white shadow-xs text-primary', 'text-[#616161] hover:text-primary');
      });
      btn.className = btn.className.replace('text-[#616161] hover:text-primary', 'bg-white shadow-xs text-primary');

      // Reload
      currentPage = 1;
      selectedLeadIds.clear();
      updateMassActionsBar();
      loadData();
    });
  });

  // Build the floating mass-actions bar and attach to document.body so that
  // `position: fixed` is always relative to the real viewport, never clipped
  // by a transformed/overflow ancestor inside the layout.
  const massBar = document.createElement('div');
  massBar.id = 'mass-actions-bar';
  massBar.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary border border-neutral-800 text-white rounded-full px-6 py-3 shadow-xl z-[9999] items-center gap-4 transition-all duration-300 translate-y-24 opacity-0 flex select-none pointer-events-none';
  massBar.innerHTML = `
    <span class="font-sans text-[11px] font-semibold"><span id="selected-count" class="font-mono bg-coral text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-1.5">0</span> leads seleccionados</span>
    <div class="h-4 w-px bg-neutral-700"></div>
    <div class="flex items-center gap-2">
      <select id="mass-action-type" class="bg-neutral-900 border border-neutral-700 rounded-sm py-1.5 px-3 font-mono text-[9px] font-bold text-white focus:outline-none uppercase tracking-wider">
        <option value="">SELECCIONAR ACCIÓN</option>
        <option value="assign">ASIGNAR COMERCIAL</option>
        <option value="stage">CAMBIAR ETAPA</option>
      </select>
      <select id="mass-action-value" class="bg-neutral-900 border border-neutral-700 rounded-sm py-1.5 px-3 font-mono text-[9px] font-bold text-white focus:outline-none uppercase tracking-wider hidden">
        <!-- Populated dynamically -->
      </select>
      <button id="apply-mass-btn" class="px-3 py-1.5 bg-white hover:bg-neutral-100 text-primary text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
        Aplicar
      </button>
    </div>
    <button id="cancel-mass-btn" class="text-neutral-400 hover:text-white font-mono text-[10px] uppercase font-bold focus:outline-none">✕</button>
  `;
  document.body.appendChild(massBar);

  const tbody = container.querySelector('#leads-tbody');
  const masterCheckbox = container.querySelector('#master-checkbox');
  const selectedCountSpan = massBar.querySelector('#selected-count');
  const massActionType = massBar.querySelector('#mass-action-type');
  const massActionValue = massBar.querySelector('#mass-action-value');
  const applyMassBtn = massBar.querySelector('#apply-mass-btn');
  const cancelMassBtn = massBar.querySelector('#cancel-mass-btn');

  // Trigger loading
  loadData();

  // Period filter pills
  container.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      periodDays = parseInt(btn.dataset.period);
      localStorage.setItem('table_period_days', String(periodDays));
      // Update pill styles
      container.querySelectorAll('.period-btn').forEach(b => {
        b.classList.remove('bg-primary', 'border-primary', 'text-white');
        b.classList.add('bg-white', 'border-[#d9d9dd]', 'text-[#616161]');
      });
      btn.classList.add('bg-primary', 'border-primary', 'text-white');
      btn.classList.remove('bg-white', 'border-[#d9d9dd]', 'text-[#616161]');
      // Reset page and reload
      currentPage = 1;
      loadData();
    });
  });

  async function loadData() {
    try {
      await Promise.all([
        loadStageCounts(),
        loadLeads()
      ]);
    } catch (err) {
      toast.show('Error al sincronizar datos: ' + err.message, 'error');
    }
  }

  function loadStageCounts() {
    try {
      const data = cache.getLeads();
      
      const counts = {};
      data.forEach(lead => {
        const id = activePipelineMode === 'franquiday' 
          ? (cache.getMostRecentFranquidayStageId(lead.id) || lead.franquiday_stage_id || cache.getStages()[0]?.id) 
          : lead.pipeline_stage_id;
        counts[id] = (counts[id] || 0) + 1;
      });

      stageCounts = counts;
      renderStages();
    } catch (err) {
      console.error(err);
    }
  }

  function renderStages() {
    const parent = container.querySelector('#stage-cards-container');
    parent.innerHTML = '';
    const cardsEl = renderStageCards(stageCounts);
    parent.appendChild(cardsEl);
  }

  async function loadLeads() {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-12 text-center text-xs text-neutral-400 font-sans">
          Cargando leads...
        </td>
      </tr>
    `;

    try {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' });

      // Apply Filters
      if (activeFilters.search) {
        query = query.ilike('company', `%${activeFilters.search}%`);
      }
      if (activeFilters.stageId) {
        if (activePipelineMode === 'franquiday') {
          query = query.eq('franquiday_stage_id', activeFilters.stageId);
        } else {
          query = query.eq('pipeline_stage_id', activeFilters.stageId);
        }
      }
      if (activeFilters.assignedTo) {
        query = query.eq('assigned_to', activeFilters.assignedTo);
      }
      if (activeFilters.country) {
        query = query.eq('country', activeFilters.country);
      }
      if (activeFilters.valoracion) {
        query = query.eq('valoracion', activeFilters.valoracion);
      }
      // Period filter
      if (periodDays > 0) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - periodDays);
        query = query.gte('created_at', fromDate.toISOString());
      }

      // Sort
      const actualSortCol = (sortColumn === 'pipeline_stage_id' && activePipelineMode === 'franquiday') ? 'franquiday_stage_id' : sortColumn;
      query = query.order(actualSortCol, { ascending: sortAscending });

      // Range
      const from = (currentPage - 1) * rowsPerPage;
      const to = currentPage * rowsPerPage - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      leads = data || [];
      totalRows = count || 0;

      renderTableBody();
      renderPaginationControls();
    } catch (err) {
      toast.show('Error al traer leads: ' + err.message, 'error');
    }
  }

  function renderTableBody() {
    tbody.innerHTML = '';
    
    if (leads.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-12 text-center text-xs text-neutral-400 font-sans">
            No se encontraron leads con los filtros seleccionados.
          </td>
        </tr>
      `;
      masterCheckbox.checked = false;
      return;
    }

    // Check if all leads on this page are selected
    const allSelected = leads.every(l => selectedLeadIds.has(l.id));
    masterCheckbox.checked = allSelected;

    leads.forEach(lead => {
      const isSelected = selectedLeadIds.has(lead.id);
      
      const row = renderLeadRow(lead, isSelected, {
        onSelectChange: (id, checked) => {
          if (checked) {
            selectedLeadIds.add(id);
          } else {
            selectedLeadIds.delete(id);
          }
          renderTableBody();
          updateMassActionsBar();
        },
        onRowClick: (id) => {
          renderLeadDetail(id, () => {
            loadData();
          });
        }
      });
      tbody.appendChild(row);
    });
  }

  // Master checkbox selection
  masterCheckbox.addEventListener('change', (e) => {
    const checked = e.target.checked;
    leads.forEach(lead => {
      if (checked) {
        selectedLeadIds.add(lead.id);
      } else {
        selectedLeadIds.delete(lead.id);
      }
    });
    renderTableBody();
    updateMassActionsBar();
  });

  function renderPaginationControls() {
    const parent = container.querySelector('#pagination-container');
    parent.innerHTML = '';
    
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    const pagEl = renderPagination({
      currentPage,
      totalPages,
      rowsPerPage,
      onPageChange: (page) => {
        currentPage = page;
        loadLeads();
      },
      onRowsPerPageChange: (rows) => {
        rowsPerPage = rows;
        localStorage.setItem('table_rows_per_page', rows);
        currentPage = 1;
        loadLeads();
      }
    });
    parent.appendChild(pagEl);
  }

  // Initializing Filters
  const filtersParent = container.querySelector('#filters-container');
  const filtersEl = renderFilters({
    activeFilters,
    onFilterChange: (updated) => {
      activeFilters = updated;
      currentPage = 1;
      selectedLeadIds.clear();
      updateMassActionsBar();
      loadLeads();
    }
  });
  filtersParent.appendChild(filtersEl);

  // Column Sorting Headers
  container.querySelectorAll('.sort-header').forEach(header => {
    // Add sorting arrows
    const col = header.dataset.col;
    if (col === sortColumn) {
      header.innerHTML += sortAscending ? ' ▴' : ' ▾';
    }

    header.addEventListener('click', () => {
      if (sortColumn === col) {
        sortAscending = !sortAscending;
      } else {
        sortColumn = col;
        sortAscending = true;
      }
      
      // Clean other headers
      container.querySelectorAll('.sort-header').forEach(h => {
        h.innerHTML = h.textContent.replace(/[▴▾]/g, '').trim();
      });
      
      header.innerHTML += sortAscending ? ' ▴' : ' ▾';
      currentPage = 1;
      loadLeads();
    });
  });

  // Mass action bar visibility
  function updateMassActionsBar() {
    const size = selectedLeadIds.size;
    selectedCountSpan.textContent = size;
    
    if (size > 0) {
      massBar.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
      massBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
    } else {
      massBar.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
      massBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      massActionType.value = '';
      massActionValue.classList.add('hidden');
    }
  }

  // Mass action dropdown selectors
  massActionType.addEventListener('change', () => {
    const type = massActionType.value;
    if (!type) {
      massActionValue.classList.add('hidden');
      return;
    }

    massActionValue.innerHTML = '';
    massActionValue.classList.remove('hidden');

    if (type === 'assign') {
      const profiles = cache.getProfiles();
      massActionValue.innerHTML = `
        <option value="">ELEGIR COMERCIAL</option>
        ${profiles.map(p => `<option value="${p.id}">${p.full_name.toUpperCase()}</option>`).join('')}
      `;
    } else if (type === 'stage') {
      const stages = cache.getStages();
      massActionValue.innerHTML = `
        <option value="">ELEGIR ETAPA</option>
        ${stages.map(s => `<option value="${s.id}">${s.name.toUpperCase()}</option>`).join('')}
      `;
    }
  });

  // Apply mass action
  applyMassBtn.addEventListener('click', async () => {
    const type = massActionType.value;
    const value = massActionValue.value;
    
    if (!type || !value) {
      toast.show('Elige una acción y un valor antes de aplicar', 'info');
      return;
    }

    applyMassBtn.disabled = true;
    applyMassBtn.textContent = 'Aplicando...';

    const leadIds = Array.from(selectedLeadIds);
    if (type === 'assign') {
      updateObj.assigned_to = value;
    } else {
      if (activePipelineMode === 'franquiday') {
        updateObj.franquiday_stage_id = value;
      } else {
        updateObj.pipeline_stage_id = value;
      }
    }

    try {
      // 1. Update main lead fields
      const { error } = await supabase
        .from('leads')
        .update(updateObj)
        .in('id', leadIds);

      if (error) throw error;

      // 2. If changing stage in Franquiday mode, also update/insert in participaciones_franquiday
      if (type === 'stage' && activePipelineMode === 'franquiday') {
        const activeEvent = cache.getActiveEvent();
        if (activeEvent) {
          // Prepare bulk upsert objects
          const upserts = leadIds.map(lid => ({
            lead_id: lid,
            evento_id: activeEvent.id,
            pipeline_stage_id: value
          }));

          const { error: upsertErr } = await supabase
            .from('participaciones_franquiday')
            .upsert(upserts, { onConflict: 'lead_id,evento_id' });

          if (upsertErr) throw upsertErr;
        }
      }

      // Update local cache manually or reload
      await cache.loadAll();

      toast.show(`¡Se actualizaron ${leadIds.length} leads correctamente!`, 'success');
      selectedLeadIds.clear();
      updateMassActionsBar();
      loadData();
    } catch (err) {
      toast.show('Error en edición masiva: ' + err.message, 'error');
    } finally {
      applyMassBtn.disabled = false;
      applyMassBtn.textContent = 'Aplicar';
    }
  });

  // Cancel mass selection
  cancelMassBtn.addEventListener('click', () => {
    selectedLeadIds.clear();
    masterCheckbox.checked = false;
    renderTableBody();
    updateMassActionsBar();
  });

  // Open Add Lead Modal
  container.querySelector('#add-lead-btn').addEventListener('click', () => {
    const stages = cache.getStages();
    const profiles = cache.getProfiles();

    const form = document.createElement('form');
    form.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto pr-2';
    form.innerHTML = `
      <div class="sm:col-span-2 border-b border-neutral-100 pb-2 mb-1">
        <h3 class="font-mono text-[9px] font-bold text-primary uppercase">Datos de la Empresa / Marca</h3>
      </div>
      <div class="flex flex-col gap-1 sm:col-span-2">
        <label for="new-company" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre de la Empresa / Marca *</label>
        <input type="text" id="new-company" name="company" required class="cohere-input text-xs" placeholder="Ingresar empresa" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-industry" class="font-mono text-[9px] font-bold text-primary uppercase">Rubro / Industria</label>
        <input type="text" id="new-industry" name="industry" class="cohere-input text-xs" placeholder="Ej: Gastronomía, Estética..." />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-branches" class="font-mono text-[9px] font-bold text-primary uppercase">Cantidad de Sucursales</label>
        <input type="text" id="new-branches" name="branches" class="cohere-input text-xs" placeholder="Ej: 5" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-investment" class="font-mono text-[9px] font-bold text-primary uppercase">Inversión Estimada</label>
        <input type="text" id="new-investment" name="investment" class="cohere-input text-xs" placeholder="Ej: 50.000 USD" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-country" class="font-mono text-[9px] font-bold text-primary uppercase">País</label>
        <select id="new-country" name="country" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          <option value="">Seleccionar País</option>
          ${['Argentina', 'España', 'México', 'Uruguay', 'Chile'].map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-stage" class="font-mono text-[9px] font-bold text-primary uppercase">Etapa Pipeline</label>
        <select id="new-stage" name="pipeline_stage_id" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          ${stages.map(s => `<option value="${s.id}" ${s.is_default ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-assigned" class="font-mono text-[9px] font-bold text-primary uppercase">Asignar Comercial</label>
        <select id="new-assigned" name="assigned_to" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          <option value="">Sin Asignar</option>
          ${profiles.map(p => `<option value="${p.id}" ${currentUser.id === p.id ? 'selected' : ''}>${p.full_name}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-valoracion" class="font-mono text-[9px] font-bold text-primary uppercase">Valoración</label>
        <select id="new-valoracion" name="valoracion" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          <option value="">Sin valoración</option>
          ${['★', '★★', '★★★', '★★★★', '★★★★★'].map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1 sm:col-span-2">
        <label for="new-notes" class="font-mono text-[9px] font-bold text-primary uppercase">Notas iniciales</label>
        <textarea id="new-notes" name="notes" rows="2" class="cohere-input text-xs" placeholder="Detalles de interés..."></textarea>
      </div>

      <div class="sm:col-span-2 border-b border-neutral-100 pb-2 mb-1 mt-4">
        <h3 class="font-mono text-[9px] font-bold text-primary uppercase">Datos del Contacto Principal (Opcional)</h3>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-first-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre</label>
        <input type="text" id="new-contact-first-name" name="contact_first_name" class="cohere-input text-xs" placeholder="Nombre" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-last-name" class="font-mono text-[9px] font-bold text-primary uppercase">Apellido</label>
        <input type="text" id="new-contact-last-name" name="contact_last_name" class="cohere-input text-xs" placeholder="Apellido" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email</label>
        <input type="email" id="new-contact-email" name="contact_email" class="cohere-input text-xs" placeholder="correo@ejemplo.com" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono</label>
        <input type="text" id="new-contact-phone" name="contact_phone" class="cohere-input text-xs" placeholder="Ej: +54 9 11..." />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-position" class="font-mono text-[9px] font-bold text-primary uppercase">Cargo</label>
        <input type="text" id="new-contact-position" name="contact_position" class="cohere-input text-xs" placeholder="Ej: Gerente, CEO..." />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-linkedin" class="font-mono text-[9px] font-bold text-primary uppercase">LinkedIn</label>
        <input type="text" id="new-contact-linkedin" name="contact_linkedin_url" class="cohere-input text-xs" placeholder="https://..." />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-contact-medio" class="font-mono text-[9px] font-bold text-primary uppercase">Medio de Contacto</label>
        <select id="new-contact-medio" name="contact_medio_contacto" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          <option value="WhatsApp">WhatsApp</option>
          <option value="Email">Email</option>
          <option value="Teléfono">Teléfono</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Meet">Meet</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
    `;

    modal.create({
      title: 'Crear Nueva Empresa / Marca',
      content: form,
      actions: [
        { text: 'Cancelar' },
        {
          text: 'Crear Lead',
          primary: true,
          onClick: async (closeModal) => {
            const formData = new FormData(form);
            const todayStr = new Date().toISOString().split('T')[0];

            const newLead = {
              company: formData.get('company').trim(),
              industry: formData.get('industry').trim() || null,
              branches: formData.get('branches').trim() || null,
              investment: formData.get('investment').trim() || null,
              country: formData.get('country') || null,
              pipeline_stage_id: formData.get('pipeline_stage_id'),
              assigned_to: formData.get('assigned_to') || null,
              valoracion: formData.get('valoracion') || null,
              notes: formData.get('notes').trim() || null,
              source: 'manual',
              fecha_carga: todayStr,
              nombre_validado: false
            };

            try {
              // 1. Create Lead (Company)
              const { data: leadData, error: leadErr } = await supabase
                .from('leads')
                .insert([newLead])
                .select()
                .single();

              if (leadErr) throw leadErr;

              const contactFirstName = formData.get('contact_first_name').trim();
              const contactLastName = formData.get('contact_last_name').trim();
              const contactEmail = formData.get('contact_email').trim();

              // 2. Create Contact if fields are filled
              if (contactFirstName || contactLastName || contactEmail) {
                const newContact = {
                  first_name: contactFirstName || 'Sin Nombre',
                  last_name: contactLastName || '',
                  email: contactEmail ? contactEmail.toLowerCase() : null,
                  phone: formData.get('contact_phone').trim() || null,
                  position: formData.get('contact_position').trim() || null,
                  linkedin_url: formData.get('contact_linkedin_url').trim() || null,
                  medio_contacto: formData.get('contact_medio_contacto') || 'WhatsApp',
                  fecha_carga: todayStr,
                  fecha_ultimo_contacto: todayStr,
                  is_active: true
                };

                const { data: contactData, error: contactErr } = await supabase
                  .from('contacts')
                  .insert([newContact])
                  .select()
                  .single();

                if (contactErr) throw contactErr;

                // Link contact with lead
                const { error: linkErr } = await supabase
                  .from('lead_contacts_link')
                  .insert([{
                    lead_id: leadData.id,
                    contact_id: contactData.id
                  }]);

                if (linkErr) throw linkErr;

                // Update primary contact on lead
                const { error: primaryErr } = await supabase
                  .from('leads')
                  .update({ primary_contact_id: contactData.id })
                  .eq('id', leadData.id);

                if (primaryErr) throw primaryErr;
              }

              toast.show('¡Empresa y contacto creados correctamente!', 'success');
              closeModal();
              
              // Reload cache and local table
              await cache.loadAll();
              loadData();
            } catch (err) {
              toast.show('Error creando lead: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  });


  // Check if there is a lead detail requested to be opened automatically (e.g. from Dashboard click)
  const autoOpenLeadId = localStorage.getItem('lead_detail_open');
  if (autoOpenLeadId) {
    localStorage.removeItem('lead_detail_open');
    setTimeout(() => {
      renderLeadDetail(autoOpenLeadId, () => loadData());
    }, 100);
  }

  // Subscribe to cache to keep stage counts up to date
  const unsubscribeCache = cache.subscribe(() => {
    loadStageCounts();
  });

  container.cleanup = () => {
    unsubscribeCache();
    // Remove the floating bar from body when navigating away
    if (massBar && massBar.parentNode) {
      massBar.parentNode.removeChild(massBar);
    }
  };

  return container;
}
