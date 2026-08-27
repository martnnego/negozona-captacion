import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { toast } from './toast';

/**
 * Drawer lateral para configurar las propiedades de un paso en el flujo de automatización.
 * @param {Object} options
 * @param {Object} [options.step] - Paso existente si se está editando
 * @param {string} [options.defaultType] - Tipo de paso predeterminado si es nuevo
 * @param {Function} options.onSave - Callback al guardar (recibe el objeto stepData)
 */
export async function openAutomationStepDrawer({ step = null, defaultType = 'send_whatsapp', onSave }) {
  // Remove existing drawer if open
  const existing = document.getElementById('automation-step-drawer-container');
  if (existing) existing.remove();

  const isEditing = !!step;
  let currentStepType = step?.step_type || defaultType;
  let currentConfig = step?.config ? JSON.parse(JSON.stringify(step.config)) : {};
  let stepName = step?.name || '';

  // Cached collections
  let metaTemplates = [];
  let emailTemplates = [];
  let whatsappNumbers = [];
  let senderProfiles = [];

  // WhatsApp Header Media state
  let headerMediaFile = null;
  let headerMediaUrl = currentConfig.header_media_url || '';

  // Email Attachments state
  let emailAttachments = Array.isArray(currentConfig.attachments) ? [...currentConfig.attachments] : [];

  const container = document.createElement('div');
  container.id = 'automation-step-drawer-container';
  container.className = 'fixed inset-0 z-50 overflow-hidden font-sans';

  container.innerHTML = `
    <!-- Backdrop -->
    <div id="drawer-backdrop" class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"></div>

    <!-- Slide Panel -->
    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div class="w-screen max-w-xl bg-white shadow-2xl border-l border-neutral-200 flex flex-col transform transition-transform duration-300 animate-slide-left">
        
        <!-- Header -->
        <div class="px-6 py-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold font-display text-neutral-900" id="drawer-title">
              ${isEditing ? 'Editar Paso del Flujo' : 'Nuevo Paso de Automatización'}
            </h3>
            <p class="text-[11px] text-neutral-500 mt-0.5">Configura la acción o espera que se ejecutará en este nodo</p>
          </div>
          <button id="btn-close-drawer" class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer text-base font-mono">
            ✕
          </button>
        </div>

        <!-- Form Body (Scrollable) -->
        <div class="flex-1 overflow-y-auto px-6 py-6 space-y-5 text-xs text-neutral-800">
          
          <!-- Step Type Selector -->
          <div>
            <label class="block font-bold text-neutral-700 mb-1.5 uppercase font-mono text-[10px] tracking-wider">Tipo de Paso</label>
            <div class="grid grid-cols-2 gap-2" id="step-type-selector">
              <button type="button" class="type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${currentStepType === 'send_whatsapp' ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs' : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'}" data-type="send_whatsapp">
                <span class="text-base">💬</span>
                <div>
                  <span class="block">WhatsApp</span>
                  <span class="text-[10px] font-normal text-neutral-400">Plantilla oficial Meta</span>
                </div>
              </button>

              <button type="button" class="type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${currentStepType === 'send_email' ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs' : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'}" data-type="send_email">
                <span class="text-base">✉️</span>
                <div>
                  <span class="block">Email</span>
                  <span class="text-[10px] font-normal text-neutral-400">Plantilla o correo custom</span>
                </div>
              </button>

              <button type="button" class="type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${currentStepType === 'delay' ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs' : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'}" data-type="delay">
                <span class="text-base">⏳</span>
                <div>
                  <span class="block">Espera (Delay)</span>
                  <span class="text-[10px] font-normal text-neutral-400">Pausar X tiempo</span>
                </div>
              </button>

              <button type="button" class="type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${currentStepType === 'change_stage' ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs' : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'}" data-type="change_stage">
                <span class="text-base">🗂️</span>
                <div>
                  <span class="block">Cambiar Etapa</span>
                  <span class="text-[10px] font-normal text-neutral-400">Mover en Pipeline</span>
                </div>
              </button>

              <button type="button" class="type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer col-span-2 ${currentStepType === 'add_comment' ? 'border-primary bg-primary/5 text-primary font-bold shadow-xs' : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'}" data-type="add_comment">
                <span class="text-base">📝</span>
                <div>
                  <span class="block">Comentario Interno</span>
                  <span class="text-[10px] font-normal text-neutral-400">Registrar nota en la ficha del lead</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Step Name Input -->
          <div>
            <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Nombre del Paso (Opcional)</label>
            <input type="text" id="input-step-name" class="cohere-input text-xs w-full" placeholder="Ej: Enviar WhatsApp de Bienvenida" value="${stepName}" />
          </div>

          <hr class="border-neutral-200 my-4" />

          <!-- Dynamic Config Area Based on Step Type -->
          <div id="step-config-dynamic-area" class="space-y-4">
            <div class="py-6 text-center text-neutral-400 animate-pulse font-mono text-xs">🔄 Cargando opciones...</div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <button type="button" id="btn-cancel-drawer" class="px-4 py-2 text-xs font-mono font-bold text-neutral-600 hover:text-neutral-900 cursor-pointer">
            Cancelar
          </button>
          <button type="button" id="btn-save-step" class="px-6 py-2.5 bg-primary hover:bg-neutral-900 text-white font-mono text-xs font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2">
            <span>💾 Guardar Paso</span>
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Close handlers
  const closeDrawer = () => container.remove();
  container.querySelector('#btn-close-drawer').addEventListener('click', closeDrawer);
  container.querySelector('#btn-cancel-drawer').addEventListener('click', closeDrawer);
  container.querySelector('#drawer-backdrop').addEventListener('click', closeDrawer);

  // Switch step type
  container.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.type-btn').forEach(b => {
        b.className = 'type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer border-neutral-200 hover:border-neutral-300 text-neutral-600';
      });
      btn.className = 'type-btn p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer border-primary bg-primary/5 text-primary font-bold shadow-xs';
      currentStepType = btn.dataset.type;
      renderDynamicConfig();
    });
  });

  // Load prerequisites
  await loadPrerequisites();
  renderDynamicConfig();

  // Save handler
  container.querySelector('#btn-save-step').addEventListener('click', async () => {
    const saveBtn = container.querySelector('#btn-save-step');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    const customName = container.querySelector('#input-step-name').value.trim();
    const configResult = await collectConfigData();

    if (!configResult.valid) {
      toast.show(configResult.error || 'Por favor completa los campos requeridos', 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾 Guardar Paso</span>';
      return;
    }

    const defaultNameMap = {
      send_whatsapp: `WhatsApp: ${configResult.config.template_name || 'Plantilla'}`,
      send_email: `Email: ${configResult.config.subject || 'Notificación'}`,
      delay: `Esperar ${configResult.config.duration} ${configResult.config.unit === 'minutes' ? 'minutos' : configResult.config.unit === 'hours' ? 'horas' : 'días'}`,
      change_stage: 'Cambiar Etapa de Pipeline',
      add_comment: 'Agregar Comentario'
    };

    const finalStepData = {
      id: step?.id || undefined,
      step_type: currentStepType,
      name: customName || defaultNameMap[currentStepType] || 'Paso de flujo',
      config: configResult.config
    };

    onSave(finalStepData);
    closeDrawer();
  });

  async function loadPrerequisites() {
    try {
      // 1. Fetch Email templates
      const { data: eData } = await supabase.from('email_templates').select('*').order('name');
      emailTemplates = eData || [];

      // 2. Fetch WhatsApp Numbers directly from DB
      const { data: numData } = await supabase.from('whatsapp_numbers').select('*').eq('is_active', true);
      whatsappNumbers = numData || [];

      // 3. Fetch Sender Profiles directly from DB
      const { data: profData } = await supabase.from('profiles').select('*').eq('is_active', true);
      const allProfiles = profData && profData.length > 0 ? profData : (cache.getProfiles() || []);
      senderProfiles = allProfiles.filter(p => p.is_mailing_sender);
      if (senderProfiles.length === 0) {
        senderProfiles = allProfiles;
      }

      // 4. Fetch Meta WhatsApp templates via whatsapp-proxy
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        const metaRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/templates`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (metaRes.ok) {
          const resJson = await metaRes.json();
          metaTemplates = (resJson.data || []).filter(t => t.status === 'APPROVED');
        }
      }
    } catch (e) {
      console.error('Error loading step prerequisites:', e);
    }
  }

  function renderDynamicConfig() {
    const dynamicArea = container.querySelector('#step-config-dynamic-area');

    if (currentStepType === 'send_whatsapp') {
      const selectedPhoneId = currentConfig.phone_number_id || (whatsappNumbers[0]?.phone_number_id || '');
      const selectedRecipientMode = currentConfig.recipient_mode || 'primary_only';
      const selectedTmplName = currentConfig.template_name || (metaTemplates[0]?.name || '');
      const selectedTmpl = metaTemplates.find(t => t.name === selectedTmplName);

      const headerMediaComp = selectedTmpl && (selectedTmpl.components || []).find(c => c.type === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(c.format));
      const mediaLabel = headerMediaComp ? (headerMediaComp.format === 'IMAGE' ? 'Imagen' : headerMediaComp.format === 'VIDEO' ? 'Video' : 'Documento') : '';
      const mediaAccept = headerMediaComp ? (headerMediaComp.format === 'IMAGE' ? 'image/*' : headerMediaComp.format === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx,.xlsx') : '';

      dynamicArea.innerHTML = `
        <div class="space-y-4 animate-fade-in">
          
          <!-- Sender & Recipient Section -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
            <!-- WhatsApp Sender Number -->
            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[9px] uppercase tracking-wider">Número Remitente *</label>
              ${whatsappNumbers.length === 0 ? `
                <div class="text-[11px] text-amber-700 font-medium">⚠️ No hay números activos en la configuración</div>
              ` : `
                <select id="select-wa-sender" class="cohere-select text-xs w-full">
                  ${whatsappNumbers.map(n => `
                    <option value="${n.phone_number_id}" ${n.phone_number_id === selectedPhoneId ? 'selected' : ''}>
                      📱 ${n.display_phone_number || n.phone_number || n.phone_number_id} (${n.verified_name || 'Oficial'})
                    </option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- WhatsApp Recipient Mode -->
            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[9px] uppercase tracking-wider">Destinatarios del Paso *</label>
              <select id="select-wa-recipient-mode" class="cohere-select text-xs w-full">
                <option value="execution_contact" ${selectedRecipientMode === 'execution_contact' || !selectedRecipientMode ? 'selected' : ''}>🎯 Contacto de esta ejecución (Recomendado)</option>
                <option value="primary_only" ${selectedRecipientMode === 'primary_only' ? 'selected' : ''}>⭐ Solo contacto principal (omite secundarios)</option>
                <option value="all_contacts" ${selectedRecipientMode === 'all_contacts' ? 'selected' : ''}>👥 Todos los contactos vinculados al lead</option>
              </select>
            </div>
          </div>

          <!-- Template Selection -->
          <div>
            <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Plantilla de WhatsApp (Meta)</label>
            ${metaTemplates.length === 0 ? `
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                ⚠️ No se encontraron plantillas aprobadas o faltan credenciales de WhatsApp en la configuración.
              </div>
            ` : `
              <select id="select-wa-template" class="cohere-select text-xs w-full">
                ${metaTemplates.map(t => `<option value="${t.name}" ${t.name === selectedTmplName ? 'selected' : ''}>${t.name} (${t.language || 'es_AR'})</option>`).join('')}
              </select>
            `}
          </div>

          <!-- Header Media Section -->
          <div id="wa-header-media-section" class="${headerMediaComp ? '' : 'hidden'}">
            <div class="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2.5">
              <label class="text-[10px] font-mono text-neutral-700 font-bold uppercase flex items-center gap-1.5">
                <span>🖼️</span> <span>${mediaLabel} de Encabezado (Requerida por Meta)</span>
              </label>
              
              <div class="space-y-2">
                <div>
                  <span class="text-[9px] text-neutral-500 font-medium block mb-1">Cargar archivo desde tu PC:</span>
                  <input type="file" id="wa-header-file-input" accept="${mediaAccept}" class="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer w-full" />
                </div>
                
                <div class="flex items-center gap-2">
                  <span class="text-[9px] text-neutral-400 uppercase font-bold shrink-0">o URL pública:</span>
                  <input type="url" id="wa-header-url-input" placeholder="https://ejemplo.com/imagen.jpg" class="cohere-input text-xs flex-1 py-1" value="${headerMediaUrl}" />
                </div>
              </div>

              <!-- Media Preview Container -->
              <div id="wa-header-preview-box" class="${headerMediaUrl ? '' : 'hidden'} pt-1">
                <img id="wa-header-img-preview" src="${headerMediaUrl || ''}" alt="Vista previa" class="max-h-32 rounded-lg border border-neutral-200 object-cover shadow-2xs" />
              </div>
            </div>
          </div>

          <!-- Dynamic Variables Mapping (Header & Body) -->
          <div id="wa-variables-container" class="space-y-2">
            <span class="text-[10px] font-mono font-bold text-neutral-700 uppercase block">Mapeo de Variables Dinámicas:</span>
            <div id="wa-variables-list" class="space-y-2.5">
              ${renderTemplateVariablesInputs(selectedTmpl, currentConfig.variable_mappings || {})}
            </div>
          </div>

          <!-- WhatsApp Chat Live Preview Bubble -->
          <div class="p-4 bg-[#e5ddd5] rounded-xl border border-neutral-300">
            <span class="text-[10px] font-mono font-bold text-neutral-600 uppercase block mb-2">Vista Previa WhatsApp (Chat Bubble):</span>
            <div class="bg-white rounded-lg p-3 shadow-sm border border-neutral-200 max-w-sm flex flex-col gap-2 text-xs text-neutral-800">
              <div id="preview-header-media" class="${headerMediaUrl ? '' : 'hidden'}">
                <img src="${headerMediaUrl || ''}" class="w-full max-h-36 rounded object-cover" />
              </div>
              <div id="preview-body-text" class="whitespace-pre-wrap leading-relaxed text-[11px] font-sans">
                ${renderTemplateBodyText(selectedTmpl)}
              </div>
            </div>
          </div>

        </div>
      `;

      attachWhatsAppListeners();

    } else if (currentStepType === 'send_email') {
      const selectedSenderId = currentConfig.sender_profile_id || (senderProfiles[0]?.id || '');
      const selectedRecipientMode = currentConfig.recipient_mode || 'primary_only';

      dynamicArea.innerHTML = `
        <div class="space-y-4 animate-fade-in">
          
          <!-- Sender & Recipient Selection -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
            <!-- Email Sender -->
            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[9px] uppercase tracking-wider">Remitente Comercial *</label>
              ${senderProfiles.length === 0 ? `
                <div class="text-[11px] text-amber-700 font-medium">⚠️ No hay remitentes configurados</div>
              ` : `
                <select id="select-email-sender" class="cohere-select text-xs w-full">
                  ${senderProfiles.map(p => `
                    <option value="${p.id}" data-email="${p.mailing_email || p.email}" ${p.id === selectedSenderId ? 'selected' : ''}>
                      👔 ${p.full_name || p.email} (${p.mailing_email || p.email})
                    </option>
                  `).join('')}
                </select>
              `}
            </div>

            <!-- Email Recipient Mode -->
            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[9px] uppercase tracking-wider">Destinatarios del Paso *</label>
              <select id="select-email-recipient-mode" class="cohere-select text-xs w-full">
                <option value="execution_contact" ${selectedRecipientMode === 'execution_contact' || !selectedRecipientMode ? 'selected' : ''}>🎯 Contacto de esta ejecución (Recomendado)</option>
                <option value="primary_only" ${selectedRecipientMode === 'primary_only' ? 'selected' : ''}>⭐ Solo contacto principal (omite secundarios)</option>
                <option value="all_contacts" ${selectedRecipientMode === 'all_contacts' ? 'selected' : ''}>👥 Todos los contactos vinculados al lead</option>
              </select>
            </div>
          </div>

          <!-- Template Selector -->
          <div>
            <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Plantilla de Email (Opcional)</label>
            <select id="select-email-template" class="cohere-select text-xs w-full">
              <option value="">-- Redactar mensaje personalizado --</option>
              ${emailTemplates.map(t => `<option value="${t.id}" ${t.id === currentConfig.template_id ? 'selected' : ''}>${t.name} (Asunto: ${t.subject})</option>`).join('')}
            </select>
          </div>

          <!-- Subject & Preheader -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Asunto del Correo *</label>
              <input type="text" id="input-email-subject" class="cohere-input text-xs w-full" placeholder="Ej: Oportunidad de franquicia para {{empresa}}" value="${currentConfig.subject || ''}" />
            </div>

            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Preheader / Subheader</label>
              <input type="text" id="input-email-preview-text" class="cohere-input text-xs w-full" placeholder="Texto de vista previa en bandeja..." value="${currentConfig.preview_text || ''}" />
            </div>
          </div>

          <!-- Body with Variable Helpers -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-neutral-700 font-mono text-[10px] uppercase tracking-wider">Cuerpo del Email (HTML / Texto) *</label>
              <div class="flex items-center gap-1 font-mono text-[9px] flex-wrap">
                <button type="button" class="btn-insert-var px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 text-neutral-700 cursor-pointer" data-var="{{nombre}}">+ {{nombre}}</button>
                <button type="button" class="btn-insert-var px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 text-neutral-700 cursor-pointer" data-var="{{empresa}}">+ {{empresa}}</button>
                <button type="button" class="btn-insert-var px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 text-neutral-700 cursor-pointer" data-var="{{telefono}}">+ {{telefono}}</button>
                <button type="button" class="btn-insert-var px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 text-neutral-700 cursor-pointer" data-var="{{email}}">+ {{email}}</button>
              </div>
            </div>
            <textarea id="input-email-body" rows="6" class="cohere-input text-xs w-full font-mono" placeholder="Hola {{nombre}}, le escribimos en relación a {{empresa}}...">${currentConfig.body_html || ''}</textarea>
          </div>

          <!-- Attachments Uploader -->
          <div class="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-mono text-[9px] font-bold text-neutral-700 uppercase flex items-center gap-1.5">
                <span>📎</span> Archivos Adjuntos
              </label>
              <span id="email-attachments-count" class="font-mono text-[10px] text-neutral-400">${emailAttachments.length} archivo(s)</span>
            </div>

            <div class="flex items-center gap-2">
              <label for="input-email-attachments" class="px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 font-mono text-[11px] font-semibold rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-2xs">
                <span>➕ Añadir Archivo</span>
              </label>
              <input type="file" id="input-email-attachments" multiple class="hidden" />
              <span class="text-[10px] text-neutral-400">PDF, imágenes, documentos Office (se enviarán a cada destinatario)</span>
            </div>

            <!-- Attachments Chips Container -->
            <div id="email-attachments-list" class="flex flex-wrap gap-2 pt-1">
              ${renderAttachmentChips(emailAttachments)}
            </div>
          </div>

        </div>
      `;

      attachEmailListeners();

    } else if (currentStepType === 'delay') {
      const duration = currentConfig.duration || 10;
      const unit = currentConfig.unit || 'minutes';

      dynamicArea.innerHTML = `
        <div class="space-y-4 animate-fade-in">
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900">
            <span class="text-2xl">⏳</span>
            <div>
              <strong class="block font-bold">Pausa Temporal de Ejecución</strong>
              <p class="text-[11px] text-amber-800">El contacto permanecerá en espera en este punto del flujo durante el tiempo configurado antes de avanzar al siguiente paso.</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Cantidad de Tiempo</label>
              <input type="number" id="input-delay-duration" min="1" max="365" class="cohere-input text-xs w-full" value="${duration}" />
            </div>

            <div>
              <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Unidad</label>
              <select id="select-delay-unit" class="cohere-select text-xs w-full">
                <option value="minutes" ${unit === 'minutes' ? 'selected' : ''}>Minutos</option>
                <option value="hours" ${unit === 'hours' ? 'selected' : ''}>Horas</option>
                <option value="days" ${unit === 'days' ? 'selected' : ''}>Días</option>
              </select>
            </div>
          </div>
        </div>
      `;

    } else if (currentStepType === 'change_stage') {
      const stages = cache.getStages() || [];
      const currentStageId = currentConfig.to_stage_id || '';

      dynamicArea.innerHTML = `
        <div class="space-y-4 animate-fade-in">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-900">
            <span class="text-2xl">🗂️</span>
            <div>
              <strong class="block font-bold">Cambio Automático de Etapa</strong>
              <p class="text-[11px] text-blue-800">Cuando la ejecución llegue a este nodo, el lead será movido automáticamente en el tablero comercial.</p>
            </div>
          </div>

          <div>
            <label class="block font-bold text-neutral-700 mb-1 font-mono text-[10px] uppercase tracking-wider">Mover a la Etapa de Destino:</label>
            <select id="select-target-stage" class="cohere-select text-xs w-full">
              <option value="">-- Selecciona una etapa --</option>
              ${stages.map(s => `<option value="${s.id}" ${s.id === currentStageId ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
        </div>
      `;

    } else if (currentStepType === 'add_comment') {
      const comment = currentConfig.comment || '';

      dynamicArea.innerHTML = `
        <div class="space-y-4 animate-fade-in">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-neutral-700 font-mono text-[10px] uppercase tracking-wider">Nota o Comentario Interno</label>
              <div class="flex items-center gap-1 font-mono text-[9px]">
                <button type="button" class="btn-insert-comm-var px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 text-neutral-700 cursor-pointer" data-var="{{nombre}}">+ {{nombre}}</button>
                <button type="button" class="btn-insert-comm-var px-1.5 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 text-neutral-700 cursor-pointer" data-var="{{empresa}}">+ {{empresa}}</button>
              </div>
            </div>
            <textarea id="input-step-comment" rows="4" class="cohere-input text-xs w-full" placeholder="Se envió catálogo de franquicia y se programó seguimiento...">${comment}</textarea>
            <p class="text-[10px] text-neutral-400 mt-1">Este comentario aparecerá en el historial de la ficha del lead con la etiqueta del bot de automatización.</p>
          </div>
        </div>
      `;

      dynamicArea.querySelectorAll('.btn-insert-comm-var').forEach(b => {
        b.addEventListener('click', () => {
          const textarea = dynamicArea.querySelector('#input-step-comment');
          textarea.value += ' ' + b.dataset.var;
        });
      });
    }
  }

  function attachWhatsAppListeners() {
    const dynamicArea = container.querySelector('#step-config-dynamic-area');
    const selectElem = dynamicArea.querySelector('#select-wa-template');
    const fileInput = dynamicArea.querySelector('#wa-header-file-input');
    const urlInput = dynamicArea.querySelector('#wa-header-url-input');
    const previewBox = dynamicArea.querySelector('#wa-header-preview-box');
    const imgPreview = dynamicArea.querySelector('#wa-header-img-preview');
    const chatBubbleMedia = dynamicArea.querySelector('#preview-header-media');
    const chatBubbleImg = dynamicArea.querySelector('#preview-header-media img');

    if (selectElem) {
      selectElem.addEventListener('change', () => {
        renderDynamicConfig();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          headerMediaFile = fileInput.files[0];
          urlInput.value = '';
          headerMediaUrl = '';

          if (headerMediaFile.type.startsWith('image/')) {
            const blobUrl = URL.createObjectURL(headerMediaFile);
            imgPreview.src = blobUrl;
            chatBubbleImg.src = blobUrl;
            previewBox.classList.remove('hidden');
            chatBubbleMedia.classList.remove('hidden');
          } else {
            previewBox.classList.add('hidden');
            chatBubbleMedia.classList.add('hidden');
          }
        }
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', () => {
        const url = urlInput.value.trim();
        headerMediaUrl = url;
        headerMediaFile = null;
        if (fileInput) fileInput.value = '';

        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          imgPreview.src = url;
          chatBubbleImg.src = url;
          previewBox.classList.remove('hidden');
          chatBubbleMedia.classList.remove('hidden');
        } else {
          previewBox.classList.add('hidden');
          chatBubbleMedia.classList.add('hidden');
        }
      });
    }
  }

  function attachEmailListeners() {
    const dynamicArea = container.querySelector('#step-config-dynamic-area');
    const tmplSelect = dynamicArea.querySelector('#select-email-template');
    const fileInput = dynamicArea.querySelector('#input-email-attachments');

    if (tmplSelect) {
      tmplSelect.addEventListener('change', (e) => {
        const found = emailTemplates.find(t => t.id === e.target.value);
        if (found) {
          dynamicArea.querySelector('#input-email-subject').value = found.subject || '';
          if (found.preview_text && dynamicArea.querySelector('#input-email-preview-text')) {
            dynamicArea.querySelector('#input-email-preview-text').value = found.preview_text;
          }
          dynamicArea.querySelector('#input-email-body').value = found.body_html || found.body_text || '';
        }
      });
    }

    dynamicArea.querySelectorAll('.btn-insert-var').forEach(b => {
      b.addEventListener('click', () => {
        const textarea = dynamicArea.querySelector('#input-email-body');
        textarea.value += ' ' + b.dataset.var;
      });
    });

    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files.length > 0) {
          for (const file of Array.from(fileInput.files)) {
            if (file.size > 10 * 1024 * 1024) {
              toast.show(`El archivo "${file.name}" supera el límite de 10 MB`, 'error');
              continue;
            }

            const base64 = await fileToBase64(file);
            emailAttachments.push({
              filename: file.name,
              content_type: file.type || 'application/octet-stream',
              base64_content: base64,
              size: file.size
            });
          }
          fileInput.value = '';
          updateAttachmentsList();
        }
      });
    }

    updateAttachmentsList();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  function renderAttachmentChips(attachments) {
    if (!attachments || attachments.length === 0) {
      return '<span class="text-[11px] text-neutral-400 italic">Sin archivos adjuntos</span>';
    }

    return attachments.map((att, idx) => `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-neutral-300 rounded-md font-mono text-[10px] text-neutral-700 shadow-2xs">
        <span>📎</span>
        <span class="truncate max-w-[140px]">${att.filename}</span>
        <button type="button" class="btn-remove-attachment text-neutral-400 hover:text-rose-600 font-bold ml-1 cursor-pointer" data-index="${idx}">✕</button>
      </div>
    `).join('');
  }

  function updateAttachmentsList() {
    const dynamicArea = container.querySelector('#step-config-dynamic-area');
    const listContainer = dynamicArea.querySelector('#email-attachments-list');
    const countIndicator = dynamicArea.querySelector('#email-attachments-count');

    if (listContainer) {
      listContainer.innerHTML = renderAttachmentChips(emailAttachments);
      listContainer.querySelectorAll('.btn-remove-attachment').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          emailAttachments.splice(idx, 1);
          updateAttachmentsList();
        });
      });
    }

    if (countIndicator) {
      countIndicator.textContent = `${emailAttachments.length} archivo(s)`;
    }
  }

  function renderTemplateBodyText(tmpl) {
    if (!tmpl) return 'Selecciona una plantilla para ver su previsualización.';
    const bodyComp = (tmpl.components || []).find(c => c.type === 'BODY');
    return bodyComp?.text || 'Plantilla sin texto en el cuerpo.';
  }

  function renderTemplateVariablesInputs(tmpl, existingMappings) {
    if (!tmpl) return '<p class="text-neutral-400 italic">No hay plantilla seleccionada.</p>';
    
    const components = tmpl.components || [];
    let varsHtml = '';

    components.forEach(comp => {
      if ((comp.type === 'HEADER' && comp.format === 'TEXT') || comp.type === 'BODY') {
        const text = comp.text || '';
        const matches = text.match(/\{\{(\d+)\}\}/g) || [];
        const uniqueVars = [...new Set(matches)].sort();
        const compLabel = comp.type === 'HEADER' ? 'Encabezado' : 'Cuerpo';

        uniqueVars.forEach(vTag => {
          const varKey = vTag.replace(/[{}]/g, '');
          const currentMapping = existingMappings[varKey] || {};
          const selectedField = currentMapping.field || 'lead.name';

          varsHtml += `
            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">${vTag} (${compLabel})</span>
                <span class="text-[10px] text-neutral-400">Variable ${varKey}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-0.5">Asignar Campo</label>
                  <select class="cohere-select text-[11px] w-full var-field-select" data-var-key="${varKey}">
                    <option value="lead.name" ${selectedField === 'lead.name' ? 'selected' : ''}>Nombre (Contacto/Lead)</option>
                    <option value="lead.company" ${selectedField === 'lead.company' ? 'selected' : ''}>Empresa / Marca</option>
                    <option value="contact.first_name" ${selectedField === 'contact.first_name' ? 'selected' : ''}>Nombre de Contacto</option>
                    <option value="contact.last_name" ${selectedField === 'contact.last_name' ? 'selected' : ''}>Apellido de Contacto</option>
                    <option value="contact.phone" ${selectedField === 'contact.phone' ? 'selected' : ''}>Teléfono</option>
                    <option value="contact.email" ${selectedField === 'contact.email' ? 'selected' : ''}>Email</option>
                    <option value="static:personalizado" ${selectedField.startsWith('static:') ? 'selected' : ''}>Texto Fijo / Estático</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[9px] font-mono uppercase text-neutral-500 mb-0.5">Valor por defecto / Fijo</label>
                  <input type="text" class="cohere-input text-[11px] w-full var-fallback-input" data-var-key="${varKey}" placeholder="Ej: Estimado/a" value="${currentMapping.fallback || (selectedField.startsWith('static:') ? selectedField.replace('static:', '') : '')}" />
                </div>
              </div>
            </div>
          `;
        });
      }
    });

    return varsHtml || '<p class="text-emerald-600 font-medium text-xs">✓ Esta plantilla no requiere variables en el texto.</p>';
  }

  async function collectConfigData() {
    const dynamicArea = container.querySelector('#step-config-dynamic-area');

    if (currentStepType === 'send_whatsapp') {
      const selectSender = dynamicArea.querySelector('#select-wa-sender');
      const phoneNumberId = selectSender?.value || null;
      const recipientMode = dynamicArea.querySelector('#select-wa-recipient-mode')?.value || 'primary_only';

      const selectTmpl = dynamicArea.querySelector('#select-wa-template');
      if (!selectTmpl || !selectTmpl.value) {
        return { valid: false, error: 'Debes seleccionar una plantilla de WhatsApp' };
      }

      const tmpl = metaTemplates.find(t => t.name === selectTmpl.value);
      if (!tmpl) {
        return { valid: false, error: 'Plantilla de WhatsApp no encontrada' };
      }

      const headerMediaComp = (tmpl.components || []).find(c => c.type === 'HEADER' && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(c.format));
      let finalMediaUrl = headerMediaUrl;

      // If user provided a file, upload it to Supabase Storage 'whatsapp-media'
      if (headerMediaFile) {
        try {
          const filePath = `automations/${Date.now()}_${headerMediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: uploadErr } = await supabase.storage.from('whatsapp-media').upload(filePath, headerMediaFile);
          if (uploadErr) throw uploadErr;

          const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
          finalMediaUrl = publicUrlData.publicUrl;
        } catch (uploadErr) {
          return { valid: false, error: `Error al subir archivo de encabezado: ${uploadErr.message}` };
        }
      }

      if (headerMediaComp && !finalMediaUrl) {
        const mediaLabel = headerMediaComp.format === 'IMAGE' ? 'una imagen' : headerMediaComp.format === 'VIDEO' ? 'un video' : 'un documento';
        return { valid: false, error: `La plantilla seleccionada requiere ${mediaLabel} en el encabezado. Por favor cárgalo o ingresa una URL.` };
      }

      const variableMappings = {};
      dynamicArea.querySelectorAll('.var-field-select').forEach(sel => {
        const varKey = sel.dataset.varKey;
        const fieldVal = sel.value;
        const fallbackInput = dynamicArea.querySelector(`.var-fallback-input[data-var-key="${varKey}"]`);
        const fallbackVal = fallbackInput?.value?.trim() || '';

        if (fieldVal === 'static:personalizado') {
          variableMappings[varKey] = {
            field: `static:${fallbackVal}`,
            fallback: fallbackVal
          };
        } else {
          variableMappings[varKey] = {
            field: fieldVal,
            fallback: fallbackVal || '-'
          };
        }
      });

      return {
        valid: true,
        config: {
          phone_number_id: phoneNumberId,
          recipient_mode: recipientMode,
          template_name: tmpl.name,
          template_language: tmpl.language || 'es_AR',
          template_id: tmpl.id,
          template_components: tmpl.components || [],
          header_media_url: finalMediaUrl || null,
          header_media_format: headerMediaComp ? headerMediaComp.format : null,
          variable_mappings: variableMappings
        }
      };

    } else if (currentStepType === 'send_email') {
      const senderSelect = dynamicArea.querySelector('#select-email-sender');
      const senderProfileId = senderSelect?.value || null;
      const senderEmail = senderSelect ? senderSelect.options[senderSelect.selectedIndex]?.dataset?.email : null;
      const recipientMode = dynamicArea.querySelector('#select-email-recipient-mode')?.value || 'primary_only';

      const tmplId = dynamicArea.querySelector('#select-email-template')?.value || null;
      const subject = dynamicArea.querySelector('#input-email-subject')?.value?.trim();
      const previewText = dynamicArea.querySelector('#input-email-preview-text')?.value?.trim() || null;
      const bodyHtml = dynamicArea.querySelector('#input-email-body')?.value?.trim();

      if (!subject) {
        return { valid: false, error: 'Por favor ingresa el asunto del correo' };
      }
      if (!bodyHtml) {
        return { valid: false, error: 'Por favor ingresa el cuerpo del correo' };
      }

      return {
        valid: true,
        config: {
          sender_profile_id: senderProfileId,
          sender_email: senderEmail,
          recipient_mode: recipientMode,
          template_id: tmplId,
          subject,
          preview_text: previewText,
          body_html: bodyHtml,
          attachments: emailAttachments
        }
      };

    } else if (currentStepType === 'delay') {
      const duration = parseInt(dynamicArea.querySelector('#input-delay-duration')?.value, 10);
      const unit = dynamicArea.querySelector('#select-delay-unit')?.value || 'minutes';

      if (!duration || duration < 1) {
        return { valid: false, error: 'Por favor ingresa un tiempo válido de espera (mínimo 1)' };
      }

      return {
        valid: true,
        config: {
          duration,
          unit
        }
      };

    } else if (currentStepType === 'change_stage') {
      const stageId = dynamicArea.querySelector('#select-target-stage')?.value;
      if (!stageId) {
        return { valid: false, error: 'Debes seleccionar una etapa de pipeline de destino' };
      }

      return {
        valid: true,
        config: {
          to_stage_id: stageId
        }
      };

    } else if (currentStepType === 'add_comment') {
      const comment = dynamicArea.querySelector('#input-step-comment')?.value?.trim();
      if (!comment) {
        return { valid: false, error: 'Por favor escribe el comentario a registrar' };
      }

      return {
        valid: true,
        config: {
          comment
        }
      };
    }

    return { valid: true, config: {} };
  }
}
