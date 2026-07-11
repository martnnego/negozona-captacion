import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { renderLeadDetail } from './lead-detail';
import { toast } from '../components/toast';
import Sortable from 'sortablejs';

export function renderLeadsKanban(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 h-full min-h-[500px] animate-fade-in pb-12 select-none';

  // State
  let leads = [];
  let sortableInstances = [];
  let unsubscribeCache = null;

  let activePipelineMode = localStorage.getItem('crm_active_pipeline_mode') || 'comercial'; // 'comercial' or 'franquiday'

  let activeFilters = {
    assignedTo: '',
    country: ''
  };

  // Subscribe to changes in cache
  unsubscribeCache = cache.subscribe(() => {
    leads = cache.getLeads() || [];
    distributeCards();
  });

  // Render Kanban structure
  container.innerHTML = `
    <!-- Header Title -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6 shrink-0">
      <div class="flex flex-col md:flex-row md:items-center gap-4">
        <div>
          <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Tablero Kanban</h2>
          <p class="text-xs text-muted-slate mt-1 font-sans">Pipeline de ventas visual. Arrastra leads para cambiar su estado.</p>
        </div>

        <!-- Pipeline Mode Toggle Switch -->
        <div class="flex items-center bg-neutral-100 p-0.5 rounded-full border border-neutral-200 select-none max-w-fit mt-1 md:mt-0" id="pipeline-mode-toggle">
          <button data-mode="comercial" class="mode-btn px-3 py-1 rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 ${
            activePipelineMode === 'comercial'
              ? 'bg-white shadow-xs text-primary'
              : 'text-[#616161] hover:text-primary'
          }">💼 Comercial</button>
          <button data-mode="franquiday" class="mode-btn px-3 py-1 rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 ${
            activePipelineMode === 'franquiday'
              ? 'bg-white shadow-xs text-primary'
              : 'text-[#616161] hover:text-primary'
          }">🎪 Franquiday</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-3">
        <!-- Comercial Select -->
        <select id="kanban-comercial" class="bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          <option value="">TODOS LOS COMERCIALES</option>
          ${cache.getProfiles().map(p => `
            <option value="${p.id}" ${activeFilters.assignedTo === p.id ? 'selected' : ''}>${(p.full_name || p.email || '').toUpperCase()}</option>
          `).join('')}
        </select>

        <!-- Country Select -->
        <select id="kanban-country" class="bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          <option value="">TODOS LOS PAÍSES</option>
          ${['Argentina', 'España', 'México', 'Uruguay', 'Chile'].map(c => `
            <option value="${c}" ${activeFilters.country === c ? 'selected' : ''}>${c.toUpperCase()}</option>
          `).join('')}
        </select>
      </div>
    </div>

    <!-- Board columns wrapper -->
    <div class="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 pr-4 h-full min-h-[500px]" id="kanban-board-scroll">
      <!-- Dynamic Columns -->
    </div>
  `;

  // Attach pipeline mode toggle handler
  const attachModeToggle = () => {
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
        distributeCards();
      });
    });
  };
  setTimeout(attachModeToggle, 0);

  const boardWrapper = container.querySelector('#kanban-board-scroll');
  const comercialSelect = container.querySelector('#kanban-comercial');
  const countrySelect = container.querySelector('#kanban-country');

  // Filter events
  comercialSelect.addEventListener('change', () => {
    activeFilters.assignedTo = comercialSelect.value;
    distributeCards();
  });

  countrySelect.addEventListener('change', () => {
    activeFilters.country = countrySelect.value;
    distributeCards();
  });

  // Load Leads initially
  loadLeads();

  async function loadLeads() {
    boardWrapper.innerHTML = `<div class="p-8 text-center text-xs text-neutral-400 font-sans w-full">Cargando pipeline...</div>`;
    try {
      leads = cache.getLeads() || [];
      distributeCards();
    } catch (err) {
      toast.show('Error al cargar pipeline: ' + err.message, 'error');
    }
  }

  function distributeCards() {
    // Clear old Sortable instances to prevent memory leaks
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    // Filter leads on the client side
    let filteredLeads = leads;
    if (activeFilters.assignedTo) {
      filteredLeads = filteredLeads.filter(l => l.assigned_to === activeFilters.assignedTo);
    }
    if (activeFilters.country) {
      filteredLeads = filteredLeads.filter(l => l.country === activeFilters.country);
    }

    // Build columns
    const stages = cache.getStages();
    boardWrapper.innerHTML = stages.map(stage => {
      const stageLeads = filteredLeads.filter(l => {
        const activeStageId = activePipelineMode === 'franquiday' 
          ? (cache.getMostRecentFranquidayStageId(l.id) || l.franquiday_stage_id || stages[0]?.id) 
          : l.pipeline_stage_id;
        return activeStageId === stage.id;
      });
      
      return `
        <!-- Column -->
        <div class="w-72 bg-[#eeece7]/40 border border-[#d9d9dd] rounded-sm flex flex-col h-full max-h-[70vh] shrink-0 font-sans text-xs">
          <!-- Column Header -->
          <div class="px-4 py-3 border-b border-[#d9d9dd] bg-white flex items-center justify-between shrink-0 select-none">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${stage.color}"></span>
              <span class="font-bold text-primary truncate uppercase tracking-wider text-[10px]">${stage.name}</span>
            </div>
            <span class="font-mono text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full shrink-0">${stageLeads.length}</span>
          </div>

          <!-- Cards body list -->
          <div 
            data-stage-id="${stage.id}" 
            class="kanban-cards-list flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-[100px]"
          >
            ${stageLeads.map(lead => renderCardHtml(lead)).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Attach click events to cards
    boardWrapper.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', () => {
        const leadId = card.dataset.leadId;
        renderLeadDetail(leadId, () => {
          loadLeads();
        });
      });
    });

    // Initialize SortableJS on all columns
    try {
      const SortableConstructor = Sortable.default || Sortable;
      if (typeof SortableConstructor === 'function') {
        boardWrapper.querySelectorAll('.kanban-cards-list').forEach(listEl => {
          const stageId = listEl.dataset.stageId;
          
          const sortable = new SortableConstructor(listEl, {
            group: 'kanban',
            animation: 150,
            ghostClass: 'opacity-40',
            dragClass: 'rotate-1',
            
            onEnd: async (evt) => {
              const cardEl = evt.item;
              const targetListEl = evt.to;
              const sourceListEl = evt.from;
              
              const leadId = cardEl.dataset.leadId;
              const newStageId = targetListEl.dataset.stageId;
              const oldStageId = sourceListEl.dataset.stageId;

              if (newStageId === oldStageId) return;

              console.log(`Moving lead ${leadId} from stage ${oldStageId} to ${newStageId} (mode: ${activePipelineMode})`);

              try {
                const updateObj = {};
                if (activePipelineMode === 'franquiday') {
                  updateObj.franquiday_stage_id = newStageId;
                } else {
                  updateObj.pipeline_stage_id = newStageId;
                }

                // 1. Update lead record
                const { error } = await supabase
                  .from('leads')
                  .update(updateObj)
                  .eq('id', leadId);

                if (error) throw error;

                // 2. If in Franquiday mode, also update participaciones_franquiday
                if (activePipelineMode === 'franquiday') {
                  const activeEvent = cache.getActiveEvent();
                  if (activeEvent) {
                    const { error: upsertErr } = await supabase
                      .from('participaciones_franquiday')
                      .upsert({
                        lead_id: leadId,
                        evento_id: activeEvent.id,
                        pipeline_stage_id: newStageId
                      }, { onConflict: 'lead_id,evento_id' });

                    if (upsertErr) throw upsertErr;
                  }
                }

                // Synchronize global cache
                await cache.loadAll();
                
                // Success toast
                toast.show('Ficha movida correctamente', 'success');

                // Optimistic update of local state
                leads = cache.getLeads() || [];
                distributeCards();
              } catch (err) {
                toast.show('Error al mover tarjeta: ' + err.message, 'error');
                // Revert cards distribution
                distributeCards();
              }
            }
          });
          sortableInstances.push(sortable);
        });
      } else {
        console.error('SortableJS was imported but is not a constructor/function');
      }
    } catch (sortError) {
      console.error('Failed to initialize SortableJS:', sortError);
    }
  }

  function renderCardHtml(lead) {
    const primaryContact = lead.primary_contact_id ? cache.getContact(lead.primary_contact_id) : null;
    const fullName = primaryContact ? `${primaryContact.first_name || ''} ${primaryContact.last_name || ''}`.trim() : '—';
    const company = lead.company || 'Sin Empresa';
    const rating = lead.valoracion || '';
    
    // Check if lead hasn't been contacted in 14 days (reads from primary contact date)
    let hasAlert = false;
    const lastContactDate = primaryContact ? primaryContact.fecha_ultimo_contacto : null;
    if (lastContactDate) {
      const lastContact = new Date(lastContactDate);
      const diffMs = new Date() - lastContact;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 14) {
        hasAlert = true;
      }
    } else {
      // No contact date means it hasn't been contacted at all
      hasAlert = true;
    }

    const profile = cache.getProfile(lead.assigned_to);
    const assignedName = profile?.full_name || 'Sin Asignar';

    return `
      <!-- Card -->
      <div 
        data-lead-id="${lead.id}" 
        class="kanban-card bg-white border border-[#d9d9dd] rounded-sm p-4 cursor-pointer hover:border-primary hover:shadow-xs transition-all duration-150 flex flex-col gap-2 relative"
      >
        <!-- Top alert flag -->
        ${hasAlert ? `
          <span class="absolute top-3 right-3 text-coral text-xs" title="Sin gestión hace más de 14 días">⚠️</span>
        ` : ''}

        <!-- Details -->
        <div class="flex flex-col gap-0.5 pr-4">
          <span class="font-semibold text-primary font-display truncate">${fullName}</span>
          <span class="text-neutral-500 text-[11px] truncate font-semibold">${company}
            ${lead.nombre_validado ? `<span class="inline-block text-emerald-600 ml-1" title="Nombre de empresa validado">✓</span>` : ''}
          </span>
        </div>

        <!-- Meta row -->
        <div class="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[10px] text-muted-slate">
          <span class="font-mono uppercase font-bold text-[9px]">${lead.country || '—'}</span>
          <span class="text-coral font-mono tracking-wider">${rating}</span>
        </div>

        <!-- Bottom User tag -->
        <div class="flex items-center gap-1.5 mt-1 text-[9px] font-mono text-neutral-400 font-bold uppercase truncate" title="Asignado a: ${assignedName}">
          👤 ${assignedName}
        </div>
      </div>
    `;
  }

  // Cleanup event listeners
  container.cleanup = () => {
    if (unsubscribeCache) unsubscribeCache();
    sortableInstances.forEach(s => s.destroy());
  };

  return container;
}
