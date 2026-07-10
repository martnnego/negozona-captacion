import { cache } from '../lib/cache';
import { renderLeadDetail } from './lead-detail';
import { formatDate } from '../utils/date-format';
import { toast } from '../components/toast';

export function renderLeadsByCompany(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none';

  // State
  let leads = [];
  let companyGroups = {};
  let searchQuery = '';
  let collapsedCompanies = new Set(); // Stores company names that are collapsed

  container.innerHTML = `
    <!-- Header Title -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6 shrink-0">
      <div>
        <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Leads por Empresa</h2>
        <p class="text-xs text-muted-slate mt-1 font-sans">Agrupación jerárquica de contactos según su marca o empresa.</p>
      </div>

      <!-- Search bar -->
      <div class="relative min-w-[240px] max-w-xs">
        <input 
          type="text" 
          id="company-search-input" 
          placeholder="BUSCAR EMPRESA..." 
          class="w-full bg-white border border-[#d9d9dd] rounded-sm py-2 pl-3 pr-8 font-sans text-xs text-primary placeholder:text-neutral-400 focus:outline-none focus:border-form-focus transition-colors uppercase tracking-wider font-semibold"
        />
        <span class="absolute right-3 top-2.5 text-neutral-400 text-xs">🔍</span>
      </div>
    </div>

    <!-- Accordion Groups List -->
    <div id="company-groups-list" class="flex flex-col gap-4">
      <div class="p-8 text-center text-xs text-neutral-400 font-sans">Cargando empresas...</div>
    </div>
  `;

  const groupsList = container.querySelector('#company-groups-list');
  const searchInput = container.querySelector('#company-search-input');

  // Debounced search on company name
  let debounceTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderGroups();
    }, 200);
  });

  loadLeads();

  function loadLeads() {
    try {
      leads = cache.getLeads() || [];
      renderGroups();
    } catch (err) {
      toast.show('Error al traer leads agrupados: ' + err.message, 'error');
    }
  }

  // Subscribe to changes in cache
  const unsubscribeCache = cache.subscribe(() => {
    leads = cache.getLeads() || [];
    renderGroups();
  });

  container.cleanup = () => {
    unsubscribeCache();
  };

  function renderGroups() {
    groupsList.innerHTML = '';

    // Group leads in memory
    const groups = {};
    leads.forEach(lead => {
      const company = (lead.company || '').trim() || 'Sin Empresa Especificada';
      if (!groups[company]) {
        groups[company] = [];
      }
      groups[company].push(lead);
    });

    companyGroups = groups;

    // Filter company names
    let companyNames = Object.keys(companyGroups).sort((a, b) => a.localeCompare(b));
    if (searchQuery) {
      companyNames = companyNames.filter(name => name.toLowerCase().includes(searchQuery));
    }

    if (companyNames.length === 0) {
      groupsList.innerHTML = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No se encontraron empresas con la búsqueda especificada.
        </div>
      `;
      return;
    }

    companyNames.forEach(name => {
      const companyLeads = companyGroups[name];
      const isCollapsed = collapsedCompanies.has(name);
      
      const accordion = document.createElement('div');
      accordion.className = 'bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col transition-all duration-150';
      
      // Accordion Header
      accordion.innerHTML = `
        <div class="accordion-header px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 select-none border-b ${
          isCollapsed ? 'border-transparent' : 'border-neutral-100'
        }">
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono text-[#616161]">${isCollapsed ? '▶' : '▼'}</span>
            <span class="text-sm font-semibold text-primary font-display">${name}</span>
            <span class="font-mono text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">${companyLeads.length} ${
              companyLeads.length === 1 ? 'contacto' : 'contactos'
            }</span>
          </div>
        </div>
        
        <!-- Accordion Body Table -->
        <div class="overflow-x-auto ${isCollapsed ? 'hidden' : ''}">
          <table class="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr class="bg-neutral-50/60 border-b border-[#e5e7eb] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
                <th class="px-6 py-2.5">Nombre</th>
                <th class="px-6 py-2.5">País</th>
                <th class="px-6 py-2.5">Email</th>
                <th class="px-6 py-2.5">Teléfono</th>
                <th class="px-6 py-2.5">Etapa</th>
                <th class="px-6 py-2.5">Comercial</th>
                <th class="px-6 py-2.5">Última Gestión</th>
                <th class="px-6 py-2.5">Val.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100 text-neutral-700">
              ${companyLeads.map(lead => {
                const stage = cache.getStage(lead.pipeline_stage_id);
                const profile = cache.getProfile(lead.assigned_to);
                
                const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Sin Nombre';
                const stageColor = stage?.color || '#94a3b8';
                const stageName = stage?.name || 'Sin Gestión';
                const assignedName = profile?.full_name || 'Sin Asignar';
                
                return `
                  <tr data-lead-id="${lead.id}" class="hover:bg-neutral-50/30 cursor-pointer transition-colors">
                    <td class="px-6 py-3 font-semibold text-primary font-display">${fullName}</td>
                    <td class="px-6 py-3 font-mono text-[10px] tracking-wider uppercase text-muted-slate">${lead.country || '—'}</td>
                    <td class="px-6 py-3">${lead.email || '—'}</td>
                    <td class="px-6 py-3 font-mono text-[10px]">${lead.phone || '—'}</td>
                    <td class="px-6 py-3">
                      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white" style="background-color: ${stageColor}">
                        ${stageName}
                      </span>
                    </td>
                    <td class="px-6 py-3 font-semibold text-primary">${assignedName}</td>
                    <td class="px-6 py-3 font-mono text-[10px]">${formatDate(lead.fecha_ultimo_contacto)}</td>
                    <td class="px-6 py-3 text-coral font-mono text-[10px] tracking-widest">${lead.valoracion || '—'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Collapse click event
      const header = accordion.querySelector('.accordion-header');
      header.addEventListener('click', () => {
        if (collapsedCompanies.has(name)) {
          collapsedCompanies.delete(name);
        } else {
          collapsedCompanies.add(name);
        }
        renderGroups();
      });

      // Lead Row click event
      accordion.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('click', () => {
          const leadId = row.dataset.leadId;
          renderLeadDetail(leadId, () => {
            loadLeads();
          });
        });
      });

      groupsList.appendChild(accordion);
    });
  }

  return container;
}
