import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { modal } from './modal';
import { toast } from './toast';

export function openContactEditModal(contactId, onSave) {
  const contact = cache.getContact(contactId);
  if (!contact) {
    toast.show('No se encontró el contacto en la caché', 'error');
    return;
  }

  const formWrapper = document.createElement('div');
  formWrapper.className = 'font-sans text-xs select-none';
  formWrapper.innerHTML = `
    <form id="contact-edit-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
      <div class="flex flex-col gap-1">
        <label for="edit-c-first-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre *</label>
        <input type="text" id="edit-c-first-name" name="first_name" required value="${contact.first_name || ''}" class="cohere-input text-xs" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="edit-c-last-name" class="font-mono text-[9px] font-bold text-primary uppercase">Apellido *</label>
        <input type="text" id="edit-c-last-name" name="last_name" required value="${contact.last_name || ''}" class="cohere-input text-xs" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="edit-c-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email</label>
        <input type="email" id="edit-c-email" name="email" value="${contact.email || ''}" class="cohere-input text-xs" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="edit-c-phone" class="font-mono text-[9px] font-bold text-primary uppercase">Teléfono</label>
        <input type="text" id="edit-c-phone" name="phone" value="${contact.phone || ''}" class="cohere-input text-xs" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="edit-c-position" class="font-mono text-[9px] font-bold text-primary uppercase">Cargo</label>
        <input type="text" id="edit-c-position" name="position" value="${contact.position || ''}" class="cohere-input text-xs" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="edit-c-linkedin" class="font-mono text-[9px] font-bold text-primary uppercase">LinkedIn URL</label>
        <input type="text" id="edit-c-linkedin" name="linkedin_url" value="${contact.linkedin_url || ''}" class="cohere-input text-xs" />
      </div>
      <div class="flex flex-col gap-1">
        <label for="edit-c-medio" class="font-mono text-[9px] font-bold text-primary uppercase">Medio de Contacto Preferido</label>
        <select id="edit-c-medio" name="medio_contacto" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          <option value="">Seleccionar medio</option>
          ${['whatsapp', 'email', 'telefono', 'linkedin', 'meet', 'otro'].map(m => `
            <option value="${m}" ${contact.medio_contacto === m ? 'selected' : ''}>${m.toUpperCase()}</option>
          `).join('')}
        </select>
      </div>

      <!-- State Toggle -->
      <div class="flex items-center gap-3 mt-4 sm:col-span-2">
        <span class="font-mono text-[9px] font-bold text-primary uppercase">Estado del contacto</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="edit-c-active" name="is_active" class="sr-only peer" ${contact.is_active ? 'checked' : ''} />
          <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
          <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-slate" id="edit-c-active-label">
            ${contact.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </label>
      </div>

      <!-- Phone Validation Toggle -->
      <div class="flex items-center gap-3 mt-2 sm:col-span-2">
        <span class="font-mono text-[9px] font-bold text-primary uppercase">Validación de teléfono</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" id="edit-c-phone-valid" name="telefono_validado" class="sr-only peer" ${contact.telefono_validado ? 'checked' : ''} />
          <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
          <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-muted-slate" id="edit-c-phone-valid-label">
            ${contact.telefono_validado ? 'Validado' : 'No Validado'}
          </span>
        </label>
      </div>

      <!-- WhatsApp Agent Allowlist Toggle Section -->
      <div id="allowlist-agents-container" class="sm:col-span-2 mt-2 pt-3 border-t border-neutral-200">
        <div class="flex items-center gap-2 text-neutral-400 py-1 text-[10px]">
          <span class="animate-pulse">🔄</span> Cargando estado del contacto en Lista Blanca de Agentes...
        </div>
      </div>

      <div class="sm:col-span-2 flex items-center justify-end gap-3 mt-6 border-t border-neutral-100 pt-4">
        <button type="button" id="btn-cancel-edit" class="px-5 py-2 text-neutral-600 hover:text-primary font-mono text-[10px] font-bold uppercase">
          Cancelar
        </button>
        <button type="submit" id="btn-save-contact" class="px-6 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors">
          Guardar cambios
        </button>
      </div>
    </form>
  `;

  const editModal = modal.create({
    title: `Editar Contacto: ${contact.first_name || ''} ${contact.last_name || ''}`,
    content: formWrapper
  });

  const form = formWrapper.querySelector('#contact-edit-form');
  const activeToggle = form.querySelector('#edit-c-active');
  const activeLabel = form.querySelector('#edit-c-active-label');
  const phoneValidToggle = form.querySelector('#edit-c-phone-valid');
  const phoneValidLabel = form.querySelector('#edit-c-phone-valid-label');
  const allowlistContainer = form.querySelector('#allowlist-agents-container');

  const initialAllowlistStates = new Map();

  async function loadAllowlistSection() {
    if (!contact.phone) {
      allowlistContainer.innerHTML = `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-sm text-amber-800 text-[10px] font-mono">
          ℹ️ Ingresa un número de teléfono para gestionar la habilitación en la Lista Blanca del Agente de WhatsApp.
        </div>
      `;
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      const headers = { 'Authorization': `Bearer ${jwt}` };

      const numRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/numbers`, { headers });
      const numData = await numRes.json();
      const numbers = (numData.data || []).filter(n => n.is_eligible_agent || n.agent_status === 'ACTIVE' || n.agent_status === 'ELIGIBLE');

      if (numbers.length === 0) {
        allowlistContainer.innerHTML = `
          <div class="p-2 bg-neutral-50 border border-neutral-200 text-neutral-500 text-[10px] font-mono">
            No hay números de WhatsApp con Agente de IA configurados.
          </div>
        `;
        return;
      }

      const cleanContactPhone = contact.phone.replace(/[^\d]/g, '');

      let html = `
        <div class="flex flex-col gap-2 select-none">
          <div class="flex flex-col gap-1">
            <span class="font-mono text-[9px] font-bold text-primary uppercase">Habilitación de Agentes de WhatsApp (Lista Blanca / AI Audience)</span>
            <p class="text-[9px] text-neutral-500 font-sans leading-normal bg-blue-50/80 border border-blue-200/60 p-2 rounded-sm">
              ℹ️ <strong>Nota:</strong> Si la audiencia del agente está configurada en <strong>Todos (EVERYONE)</strong> en Ajustes Principales, la IA responderá a cualquier usuario. La Lista Blanca se aplica estrictamente cuando la audiencia se establece en <strong>Solo Lista Blanca (ALLOWLISTED_ONLY)</strong>.
            </p>
          </div>
      `;

      for (const num of numbers) {
        let isAllowlisted = false;
        try {
          const allowRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist?phone_number_id=${num.id}`, { headers });
          if (allowRes.ok) {
            const allowList = await allowRes.json();
            const entries = Array.isArray(allowList) ? allowList : (allowList.data || []);
            isAllowlisted = entries.some(e => {
              if (!e.consumer_phone_number) return false;
              const cleanEntry = String(e.consumer_phone_number).replace(/[^\d]/g, '');
              return cleanEntry === cleanContactPhone;
            });
          }
        } catch (e) {
          console.error(`Error checking allowlist for number ${num.id}:`, e);
        }

        initialAllowlistStates.set(num.id, isAllowlisted);

        html += `
          <div class="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-200 rounded-sm">
            <div class="flex flex-col gap-0.5">
              <span class="font-mono text-[10px] font-bold text-primary">${num.display_phone_number} ${num.verified_name ? `(${num.verified_name})` : ''}</span>
              <span class="text-[9px] text-neutral-500 font-mono">Estado Agente: <strong class="${num.agent_status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}">${num.agent_status || 'Elegible'}</strong></span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" data-waba-id="${num.id}" class="sr-only peer allowlist-toggle-input" ${isAllowlisted ? 'checked' : ''} />
              <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
              <span class="ml-2 text-[9px] font-mono font-bold uppercase text-neutral-600 allowlist-toggle-label">
                ${isAllowlisted ? 'Habilitado' : 'Deshabilitado'}
              </span>
            </label>
          </div>
        `;
      }

      html += `</div>`;
      allowlistContainer.innerHTML = html;

      allowlistContainer.querySelectorAll('.allowlist-toggle-input').forEach(input => {
        input.addEventListener('change', () => {
          const label = input.parentElement.querySelector('.allowlist-toggle-label');
          if (label) label.textContent = input.checked ? 'Habilitado' : 'Deshabilitado';
        });
      });

    } catch (err) {
      allowlistContainer.innerHTML = `<span class="text-rose-600 text-[10px]">Error al cargar estado de lista blanca: ${err.message}</span>`;
    }
  }

  loadAllowlistSection();

  activeToggle.addEventListener('change', () => {
    activeLabel.textContent = activeToggle.checked ? 'Activo' : 'Inactivo';
  });

  phoneValidToggle.addEventListener('change', () => {
    phoneValidLabel.textContent = phoneValidToggle.checked ? 'Validado' : 'No Validado';
  });

  formWrapper.querySelector('#btn-cancel-edit').addEventListener('click', () => {
    editModal.close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('#btn-save-contact');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const formData = new FormData(form);
    const updatedFields = {
      first_name: formData.get('first_name').trim(),
      last_name: formData.get('last_name').trim(),
      email: formData.get('email').trim() || null,
      phone: formData.get('phone').trim() || null,
      position: formData.get('position').trim() || null,
      linkedin_url: formData.get('linkedin_url').trim() || null,
      medio_contacto: formData.get('medio_contacto') || null,
      is_active: activeToggle.checked,
      telefono_validado: phoneValidToggle.checked
    };

    try {
      const { data, error } = await supabase
        .from('contacts')
        .update(updatedFields)
        .eq('id', contact.id)
        .select()
        .single();

      if (error) throw error;

      // Sync Allowlist changes with Meta API
      const currentPhone = updatedFields.phone;
      if (currentPhone) {
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;
        const apiHeaders = { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' };

        const toggleInputs = formWrapper.querySelectorAll('.allowlist-toggle-input');
        for (const input of toggleInputs) {
          const wabaId = input.dataset.wabaId;
          const isChecked = input.checked;
          const wasChecked = initialAllowlistStates.get(wabaId) || false;

          if (isChecked !== wasChecked) {
            try {
              if (isChecked) {
                await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist`, {
                  method: 'POST',
                  headers: apiHeaders,
                  body: JSON.stringify({ phone_number_id: wabaId, consumer_phone_number: currentPhone })
                });
              } else {
                await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist`, {
                  method: 'DELETE',
                  headers: apiHeaders,
                  body: JSON.stringify({ phone_number_id: wabaId, consumer_phone_number: currentPhone })
                });
              }
            } catch (err) {
              console.error(`Error updating allowlist for WABA ${wabaId}:`, err);
            }
          }
        }
      }

      cache.updateContact(data);
      toast.show('Datos del contacto actualizados correctamente', 'success');
      editModal.close();
      if (onSave) onSave(data);
    } catch (err) {
      toast.show('Error al guardar contacto: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
    }
  });
}
