import { supabase, fetchAllLeads } from '../lib/supabase';
import { cache } from '../lib/cache';
import { renderStageCards } from '../components/stage-cards';
import { renderFilters } from '../components/filters';
import { renderPagination } from '../components/pagination';
import { renderLeadRow } from '../components/lead-row';
import { renderLeadDetail } from './lead-detail';
import { modal } from '../components/modal';
import { toast } from '../components/toast';
import { parseCSV } from '../utils/csv-parser';
import { exportLeadsToCSV } from '../utils/csv-export';
import { downloadCSVTemplate } from '../utils/csv-template';
import { checkDuplicateEmails } from '../utils/duplicate-checker';

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
      
      <!-- Period Filter + Actions -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 select-none">
        <!-- Period Pills -->
        <div class="flex items-center gap-1" id="period-pills">
          ${[{label:'30 días', val:30}, {label:'90 días', val:90}, {label:'180 días', val:180}, {label:'Todo', val:0}].map(p => `
            <button data-period="${p.val}" class="period-btn px-3 py-1.5 border rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 ${
              periodDays === p.val
                ? 'bg-primary border-primary text-white'
                : 'bg-white border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary'
            }">${p.label}</button>
          `).join('')}
        </div>
        <div class="flex items-center gap-3">
        <button id="import-csv-btn" class="px-4 py-2 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none">
          📥 Importar CSV
        </button>
        <button id="export-csv-btn" class="px-4 py-2 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none">
          📤 Exportar CSV
        </button>
        <button id="add-lead-btn" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 shadow-xs flex items-center gap-1.5 focus:outline-none">
          <span>+ Nuevo Lead</span>
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
      // Period filter
      if (periodDays > 0) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - periodDays);
        query = query.gte('created_at', fromDate.toISOString());
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

  // Export CSV Click Handler
  container.querySelector('#export-csv-btn').addEventListener('click', async () => {
    const exportBtn = container.querySelector('#export-csv-btn');
    const oldText = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '⌛ Exportando...';

    try {
      let query = supabase
        .from('leads')
        .select('*');

      // Apply exact same filters as active layout, but without paginated limit
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
      // Apply same period filter as table
      if (periodDays > 0) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - periodDays);
        query = query.gte('created_at', fromDate.toISOString());
      }

      query = query.order(sortColumn, { ascending: sortAscending });

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.show('No hay datos para exportar con los filtros actuales', 'info');
        return;
      }

      exportLeadsToCSV(data);
      toast.show('¡Exportación completada!', 'success');
    } catch (err) {
      toast.show('Error al exportar: ' + err.message, 'error');
    } finally {
      exportBtn.disabled = false;
      exportBtn.innerHTML = oldText;
    }
  });

  // Import CSV Click Handler
  container.querySelector('#import-csv-btn').addEventListener('click', () => {
    let parsedRows = [];
    let fileHeaders = [];
    let selectedFile = null;

    const form = document.createElement('div');
    form.className = 'flex flex-col gap-4 font-sans text-xs select-none';
    form.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-neutral-500 font-medium">Sube tu archivo para añadir leads masivamente.</span>
        <button id="download-template-btn" type="button" class="text-action-blue hover:underline font-mono text-[9px] font-bold uppercase tracking-wider">
          ➔ Descargar Plantilla CSV
        </button>
      </div>

      <!-- Drag & Drop Zone -->
      <div id="drag-drop-zone" class="border-2 border-dashed border-neutral-300 rounded-sm p-8 text-center bg-neutral-50/50 hover:bg-neutral-50 hover:border-primary transition-all cursor-pointer">
        <span class="text-2xl block mb-1">📄</span>
        <span class="font-sans text-[11px] font-bold text-primary block" id="upload-status-text">
          ARRASTRA TU ARCHIVO CSV AQUÍ O HAZ CLIC PARA SELECCIONAR
        </span>
        <input type="file" id="csv-file-input" class="hidden" accept=".csv" />
      </div>

      <!-- Duplicates Selector -->
      <div class="flex flex-col gap-1">
        <label for="dup-behavior" class="font-mono text-[9px] font-bold text-primary uppercase">Detección de Duplicados (por email)</label>
        <select id="dup-behavior" class="cohere-input text-xs">
          <option value="skip">Omitir duplicados (mantener datos existentes en CRM)</option>
          <option value="update">Actualizar datos de leads existentes (preservar historial)</option>
        </select>
      </div>

      <!-- Preview Panel -->
      <div id="import-preview-section" class="hidden border-t border-neutral-100 pt-4">
        <h4 class="font-mono text-[9px] font-bold text-primary uppercase mb-2" id="preview-title-text">Previsualización (Primeras filas)</h4>
        <div class="overflow-x-auto max-h-40 border border-[#d9d9dd] rounded-sm">
          <table class="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[8px] font-bold text-muted-slate uppercase" id="preview-thead">
              </tr>
            </thead>
            <tbody id="preview-tbody" class="divide-y divide-neutral-100 text-neutral-600">
            </tbody>
          </table>
        </div>
      </div>

      <!-- Progress Panel -->
      <div id="import-progress-section" class="hidden border-t border-neutral-100 pt-4 flex flex-col gap-2">
        <div class="flex items-center justify-between font-semibold">
          <span id="import-progress-text" class="text-neutral-500">Importando registros...</span>
          <span id="import-progress-percent" class="font-mono text-primary text-[10px]">0%</span>
        </div>
        <div class="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200">
          <div id="import-progress-bar" class="bg-primary h-full w-0 transition-all duration-100"></div>
        </div>
      </div>
    `;

    const dropZone = form.querySelector('#drag-drop-zone');
    const fileInput = form.querySelector('#csv-file-input');
    const uploadStatus = form.querySelector('#upload-status-text');
    const previewSection = form.querySelector('#import-preview-section');
    const previewThead = form.querySelector('#preview-thead');
    const previewTbody = form.querySelector('#preview-tbody');
    const previewTitle = form.querySelector('#preview-title-text');
    const dupBehavior = form.querySelector('#dup-behavior');

    // Template download trigger
    form.querySelector('#download-template-btn').addEventListener('click', () => {
      downloadCSVTemplate();
    });

    // File input select
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag-drop events
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-neutral-50');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary', 'bg-neutral-50');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-neutral-50');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
      }
    });

    function handleFileSelect(file) {
      selectedFile = file;
      uploadStatus.innerHTML = `ARCHIVO SELECCIONADO: <b class="text-action-blue">${file.name}</b> (${Math.round(file.size / 1024)} KB)`;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const allLines = parseCSV(text);
        
        if (allLines.length < 2) {
          toast.show('El archivo CSV está vacío o le faltan registros', 'error');
          return;
        }

        fileHeaders = allLines[0];
        parsedRows = allLines.slice(1);

        renderPreview();
      };
      reader.readAsText(file, 'UTF-8');
    }

    function renderPreview() {
      previewThead.innerHTML = fileHeaders.map(h => `<th class="px-4 py-2">${h}</th>`).join('');
      
      const firstRows = parsedRows.slice(0, 5);
      previewTbody.innerHTML = firstRows.map(row => `
        <tr class="hover:bg-neutral-50/50">
          ${row.map(val => `<td class="px-4 py-2 max-w-[120px] truncate" title="${val}">${val}</td>`).join('')}
        </tr>
      `).join('');

      previewTitle.textContent = `Previsualización (${parsedRows.length} filas encontradas)`;
      previewSection.classList.remove('hidden');
    }

    modal.create({
      title: 'Importar Leads desde CSV',
      content: form,
      actions: [
        { text: 'Cancelar' },
        {
          text: 'Comenzar Importación',
          primary: true,
          onClick: async (closeImportModal, actionButtons) => {
            if (parsedRows.length === 0 || !selectedFile) {
              toast.show('Por favor, selecciona un archivo CSV válido primero', 'info');
              return;
            }

            // Disable modal buttons to prevent double submission
            const btnCancel = actionButtons[0];
            const btnImport = actionButtons[1];
            btnCancel.disabled = true;
            btnImport.disabled = true;
            btnImport.textContent = 'Importando...';

            const progressSection = form.querySelector('#import-progress-section');
            const progressBar = form.querySelector('#import-progress-bar');
            const progressPercent = form.querySelector('#import-progress-percent');
            const progressText = form.querySelector('#import-progress-text');
            
            progressSection.classList.remove('hidden');

            const behavior = dupBehavior.value;
            const stages = cache.getStages();
            const profiles = cache.getProfiles();
            const defaultStageId = stages.find(s => s.is_default)?.id || stages[0]?.id;

            // Extract all emails for duplicate verification
            // Let's find index of 'email' column
            const emailColIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'email');
            const firstNameIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'first_name' || h.toLowerCase() === 'nombre');
            const lastNameIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'last_name' || h.toLowerCase() === 'apellido');
            const companyIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'company' || h.toLowerCase() === 'empresa');
            const phoneIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'phone' || h.toLowerCase() === 'telefono');
            const countryIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'country' || h.toLowerCase() === 'pais');
            const positionIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'position' || h.toLowerCase() === 'cargo');
            const linkedinIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'linkedin_url' || h.toLowerCase() === 'linkedin');
            const sourceIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'source' || h.toLowerCase() === 'origen');
            const sourceDetailIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'source_detail');
            const statusIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'status' || h.toLowerCase() === 'etapa');
            const industryIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'industry' || h.toLowerCase() === 'rubro');
            const investmentIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'investment' || h.toLowerCase() === 'inversion');
            const branchesIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'branches' || h.toLowerCase() === 'sucursales');
            const assignedIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'assigned_to' || h.toLowerCase() === 'comercial');
            const valoracionIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'valoracion' || h.toLowerCase() === 'rating');
            const medioIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'medio_contacto');
            const notesIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'notes' || h.toLowerCase() === 'notas');
            const motivoDescarteIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'motivo_descarte');
            const fechaUltimoContactoIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'fecha_ultimo_contacto');
            const fechaCargaIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'fecha_carga');

            // Collect all emails
            const emailsToCheck = [];
            if (emailColIdx !== -1) {
              parsedRows.forEach(row => {
                const em = row[emailColIdx];
                if (em) emailsToCheck.push(em);
              });
            }

            progressText.textContent = 'Verificando duplicados en la base de datos...';
            const duplicateMap = await checkDuplicateEmails(emailsToCheck);

            let okCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const errorDetails = [];

            const total = parsedRows.length;
            const todayStr = new Date().toISOString().split('T')[0];

            for (let i = 0; i < total; i++) {
              const row = parsedRows[i];
              
              // Progress report
              const percent = Math.round((i / total) * 100);
              progressBar.style.width = `${percent}%`;
              progressPercent.textContent = `${percent}%`;
              progressText.textContent = `Procesando fila ${i + 1} de ${total}...`;

              // Extract values safely
              const getValue = (idx) => (idx !== -1 && row[idx]) ? row[idx] : null;

              const rawEmail = getValue(emailColIdx);
              const cleanEmail = rawEmail ? rawEmail.toLowerCase().trim() : null;

              // Resolve pipeline stage from name match
              const rawStatus = getValue(statusIdx);
              let stageId = defaultStageId;
              if (rawStatus) {
                const matchedStage = stages.find(s => s.name.toLowerCase() === rawStatus.toLowerCase());
                if (matchedStage) stageId = matchedStage.id;
              }

              // Resolve assigned commercial from name match
              const rawAssigned = getValue(assignedIdx);
              let assignedTo = null;
              if (rawAssigned) {
                // If it is "Marcos", implementation plan says assign to null
                if (rawAssigned.toLowerCase() !== 'marcos') {
                  const matchedProfile = profiles.find(p => 
                    p.full_name.toLowerCase().includes(rawAssigned.toLowerCase()) ||
                    p.email.toLowerCase().includes(rawAssigned.toLowerCase())
                  );
                  if (matchedProfile) assignedTo = matchedProfile.id;
                }
              }

              const leadObj = {
                first_name: getValue(firstNameIdx) || 'Sin Nombre',
                last_name: getValue(lastNameIdx) || '',
                company: getValue(companyIdx),
                email: cleanEmail,
                phone: getValue(phoneIdx),
                country: getValue(countryIdx),
                position: getValue(positionIdx),
                linkedin_url: getValue(linkedinIdx),
                source: getValue(sourceIdx) || 'csv_import',
                source_detail: getValue(sourceDetailIdx),
                pipeline_stage_id: stageId,
                industry: getValue(industryIdx),
                investment: getValue(investmentIdx),
                branches: getValue(branchesIdx),
                assigned_to: assignedTo,
                valoracion: getValue(valoracionIdx),
                medio_contacto: getValue(medioIdx),
                notes: getValue(notesIdx),
                motivo_descarte: getValue(motivoDescarteIdx),
                fecha_ultimo_contacto: getValue(fechaUltimoContactoIdx),
                fecha_carga: getValue(fechaCargaIdx) || todayStr
              };

              try {
                const existingId = cleanEmail ? duplicateMap[cleanEmail] : null;

                if (existingId) {
                  if (behavior === 'skip') {
                    skippedCount++;
                    continue;
                  } else {
                    // Update
                    const { error } = await supabase
                      .from('leads')
                      .update(leadObj)
                      .eq('id', existingId);

                    if (error) throw error;
                    okCount++;
                  }
                } else {
                  // Insert new
                  const { error } = await supabase
                    .from('leads')
                    .insert([leadObj]);

                  if (error) throw error;
                  okCount++;
                }
              } catch (err) {
                errorCount++;
                errorDetails.push({ row: i + 2, name: `${leadObj.first_name} ${leadObj.last_name}`, error: err.message });
              }
            }

            // Completed! Write log to DB
            try {
              await supabase
                .from('import_logs')
                .insert([{
                  file_name: selectedFile.name,
                  total_rows: total,
                  imported_ok: okCount,
                  duplicates_skipped: skippedCount,
                  errors: errorCount,
                  error_details: errorDetails.length > 0 ? errorDetails : null,
                  imported_by: currentUser.id
                }]);
            } catch (logErr) {
              console.error('Error writing import log:', logErr);
            }

            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = '¡Importación finalizada!';

            toast.show(`Importación: ${okCount} creados/actualizados, ${skippedCount} duplicados omitidos, ${errorCount} errores`, 'success');
            
            setTimeout(() => {
              closeImportModal();
              loadData();
            }, 1000);
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
