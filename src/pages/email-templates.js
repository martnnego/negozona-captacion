import { supabase } from '../lib/supabase';
import { toast } from '../components/toast';
import { modal } from '../components/modal';
import { auth } from '../lib/auth';

export function renderEmailTemplates() {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in font-sans pb-12 select-none';

  let templates = [];
  let currentFilter = 'all';
  let searchQuery = '';

  container.innerHTML = `
    <!-- Header Area -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6 shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xl">📄</span>
          <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Plantillas de Email</h2>
        </div>
        <p class="text-xs text-muted-slate mt-1 font-sans">Diseña y administra plantillas de correo reutilizables para envíos individuales y campañas masivas.</p>
      </div>

      <button id="btn-new-template" class="px-5 py-2.5 bg-primary hover:bg-cohere-black text-white font-mono text-xs font-bold uppercase rounded-full shadow-xs transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto">
        <span>+ Nueva Plantilla</span>
      </button>
    </div>

    <!-- Filters Bar -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50 p-4 rounded-sm border border-[#d9d9dd]">
      <!-- Search Input -->
      <div class="relative w-full sm:w-80">
        <span class="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none z-10">🔍</span>
        <input type="text" id="template-search" class="cohere-input !pl-9 text-xs w-full" placeholder="Buscar por nombre o asunto..." />
      </div>

      <!-- Filter Buttons -->
      <div class="flex items-center gap-2 text-[10px] font-mono font-bold uppercase">
        <button class="filter-tab px-3 py-1.5 rounded-xs bg-primary text-white cursor-pointer" data-status="all">Todas</button>
        <button class="filter-tab px-3 py-1.5 rounded-xs text-neutral-600 hover:bg-neutral-200 cursor-pointer" data-status="active">Activas</button>
      </div>
    </div>

    <!-- Templates Grid / Table -->
    <div class="bg-white border border-[#d9d9dd] rounded-sm overflow-hidden shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
              <th class="px-6 py-3">Nombre</th>
              <th class="px-6 py-3">Asunto</th>
              <th class="px-6 py-3">Variables Detectadas</th>
              <th class="px-6 py-3">Estado</th>
              <th class="px-6 py-3">Última Actualización</th>
              <th class="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="templates-tbody" class="divide-y divide-[#e5e7eb] text-neutral-700">
            <tr>
              <td colspan="6" class="py-8 text-center text-neutral-400">
                <span class="animate-pulse mr-2">🔄</span> Cargando plantillas...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#templates-tbody');
  const searchInput = container.querySelector('#template-search');
  const filterTabs = container.querySelectorAll('.filter-tab');
  const btnNewTemplate = container.querySelector('#btn-new-template');

  btnNewTemplate.addEventListener('click', () => openTemplateModal());

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTemplatesList();
  });

  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.className = 'filter-tab px-3 py-1.5 rounded-xs text-neutral-600 hover:bg-neutral-200 cursor-pointer');
      tab.className = 'filter-tab px-3 py-1.5 rounded-xs bg-primary text-white cursor-pointer';
      currentFilter = tab.dataset.status;
      renderTemplatesList();
    });
  });

  loadTemplates();

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      templates = data || [];
      renderTemplatesList();
    } catch (err) {
      console.error('Error loading email templates:', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-rose-500 font-mono text-xs">
            Error cargando plantillas: ${err.message}
          </td>
        </tr>
      `;
    }
  }

  function renderTemplatesList() {
    let filtered = templates.filter(t => {
      const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery) || t.subject.toLowerCase().includes(searchQuery);
      const matchesFilter = currentFilter === 'all' || (currentFilter === 'active' && t.is_active);
      return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-neutral-400 font-sans text-xs">
            <div class="flex flex-col items-center gap-2">
              <span class="text-2xl">📭</span>
              <span>No se encontraron plantillas de email</span>
              <button id="empty-btn-new" class="mt-2 text-action-blue font-bold hover:underline cursor-pointer">Crear la primera plantilla</button>
            </div>
          </td>
        </tr>
      `;
      const emptyBtn = tbody.querySelector('#empty-btn-new');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openTemplateModal());
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(tmpl => {
      const vars = Array.isArray(tmpl.variables) ? tmpl.variables : [];
      const updatedDate = tmpl.updated_at ? new Date(tmpl.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

      const row = document.createElement('tr');
      row.className = 'hover:bg-neutral-50/50 transition-colors';
      row.innerHTML = `
        <td class="px-6 py-3.5 font-bold text-primary font-display">${tmpl.name}</td>
        <td class="px-6 py-3.5 text-neutral-600 max-w-xs truncate" title="${tmpl.subject}">${tmpl.subject}</td>
        <td class="px-6 py-3.5">
          <div class="flex flex-wrap gap-1 max-w-xs">
            ${vars.length > 0 ? vars.map(v => `<span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded-xs font-mono text-[9px] text-neutral-600">${v}</span>`).join('') : '<span class="text-neutral-400 text-[10px] italic">Ninguna</span>'}
          </div>
        </td>
        <td class="px-6 py-3.5 select-none">
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
            tmpl.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
          }">
            ${tmpl.is_active ? '● Activa' : '○ Inactiva'}
          </span>
        </td>
        <td class="px-6 py-3.5 font-mono text-[10px] text-neutral-500">${updatedDate}</td>
        <td class="px-6 py-3.5 text-right font-mono text-[10px]">
          <div class="flex items-center justify-end gap-2">
            <button class="btn-edit-tmpl text-action-blue hover:underline cursor-pointer font-bold" data-id="${tmpl.id}">Editar</button>
            <span class="text-neutral-300">|</span>
            <button class="btn-delete-tmpl text-rose-500 hover:underline cursor-pointer font-bold" data-id="${tmpl.id}">Eliminar</button>
          </div>
        </td>
      `;

      row.querySelector('.btn-edit-tmpl').addEventListener('click', () => openTemplateModal(tmpl));
      row.querySelector('.btn-delete-tmpl').addEventListener('click', () => confirmDeleteTemplate(tmpl));

      tbody.appendChild(row);
    });
  }

  async function openTemplateModal(tmpl = null) {
    const isEdit = !!tmpl;
    const currentUserSession = await auth.getCurrentUser();

    const initialName = tmpl?.name || '';
    const initialSubject = tmpl?.subject || '';
    const initialPreviewText = tmpl?.preview_text || '';
    const initialBody = tmpl?.body_html || '';
    const initialActive = tmpl ? tmpl.is_active : true;

    modal.create({
      title: isEdit ? 'Editar Plantilla de Email' : 'Nueva Plantilla de Email',
      content: `
        <form id="tmpl-form" class="flex flex-col gap-4 font-sans text-xs max-h-[75vh] overflow-y-auto pr-1">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2 flex flex-col gap-1">
              <label for="tmpl-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre de la Plantilla *</label>
              <input type="text" id="tmpl-name" required value="${initialName}" placeholder="Ej: Primer contacto comercial" class="cohere-input text-xs" />
            </div>

            <div class="flex flex-col gap-1 justify-end">
              <label class="font-mono text-[9px] font-bold text-primary uppercase mb-1">Estado</label>
              <label class="flex items-center gap-2 cursor-pointer border border-[#d9d9dd] rounded-sm p-2 bg-neutral-50 hover:bg-neutral-100">
                <input type="checkbox" id="tmpl-active" ${initialActive ? 'checked' : ''} class="rounded-xs text-primary focus:ring-0" />
                <span class="text-xs font-semibold text-primary">Plantilla Activa</span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label for="tmpl-subject" class="font-mono text-[9px] font-bold text-primary uppercase">Asunto del Email *</label>
              <input type="text" id="tmpl-subject" required value="${initialSubject}" placeholder="Ej: Propuesta de franquicia para {{lead.company_name}}" class="cohere-input text-xs" />
            </div>

            <div class="flex flex-col gap-1">
              <label for="tmpl-preview-text" class="font-mono text-[9px] font-bold text-primary uppercase">Texto de Vista Previa (Preheader en la bandeja de entrada)</label>
              <input type="text" id="tmpl-preview-text" value="${initialPreviewText}" placeholder="Ej: Descubre la oportunidad de negocio para {{lead.company_name}}..." class="cohere-input text-xs" />
            </div>
          </div>

          <!-- Dynamic Variables Bar -->
          <div class="flex flex-col gap-1.5 bg-neutral-50 p-3 rounded-sm border border-neutral-200">
            <span class="font-mono text-[9px] font-bold text-muted-slate uppercase">Insertar variable dinámica (en asunto, preheader o cuerpo):</span>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" class="btn-insert-var px-2 py-1 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-xs font-mono text-[10px] text-primary transition-colors cursor-pointer" data-var="{{lead.first_name}}">👤 Lead Nombre</button>
              <button type="button" class="btn-insert-var px-2 py-1 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-xs font-mono text-[10px] text-primary transition-colors cursor-pointer" data-var="{{lead.company_name}}">🏢 Empresa Lead</button>
              <button type="button" class="btn-insert-var px-2 py-1 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-xs font-mono text-[10px] text-primary transition-colors cursor-pointer" data-var="{{lead.country}}">🌍 País</button>
              <button type="button" class="btn-insert-var px-2 py-1 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-xs font-mono text-[10px] text-primary transition-colors cursor-pointer" data-var="{{lead.industry}}">💼 Rubro</button>
              <button type="button" class="btn-insert-var px-2 py-1 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-xs font-mono text-[10px] text-primary transition-colors cursor-pointer" data-var="{{comercial.full_name}}">👔 Nombre Comercial</button>
              <button type="button" class="btn-insert-var px-2 py-1 bg-white hover:bg-neutral-200 border border-neutral-300 rounded-xs font-mono text-[10px] text-primary transition-colors cursor-pointer" data-var="{{comercial.email}}">✉️ Email Comercial</button>
            </div>
          </div>

          <!-- HTML Body Content -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label for="tmpl-body" class="font-mono text-[9px] font-bold text-primary uppercase">Cuerpo del Email (HTML / Texto) *</label>
              <span class="text-[10px] text-neutral-400">Puedes usar etiquetas HTML básicas como &lt;p&gt;, &lt;b&gt;, &lt;a href="..."&gt;</span>
            </div>
            <textarea id="tmpl-body" rows="10" required class="cohere-input text-xs font-mono p-3 leading-relaxed" placeholder="Hola {{lead.first_name}},&#10;&#10;Nos comunicamos de NegoZona para presentarte nuestras franquicias disponibles...">${initialBody}</textarea>
          </div>

          <!-- Live Preview -->
          <div class="flex flex-col gap-1 mt-2 border-t border-neutral-200 pt-3">
            <span class="font-mono text-[9px] font-bold text-primary uppercase">Vista Previa Estimada</span>
            <div id="tmpl-preview" class="p-4 bg-white border border-neutral-300 rounded-sm font-sans text-xs min-h-[100px] max-h-[200px] overflow-y-auto leading-relaxed shadow-inner">
              <span class="text-neutral-400 italic">Escribe arriba para ver la vista previa...</span>
            </div>
          </div>
        </form>
      `,
      actions: [
        { text: 'Cancelar', primary: false },
        {
          text: isEdit ? 'Guardar Cambios' : 'Crear Plantilla',
          primary: true,
          onClick: async (closeModal) => {
            const modalEl = document.querySelector('.modal-overlay') || document;
            const name = modalEl.querySelector('#tmpl-name')?.value?.trim();
            const subject = subjectInput.value.trim();
            const preview_text = previewTextInput.value.trim();
            const body_html = bodyInput.value.trim();
            const is_active = modalEl.querySelector('#tmpl-active')?.checked ?? true;

            if (!name || !subject || !body_html) {
              toast.show('Por favor completa todos los campos requeridos (*)', 'error');
              return;
            }

            // Extract variables dynamically using regex
            const foundVars = Array.from(new Set((subject + ' ' + preview_text + ' ' + body_html).match(/\{\{[\w\.]+\}\}/g) || []));

            try {
              if (isEdit) {
                const { error } = await supabase
                  .from('email_templates')
                  .update({
                    name,
                    subject,
                    preview_text,
                    body_html,
                    variables: foundVars,
                    is_active,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', tmpl.id);

                if (error) throw error;
                toast.show('Plantilla de email actualizada correctamente', 'success');
              } else {
                const { error } = await supabase
                  .from('email_templates')
                  .insert({
                    name,
                    subject,
                    preview_text,
                    body_html,
                    variables: foundVars,
                    is_active,
                    created_by: currentUserSession?.id
                  });

                if (error) throw error;
                toast.show('Plantilla de email creada correctamente', 'success');
              }

              closeModal();
              await loadTemplates();
            } catch (err) {
              console.error('Error saving email template:', err);
              toast.show('Error al guardar plantilla: ' + err.message, 'error');
            }
          }
        }
      ]
    });

    const modalEl = document.querySelector('.modal-overlay') || document;
    const bodyInput = modalEl.querySelector('#tmpl-body');
    const subjectInput = modalEl.querySelector('#tmpl-subject');
    const previewTextInput = modalEl.querySelector('#tmpl-preview-text');
    const previewEl = modalEl.querySelector('#tmpl-preview');
    let lastActiveInput = bodyInput;

    [subjectInput, previewTextInput, bodyInput].forEach(input => {
      if (!input) return;
      input.addEventListener('focus', () => lastActiveInput = input);
      input.addEventListener('input', updatePreview);
    });

    modalEl.querySelectorAll('.btn-insert-var').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const varText = btn.dataset.var;
        const start = lastActiveInput.selectionStart || 0;
        const end = lastActiveInput.selectionEnd || 0;
        const val = lastActiveInput.value;
        lastActiveInput.value = val.substring(0, start) + varText + val.substring(end);
        lastActiveInput.focus();
        lastActiveInput.setSelectionRange(start + varText.length, start + varText.length);
        updatePreview();
      });
    });

    updatePreview();

    function updatePreview() {
      const sampleSubject = subjectInput.value
        .replace(/\{\{lead\.first_name\}\}/g, 'Juan')
        .replace(/\{\{lead\.company_name\}\}/g, 'Empresa Ejemplo')
        .replace(/\{\{lead\.country\}\}/g, 'Argentina')
        .replace(/\{\{lead\.industry\}\}/g, 'Gastronomía')
        .replace(/\{\{comercial\.full_name\}\}/g, currentUserSession?.profile?.full_name || 'Comercial NegoZona')
        .replace(/\{\{comercial\.email\}\}/g, currentUserSession?.email || 'comercial@negozona.com');

      const samplePreviewText = (previewTextInput?.value || '')
        .replace(/\{\{lead\.first_name\}\}/g, 'Juan')
        .replace(/\{\{lead\.company_name\}\}/g, 'Empresa Ejemplo')
        .replace(/\{\{lead\.country\}\}/g, 'Argentina')
        .replace(/\{\{lead\.industry\}\}/g, 'Gastronomía')
        .replace(/\{\{comercial\.full_name\}\}/g, currentUserSession?.profile?.full_name || 'Comercial NegoZona')
        .replace(/\{\{comercial\.email\}\}/g, currentUserSession?.email || 'comercial@negozona.com');

      const sampleBody = bodyInput.value
        .replace(/\{\{lead\.first_name\}\}/g, 'Juan')
        .replace(/\{\{lead\.company_name\}\}/g, 'Empresa Ejemplo')
        .replace(/\{\{lead\.country\}\}/g, 'Argentina')
        .replace(/\{\{lead\.industry\}\}/g, 'Gastronomía')
        .replace(/\{\{comercial\.full_name\}\}/g, currentUserSession?.profile?.full_name || 'Comercial NegoZona')
        .replace(/\{\{comercial\.email\}\}/g, currentUserSession?.email || 'comercial@negozona.com')
        .replace(/\n/g, '<br>');

      previewEl.innerHTML = `
        <div class="flex flex-col gap-2">
          <div class="border-b border-neutral-100 pb-2 flex flex-col gap-1">
            <div><span class="font-bold text-neutral-800">Asunto:</span> <span class="text-primary font-medium">${sampleSubject || '(Sin asunto)'}</span></div>
            ${samplePreviewText ? `<div class="text-[11px] text-neutral-500 font-mono"><span class="font-bold text-neutral-700">Preheader:</span> "${samplePreviewText}"</div>` : ''}
          </div>
          <div>${sampleBody || '<span class="text-neutral-400 italic">(Cuerpo vacío)</span>'}</div>
        </div>
      `;
    }
  }

  function confirmDeleteTemplate(tmpl) {
    modal.create({
      title: 'Eliminar Plantilla de Email',
      content: `
        <div class="flex flex-col gap-3 font-sans text-xs">
          <p class="text-neutral-700">
            ¿Estás seguro de que deseas eliminar la plantilla <b>"${tmpl.name}"</b>?
          </p>
          <p class="text-rose-600 text-[11px]">
            * Esta acción no se puede deshacer. Las campañas o envíos anteriores conservarán su contenido guardado.
          </p>
        </div>
      `,
      actions: [
        { text: 'Cancelar', primary: false },
        {
          text: 'Sí, Eliminar',
          primary: true,
          danger: true,
          onClick: async () => {
            try {
              const { error } = await supabase
                .from('email_templates')
                .delete()
                .eq('id', tmpl.id);

              if (error) throw error;
              toast.show('Plantilla eliminada', 'success');
              modal.close();
              await loadTemplates();
            } catch (err) {
              console.error('Error deleting template:', err);
              toast.show('Error al eliminar plantilla: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  }

  return container;
}
