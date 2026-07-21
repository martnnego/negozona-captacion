import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { modal } from '../components/modal';
import { toast } from '../components/toast';
import { formatDateTime } from '../utils/date-format';

export function renderUnmatchedWhatsApp(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none font-sans text-xs';

  let unmatchedList = [];
  let isLoading = true;

  // Render header
  const renderHeader = () => `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-4">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-xl">💬</span>
          <h2 class="text-lg font-bold text-primary font-display tracking-tight">WhatsApp Sin Asignar</h2>
        </div>
        <p class="text-neutral-500 text-xs">Mensajes recibidos de números de teléfono que no pertenecen a ningún contacto registrado en el CRM.</p>
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
      
      // Update badge count in sidebar if element exists
      const badge = document.getElementById('unmatched-wa-badge');
      if (badge) {
        if (unmatchedList.length > 0) {
          badge.textContent = unmatchedList.length;
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
          <span>Cargando mensajes no asignados...</span>
        </div>
      `;
      return;
    }

    let listHtml = '';
    if (unmatchedList.length === 0) {
      listHtml = `
        <div class="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400 italic border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/30">
          <svg class="w-10 h-10 text-neutral-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-medium text-xs">¡Excelente! No hay mensajes de WhatsApp pendientes sin asignar.</span>
        </div>
      `;
    } else {
      listHtml = `
        <div class="grid grid-cols-1 gap-4">
          ${unmatchedList.map(msg => `
            <div class="border border-[#d9d9dd] rounded-md p-4 bg-white hover:border-primary/40 transition-all flex flex-col gap-3 shadow-xs">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                    💬
                  </div>
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-primary text-xs">${msg.sender_name || 'WhatsApp User'}</span>
                      <span class="font-mono text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">${msg.sender_phone}</span>
                    </div>
                    <span class="text-[9px] text-neutral-400 font-mono">Recibido: ${formatDateTime(msg.received_at)}</span>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-2 self-end sm:self-auto">
                  <button data-associate-msg-id="${msg.id}" type="button" class="px-3 py-1.5 bg-primary hover:bg-cohere-black text-white text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-all cursor-pointer">
                    🔗 Asociar a Lead
                  </button>
                  <button data-create-lead-msg-id="${msg.id}" type="button" class="px-3 py-1.5 border border-[#d9d9dd] hover:border-emerald-600 hover:text-emerald-600 text-neutral-700 text-[9px] font-mono font-bold uppercase rounded-full bg-white transition-all cursor-pointer">
                    ➕ Crear Lead
                  </button>
                  <button data-dismiss-msg-id="${msg.id}" type="button" class="px-2 py-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-full text-xs transition-colors cursor-pointer" title="Descartar mensaje">
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Message Body -->
              <div class="bg-[#f0f2f5] p-3 rounded-lg border border-neutral-200/60">
                <p class="text-neutral-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">${msg.body || 'Sin texto'}</p>
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

    // Attach event listeners for actions
    container.querySelectorAll('[data-associate-msg-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.associateMsgId;
        const msg = unmatchedList.find(m => m.id === msgId);
        if (msg) openAssociateModal(msg);
      });
    });

    container.querySelectorAll('[data-create-lead-msg-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.createLeadMsgId;
        const msg = unmatchedList.find(m => m.id === msgId);
        if (msg) openCreateLeadModal(msg);
      });
    });

    container.querySelectorAll('[data-dismiss-msg-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.dismissMsgId;
        dismissMessage(msgId);
      });
    });
  }

  // Modal 1: Associate with existing lead
  function openAssociateModal(msg) {
    const leads = cache.leads || [];
    let selectedLeadId = null;

    const modalContent = document.createElement('div');
    modalContent.className = 'flex flex-col gap-4 select-none text-xs font-sans';

    modalContent.innerHTML = `
      <div class="bg-neutral-50 p-3 rounded border border-neutral-200 flex flex-col gap-1">
        <span class="font-mono text-[9px] font-bold text-neutral-400 uppercase">Mensaje a asociar</span>
        <span class="font-bold text-primary">${msg.sender_name} (${msg.sender_phone})</span>
        <p class="text-neutral-600 text-[11px] italic mt-0.5">"${msg.body}"</p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="search-lead-input" class="font-mono text-[9px] font-bold text-primary uppercase">Buscar Lead / Empresa</label>
        <input type="text" id="search-lead-input" class="cohere-input text-xs w-full" placeholder="Escribe el nombre de la empresa..." />
      </div>

      <div id="leads-results-list" class="max-h-[220px] overflow-y-auto flex flex-col gap-1 border border-neutral-200 rounded p-1">
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
      title: 'Asociar Mensaje a Lead',
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
              // 1. Insert into whatsapp_messages
              await supabase.from('whatsapp_messages').insert({
                lead_id: selectedLeadId,
                phone_number_id: msg.phone_number_id || null,
                direction: 'inbound',
                recipient_phone: msg.sender_phone,
                body: msg.body,
                status: 'received',
                sent_at: msg.received_at || new Date().toISOString()
              });

              // 2. Insert into lead_interactions
              await supabase.from('lead_interactions').insert({
                lead_id: selectedLeadId,
                contact_type: 'whatsapp',
                direction: 'inbound',
                subject: 'Respuesta WhatsApp (Asociado)',
                body: msg.body,
                contacted_at: msg.received_at || new Date().toISOString()
              });

              // 3. Mark as assigned in whatsapp_unmatched_messages
              await supabase
                .from('whatsapp_unmatched_messages')
                .update({
                  is_assigned: true,
                  assigned_lead_id: selectedLeadId
                })
                .eq('id', msg.id);

              toast.show('Mensaje asociado con éxito al lead', 'success');
              closeSubModal();
              loadUnmatchedMessages();
            } catch (err) {
              console.error('Error associating message:', err);
              toast.show('Error al asociar el mensaje: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  }

  // Modal 2: Create new lead and associate
  function openCreateLeadModal(msg) {
    const form = document.createElement('form');
    form.className = 'flex flex-col gap-3.5 select-none text-xs font-sans';
    form.innerHTML = `
      <div class="bg-neutral-50 p-3 rounded border border-neutral-200 flex flex-col gap-1">
        <span class="font-mono text-[9px] font-bold text-neutral-400 uppercase">Mensaje recibido</span>
        <span class="font-bold text-primary">${msg.sender_name} (${msg.sender_phone})</span>
      </div>

      <div class="flex flex-col gap-1">
        <label for="new-lead-company" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre Empresa / Marca *</label>
        <input type="text" id="new-lead-company" name="company" required class="cohere-input text-xs w-full" placeholder="Ej: Café Martínez (Sucursal Centro)" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label for="new-contact-firstname" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre Contacto</label>
          <input type="text" id="new-contact-firstname" name="first_name" value="${msg.sender_name || ''}" class="cohere-input text-xs w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="new-contact-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono Contacto *</label>
          <input type="text" id="new-contact-phone" name="phone" value="${msg.sender_phone || ''}" required class="cohere-input text-xs w-full" />
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

              // 5. Insert into whatsapp_messages & lead_interactions
              await supabase.from('whatsapp_messages').insert({
                lead_id: newLead.id,
                contact_id: newContact.id,
                phone_number_id: msg.phone_number_id || null,
                direction: 'inbound',
                recipient_phone: phone,
                body: msg.body,
                status: 'received',
                sent_at: msg.received_at || new Date().toISOString()
              });

              await supabase.from('lead_interactions').insert({
                lead_id: newLead.id,
                contact_type: 'whatsapp',
                direction: 'inbound',
                subject: 'Primer contacto WhatsApp',
                body: msg.body,
                contacted_at: msg.received_at || new Date().toISOString()
              });

              // 6. Mark unmatched message as assigned
              await supabase
                .from('whatsapp_unmatched_messages')
                .update({
                  is_assigned: true,
                  assigned_lead_id: newLead.id
                })
                .eq('id', msg.id);

              toast.show('Nuevo lead creado y mensaje asociado con éxito', 'success');
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

  // Dismiss message
  async function dismissMessage(msgId) {
    if (!confirm('¿Deseas descartar este mensaje de la lista sin asignarlo?')) return;
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
