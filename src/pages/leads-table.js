import { supabase } from '../lib/supabase';
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
      <div>
        <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Embudo de Captación</h2>
        <p class="text-xs text-muted-slate mt-1">Gestión administrativa y asignación de leads de expansión</p>
      </div>
      
      <!-- Actions panel -->
      <div class="flex items-center gap-3">
        <button id="add-lead-btn" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 shadow-xs flex items-center gap-1.5 focus:outline-none">
          <span>+ Nuevo Lead</span>
        </button>
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

    <!-- Mass Actions floating bar -->
    <div id="mass-actions-bar" class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary border border-neutral-800 text-white rounded-full px-6 py-3 shadow-xl z-30 items-center gap-4 transition-all duration-200 translate-y-20 opacity-0 flex select-none">
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
    </div>
  `;

  const tbody = container.querySelector('#leads-tbody');
  const masterCheckbox = container.querySelector('#master-checkbox');
  const massBar = container.querySelector('#mass-actions-bar');
  const selectedCountSpan = container.querySelector('#selected-count');
  const massActionType = container.querySelector('#mass-action-type');
  const massActionValue = container.querySelector('#mass-action-value');
  const applyMassBtn = container.querySelector('#apply-mass-btn');
  const cancelMassBtn = container.querySelector('#cancel-mass-btn');

  // Trigger loading
  loadData();

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

  async function loadStageCounts() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('pipeline_stage_id');

      if (error) throw error;
      
      const counts = {};
      data.forEach(lead => {
        const id = lead.pipeline_stage_id;
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
        query = query.or(`first_name.ilike.%${activeFilters.search}%,last_name.ilike.%${activeFilters.search}%,company.ilike.%${activeFilters.search}%,email.ilike.%${activeFilters.search}%`);
      }
      if (activeFilters.stageId) {
        query = query.eq('pipeline_stage_id', activeFilters.stageId);
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

      // Sort
      query = query.order(sortColumn, { ascending: sortAscending });

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
      massBar.classList.remove('translate-y-20', 'opacity-0');
      massBar.classList.add('translate-y-0', 'opacity-100');
    } else {
      massBar.classList.add('translate-y-20', 'opacity-0');
      massBar.classList.remove('translate-y-0', 'opacity-100');
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
    const updateObj = {};
    if (type === 'assign') {
      updateObj.assigned_to = value;
    } else {
      updateObj.pipeline_stage_id = value;
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update(updateObj)
        .in('id', leadIds);

      if (error) throw error;

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
    form.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
    form.innerHTML = `
      <div class="flex flex-col gap-1">
        <label for="new-first-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre</label>
        <input type="text" id="new-first-name" name="first_name" required class="cohere-input text-xs" placeholder="Ingresar nombre" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-last-name" class="font-mono text-[9px] font-bold text-primary uppercase">Apellido</label>
        <input type="text" id="new-last-name" name="last_name" required class="cohere-input text-xs" placeholder="Ingresar apellido" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-company" class="font-mono text-[9px] font-bold text-primary uppercase">Empresa / Marca</label>
        <input type="text" id="new-company" name="company" class="cohere-input text-xs" placeholder="Ingresar empresa" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email</label>
        <input type="email" id="new-email" name="email" class="cohere-input text-xs" placeholder="correo@ejemplo.com" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono</label>
        <input type="text" id="new-phone" name="phone" class="cohere-input text-xs" placeholder="Ej: +54 9 11..." />
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-country" class="font-mono text-[9px] font-bold text-primary uppercase">País</label>
        <select id="new-country" name="country" class="cohere-input text-xs">
          <option value="">Seleccionar País</option>
          ${['Argentina', 'España', 'México', 'Uruguay', 'Chile'].map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-stage" class="font-mono text-[9px] font-bold text-primary uppercase">Etapa Pipeline</label>
        <select id="new-stage" name="pipeline_stage_id" required class="cohere-input text-xs">
          ${stages.map(s => `<option value="${s.id}" ${s.is_default ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-assigned" class="font-mono text-[9px] font-bold text-primary uppercase">Asignar Comercial</label>
        <select id="new-assigned" name="assigned_to" class="cohere-input text-xs">
          <option value="">Sin Asignar</option>
          ${profiles.map(p => `<option value="${p.id}" ${currentUser.id === p.id ? 'selected' : ''}>${p.full_name}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label for="new-valoracion" class="font-mono text-[9px] font-bold text-primary uppercase">Valoración</label>
        <select id="new-valoracion" name="valoracion" class="cohere-input text-xs">
          <option value="">Sin valoración</option>
          ${['★', '★★', '★★★', '★★★★', '★★★★★'].map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-1 sm:col-span-2">
        <label for="new-notes" class="font-mono text-[9px] font-bold text-primary uppercase">Notas iniciales</label>
        <textarea id="new-notes" name="notes" rows="2" class="cohere-input text-xs" placeholder="Detalles de interés..."></textarea>
      </div>
    `;

    modal.create({
      title: 'Crear Nuevo Lead',
      content: form,
      actions: [
        { text: 'Cancelar' },
        {
          text: 'Crear Lead',
          primary: true,
          onClick: async (closeModal) => {
            const formData = new FormData(form);
            const newLead = {
              first_name: formData.get('first_name').trim(),
              last_name: formData.get('last_name').trim(),
              company: formData.get('company').trim() || null,
              email: formData.get('email').trim() || null,
              phone: formData.get('phone').trim() || null,
              country: formData.get('country') || null,
              pipeline_stage_id: formData.get('pipeline_stage_id'),
              assigned_to: formData.get('assigned_to') || null,
              valoracion: formData.get('valoracion') || null,
              notes: formData.get('notes').trim() || null,
              source: 'manual',
              fecha_carga: new Date().toISOString().split('T')[0]
            };

            try {
              const { error } = await supabase
                .from('leads')
                .insert([newLead]);

              if (error) throw error;
              toast.show('¡Lead creado correctamente!', 'success');
              closeModal();
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

  return container;
}
