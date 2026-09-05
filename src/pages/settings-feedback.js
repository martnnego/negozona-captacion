import { supabase } from '../lib/supabase';
import { toast } from '../components/toast';
import { modal } from '../components/modal';
import { formatDate, formatDateTime } from '../utils/date-format';

/**
 * Renders the Admin Feedback tab inside Settings.
 * @param {Object} currentUser 
 * @returns {HTMLElement}
 */
export function renderFeedbackTab(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in select-none';

  let feedbacks = [];
  let isLoading = true;
  let activeStatusFilter = 'all'; // 'all', 'nuevo', 'en_revision', 'planificado', 'en_desarrollo', 'resuelto', 'descartado'
  let activeTypeFilter = 'all'; // 'all', 'bug', 'improvement', 'idea'
  let searchQuery = '';

  const statusLabels = {
    nuevo: 'Nuevo',
    en_revision: 'En revisión',
    planificado: 'Planificado',
    en_desarrollo: 'En desarrollo',
    resuelto: 'Resuelto',
    descartado: 'Descartado'
  };

  const statusColors = {
    nuevo: 'bg-rose-50 text-rose-700 border-rose-200',
    en_revision: 'bg-amber-50 text-amber-700 border-amber-200',
    planificado: 'bg-sky-50 text-sky-700 border-sky-200',
    en_desarrollo: 'bg-purple-50 text-purple-700 border-purple-200',
    resuelto: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    descartado: 'bg-neutral-100 text-neutral-600 border-neutral-200'
  };

  const typeLabels = {
    bug: { text: 'Problema', icon: '🐛', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
    improvement: { text: 'Mejora', icon: '💡', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
    idea: { text: 'Idea', icon: '✨', badge: 'bg-purple-50 text-purple-800 border-purple-200' }
  };

  // Initial loader
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[300px] text-neutral-400 gap-3">
      <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="text-xs font-sans">Cargando reportes de feedback...</span>
    </div>
  `;

  loadFeedbacks();

  async function loadFeedbacks() {
    try {
      isLoading = true;
      const { data, error } = await supabase
        .from('user_feedbacks')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      feedbacks = data || [];
      isLoading = false;
      renderView();
    } catch (err) {
      console.error('Error al cargar feedbacks:', err);
      container.innerHTML = `
        <div class="p-6 bg-red-50 border border-red-200 rounded-sm text-red-700 text-xs font-sans">
          Error al cargar los reportes de feedback: ${err.message}
        </div>
      `;
    }
  }

  function renderView() {
    // Calculate metrics
    const totalCount = feedbacks.length;
    const newCount = feedbacks.filter(f => f.status === 'nuevo').length;
    const reviewingCount = feedbacks.filter(f => f.status === 'en_revision').length;
    const inProgressCount = feedbacks.filter(f => f.status === 'planificado' || f.status === 'en_desarrollo').length;
    const resolvedCount = feedbacks.filter(f => f.status === 'resuelto').length;

    // Filter feedbacks
    const filtered = feedbacks.filter(f => {
      // Status filter
      if (activeStatusFilter !== 'all' && f.status !== activeStatusFilter) return false;
      // Type filter
      if (activeTypeFilter !== 'all' && f.type !== activeTypeFilter) return false;
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const descMatch = (f.description || '').toLowerCase().includes(q);
        const userMatch = (f.profiles?.full_name || '').toLowerCase().includes(q);
        const moduleMatch = (f.module || '').toLowerCase().includes(q);
        const entityMatch = JSON.stringify(f.entity_context || {}).toLowerCase().includes(q);
        if (!descMatch && !userMatch && !moduleMatch && !entityMatch) return false;
      }
      return true;
    });

    container.innerHTML = `
      <!-- Metric Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between">
          <span class="font-mono text-[10px] text-muted-slate uppercase font-bold tracking-wider">Total Recibidos</span>
          <span class="text-2xl font-bold font-display text-primary mt-1">${totalCount}</span>
        </div>
        <div class="bg-rose-50/40 border border-rose-200/80 rounded-sm p-4 flex flex-col justify-between">
          <span class="font-mono text-[10px] text-rose-700 uppercase font-bold tracking-wider">Nuevos</span>
          <span class="text-2xl font-bold font-display text-rose-700 mt-1">${newCount}</span>
        </div>
        <div class="bg-amber-50/40 border border-amber-200/80 rounded-sm p-4 flex flex-col justify-between">
          <span class="font-mono text-[10px] text-amber-700 uppercase font-bold tracking-wider">En Revisión</span>
          <span class="text-2xl font-bold font-display text-amber-700 mt-1">${reviewingCount}</span>
        </div>
        <div class="bg-purple-50/40 border border-purple-200/80 rounded-sm p-4 flex flex-col justify-between">
          <span class="font-mono text-[10px] text-purple-700 uppercase font-bold tracking-wider">En Progreso</span>
          <span class="text-2xl font-bold font-display text-purple-700 mt-1">${inProgressCount}</span>
        </div>
        <div class="bg-emerald-50/40 border border-emerald-200/80 rounded-sm p-4 flex flex-col justify-between">
          <span class="font-mono text-[10px] text-emerald-700 uppercase font-bold tracking-wider">Resueltos</span>
          <span class="text-2xl font-bold font-display text-emerald-700 mt-1">${resolvedCount}</span>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 border border-[#d9d9dd] rounded-sm">
        <!-- Status Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0 font-sans text-xs">
          ${[
            { id: 'all', label: 'Todos' },
            { id: 'nuevo', label: 'Nuevos' },
            { id: 'en_revision', label: 'En revisión' },
            { id: 'planificado', label: 'Planificados' },
            { id: 'en_desarrollo', label: 'En desarrollo' },
            { id: 'resuelto', label: 'Resueltos' },
            { id: 'descartado', label: 'Descartados' },
          ].map(s => `
            <button 
              data-filter-status="${s.id}" 
              class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeStatusFilter === s.id 
                  ? 'bg-primary text-white font-semibold shadow-2xs' 
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }"
            >
              ${s.label}
            </button>
          `).join('')}
        </div>

        <!-- Right: Type selector & Search -->
        <div class="flex items-center gap-2.5 shrink-0">
          <select id="type-filter-select" class="text-xs font-sans px-2.5 py-1.5 border border-[#d9d9dd] rounded-sm bg-white text-neutral-700 focus:outline-none focus:border-primary cursor-pointer">
            <option value="all" ${activeTypeFilter === 'all' ? 'selected' : ''}>Todos los tipos</option>
            <option value="bug" ${activeTypeFilter === 'bug' ? 'selected' : ''}>🐛 Problemas</option>
            <option value="improvement" ${activeTypeFilter === 'improvement' ? 'selected' : ''}>💡 Mejoras</option>
            <option value="idea" ${activeTypeFilter === 'idea' ? 'selected' : ''}>✨ Ideas</option>
          </select>

          <div class="relative">
            <input 
              id="search-input" 
              type="text" 
              value="${searchQuery}" 
              placeholder="Buscar en feedback..." 
              class="text-xs font-sans pl-7 pr-3 py-1.5 border border-[#d9d9dd] rounded-sm w-44 md:w-56 focus:outline-none focus:border-primary placeholder:text-neutral-400"
            />
            <span class="absolute left-2.5 top-2 text-neutral-400 text-xs">🔍</span>
          </div>
        </div>
      </div>

      <!-- Feedback List / Table -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm overflow-hidden shadow-2xs">
        ${filtered.length === 0 ? `
          <div class="p-12 text-center flex flex-col items-center justify-center gap-2 text-neutral-400">
            <span class="text-3xl">📭</span>
            <p class="text-sm font-sans font-medium text-neutral-600">No se encontraron reportes de feedback</p>
            <p class="text-xs font-sans text-neutral-400">Modificá los filtros de búsqueda para ver más resultados.</p>
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr class="bg-neutral-50 border-b border-[#d9d9dd] text-[10px] font-mono uppercase tracking-wider text-muted-slate font-bold">
                  <th class="py-3 px-4 w-28">Tipo</th>
                  <th class="py-3 px-4">Descripción</th>
                  <th class="py-3 px-4 w-44">Usuario</th>
                  <th class="py-3 px-4 w-36">Módulo / Origen</th>
                  <th class="py-3 px-4 w-32">Fecha</th>
                  <th class="py-3 px-4 w-36 text-center">Estado</th>
                  <th class="py-3 px-4 w-16 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                ${filtered.map(item => {
                  const typeInfo = typeLabels[item.type] || { text: item.type, icon: '💬', badge: 'bg-neutral-100 text-neutral-700' };
                  const userProfile = item.profiles;
                  const userName = userProfile?.full_name || 'Usuario';
                  const userInitial = (userName || 'U').charAt(0).toUpperCase();
                  const statusClass = statusColors[item.status] || 'bg-neutral-100 text-neutral-700';

                  let entityBadge = '';
                  if (item.entity_context?.name) {
                    entityBadge = `<span class="inline-block mt-0.5 text-[10px] font-sans font-medium text-neutral-500 truncate max-w-[140px]" title="${item.entity_context.name}">🏢 ${item.entity_context.name}</span>`;
                  }

                  return `
                    <tr class="hover:bg-neutral-50/70 transition-colors" data-id="${item.id}">
                      <!-- Tipo -->
                      <td class="py-3.5 px-4 align-top">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${typeInfo.badge}">
                          <span>${typeInfo.icon}</span>
                          <span>${typeInfo.text}</span>
                        </span>
                      </td>

                      <!-- Descripción -->
                      <td class="py-3.5 px-4 align-top">
                        <p class="text-xs text-neutral-800 leading-relaxed line-clamp-3 whitespace-pre-wrap cursor-pointer hover:text-primary transition-colors desc-toggle" title="Hacer clic para ver completo">${escapeHtml(item.description)}</p>
                      </td>

                      <!-- Usuario -->
                      <td class="py-3.5 px-4 align-top">
                        <div class="flex items-center gap-2">
                          <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            ${userProfile?.avatar_url 
                              ? `<img src="${userProfile.avatar_url}" class="w-6 h-6 rounded-full object-cover" />` 
                              : userInitial}
                          </div>
                          <div class="flex flex-col min-w-0">
                            <span class="font-semibold text-neutral-800 truncate">${userName}</span>
                            <span class="text-[10px] text-muted-slate font-mono uppercase">${userProfile?.role === 'super_admin' ? 'Admin' : 'Comercial'}</span>
                          </div>
                        </div>
                      </td>

                      <!-- Módulo / Origen -->
                      <td class="py-3.5 px-4 align-top">
                        <div class="flex flex-col">
                          <span class="font-medium text-neutral-700">${item.module || 'CRM'}</span>
                          ${entityBadge}
                        </div>
                      </td>

                      <!-- Fecha -->
                      <td class="py-3.5 px-4 align-top">
                        <div class="flex flex-col">
                          <span class="text-neutral-700 font-medium">${formatDateRelative(item.created_at)}</span>
                          <span class="text-[10px] text-neutral-400 font-mono">${formatDateSimple(item.created_at)}</span>
                        </div>
                      </td>

                      <!-- Estado Selector Interactivo -->
                      <td class="py-3.5 px-4 align-top text-center">
                        <select 
                          data-status-select="${item.id}" 
                          class="text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none transition-all ${statusClass}"
                        >
                          <option value="nuevo" ${item.status === 'nuevo' ? 'selected' : ''}>Nuevo</option>
                          <option value="en_revision" ${item.status === 'en_revision' ? 'selected' : ''}>En revisión</option>
                          <option value="planificado" ${item.status === 'planificado' ? 'selected' : ''}>Planificado</option>
                          <option value="en_desarrollo" ${item.status === 'en_desarrollo' ? 'selected' : ''}>En desarrollo</option>
                          <option value="resuelto" ${item.status === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                          <option value="descartado" ${item.status === 'descartado' ? 'selected' : ''}>Descartado</option>
                        </select>
                      </td>

                      <!-- Acciones / Ver Detalle -->
                      <td class="py-3.5 px-4 align-top text-right">
                        <button 
                          data-open-detail="${item.id}" 
                          class="p-1.5 text-neutral-400 hover:text-primary hover:bg-neutral-100 rounded-sm transition-colors cursor-pointer" 
                          title="Ver detalle completo y contexto técnico"
                        >
                          👁️
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    attachEventListeners();
  }

  function attachEventListeners() {
    // Status filter buttons
    container.querySelectorAll('[data-filter-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeStatusFilter = btn.dataset.filterStatus;
        renderView();
      });
    });

    // Type filter select
    const typeSelect = container.querySelector('#type-filter-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        activeTypeFilter = e.target.value;
        renderView();
      });
    }

    // Search input
    const searchInput = container.querySelector('#search-input');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          searchQuery = e.target.value.trim();
          renderView();
          // Restore focus
          const nextInput = container.querySelector('#search-input');
          if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
          }
        }, 200);
      });
    }

    // Status change listener
    container.querySelectorAll('[data-status-select]').forEach(select => {
      select.addEventListener('change', async (e) => {
        const feedbackId = select.dataset.statusSelect;
        const newStatus = select.value;
        
        try {
          select.disabled = true;
          const { error } = await supabase
            .from('user_feedbacks')
            .update({ 
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', feedbackId);

          if (error) throw error;

          // Update local state
          const target = feedbacks.find(f => f.id === feedbackId);
          if (target) target.status = newStatus;

          toast.show(`Estado actualizado a "${statusLabels[newStatus]}"`, 'success');
          renderView();
        } catch (err) {
          console.error('Error al actualizar estado:', err);
          toast.show('Error al actualizar estado: ' + err.message, 'error');
          renderView();
        }
      });
    });

    // Detail modal button / Description click
    container.querySelectorAll('[data-open-detail], .desc-toggle').forEach(el => {
      el.addEventListener('click', () => {
        const row = el.closest('tr');
        const feedbackId = row?.dataset.id;
        const item = feedbacks.find(f => f.id === feedbackId);
        if (item) {
          openDetailModal(item);
        }
      });
    });
  }

  function openDetailModal(item) {
    const typeInfo = typeLabels[item.type] || { text: item.type, icon: '💬', badge: 'bg-neutral-100' };
    const userName = item.profiles?.full_name || 'Usuario';
    const userRole = item.profiles?.role === 'super_admin' ? 'Administrador' : 'Comercial';

    const detailContent = document.createElement('div');
    detailContent.className = 'flex flex-col gap-5 font-sans text-xs text-neutral-700';

    const formattedExactDate = formatDateTime ? formatDateTime(item.created_at) : new Date(item.created_at).toLocaleString();

    detailContent.innerHTML = `
      <!-- Header banner -->
      <div class="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${typeInfo.badge}">
            <span>${typeInfo.icon}</span>
            <span>${typeInfo.text}</span>
          </span>
          <span class="font-mono text-neutral-400 text-[11px]">${formattedExactDate}</span>
        </div>
        <div class="text-right">
          <span class="font-semibold text-neutral-800">${userName}</span>
          <span class="text-muted-slate text-[10px] block font-mono">(${userRole})</span>
        </div>
      </div>

      <!-- Description -->
      <div class="flex flex-col gap-1.5">
        <label class="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-slate">Descripción reportada</label>
        <div class="p-3.5 bg-neutral-50 border border-neutral-200 rounded-sm text-neutral-800 text-xs leading-relaxed whitespace-pre-wrap select-text">
          ${escapeHtml(item.description)}
        </div>
      </div>

      <!-- Context Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-neutral-50/50 rounded-sm border border-neutral-100">
        <div>
          <span class="font-mono text-[10px] font-bold text-muted-slate uppercase block">Módulo</span>
          <span class="text-neutral-800 font-medium">${item.module || 'CRM'}</span>
        </div>
        <div>
          <span class="font-mono text-[10px] font-bold text-muted-slate uppercase block">URL de origen</span>
          <a href="${item.page_url || '#'}" target="_blank" class="text-action-blue hover:underline font-mono text-[11px] truncate block max-w-xs" title="${item.page_url}">
            ${item.page_url || '-'}
          </a>
        </div>
        ${item.entity_context && Object.keys(item.entity_context).length > 0 ? `
          <div class="sm:col-span-2">
            <span class="font-mono text-[10px] font-bold text-muted-slate uppercase block">Registro / Entidad activa</span>
            <span class="text-neutral-800 font-mono text-[11px] bg-white px-2 py-1 border border-neutral-200 rounded-xs inline-block mt-0.5">
              ${JSON.stringify(item.entity_context)}
            </span>
          </div>
        ` : ''}
      </div>

      <!-- Technical Metadata -->
      ${item.metadata && Object.keys(item.metadata).length > 0 ? `
        <div class="flex flex-col gap-1">
          <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-slate">Datos técnicos del dispositivo</span>
          <div class="text-[10px] font-mono text-neutral-500 bg-neutral-50 p-2.5 rounded-sm border border-neutral-100 flex flex-wrap gap-x-4 gap-y-1">
            <span>Resolución: <b class="text-neutral-700">${item.metadata.screen || '-'}</b></span>
            <span>Dispositivo: <b class="text-neutral-700">${item.metadata.device || '-'}</b></span>
            <span>Idioma: <b class="text-neutral-700">${item.metadata.language || '-'}</b></span>
          </div>
        </div>
      ` : ''}

      <!-- Admin Notes Field -->
      <div class="flex flex-col gap-1.5 pt-2 border-t border-neutral-100">
        <label for="admin-notes-input" class="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-slate flex justify-between">
          <span>Notas internas del Administrador</span>
          <span class="font-normal lowercase text-[10px] text-neutral-400">visibles solo para administradores</span>
        </label>
        <textarea 
          id="admin-notes-input" 
          rows="2" 
          placeholder="Anotar detalles de seguimiento o resolución..."
          class="w-full text-xs font-sans px-3 py-2 border border-[#d9d9dd] rounded-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-neutral-400 resize-none"
        >${escapeHtml(item.admin_notes || '')}</textarea>
        <div class="flex justify-end mt-1">
          <button id="save-notes-btn" class="px-3 py-1 bg-neutral-800 hover:bg-black text-white text-[11px] font-medium rounded-sm transition-colors cursor-pointer">
            Guardar notas
          </button>
        </div>
      </div>
    `;

    const detailDialog = modal.create({
      title: `Detalle del Feedback #${item.id.slice(0, 8)}`,
      content: detailContent,
      sizeClass: 'max-w-xl'
    });

    const saveNotesBtn = detailContent.querySelector('#save-notes-btn');
    const notesInput = detailContent.querySelector('#admin-notes-input');

    saveNotesBtn.addEventListener('click', async () => {
      const newNotes = notesInput.value.trim();
      saveNotesBtn.disabled = true;
      saveNotesBtn.textContent = 'Guardando...';

      try {
        const { error } = await supabase
          .from('user_feedbacks')
          .update({ 
            admin_notes: newNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (error) throw error;
        item.admin_notes = newNotes;
        toast.show('Notas de administrador guardadas', 'success');
        saveNotesBtn.disabled = false;
        saveNotesBtn.textContent = 'Guardar notas';
      } catch (err) {
        toast.show('Error al guardar notas: ' + err.message, 'error');
        saveNotesBtn.disabled = false;
        saveNotesBtn.textContent = 'Guardar notas';
      }
    });
  }

  return container;
}

/** Utility: Relative date formatter */
function formatDateRelative(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Hace instantes';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 30) return `Hace ${diffDays} d`;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/** Utility: Simple date string */
function formatDateSimple(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Utility: Escape HTML for safe rendering */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
