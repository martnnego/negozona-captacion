import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { auth } from '../lib/auth';
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
    <!-- SalesQL Enrichment Banner -->
    ${cache.isSalesqlEnabled() ? `
    <div class="mb-4 bg-indigo-50/60 border border-indigo-200/80 rounded-sm p-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="text-sm">✨</span>
        <div class="flex flex-col">
          <span class="font-mono text-[9px] font-bold text-indigo-950 uppercase tracking-wider">Enriquecer Contacto con SalesQL</span>
          <span class="text-[10px] text-indigo-800">Busca teléfonos validados, emails directos y cargo actualizados.</span>
        </div>
      </div>
      <button type="button" id="btn-enrich-contact-salesql" class="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer shrink-0">
        Enriquecer
      </button>
    </div>
    ` : ''}

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

  // SalesQL Contact Enrichment handler
  const btnEnrichContact = formWrapper.querySelector('#btn-enrich-contact-salesql');
  if (btnEnrichContact) {
    btnEnrichContact.addEventListener('click', () => {
      const allLinks = cache.links || [];
      const link = allLinks.find(l => l.contact_id === contact.id);
      const lead = link ? (cache.getLeads() || []).find(ld => ld.id === link.lead_id) : null;
      const defaultCompany = lead?.company || '';

      modal.create({
        title: `Enriquecer Contacto con SalesQL`,
        content: `
          <div class="flex flex-col gap-4 font-sans text-xs">
            <div class="bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-sm p-3 text-[11px] leading-relaxed">
              💡 <b>Nota:</b> Si SalesQL encuentra datos coincidentes, se descontará 1 crédito de tu bolsa. Las consultas sin resultados no consumen créditos.
            </div>

            <form id="salesql-contact-enrich-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-3.5 rounded-sm border border-neutral-200">
              <div class="sm:col-span-2 flex flex-col gap-1">
                <label class="font-mono text-[9px] font-bold text-primary uppercase">URL de LinkedIn (Recomendado)</label>
                <input type="text" id="sq-c-linkedin" value="${contact.linkedin_url || ''}" placeholder="https://www.linkedin.com/in/..." class="cohere-input text-xs" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-mono text-[9px] font-bold text-primary uppercase">Email</label>
                <input type="email" id="sq-c-email" value="${contact.email || ''}" placeholder="contacto@empresa.com" class="cohere-input text-xs" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-mono text-[9px] font-bold text-primary uppercase">Empresa o Dominio</label>
                <input type="text" id="sq-c-company" value="${defaultCompany}" placeholder="Empresa o dominio.com" class="cohere-input text-xs" />
              </div>
              <div class="sm:col-span-2 flex justify-end pt-1">
                <button type="submit" id="btn-run-c-enrich" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white font-mono text-[10px] font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer flex items-center gap-1.5">
                  🔍 Consultar SalesQL
                </button>
              </div>
            </form>

            <div id="sq-c-result-container" class="min-h-[60px] flex items-center justify-center text-neutral-400 text-[11px]">
              Ingresa los datos arriba y presiona "Consultar SalesQL" para buscar.
            </div>
          </div>
        `,
        actions: [{ text: 'Cerrar', primary: false }]
      });

      const modalEl = document.querySelector('.modal-overlay') || document;
      const cForm = modalEl.querySelector('#salesql-contact-enrich-form');
      const resContainer = modalEl.querySelector('#sq-c-result-container');

      cForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const linkedin = modalEl.querySelector('#sq-c-linkedin').value.trim();
        const email = modalEl.querySelector('#sq-c-email').value.trim();
        const company = modalEl.querySelector('#sq-c-company').value.trim();
        const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

        if (!linkedin && !email && (!fullName || !company)) {
          toast.show('Por favor proporciona al menos LinkedIn, email o nombre y empresa', 'error');
          return;
        }

        const btnRun = modalEl.querySelector('#btn-run-c-enrich');
        btnRun.disabled = true;
        btnRun.innerHTML = '<span class="animate-spin inline-block">🔄</span> Consultando...';
        resContainer.innerHTML = `
          <div class="flex flex-col items-center gap-2 py-6 text-neutral-500">
            <svg class="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="font-mono text-[10px] uppercase font-bold">Consultando API de SalesQL...</span>
          </div>
        `;

        try {
          const session = await auth.getSession();
          const jwt = session?.access_token;
          let payload = {};

          if (linkedin) {
            payload = { action: 'enrich-person', linkedin_url: linkedin };
          } else if (email) {
            payload = { action: 'email-lookup', email: email };
          } else {
            const isDomain = company.includes('.');
            payload = {
              action: 'enrich-person',
              full_name: fullName,
              organization_domain: isDomain ? company : undefined,
              organization_name: !isDomain ? company : undefined
            };
          }

          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/salesql-proxy`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const resData = await res.json();
          if (res.ok && resData.success && resData.data) {
            renderContactDiffTable(resContainer, contact, resData.data, form, modalEl);
          } else if (resData.not_found || res.status === 404) {
            resContainer.innerHTML = `
              <div class="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm text-center w-full">
                ⚠️ No se encontraron datos para este contacto en SalesQL. No se descontaron créditos.
              </div>
            `;
          } else if (resData.is_rate_limit || resData.status === 429 || res.status === 429) {
            resContainer.innerHTML = `
              <div class="p-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-sm flex flex-col gap-2 w-full text-left">
                <div class="font-bold flex items-center gap-1.5 text-xs">
                  <span>⚠️</span>
                  <span>Límite de API / Créditos de SalesQL (Error 429)</span>
                </div>
                <p class="text-[11px] text-amber-800 leading-relaxed">
                  ${resData.error || 'Se alcanzó el límite de solicitudes o créditos de tu cuenta en SalesQL.'}
                </p>
                <p class="text-[11px] text-amber-800 leading-relaxed">
                  SalesQL devuelve <b>"Rate limit exceeded"</b> cuando se supera el límite de llamadas por minuto o la cuota diaria de tu plan, o si tu cuenta no dispone de créditos de persona.
                </p>
                <div class="pt-1">
                  <a href="https://salesql.com" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 rounded-full font-mono text-[10px] font-bold transition-colors">
                    Revisar cuenta en salesql.com ↗
                  </a>
                </div>
              </div>
            `;
          } else {
            resContainer.innerHTML = `
              <div class="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-sm text-center w-full">
                ❌ Error: ${resData.error || 'No se pudo completar la consulta'}
              </div>
            `;
          }
        } catch (err) {
          console.error(err);
          resContainer.innerHTML = `<div class="p-3 text-rose-600">Error de conexión: ${err.message}</div>`;
        } finally {
          btnRun.disabled = false;
          btnRun.innerHTML = '🔍 Consultar SalesQL';
        }
      });
    });
  }

  function renderContactDiffTable(containerEl, currentContact, sqData, mainForm, subModalEl) {
    const suggestedPosition = sqData.title || sqData.headline || '';
    const suggestedEmails = Array.isArray(sqData.emails) ? sqData.emails : [];
    const validEmailObj = suggestedEmails.find(e => (e.status || '').toLowerCase() === 'valid') || suggestedEmails[0];
    const suggestedEmail = validEmailObj?.email || '';

    const suggestedPhones = Array.isArray(sqData.phones) ? sqData.phones : [];
    const validPhoneObj = suggestedPhones.find(p => p.is_valid !== false) || suggestedPhones[0];
    const suggestedPhone = validPhoneObj?.phone || '';
    const isPhoneValid = validPhoneObj ? validPhoneObj.is_valid !== false : false;

    const suggestedLinkedin = sqData.linkedin_url || '';

    const checkPosition = !currentContact.position && !!suggestedPosition;
    const checkEmail = !currentContact.email && !!suggestedEmail;
    const checkPhone = !currentContact.phone && !!suggestedPhone;
    const checkLinkedin = !currentContact.linkedin_url && !!suggestedLinkedin;

    containerEl.innerHTML = `
      <div class="flex flex-col gap-4 border-t border-neutral-200 pt-4 animate-fade-in w-full">
        <div class="flex items-center justify-between">
          <span class="font-mono text-[10px] font-bold text-primary uppercase tracking-wider">
            Comparativa de Datos (Dato Actual vs SalesQL)
          </span>
          <span class="text-[10px] text-muted-slate italic">
            Selecciona qué campos deseas aplicar al formulario
          </span>
        </div>

        <div class="border border-neutral-200 rounded-sm overflow-hidden">
          <table class="w-full text-left font-sans text-xs">
            <thead class="bg-neutral-50 text-[9px] font-mono font-bold text-muted-slate uppercase border-b border-neutral-200">
              <tr>
                <th class="p-2.5">Campo</th>
                <th class="p-2.5">Dato Actual</th>
                <th class="p-2.5">Dato SalesQL</th>
                <th class="p-2.5 text-center">Actualizar</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr class="hover:bg-neutral-50/50">
                <td class="p-2.5 font-bold text-neutral-600 font-mono text-[10px]">Cargo</td>
                <td class="p-2.5 text-neutral-500">${currentContact.position || '<span class="text-neutral-300 italic">Vacío</span>'}</td>
                <td class="p-2.5 text-primary font-semibold">${suggestedPosition || '<span class="text-neutral-300 italic">No encontrado</span>'}</td>
                <td class="p-2.5 text-center">
                  <input type="checkbox" id="diff-chk-position" ${checkPosition ? 'checked' : ''} ${!suggestedPosition ? 'disabled' : ''} class="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer" />
                </td>
              </tr>
              <tr class="hover:bg-neutral-50/50">
                <td class="p-2.5 font-bold text-neutral-600 font-mono text-[10px]">Email</td>
                <td class="p-2.5 text-neutral-500 select-all">${currentContact.email || '<span class="text-neutral-300 italic">Vacío</span>'}</td>
                <td class="p-2.5 text-primary font-semibold select-all">
                  ${suggestedEmail ? `
                    <span>${suggestedEmail}</span>
                    <span class="ml-1 text-[8px] font-mono px-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">${validEmailObj?.status || 'Email'}</span>
                  ` : '<span class="text-neutral-300 italic">No encontrado</span>'}
                </td>
                <td class="p-2.5 text-center">
                  <input type="checkbox" id="diff-chk-email" ${checkEmail ? 'checked' : ''} ${!suggestedEmail ? 'disabled' : ''} class="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer" />
                </td>
              </tr>
              <tr class="hover:bg-neutral-50/50">
                <td class="p-2.5 font-bold text-neutral-600 font-mono text-[10px]">Teléfono</td>
                <td class="p-2.5 text-neutral-500 select-all">${currentContact.phone || '<span class="text-neutral-300 italic">Vacío</span>'}</td>
                <td class="p-2.5 text-primary font-semibold select-all">
                  ${suggestedPhone ? `
                    <span>${suggestedPhone}</span>
                    <span class="ml-1 text-[8px] font-mono px-1 rounded-full ${isPhoneValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600'}">
                      ${isPhoneValid ? 'Validado' : 'Directo'}
                    </span>
                  ` : '<span class="text-neutral-300 italic">No encontrado</span>'}
                </td>
                <td class="p-2.5 text-center">
                  <input type="checkbox" id="diff-chk-phone" ${checkPhone ? 'checked' : ''} ${!suggestedPhone ? 'disabled' : ''} class="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer" />
                </td>
              </tr>
              <tr class="hover:bg-neutral-50/50">
                <td class="p-2.5 font-bold text-neutral-600 font-mono text-[10px]">LinkedIn URL</td>
                <td class="p-2.5 text-neutral-500 truncate max-w-[120px]">${currentContact.linkedin_url || '<span class="text-neutral-300 italic">Vacío</span>'}</td>
                <td class="p-2.5 text-primary font-semibold truncate max-w-[140px]">${suggestedLinkedin || '<span class="text-neutral-300 italic">No encontrado</span>'}</td>
                <td class="p-2.5 text-center">
                  <input type="checkbox" id="diff-chk-linkedin" ${checkLinkedin ? 'checked' : ''} ${!suggestedLinkedin ? 'disabled' : ''} class="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button type="button" id="btn-apply-c-diff" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer flex items-center gap-1.5">
            ✓ Aplicar Cambios al Formulario
          </button>
        </div>
      </div>
    `;

    const btnApply = containerEl.querySelector('#btn-apply-c-diff');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const applyPos = containerEl.querySelector('#diff-chk-position')?.checked;
        const applyEmail = containerEl.querySelector('#diff-chk-email')?.checked;
        const applyPhone = containerEl.querySelector('#diff-chk-phone')?.checked;
        const applyLinkedin = containerEl.querySelector('#diff-chk-linkedin')?.checked;

        if (applyPos && suggestedPosition) {
          const inpPos = mainForm.querySelector('#edit-c-position');
          if (inpPos) inpPos.value = suggestedPosition;
        }
        if (applyEmail && suggestedEmail) {
          const inpEmail = mainForm.querySelector('#edit-c-email');
          if (inpEmail) inpEmail.value = suggestedEmail;
        }
        if (applyPhone && suggestedPhone) {
          const inpPhone = mainForm.querySelector('#edit-c-phone');
          if (inpPhone) inpPhone.value = suggestedPhone;

          const chkValid = mainForm.querySelector('#edit-c-phone-valid');
          const lblValid = mainForm.querySelector('#edit-c-phone-valid-label');
          if (chkValid) {
            chkValid.checked = isPhoneValid;
            if (lblValid) lblValid.textContent = isPhoneValid ? 'Validado' : 'No Validado';
          }
        }
        if (applyLinkedin && suggestedLinkedin) {
          const inpLinkedin = mainForm.querySelector('#edit-c-linkedin');
          if (inpLinkedin) inpLinkedin.value = suggestedLinkedin;
        }

        toast.show('Datos aplicados al formulario. Haz clic en "Guardar cambios" para confirmarlos.', 'success');
        const modalInstance = modal.getActiveModals ? modal.getActiveModals().slice(-1)[0] : null;
        if (modalInstance && typeof modalInstance.close === 'function') {
          modalInstance.close();
        } else {
          const closeBtn = subModalEl.querySelector('.modal-close') || subModalEl.querySelector('#btn-close-modal');
          if (closeBtn) closeBtn.click();
        }
      });
    }
  }

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
        let allowlistCount = 0;
        try {
          const allowRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist?phone_number_id=${num.id}`, { headers });
          if (allowRes.ok) {
            const allowList = await allowRes.json();
            const entries = Array.isArray(allowList) ? allowList : (allowList.data || []);
            allowlistCount = entries.length;
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
        const isQuotaFull = allowlistCount >= 20 && !isAllowlisted;

        html += `
          <div class="flex flex-col gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-sm">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5">
                <span class="font-mono text-[10px] font-bold text-primary">${num.display_phone_number} ${num.verified_name ? `(${num.verified_name})` : ''}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[9px] text-neutral-500 font-mono">Estado Agente: <strong class="${num.agent_status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}">${num.agent_status || 'Elegible'}</strong></span>
                  <span class="text-[8px] font-mono px-1.5 py-0.2 rounded-full ${allowlistCount >= 20 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-neutral-200 text-neutral-600'}">Cupo Meta: ${allowlistCount}/20</span>
                </div>
              </div>
              <label class="relative inline-flex items-center ${isQuotaFull ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
                <input type="checkbox" data-waba-id="${num.id}" class="sr-only peer allowlist-toggle-input" ${isAllowlisted ? 'checked' : ''} ${isQuotaFull ? 'disabled' : ''} />
                <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                <span class="ml-2 text-[9px] font-mono font-bold uppercase text-neutral-600 allowlist-toggle-label">
                  ${isAllowlisted ? 'Habilitado' : (isQuotaFull ? 'Cupo Lleno (20/20)' : 'Deshabilitado')}
                </span>
              </label>
            </div>
            ${isQuotaFull ? `
              <div class="p-1.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[9px] leading-tight flex items-center gap-1">
                <span>⚠️</span>
                <span>Cupo máximo alcanzado (20 de 20). Para habilitar este número, libera un espacio desde <strong>Configuración > WhatsApp Cloud API > Agente > Lista Blanca</strong>.</span>
              </div>
            ` : ''}
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
              let res;
              if (isChecked) {
                res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist`, {
                  method: 'POST',
                  headers: apiHeaders,
                  body: JSON.stringify({ phone_number_id: wabaId, consumer_phone_number: currentPhone })
                });
              } else {
                res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist`, {
                  method: 'DELETE',
                  headers: apiHeaders,
                  body: JSON.stringify({ phone_number_id: wabaId, consumer_phone_number: currentPhone })
                });
              }

              if (res && !res.ok) {
                const resErr = await res.json().catch(() => ({}));
                const msg = resErr.detail || resErr.error?.message || resErr.title || resErr.error || 'Error al comunicar con Meta';
                toast.show(`Aviso Lista Blanca (${isChecked ? 'activar' : 'desactivar'}): ${msg}`, 'warning');
              }
            } catch (err) {
              console.error(`Error updating allowlist for WABA ${wabaId}:`, err);
              toast.show(`Error al sincronizar con Meta: ${err.message}`, 'error');
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
