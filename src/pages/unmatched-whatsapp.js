import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { modal } from '../components/modal';
import { toast } from '../components/toast';
import { formatDateTime } from '../utils/date-format';

export function renderUnmatchedWhatsApp(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none font-sans text-xs';

  let unmatchedList = [];
  let groupedContacts = [];
  let isLoading = true;

  // Render header
  const renderHeader = () => `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-4">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-xl">💬</span>
          <h2 class="text-lg font-bold text-primary font-display tracking-tight">WhatsApp Sin Asignar</h2>
        </div>
        <p class="text-neutral-500 text-xs">Contactos y mensajes recibidos de números de teléfono que no pertenecen a ningún lead registrado en el CRM.</p>
      </div>
      <button id="refresh-unmatched-btn" type="button" class="px-3 py-1.5 border border-[#d9d9dd] hover:border-primary text-neutral-600 hover:text-primary font-mono font-bold text-[10px] uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none cursor-pointer flex items-center gap-1.5 self-start sm:self-auto">
        <svg id="refresh-unmatched-icon" class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span>Actualizar</span>
      </button>
    </div>
  `;

  // Helper to group raw messages by sender_phone
  function groupMessagesByPhone(rawList) {
    const groupsMap = new Map();

    for (const msg of rawList) {
      const phone = msg.sender_phone || 'Sin número';
      if (!groupsMap.has(phone)) {
        groupsMap.set(phone, {
          phone,
          sender_name: msg.sender_name || 'Contacto WhatsApp',
          latest_received_at: msg.received_at,
          messages: []
        });
      }
      const group = groupsMap.get(phone);
      if (msg.sender_name && group.sender_name === 'Contacto WhatsApp') {
        group.sender_name = msg.sender_name;
      }
      if (new Date(msg.received_at) > new Date(group.latest_received_at)) {
        group.latest_received_at = msg.received_at;
      }
      group.messages.push(msg);
    }

    const groupedArray = Array.from(groupsMap.values()).sort((a, b) => {
      return new Date(b.latest_received_at) - new Date(a.latest_received_at);
    });

    groupedArray.forEach(group => {
      group.messages.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
    });

    return groupedArray;
  }

  // Fetch unmatched messages from database
  async function loadUnmatchedMessages() {
    isLoading = true;
    render();
    try {
      const { data, error } = await supabase
        .from('whatsapp_unmatched_messages')
        .select('*')
        .eq('is_assigned', false)
        .order('received_at', { ascending: false });

      if (error) throw error;
      unmatchedList = data || [];
      groupedContacts = groupMessagesByPhone(unmatchedList);
      
      // Update badge count in sidebar if element exists
      const badge = document.getElementById('unmatched-wa-badge');
      if (badge) {
        if (groupedContacts.length > 0) {
          badge.textContent = groupedContacts.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    } catch (err) {
      console.error('Error loading unmatched messages:', err);
      toast.show('Error al cargar mensajes sin asignar: ' + err.message, 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  // Render content
  function render() {
    if (isLoading) {
      container.innerHTML = `
        ${renderHeader()}
        <div class="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Cargando contactos sin asignar...</span>
        </div>
      `;
      return;
    }

    let listHtml = '';
    if (groupedContacts.length === 0) {
      listHtml = `
        <div class="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400 italic border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/30">
          <svg class="w-10 h-10 text-neutral-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-medium text-xs">¡Excelente! No hay mensajes ni contactos de WhatsApp pendientes sin asignar.</span>
        </div>
      `;
    } else {
      listHtml = `
        <div class="grid grid-cols-1 gap-5">
          ${groupedContacts.map(group => `
            <div class="border border-[#d9d9dd] rounded-md p-4 bg-white hover:border-primary/40 transition-all flex flex-col gap-4 shadow-xs">
              <!-- Contact Header -->
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                    💬
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-bold text-primary text-sm font-display">${group.sender_name}</span>
                      <span class="font-mono text-[11px] bg-neutral-100 text-neutral-700 font-semibold px-2 py-0.5 rounded border border-neutral-200">${group.phone}</span>
                      <span class="font-mono text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200/60">
                        ${group.messages.length} ${group.messages.length === 1 ? 'mensaje' : 'mensajes'}
                      </span>
                    </div>
                    <span class="text-[10px] text-neutral-400 font-mono">Último recibido: ${formatDateTime(group.latest_received_at)}</span>
                  </div>
                </div>

                <!-- Action Buttons for Group -->
                <div class="flex items-center gap-2 self-end md:self-auto flex-wrap">
                  <button data-associate-group-phone="${group.phone}" type="button" class="px-3 py-1.5 bg-primary hover:bg-cohere-black text-white text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-all cursor-pointer shadow-xs">
                    🔗 Asociar a Lead
                  </button>
                  <button data-create-lead-group-phone="${group.phone}" type="button" class="px-3 py-1.5 border border-[#d9d9dd] hover:border-emerald-600 hover:text-emerald-600 text-neutral-700 text-[9px] font-mono font-bold uppercase rounded-full bg-white transition-all cursor-pointer shadow-xs">
                    ➕ Crear Lead
                  </button>
                  <button data-dismiss-group-phone="${group.phone}" type="button" class="px-2.5 py-1.5 border border-transparent hover:border-rose-200 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-full text-xs transition-all cursor-pointer" title="Descartar todos los mensajes de este contacto">
                    🗑️ Descartar todo
                  </button>
                </div>
              </div>

              <!-- Message Stream -->
              <div class="flex flex-col gap-2 pl-2 md:pl-4 border-l-2 border-emerald-500/20">
                <span class="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-400">Historial de Mensajes Recibidos:</span>
                <div class="flex flex-col gap-2.5">
                  ${group.messages.map(msg => `
                    <div class="bg-[#f8f9fa] p-3 rounded-lg border border-neutral-200/70 flex flex-col gap-1.5 relative group hover:border-neutral-300 transition-all">
                      <div class="flex items-center justify-between gap-2 border-b border-neutral-200/40 pb-1">
                        <span class="text-[10px] text-neutral-500 font-mono font-semibold">📅 ${formatDateTime(msg.received_at)}</span>
                        <button data-dismiss-msg-id="${msg.id}" type="button" class="text-neutral-400 hover:text-rose-600 text-[10px] p-0.5 rounded transition-colors cursor-pointer" title="Descartar solo este mensaje">
                          ✕ Descartar
                        </button>
                      </div>
                      <p class="text-neutral-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">${msg.body || '<span class="italic text-neutral-400">Sin contenido de texto</span>'}</p>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      ${renderHeader()}
      ${listHtml}
    `;

    // Refresh listener
    const refreshBtn = container.querySelector('#refresh-unmatched-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadUnmatchedMessages();
      });
    }

    // Attach event listeners for group actions
    container.querySelectorAll('[data-associate-group-phone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const phone = btn.dataset.associateGroupPhone;
        const group = groupedContacts.find(g => g.phone === phone);
        if (group) openAssociateModal(group);
      });
    });

    container.querySelectorAll('[data-create-lead-group-phone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const phone = btn.dataset.createLeadGroupPhone;
        const group = groupedContacts.find(g => g.phone === phone);
        if (group) openCreateLeadModal(group);
      });
    });

    container.querySelectorAll('[data-dismiss-group-phone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const phone = btn.dataset.dismissGroupPhone;
        const group = groupedContacts.find(g => g.phone === phone);
        if (group) dismissGroupMessages(group);
      });
    });

    container.querySelectorAll('[data-dismiss-msg-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.dismissMsgId;
        dismissSingleMessage(msgId);
      });
    });
  }

  // Modal 1: Associate grouped contact messages with an existing lead
  function openAssociateModal(contactGroup) {
    const leads = cache.leads || [];
    let selectedLeadId = null;

    const modalContent = document.createElement('div');
    modalContent.className = 'flex flex-col gap-4 select-none text-xs font-sans';

    modalContent.innerHTML = `
      <div class="bg-neutral-50 p-3 rounded border border-neutral-200 flex flex-col gap-1.5">
        <span class="font-mono text-[9px] font-bold text-neutral-400 uppercase">Contacto a asociar</span>
        <div class="flex items-center gap-2">
          <span class="font-bold text-primary text-xs">${contactGroup.sender_name}</span>
          <span class="font-mono text-[10px] bg-neutral-200/70 text-neutral-700 px-1.5 py-0.5 rounded">${contactGroup.phone}</span>
        </div>
        <div class="mt-1 pt-1 border-t border-neutral-200 flex flex-col gap-1">
          <span class="text-[10px] font-semibold text-neutral-500 font-mono">Mensajes a vincular (${contactGroup.messages.length}):</span>
          <div class="max-h-28 overflow-y-auto flex flex-col gap-1 pr-1">
            ${contactGroup.messages.map(m => `
              <div class="text-[10px] text-neutral-700 bg-white p-1.5 rounded border border-neutral-200/60 truncate">
                <span class="font-mono text-[9px] text-neutral-400">[${formatDateTime(m.received_at)}]</span> ${m.body}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="search-lead-input" class="font-mono text-[9px] font-bold text-primary uppercase">Buscar Lead / Empresa</label>
        <input type="text" id="search-lead-input" class="cohere-input text-xs w-full" placeholder="Escribe el nombre de la empresa..." />
      </div>

      <div id="leads-results-list" class="max-h-[200px] overflow-y-auto flex flex-col gap-1 border border-neutral-200 rounded p-1">
        <!-- Injected dynamically -->
      </div>
    `;

    const searchInput = modalContent.querySelector('#search-lead-input');
    const resultsContainer = modalContent.querySelector('#leads-results-list');

    function renderLeadsList(query = '') {
      const q = query.toLowerCase().trim();
      const filtered = leads.filter(l => (l.company || '').toLowerCase().includes(q));

      if (filtered.length === 0) {
        resultsContainer.innerHTML = `
          <div class="py-6 text-center text-neutral-400 italic text-xs">No se encontraron leads coincidentes.</div>
        `;
        return;
      }

      resultsContainer.innerHTML = filtered.map(l => `
        <div data-lead-select-id="${l.id}" class="p-2.5 rounded cursor-pointer transition-all flex items-center justify-between border ${
          selectedLeadId === l.id ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-neutral-50 border-neutral-100 text-neutral-800'
        }">
          <div class="flex flex-col">
            <span class="font-bold text-xs">${l.company}</span>
            <span class="text-[9px] opacity-75">${l.industry || 'Sin rubro'}</span>
          </div>
          ${selectedLeadId === l.id ? '<span class="font-bold text-xs">✓</span>' : ''}
        </div>
      `).join('');

      resultsContainer.querySelectorAll('[data-lead-select-id]').forEach(item => {
        item.addEventListener('click', () => {
          selectedLeadId = item.dataset.leadSelectId;
          renderLeadsList(searchInput.value);
        });
      });
    }

    searchInput.addEventListener('input', (e) => {
      renderLeadsList(e.target.value);
    });

    renderLeadsList();

    modal.create({
      title: 'Asociar Contacto de WhatsApp a Lead',
      content: modalContent,
      actions: [
        { text: 'Cancelar' },
        {
          text: 'Confirmar Asociación',
          primary: true,
          onClick: async (closeSubModal) => {
            if (!selectedLeadId) {
              toast.show('Por favor selecciona un lead de la lista', 'info');
              return;
            }

            try {
              const whatsappInserts = contactGroup.messages.map(msg => ({
                lead_id: selectedLeadId,
                phone_number_id: msg.phone_number_id || null,
                direction: 'inbound',
                recipient_phone: contactGroup.phone,
                body: msg.body,
                status: 'received',
                sent_at: msg.received_at || new Date().toISOString()
              }));

              const interactionInserts = contactGroup.messages.map(msg => ({
                lead_id: selectedLeadId,
                contact_type: 'whatsapp',
                direction: 'inbound',
                subject: 'Respuesta WhatsApp (Asociado)',
                body: msg.body,
                contacted_at: msg.received_at || new Date().toISOString()
              }));

              const msgIds = contactGroup.messages.map(m => m.id);

              // 1. Insert into whatsapp_messages
              await supabase.from('whatsapp_messages').insert(whatsappInserts);

              // 2. Insert into lead_interactions
              await supabase.from('lead_interactions').insert(interactionInserts);

              // 3. Mark all as assigned in whatsapp_unmatched_messages
              await supabase
                .from('whatsapp_unmatched_messages')
                .update({
                  is_assigned: true,
                  assigned_lead_id: selectedLeadId
                })
                .in('id', msgIds);

              toast.show(`${contactGroup.messages.length} mensaje(s) asociado(s) con éxito al lead`, 'success');
              closeSubModal();
              loadUnmatchedMessages();
            } catch (err) {
              console.error('Error associating contact group messages:', err);
              toast.show('Error al asociar el contacto: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  }

  // Modal 2: Create new lead and associate all messages from group
  function openCreateLeadModal(contactGroup) {
    const form = document.createElement('form');
    form.className = 'flex flex-col gap-3.5 select-none text-xs font-sans';
    form.innerHTML = `
      <div class="bg-neutral-50 p-3 rounded border border-neutral-200 flex flex-col gap-1">
        <span class="font-mono text-[9px] font-bold text-neutral-400 uppercase">Contacto de WhatsApp</span>
        <span class="font-bold text-primary">${contactGroup.sender_name} (${contactGroup.phone})</span>
        <span class="text-[10px] text-neutral-500 font-mono mt-0.5">Se vincularán los ${contactGroup.messages.length} mensaje(s) recibido(s).</span>
      </div>

      <div class="flex flex-col gap-1">
        <label for="new-lead-company" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre Empresa / Marca *</label>
        <input type="text" id="new-lead-company" name="company" required class="cohere-input text-xs w-full" placeholder="Ej: Café Martínez (Sucursal Centro)" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label for="new-contact-firstname" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre Contacto</label>
          <input type="text" id="new-contact-firstname" name="first_name" value="${contactGroup.sender_name !== 'Contacto WhatsApp' ? contactGroup.sender_name : ''}" class="cohere-input text-xs w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="new-contact-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono Contacto *</label>
          <input type="text" id="new-contact-phone" name="phone" value="${contactGroup.phone || ''}" required class="cohere-input text-xs w-full" />
        </div>
      </div>
    `;

    modal.create({
      title: 'Crear Nuevo Lead y Asociar WhatsApp',
      content: form,
      actions: [
        { text: 'Cancelar' },
        {
          text: 'Crear y Asociar',
          primary: true,
          onClick: async (closeSubModal) => {
            const formData = new FormData(form);
            const company = formData.get('company').trim();
            const firstName = formData.get('first_name').trim() || 'Contacto';
            const phone = formData.get('phone').trim();

            if (!company || !phone) {
              toast.show('Completa los campos obligatorios', 'error');
              return;
            }

            try {
              // 1. Insert new lead
              const stages = cache.stages || [];
              const { data: newLead, error: leadErr } = await supabase
                .from('leads')
                .insert([{
                  company,
                  pipeline_stage_id: stages[0]?.id || null,
                  assigned_to: currentUser?.id || null
                }])
                .select()
                .single();

              if (leadErr) throw leadErr;

              // 2. Insert new contact
              const { data: newContact, error: contactErr } = await supabase
                .from('contacts')
                .insert([{
                  first_name: firstName,
                  phone,
                  is_active: true
                }])
                .select()
                .single();

              if (contactErr) throw contactErr;

              // 3. Link contact to lead
              await supabase.from('lead_contacts_link').insert([{
                lead_id: newLead.id,
                contact_id: newContact.id
              }]);

              await supabase.from('leads').update({ primary_contact_id: newContact.id }).eq('id', newLead.id);

              // 4. Update local cache
              cache.addLead(newLead);
              cache.addContact(newContact);

              // 5. Insert messages & interactions for all messages in group
              const whatsappInserts = contactGroup.messages.map(msg => ({
                lead_id: newLead.id,
                contact_id: newContact.id,
                phone_number_id: msg.phone_number_id || null,
                direction: 'inbound',
                recipient_phone: phone,
                body: msg.body,
                status: 'received',
                sent_at: msg.received_at || new Date().toISOString()
              }));

              const interactionInserts = contactGroup.messages.map(msg => ({
                lead_id: newLead.id,
                contact_type: 'whatsapp',
                direction: 'inbound',
                subject: 'Primer contacto WhatsApp',
                body: msg.body,
                contacted_at: msg.received_at || new Date().toISOString()
              }));

              const msgIds = contactGroup.messages.map(m => m.id);

              await supabase.from('whatsapp_messages').insert(whatsappInserts);
              await supabase.from('lead_interactions').insert(interactionInserts);

              // 6. Mark unmatched messages as assigned
              await supabase
                .from('whatsapp_unmatched_messages')
                .update({
                  is_assigned: true,
                  assigned_lead_id: newLead.id
                })
                .in('id', msgIds);

              toast.show('Nuevo lead creado y mensajes asociados con éxito', 'success');
              closeSubModal();
              loadUnmatchedMessages();
            } catch (err) {
              console.error('Error creating lead and associating message:', err);
              toast.show('Error al crear lead: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  }

  // Dismiss all messages from a group
  async function dismissGroupMessages(contactGroup) {
    if (!confirm(`¿Deseas descartar los ${contactGroup.messages.length} mensaje(s) de ${contactGroup.sender_name} (${contactGroup.phone}) sin asignarlos?`)) return;
    try {
      const msgIds = contactGroup.messages.map(m => m.id);
      const { error } = await supabase
        .from('whatsapp_unmatched_messages')
        .update({ is_assigned: true })
        .in('id', msgIds);

      if (error) throw error;
      toast.show('Mensajes descartados con éxito', 'info');
      loadUnmatchedMessages();
    } catch (err) {
      toast.show('Error al descartar mensajes: ' + err.message, 'error');
    }
  }

  // Dismiss a single message
  async function dismissSingleMessage(msgId) {
    if (!confirm('¿Deseas descartar este mensaje individual de la lista sin asignarlo?')) return;
    try {
      const { error } = await supabase
        .from('whatsapp_unmatched_messages')
        .update({ is_assigned: true })
        .eq('id', msgId);

      if (error) throw error;
      toast.show('Mensaje descartado', 'info');
      loadUnmatchedMessages();
    } catch (err) {
      toast.show('Error al descartar mensaje: ' + err.message, 'error');
    }
  }

  // Initial load
  loadUnmatchedMessages();

  return container;
}

