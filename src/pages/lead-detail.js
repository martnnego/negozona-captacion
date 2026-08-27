import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { auth } from '../lib/auth';
import { formatDate, formatDateTime } from '../utils/date-format';
import { modal } from '../components/modal';
import { toast } from '../components/toast';
import { openContactEditModal } from '../components/contact-edit-modal';
import { notifyNewInteraction } from '../utils/interaction-notifications';

export async function renderLeadDetail(leadId, onUpdate) {
  const currentUser = await auth.getCurrentUser();
  const isAdmin = currentUser?.profile?.role === 'super_admin';
  let activeTab = localStorage.getItem('lead_detail_active_tab') || 'detail'; // 'detail', 'linked_contacts', 'interactions', 'comments', 'history'

  let lead = null;
  let linkedContacts = []; // Contacts linked to the company
  let interactions = []; // Interaction logs (previously lead_contacts)
  let comments = [];
  let statusHistory = [];
  let auditLogs = [];
  let whatsappMessages = [];

  // Create loading wrapper inside modal
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'w-full min-h-[400px] flex items-center justify-center font-sans text-neutral-400 text-xs';
  contentWrapper.innerHTML = `
    <div class="flex flex-col items-center gap-3">
      <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Cargando ficha de empresa...</span>
    </div>
  `;

  const detailModal = modal.create({
    title: 'Ficha de Empresa / Marca',
    content: contentWrapper,
    sizeClass: 'max-w-2xl md:max-w-4xl',
    onClose: () => {
      if (onUpdate) onUpdate();
    }
  });

  await loadAllData();

  async function loadAllData() {
    try {
      // 1. Resolve lead and contacts from local cache
      lead = (cache.getLeads() || []).find(l => l.id === leadId);
      if (!lead) {
        // Fallback query in case it is not present in cache
        const leadRes = await supabase.from('leads').select('*').eq('id', leadId).single();
        if (leadRes.error) throw leadRes.error;
        lead = leadRes.data;
      }

      linkedContacts = cache.getLeadContacts(leadId) || [];

      // 2. Only fetch dynamically changing transactional logs from Supabase
      const [interactionsRes, commentsRes, historyRes, auditRes, whatsappRes] = await Promise.all([
        supabase.from('lead_interactions').select('*').eq('lead_id', leadId).order('contacted_at', { ascending: false }),
        supabase.from('lead_comments').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false }),
        supabase.from('lead_audit_log').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false }),
        supabase.from('whatsapp_messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true })
      ]);

      interactions = interactionsRes.data || [];
      comments = commentsRes.data || [];
      statusHistory = historyRes.data || [];
      auditLogs = auditRes.data || [];
      whatsappMessages = whatsappRes.data || [];

      renderContent();
    } catch (err) {
      toast.show('Error al traer detalles de la empresa: ' + err.message, 'error');
      detailModal.close();
    }
  }

  function renderContent() {
    const bodyEl = detailModal.bodyEl;
    bodyEl.innerHTML = '';
    bodyEl.className = 'flex-1 p-6 font-sans text-sm text-neutral-700 flex flex-col gap-6 max-h-[80vh] overflow-y-auto';

    const stages = cache.getStages();
    const profiles = cache.getProfiles();
    
    // Resolve stage IDs for Comercial and Franquiday
    const commercialStageId = lead.pipeline_stage_id || stages[0]?.id;

    const activeEvent = cache.getActiveEvent();
    const participations = cache.getLeadParticipations(lead.id) || [];
    const activeParticipation = activeEvent 
      ? participations.find(p => p.evento_id === activeEvent.id)
      : null;
    const franquidayStageId = cache.getMostRecentFranquidayStageId(lead.id) || lead.franquiday_stage_id || activeParticipation?.pipeline_stage_id || stages[0]?.id;
    
    // Modal Header Info
    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-b border-neutral-100 pb-4 select-none';
    summaryHeader.innerHTML = `
      <div>
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Empresa / Marca</h4>
        <p class="text-sm font-semibold text-primary mt-0.5 flex items-center gap-1.5">
          ${lead.company || '—'}
          ${lead.nombre_validado 
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Validado</span>` 
            : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Pendiente Validar</span>`}
        </p>
      </div>
      <div>
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Contacto Principal</h4>
        <p class="text-sm font-semibold text-primary mt-0.5">
          ${(() => {
            const pc = linkedContacts.find(c => c.id === lead.primary_contact_id);
            return pc ? `${pc.first_name || ''} ${pc.last_name || ''}`.trim() : 'Sin asignar';
          })()}
        </p>
      </div>
      <div class="flex flex-col gap-0.5">
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Etapa Comercial</h4>
        <select id="header-comercial-stage-select" class="mt-0.5 bg-white border border-[#d9d9dd] rounded-sm py-1 px-2 font-mono text-[10px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          ${stages.map(s => `<option value="${s.id}" ${commercialStageId === s.id ? 'selected' : ''}>${s.name.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="flex flex-col gap-0.5">
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Etapa Franquiday</h4>
        <select id="header-franquiday-stage-select" class="mt-0.5 bg-white border border-[#d9d9dd] rounded-sm py-1 px-2 font-mono text-[10px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          ${stages.map(s => `<option value="${s.id}" ${franquidayStageId === s.id ? 'selected' : ''}>${s.name.toUpperCase()}</option>`).join('')}
        </select>
      </div>
    `;

    // Tab Navigation Bar
    const tabsBar = document.createElement('div');
    tabsBar.className = 'flex items-center gap-2 md:gap-6 border-b border-[#d9d9dd] font-sans text-xs select-none overflow-x-auto no-scrollbar flex-nowrap shrink-0 w-full';
    
    const tabs = [
      { id: 'detail', label: 'INFORMACIÓN GENERAL' },
      { id: 'linked_contacts', label: `CONTACTOS (${linkedContacts.length})` },
      { id: 'interactions', label: `GESTIONES (${interactions.length})` },
      { id: 'whatsapp', label: '🟢 WHATSAPP' },
      { id: 'email', label: '✉️ ENVIAR EMAIL' },
      { id: 'comments', label: `COMENTARIOS (${comments.length})` },
      { id: 'franquiday', label: '🎪 FRANQUIDAY' },
      { id: 'history', label: 'HISTORIAL' }
    ];

    tabsBar.innerHTML = tabs.map(tab => `
      <button 
        data-tab="${tab.id}" 
        class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
          activeTab === tab.id 
            ? 'text-primary border-b-2 border-primary -mb-[1px]' 
            : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
        }"
      >
        ${tab.label}
      </button>
    `).join('');

    // Tab Contents container
    const tabContent = document.createElement('div');
    tabContent.className = 'flex-1 overflow-y-auto min-h-[300px] py-2';
    tabContent.id = 'lead-detail-tab-content';

    bodyEl.appendChild(summaryHeader);
    bodyEl.appendChild(tabsBar);
    bodyEl.appendChild(tabContent);

    // Event listener for Comercial stage change dropdown
    const comercialSelect = summaryHeader.querySelector('#header-comercial-stage-select');
    if (comercialSelect) {
      comercialSelect.addEventListener('change', async (e) => {
        const stageId = e.target.value;
        try {
          const { error } = await supabase
            .from('leads')
            .update({ pipeline_stage_id: stageId })
            .eq('id', lead.id);

          if (error) throw error;
          lead.pipeline_stage_id = stageId;
          toast.show('Etapa Comercial actualizada con éxito', 'success');

          cache.updateLead(lead);
          await cache.loadAll();
          refreshHistory();
          renderContent();

          // Dispatch agent_event to Meta
          notifyMetaAgentStageChange(stageId, stages);
        } catch (err) {
          toast.show('Error al cambiar etapa comercial: ' + err.message, 'error');
          e.target.value = commercialStageId;
        }
      });
    }

    // Event listener for Franquiday stage change dropdown
    const franquidaySelect = summaryHeader.querySelector('#header-franquiday-stage-select');
    if (franquidaySelect) {
      franquidaySelect.addEventListener('change', async (e) => {
        const stageId = e.target.value;
        try {
          // 1. Update franquiday_stage_id in leads
          const { error: leadErr } = await supabase
            .from('leads')
            .update({ franquiday_stage_id: stageId })
            .eq('id', lead.id);

          if (leadErr) throw leadErr;
          lead.franquiday_stage_id = stageId;

          // 2. Update/Upsert in participaciones_franquiday if there is an active event
          const activeEv = cache.getActiveEvent();
          if (activeEv) {
            const { error: partErr } = await supabase
              .from('participaciones_franquiday')
              .upsert({
                lead_id: lead.id,
                evento_id: activeEv.id,
                pipeline_stage_id: stageId
              }, { onConflict: 'lead_id,evento_id' });

            if (partErr) throw partErr;
          }
          toast.show('Etapa Franquiday actualizada con éxito', 'success');

          cache.updateLead(lead);
          await cache.loadAll();
          refreshHistory();
          renderContent();
        } catch (err) {
          toast.show('Error al cambiar etapa Franquiday: ' + err.message, 'error');
          e.target.value = franquidayStageId;
        }
      });
    }

    // Tab click listeners
    tabsBar.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        localStorage.setItem('lead_detail_active_tab', activeTab);
        renderContent();
      });
    });

    // Render active tab view
    if (activeTab === 'detail') {
      renderDetailTab(tabContent, stages, profiles, isAdmin);
    } else if (activeTab === 'linked_contacts') {
      renderLinkedContactsTab(tabContent, isAdmin);
    } else if (activeTab === 'interactions') {
      renderInteractionsTab(tabContent, profiles);
    } else if (activeTab === 'whatsapp') {
      renderWhatsAppTab(tabContent);
    } else if (activeTab === 'email') {
      renderEmailTab(tabContent);
    } else if (activeTab === 'comments') {
      renderCommentsTab(tabContent, profiles);
    } else if (activeTab === 'franquiday') {
      renderFranquidayTab(tabContent, stages);
    } else if (activeTab === 'history') {
      renderHistoryTab(tabContent, stages, profiles);
    }
  }

  // REFRESH DATA FUNCTIONS
  function showTabLoader() {
    const tabEl = detailModal.bodyEl.querySelector('#lead-detail-tab-content');
    if (!tabEl) return;
    tabEl.innerHTML = `
      <div class="w-full min-h-[200px] flex items-center justify-center font-sans text-neutral-400 text-xs">
        <div class="flex flex-col items-center gap-2 select-none">
          <svg class="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="font-mono text-[9px] font-bold uppercase tracking-wider">Cargando datos...</span>
        </div>
      </div>
    `;
  }

  async function refreshHistory() {
    if (activeTab === 'history') showTabLoader();
    try {
      const [histRes, auditRes] = await Promise.all([
        supabase.from('lead_status_history').select('*').eq('lead_id', lead.id).order('changed_at', { ascending: false }),
        supabase.from('lead_audit_log').select('*').eq('lead_id', lead.id).order('changed_at', { ascending: false })
      ]);
      statusHistory = histRes.data || [];
      auditLogs = auditRes.data || [];
      if (activeTab === 'history') renderContent();
    } catch (err) {
      console.error(err);
    }
  }

  async function refreshInteractions() {
    if (activeTab === 'interactions') showTabLoader();
    try {
      const res = await supabase.from('lead_interactions').select('*').eq('lead_id', lead.id).order('contacted_at', { ascending: false });
      interactions = res.data || [];
      renderContent();
    } catch (err) {
      console.error(err);
    }
  }

  async function refreshComments() {
    if (activeTab === 'comments') showTabLoader();
    try {
      const res = await supabase.from('lead_comments').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      comments = res.data || [];
      renderContent();
    } catch (err) {
      console.error(err);
    }
  }

  // --- TAB 1: INFORMACIÓN GENERAL (DETAIL) ---
  function renderDetailTab(parent, stages, profiles, isAdmin) {
    const isNameValidated = lead.nombre_validado;

    parent.innerHTML = `
      <form id="lead-edit-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
        <!-- Company Validation Section -->
        <div class="sm:col-span-2 bg-neutral-50 border border-neutral-200 rounded-sm p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[9px] font-bold text-primary uppercase">Validación de Empresa / Marca</span>
            <span id="validation-status" class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
              isNameValidated 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }">
              ${isNameValidated ? 'Validado ✓' : 'Pendiente ⚠'}
            </span>
          </div>

          <div class="flex flex-col gap-1 relative">
            <label for="edit-company" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre Empresa / Marca *</label>
            <div class="flex flex-col sm:flex-row gap-2">
              <input type="text" id="edit-company" name="company" required value="${lead.company || ''}" class="cohere-input text-xs flex-1" />
              ${!isNameValidated ? `
                <button type="button" id="validate-name-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold uppercase rounded-sm tracking-wider transition-colors focus:outline-none shrink-0 w-full sm:w-auto text-center justify-center flex items-center cursor-pointer">
                  Confirmar y Validar
                </button>
              ` : `
                <button type="button" id="invalidate-name-btn" class="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 text-[10px] font-mono font-bold uppercase rounded-sm tracking-wider transition-colors focus:outline-none shrink-0 w-full sm:w-auto text-center justify-center flex items-center cursor-pointer">
                  Editar / Invalidar
                </button>
              `}
            </div>
            <div id="autocomplete-suggestions" class="absolute left-0 right-0 top-full mt-1 bg-white border border-[#d9d9dd] rounded-sm shadow-lg max-h-40 overflow-y-auto hidden z-50">
            </div>
            <p class="text-[10px] text-neutral-400 mt-1 font-sans">
              Si el nombre contiene errores tipográficos o variantes como S.A. / SRL, busca una existente para unificar.
            </p>
          </div>
        </div>

        <!-- General Inputs -->
        <div class="flex flex-col gap-1">
          <label for="edit-industry" class="font-mono text-[9px] font-bold text-primary uppercase">Rubro / Industria</label>
          <input type="text" id="edit-industry" name="industry" value="${lead.industry || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-branches" class="font-mono text-[9px] font-bold text-primary uppercase">Sucursales</label>
          <input type="text" id="edit-branches" name="branches" value="${lead.branches || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-investment" class="font-mono text-[9px] font-bold text-primary uppercase">Inversión Estimada</label>
          <input type="text" id="edit-investment" name="investment" value="${lead.investment || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-country" class="font-mono text-[9px] font-bold text-primary uppercase">País</label>
          <select id="edit-country" name="country" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
            <option value="">Seleccionar País</option>
            ${['Argentina', 'España', 'México', 'Uruguay', 'Chile']
              .map(c => `<option value="${c}" ${lead.country === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-assigned" class="font-mono text-[9px] font-bold text-primary uppercase">Comercial Asignado</label>
          <select id="edit-assigned" name="assigned_to" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
            <option value="">Sin Asignar</option>
            ${profiles.map(p => `<option value="${p.id}" ${lead.assigned_to === p.id ? 'selected' : ''}>${p.full_name}</option>`).join('')}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-valoracion" class="font-mono text-[9px] font-bold text-primary uppercase">Valoración</label>
          <select id="edit-valoracion" name="valoracion" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
            <option value="">Sin valoración</option>
            ${['★', '★★', '★★★', '★★★★', '★★★★★'].map(v => `<option value="${v}" ${lead.valoracion === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label for="edit-motivo-descarte" class="font-mono text-[9px] font-bold text-primary uppercase">Motivo Descarte (Solo si aplica)</label>
          <input type="text" id="edit-motivo-descarte" name="motivo_descarte" value="${lead.motivo_descarte || ''}" class="cohere-input text-xs" placeholder="Ej: Falta de presupuesto, Fuera de zona..." />
        </div>
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label for="edit-notes" class="font-mono text-[9px] font-bold text-primary uppercase">Notas Generales</label>
          <textarea id="edit-notes" name="notes" rows="3" class="cohere-input text-xs">${lead.notes || ''}</textarea>
        </div>

        <div class="sm:col-span-2 flex items-center justify-between gap-3 mt-4 border-t border-neutral-100 pt-4">
          <div>
            ${isAdmin ? `
              <button type="button" id="delete-lead-btn" class="px-5 py-2.5 border border-rose-300 hover:bg-rose-50 text-rose-600 text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-all duration-150 focus:outline-none cursor-pointer">
                Eliminar Empresa
              </button>
            ` : ''}
          </div>
          <button type="submit" id="save-lead-btn" class="px-6 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 shadow-xs focus:outline-none">
            Guardar cambios
          </button>
        </div>
      </form>
    `;

    const form = parent.querySelector('#lead-edit-form');
    const inputCompany = form.querySelector('#edit-company');
    const validateBtn = form.querySelector('#validate-name-btn');
    const invalidateBtn = form.querySelector('#invalidate-name-btn');
    const suggestionsEl = form.querySelector('#autocomplete-suggestions');
    let isNameValidState = isNameValidated;

    // Autocomplete on company field
    inputCompany.addEventListener('input', () => {
      const val = inputCompany.value.trim().toLowerCase();
      if (!val || val.length < 2) {
        suggestionsEl.classList.add('hidden');
        return;
      }
      
      const allLeads = cache.getLeads() || [];
      const matches = allLeads
        .filter(l => l.id !== lead.id && (l.company || '').toLowerCase().includes(val))
        .map(l => l.company)
        .filter((v, idx, arr) => arr.indexOf(v) === idx); // unique names

      if (matches.length > 0) {
        suggestionsEl.innerHTML = matches.map(m => `
          <div class="px-3 py-2 cursor-pointer hover:bg-neutral-50 border-b border-neutral-100 font-sans text-xs text-primary">${m}</div>
        `).join('');
        suggestionsEl.classList.remove('hidden');
        
        suggestionsEl.querySelectorAll('div').forEach(item => {
          item.addEventListener('click', () => {
            inputCompany.value = item.textContent;
            suggestionsEl.classList.add('hidden');
          });
        });
      } else {
        suggestionsEl.classList.add('hidden');
      }
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (!suggestionsEl.contains(e.target) && e.target !== inputCompany) {
        suggestionsEl.classList.add('hidden');
      }
    });

    if (validateBtn) {
      validateBtn.addEventListener('click', async () => {
        isNameValidState = true;
        await saveLeadData(true);
      });
    }

    if (invalidateBtn) {
      invalidateBtn.addEventListener('click', async () => {
        try {
          const { error } = await supabase
            .from('leads')
            .update({ nombre_validado: false })
            .eq('id', lead.id);

          if (error) throw error;
          lead.nombre_validado = false;
          cache.updateLead(lead);
          toast.show('Validación de marca anulada', 'info');
          renderContent();
        } catch (err) {
          toast.show('Error al invalidar marca: ' + err.message, 'error');
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveLeadData(isNameValidState);
    });

    async function saveLeadData(validationVal) {
      const saveBtn = form.querySelector('#save-lead-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      const formData = new FormData(form);
      const updatedFields = {
        company: formData.get('company').trim() || null,
        industry: formData.get('industry').trim() || null,
        branches: formData.get('branches').trim() || null,
        investment: formData.get('investment').trim() || null,
        country: formData.get('country') || null,
        assigned_to: formData.get('assigned_to') || null,
        valoracion: formData.get('valoracion') || null,
        notes: formData.get('notes').trim() || null,
        motivo_descarte: formData.get('motivo_descarte').trim() || null,
        nombre_validado: validationVal
      };

      try {
        const { error } = await supabase
          .from('leads')
          .update(updatedFields)
          .eq('id', lead.id);

        if (error) throw error;
        lead = { ...lead, ...updatedFields };
        cache.updateLead(lead);
        toast.show('Datos de empresa actualizados', 'success');
        refreshHistory();
        renderContent();
      } catch (err) {
        toast.show('Error al guardar: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar cambios';
      }
    }

    const deleteBtn = parent.querySelector('#delete-lead-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const confirmed = confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${lead.company || 'esta empresa'}"?\nEsta acción es irreversible y eliminará todos sus comentarios, gestiones e historial.`);
        if (!confirmed) return;

        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Eliminando...';

        try {
          const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', lead.id);

          if (error) throw error;

          toast.show('Empresa eliminada correctamente', 'success');
          detailModal.close();

          cache.deleteLead(lead.id);
          await cache.loadAll();

          if (onUpdate) onUpdate();
        } catch (err) {
          toast.show('Error al eliminar empresa: ' + err.message, 'error');
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'Eliminar Empresa';
        }
      });
    }
  }

  // --- TAB 2: CONTACTOS ASOCIADOS (LINKED CONTACTS) ---
  function renderLinkedContactsTab(parent, isAdmin) {
    let contactsListHtml = '';
    if (linkedContacts.length === 0) {
      contactsListHtml = `
        <div class="py-8 text-center text-xs text-neutral-400 italic bg-neutral-50 border border-dashed border-[#d9d9dd] rounded-sm select-none">
          No hay personas vinculadas a esta marca.
        </div>
      `;
    } else {
      contactsListHtml = `
        <div class="flex flex-col gap-3">
          ${linkedContacts.map(c => {
            const isPrimary = lead.primary_contact_id === c.id;
            return `
              <div class="border border-[#d9d9dd] rounded-sm p-4 bg-white hover:border-primary transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-primary text-sm font-display">${c.first_name || ''} ${c.last_name || ''}</span>
                    <span class="font-mono text-[9px] font-bold text-neutral-400 uppercase">${c.position || 'Sin Cargo'}</span>
                    ${isPrimary ? `<span class="inline-flex items-center px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-sm text-[8px] uppercase tracking-wider font-bold">★ Principal</span>` : ''}
                  </div>
                  <div class="flex items-center gap-3 text-[11px] text-[#616161]">
                    <span>📧 ${c.email || '—'}</span>
                    <span>•</span>
                    <div class="flex items-center gap-1">
                      <span class="font-mono">📞 ${c.phone || '—'}</span>
                      ${c.phone && c.phone !== '—'
                        ? c.telefono_validado
                          ? `<span class="inline-flex items-center px-1 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-sm text-[8px] uppercase tracking-wider font-bold" title="Número de teléfono verificado">✓ Validado</span>`
                          : `<span class="inline-flex items-center px-1 py-0.2 bg-neutral-50 text-neutral-400 border border-neutral-200 rounded-sm text-[8px] uppercase tracking-wider font-bold" title="Número de teléfono no verificado">Pendiente</span>`
                        : ''
                      }
                    </div>
                  </div>
                  ${c.linkedin_url ? `<a href="${c.linkedin_url}" target="_blank" class="text-action-blue text-[10px] font-semibold hover:underline">LinkedIn ➔</a>` : ''}
                </div>

                <div class="flex items-center gap-3 select-none shrink-0">
                  <!-- Phone Valid/Invalid Toggle -->
                  <label class="relative inline-flex items-center cursor-pointer mr-1">
                    <input type="checkbox" data-phone-toggle-id="${c.id}" class="sr-only peer" ${c.telefono_validado ? 'checked' : ''} />
                    <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-slate">${c.telefono_validado ? 'Verificado' : 'Sin verificar'}</span>
                  </label>

                  <!-- Active/Inactive Toggle -->
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" data-contact-toggle-id="${c.id}" class="sr-only peer" ${c.is_active ? 'checked' : ''} />
                    <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                    <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-slate">${c.is_active ? 'Activo' : 'Inactivo'}</span>
                  </label>

                  <!-- Primary Contact Switcher -->
                  ${!isPrimary ? `
                    <button data-make-primary-id="${c.id}" class="px-2.5 py-1 text-[9px] border border-[#d9d9dd] hover:border-emerald-600 hover:text-emerald-600 text-[#616161] font-mono font-bold uppercase rounded-sm bg-white transition-all tracking-wider focus:outline-none">
                      Marcar Principal
                    </button>
                  ` : ''}

                  <!-- Edit Button -->
                  <button data-edit-contact-id="${c.id}" class="p-1 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-50 transition-colors focus:outline-none text-[13px]" title="Editar datos del contacto">
                    ✏️
                  </button>

                  <!-- Unlink Button -->
                  <button data-unlink-id="${c.id}" class="p-1 rounded-sm text-neutral-400 hover:text-rose-600 hover:bg-neutral-50 transition-colors focus:outline-none text-[13px]" title="Desvincular contacto">
                    ✕
                  </button>

                  <!-- Delete Button (Admin Only) -->
                  ${isAdmin ? `
                    <button data-delete-contact-id="${c.id}" class="p-1 rounded-sm text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus:outline-none text-[13px]" title="ELIMINAR CONTACTO PERMANENTEMENTE">
                      🗑️
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    parent.innerHTML = `
      <div class="flex flex-col gap-4 font-sans text-xs">
        <div class="flex items-center justify-between select-none">
          <span class="text-neutral-500 font-semibold uppercase font-mono text-[9px]">Contactos vinculados</span>
          <div class="flex items-center gap-2">
            <button id="btn-link-existing-contact" class="px-3 py-1.5 border border-[#d9d9dd] hover:border-primary text-[9px] font-mono font-bold uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none">
              🔗 Vincular Existente
            </button>
            <button id="btn-create-linked-contact" class="px-3 py-1.5 bg-primary hover:bg-cohere-black text-white text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors focus:outline-none">
              + Nuevo Contacto
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          ${contactsListHtml}
        </div>
      </div>
    `;

    // Active Toggle Click Listener
    parent.querySelectorAll('[data-contact-toggle-id]').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const contactId = checkbox.dataset.contactToggleId;
        const val = e.target.checked;
        try {
          const { error } = await supabase
            .from('contacts')
            .update({ is_active: val })
            .eq('id', contactId);
          if (error) throw error;
          
          // Update Cache
          const ct = linkedContacts.find(x => x.id === contactId);
          if (ct) {
            ct.is_active = val;
            cache.updateContact(ct);
          }
          toast.show('Estado de contacto actualizado', 'success');
        } catch (err) {
          toast.show('Error al cambiar estado: ' + err.message, 'error');
          e.target.checked = !val;
        }
      });
    });

    // Phone Verification Toggle Click Listener
    parent.querySelectorAll('[data-phone-toggle-id]').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const contactId = checkbox.dataset.phoneToggleId;
        const val = e.target.checked;
        try {
          const { error } = await supabase
            .from('contacts')
            .update({ telefono_validado: val })
            .eq('id', contactId);
          if (error) throw error;
          
          // Update Cache
          const ct = linkedContacts.find(x => x.id === contactId);
          if (ct) {
            ct.telefono_validado = val;
            cache.updateContact(ct);
          }
          toast.show('Validación de teléfono actualizada', 'success');
          // Re-render contacts list to show check badge next to phone
          renderLinkedContactsTab(parent);
        } catch (err) {
          toast.show('Error al validar teléfono: ' + err.message, 'error');
          e.target.checked = !val;
        }
      });
    });

    // Make Primary Contact Click Listener
    parent.querySelectorAll('[data-make-primary-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const contactId = btn.dataset.makePrimaryId;
        try {
          const { error } = await supabase
            .from('leads')
            .update({ primary_contact_id: contactId })
            .eq('id', lead.id);
          if (error) throw error;

          lead.primary_contact_id = contactId;
          cache.updateLead(lead);
          toast.show('Contacto principal asignado correctamente', 'success');
          await loadAllData();
        } catch (err) {
          toast.show('Error al asignar principal: ' + err.message, 'error');
        }
      });
    });

    // Unlink Contact click
    parent.querySelectorAll('[data-unlink-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const contactId = btn.dataset.unlinkId;
        if (!confirm('¿Seguro que deseas desvincular este contacto de la marca?')) return;
        try {
          const { error } = await supabase
            .from('lead_contacts_link')
            .delete()
            .eq('lead_id', lead.id)
            .eq('contact_id', contactId);
          if (error) throw error;

          cache.deleteLink(lead.id, contactId);
          toast.show('Contacto desvinculado de la empresa', 'success');
          await loadAllData();
        } catch (err) {
          toast.show('Error al desvincular contacto: ' + err.message, 'error');
        }
      });
    });

    // Edit Contact click
    parent.querySelectorAll('[data-edit-contact-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const contactId = btn.dataset.editContactId;
        openContactEditModal(contactId, () => {
          loadAllData();
        });
      });
    });

    // Delete Contact click (Admin Only)
    if (isAdmin) {
      parent.querySelectorAll('[data-delete-contact-id]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const contactId = btn.dataset.deleteContactId;
          const contact = linkedContacts.find(c => c.id === contactId);
          const contactName = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : 'este contacto';

          const confirmed = confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${contactName}" de la base de datos?\nEsta acción lo desvinculará de cualquier empresa y es irreversible.`);
          if (!confirmed) return;

          try {
            const { error } = await supabase
              .from('contacts')
              .delete()
              .eq('id', contactId);

            if (error) throw error;

            toast.show('Contacto eliminado de la base de datos', 'success');
            cache.deleteContact(contactId);
            await cache.loadAll();
            await loadAllData();
            if (onUpdate) onUpdate();
          } catch (err) {
            toast.show('Error al eliminar contacto: ' + err.message, 'error');
          }
        });
      });
    }

    // Action 1: Link Existing Contact
    parent.querySelector('#btn-link-existing-contact').addEventListener('click', () => {
      const allContacts = cache.getContacts() || [];
      const linkedIds = linkedContacts.map(c => c.id);
      const linkableContacts = allContacts.filter(c => !linkedIds.includes(c.id));

      if (linkableContacts.length === 0) {
        toast.show('No hay contactos adicionales en la base de datos para vincular.', 'info');
        return;
      }

      const form = document.createElement('div');
      form.className = 'flex flex-col gap-4 font-sans text-xs relative select-none';
      form.innerHTML = `
        <div class="flex flex-col gap-1 relative">
          <label for="search-linkable-contacts" class="font-mono text-[9px] font-bold text-primary uppercase">Buscar Contacto (Nombre o Email)</label>
          <input type="text" id="search-linkable-contacts" class="cohere-input text-xs" placeholder="Escribir nombre o email..." />
          <div id="linkable-suggestions" class="absolute left-0 right-0 top-full mt-1 bg-white border border-[#d9d9dd] rounded-sm shadow-lg max-h-40 overflow-y-auto hidden z-50"></div>
        </div>
      `;

      const searchInput = form.querySelector('#search-linkable-contacts');
      const suggEl = form.querySelector('#linkable-suggestions');
      let selectedContactId = null;

      searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim().toLowerCase();
        if (!val || val.length < 2) {
          suggEl.classList.add('hidden');
          return;
        }

        const matches = linkableContacts.filter(c => 
          `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(val) ||
          (c.email || '').toLowerCase().includes(val)
        );

        if (matches.length > 0) {
          suggEl.innerHTML = matches.map(c => `
            <div data-id="${c.id}" class="px-3 py-2 cursor-pointer hover:bg-neutral-50 border-b border-neutral-100 font-sans text-xs text-primary flex justify-between">
              <b>${c.first_name || ''} ${c.last_name || ''}</b>
              <span class="text-neutral-400 font-mono text-[10px]">${c.email || '—'}</span>
            </div>
          `).join('');
          suggEl.classList.remove('hidden');

          suggEl.querySelectorAll('div').forEach(item => {
            item.addEventListener('click', () => {
              selectedContactId = item.dataset.id;
              searchInput.value = item.querySelector('b').textContent;
              suggEl.classList.add('hidden');
            });
          });
        } else {
          suggEl.classList.add('hidden');
        }
      });

      modal.create({
        title: 'Vincular Contacto Existente',
        content: form,
        actions: [
          { text: 'Cancelar' },
          {
            text: 'Vincular',
            primary: true,
            onClick: async (closeSubModal) => {
              if (!selectedContactId) {
                toast.show('Por favor, selecciona un contacto de la lista sugerida', 'info');
                return;
              }

              try {
                const { error } = await supabase
                  .from('lead_contacts_link')
                  .insert([{
                    lead_id: lead.id,
                    contact_id: selectedContactId
                  }]);

                if (error) throw error;
                
                cache.addLink({ lead_id: lead.id, contact_id: selectedContactId });

                // If lead has no primary contact, set this one
                if (!lead.primary_contact_id) {
                  await supabase
                    .from('leads')
                    .update({ primary_contact_id: selectedContactId })
                    .eq('id', lead.id);
                  lead.primary_contact_id = selectedContactId;
                  cache.updateLead(lead);
                }

                toast.show('Contacto vinculado correctamente', 'success');
                closeSubModal();
                await loadAllData();
              } catch (err) {
                toast.show('Error al vincular contacto: ' + err.message, 'error');
              }
            }
          }
        ]
      });
    });

    // Action 2: Create and Link New Contact
    parent.querySelector('#btn-create-linked-contact').addEventListener('click', () => {
      const form = document.createElement('form');
      form.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
      form.innerHTML = `
        <div class="flex flex-col gap-1 relative">
          <label for="add-c-firstname" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre *</label>
          <input type="text" id="add-c-firstname" name="first_name" required class="cohere-input text-xs" autocomplete="off" />
          <div id="add-c-firstname-suggestions" class="absolute left-0 right-0 top-full mt-1 bg-white border border-[#d9d9dd] rounded-sm shadow-lg max-h-40 overflow-y-auto hidden z-50"></div>
        </div>
        <div class="flex flex-col gap-1">
          <label for="add-c-lastname" class="font-mono text-[9px] font-bold text-primary uppercase">Apellido</label>
          <input type="text" id="add-c-lastname" name="last_name" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="add-c-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email</label>
          <input type="email" id="add-c-email" name="email" class="cohere-input text-xs" placeholder="correo@ejemplo.com" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="add-c-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono</label>
          <input type="text" id="add-c-phone" name="phone" class="cohere-input text-xs" placeholder="Ej: +54 9 11..." />
        </div>
        <div class="flex flex-col gap-1">
          <label for="add-c-position" class="font-mono text-[9px] font-bold text-primary uppercase">Cargo</label>
          <input type="text" id="add-c-position" name="position" class="cohere-input text-xs" placeholder="CEO, Director..." />
        </div>
        <div class="flex flex-col gap-1">
          <label for="add-c-linkedin" class="font-mono text-[9px] font-bold text-primary uppercase">LinkedIn URL</label>
          <input type="url" id="add-c-linkedin" name="linkedin_url" class="cohere-input text-xs" placeholder="https://..." />
        </div>
        <div class="flex flex-col gap-1 sm:col-span-2">
          <label for="add-c-medio" class="font-mono text-[9px] font-bold text-primary uppercase">Medio de Contacto Preferido</label>
          <select id="add-c-medio" name="medio_contacto" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">Email</option>
            <option value="Teléfono">Teléfono</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Meet">Meet</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        
        <!-- Phone Validation Toggle -->
        <div class="flex items-center gap-3 sm:col-span-2 select-none">
          <span class="font-mono text-[9px] font-bold text-primary uppercase">Validación de teléfono</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="add-c-phone-valid" name="telefono_validado" class="sr-only peer" />
            <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
            <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-slate" id="add-c-phone-valid-label">No Validado</span>
          </label>
        </div>

        <!-- WhatsApp Agent Allowlist Toggle Section -->
        <div id="add-c-allowlist-container" class="sm:col-span-2 mt-2 pt-3 border-t border-neutral-200">
          <div class="flex items-center gap-2 text-neutral-400 py-1 text-[10px]">
            <span class="animate-pulse">🔄</span> Cargando números de Agente de WhatsApp...
          </div>
        </div>
      `;

      // Interactive label update
      setTimeout(() => {
        const toggleEl = form.querySelector('#add-c-phone-valid');
        const labelEl = form.querySelector('#add-c-phone-valid-label');
        if (toggleEl && labelEl) {
          toggleEl.addEventListener('change', () => {
            labelEl.textContent = toggleEl.checked ? 'Validado' : 'No Validado';
          });
        }
      }, 50);

      async function loadCreateAllowlistSection() {
        const container = form.querySelector('#add-c-allowlist-container');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const jwt = session?.access_token;
          const headers = { 'Authorization': `Bearer ${jwt}` };

          const numRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/numbers`, { headers });
          const numData = await numRes.json();
          const numbers = (numData.data || []).filter(n => n.is_eligible_agent || n.agent_status === 'ACTIVE' || n.agent_status === 'ELIGIBLE');

          if (numbers.length === 0) {
            container.innerHTML = `
              <div class="p-2 bg-neutral-50 border border-neutral-200 text-neutral-500 text-[10px] font-mono">
                No hay números de WhatsApp con Agente de IA configurados.
              </div>
            `;
            return;
          }

          let html = `
            <div class="flex flex-col gap-2 select-none">
              <div class="flex flex-col gap-1">
                <span class="font-mono text-[9px] font-bold text-primary uppercase">Habilitar en Agentes de WhatsApp (Lista Blanca / AI Audience)</span>
                <p class="text-[9px] text-neutral-500 font-sans leading-normal bg-blue-50/80 border border-blue-200/60 p-2 rounded-sm">
                  ℹ️ <strong>Nota:</strong> Si la audiencia del agente está configurada en <strong>Todos (EVERYONE)</strong> en Ajustes Principales, la IA responderá a cualquier usuario. La Lista Blanca se aplica estrictamente cuando la audiencia se establece en <strong>Solo Lista Blanca (ALLOWLISTED_ONLY)</strong>.
                </p>
              </div>
          `;

          for (const num of numbers) {
            html += `
              <div class="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-sm">
                <div class="flex flex-col gap-0.5">
                  <span class="font-mono text-[10px] font-bold text-primary">${num.display_phone_number} ${num.verified_name ? `(${num.verified_name})` : ''}</span>
                  <span class="text-[9px] text-neutral-500 font-mono">Estado Agente: <strong class="${num.agent_status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}">${num.agent_status || 'Elegible'}</strong></span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" data-waba-id="${num.id}" class="sr-only peer new-contact-allowlist-toggle" checked />
                  <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span class="ml-2 text-[9px] font-mono font-bold uppercase text-neutral-600 allowlist-toggle-label">
                    Habilitado
                  </span>
                </label>
              </div>
            `;
          }

          html += `</div>`;
          container.innerHTML = html;

          container.querySelectorAll('.new-contact-allowlist-toggle').forEach(input => {
            input.addEventListener('change', () => {
              const label = input.parentElement.querySelector('.allowlist-toggle-label');
              if (label) label.textContent = input.checked ? 'Habilitado' : 'Deshabilitado';
            });
          });
        } catch (e) {
          container.innerHTML = `<span class="text-rose-600 text-[10px]">Error al cargar agentes: ${e.message}</span>`;
        }
      }

      loadCreateAllowlistSection();

      modal.create({
        title: 'Crear y Vincular Nuevo Contacto',
        content: form,
        actions: [
          { text: 'Cancelar' },
          {
            text: 'Crear y Vincular',
            primary: true,
            onClick: async (closeSubModal) => {
              const formData = new FormData(form);
              const emailVal = formData.get('email').trim();
              const newContact = {
                first_name: formData.get('first_name').trim(),
                last_name: formData.get('last_name').trim() || null,
                email: emailVal ? emailVal.toLowerCase() : null,
                phone: formData.get('phone').trim() || null,
                position: formData.get('position').trim() || null,
                linkedin_url: formData.get('linkedin_url').trim() || null,
                medio_contacto: formData.get('medio_contacto'),
                telefono_validado: form.querySelector('#add-c-phone-valid').checked,
                fecha_carga: new Date().toISOString().split('T')[0],
                fecha_ultimo_contacto: new Date().toISOString().split('T')[0],
                is_active: true
              };

              try {
                // Check if email already exists
                if (newContact.email) {
                  const { data: dup } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('email', newContact.email)
                    .maybeSingle();

                  if (dup) {
                    toast.show('El email ingresado ya pertenece a un contacto existente. Usa la opción "Vincular Existente".', 'error');
                    return;
                  }
                }

                const { data: contactData, error: contactErr } = await supabase
                  .from('contacts')
                  .insert([newContact])
                  .select()
                  .single();

                if (contactErr) throw contactErr;

                // Sync to allowlist if phone provided and toggle checked
                if (newContact.phone) {
                  const { data: { session } } = await supabase.auth.getSession();
                  const jwt = session?.access_token;
                  const apiHeaders = { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' };

                  const toggleInputs = form.querySelectorAll('.new-contact-allowlist-toggle');
                  for (const input of toggleInputs) {
                    if (input.checked) {
                      const wabaId = input.dataset.wabaId;
                      try {
                        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist`, {
                          method: 'POST',
                          headers: apiHeaders,
                          body: JSON.stringify({ phone_number_id: wabaId, consumer_phone_number: newContact.phone })
                        });
                      } catch (err) {
                        console.error(`Error adding new contact to allowlist for WABA ${wabaId}:`, err);
                      }
                    }
                  }
                }

                cache.addContact(contactData);

                // Link
                const { error: linkErr } = await supabase
                  .from('lead_contacts_link')
                  .insert([{
                    lead_id: lead.id,
                    contact_id: contactData.id
                  }]);

                if (linkErr) throw linkErr;

                cache.addLink({ lead_id: lead.id, contact_id: contactData.id });

                // If lead has no primary contact, set this one
                if (!lead.primary_contact_id) {
                  await supabase
                    .from('leads')
                    .update({ primary_contact_id: contactData.id })
                    .eq('id', lead.id);
                  lead.primary_contact_id = contactData.id;
                  cache.updateLead(lead);
                }

                toast.show('Contacto creado y vinculado correctamente', 'success');
                closeSubModal();
                await loadAllData();
              } catch (err) {
                toast.show('Error al registrar contacto: ' + err.message, 'error');
              }
            }
          }
        ]
    });

    // Autocomplete y sugerencias para evitar duplicados en nuevo contacto
    const contactInput = form.querySelector('#add-c-firstname');
    const contactSuggestions = form.querySelector('#add-c-firstname-suggestions');

    contactInput.addEventListener('input', () => {
      const val = contactInput.value.trim().toLowerCase();
      if (!val || val.length < 2) {
        contactSuggestions.classList.add('hidden');
        return;
      }

      const allContacts = cache.getContacts() || [];
      const matches = allContacts.filter(c => 
        `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(val) ||
        (c.email || '').toLowerCase().includes(val)
      );

      if (matches.length > 0) {
        contactSuggestions.innerHTML = `
          <div class="px-3 py-1 bg-amber-50 text-amber-800 text-[9px] font-bold font-mono border-b border-amber-100 uppercase select-none">
            ⚠️ Contacto similar ya registrado:
          </div>
          ${matches.map(c => {
            const linkedLeads = cache.getContactLeads(c.id) || [];
            const companyName = linkedLeads.length > 0 ? (linkedLeads[0].company || '') : 'Sin Empresa';
            return `
              <div class="px-3 py-2 cursor-pointer hover:bg-neutral-50 border-b border-neutral-100 font-sans text-xs text-primary flex flex-col gap-0.5">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-primary">${c.first_name || ''} ${c.last_name || ''}</span>
                  <span class="text-[9px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-full uppercase tracking-wider font-bold">${companyName}</span>
                </div>
                <div class="text-[10px] text-neutral-400 font-mono">
                  <span>📧 ${c.email || '—'}</span> | <span>📞 ${c.phone || '—'}</span>
                </div>
              </div>
            `;
          }).join('')}
        `;
        contactSuggestions.classList.remove('hidden');

        contactSuggestions.querySelectorAll('.cursor-pointer').forEach(item => {
          item.addEventListener('click', () => {
            const nameSpan = item.querySelector('.font-bold');
            if (nameSpan) {
              const parts = nameSpan.textContent.split(' ');
              contactInput.value = parts[0] || '';
              const lastNameInput = form.querySelector('#add-c-lastname');
              if (lastNameInput) {
                lastNameInput.value = parts.slice(1).join(' ') || '';
              }
              const emailInput = form.querySelector('#add-c-email');
              if (emailInput && !emailInput.value) {
                const matchC = matches.find(c => `${c.first_name || ''} ${c.last_name || ''}`.trim() === nameSpan.textContent.trim());
                if (matchC) {
                  emailInput.value = matchC.email || '';
                  const phoneInput = form.querySelector('#add-c-phone');
                  if (phoneInput) phoneInput.value = matchC.phone || '';
                  const posInput = form.querySelector('#add-c-position');
                  if (posInput) posInput.value = matchC.position || '';
                  const linkInput = form.querySelector('#add-c-linkedin');
                  if (linkInput) linkInput.value = matchC.linkedin_url || '';
                }
              }
            }
            contactSuggestions.classList.add('hidden');
          });
        });
      } else {
        contactSuggestions.classList.add('hidden');
      }
    });

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!contactSuggestions.contains(e.target) && e.target !== contactInput) {
        contactSuggestions.classList.add('hidden');
      }
    });
  });
  }

  // --- TAB 3: GESTIONES (INTERACTIONS) ---
  function renderInteractionsTab(parent, profiles) {
    let contactsListHtml = '';
    if (interactions.length === 0) {
      contactsListHtml = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No hay gestiones registradas aún para este lead.
        </div>
      `;
    } else {
      contactsListHtml = `
        <div class="flex flex-col gap-4 font-sans text-xs">
          ${interactions.map(c => {
            const isIncoming = c.direction === 'inbound';
            let authorName = '';
            
            if (isIncoming) {
              authorName = 'Cliente';
            } else {
              const agent = profiles.find(p => p.id === c.created_by);
              authorName = agent?.full_name || 'Comercial';
            }
            
            let typeBadge = '';
            if (c.contact_type === 'whatsapp') typeBadge = '🟢 WhatsApp';
            else if (c.contact_type === 'email') typeBadge = '✉️ Email';
            else if (c.contact_type === 'telefono') typeBadge = '📞 Teléfono';
            else if (c.contact_type === 'meet') typeBadge = '💻 Meet';
            else if (c.contact_type === 'linkedin') typeBadge = '🔗 LinkedIn';
            else typeBadge = 'ℹ️ Otro';

            const dirBadge = c.direction === 'inbound' 
              ? '<span class="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-100 uppercase">Entrante</span>'
              : '<span class="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-100 uppercase">Saliente</span>';

            return `
              <div class="border border-[#d9d9dd] rounded-sm p-4 bg-neutral-50/30 flex flex-col gap-2">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-neutral-100 pb-2">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[9px] font-bold text-primary uppercase bg-neutral-100 px-2 py-0.5 rounded-sm">${typeBadge}</span>
                    ${dirBadge}
                    <span class="font-semibold text-primary">${c.subject || 'Interacción'}</span>
                  </div>
                  <div class="flex items-center gap-2 text-[10px] text-muted-slate">
                    <span>Por: <b>${authorName}</b></span>
                    <span>•</span>
                    <span class="font-mono">${formatDateTime(c.contacted_at)}</span>
                  </div>
                </div>
                <p class="text-[#616161] leading-relaxed whitespace-pre-wrap mt-1">${c.body || 'Sin detalles registrados.'}</p>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    parent.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="flex justify-end select-none">
          <button id="add-contact-btn" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
            + Registrar Gestión
          </button>
        </div>
        <div class="flex-1 overflow-y-auto">
          ${contactsListHtml}
        </div>
      </div>
    `;

    // Registrar Gestión modal
    parent.querySelector('#add-contact-btn').addEventListener('click', () => {
      const form = document.createElement('form');
      form.className = 'flex flex-col gap-4 select-none';
      form.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label for="contact-type" class="font-mono text-[9px] font-bold text-primary uppercase">Medio de Contacto</label>
            <select id="contact-type" name="contact_type" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="telefono">Llamada de Teléfono</option>
              <option value="meet">Videollamada (Meet/Zoom)</option>
              <option value="linkedin">LinkedIn</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          
          <div class="flex flex-col gap-1">
            <label for="contact-direction" class="font-mono text-[9px] font-bold text-primary uppercase">Dirección</label>
            <select id="contact-direction" name="direction" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
              <option value="outbound">Saliente (Contactamos al lead)</option>
              <option value="inbound">Entrante (El lead nos contactó)</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label for="contact-subject" class="font-mono text-[9px] font-bold text-primary uppercase">Asunto / Título breve</label>
          <input type="text" id="contact-subject" name="subject" required class="cohere-input text-xs" placeholder="Ej: Llamada de presentación / Envío de catálogo" />
        </div>

        <div class="flex flex-col gap-1">
          <label for="contact-body" class="font-mono text-[9px] font-bold text-primary uppercase">Detalles de la gestión</label>
          <textarea id="contact-body" name="body" rows="4" class="cohere-input text-xs" placeholder="Resumir lo conversado o notas de seguimiento..."></textarea>
        </div>
      `;

      modal.create({
        title: 'Registrar Nueva Gestión',
        content: form,
        actions: [
          { text: 'Cancelar' },
          {
            text: 'Registrar',
            primary: true,
            onClick: async (closeSubModal) => {
              const formData = new FormData(form);
              const newInteraction = {
                lead_id: lead.id,
                contact_type: formData.get('contact_type'),
                direction: formData.get('direction'),
                subject: formData.get('subject').trim(),
                body: formData.get('body').trim() || null,
                created_by: (await supabase.auth.getUser()).data.user?.id,
                contacted_at: new Date().toISOString()
              };

              try {
                const { error } = await supabase
                  .from('lead_interactions')
                  .insert([newInteraction]);

                if (error) throw error;
                
                // Update fecha_ultimo_contacto on lead
                const contactTime = newInteraction.contacted_at;
                await supabase
                  .from('leads')
                  .update({ fecha_ultimo_contacto: contactTime, updated_at: contactTime })
                  .eq('id', lead.id);

                lead.fecha_ultimo_contacto = contactTime;
                cache.updateLead(lead);
                cache.addInteraction(newInteraction);

                // Update fecha_ultimo_contacto on all contacts linked to this company
                const today = contactTime.split('T')[0];
                if (linkedContacts.length > 0) {
                  const contactIds = linkedContacts.map(c => c.id);
                  await supabase
                    .from('contacts')
                    .update({ fecha_ultimo_contacto: today })
                    .in('id', contactIds);
                  
                  linkedContacts.forEach(c => {
                    c.fecha_ultimo_contacto = today;
                    cache.updateContact(c);
                  });
                }

                // Send real-time notifications to team members
                await notifyNewInteraction({
                  lead,
                  interaction: newInteraction,
                  currentUser
                });

                toast.show('Gestión registrada correctamente', 'success');
                closeSubModal();
                await loadAllData();
                refreshHistory();
              } catch (err) {
                toast.show('Error al registrar gestión: ' + err.message, 'error');
              }
            }
          }
        ]
      });
    });
  }

  // --- TAB 4: COMENTARIOS ---
  function renderCommentsTab(parent, profiles) {
    let commentsListHtml = '';
    if (comments.length === 0) {
      commentsListHtml = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No hay comentarios sobre este lead.
        </div>
      `;
    } else {
      commentsListHtml = `
        <div class="flex flex-col gap-3 font-sans text-xs">
          ${comments.map(c => {
            const author = profiles.find(p => p.id === c.author_id);
            const authorName = author?.full_name || 'Comercial';
            
            return `
              <div class="border border-[#e5e7eb] rounded-sm p-3 bg-white flex flex-col gap-1.5 shadow-2xs">
                <div class="flex items-center justify-between text-[10px] text-muted-slate">
                  <span class="font-bold text-primary">${authorName}</span>
                  <span class="font-mono">${formatDateTime(c.created_at)}</span>
                </div>
                <p class="text-[#616161] leading-relaxed whitespace-pre-wrap">${c.content}</p>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    parent.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2 select-none">
          <label for="new-comment-box" class="font-mono text-[9px] font-bold text-primary uppercase">Agregar Comentario Interno</label>
          <textarea id="new-comment-box" rows="2" class="cohere-input text-xs" placeholder="Escribir una anotación de seguimiento..."></textarea>
          <div class="flex justify-end select-none mt-1">
            <button id="submit-comment-btn" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
              Guardar Nota
            </button>
          </div>
        </div>
        <div class="h-px bg-neutral-100"></div>
        <div class="flex-1 overflow-y-auto max-h-60">
          ${commentsListHtml}
        </div>
      </div>
    `;

    const commentBox = parent.querySelector('#new-comment-box');
    const submitBtn = parent.querySelector('#submit-comment-btn');

    submitBtn.addEventListener('click', async () => {
      const content = commentBox.value.trim();
      if (!content) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';

      try {
        const newComment = {
          lead_id: lead.id,
          content,
          author_id: (await supabase.auth.getUser()).data.user?.id
        };

        const { error } = await supabase
          .from('lead_comments')
          .insert([newComment]);

        if (error) throw error;

        toast.show('Nota agregada correctamente', 'success');
        commentBox.value = '';
        refreshComments();
      } catch (err) {
        toast.show('Error al agregar comentario: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Nota';
      }
    });
  }

  // --- TAB 5: HISTORIAL (AUDIT LOGS) ---
  function renderHistoryTab(parent, stages, profiles) {
    const timelineItems = [];

    statusHistory.forEach(h => {
      const changer = profiles.find(p => p.id === h.changed_by);
      const changerName = changer?.full_name || 'Comercial';
      
      const oldStage = stages.find(s => s.id === h.old_stage_id);
      const newStage = stages.find(s => s.id === h.new_stage_id);
      
      const oldName = oldStage?.name || 'Inicio';
      const newName = newStage?.name || 'Sin Gestión';

      timelineItems.push({
        timestamp: new Date(h.changed_at),
        html: `
          <div class="flex items-start gap-3">
            <span class="w-2.5 h-2.5 rounded-full bg-primary mt-1 border-2 border-white shadow-xs shrink-0"></span>
            <div class="flex flex-col gap-0.5">
              <span class="font-sans text-xs text-neutral-800">
                Cambió etapa: <b class="text-neutral-500">${oldName}</b> ➔ <b class="text-primary">${newName}</b>
              </span>
              <span class="font-sans text-[10px] text-muted-slate">
                Por <b>${changerName}</b> • <span class="font-mono text-[9px]">${formatDateTime(h.changed_at)}</span>
              </span>
            </div>
          </div>
        `
      });
    });

    auditLogs.forEach(log => {
      const changer = profiles.find(p => p.id === log.changed_by);
      const changerName = changer?.full_name || 'Sistema';

      timelineItems.push({
        timestamp: new Date(log.changed_at),
        html: `
          <div class="flex items-start gap-3">
            <span class="w-2.5 h-2.5 rounded-full bg-coral mt-1 border-2 border-white shadow-xs shrink-0"></span>
            <div class="flex flex-col gap-0.5">
              <span class="font-sans text-xs text-neutral-800">
                Editó <b>${translateFieldName(log.field_name)}</b>: <i class="text-neutral-400">"${log.old_value || ''}"</i> ➔ <b class="text-primary">"${log.new_value || ''}"</b>
              </span>
              <span class="font-sans text-[10px] text-muted-slate">
                Por <b>${changerName}</b> • <span class="font-mono text-[9px]">${formatDateTime(log.changed_at)}</span>
              </span>
            </div>
          </div>
        `
      });
    });

    timelineItems.sort((a, b) => b.timestamp - a.timestamp);

    if (timelineItems.length === 0) {
      parent.innerHTML = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No hay registros de auditoría aún para este lead.
        </div>
      `;
      return;
    }

    parent.innerHTML = `
      <div class="relative border-l border-neutral-200 pl-4 py-2 flex flex-col gap-6 max-h-80 overflow-y-auto">
        ${timelineItems.map(item => item.html).join('')}
      </div>
    `;
  }

  function translateFieldName(field) {
    const translations = {
      company: 'Empresa',
      country: 'País',
      source: 'Origen',
      industry: 'Rubro',
      investment: 'Inversión',
      branches: 'Sucursales',
      assigned_to: 'Asignación',
      valoracion: 'Valoración',
      notes: 'Notas',
      motivo_descarte: 'Motivo descarte',
      primary_contact_id: 'Contacto Principal',
      nombre_validado: 'Nombre Validado',
      franquiday_stage_id: 'Etapa Franquiday',
      franquiday_notes: 'Notas Franquiday'
    };
    return translations[field] || field;
  }

  async function renderFranquidayTab(parent, stages) {
    const activeEvent = cache.getActiveEvent();
    const participations = cache.getLeadParticipations(lead.id) || [];

    // Resolve participation in active event if exists
    const activeParticipation = activeEvent 
      ? participations.find(p => p.evento_id === activeEvent.id)
      : null;

    const currentStageId = lead.franquiday_stage_id || activeParticipation?.pipeline_stage_id || stages[0]?.id;
    const currentNotes = lead.franquiday_notes || activeParticipation?.notes || '';

    let activeEventHtml = '';
    if (!activeEvent) {
      activeEventHtml = `
        <div class="bg-amber-50 border border-amber-200 rounded-sm p-4 text-amber-700 italic select-none">
          ⚠️ No hay ninguna edición de Franquiday activa actualmente. Puedes dar de alta y activar una desde la pestaña de Configuración.
        </div>
      `;
    } else {
      activeEventHtml = `
        <div class="bg-white border border-[#d9d9dd] rounded-sm p-5 flex flex-col gap-4 shadow-2xs">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div>
              <span class="font-mono text-[9px] font-bold text-neutral-400 uppercase">Edición Activa</span>
              <h4 class="text-sm font-bold text-primary mt-0.5">${activeEvent.nombre}</h4>
              <p class="text-[10px] text-muted-slate font-sans mt-0.5">🎪 ${activeEvent.lugar} (${activeEvent.ciudad}, ${activeEvent.pais}) • 📅 ${activeEvent.fecha}</p>
            </div>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Activo</span>
          </div>

          <form id="franquiday-active-form" class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <label for="franquiday-stage" class="font-mono text-[9px] font-bold text-primary uppercase">Etapa de Participación</label>
              <select id="franquiday-stage" name="stage_id" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
                ${stages.map(s => `<option value="${s.id}" ${currentStageId === s.id ? 'selected' : ''}>${s.name.toUpperCase()}</option>`).join('')}
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label for="franquiday-notes" class="font-mono text-[9px] font-bold text-primary uppercase">Notas y Comentarios del Evento</label>
              <textarea id="franquiday-notes" name="notes" rows="4" class="cohere-input text-xs" placeholder="Escribir requerimientos del stand, notas comerciales, etc...">${currentNotes}</textarea>
            </div>

            <div class="flex justify-end mt-2">
              <button type="submit" id="save-franquiday-btn" class="px-5 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
                Guardar Participación
              </button>
            </div>
          </form>
        </div>
      `;
    }

    // Previous editions history list
    const pastParticipations = participations.filter(p => !activeEvent || p.evento_id !== activeEvent.id);
    let historyHtml = '';
    if (pastParticipations.length === 0) {
      historyHtml = `
        <div class="py-6 text-center text-neutral-400 italic bg-neutral-50 border border-dashed border-[#d9d9dd] rounded-sm select-none">
          No hay participaciones registradas en ediciones pasadas.
        </div>
      `;
    } else {
      historyHtml = `
        <div class="flex flex-col gap-3">
          ${pastParticipations.map(p => {
            const ev = cache.getEvent(p.evento_id);
            const evName = ev ? ev.nombre : 'Edición Franquiday';
            const evDetails = ev ? `📅 ${ev.fecha} • 📍 ${ev.ciudad}` : '';
            const st = stages.find(s => s.id === p.pipeline_stage_id);
            const stName = st ? st.name : 'Sin Gestión';
            const stColor = st ? st.color : '#94a3b8';

            return `
              <div class="border border-[#e5e7eb] rounded-sm p-4 bg-neutral-50/50 flex flex-col gap-2">
                <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div>
                    <h5 class="font-bold text-primary text-xs">${evName}</h5>
                    <p class="text-[9px] text-muted-slate mt-0.5 font-sans">${evDetails}</p>
                  </div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider text-white" style="background-color: ${stColor}">
                    ${stName}
                  </span>
                </div>
                <p class="text-neutral-600 leading-relaxed whitespace-pre-wrap">${p.notes || 'Sin anotaciones registradas.'}</p>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    parent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans text-xs">
        <!-- Active Event Management -->
        <div class="flex flex-col gap-4">
          <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase">Gestión Edición Activa</h3>
          ${activeEventHtml}
        </div>

        <!-- History of past events -->
        <div class="flex flex-col gap-4">
          <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase">Historial de Participaciones</h3>
          <div class="flex-1 overflow-y-auto max-h-[380px] pr-1">
            ${historyHtml}
          </div>
        </div>
      </div>
    `;

    // Active form submit handler
    const franquidayForm = parent.querySelector('#franquiday-active-form');
    if (franquidayForm) {
      franquidayForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = franquidayForm.querySelector('#save-franquiday-btn');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const formData = new FormData(franquidayForm);
        const stageId = formData.get('stage_id');
        const notesVal = formData.get('notes').trim() || null;

        try {
          // 1. Update denormalized stage fields in leads table
          const { error: leadErr } = await supabase
            .from('leads')
            .update({
              franquiday_stage_id: stageId,
              franquiday_notes: notesVal
            })
            .eq('id', lead.id);

          if (leadErr) throw leadErr;

          // 2. Upsert in participaciones_franquiday
          const { error: partErr } = await supabase
            .from('participaciones_franquiday')
            .upsert({
              lead_id: lead.id,
              evento_id: activeEvent.id,
              pipeline_stage_id: stageId,
              notes: notesVal
            }, { onConflict: 'lead_id,evento_id' });

          if (partErr) throw partErr;

          lead.franquiday_stage_id = stageId;
          lead.franquiday_notes = notesVal;

          toast.show('Participación Franquiday guardada con éxito', 'success');
          
          await cache.loadAll();
          await loadAllData();
          refreshHistory();
        } catch (err) {
          toast.show('Error al guardar participación: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Guardar Participación';
        }
      });
    }
  }

  // --- TAB: WHATSAPP ---
  async function renderWhatsAppTab(parent) {
    parent.innerHTML = `
      <div class="py-12 flex flex-col items-center justify-center gap-3 font-sans text-neutral-400 text-xs select-none">
        <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Cargando datos de WhatsApp...</span>
      </div>
    `;

    let activeNumbers = [];
    let templates = [];
    let fetchError = null;

    try {
      // 1. Fetch active numbers from proxy / database
      const session = await auth.getSession();
      const jwt = session?.access_token;

      const numProxyRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/numbers`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      }).catch(() => null);

      if (numProxyRes && numProxyRes.ok) {
        const numData = await numProxyRes.json();
        activeNumbers = numData.data || [];
      } else {
        const { data: numbersRes, error: numErr } = await supabase
          .from('whatsapp_numbers')
          .select('*')
          .eq('is_active', true);
        if (numErr) throw numErr;
        activeNumbers = numbersRes || [];
      }

      // 2. Fetch approved templates from Meta proxy
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/templates`, {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });

      if (res.ok) {
        const result = await res.json();
        templates = result.data || [];
      } else {
        const err = await res.json();
        throw new Error(err.error?.message || err.error || 'Error al obtener plantillas de Meta');
      }
    } catch (err) {
      console.error('Error loading WhatsApp tab data:', err);
      fetchError = err.message;
    }

    if (fetchError) {
      parent.innerHTML = `
        <div class="p-6 border border-rose-200 bg-rose-50/50 rounded-sm font-sans text-xs text-rose-700 flex flex-col gap-2">
          <h4 class="font-bold uppercase tracking-wider text-[10px]">Error al cargar WhatsApp</h4>
          <p>${fetchError}</p>
          <p class="text-neutral-500 mt-1">Por favor verifica que la integración de WhatsApp esté configurada en los Ajustes.</p>
        </div>
      `;
      return;
    }

    // Sort contacts placing the lead's primary contact first
    const primaryContactId = lead.primary_contact_id;
    const sortedContacts = [...linkedContacts].sort((a, b) => {
      if (a.id === primaryContactId) return -1;
      if (b.id === primaryContactId) return 1;
      return 0;
    });

    // Build filter dropdown options
    const filterContactOptions = sortedContacts.map((c, idx) => {
      const isPrimary = c.id === primaryContactId || (!primaryContactId && idx === 0);
      const primaryBadge = c.id === primaryContactId ? ' ⭐ (Principal)' : '';
      return `
        <option value="${c.id}" data-phone="${c.phone || ''}" ${isPrimary ? 'selected' : ''}>
          ${c.first_name} ${c.last_name}${primaryBadge} (${c.phone || 'Sin Teléfono'})
        </option>
      `;
    }).join('');

    const filterSenderOptions = activeNumbers.map((n, idx) => `
      <option value="${n.phone_number_id || n.id}" ${idx === 0 ? 'selected' : ''}>
        ${n.verified_name || 'CRM'} (${n.display_phone_number}) ${n.is_eligible_agent || n.agent_status === 'ACTIVE' ? '🤖' : ''}
      </option>
    `).join('');

    // Helper to generate chat HTML for a list of messages
    const generateChatHtml = (messagesList) => {
      if (!messagesList || messagesList.length === 0) {
        return `
          <div class="flex flex-col items-center justify-center py-16 text-neutral-400 text-xs italic gap-2 select-none">
            <svg class="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span>No hay mensajes de WhatsApp registrados para este filtro.</span>
          </div>
        `;
      }

      let lastDateGroup = null;
      const statusTick = (msg) => {
        if (!msg || msg.direction !== 'outbound') return '';
        const s = msg.status;
        const deliveredLabel = msg.delivered_at ? new Date(msg.delivered_at).toLocaleString() : '';
        const readLabel = msg.read_at ? new Date(msg.read_at).toLocaleString() : '';
        const schedLabel = msg.scheduled_for ? new Date(msg.scheduled_for).toLocaleString() : '';
        
        if (s === 'scheduled') return `<span title="Programado para: ${schedLabel}" class="cursor-help" style="color:#d97706;font-size:8px;">🕒</span>`;
        if (s === 'sent')      return `<span title="Enviado a Meta" class="font-sans text-[10px]" style="color:#71717a;font-weight:bold;">✓</span>`;
        if (s === 'delivered') return `<span title="Recibido en celular: ${deliveredLabel}" class="cursor-help font-sans text-[10px]" style="color:#71717a;font-weight:bold;">✓✓</span>`;
        if (s === 'read')      return `<span title="Leído: ${readLabel}" class="cursor-help font-sans text-[10px]" style="color:#1863dc;font-weight:bold;">✓✓</span>`;
        if (s === 'failed')    return `<span title="Error: ${msg.error_message || 'Fallo de envío'}" class="cursor-help font-sans text-[10px]" style="color:#ef4444;font-weight:bold;">✗</span>`;
        return '';
      };

      const formatWhatsAppText = (rawText) => {
        if (!rawText) return '';

        // 1. Escape HTML special characters to prevent XSS
        let text = String(rawText)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

        // 2. Format Monospace ```code``` or `code`
        text = text.replace(/```([^`]+)```/g, '<code class="bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded text-[11px] font-mono block whitespace-pre-wrap my-1 font-normal text-neutral-800">$1</code>');
        text = text.replace(/`([^`]+)`/g, '<code class="bg-neutral-100 border border-neutral-200 px-1 py-0.5 rounded text-[11px] font-mono font-normal text-neutral-800">$1</code>');

        // 3. Format Bold (*text*)
        text = text.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, '$1<strong class="font-bold">$2</strong>$3');

        // 4. Format Italic (_text_)
        text = text.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, '$1<em class="italic">$2</em>$3');

        // 5. Format Strikethrough (~text~)
        text = text.replace(/(^|[^\w~])~([^~\n]+)~([^\w~]|$)/g, '$1<del class="line-through opacity-80">$2</del>$3');

        // 6. Format Clickable Links (http/https URLs)
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        text = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline break-all font-medium">$1</a>');

        return text;
      };

      const bubbles = messagesList.map(msg => {
        const isOut = msg.direction === 'outbound';
        const ts = new Date(msg.sent_at || msg.created_at);
        const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
        const dateGroupStr = ts.toLocaleDateString('es-ES', dateOptions);
        let dateHeaderHtml = '';
        if (dateGroupStr !== lastDateGroup) {
          lastDateGroup = dateGroupStr;
          const capitalizedDate = dateGroupStr.charAt(0).toUpperCase() + dateGroupStr.slice(1);
          dateHeaderHtml = `
            <div class="flex justify-center my-3 select-none w-full animate-fade-in">
              <span class="bg-neutral-200/50 text-neutral-500 text-[8.5px] px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">
                ${capitalizedDate}
              </span>
            </div>
          `;
        }

        const senderNum = isOut ? activeNumbers.find(n => n.phone_number_id === msg.phone_number_id) : null;
        const senderLabel = senderNum
          ? `${senderNum.verified_name || 'CRM'} (${senderNum.display_phone_number})`
          : (isOut && msg.phone_number_id ? msg.phone_number_id : null);

        const metaParts = [];
        if (senderLabel) metaParts.push(senderLabel);
        if (msg.template_name) metaParts.push(`plantilla: ${msg.template_name}`);
        if (msg.pricing_category) metaParts.push(msg.pricing_category);
        const metaLine = metaParts.length > 0
          ? `<div class="text-[8.5px] text-neutral-400 mt-0.5 px-1.5 select-none lowercase tracking-wide" style="max-width:85%;">${metaParts.join(' &middot; ')}</div>`
          : '';

        const errorLine = (msg.status === 'failed' && msg.error_message)
          ? `<div class="text-[8.5px] text-rose-500 mt-0.5 px-1.5 font-mono">⚠ error: ${msg.error_message}</div>`
          : '';

        const renderMessageContent = (m) => {
          const isAudio = !!m.media_url || (m.media_type && m.media_type.startsWith('audio')) || (m.body && (m.body.includes('[Nota de voz]') || m.body.includes('[Archivo de audio]')));

          if (isAudio && m.media_url) {
            return `
              <div class="flex flex-col gap-1.5 py-1 min-w-[220px] max-w-[280px]">
                <div class="flex items-center gap-1.5 text-neutral-700 select-none">
                  <span class="text-sm">${m.is_voice ? '🎤' : '🎵'}</span>
                  <span class="text-[10.5px] font-semibold tracking-wide font-sans">${m.is_voice ? 'Nota de voz' : 'Audio'}</span>
                </div>
                <audio controls preload="metadata" class="w-full h-8 rounded" style="outline:none;">
                  <source src="${m.media_url}" type="${m.media_type || 'audio/ogg'}">
                  Tu navegador no soporta reproducción de audio.
                </audio>
              </div>
            `;
          }

          if (isAudio && !m.media_url) {
            return `
              <div class="flex items-center gap-2 py-1 text-neutral-600 italic text-[11px]">
                <span>${m.is_voice ? '🎤' : '🎵'}</span>
                <span>${formatWhatsAppText(m.body || (m.is_voice ? '[Nota de voz]' : '[Archivo de audio]'))}</span>
              </div>
            `;
          }

          return `<div style="color:#1f1f23;font-size:12px;line-height:1.45;font-family:var(--font-sans);white-space:pre-wrap;word-break:break-word;">${formatWhatsAppText(m.body || '')}</div>`;
        };

        let bubbleHtml = '';
        if (isOut) {
          bubbleHtml = `
            <div class="flex flex-col items-end w-full animate-fade-in">
              <div class="wa-bubble-out" style="
                background:#e8f7ed;
                border:1px solid #d3ebd9;
                border-radius:14px 14px 4px 14px;
                padding:6px 10px 5px 10px;
                width:fit-content;
                max-width:78%;
                min-width:80px;
                box-shadow:0 1px 1.5px rgba(0,0,0,0.05);
                word-break:break-word;
              ">
                <div style="display:flex;flex-direction:column;gap:2.5px;">
                  ${renderMessageContent(msg)}
                  <div style="display:flex;align-items:center;justify-content:flex-end;gap:3px;font-size:8.5px;color:#71717a;font-family:var(--font-mono);line-height:1;user-select:none;">
                    <span>${timeStr}</span>
                    ${statusTick(msg)}
                  </div>
                </div>
              </div>
              ${metaLine}
              ${errorLine}
            </div>
          `;
        } else {
          bubbleHtml = `
            <div class="flex flex-col items-start w-full animate-fade-in">
              <div class="wa-bubble-in" style="
                background:#ffffff;
                border:1px solid #e4e4e7;
                border-radius:14px 14px 14px 4px;
                padding:6px 10px 5px 10px;
                width:fit-content;
                max-width:78%;
                min-width:80px;
                box-shadow:0 1px 1.5px rgba(0,0,0,0.04);
                word-break:break-word;
              ">
                <div style="display:flex;flex-direction:column;gap:2.5px;">
                  ${renderMessageContent(msg)}
                  <div style="display:flex;align-items:center;justify-content:flex-end;font-size:8.5px;color:#71717a;font-family:var(--font-mono);line-height:1;user-select:none;">
                    <span>${timeStr}</span>
                  </div>
                </div>
              </div>
              ${metaLine}
            </div>
          `;
        }

        return `${dateHeaderHtml}${bubbleHtml}`;
      }).join('');

      return `
        <div id="wa-messages-list" style="display:flex;flex-direction:column;gap:8px;padding:0 2px 0 0;overflow-y:auto;max-height:300px;scrollbar-width:thin;scrollbar-color:#d4d4d8 transparent;">${bubbles}</div>
        <style>#wa-messages-list::-webkit-scrollbar{width:5px}#wa-messages-list::-webkit-scrollbar-track{background:transparent}#wa-messages-list::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:4px}#wa-messages-list::-webkit-scrollbar-thumb:hover{background:#a1a1aa}</style>
      `;
    };

    // Form options
    const numberOptions = activeNumbers.map((n, idx) => `
      <option value="${n.phone_number_id || n.id}" ${idx === 0 ? 'selected' : ''}>${n.verified_name || 'CRM'} (${n.display_phone_number}) ${n.is_eligible_agent || n.agent_status === 'ACTIVE' ? '🤖' : ''}</option>
    `).join('');

    const templateOptions = `<option value="">-- Seleccionar Plantilla --</option>` + templates.map(t => `
      <option value="${t.name}" data-lang="${t.language}">${t.name} (${t.language})</option>
    `).join('');

    const contactOptions = sortedContacts.map((c, idx) => {
      const isPrimary = c.id === primaryContactId || (!primaryContactId && idx === 0);
      const primaryBadge = c.id === primaryContactId ? ' ⭐ (Principal)' : '';
      return `
        <option value="${c.id}" data-phone="${c.phone || ''}" ${isPrimary ? 'selected' : ''}>
          ${c.first_name} ${c.last_name}${primaryBadge} (${c.phone || 'Sin Teléfono'})
        </option>
      `;
    }).join('');

    async function notifyMetaAgentStageChange(newStageId, stagesList) {
      try {
        const stageObj = (stagesList || []).find(s => s.id === newStageId);
        const stageName = stageObj?.name || 'Nueva Etapa';
        const primaryContact = linkedContacts.find(c => c.phone) || linkedContacts[0];
        if (!primaryContact?.phone) return;

        const activeNum = (activeNumbers || []).find(n => n.agent_status === 'ACTIVE' || n.is_eligible_agent);
        if (!activeNum) return;

        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;

        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-event`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone_number_id: activeNum.phone_number_id || activeNum.id,
            recipient_phone: primaryContact.phone,
            event_type: 'stage_changed',
            description: `Cambio de etapa en CRM a ${stageName}`,
            payload: { lead_id: lead.id, stage_id: newStageId, stage_name: stageName }
          })
        });
        console.log(`Agent event stage_changed dispatched to Meta for lead ${lead.id}`);
      } catch (e) {
        console.error('Error dispatching agent event to Meta:', e);
      }
    }

    parent.innerHTML = `
      <div class="flex flex-col gap-4 font-sans text-xs w-full">
        
        <!-- Row 1: Historial de Conversaciones (Collapsible Row) -->
        <div class="border border-neutral-200 rounded-lg bg-white overflow-hidden shadow-xs">
          <!-- Row 1 Header -->
          <div id="wa-row-history-header" class="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200 cursor-pointer select-none">
            <div class="flex items-center gap-2">
              <span class="text-sm">💬</span>
              <h3 class="font-mono text-[11px] font-bold text-primary tracking-widest uppercase">Historial de Conversaciones</h3>
              <span id="wa-history-count" class="text-[9px] font-mono font-bold bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full">${whatsappMessages.length}</span>
            </div>
            <div class="flex items-center gap-2" onclick="event.stopPropagation()">
              <button id="btn-release-thread-control" type="button" class="px-3 py-1 text-[9.5px] border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-mono font-bold uppercase rounded-full transition-all tracking-wider focus:outline-none cursor-pointer flex items-center gap-1 shadow-2xs">
                🤖 Devolver a IA
              </button>
              <button id="wa-refresh-btn" type="button" class="px-2.5 py-1 text-[9.5px] border border-[#d9d9dd] hover:border-primary text-neutral-600 hover:text-primary font-mono font-bold uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none cursor-pointer flex items-center gap-1 shadow-2xs">
                <svg id="wa-refresh-icon" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>Actualizar</span>
              </button>
              <span id="wa-history-toggle-icon" class="text-neutral-400 hover:text-primary font-mono font-bold text-xs ml-1 transition-transform duration-200">▼</span>
            </div>
          </div>

          <!-- Row 1 Body -->
          <div id="wa-row-history-body" class="p-4 flex flex-col gap-3">
            <!-- Filters Bar (Contacto & Línea Remitente) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-2.5 border border-neutral-200 rounded-md">
              <div class="flex flex-col gap-1">
                <label for="wa-filter-recipient" class="font-mono font-bold text-neutral-500 uppercase tracking-wider text-[8.5px]">Contacto Destinatario</label>
                <select id="wa-filter-recipient" class="cohere-input text-xs py-1 px-2 w-full cursor-pointer bg-white">
                  ${filterContactOptions}
                </select>
              </div>
              <div class="flex flex-col gap-1">
                <label for="wa-filter-sender" class="font-mono font-bold text-neutral-500 uppercase tracking-wider text-[8.5px]">Línea de WhatsApp Remitente</label>
                <select id="wa-filter-sender" class="cohere-input text-xs py-1 px-2 w-full cursor-pointer bg-white">
                  ${filterSenderOptions}
                </select>
              </div>
            </div>
            
            <!-- Chat Container with Fixed Bottom Footer Bar -->
            <div id="wa-chat-container" class="flex flex-col border border-neutral-200 rounded-lg overflow-hidden bg-neutral-100 shadow-2xs">
              <!-- Messages Scrollable Area -->
              <div id="wa-chat-wrapper" class="flex-1 p-3 overflow-y-auto" style="min-height:220px;max-height:350px;background:#f0f2f5;">
                ${generateChatHtml(whatsappMessages)}
              </div>

              <!-- Fixed Bottom Chat Footer Bar (Thread Status & Direct Chat Input) -->
              <div id="wa-thread-status-bar" class="p-3 bg-white border-t border-neutral-200 flex flex-col gap-2.5 shrink-0">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div id="wa-owner-badge-container" class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                      <span class="w-2 h-2 rounded-full bg-neutral-400"></span>
                      <span>Cargando estado del hilo...</span>
                    </span>
                  </div>
                  <div id="wa-window-badge-container" class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                      <span>Verificando Ventana 24h...</span>
                    </span>
                  </div>
                </div>

                <!-- Quick Direct Message Input (Service Messages API) -->
                <div id="wa-service-chat-form" class="flex flex-col gap-2 pt-1">
                  <div class="flex items-center justify-between">
                    <label for="wa-quick-message-input" class="font-mono text-[9px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1">
                      <span>💬 Mensaje Directo (Servicio 24h)</span>
                    </label>
                    <span id="wa-service-window-timer" class="text-[9px] font-mono text-neutral-500 font-medium"></span>
                  </div>
                  <div class="flex gap-2">
                    <input type="text" id="wa-quick-message-input" class="cohere-input text-xs flex-1 px-3 py-2 bg-neutral-50 focus:bg-white" placeholder="Escribe un mensaje directo para responder al cliente..." />
                    <button id="wa-send-quick-btn" type="button" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold uppercase rounded-md tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0">
                      <span>Enviar</span>
                      <span>➔</span>
                    </button>
                  </div>
                  <div id="wa-service-window-notice" class="text-[9.5px] text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-md hidden leading-relaxed">
                    🔒 <strong>Ventana de Atención de 24h Cerrada:</strong> Por políticas de Meta WhatsApp, el período de atención al cliente ha finalizado. Para comunicarte debes seleccionar una <strong>Plantilla Aprobada</strong> en la sección inferior.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Row 2: Enviar Plantilla / Mensaje (Collapsible Row) -->
        <div class="border border-neutral-200 rounded-lg bg-white overflow-hidden shadow-xs">
          <!-- Row 2 Header -->
          <div id="wa-row-send-header" class="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200 cursor-pointer select-none">
            <div class="flex items-center gap-2">
              <span class="text-sm">✉️</span>
              <h3 class="font-mono text-[11px] font-bold text-primary tracking-widest uppercase">Enviar Plantilla de WhatsApp</h3>
            </div>
            <span id="wa-send-toggle-icon" class="text-neutral-400 hover:text-primary font-mono font-bold text-xs transition-transform duration-200">▼</span>
          </div>

          <!-- Row 2 Body -->
          <div id="wa-row-send-body" class="p-4 flex flex-col gap-3">
            <form id="wa-send-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-3">
                <!-- Contact Selector -->
                <div class="flex flex-col gap-1">
                  <label for="wa-contact" class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Destinatario</label>
                  <select id="wa-contact" name="contact_id" class="cohere-input text-xs w-full cursor-pointer">
                    ${contactOptions}
                  </select>
                </div>

                <!-- Recipient Phone -->
                <div class="flex flex-col gap-1">
                  <label for="wa-phone" class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Teléfono</label>
                  <input type="text" id="wa-phone" name="to_phone" required class="cohere-input text-xs w-full" placeholder="549XXXXXXXXXX" />
                  <span class="text-[9px] text-neutral-400">Incluir código de país: 549 (ARG celular), 34 (España).</span>
                </div>

                <!-- Sender Number -->
                <div class="flex flex-col gap-1">
                  <label for="wa-sender" class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Número remitente</label>
                  <select id="wa-sender" name="phone_number_id" required class="cohere-input text-xs w-full cursor-pointer">
                    ${numberOptions}
                  </select>
                </div>
              </div>

              <div class="flex flex-col gap-3">
                <!-- Template Selector -->
                <div class="flex flex-col gap-1">
                  <label for="wa-template" class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Plantilla de Meta</label>
                  <select id="wa-template" name="template_name" required class="cohere-input text-xs w-full cursor-pointer">
                    ${templateOptions}
                  </select>
                </div>

                <!-- Dynamic Variables Fields -->
                <div id="wa-variables-container" class="flex flex-col gap-2 hidden">
                  <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Variables</span>
                  <div id="wa-variables-fields" class="flex flex-col gap-1.5"></div>
                </div>

                <!-- Live Preview -->
                <div id="wa-preview-container" class="flex flex-col gap-1.5 hidden">
                  <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Vista previa</span>
                  <div style="background:#f0f2f5;border-radius:8px;padding:12px 10px;border:1px solid #e5e7eb;">
                    <div style="
                      background:#d9fdd3;
                      border-radius:2px 12px 12px 12px;
                      padding:8px 12px 6px 12px;
                      max-width:90%;
                      box-shadow:0 1px 2px rgba(0,0,0,0.08);
                      font-size:12px;line-height:1.5;
                    ">
                      <p id="wa-preview-text" style="color:#1a1a1a;margin:0;white-space:pre-wrap;"></p>
                      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
                        <span style="font-size:10px;color:#9ca3af;font-family:monospace;">12:00 ✓</span>
                      </div>
                    </div>
                    <div id="wa-preview-buttons" class="mt-2 flex flex-col gap-1.5 hidden max-w-[90%]"></div>
                  </div>
                </div>

                <!-- Scheduling Toggle -->
                <div class="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="wa-schedule-toggle" name="schedule_active" class="cursor-pointer" />
                  <label for="wa-schedule-toggle" class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider cursor-pointer select-none">Programar para más tarde</label>
                </div>

                <!-- Scheduler Datetime Picker -->
                <div id="wa-scheduler-container" class="flex flex-col gap-1 hidden">
                  <label for="wa-scheduled-time" class="font-mono text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Fecha y hora</label>
                  <input type="datetime-local" id="wa-scheduled-time" name="scheduled_for" class="cohere-input text-xs w-full" />
                </div>

                <!-- Submit Button -->
                <div class="mt-1">
                  <button type="submit" id="wa-submit-btn" class="w-full px-5 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-lg tracking-wider transition-colors duration-150 focus:outline-none cursor-pointer">
                    Enviar WhatsApp
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

      </div>
    `;

    // References to DOM elements
    const form = parent.querySelector('#wa-send-form');
    const contactSelect = parent.querySelector('#wa-contact');
    const phoneInput = parent.querySelector('#wa-phone');
    const templateSelect = parent.querySelector('#wa-template');
    const variablesContainer = parent.querySelector('#wa-variables-container');
    const variablesFields = parent.querySelector('#wa-variables-fields');
    const previewContainer = parent.querySelector('#wa-preview-container');
    const previewText = parent.querySelector('#wa-preview-text');
    const scheduleToggle = parent.querySelector('#wa-schedule-toggle');
    const schedulerContainer = parent.querySelector('#wa-scheduler-container');
    const scheduledTimeInput = parent.querySelector('#wa-scheduled-time');
    const submitBtn = parent.querySelector('#wa-submit-btn');
    const refreshBtn = parent.querySelector('#wa-refresh-btn');
    const refreshIcon = parent.querySelector('#wa-refresh-icon');
    const filterRecipientSelect = parent.querySelector('#wa-filter-recipient');
    const filterSenderSelect = parent.querySelector('#wa-filter-sender');
    const chatWrapper = parent.querySelector('#wa-chat-wrapper');

    // Accordion toggle logic
    const historyHeader = parent.querySelector('#wa-row-history-header');
    const historyBody = parent.querySelector('#wa-row-history-body');
    const historyToggleIcon = parent.querySelector('#wa-history-toggle-icon');

    const sendHeader = parent.querySelector('#wa-row-send-header');
    const sendBody = parent.querySelector('#wa-row-send-body');
    const sendToggleIcon = parent.querySelector('#wa-send-toggle-icon');

    if (historyHeader && historyBody) {
      historyHeader.addEventListener('click', () => {
        const isHidden = historyBody.classList.toggle('hidden');
        if (historyToggleIcon) {
          historyToggleIcon.textContent = isHidden ? '►' : '▼';
        }
      });
    }

    if (sendHeader && sendBody) {
      sendHeader.addEventListener('click', () => {
        const isHidden = sendBody.classList.toggle('hidden');
        if (sendToggleIcon) {
          sendToggleIcon.textContent = isHidden ? '►' : '▼';
        }
      });
    }

    // Function to apply filters and re-render messages list
    const applyFiltersAndRender = () => {
      const selectedContactId = filterRecipientSelect.value;
      const selectedSenderId = filterSenderSelect.value;

      const selectedContact = linkedContacts.find(c => c.id === selectedContactId);
      const cleanContactPhone = selectedContact?.phone ? selectedContact.phone.replace(/[^0-9]/g, '') : '';

      const filtered = whatsappMessages.filter(msg => {
        // Filter by recipient (contact)
        if (selectedContactId) {
          const isDirectContactMatch = msg.contact_id === selectedContactId;
          const cleanRecipientPhone = (msg.recipient_phone || '').replace(/[^0-9]/g, '');
          const isPhoneMatch = cleanContactPhone && cleanRecipientPhone && (
            cleanRecipientPhone.endsWith(cleanContactPhone.slice(-8)) ||
            cleanContactPhone.endsWith(cleanRecipientPhone.slice(-8))
          );
          if (!isDirectContactMatch && !isPhoneMatch) return false;
        }

        // Filter by sender (line)
        if (selectedSenderId) {
          if (msg.phone_number_id !== selectedSenderId) return false;
        }

        return true;
      });

      chatWrapper.innerHTML = generateChatHtml(filtered);

      // Auto scroll to bottom
      const listElem = chatWrapper.querySelector('#wa-messages-list');
      if (listElem) {
        listElem.scrollTop = listElem.scrollHeight;
      }
    };

    // Filter event listeners
    filterRecipientSelect.addEventListener('change', () => {
      applyFiltersAndRender();
      refreshThreadStatus();
      if (contactSelect && filterRecipientSelect.value) {
        contactSelect.value = filterRecipientSelect.value;
        handleContactChange();
      }
    });
    filterSenderSelect.addEventListener('change', () => {
      applyFiltersAndRender();
      refreshThreadStatus();
    });

    // Thread Status & 24h Customer Service Window Logic
    const ownerBadgeContainer = parent.querySelector('#wa-owner-badge-container');
    const windowBadgeContainer = parent.querySelector('#wa-window-badge-container');
    const quickMsgInput = parent.querySelector('#wa-quick-message-input');
    const sendQuickBtn = parent.querySelector('#wa-send-quick-btn');
    const serviceWindowTimer = parent.querySelector('#wa-service-window-timer');
    const serviceWindowNotice = parent.querySelector('#wa-service-window-notice');

    async function refreshThreadStatus() {
      const selectedPhoneId = filterSenderSelect.value || (activeNumbers[0]?.phone_number_id || activeNumbers[0]?.id);
      const selectedContactOption = filterRecipientSelect.options[filterRecipientSelect.selectedIndex];
      const recipientPhone = selectedContactOption?.dataset?.phone || (linkedContacts.find(c => c.phone)?.phone) || '';

      if (!selectedPhoneId) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;

        const encodedPhone = encodeURIComponent(recipientPhone);
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/thread-status?phone_number_id=${selectedPhoneId}&recipient_phone=${encodedPhone}&lead_id=${lead.id}`, {
          headers: { 'Authorization': `Bearer ${jwt}` }
        });

        if (res.ok) {
          const statusData = await res.json();

          const releaseBtn = parent.querySelector('#btn-release-thread-control');

          // Render Owner Badge & Toggle Release to AI Button
          if (statusData.owner === 'agent') {
            ownerBadgeContainer.innerHTML = `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>🤖 Control: Agente de IA Meta</span>
              </span>
            `;
            if (releaseBtn) {
              releaseBtn.disabled = true;
              releaseBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
              releaseBtn.title = 'El Agente de IA Meta ya tiene el control de esta conversación.';
            }
          } else {
            ownerBadgeContainer.innerHTML = `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>👤 Control: Operador Humano</span>
              </span>
            `;
            if (releaseBtn) {
              releaseBtn.disabled = false;
              releaseBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
              releaseBtn.title = 'Devolver el control de esta conversación al Agente de IA Meta';
            }
          }

          // Render 24h Window Badge & Form Logic
          if (statusData.is_window_open) {
            windowBadgeContainer.innerHTML = `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>🟢 Ventana 24h Abierta</span>
              </span>
            `;
            quickMsgInput.disabled = false;
            sendQuickBtn.disabled = false;
            serviceWindowNotice.classList.add('hidden');

            const remSec = statusData.remaining_seconds || 0;
            const hoursLeft = Math.floor(remSec / 3600);
            const minsLeft = Math.floor((remSec % 3600) / 60);
            serviceWindowTimer.textContent = `Expira en: ${hoursLeft}h ${minsLeft}m`;
          } else {
            windowBadgeContainer.innerHTML = `
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-neutral-100 text-neutral-600 border border-neutral-300">
                <span class="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                <span>🔒 Ventana 24h Cerrada</span>
              </span>
            `;
            quickMsgInput.disabled = true;
            sendQuickBtn.disabled = true;
            serviceWindowNotice.classList.remove('hidden');
            serviceWindowTimer.textContent = '';
            
            // Expand send template section if window is closed
            if (sendBody && sendBody.classList.contains('hidden')) {
              sendBody.classList.remove('hidden');
              if (sendToggleIcon) sendToggleIcon.textContent = '▼';
            }
          }
        }
      } catch (err) {
        console.error('Error fetching thread status:', err);
      }
    }

    // Direct Service Message Handler (Free-form text chat within 24h window)
    async function sendDirectServiceMessage() {
      const msgText = quickMsgInput.value.trim();
      if (!msgText) return;

      const selectedPhoneId = filterSenderSelect.value || (activeNumbers[0]?.phone_number_id || activeNumbers[0]?.id);
      const selectedContactOption = filterRecipientSelect.options[filterRecipientSelect.selectedIndex];
      const selectedContactId = filterRecipientSelect.value;
      const recipientPhone = selectedContactOption?.dataset?.phone || '';

      if (!selectedPhoneId || !recipientPhone) {
        toast.show('Por favor selecciona un contacto con teléfono de destino válido.', 'error');
        return;
      }

      sendQuickBtn.disabled = true;
      sendQuickBtn.innerHTML = '<span>Enviando...</span>';

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/send-message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            lead_id: lead.id,
            contact_id: selectedContactId,
            phone_number_id: selectedPhoneId,
            to: recipientPhone,
            message_text: msgText
          })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          quickMsgInput.value = '';
          toast.show('Mensaje enviado exitosamente', 'success');
          await loadAllData();
          await renderWhatsAppTab(parent);
        } else {
          toast.show('Error al enviar mensaje: ' + (data.message || data.error?.message || data.error || 'Fallo de envío'), 'error');
        }
      } catch (err) {
        toast.show('Error de red: ' + err.message, 'error');
      } finally {
        sendQuickBtn.disabled = false;
        sendQuickBtn.innerHTML = '<span>Enviar</span> <span>➔</span>';
      }
    }

    if (sendQuickBtn && quickMsgInput) {
      sendQuickBtn.addEventListener('click', sendDirectServiceMessage);
      quickMsgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendDirectServiceMessage();
        }
      });
    }

    // Initial filter apply, status check & auto-scroll
    applyFiltersAndRender();
    refreshThreadStatus();

    // Thread Control (Release to AI Agent) button action
    const releaseBtn = parent.querySelector('#btn-release-thread-control');

    if (releaseBtn) {
      releaseBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const selectedPhoneId = filterSenderSelect.value;
        const numObj = activeNumbers.find(n => String(n.phone_number_id || n.id) === String(selectedPhoneId));

        const hasAgent = numObj && (numObj.is_eligible_agent === true || numObj.agent_status === 'ACTIVE' || numObj.agent_status === 'ELIGIBLE');

        if (!hasAgent) {
          const lineName = numObj ? `${numObj.verified_name || 'Línea'} (${numObj.display_phone_number})` : 'La línea seleccionada';
          toast.show(`${lineName} no tiene un Agente de IA activo en Meta.`, 'warning');
          return;
        }

        const selectedContactOption = filterRecipientSelect.options[filterRecipientSelect.selectedIndex];
        const recipientPhone = selectedContactOption?.dataset?.phone || (linkedContacts.find(c => c.phone)?.phone);

        if (!recipientPhone) {
          toast.show('No hay un número de teléfono de destino para esta devolución.', 'error');
          return;
        }

        releaseBtn.disabled = true;
        releaseBtn.innerHTML = '🤖 Devolviendo...';

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const jwt = session?.access_token;

          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/thread-control`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phone_number_id: selectedPhoneId,
              recipient_phone: recipientPhone,
              action: 'release'
            })
          });

          if (res.ok) {
            toast.show('Control de conversación devuelto exitosamente al Agente de IA Meta', 'success');
            await loadAllData();
            await renderWhatsAppTab(parent);
          } else {
            const err = await res.json().catch(() => ({}));
            toast.show('Error al devolver conversación: ' + (err.detail || err.error || 'Status ' + res.status), 'error');
            releaseBtn.disabled = false;
            releaseBtn.innerHTML = '🤖 Devolver a IA';
          }
        } catch (e) {
          toast.show('Error de red: ' + e.message, 'error');
          releaseBtn.disabled = false;
          releaseBtn.innerHTML = '🤖 Devolver a IA';
        }
      });
    }

    // Refresh history handler
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        refreshIcon.classList.add('animate-spin', 'text-primary');
        refreshBtn.disabled = true;
        try {
          await loadAllData();
          await renderWhatsAppTab(parent);
          toast.show('Historial de WhatsApp actualizado', 'success');
        } catch (err) {
          console.error('Error refreshing WhatsApp history:', err);
          toast.show('Error al actualizar historial', 'error');
        } finally {
          refreshIcon.classList.remove('animate-spin', 'text-primary');
          refreshBtn.disabled = false;
        }
      });
    }

    // Prefill phone on contact selection & auto-sync filter
    function handleContactChange() {
      const selectedOption = contactSelect.options[contactSelect.selectedIndex];
      if (selectedOption) {
        const phone = selectedOption.dataset.phone || '';
        phoneInput.value = phone.replace(/[^0-9+]/g, '');
        
        // Auto-sync recipient filter if contact matches an option
        if (filterRecipientSelect && contactSelect.value) {
          filterRecipientSelect.value = contactSelect.value;
          applyFiltersAndRender();
        }
      }
    }
    contactSelect.addEventListener('change', handleContactChange);
    handleContactChange(); // Run once initially

    // Toggle scheduler display
    scheduleToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        schedulerContainer.classList.remove('hidden');
        scheduledTimeInput.required = true;
        const localNow = new Date();
        localNow.setHours(localNow.getHours() + 1);
        const yyyy = localNow.getFullYear();
        const mm = String(localNow.getMonth() + 1).padStart(2, '0');
        const dd = String(localNow.getDate()).padStart(2, '0');
        const hh = String(localNow.getHours()).padStart(2, '0');
        const min = String(localNow.getMinutes()).padStart(2, '0');
        scheduledTimeInput.value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      } else {
        schedulerContainer.classList.add('hidden');
        scheduledTimeInput.required = false;
        scheduledTimeInput.value = '';
      }
    });

    // Handle template changes: parse variables for HEADER & BODY components and show preview
    let currentTemplate = null;
    templateSelect.addEventListener('change', () => {
      const templateName = templateSelect.value;
      variablesFields.innerHTML = '';

      if (!templateName) {
        variablesContainer.classList.add('hidden');
        previewContainer.classList.add('hidden');
        currentTemplate = null;
        return;
      }

      currentTemplate = templates.find(t => t.name === templateName);
      if (!currentTemplate) return;

      let varIndex = 1;
      let totalVars = 0;

      (currentTemplate.components || []).forEach(comp => {
        if (comp.type === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(comp.format)) {
          totalVars++;
          const mediaLabel = comp.format === 'IMAGE' ? 'Imagen' : comp.format === 'VIDEO' ? 'Video' : 'Documento';
          const mediaAccept = comp.format === 'IMAGE' ? 'image/*' : comp.format === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx,.xlsx';

          const fieldWrapper = document.createElement('div');
          fieldWrapper.className = 'flex flex-col gap-2 p-3 bg-neutral-50 rounded-lg border border-neutral-200';
          fieldWrapper.innerHTML = `
            <label class="text-[10px] font-mono text-neutral-700 font-bold uppercase flex items-center gap-1.5">
              <span>🖼️</span> <span>${mediaLabel} de Encabezado (Requerida)</span>
            </label>
            <div class="flex flex-col gap-2">
              <div>
                <span class="text-[9px] text-neutral-500 font-medium block mb-1">Cargar desde tu PC:</span>
                <input type="file" id="wa-header-file" accept="${mediaAccept}" class="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer w-full" />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] text-neutral-400 uppercase font-bold">o URL directa:</span>
                <input type="url" id="wa-header-url" placeholder="https://..." class="cohere-input text-xs flex-1 py-1" />
              </div>
            </div>
            <div id="wa-header-media-preview" class="hidden mt-1">
              <img src="" alt="Vista previa" class="max-h-28 rounded border border-neutral-200 object-cover" />
            </div>
          `;
          variablesFields.appendChild(fieldWrapper);

          const fileInput = fieldWrapper.querySelector('#wa-header-file');
          const urlInput = fieldWrapper.querySelector('#wa-header-url');
          const imgPreview = fieldWrapper.querySelector('#wa-header-media-preview img');
          const previewContainer = fieldWrapper.querySelector('#wa-header-media-preview');

          fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
              const file = fileInput.files[0];
              urlInput.value = '';
              if (file.type.startsWith('image/')) {
                imgPreview.src = URL.createObjectURL(file);
                previewContainer.classList.remove('hidden');
              } else {
                previewContainer.classList.add('hidden');
              }
            }
          });

          urlInput.addEventListener('input', () => {
            const url = urlInput.value.trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
              fileInput.value = '';
              if (comp.format === 'IMAGE') {
                imgPreview.src = url;
                previewContainer.classList.remove('hidden');
              }
            } else {
              previewContainer.classList.add('hidden');
            }
          });
        } else if ((comp.type === 'HEADER' && comp.format === 'TEXT') || comp.type === 'BODY') {
          const compText = comp.text || '';
          const matches = [...compText.matchAll(/\{\{(\d+)\}\}/g)];
          if (matches.length > 0) {
            const compLabel = comp.type === 'HEADER' ? 'Encabezado' : 'Cuerpo';
            matches.forEach(m => {
              const num = m[1];
              totalVars++;
              const fieldWrapper = document.createElement('div');
              fieldWrapper.className = 'flex flex-col gap-1';
              fieldWrapper.innerHTML = `
                <label for="wa-var-${comp.type.toLowerCase()}-${num}" class="text-[9px] font-mono text-neutral-500 font-bold uppercase">
                  Variable {{${num}}} (${compLabel})
                </label>
                <input type="text" id="wa-var-${comp.type.toLowerCase()}-${num}" data-comp="${comp.type.toLowerCase()}" data-var="${num}" required class="cohere-input text-xs w-full py-1.5" placeholder="Ingrese valor para {{${num}}}" />
              `;
              variablesFields.appendChild(fieldWrapper);
              fieldWrapper.querySelector('input').addEventListener('input', updateLivePreview);
            });
          }
        }
      });

      if (totalVars > 0) {
        variablesContainer.classList.remove('hidden');
      } else {
        variablesContainer.classList.add('hidden');
      }

      previewContainer.classList.remove('hidden');
      updateLivePreview();
    });

    function updateLivePreview() {
      if (!currentTemplate) return;

      const headerComponent = (currentTemplate.components || []).find(c => c.type === 'HEADER' && c.format === 'TEXT');
      const bodyComponent = (currentTemplate.components || []).find(c => c.type === 'BODY');
      const footerComponent = (currentTemplate.components || []).find(c => c.type === 'FOOTER');
      const buttonsComponent = (currentTemplate.components || []).find(c => c.type === 'BUTTONS');

      let headerText = headerComponent ? headerComponent.text : '';
      let bodyText = bodyComponent ? bodyComponent.text : '';
      let footerText = footerComponent ? footerComponent.text : '';

      const varInputs = variablesFields.querySelectorAll('input[data-comp]');
      varInputs.forEach((input) => {
        const compType = input.dataset.comp;
        const num = input.dataset.var;
        const val = input.value.trim() || `{{${num}}}`;
        
        if (compType === 'header' && headerText) {
          headerText = headerText.replaceAll(`{{${num}}}`, val);
        } else if (compType === 'body' && bodyText) {
          bodyText = bodyText.replaceAll(`{{${num}}}`, val);
        }
      });

      let fullPreview = '';
      if (headerText) fullPreview += `*${headerText}*\n\n`;
      fullPreview += bodyText;
      if (footerText) fullPreview += `\n\n_${footerText}_`;

      previewText.innerText = fullPreview;

      // Render template interactive buttons preview
      const previewButtonsContainer = parent.querySelector('#wa-preview-buttons');
      if (previewButtonsContainer) {
        if (buttonsComponent && Array.isArray(buttonsComponent.buttons) && buttonsComponent.buttons.length > 0) {
          previewButtonsContainer.innerHTML = buttonsComponent.buttons.map(btn => {
            let icon = '💬';
            let extraBadge = '';
            if (btn.type === 'FLOW') {
              icon = '📋';
              extraBadge = ' <span class="text-[8px] font-mono bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded">Flow</span>';
            } else if (btn.type === 'URL') {
              icon = '🔗';
            } else if (btn.type === 'PHONE_NUMBER') {
              icon = '📞';
            }

            return `
              <div style="background:#ffffff;border-radius:6px;padding:6px 10px;border:1px solid #dcdfe4;box-shadow:0 1px 1px rgba(0,0,0,0.04);" class="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#00a884] select-none">
                <span>${icon}</span>
                <span>${btn.text || 'Botón'}</span>
                ${extraBadge}
              </div>
            `;
          }).join('');
          previewButtonsContainer.classList.remove('hidden');
        } else {
          previewButtonsContainer.innerHTML = '';
          previewButtonsContainer.classList.add('hidden');
        }
      }
    }

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const rawPhone = phoneInput.value.trim();
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

      if (cleanPhone.length < 8) {
        toast.show('Número de teléfono inválido. Debe tener al menos 8 dígitos.', 'error');
        return;
      }

      if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549')) {
        toast.show('Advertencia: Los celulares de Argentina suelen requerir "549" en WhatsApp.', 'info');
      }

      // Handle media header if template has IMAGE, VIDEO, or DOCUMENT format
      const headerMediaComp = currentTemplate && (currentTemplate.components || []).find(c => c.type === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(c.format));
      let headerMediaUrl = null;

      submitBtn.disabled = true;
      const originalBtnText = submitBtn.textContent;

      if (headerMediaComp) {
        const fileInput = variablesFields.querySelector('#wa-header-file');
        const urlInput = variablesFields.querySelector('#wa-header-url');
        const rawUrl = urlInput ? urlInput.value.trim() : '';

        if (fileInput && fileInput.files && fileInput.files[0]) {
          submitBtn.textContent = 'Subiendo imagen/archivo...';
          const file = fileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const filePath = `headers/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

          const { error: uploadErr } = await supabase.storage.from('whatsapp-media').upload(filePath, file);
          if (uploadErr) {
            toast.show(`Error al subir archivo de encabezado: ${uploadErr.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
          }

          const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
          headerMediaUrl = publicUrlData?.publicUrl || null;
        } else if (rawUrl) {
          headerMediaUrl = rawUrl;
        }

        if (!headerMediaUrl) {
          toast.show(`Por favor selecciona o ingresa una ${headerMediaComp.format === 'IMAGE' ? 'imagen' : 'archivo'} para el encabezado de la plantilla.`, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
          return;
        }
      }

      // Validate non-empty variables and build components payload
      const varInputs = variablesFields.querySelectorAll('input[data-comp]');
      let hasEmptyVar = false;
      const variablesArray = [];

      const headerParams = [];
      const bodyParams = [];

      varInputs.forEach((input) => {
        const val = input.value.trim();
        const compType = input.dataset.comp;
        
        if (!val) {
          hasEmptyVar = true;
        }

        variablesArray.push(val);

        if (compType === 'header') {
          headerParams.push({ type: 'text', text: val });
        } else if (compType === 'body') {
          bodyParams.push({ type: 'text', text: val });
        }
      });

      if (hasEmptyVar) {
        toast.show('Por favor completa todos los campos de variables de la plantilla.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }

      const payloadComponents = [];
      if (headerMediaComp && headerMediaUrl) {
        const paramType = headerMediaComp.format.toLowerCase(); // 'image', 'document', 'video'
        payloadComponents.push({
          type: 'header',
          parameters: [
            {
              type: paramType,
              [paramType]: {
                link: headerMediaUrl
              }
            }
          ]
        });
      } else if (headerParams.length > 0) {
        payloadComponents.push({ type: 'header', parameters: headerParams });
      }

      if (bodyParams.length > 0) {
        payloadComponents.push({ type: 'body', parameters: bodyParams });
      }

      // Automatically handle FLOW buttons in templates (e.g. prueba_flow_test1)
      if (currentTemplate && currentTemplate.components) {
        currentTemplate.components.forEach(comp => {
          if (comp.type === 'BUTTONS' && Array.isArray(comp.buttons)) {
            comp.buttons.forEach((btn, idx) => {
              if (btn.type === 'FLOW') {
                payloadComponents.push({
                  type: 'button',
                  sub_type: 'flow',
                  index: String(idx),
                  parameters: [
                    {
                      type: 'action',
                      action: {
                        flow_token: 'unused'
                      }
                    }
                  ]
                });
              }
            });
          }
        });
      }

      const bodyText = previewText.innerText;
      const selectedOption = templateSelect.options[templateSelect.selectedIndex];
      const templateLanguage = selectedOption.dataset.lang || 'es_AR';

      const phone_number_id = form.querySelector('[name="phone_number_id"]').value;
      const template_name = templateSelect.value;
      
      const payload = {
        lead_id: lead.id,
        contact_id: contactSelect.value || null,
        phone_number_id,
        to: cleanPhone,
        template_name,
        template_language: templateLanguage,
        components: payloadComponents,
        body_text: bodyText,
        variables: variablesArray
      };

      if (scheduleToggle.checked) {
        const scheduledTime = scheduledTimeInput.value;
        if (!scheduledTime) {
          toast.show('Debe ingresar la fecha y hora de programación', 'error');
          return;
        }

        const localDate = new Date(scheduledTime);
        if (localDate <= new Date()) {
          toast.show('La fecha de programación debe ser a futuro', 'error');
          return;
        }
        payload.scheduled_for = localDate.toISOString();
      }

      submitBtn.textContent = 'Enviando...';

      try {
        const session = await auth.getSession();
        const jwt = session?.access_token;

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/send-template`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
          const actionText = payload.scheduled_for ? 'programado' : 'enviado';
          toast.show(`Mensaje de WhatsApp ${actionText} con éxito`, 'success');
          
          await loadAllData();
          await renderWhatsAppTab(parent);
          
          if (typeof refreshHistory === 'function') {
            refreshHistory();
          }
        } else {
          throw new Error(result.error?.message || result.error || 'Fallo en la llamada al proxy');
        }
      } catch (err) {
        console.error('Error sending template message:', err);
        toast.show('Error al enviar WhatsApp: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    });
  }

  async function renderEmailTab(parent) {
    parent.innerHTML = `
      <div class="flex items-center justify-center p-8 text-neutral-400 font-sans text-xs">
        <span class="animate-pulse mr-2">🔄</span> Cargando módulo de email...
      </div>
    `;

    try {
      // 1. Load active email templates
      const { data: templates } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // 2. Load previous sent emails for this lead
      const { data: sentEmails } = await supabase
        .from('email_messages')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      // 3. Load tracking events for these emails
      const emailIds = (sentEmails || []).map(e => e.id);
      let trackingEvents = [];
      if (emailIds.length > 0) {
        const { data: eventsData } = await supabase
          .from('email_events')
          .select('*')
          .in('email_message_id', emailIds);
        trackingEvents = eventsData || [];
      }

      // 4. Resolve commercial senders (profiles with is_mailing_sender === true, or fallback to active profiles)
      const allProfiles = cache.getProfiles() || [];
      let senderProfiles = allProfiles.filter(p => p.is_mailing_sender);
      if (senderProfiles.length === 0) {
        senderProfiles = allProfiles; // Fallback
      }

      // Default selected sender
      const defaultSenderId = lead.assigned_to || currentUser?.id || senderProfiles[0]?.id;

      // Contact email options
      const contactEmails = linkedContacts.map(c => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
        email: c.email
      })).filter(c => c.email);

      // Calculate lead email statistics
      const totalSentLeadMsgs = (sentEmails || []).filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;
      const openEventsLead = trackingEvents.filter(e => e.event_type === 'OPEN_DETECTED');
      const clickEventsLead = trackingEvents.filter(e => e.event_type === 'CLICKED');

      const uniqueLeadOpens = new Set(openEventsLead.map(e => e.email_message_id)).size;
      const uniqueLeadClicks = new Set(clickEventsLead.map(e => e.email_message_id)).size;

      const leadOpenRate = totalSentLeadMsgs > 0 ? ((uniqueLeadOpens / totalSentLeadMsgs) * 100).toFixed(1) : '0.0';
      const leadClickRate = totalSentLeadMsgs > 0 ? ((uniqueLeadClicks / totalSentLeadMsgs) * 100).toFixed(1) : '0.0';

      // Helper to format email body content with clean typography and spacing
      function formatEmailContentForDisplay(bodyHtml, bodyText) {
        if (bodyHtml && typeof bodyHtml === 'string') {
          // 1. Remove tracking pixel <img> tags
          let cleaned = bodyHtml
            .replace(/<img[^>]*email-track-open[^>]*>/gi, '')
            .replace(/<img[^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>/gi, '')
            .replace(/<img[^>]*width=["']1["'][^>]*height=["']1["'][^>]*>/gi, '');

          // 2. Remove hidden preheader container if present
          cleaned = cleaned
            .replace(/<div\s+style=["'][^"']*max-height:\s*0px[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<div\s+style=["'][^"']*display:\s*none[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');

          cleaned = cleaned.trim();

          // 3. If there are no HTML block tags like <p>, <div>, <ul>, <br>, convert linebreaks to paragraphs
          const hasHtmlBlocks = /<(p|div|ul|ol|li|br|table|h[1-6]|blockquote)[^>]*>/i.test(cleaned);
          if (!hasHtmlBlocks) {
            cleaned = cleaned
              .split(/\n{2,}/)
              .map(paragraph => `<p class="mb-2.5">${paragraph.replace(/\n/g, '<br/>')}</p>`)
              .join('');
          }

          return cleaned || '<span class="text-neutral-400 italic">Sin contenido</span>';
        }

        if (bodyText && typeof bodyText === 'string') {
          const escaped = bodyText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          return escaped
            .split(/\n{2,}/)
            .map(paragraph => `<p class="mb-2.5">${paragraph.replace(/\n/g, '<br/>')}</p>`)
            .join('');
        }

        return '<span class="text-neutral-400 italic">Sin contenido</span>';
      }

      parent.innerHTML = `
        <div class="flex flex-col gap-6 font-sans text-xs select-none">
          <!-- Lead Interaction Stats Summary -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 p-3.5 rounded-sm border border-[#d9d9dd]">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm">📧</div>
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-muted-slate">Enviados</div>
                <div class="text-sm font-bold text-slate">${totalSentLeadMsgs} <span class="text-[10px] font-normal text-muted">correos</span></div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">👁️</div>
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-muted-slate">Aperturas Detectadas</div>
                <div class="text-sm font-bold text-emerald-600">${uniqueLeadOpens} <span class="text-[10px] font-normal text-muted">(${leadOpenRate}%)</span></div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-sm">🔗</div>
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-muted-slate">Clics en Enlaces</div>
                <div class="text-sm font-bold text-purple-600">${uniqueLeadClicks} <span class="text-[10px] font-normal text-muted">(${leadClickRate}%)</span></div>
              </div>
            </div>
          </div>

          <!-- Compose Email Box -->
          <div class="bg-white border border-[#d9d9dd] rounded-sm p-5 flex flex-col gap-4 shadow-2xs">
            <h4 class="font-mono text-[10px] font-bold text-primary uppercase tracking-wider border-b border-neutral-100 pb-2">Redactar y Enviar Email</h4>
            
            <form id="lead-send-email-form" class="flex flex-col gap-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Sender Selection -->
                <div class="flex flex-col gap-1">
                  <label for="email-sender" class="font-mono text-[9px] font-bold text-primary uppercase">Remitente Comercial *</label>
                  <select id="email-sender" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm p-2">
                    ${senderProfiles.map(p => `
                      <option value="${p.id}" data-email="${p.mailing_email || p.email}" ${p.id === defaultSenderId ? 'selected' : ''}>
                        👔 ${p.full_name || p.email} (${p.mailing_email || p.email})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <!-- Recipient Selection -->
                <div class="flex flex-col gap-1">
                  <label for="email-recipient" class="font-mono text-[9px] font-bold text-primary uppercase">Destinatario *</label>
                  ${contactEmails.length > 0 ? `
                    <select id="email-recipient" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm p-2">
                      ${contactEmails.map(c => `
                        <option value="${c.email}" data-contact-id="${c.id}">
                          👤 ${c.name} &lt;${c.email}&gt;
                        </option>
                      `).join('')}
                    </select>
                  ` : `
                    <input type="email" id="email-recipient" required placeholder="correo@ejemplo.com" class="cohere-input text-xs" />
                  `}
                </div>
              </div>

              <!-- Template Selector -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-neutral-50 p-3 rounded-sm border border-neutral-200">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[9px] font-bold text-muted-slate uppercase">Usar Plantilla Reutilizable:</span>
                  <select id="select-email-template" class="cohere-input text-xs bg-white max-w-xs border border-[#d9d9dd] rounded-sm p-1.5">
                    <option value="">-- Redacción Libre (Sin Plantilla) --</option>
                    ${(templates || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                  </select>
                </div>
                <span class="text-[10px] text-neutral-400 italic">Al elegir una plantilla se autocompletará el asunto y cuerpo</span>
              </div>

              <!-- Subject & Preheader -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label for="email-subject-input" class="font-mono text-[9px] font-bold text-primary uppercase">Asunto *</label>
                  <input type="text" id="email-subject-input" required placeholder="Asunto del correo electrónico..." class="cohere-input text-xs" />
                </div>

                <div class="flex flex-col gap-1">
                  <label for="email-preview-text-input" class="font-mono text-[9px] font-bold text-primary uppercase">Vista Previa (Preheader en bandeja de entrada)</label>
                  <input type="text" id="email-preview-text-input" placeholder="Texto de vista previa en bandeja de entrada..." class="cohere-input text-xs" />
                </div>
              </div>

              <!-- Body -->
              <div class="flex flex-col gap-1">
                <label for="email-body-input" class="font-mono text-[9px] font-bold text-primary uppercase">Cuerpo del Email (HTML / Texto) *</label>
                <textarea id="email-body-input" rows="6" required placeholder="Escribe el mensaje..." class="cohere-input text-xs font-mono p-3 leading-relaxed"></textarea>
              </div>

              <!-- Attachments Uploader -->
              <div class="flex flex-col gap-1.5 bg-neutral-50 p-3 rounded-sm border border-neutral-200">
                <div class="flex items-center justify-between">
                  <label class="font-mono text-[9px] font-bold text-primary uppercase flex items-center gap-1.5">
                    <span>📎</span> Archivos Adjuntos (Límite total: 10 MB)
                  </label>
                  <span id="attachments-size-indicator" class="font-mono text-[10px] text-muted">0.0 MB / 10 MB</span>
                </div>
                <div class="flex items-center gap-2">
                  <label for="email-attachments-input" class="px-3 py-1.5 bg-white border border-[#d9d9dd] hover:bg-soft-stone text-slate font-mono text-[11px] font-semibold rounded-xs cursor-pointer transition-colors inline-flex items-center gap-1.5">
                    <span>➕ Añadir Archivo</span>
                  </label>
                  <input type="file" id="email-attachments-input" multiple class="hidden" />
                  <span class="text-[10px] text-neutral-400">PDF, imágenes, documentos Office (Max. 10 MB)</span>
                </div>
                <div id="attachments-list-container" class="flex flex-wrap gap-2 mt-1">
                  <!-- Rendered attachment chips dynamically -->
                </div>
              </div>

              <!-- Submit Button -->
              <div class="flex justify-end pt-2">
                <button type="submit" id="btn-submit-send-email" class="px-6 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 cursor-pointer flex items-center gap-2">
                  <span>✉️ Enviar Email</span>
                </button>
              </div>
            </form>
          </div>

          <!-- History of Email Activity for this Lead -->
          <div class="bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col">
            <div class="px-5 py-4 border-b border-[#d9d9dd] bg-neutral-50 flex items-center justify-between select-none">
              <div class="flex items-center gap-2">
                <span class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase">Historial de Emails Enviados (${(sentEmails || []).length})</span>
                <span class="text-[10px] text-neutral-400 font-sans italic hidden sm:inline">(Hacé clic en cualquier correo para expandir el detalle)</span>
              </div>
            </div>

            <div class="p-4 overflow-x-auto">
              ${(!sentEmails || sentEmails.length === 0) ? `
                <div class="py-8 text-center text-neutral-400 text-xs italic">
                  No hay correos registrados para este lead.
                </div>
              ` : `
                <div class="flex flex-col gap-2.5">
                  ${sentEmails.map(em => {
                    const opens = trackingEvents.filter(ev => ev.email_message_id === em.id && ev.event_type === 'OPEN_DETECTED').length;
                    const clicks = trackingEvents.filter(ev => ev.email_message_id === em.id && ev.event_type === 'CLICKED').length;
                    const statusBadge = em.status === 'SENT' 
                      ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">Enviado</span>'
                      : (em.status === 'FAILED'
                        ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">Fallido</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">En Cola</span>');

                    return `
                      <details class="group border border-[#d9d9dd] rounded-sm bg-white overflow-hidden transition-all duration-150 shadow-2xs hover:border-neutral-400">
                        <summary class="p-3.5 bg-neutral-50/60 hover:bg-neutral-100/70 cursor-pointer list-none flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 select-none transition-colors">
                          <div class="flex items-center gap-2.5 min-w-0 flex-1">
                            <span class="text-neutral-400 group-open:rotate-90 transition-transform duration-150 font-mono text-[10px] select-none inline-block">▶</span>
                            ${statusBadge}
                            <span class="font-bold text-primary text-xs truncate max-w-xs sm:max-w-md" title="${em.subject || ''}">${em.subject || '(Sin Asunto)'}</span>
                          </div>
                          <div class="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                            ${Array.isArray(em.attachments) && em.attachments.length > 0 ? `
                              <span class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-neutral-200/80 text-neutral-700 inline-flex items-center gap-1" title="${em.attachments.length} archivo(s) adjunto(s)">
                                📎 ${em.attachments.length}
                              </span>
                            ` : ''}
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono inline-flex items-center gap-1 ${opens > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-400'}" title="${opens} aperturas detectadas">
                              👁️ ${opens}
                            </span>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono inline-flex items-center gap-1 ${clicks > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-neutral-100 text-neutral-400'}" title="${clicks} clics en enlaces">
                              🔗 ${clicks}
                            </span>
                            <span class="text-[10px] text-muted-slate font-mono ml-1">${formatDateTime(em.sent_at || em.created_at)}</span>
                          </div>
                        </summary>

                        <div class="p-4 border-t border-neutral-200 bg-white flex flex-col gap-3.5 animate-fade-in">
                          <!-- Meta Info Box -->
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-neutral-50/80 p-3 rounded-xs border border-neutral-200/70 text-[11px] text-neutral-600 font-sans">
                            <div><span class="text-muted-slate font-semibold">De:</span> <b class="text-neutral-800">${em.sender_email || '-'}</b></div>
                            <div><span class="text-muted-slate font-semibold">Para:</span> <b class="text-neutral-800">${em.recipient_email || '-'}</b></div>
                            <div><span class="text-muted-slate font-semibold">Fecha:</span> <span class="font-mono text-neutral-700">${formatDateTime(em.sent_at || em.created_at)}</span></div>
                            ${em.preview_text ? `<div class="sm:col-span-2"><span class="text-muted-slate font-semibold">Preheader:</span> <span class="italic text-neutral-700 font-mono text-[10px]">"${em.preview_text}"</span></div>` : ''}
                          </div>

                          <!-- Email Body with rich/clean formatting -->
                          <div class="bg-neutral-50/60 p-4 rounded-sm border border-neutral-200/80 text-xs text-neutral-800 leading-relaxed font-sans max-h-96 overflow-y-auto break-words select-text [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2.5 [&_li]:mb-1 [&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-800 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2.5 [&_blockquote]:text-neutral-600 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mb-1.5 [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-neutral-300 [&_th]:p-1.5 [&_th]:bg-neutral-100 [&_td]:border [&_td]:border-neutral-200 [&_td]:p-1.5">
                            ${formatEmailContentForDisplay(em.body_html, em.body_text)}
                          </div>

                          <!-- Attachments (if any) -->
                          ${Array.isArray(em.attachments) && em.attachments.length > 0 ? `
                            <div class="flex flex-col gap-1.5 pt-2 border-t border-neutral-100">
                              <span class="font-mono text-[10px] font-bold text-primary uppercase flex items-center gap-1.5">
                                <span>📎</span> Archivos Adjuntos (${em.attachments.length}):
                              </span>
                              <div class="flex items-center gap-2 flex-wrap">
                                ${em.attachments.map(att => {
                                  const hasBase64 = !!att.base64_content;
                                  const dataUrl = hasBase64 
                                    ? (att.base64_content.startsWith('data:') ? att.base64_content : `data:${att.content_type || 'application/octet-stream'};base64,${att.base64_content}`)
                                    : null;
                                  return `
                                    <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-sm font-mono text-[11px] text-neutral-700 shadow-2xs">
                                      <span>📎 ${att.filename || 'Archivo'}</span>
                                      ${dataUrl ? `
                                        <a href="${dataUrl}" download="${att.filename || 'adjunto'}" class="text-primary hover:text-cohere-black font-bold text-[10px] underline ml-1 cursor-pointer" title="Descargar archivo">Descargar</a>
                                      ` : ''}
                                    </div>
                                  `;
                                }).join('')}
                              </div>
                            </div>
                          ` : ''}

                          <!-- Footer Tracking status -->
                          <div class="flex items-center justify-between gap-4 pt-2 border-t border-neutral-100 font-mono text-[10px] text-muted-slate flex-wrap">
                            <div class="flex items-center gap-4">
                              <span class="${opens > 0 ? 'text-emerald-700 font-bold' : 'text-neutral-400'} flex items-center gap-1">
                                👁️ ${opens} ${opens === 1 ? 'Apertura detectada' : 'Aperturas detectadas'}
                              </span>
                              <span class="${clicks > 0 ? 'text-blue-700 font-bold' : 'text-neutral-400'} flex items-center gap-1">
                                🔗 ${clicks} ${clicks === 1 ? 'Clic registrado' : 'Clics registrados'}
                              </span>
                            </div>
                            ${em.gmail_message_id ? `
                              <span class="text-neutral-400 text-[9px]">ID Gmail: ${em.gmail_message_id}</span>
                            ` : ''}
                          </div>
                        </div>
                      </details>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      `;

      // Handle Template Selection change
      const templateSelect = parent.querySelector('#select-email-template');
      const subjectInput = parent.querySelector('#email-subject-input');
      const previewTextInput = parent.querySelector('#email-preview-text-input');
      const bodyInput = parent.querySelector('#email-body-input');

      templateSelect.addEventListener('change', () => {
        const tmplId = templateSelect.value;
        if (!tmplId) return;
        const selectedTmpl = (templates || []).find(t => t.id === tmplId);
        if (selectedTmpl) {
          const senderSelect = parent.querySelector('#email-sender');
          const senderOpt = senderSelect.options[senderSelect.selectedIndex];
          const senderEmail = senderOpt ? senderOpt.dataset.email : '';
          const senderName = senderOpt ? senderOpt.text.split('(')[0].replace('👔', '').trim() : '';

          let replacedSubj = selectedTmpl.subject
            .replace(/\{\{lead\.first_name\}\}/g, lead.company || 'Cliente')
            .replace(/\{\{lead\.company_name\}\}/g, lead.company || '')
            .replace(/\{\{lead\.country\}\}/g, lead.country || '')
            .replace(/\{\{lead\.industry\}\}/g, lead.industry || '')
            .replace(/\{\{comercial\.full_name\}\}/g, senderName)
            .replace(/\{\{comercial\.email\}\}/g, senderEmail);

          let replacedPrevText = (selectedTmpl.preview_text || '')
            .replace(/\{\{lead\.first_name\}\}/g, lead.company || 'Cliente')
            .replace(/\{\{lead\.company_name\}\}/g, lead.company || '')
            .replace(/\{\{lead\.country\}\}/g, lead.country || '')
            .replace(/\{\{lead\.industry\}\}/g, lead.industry || '')
            .replace(/\{\{comercial\.full_name\}\}/g, senderName)
            .replace(/\{\{comercial\.email\}\}/g, senderEmail);

          let replacedBody = selectedTmpl.body_html
            .replace(/\{\{lead\.first_name\}\}/g, lead.company || 'Cliente')
            .replace(/\{\{lead\.company_name\}\}/g, lead.company || '')
            .replace(/\{\{lead\.country\}\}/g, lead.country || '')
            .replace(/\{\{lead\.industry\}\}/g, lead.industry || '')
            .replace(/\{\{comercial\.full_name\}\}/g, senderName)
            .replace(/\{\{comercial\.email\}\}/g, senderEmail);

          subjectInput.value = replacedSubj;
          if (previewTextInput) previewTextInput.value = replacedPrevText;
          bodyInput.value = replacedBody;
        }
      });

      // Handle Attachments Selection
      let selectedFiles = []; // Array of { name, size, type, base64 }
      const fileInput = parent.querySelector('#email-attachments-input');
      const attachmentsListContainer = parent.querySelector('#attachments-list-container');
      const attachmentsSizeIndicator = parent.querySelector('#attachments-size-indicator');

      function updateAttachmentChips() {
        const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
        if (attachmentsSizeIndicator) {
          attachmentsSizeIndicator.textContent = `${totalMB} MB / 10 MB`;
        }

        if (!attachmentsListContainer) return;

        if (selectedFiles.length === 0) {
          attachmentsListContainer.innerHTML = '';
          return;
        }

        attachmentsListContainer.innerHTML = selectedFiles.map((f, idx) => `
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#d9d9dd] rounded-full font-mono text-[10px] text-slate shadow-2xs">
            <span>📎 ${f.name}</span>
            <span class="text-muted text-[9px]">(${(f.size / 1024).toFixed(0)} KB)</span>
            <button type="button" class="remove-att-btn text-rose-500 hover:text-rose-700 font-bold ml-1 cursor-pointer" data-index="${idx}">✕</button>
          </div>
        `).join('');

        attachmentsListContainer.querySelectorAll('.remove-att-btn').forEach(btn => {
          btn.addEventListener('click', (ev) => {
            const idx = parseInt(ev.target.dataset.index);
            selectedFiles.splice(idx, 1);
            updateAttachmentChips();
          });
        });
      }

      if (fileInput) {
        fileInput.addEventListener('change', async (ev) => {
          const newFiles = Array.from(ev.target.files || []);
          let currentTotalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

          for (const f of newFiles) {
            if (currentTotalBytes + f.size > 10 * 1024 * 1024) {
              toast.show(`El archivo "${f.name}" supera el límite total acumulado de 10 MB por correo.`, 'warning');
              continue;
            }

            try {
              const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(f);
              });

              selectedFiles.push({
                name: f.name,
                size: f.size,
                type: f.type || 'application/octet-stream',
                base64: base64Data
              });
              currentTotalBytes += f.size;
            } catch (err) {
              console.error('Error reading attachment file:', err);
              toast.show(`Error al leer el archivo ${f.name}`, 'error');
            }
          }

          fileInput.value = '';
          updateAttachmentChips();
        });
      }

      // Handle Form Submit
      const sendForm = parent.querySelector('#lead-send-email-form');
      sendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = parent.querySelector('#btn-submit-send-email');
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>🔄 Enviando...</span>`;

        try {
          const senderSelect = parent.querySelector('#email-sender');
          const senderProfileId = senderSelect.value;
          const senderEmail = senderSelect.options[senderSelect.selectedIndex].dataset.email;

          const recipientSelect = parent.querySelector('#email-recipient');
          let recipientEmail = '';
          let contactId = null;
          if (recipientSelect.tagName === 'SELECT') {
            recipientEmail = recipientSelect.value;
            contactId = recipientSelect.options[recipientSelect.selectedIndex].dataset.contactId || null;
          } else {
            recipientEmail = recipientSelect.value.trim();
          }

          const subject = subjectInput.value.trim();
          const preview_text = previewTextInput?.value?.trim() || null;
          const body_html = bodyInput.value.trim();

          const attachmentsPayload = selectedFiles.map(f => ({
            filename: f.name,
            content_type: f.type,
            base64_content: f.base64
          }));

          // 1. Save record in email_messages
          const { data: newMsg, error: insertErr } = await supabase
            .from('email_messages')
            .insert({
              lead_id: lead.id,
              contact_id: contactId,
              sender_profile_id: senderProfileId,
              sender_email: senderEmail,
              recipient_email: recipientEmail,
              subject: subject,
              preview_text: preview_text,
              body_html: body_html,
              body_text: body_html.replace(/<[^>]*>?/gm, ''),
              status: 'QUEUED',
              sent_at: null,
              attachments: attachmentsPayload
            })
            .select()
            .single();

          if (insertErr) throw insertErr;

          // 2. Call Edge Function send-email synchronously for actual Gmail API dispatch
          const session = await auth.getSession();
          const edgeRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email_message_id: newMsg.id })
          });

          const resData = await edgeRes.json().catch(() => ({}));
          if (!edgeRes.ok || resData.error) {
            throw new Error(resData.error || `Error en envío de Gmail (${edgeRes.status})`);
          }

          // 3. Insert record into lead_interactions
          const emailInteraction = {
            lead_id: lead.id,
            created_by: currentUser?.id,
            contact_type: 'email',
            direction: 'outbound',
            subject: `📧 Email: ${subject}`,
            body: `De: ${senderEmail}\nPara: ${recipientEmail}\n\n${body_html.replace(/<[^>]*>?/gm, '')}`,
            contacted_at: new Date().toISOString()
          };

          await supabase.from('lead_interactions').insert(emailInteraction);
          cache.addInteraction(emailInteraction);

          // 4. Update fecha_ultimo_contacto on lead
          const emailTime = emailInteraction.contacted_at;
          await supabase.from('leads').update({
            fecha_ultimo_contacto: emailTime,
            updated_at: emailTime
          }).eq('id', lead.id);

          lead.fecha_ultimo_contacto = emailTime;
          cache.updateLead(lead);

          // Send real-time notifications to team members
          await notifyNewInteraction({
            lead,
            interaction: emailInteraction,
            currentUser
          });

          toast.show('¡Email procesado y enviado con éxito por Gmail!', 'success');
          await refreshInteractions();
          await renderEmailTab(parent);
        } catch (err) {
          console.error('Error sending email:', err);
          toast.show('Error al enviar el email: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>✉️ Enviar Email</span>`;
        }
      });

    } catch (err) {
      console.error('Error in renderEmailTab:', err);
      parent.innerHTML = `
        <div class="p-8 text-center text-rose-500 font-mono text-xs">
          Error cargando módulo de email: ${err.message}
        </div>
      `;
    }
  }
}
