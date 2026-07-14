import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { formatDate, formatDateTime } from '../utils/date-format';
import { modal } from '../components/modal';
import { toast } from '../components/toast';
import { openContactEditModal } from '../components/contact-edit-modal';

export async function renderLeadDetail(leadId, onUpdate) {
  let activeTab = localStorage.getItem('lead_detail_active_tab') || 'detail'; // 'detail', 'linked_contacts', 'interactions', 'comments', 'history'

  let lead = null;
  let linkedContacts = []; // Contacts linked to the company
  let interactions = []; // Interaction logs (previously lead_contacts)
  let comments = [];
  let statusHistory = [];
  let auditLogs = [];

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
      const [interactionsRes, commentsRes, historyRes, auditRes] = await Promise.all([
        supabase.from('lead_interactions').select('*').eq('lead_id', leadId).order('contacted_at', { ascending: false }),
        supabase.from('lead_comments').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
        supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false }),
        supabase.from('lead_audit_log').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false })
      ]);

      interactions = interactionsRes.data || [];
      comments = commentsRes.data || [];
      statusHistory = historyRes.data || [];
      auditLogs = auditRes.data || [];

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
    
    // Modal Header Info
    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-neutral-100 pb-4 select-none';
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
        <select id="header-stage-select" class="mt-0.5 bg-white border border-[#d9d9dd] rounded-sm py-1 px-2 font-mono text-[10px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          ${stages.map(s => `<option value="${s.id}" ${lead.pipeline_stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
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

    // Event listener for stage change dropdown
    summaryHeader.querySelector('#header-stage-select').addEventListener('change', async (e) => {
      const stageId = e.target.value;
      try {
        const { error } = await supabase
          .from('leads')
          .update({ pipeline_stage_id: stageId })
          .eq('id', lead.id);

        if (error) throw error;
        lead.pipeline_stage_id = stageId;
        cache.updateLead(lead);
        toast.show('Etapa actualizada correctamente', 'success');
        refreshHistory();
      } catch (err) {
        toast.show('Error al cambiar etapa: ' + err.message, 'error');
        e.target.value = lead.pipeline_stage_id;
      }
    });

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
      renderDetailTab(tabContent, stages, profiles);
    } else if (activeTab === 'linked_contacts') {
      renderLinkedContactsTab(tabContent);
    } else if (activeTab === 'interactions') {
      renderInteractionsTab(tabContent, profiles);
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
  function renderDetailTab(parent, stages, profiles) {
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

        <div class="sm:col-span-2 flex items-center justify-end gap-3 mt-4 border-t border-neutral-100 pt-4">
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
  }

  // --- TAB 2: CONTACTOS ASOCIADOS (LINKED CONTACTS) ---
  function renderLinkedContactsTab(parent) {
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
        <div class="flex flex-col gap-1">
          <label for="add-c-firstname" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre *</label>
          <input type="text" id="add-c-firstname" name="first_name" required class="cohere-input text-xs" />
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
            const agent = profiles.find(p => p.id === c.created_by);
            const agentName = agent?.full_name || 'Comercial';
            
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
                    <span>Por: <b>${agentName}</b></span>
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
                
                // Update fecha_ultimo_contacto on all contacts linked to this company
                const today = new Date().toISOString().split('T')[0];
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
}
