import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { realtime } from '../lib/realtime';
import { toast } from '../components/toast';
import { renderPagination } from '../components/pagination';
import { formatDateTime, formatTimeAgo } from '../utils/date-format';
import { renderLeadDetail } from './lead-detail';

export function renderNotifications(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none font-sans text-xs';

  const isAdmin = currentUser?.profile?.role === 'super_admin';

  // State
  let notifications = [];
  let isLoading = true;
  let searchQuery = '';
  let typeFilter = 'all'; // 'all', 'lead_interaction', 'lead_assigned', 'stage_changed', 'campaign', 'system'
  let statusFilter = 'all'; // 'all', 'unread', 'read'
  let dateRangeFilter = '30d'; // 'today', '7d', '30d', 'all'
  let scope = 'mine'; // 'mine', 'all' (only for super_admin)
  let currentPage = 1;
  let rowsPerPage = 25;

  let unsubscribeRealtime = null;

  // Render Skeleton / Loading state
  function renderSkeleton() {
    return `
      <div class="space-y-4 animate-pulse">
        <div class="h-10 bg-neutral-100 rounded-sm w-full"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="h-20 bg-neutral-100 rounded-sm"></div>
          <div class="h-20 bg-neutral-100 rounded-sm"></div>
          <div class="h-20 bg-neutral-100 rounded-sm"></div>
          <div class="h-20 bg-neutral-100 rounded-sm"></div>
        </div>
        <div class="h-12 bg-neutral-100 rounded-sm w-full"></div>
        <div class="h-96 bg-neutral-100 rounded-sm w-full"></div>
      </div>
    `;
  }

  // Load notifications from Supabase
  async function loadNotifications() {
    isLoading = true;
    render();

    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (scope === 'mine' || !isAdmin) {
        query = query.eq('user_id', currentUser.id);
      }

      if (dateRangeFilter === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        query = query.gte('created_at', d.toISOString());
      } else if (dateRangeFilter === '7d') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte('created_at', d.toISOString());
      } else if (dateRangeFilter === '30d') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte('created_at', d.toISOString());
      }

      // Max limit to maintain snappy performance while providing deep history
      query = query.limit(500);

      const { data, error } = await query;
      if (error) throw error;

      notifications = data || [];
      syncSidebarBadge();
    } catch (err) {
      console.error('Error fetching notifications history:', err);
      toast.show('Error al cargar historial de notificaciones: ' + err.message, 'error');
    } finally {
      isLoading = false;
      render();
    }
  }

  // Helper to sync unread badge in sidebar
  function syncSidebarBadge() {
    const sidebarBadge = document.getElementById('sidebar-notifications-badge');
    if (!sidebarBadge) return;
    const unreadCount = notifications.filter(n => !n.is_read && (n.user_id === currentUser.id)).length;
    if (unreadCount > 0) {
      sidebarBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      sidebarBadge.classList.remove('hidden');
    } else {
      sidebarBadge.classList.add('hidden');
    }
  }

  // Action: Mark single notification read / unread
  async function toggleRead(id, currentStatus) {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: newStatus })
        .eq('id', id);

      if (error) throw error;

      notifications = notifications.map(n => n.id === id ? { ...n, is_read: newStatus } : n);
      syncSidebarBadge();
      render();
      toast.show(newStatus ? 'Notificación marcada como leída' : 'Notificación marcada como no leída', 'info');
    } catch (err) {
      toast.show('Error al actualizar notificación: ' + err.message, 'error');
    }
  }

  // Action: Mark all notifications as read
  async function markAllAsRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) {
      toast.show('No hay notificaciones pendientes para marcar', 'info');
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;

      notifications = notifications.map(n => ({ ...n, is_read: true }));
      syncSidebarBadge();

      // Sync bell badge if exists in DOM
      const bellBadge = document.getElementById('bell-badge');
      if (bellBadge) bellBadge.classList.add('hidden');

      render();
      toast.show('Todas las notificaciones se marcaron como leídas', 'success');
    } catch (err) {
      toast.show('Error al marcar notificaciones como leídas: ' + err.message, 'error');
    }
  }

  // Helper to open lead detail
  function openLead(leadId, type) {
    if (!leadId) return;
    if (type === 'lead_interaction') {
      localStorage.setItem('lead_detail_active_tab', 'interactions');
    } else if (type === 'agentic_interaction') {
      localStorage.setItem('lead_detail_active_tab', 'whatsapp');
    }
    renderLeadDetail(leadId, () => {
      // Optional callback on lead update
    });
  }

  // Modal explicativo de criterios y políticas de notificación
  function openCriteriaModal() {
    const modalId = 'notifs-criteria-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in select-none';

    overlay.innerHTML = `
      <div class="bg-white rounded-sm border border-[#d9d9dd] shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        <!-- Modal Header -->
        <div class="px-5 py-4 border-b border-[#d9d9dd] bg-neutral-50/80 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🔔</span>
            <div>
              <h3 class="font-display text-base font-bold text-primary">Criterios de Notificación del CRM</h3>
              <p class="text-[11px] text-muted font-sans">Qué eventos generan alertas y política de no saturación</p>
            </div>
          </div>
          <button id="close-criteria-modal-btn" class="text-neutral-400 hover:text-primary p-1 rounded-xs transition-colors cursor-pointer text-xl leading-none" title="Cerrar">&times;</button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 overflow-y-auto space-y-4 text-xs font-sans text-slate leading-relaxed max-h-[65vh]">
          <p class="text-neutral-600">
            El sistema de notificaciones del CRM está diseñado para alertarte <strong>exclusivamente ante eventos prioritarios</strong> que demandan tu atención o acción comercial inmediata.
          </p>

          <!-- List of notified events -->
          <div class="space-y-2.5">
            <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-sm flex items-start gap-3">
              <span class="text-base shrink-0">🟢</span>
              <div>
                <span class="font-bold text-primary block">1. Respuestas de Clientes (Gestiones Entrantes)</span>
                <span class="text-neutral-500 text-[11px]">Cuando un prospecto responde un WhatsApp, contesta un correo electrónico o realiza una llamada entrante hacia el equipo.</span>
              </div>
            </div>

            <div class="p-3 bg-indigo-50/60 border border-indigo-200/80 rounded-sm flex items-start gap-3">
              <span class="text-base shrink-0">🤖</span>
              <div>
                <span class="font-bold text-indigo-950 block">2. Gestiones Agénticas de IA</span>
                <span class="text-indigo-800 text-[11px]">Conversaciones donde interviene el Agente IA de Negozona para calificar, solicitar datos o interactuar con el prospecto.</span>
              </div>
            </div>

            <div class="p-3 bg-sky-50/60 border border-sky-200/80 rounded-sm flex items-start gap-3">
              <span class="text-base shrink-0">👤</span>
              <div>
                <span class="font-bold text-sky-950 block">3. Asignación de Leads</span>
                <span class="text-sky-800 text-[11px]">Cuando un administrador te designa como responsable comercial de un lead nuevo o reasignado.</span>
              </div>
            </div>

            <div class="p-3 bg-purple-50/60 border border-purple-200/80 rounded-sm flex items-start gap-3">
              <span class="text-base shrink-0">🛤️</span>
              <div>
                <span class="font-bold text-purple-950 block">4. Cambios de Etapa en Pipeline</span>
                <span class="text-purple-800 text-[11px]">Avances o transiciones en el embudo comercial (ej. calificado, reunión acordada, propuesta enviada).</span>
              </div>
            </div>

            <div class="p-3 bg-amber-50/60 border border-amber-200/80 rounded-sm flex items-start gap-3">
              <span class="text-base shrink-0">📢</span>
              <div>
                <span class="font-bold text-amber-950 block">5. Estado de Campañas Masivas</span>
                <span class="text-amber-800 text-[11px]">Avisos generales cuando se programa, ejecuta o finaliza una campaña de difusión por WhatsApp o Mailing.</span>
              </div>
            </div>
          </div>

          <!-- Highlight: Exclusión de Salientes -->
          <div class="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-sm flex items-start gap-3">
            <span class="text-base shrink-0">🛡️</span>
            <div>
              <span class="font-bold text-emerald-950 block">Política de No Saturación (Gestiones Salientes)</span>
              <p class="text-emerald-900 text-[11px] mt-0.5 leading-normal">
                Las gestiones de salida (envío de correos individuales, respuestas comerciales manuales o campañas masivas a cientos de contactos) 
                <strong>se registran íntegramente en la ficha de cada Lead (<code class="font-mono text-[10px] bg-emerald-100/70 px-1 py-0.5 rounded">lead_interactions</code>)</strong> 
                y en las métricas comerciales, pero <strong>no emiten alertas en la campanita ni en el sidebar</strong> para no desviar la atención ni saturar al equipo.
              </p>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3 border-t border-[#d9d9dd] bg-neutral-50/80 flex items-center justify-end">
          <button id="ok-criteria-modal-btn" class="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-sans text-xs font-semibold rounded-xs transition-colors cursor-pointer shadow-2xs">
            Entendido
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#close-criteria-modal-btn');
    const okBtn = overlay.querySelector('#ok-criteria-modal-btn');

    function closeModal() {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    }

    function handleKey(e) {
      if (e.key === 'Escape') closeModal();
    }

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', handleKey);
  }

  // Filter and paginate records
  function getFilteredNotifications() {
    return notifications.filter(n => {
      // Status filter
      if (statusFilter === 'unread' && n.is_read) return false;
      if (statusFilter === 'read' && !n.is_read) return false;

      // Type filter
      if (typeFilter === 'agentic_interaction' && !(n.type === 'agentic_interaction' || (n.title || '').includes('🤖') || (n.title || '').toLowerCase().includes('agente ia'))) return false;
      if (typeFilter === 'lead_interaction' && n.type !== 'lead_interaction') return false;
      if (typeFilter === 'lead_assigned' && n.type !== 'lead_assigned') return false;
      if (typeFilter === 'stage_changed' && n.type !== 'stage_changed') return false;
      if (typeFilter === 'campaign' && !(n.type === 'campaign_created' || n.type === 'campaign_status')) return false;
      if (typeFilter === 'system' && ['lead_interaction', 'agentic_interaction', 'lead_assigned', 'stage_changed', 'campaign_created', 'campaign_status'].includes(n.type)) return false;

      // Search text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const msgMatch = (n.message || '').toLowerCase().includes(q);
        
        let leadMatch = false;
        if (n.lead_id) {
          const lead = cache.getLeads().find(l => l.id === n.lead_id);
          if (lead?.company && lead.company.toLowerCase().includes(q)) leadMatch = true;
        }

        return titleMatch || msgMatch || leadMatch;
      }

      return true;
    });
  }

  // Resolve type badge element
  function renderTypeBadge(n) {
    const type = n.type || '';
    const title = (n.title || '').toLowerCase();

    if (type === 'agentic_interaction' || title.includes('🤖') || title.includes('agente ia') || title.includes('ia ·')) {
      return `
        <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-sm shrink-0">
          <span>🤖</span>
          <span>Gestión Agéntica</span>
        </span>
      `;
    }

    if (type === 'lead_interaction') {
      const isOutbound = title.includes('saliente');
      let medium = 'Gestión';
      let icon = '💬';

      if (title.includes('whatsapp')) {
        medium = 'WhatsApp';
        icon = '🟢';
      } else if (title.includes('email') || title.includes('mail')) {
        medium = 'Email';
        icon = '✉️';
      } else if (title.includes('llamada') || title.includes('teléfono') || title.includes('telefono')) {
        medium = 'Llamada';
        icon = '📞';
      } else if (title.includes('meet')) {
        medium = 'Meet';
        icon = '💻';
      } else if (title.includes('linkedin')) {
        medium = 'LinkedIn';
        icon = '🔗';
      }

      if (isOutbound) {
        return `
          <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-600 bg-neutral-100 border border-neutral-300 px-2 py-0.5 rounded-sm shrink-0">
            <span>${icon}</span>
            <span>${medium} Saliente</span>
          </span>
        `;
      }

      return `
        <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm shrink-0">
          <span>${icon}</span>
          <span>${medium} Entrante</span>
        </span>
      `;
    }

    if (type === 'lead_assigned') {
      return `
        <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-sm shrink-0">
          <span>👤</span>
          <span>Asignación</span>
        </span>
      `;
    }

    if (type === 'stage_changed') {
      return `
        <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-sm shrink-0">
          <span>🛤️</span>
          <span>Etapa</span>
        </span>
      `;
    }

    if (type === 'campaign_created') {
      return `
        <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-sm shrink-0">
          <span>📢</span>
          <span>Nueva Campaña</span>
        </span>
      `;
    }

    if (type === 'campaign_status') {
      return `
        <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm shrink-0">
          <span>📊</span>
          <span>Estado Campaña</span>
        </span>
      `;
    }

    return `
      <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-sm shrink-0">
        <span>ℹ️</span>
        <span>Sistema</span>
      </span>
    `;
  }

  // Main Render function
  function render() {
    if (isLoading) {
      container.innerHTML = renderSkeleton();
      return;
    }

    const filtered = getFilteredNotifications();
    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;

    // Boundary check for current page
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + rowsPerPage);

    // KPI Metrics calculation (coherentes con alertas prioritarias)
    const totalUnread = notifications.filter(n => !n.is_read).length;
    const totalCustomerReplies = notifications.filter(n => n.type === 'lead_interaction' || n.type === 'agentic_interaction').length;
    const totalPipelineAndCampaigns = notifications.filter(n => ['lead_assigned', 'stage_changed', 'campaign_created', 'campaign_status'].includes(n.type)).length;

    container.innerHTML = `
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-5">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🔔</span>
            <h1 class="text-xl font-bold text-primary font-display tracking-tight">Historial de Notificaciones</h1>
          </div>
          <p class="text-neutral-500 text-xs">
            Auditoría de respuestas entrantes de prospectos, gestiones agénticas IA, asignaciones, pipeline y campañas.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button 
            id="notifs-criteria-help-btn" 
            type="button" 
            class="px-3 py-2 border border-primary/20 hover:border-primary text-primary font-sans font-semibold text-xs rounded-xs bg-primary/5 hover:bg-primary/10 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Conocer qué eventos generan notificaciones en el CRM"
          >
            <span class="text-xs">ℹ️</span>
            <span>¿Qué se notifica?</span>
          </button>

          <button 
            id="mark-all-read-btn" 
            type="button" 
            class="px-3.5 py-2 border border-[#d9d9dd] hover:border-primary text-neutral-700 hover:text-primary font-sans font-semibold text-xs rounded-xs bg-white transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
            title="Marcar todas las notificaciones como leídas"
          >
            <span>✓✓</span>
            <span>Marcar todas leídas</span>
          </button>

          <button 
            id="refresh-notifs-btn" 
            type="button" 
            class="px-3 py-2 border border-[#d9d9dd] hover:border-primary text-neutral-700 hover:text-primary font-mono font-bold text-[11px] uppercase rounded-xs bg-white transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Actualizar notificaciones"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between shadow-2xs">
          <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Total Registradas</span>
          <div class="flex items-baseline justify-between mt-2">
            <span class="text-2xl font-bold font-display text-primary">${notifications.length}</span>
            <span class="text-xs text-neutral-400 font-mono">en período</span>
          </div>
        </div>

        <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between shadow-2xs">
          <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">No Leídas</span>
          <div class="flex items-baseline justify-between mt-2">
            <span class="text-2xl font-bold font-display ${totalUnread > 0 ? 'text-coral' : 'text-primary'}">${totalUnread}</span>
            <span class="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-sm ${totalUnread > 0 ? 'bg-coral/10 text-coral' : 'bg-neutral-100 text-neutral-500'}">
              ${totalUnread > 0 ? 'Pendientes' : 'Al día'}
            </span>
          </div>
        </div>

        <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between shadow-2xs">
          <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Respuestas de Clientes</span>
          <div class="flex items-baseline justify-between mt-2">
            <span class="text-2xl font-bold font-display text-primary">${totalCustomerReplies}</span>
            <span class="text-xs text-neutral-400 font-mono">entrantes e IA</span>
          </div>
        </div>

        <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between shadow-2xs">
          <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Pipeline & Campañas</span>
          <div class="flex items-baseline justify-between mt-2">
            <span class="text-2xl font-bold font-display text-primary">${totalPipelineAndCampaigns}</span>
            <span class="text-xs text-neutral-400 font-mono">eventos clave</span>
          </div>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-2xs">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[240px]">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            🔍
          </span>
          <input 
            type="text" 
            id="search-notifs-input" 
            value="${searchQuery}" 
            placeholder="Buscar por empresa, título o contenido..." 
            class="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-[#d9d9dd] rounded-xs font-sans text-xs text-slate placeholder-neutral-400 focus:outline-none focus:border-primary focus:bg-white transition-colors"
          />
        </div>

        <!-- Dropdown Filters -->
        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Type Filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-mono font-bold uppercase text-muted">Tipo:</span>
            <select id="type-filter-select" class="px-2.5 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer">
              <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>Todos</option>
              <option value="lead_interaction" ${typeFilter === 'lead_interaction' ? 'selected' : ''}>💬 Respuestas de Clientes (Entrantes)</option>
              <option value="agentic_interaction" ${typeFilter === 'agentic_interaction' ? 'selected' : ''}>🤖 Gestiones Agénticas (IA)</option>
              <option value="lead_assigned" ${typeFilter === 'lead_assigned' ? 'selected' : ''}>👤 Asignaciones</option>
              <option value="stage_changed" ${typeFilter === 'stage_changed' ? 'selected' : ''}>🛤️ Cambios de Etapa</option>
              <option value="campaign" ${typeFilter === 'campaign' ? 'selected' : ''}>📢 Campañas</option>
              <option value="system" ${typeFilter === 'system' ? 'selected' : ''}>⚙️ Sistema / Otros</option>
            </select>
          </div>

          <!-- Status Filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-mono font-bold uppercase text-muted">Estado:</span>
            <select id="status-filter-select" class="px-2.5 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer">
              <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Todas</option>
              <option value="unread" ${statusFilter === 'unread' ? 'selected' : ''}>Solo No Leídas</option>
              <option value="read" ${statusFilter === 'read' ? 'selected' : ''}>Solo Leídas</option>
            </select>
          </div>

          <!-- Period Filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-mono font-bold uppercase text-muted">Período:</span>
            <select id="period-filter-select" class="px-2.5 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer">
              <option value="today" ${dateRangeFilter === 'today' ? 'selected' : ''}>Hoy (24h)</option>
              <option value="7d" ${dateRangeFilter === '7d' ? 'selected' : ''}>Últimos 7 días</option>
              <option value="30d" ${dateRangeFilter === '30d' ? 'selected' : ''}>Últimos 30 días</option>
              <option value="all" ${dateRangeFilter === 'all' ? 'selected' : ''}>Todo el historial</option>
            </select>
          </div>

          <!-- Scope Filter (Admins only) -->
          ${isAdmin ? `
            <div class="flex items-center gap-1.5 border-l border-neutral-200 pl-2.5 ml-1">
              <span class="text-[10px] font-mono font-bold uppercase text-muted">Alcance:</span>
              <select id="scope-filter-select" class="px-2.5 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer">
                <option value="mine" ${scope === 'mine' ? 'selected' : ''}>Mis Notificaciones</option>
                <option value="all" ${scope === 'all' ? 'selected' : ''}>Todo el Equipo</option>
              </select>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Notifications Table -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm shadow-2xs overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-[#d9d9dd] bg-neutral-50/80 text-[11px] font-bold text-muted uppercase tracking-wider font-mono">
                <th class="py-3 px-3 text-center w-12" title="Estado de lectura">Leída</th>
                <th class="py-3 px-4 w-44">Fecha / Hora</th>
                <th class="py-3 px-4 w-44">Tipo / Canal</th>
                <th class="py-3 px-4 min-w-[260px]">Título & Detalle</th>
                <th class="py-3 px-4 w-48">Empresa / Lead</th>
                <th class="py-3 px-4 text-right w-40">Acciones</th>
              </tr>
            </thead>
            <tbody id="notifications-tbody" class="divide-y divide-[#d9d9dd] text-xs text-slate">
              ${paginatedItems.length === 0 ? `
                <tr>
                  <td colspan="6" class="py-12 text-center text-neutral-400">
                    <div class="flex flex-col items-center justify-center gap-2">
                      <span class="text-3xl">🔔</span>
                      <span class="font-semibold text-neutral-600">No se encontraron notificaciones</span>
                      <p class="text-[11px] text-muted max-w-sm">No hay notificaciones que coincidan con los criterios o filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              ` : paginatedItems.map(n => {
                const isUnread = !n.is_read;
                const dateFormatted = formatDateTime(n.created_at);
                const timeAgo = formatTimeAgo(n.created_at);
                const typeBadgeHtml = renderTypeBadge(n);

                // Resolve company name from cache or title
                let companyName = null;
                let leadId = n.lead_id || null;

                if (leadId) {
                  const leadObj = cache.getLeads().find(l => l.id === leadId);
                  if (leadObj?.company) {
                    companyName = leadObj.company;
                  }
                }

                if (!companyName && n.title && n.title.includes('·')) {
                  const parts = n.title.split('·');
                  if (parts.length > 1) {
                    companyName = parts[parts.length - 1].trim();
                  }
                }

                return `
                  <tr data-id="${n.id}" class="transition-colors hover:bg-neutral-50/80 ${isUnread ? 'bg-[#f4f7fd] font-medium' : ''}">
                    <!-- Unread dot -->
                    <td class="py-3.5 px-3 text-center align-top">
                      <button 
                        type="button" 
                        class="toggle-read-btn cursor-pointer p-1 text-xs focus:outline-none transition-transform hover:scale-125" 
                        data-id="${n.id}" 
                        data-read="${n.is_read}" 
                        title="${isUnread ? 'Marcar como leída' : 'Marcar como no leída'}"
                      >
                        ${isUnread 
                          ? '<span class="inline-block w-2.5 h-2.5 rounded-full bg-coral ring-4 ring-coral/20"></span>' 
                          : '<span class="inline-block w-2 h-2 rounded-full bg-neutral-300"></span>'
                        }
                      </button>
                    </td>

                    <!-- Date & Time -->
                    <td class="py-3.5 px-4 align-top whitespace-nowrap">
                      <div class="flex flex-col">
                        <span class="font-mono text-xs text-primary">${dateFormatted}</span>
                        <span class="text-[10px] text-muted font-sans">${timeAgo}</span>
                      </div>
                    </td>

                    <!-- Type Badge -->
                    <td class="py-3.5 px-4 align-top whitespace-nowrap">
                      ${typeBadgeHtml}
                    </td>

                    <!-- Title & Message -->
                    <td class="py-3.5 px-4 align-top">
                      <div class="flex flex-col gap-1 max-w-xl">
                        <span class="text-xs font-semibold text-primary">${n.title || 'Sin título'}</span>
                        ${n.message ? `<p class="text-[11px] text-neutral-600 leading-relaxed">${n.message}</p>` : ''}
                      </div>
                    </td>

                    <!-- Lead / Company -->
                    <td class="py-3.5 px-4 align-top">
                      ${leadId ? `
                        <button 
                          type="button" 
                          class="open-lead-btn flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-action-blue hover:underline cursor-pointer group text-left"
                          data-lead-id="${leadId}"
                          data-type="${n.type || ''}"
                          title="Ver ficha de ${companyName || 'Empresa'}"
                        >
                          <span class="text-xs group-hover:scale-110 transition-transform">🏢</span>
                          <span class="truncate max-w-[170px]">${companyName || 'Ver Lead'}</span>
                        </button>
                      ` : `
                        <span class="text-neutral-400 font-mono text-[11px]">—</span>
                      `}
                    </td>

                    <!-- Actions -->
                    <td class="py-3.5 px-4 align-top text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1.5">
                        ${leadId ? `
                          <button 
                            type="button" 
                            class="open-lead-btn px-2.5 py-1 bg-white border border-[#d9d9dd] hover:border-primary hover:bg-soft-stone text-primary rounded-xs font-sans text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                            data-lead-id="${leadId}"
                            data-type="${n.type || ''}"
                          >
                            <span>${n.type === 'lead_interaction' ? 'Ver Gestión' : 'Ver Lead'}</span>
                            <span class="font-mono text-[10px]">➔</span>
                          </button>
                        ` : (n.type === 'campaign_created' || n.type === 'campaign_status') ? `
                          <a 
                            href="#campaigns" 
                            class="px-2.5 py-1 bg-white border border-[#d9d9dd] hover:border-primary hover:bg-soft-stone text-primary rounded-xs font-sans text-[11px] font-semibold transition-colors shadow-2xs flex items-center gap-1"
                          >
                            <span>Campañas</span>
                            <span class="font-mono text-[10px]">➔</span>
                          </a>
                        ` : ''}

                        <button 
                          type="button" 
                          class="toggle-read-btn p-1 text-neutral-400 hover:text-primary transition-colors cursor-pointer"
                          data-id="${n.id}" 
                          data-read="${n.is_read}" 
                          title="${isUnread ? 'Marcar como leída' : 'Marcar como no leída'}"
                        >
                          ${isUnread ? '👁️' : '✉️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination Bar -->
        <div id="pagination-container" class="px-4 bg-white border-t border-[#d9d9dd]"></div>
      </div>
    `;

    // Render Pagination Component
    const paginationContainer = container.querySelector('#pagination-container');
    if (paginationContainer) {
      const paginationElement = renderPagination({
        currentPage,
        totalPages,
        rowsPerPage,
        onPageChange: (newPage) => {
          currentPage = newPage;
          render();
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        onRowsPerPageChange: (newRowsPerPage) => {
          rowsPerPage = newRowsPerPage;
          currentPage = 1;
          render();
        }
      });
      paginationContainer.appendChild(paginationElement);
    }

    // Attach Event Handlers

    // Search Input
    const searchInput = container.querySelector('#search-notifs-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        render();
        // Restore focus and cursor position
        const updatedInput = container.querySelector('#search-notifs-input');
        if (updatedInput) {
          updatedInput.focus();
          updatedInput.setSelectionRange(searchQuery.length, searchQuery.length);
        }
      });
    }

    // Type Filter Select
    const typeSelect = container.querySelector('#type-filter-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        typeFilter = e.target.value;
        currentPage = 1;
        render();
      });
    }

    // Status Filter Select
    const statusSelect = container.querySelector('#status-filter-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        currentPage = 1;
        render();
      });
    }

    // Period Filter Select
    const periodSelect = container.querySelector('#period-filter-select');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        dateRangeFilter = e.target.value;
        currentPage = 1;
        loadNotifications();
      });
    }

    // Scope Filter Select (Admins only)
    const scopeSelect = container.querySelector('#scope-filter-select');
    if (scopeSelect) {
      scopeSelect.addEventListener('change', (e) => {
        scope = e.target.value;
        currentPage = 1;
        loadNotifications();
      });
    }

    // Help Modal: Criterios de Notificación
    const helpBtn = container.querySelector('#notifs-criteria-help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', openCriteriaModal);
    }

    // Mark All As Read Button
    const markAllBtn = container.querySelector('#mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', markAllAsRead);
    }

    // Refresh Button
    const refreshBtn = container.querySelector('#refresh-notifs-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadNotifications();
      });
    }

    // Toggle Read Buttons
    container.querySelectorAll('.toggle-read-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const currentStatus = btn.dataset.read === 'true';
        toggleRead(id, currentStatus);
      });
    });

    // Open Lead Detail Buttons
    container.querySelectorAll('.open-lead-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const leadId = btn.dataset.leadId;
        const type = btn.dataset.type;
        openLead(leadId, type);
      });
    });
  }

  // Subscribe to Realtime Updates
  if (currentUser) {
    unsubscribeRealtime = realtime.subscribeToNotifications(currentUser.id, (newNotif) => {
      notifications.unshift(newNotif);
      syncSidebarBadge();
      render();
    });
  }

  // Cleanup handler when route changes
  container.cleanup = () => {
    if (unsubscribeRealtime) {
      unsubscribeRealtime();
      unsubscribeRealtime = null;
    }
  };

  // Initial Load
  loadNotifications();

  return container;
}
