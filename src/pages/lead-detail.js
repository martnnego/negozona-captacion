import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { formatDate, formatDateTime } from '../utils/date-format';
import { modal } from '../components/modal';
import { toast } from '../components/toast';

export async function renderLeadDetail(leadId, onUpdate) {
  let activeTab = 'detail'; // 'detail', 'contacts', 'comments', 'history'

  let lead = null;
  let contacts = [];
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
      <span>Cargando ficha de lead...</span>
    </div>
  `;

  const detailModal = modal.create({
    title: 'Ficha de Lead',
    content: contentWrapper,
    onClose: () => {
      if (onUpdate) onUpdate();
    }
  });

  // Fetch initial details
  try {
    const [leadRes, contactsRes, commentsRes, historyRes, auditRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', leadId).single(),
      supabase.from('lead_contacts').select('*').eq('lead_id', leadId).order('contacted_at', { ascending: false }),
      supabase.from('lead_comments').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false }),
      supabase.from('lead_audit_log').select('*').eq('lead_id', leadId).order('changed_at', { ascending: false })
    ]);

    if (leadRes.error) throw leadRes.error;
    
    lead = leadRes.data;
    contacts = contactsRes.data || [];
    comments = commentsRes.data || [];
    statusHistory = historyRes.data || [];
    auditLogs = auditRes.data || [];

    renderContent();
  } catch (err) {
    toast.show('Error al traer detalles del lead: ' + err.message, 'error');
    detailModal.close();
  }

  function renderContent() {
    const bodyEl = detailModal.bodyEl;
    bodyEl.innerHTML = '';
    bodyEl.className = 'flex-1 p-6 font-sans text-sm text-neutral-700 flex flex-col gap-6 max-h-[80vh] overflow-y-auto';

    const stages = cache.getStages();
    const profiles = cache.getProfiles();
    
    const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Sin Nombre';

    // Modal Header Dashboard info
    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-neutral-100 pb-4 select-none';
    summaryHeader.innerHTML = `
      <div>
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Nombre completo</h4>
        <p class="text-sm font-semibold text-primary mt-0.5">${fullName}</p>
      </div>
      <div>
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Empresa / Marca</h4>
        <p class="text-sm font-semibold text-primary mt-0.5">${lead.company || '—'}</p>
      </div>
      <div class="flex flex-col gap-0.5">
        <h4 class="text-xs font-mono font-bold text-muted-slate uppercase tracking-wider">Etapa Actual</h4>
        <select id="header-stage-select" class="mt-0.5 bg-white border border-[#d9d9dd] rounded-sm py-1 px-2 font-mono text-[10px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          ${stages.map(s => `<option value="${s.id}" ${lead.pipeline_stage_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
    `;

    // Tab Navigation Bar
    const tabsBar = document.createElement('div');
    tabsBar.className = 'flex items-center gap-6 border-b border-[#d9d9dd] font-sans text-xs select-none';
    
    const tabs = [
      { id: 'detail', label: 'INFORMACIÓN GENERAL' },
      { id: 'contacts', label: `GESTIONES (${contacts.length})` },
      { id: 'comments', label: `COMENTARIOS (${comments.length})` },
      { id: 'history', label: 'HISTORIAL' }
    ];

    tabsBar.innerHTML = tabs.map(tab => `
      <button 
        data-tab="${tab.id}" 
        class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 ${
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
        toast.show('Etapa actualizada correctamente', 'success');
        
        // Refresh logs/history
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
        renderContent();
      });
    });

    // Render active tab view
    if (activeTab === 'detail') {
      renderDetailTab(tabContent, stages, profiles);
    } else if (activeTab === 'contacts') {
      renderContactsTab(tabContent, profiles);
    } else if (activeTab === 'comments') {
      renderCommentsTab(tabContent, profiles);
    } else if (activeTab === 'history') {
      renderHistoryTab(tabContent, stages, profiles);
    }
  }

  // REFRESH DATA FUNCTIONS
  async function refreshHistory() {
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

  async function refreshContacts() {
    try {
      const res = await supabase.from('lead_contacts').select('*').eq('lead_id', lead.id).order('contacted_at', { ascending: false });
      contacts = res.data || [];
      renderContent();
    } catch (err) {
      console.error(err);
    }
  }

  async function refreshComments() {
    try {
      const res = await supabase.from('lead_comments').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      comments = res.data || [];
      renderContent();
    } catch (err) {
      console.error(err);
    }
  }

  // TAB RENDERING METHODS
  function renderDetailTab(parent, stages, profiles) {
    parent.innerHTML = `
      <form id="lead-edit-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
        <div class="flex flex-col gap-1">
          <label for="edit-first-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre</label>
          <input type="text" id="edit-first-name" name="first_name" required value="${lead.first_name || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-last-name" class="font-mono text-[9px] font-bold text-primary uppercase">Apellido</label>
          <input type="text" id="edit-last-name" name="last_name" required value="${lead.last_name || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-company" class="font-mono text-[9px] font-bold text-primary uppercase">Empresa / Marca</label>
          <input type="text" id="edit-company" name="company" value="${lead.company || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email</label>
          <input type="email" id="edit-email" name="email" value="${lead.email || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono</label>
          <input type="text" id="edit-phone" name="phone" value="${lead.phone || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-country" class="font-mono text-[9px] font-bold text-primary uppercase">País</label>
          <select id="edit-country" name="country" class="cohere-input text-xs">
            <option value="">Seleccionar País</option>
            ${['Argentina', 'España', 'México', 'Uruguay', 'Chile']
              .map(c => `<option value="${c}" ${lead.country === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-position" class="font-mono text-[9px] font-bold text-primary uppercase">Cargo</label>
          <input type="text" id="edit-position" name="position" value="${lead.position || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-linkedin" class="font-mono text-[9px] font-bold text-primary uppercase">URL LinkedIn</label>
          <input type="url" id="edit-linkedin" name="linkedin_url" value="${lead.linkedin_url || ''}" class="cohere-input text-xs" placeholder="https://linkedin.com/in/..." />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-assigned" class="font-mono text-[9px] font-bold text-primary uppercase">Comercial Asignado</label>
          <select id="edit-assigned" name="assigned_to" class="cohere-input text-xs">
            <option value="">Sin Asignar</option>
            ${profiles.map(p => `<option value="${p.id}" ${lead.assigned_to === p.id ? 'selected' : ''}>${p.full_name}</option>`).join('')}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-valoracion" class="font-mono text-[9px] font-bold text-primary uppercase">Valoración</label>
          <select id="edit-valoracion" name="valoracion" class="cohere-input text-xs">
            <option value="">Sin valoración</option>
            ${['★', '★★', '★★★', '★★★★', '★★★★★'].map(v => `<option value="${v}" ${lead.valoracion === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-industry" class="font-mono text-[9px] font-bold text-primary uppercase">Rubro / Industria</label>
          <input type="text" id="edit-industry" name="industry" value="${lead.industry || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-investment" class="font-mono text-[9px] font-bold text-primary uppercase">Inversión Estimada</label>
          <input type="text" id="edit-investment" name="investment" value="${lead.investment || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-branches" class="font-mono text-[9px] font-bold text-primary uppercase">Sucursales</label>
          <input type="text" id="edit-branches" name="branches" value="${lead.branches || ''}" class="cohere-input text-xs" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="edit-medio" class="font-mono text-[9px] font-bold text-primary uppercase">Medio de Contacto preferido</label>
          <input type="text" id="edit-medio" name="medio_contacto" value="${lead.medio_contacto || ''}" class="cohere-input text-xs" placeholder="WhatsApp, Email, etc." />
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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = form.querySelector('#save-lead-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      const formData = new FormData(form);
      const updatedFields = {
        first_name: formData.get('first_name').trim(),
        last_name: formData.get('last_name').trim(),
        company: formData.get('company').trim() || null,
        email: formData.get('email').trim() || null,
        phone: formData.get('phone').trim() || null,
        country: formData.get('country') || null,
        position: formData.get('position').trim() || null,
        linkedin_url: formData.get('linkedin_url').trim() || null,
        assigned_to: formData.get('assigned_to') || null,
        valoracion: formData.get('valoracion') || null,
        industry: formData.get('industry').trim() || null,
        investment: formData.get('investment').trim() || null,
        branches: formData.get('branches').trim() || null,
        medio_contacto: formData.get('medio_contacto').trim() || null,
        notes: formData.get('notes').trim() || null
      };

      try {
        const { error } = await supabase
          .from('leads')
          .update(updatedFields)
          .eq('id', lead.id);

        if (error) throw error;
        lead = { ...lead, ...updatedFields };
        toast.show('Lead actualizado correctamente', 'success');
        refreshHistory();
      } catch (err) {
        toast.show('Error al guardar: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar cambios';
      }
    });
  }

  function renderContactsTab(parent, profiles) {
    let contactsListHtml = '';
    if (contacts.length === 0) {
      contactsListHtml = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No hay gestiones registradas aún para este lead.
        </div>
      `;
    } else {
      contactsListHtml = `
        <div class="flex flex-col gap-4 font-sans text-xs">
          ${contacts.map(c => {
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
      form.className = 'flex flex-col gap-4';
      form.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label for="contact-type" class="font-mono text-[9px] font-bold text-primary uppercase">Medio de Contacto</label>
            <select id="contact-type" name="contact_type" required class="cohere-input text-xs">
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
            <select id="contact-direction" name="direction" required class="cohere-input text-xs">
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
              const newContact = {
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
                  .from('lead_contacts')
                  .insert([newContact]);

                if (error) throw error;
                
                // Update fecha_ultimo_contacto on lead
                const today = new Date().toISOString().split('T')[0];
                await supabase
                  .from('leads')
                  .update({ fecha_ultimo_contacto: today })
                  .eq('id', lead.id);
                lead.fecha_ultimo_contacto = today;

                toast.show('Gestión registrada correctamente', 'success');
                closeSubModal();
                refreshContacts();
                refreshHistory();
              } catch (err) {
                toast.show('Error al registrar contacto: ' + err.message, 'error');
              }
            }
          }
        ]
      });
    });
  }

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
        <!-- Add comment textbox -->
        <div class="flex flex-col gap-2">
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

  function renderHistoryTab(parent, stages, profiles) {
    // Combine Status History & Audit Logs
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

    // Sort items chronologically (newest first)
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
      <!-- Vertical Timeline -->
      <div class="relative border-l border-neutral-200 pl-4 py-2 flex flex-col gap-6 max-h-80 overflow-y-auto">
        ${timelineItems.map(item => item.html).join('')}
      </div>
    `;
  }

  function translateFieldName(field) {
    const translations = {
      first_name: 'Nombre',
      last_name: 'Apellido',
      email: 'Email',
      phone: 'Teléfono',
      company: 'Empresa',
      position: 'Cargo',
      linkedin_url: 'LinkedIn',
      country: 'País',
      source: 'Origen',
      industry: 'Rubro',
      investment: 'Inversión',
      branches: 'Sucursales',
      assigned_to: 'Asignación',
      valoracion: 'Valoración',
      medio_contacto: 'Medio contacto',
      notes: 'Notas',
      motivo_descarte: 'Motivo descarte'
    };
    return translations[field] || field;
  }
}
