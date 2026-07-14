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
