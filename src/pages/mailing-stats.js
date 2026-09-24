import { supabase, fetchAllRows } from '../lib/supabase';
import { cache } from '../lib/cache';
import { toast } from '../components/toast';
import { renderLeadDetail } from './lead-detail';

// In-memory cache for email stats data to prevent unnecessary Supabase reads
let statsCache = {
  messages: null,
  events: null,
  campaigns: null,
  templates: null,
  timestamp: 0
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes in-memory cache
let isRefreshing = false;

// Sort state for each table
let sortState = {
  commercials: { column: 'sent', order: 'desc' },
  leads: { column: 'lastSentAt', order: 'desc' },
  campaigns: { column: 'sent', order: 'desc' }
};

let lastFilteredMessages = [];
let lastFilteredEvents = [];
let lastAllMessages = [];
let lastEmailCampaigns = [];
let lastLeadSearchQuery = '';
let lastSelectedSender = 'all';
let lastSelectedCountry = 'all';

export function renderMailingStats() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in font-sans pb-12 select-none';

  let selectedPeriod = '30d'; // '7d', '30d', 'month', 'all'
  let leadSearchQuery = '';
  let selectedSender = 'all';
  let selectedCountry = 'all';

  container.innerHTML = `
    <div class="space-y-6 select-none max-w-7xl mx-auto pb-12">
      <!-- Header Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-[#d9d9dd] shadow-xs">
        <div>
          <h1 class="text-xl font-bold text-slate tracking-tight flex items-center gap-2">
            <span>📊</span> Estadísticas Globales de Mailing B2B
          </h1>
          <p class="text-xs text-muted mt-1">
            Rendimiento general de envíos, tasa de interacción por comercial, desglose por lead y monitoreo de cuota Gmail Workspace.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <!-- Last updated info -->
          <span id="stats-last-updated" class="text-[11px] text-muted font-mono hidden sm:inline"></span>

          <!-- Filter Period -->
          <select id="stats-period-select" class="px-3 py-1.5 bg-soft-stone border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer">
            <option value="7d">Últimos 7 días</option>
            <option value="30d" selected>Últimos 30 días</option>
            <option value="month">Este mes</option>
            <option value="all">Histórico Completo</option>
          </select>

          <button id="refresh-stats-btn" class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#d9d9dd] hover:bg-soft-stone text-slate font-semibold text-xs rounded-xs transition-colors cursor-pointer" title="Actualizar datos desde la base de datos">
            <span id="refresh-stats-icon">🔄</span> <span id="refresh-stats-text">Actualizar</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div id="stats-kpi-container" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Rendered dynamically -->
        <div class="p-6 bg-white border border-[#d9d9dd] rounded-lg animate-pulse h-28"></div>
        <div class="p-6 bg-white border border-[#d9d9dd] rounded-lg animate-pulse h-28"></div>
        <div class="p-6 bg-white border border-[#d9d9dd] rounded-lg animate-pulse h-28"></div>
        <div class="p-6 bg-white border border-[#d9d9dd] rounded-lg animate-pulse h-28"></div>
      </div>

      <!-- Commercials Comparison Table -->
      <div class="bg-white rounded-lg border border-[#d9d9dd] shadow-xs overflow-hidden">
        <div class="p-4 sm:p-6 border-b border-[#d9d9dd] flex items-center justify-between bg-soft-stone/30">
          <div>
            <h2 class="text-sm font-bold text-slate tracking-tight flex items-center gap-2 uppercase">
              <span>👤</span> Desempeño por Comercial & Cuota Diaria Gmail
            </h2>
            <p class="text-[11px] text-muted mt-0.5">
              Cuota máxima estándar: <strong>2,000 correos diarios</strong> por cuenta de Google Workspace.
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-[#d9d9dd] bg-soft-stone/50 text-[11px] font-bold text-muted-slate uppercase tracking-wider select-none">
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-commercial="name">Comercial <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-commercial="email">Email Remitente <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-commercial="sent">Enviados <span class="sort-icon ml-1">▼</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-commercial="opens">Aperturas Detectadas <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-commercial="clicks">Clics <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-commercial="openRate">% Apertura <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-right cursor-pointer hover:text-primary transition-colors" data-sort-commercial="quotaToday">Cuota Usada Hoy <span class="sort-icon ml-1">↕</span></th>
              </tr>
            </thead>
            <tbody id="commercials-tbody" class="divide-y divide-[#d9d9dd] text-xs text-slate">
              <tr>
                <td colspan="7" class="py-8 text-center text-muted">Cargando datos de comerciales...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Lead and Contacts Breakdown Section -->
      <div class="bg-white rounded-lg border border-[#d9d9dd] shadow-xs overflow-hidden">
        <div class="p-4 sm:p-6 border-b border-[#d9d9dd] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-soft-stone/30">
          <div>
            <h2 class="text-sm font-bold text-slate tracking-tight flex items-center gap-2 uppercase">
              <span>🏢</span> Interacción por Lead / Contacto
            </h2>
            <p class="text-[11px] text-muted mt-0.5">
              Métricas acumuladas de cada contacto asociadas a su empresa o marca.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <!-- Filter by Sender -->
            <select id="lead-sender-select" class="px-2.5 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer max-w-[190px]">
              <option value="all">👤 Todos los remitentes</option>
            </select>

            <!-- Filter by Country -->
            <select id="lead-country-select" class="px-2.5 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer max-w-[160px]">
              <option value="all">🌍 Todos los países</option>
            </select>

            <!-- Search input -->
            <div class="relative w-full sm:w-64">
              <input type="text" id="lead-search-input" placeholder="Buscar por Lead, Contacto..." value="${leadSearchQuery}" class="w-full pl-8 pr-3 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs text-slate focus:outline-none focus:border-primary">
              <span class="absolute left-2.5 top-2 text-xs text-muted">🔍</span>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto max-h-96 overflow-y-auto">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-soft-stone z-10 border-b border-[#d9d9dd] text-[11px] font-bold text-muted-slate uppercase tracking-wider">
              <tr class="select-none">
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-lead="leadName">Lead / Empresa <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-lead="contactName">Contacto <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-lead="email">Email <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-lead="template">Template <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-lead="sent">Enviados <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-lead="opens">Aperturas Detectadas <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-lead="clicks">Clics <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-right cursor-pointer hover:text-primary transition-colors" data-sort-lead="lastSentAt">Último Envío <span class="sort-icon ml-1">▼</span></th>
              </tr>
            </thead>
            <tbody id="leads-breakdown-tbody" class="divide-y divide-[#d9d9dd] text-xs text-slate">
              <tr>
                <td colspan="8" class="py-8 text-center text-muted">Cargando desglose de contactos...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Email Campaigns Section -->
      <div class="bg-white rounded-lg border border-[#d9d9dd] shadow-xs overflow-hidden">
        <div class="p-4 sm:p-6 border-b border-[#d9d9dd] flex items-center justify-between bg-soft-stone/30">
          <div>
            <h2 class="text-sm font-bold text-slate tracking-tight flex items-center gap-2 uppercase">
              <span>📢</span> Rendimiento por Campaña de Mailing
            </h2>
            <p class="text-[11px] text-muted mt-0.5">
              Comparativa de resultados de campañas masivas de correo electrónico.
            </p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-[#d9d9dd] bg-soft-stone/50 text-[11px] font-bold text-muted-slate uppercase tracking-wider select-none">
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-campaign="name">Campaña <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 cursor-pointer hover:text-primary transition-colors" data-sort-campaign="status">Estado <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-campaign="total_found">Audiencia <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-campaign="sent">Enviados <span class="sort-icon ml-1">▼</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-campaign="opens">Aperturas <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-center cursor-pointer hover:text-primary transition-colors" data-sort-campaign="clicks">Clics <span class="sort-icon ml-1">↕</span></th>
                <th class="py-3 px-4 text-right cursor-pointer hover:text-primary transition-colors" data-sort-campaign="openRate">% Apertura <span class="sort-icon ml-1">↕</span></th>
              </tr>
            </thead>
            <tbody id="campaigns-tbody" class="divide-y divide-[#d9d9dd] text-xs text-slate">
              <tr>
                <td colspan="7" class="py-8 text-center text-muted">Cargando campañas de mailing...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const periodSelect = container.querySelector('#stats-period-select');
  const refreshBtn = container.querySelector('#refresh-stats-btn');
  const leadSearchInput = container.querySelector('#lead-search-input');

  periodSelect.addEventListener('change', (e) => {
    selectedPeriod = e.target.value;
    loadAndRenderStats(container, selectedPeriod, leadSearchQuery, false, false);
  });

  refreshBtn.addEventListener('click', () => {
    loadAndRenderStats(container, selectedPeriod, leadSearchQuery, true, true);
  });

  const leadSenderSelect = container.querySelector('#lead-sender-select');
  const leadCountrySelect = container.querySelector('#lead-country-select');

  leadSearchInput.addEventListener('input', (e) => {
    leadSearchQuery = e.target.value.toLowerCase().trim();
    lastLeadSearchQuery = leadSearchQuery;
    renderLeadsBreakdown(container, leadSearchQuery, selectedPeriod, selectedSender, selectedCountry);
  });

  if (leadSenderSelect) {
    leadSenderSelect.addEventListener('change', (e) => {
      selectedSender = e.target.value;
      lastSelectedSender = selectedSender;
      renderLeadsBreakdown(container, leadSearchQuery, selectedPeriod, selectedSender, selectedCountry);
    });
  }

  if (leadCountrySelect) {
    leadCountrySelect.addEventListener('change', (e) => {
      selectedCountry = e.target.value;
      lastSelectedCountry = selectedCountry;
      renderLeadsBreakdown(container, leadSearchQuery, selectedPeriod, selectedSender, selectedCountry);
    });
  }

  // Attach sort handlers on table headers
  attachSortListeners(container, () => selectedPeriod, () => leadSearchQuery, () => selectedSender, () => selectedCountry);

  // Initial load
  loadAndRenderStats(container, selectedPeriod, leadSearchQuery, false, false);

  return container;
}

// Global cached dataset for lead breakdown rendering
let currentLeadBreakdownData = [];

function getSortIndicator(tableKey, column) {
  if (sortState[tableKey].column !== column) return '<span class="text-neutral-300 opacity-60">↕</span>';
  return sortState[tableKey].order === 'asc' ? '<span class="text-primary font-bold">▲</span>' : '<span class="text-primary font-bold">▼</span>';
}

function updateHeaders(container) {
  container.querySelectorAll('[data-sort-commercial]').forEach(th => {
    const col = th.dataset.sortCommercial;
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.innerHTML = getSortIndicator('commercials', col);
  });
  container.querySelectorAll('[data-sort-lead]').forEach(th => {
    const col = th.dataset.sortLead;
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.innerHTML = getSortIndicator('leads', col);
  });
  container.querySelectorAll('[data-sort-campaign]').forEach(th => {
    const col = th.dataset.sortCampaign;
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.innerHTML = getSortIndicator('campaigns', col);
  });
}

function attachSortListeners(container, getPeriod, getSearchQuery, getSender, getCountry) {
  container.querySelectorAll('[data-sort-commercial]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sortCommercial;
      if (sortState.commercials.column === col) {
        sortState.commercials.order = sortState.commercials.order === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.commercials.column = col;
        sortState.commercials.order = (col === 'name' || col === 'email') ? 'asc' : 'desc';
      }
      updateHeaders(container);
      renderCommercials(container, lastFilteredMessages, lastFilteredEvents, lastAllMessages);
    });
  });

  container.querySelectorAll('[data-sort-lead]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sortLead;
      if (sortState.leads.column === col) {
        sortState.leads.order = sortState.leads.order === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.leads.column = col;
        sortState.leads.order = (col === 'leadName' || col === 'contactName' || col === 'email' || col === 'template') ? 'asc' : 'desc';
      }
      updateHeaders(container);
      const senderVal = getSender ? getSender() : lastSelectedSender;
      const countryVal = getCountry ? getCountry() : lastSelectedCountry;
      renderLeadsBreakdown(container, getSearchQuery(), getPeriod(), senderVal, countryVal);
    });
  });

  container.querySelectorAll('[data-sort-campaign]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sortCampaign;
      if (sortState.campaigns.column === col) {
        sortState.campaigns.order = sortState.campaigns.order === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.campaigns.column = col;
        sortState.campaigns.order = (col === 'name' || col === 'status') ? 'asc' : 'desc';
      }
      updateHeaders(container);
      renderCampaignsTable(container, lastEmailCampaigns, lastFilteredMessages, lastFilteredEvents);
    });
  });
}

async function loadAndRenderStats(container, period, searchQuery, forceRefresh = false, isUserAction = false) {
  if (isRefreshing) return;

  const now = new Date();
  const isCacheValid = !forceRefresh && statsCache.messages && (now.getTime() - statsCache.timestamp < CACHE_TTL_MS);

  const refreshBtn = container.querySelector('#refresh-stats-btn');
  const refreshIcon = container.querySelector('#refresh-stats-icon');
  const refreshText = container.querySelector('#refresh-stats-text');
  const kpiContainer = container.querySelector('#stats-kpi-container');

  const setButtonLoading = (loading) => {
    if (!refreshBtn) return;
    refreshBtn.disabled = loading;
    if (loading) {
      refreshBtn.classList.add('opacity-70', 'cursor-not-allowed');
      if (refreshIcon) refreshIcon.classList.add('animate-spin', 'inline-block');
      if (refreshText) refreshText.textContent = 'Actualizando...';
      if (kpiContainer) kpiContainer.classList.add('opacity-60', 'transition-opacity', 'duration-200');
    } else {
      refreshBtn.classList.remove('opacity-70', 'cursor-not-allowed');
      if (refreshIcon) refreshIcon.classList.remove('animate-spin', 'inline-block');
      if (refreshText) refreshText.textContent = 'Actualizar';
      if (kpiContainer) kpiContainer.classList.remove('opacity-60');
    }
  };

  if (!isCacheValid) {
    isRefreshing = true;
    setButtonLoading(true);

    try {
      const [msgsData, eventsData, campaignsData, templatesData] = await Promise.all([
        fetchAllRows(
          'email_messages',
          'id, status, created_at, sent_at, sender_profile_id, sender_email, lead_id, contact_id, recipient_email, campaign_id, template_id, subject',
          { orderCol: 'created_at', ascending: false }
        ),
        fetchAllRows(
          'email_events',
          'id, email_message_id, event_type, created_at, campaign_id',
          { orderCol: 'created_at', ascending: false }
        ),
        fetchAllRows(
          'campaigns',
          'id, name, status, total_found, total_sent, email_template_id',
          { filterCol: 'channel', filterVal: 'email', orderCol: 'created_at', ascending: false }
        ),
        fetchAllRows(
          'email_templates',
          'id, name, subject',
          { orderCol: 'name', ascending: true }
        )
      ]);

      statsCache = {
        messages: msgsData || [],
        events: eventsData || [],
        campaigns: campaignsData || [],
        templates: templatesData || [],
        timestamp: now.getTime()
      };

      if (isUserAction) {
        toast.show('Estadísticas actualizadas con éxito', 'success');
      }
    } catch (err) {
      console.error('Error fetching email statistics:', err);
      toast.show('Error al actualizar estadísticas: ' + (err.message || 'Error de conexión'), 'error');
    } finally {
      isRefreshing = false;
      setButtonLoading(false);
    }
  }

  // Update last-updated timestamp label
  const lastUpdatedEl = container.querySelector('#stats-last-updated');
  if (lastUpdatedEl) {
    const timeStr = new Date(statsCache.timestamp || now.getTime()).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    lastUpdatedEl.textContent = `Actualizado ${timeStr}`;
    lastUpdatedEl.title = `Última sincronización con la base de datos: ${timeStr}`;
  }

  // Filter messages by selected period
  let periodStartDate = null;
  if (period === '7d') {
    periodStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === '30d') {
    periodStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    periodStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const allMessages = statsCache.messages || [];
  const allEvents = statsCache.events || [];
  const emailCampaigns = statsCache.campaigns || [];

  const filteredMessages = periodStartDate
    ? allMessages.filter(m => new Date(m.created_at || m.sent_at) >= periodStartDate)
    : allMessages;

  const filteredMsgIds = new Set(filteredMessages.map(m => m.id));
  const filteredEvents = periodStartDate
    ? allEvents.filter(e => filteredMsgIds.has(e.email_message_id) || new Date(e.created_at) >= periodStartDate)
    : allEvents;

  lastFilteredMessages = filteredMessages;
  lastFilteredEvents = filteredEvents;
  lastAllMessages = allMessages;
  lastEmailCampaigns = emailCampaigns;
  lastLeadSearchQuery = searchQuery;

  updateHeaders(container);

  // Render KPI Summary
  renderKpis(container, filteredMessages, filteredEvents, allMessages);

  // Render Commercials Comparison Table
  renderCommercials(container, filteredMessages, filteredEvents, allMessages);

  // Prepare Lead Breakdown Data and Render
  prepareLeadBreakdownData(filteredMessages, filteredEvents, statsCache.templates || [], emailCampaigns);
  populateLeadFilterDropdowns(container, currentLeadBreakdownData, lastSelectedSender, lastSelectedCountry);
  renderLeadsBreakdown(container, searchQuery, period, lastSelectedSender, lastSelectedCountry);

  // Render Email Campaigns Table
  renderCampaignsTable(container, emailCampaigns, filteredMessages, filteredEvents);
}

function renderKpis(container, messages, events, allMessages) {
  const kpiContainer = container.querySelector('#stats-kpi-container');
  if (!kpiContainer) return;

  const totalSent = messages.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;
  
  const openEvents = events.filter(e => e.event_type === 'OPEN_DETECTED');
  const clickEvents = events.filter(e => e.event_type === 'CLICKED');

  const uniqueOpens = new Set(openEvents.map(e => e.email_message_id)).size;
  const uniqueClicks = new Set(clickEvents.map(e => e.email_message_id)).size;

  const openRate = totalSent > 0 ? ((uniqueOpens / totalSent) * 100).toFixed(1) : '0.0';
  const clickRate = totalSent > 0 ? ((uniqueClicks / totalSent) * 100).toFixed(1) : '0.0';

  // Gmail Quota Today
  const todayStr = new Date().toISOString().split('T')[0];
  const sentToday = allMessages.filter(m => (m.status === 'SENT' || m.status === 'QUEUED') && (m.created_at || '').startsWith(todayStr)).length;
  
  const profiles = cache.getProfiles() || [];
  const mailingSenders = profiles.filter(p => p.is_mailing_sender);
  const activeSendersCount = Math.max(mailingSenders.length, 1);
  const maxQuotaToday = activeSendersCount * 2000;
  const quotaPercent = ((sentToday / maxQuotaToday) * 100).toFixed(1);

  kpiContainer.innerHTML = `
    <!-- Total Sent -->
    <div class="p-5 bg-white border border-[#d9d9dd] rounded-lg shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-slate">Total Enviados</span>
        <span class="text-lg">📧</span>
      </div>
      <div class="mt-3">
        <div class="text-2xl font-extrabold text-slate">${totalSent.toLocaleString()}</div>
        <div class="text-[11px] text-muted mt-0.5">Correos procesados</div>
      </div>
    </div>

    <!-- Aperturas Detectadas -->
    <div class="p-5 bg-white border border-[#d9d9dd] rounded-lg shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-slate">Aperturas Detectadas</span>
        <span class="text-lg">👁️</span>
      </div>
      <div class="mt-3">
        <div class="text-2xl font-extrabold text-emerald-600">${uniqueOpens.toLocaleString()} <span class="text-xs font-semibold text-emerald-600/80">(${openRate}%)</span></div>
        <div class="text-[11px] text-muted mt-0.5">Basado en píxel de seguimiento</div>
      </div>
    </div>

    <!-- Clics Detectados -->
    <div class="p-5 bg-white border border-[#d9d9dd] rounded-lg shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-slate">Clics en Enlaces</span>
        <span class="text-lg">🔗</span>
      </div>
      <div class="mt-3">
        <div class="text-2xl font-extrabold text-primary">${uniqueClicks.toLocaleString()} <span class="text-xs font-semibold text-primary/80">(${clickRate}%)</span></div>
        <div class="text-[11px] text-muted mt-0.5">Interacciones con propuesta</div>
      </div>
    </div>

    <!-- Cuota Gmail Hoy -->
    <div class="p-5 bg-white border border-[#d9d9dd] rounded-lg shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-slate">Cuota Gmail Hoy</span>
        <span class="text-lg">⚡</span>
      </div>
      <div class="mt-3">
        <div class="text-2xl font-extrabold text-slate">${sentToday.toLocaleString()} <span class="text-xs font-normal text-muted">/ ${maxQuotaToday.toLocaleString()}</span></div>
        <div class="w-full bg-soft-stone h-1.5 rounded-full mt-2 overflow-hidden">
          <div class="bg-primary h-full transition-all duration-300" style="width: ${Math.min(quotaPercent, 100)}%"></div>
        </div>
      </div>
    </div>
  `;
}

function renderCommercials(container, messages, events, allMessages) {
  const tbody = container.querySelector('#commercials-tbody');
  if (!tbody) return;

  const profiles = cache.getProfiles() || [];
  let senders = profiles.filter(p => p.is_mailing_sender || p.mailing_email);
  if (senders.length === 0) {
    senders = profiles.filter(p => p.is_active !== false); // Fallback to active profiles
  }

  if (senders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-muted italic">No hay comerciales configurados como remitentes de mailing.</td>
      </tr>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const commercialsData = senders.map(p => {
    const senderEmail = (p.mailing_email || p.email || '').toLowerCase();
    
    // Messages by this commercial
    const userMsgs = messages.filter(m => (m.sender_profile_id === p.id) || (m.sender_email || '').toLowerCase() === senderEmail);
    const userMsgIds = new Set(userMsgs.map(m => m.id));

    const totalSent = userMsgs.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;

    const userEvents = events.filter(e => userMsgIds.has(e.email_message_id));
    const opens = new Set(userEvents.filter(e => e.event_type === 'OPEN_DETECTED').map(e => e.email_message_id)).size;
    const clicks = new Set(userEvents.filter(e => e.event_type === 'CLICKED').map(e => e.email_message_id)).size;

    const openRateNum = totalSent > 0 ? ((opens / totalSent) * 100) : 0;
    const openRate = openRateNum.toFixed(1);

    // Sent today by this commercial
    const userMsgsToday = allMessages.filter(m => {
      const matchProfile = (m.sender_profile_id === p.id) || (m.sender_email || '').toLowerCase() === senderEmail;
      const isToday = (m.created_at || '').startsWith(todayStr);
      return matchProfile && isToday && (m.status === 'SENT' || m.status === 'QUEUED');
    }).length;

    const limit = 2000;
    const usedPct = Math.min(((userMsgsToday / limit) * 100), 100).toFixed(1);

    return {
      name: p.full_name || 'Comercial',
      email: senderEmail,
      sent: totalSent,
      opens,
      clicks,
      openRate: parseFloat(openRate),
      openRateStr: `${openRate}%`,
      quotaToday: userMsgsToday,
      usedPct
    };
  });

  commercialsData.sort((a, b) => {
    let valA = a[sortState.commercials.column];
    let valB = b[sortState.commercials.column];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = (valB || '').toLowerCase();
    if (valA < valB) return sortState.commercials.order === 'asc' ? -1 : 1;
    if (valA > valB) return sortState.commercials.order === 'asc' ? 1 : -1;
    return 0;
  });

  const rowsHtml = commercialsData.map(c => `
    <tr class="hover:bg-soft-stone/30 transition-colors">
      <td class="py-3 px-4 font-bold text-slate">${c.name}</td>
      <td class="py-3 px-4 font-mono text-[11px] text-muted-slate">${c.email}</td>
      <td class="py-3 px-4 text-center font-semibold">${c.sent.toLocaleString()}</td>
      <td class="py-3 px-4 text-center font-semibold text-emerald-600">${c.opens.toLocaleString()}</td>
      <td class="py-3 px-4 text-center font-semibold text-primary">${c.clicks.toLocaleString()}</td>
      <td class="py-3 px-4 text-center font-bold text-slate">${c.openRateStr}</td>
      <td class="py-3 px-4 text-right">
        <div class="inline-flex flex-col items-end">
          <span class="font-mono text-xs font-bold">${c.quotaToday} / 2,000</span>
          <div class="w-24 bg-soft-stone h-1.5 rounded-full mt-1 overflow-hidden">
            <div class="bg-primary h-full" style="width: ${c.usedPct}%"></div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = rowsHtml;
}

function prepareLeadBreakdownData(messages, events, templates = [], campaigns = []) {
  const leads = cache.getLeads() || [];
  const contactsMap = cache.contacts || new Map();
  const leadsMap = new Map(leads.map(l => [l.id, l]));

  const templatesMap = new Map((templates || []).map(t => [t.id, t.name]));
  const campaignTemplatesMap = new Map((campaigns || []).map(c => [c.id, c.email_template_id]));

  const msgMap = new Map(); // key: lead_id_contact_id or lead_id

  // Group messages
  for (const m of messages) {
    const key = `${m.lead_id}_${m.contact_id || 'primary'}`;
    if (!msgMap.has(key)) {
      msgMap.set(key, {
        lead_id: m.lead_id,
        contact_id: m.contact_id,
        recipient_email: m.recipient_email,
        messages: [],
        last_sent_at: m.created_at || m.sent_at
      });
    }
    const item = msgMap.get(key);
    item.messages.push(m);
    if (new Date(m.created_at || m.sent_at) > new Date(item.last_sent_at)) {
      item.last_sent_at = m.created_at || m.sent_at;
    }
  }

  const eventsMsgMap = new Map();
  for (const e of events) {
    if (!eventsMsgMap.has(e.email_message_id)) eventsMsgMap.set(e.email_message_id, []);
    eventsMsgMap.get(e.email_message_id).push(e);
  }

  currentLeadBreakdownData = [];

  for (const [key, item] of msgMap.entries()) {
    const lead = leadsMap.get(item.lead_id);
    const contact = item.contact_id ? contactsMap.get(item.contact_id) : null;

    const sentCount = item.messages.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;
    
    let opens = 0;
    let clicks = 0;

    for (const m of item.messages) {
      const mEvs = eventsMsgMap.get(m.id) || [];
      if (mEvs.some(e => e.event_type === 'OPEN_DETECTED')) opens++;
      if (mEvs.some(e => e.event_type === 'CLICKED')) clicks++;
    }

    // Resolve template names for this lead/contact
    const templateNamesSet = new Set();
    for (const m of item.messages) {
      let tName = null;
      if (m.template_id && templatesMap.has(m.template_id)) {
        tName = templatesMap.get(m.template_id);
      } else if (m.campaign_id && campaignTemplatesMap.has(m.campaign_id)) {
        const cTmplId = campaignTemplatesMap.get(m.campaign_id);
        if (cTmplId && templatesMap.has(cTmplId)) {
          tName = templatesMap.get(cTmplId);
        }
      }
      // Fallback matching by subject
      if (!tName && m.subject) {
        const cleanSubj = m.subject.toLowerCase();
        for (const t of templates) {
          const tSubj = (t.subject || '').toLowerCase().replace(/\{\{[^}]+\}\}/g, '').trim();
          if (tSubj.length > 5 && cleanSubj.includes(tSubj)) {
            tName = t.name;
            break;
          }
        }
      }
      if (tName) {
        templateNamesSet.add(tName);
      }
    }

    const senderIds = new Set();
    const senderEmails = new Set();
    for (const m of item.messages) {
      if (m.sender_profile_id) senderIds.add(m.sender_profile_id);
      if (m.sender_email) senderEmails.add(m.sender_email.toLowerCase());
    }

    const country = (lead?.country || '').trim() || 'Sin país';

    currentLeadBreakdownData.push({
      leadId: item.lead_id,
      leadName: lead?.company || 'Lead s/n',
      country,
      contactName: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : (lead?.company || 'Contacto Principal'),
      email: item.recipient_email || contact?.email || '-',
      templates: Array.from(templateNamesSet),
      senderProfileIds: Array.from(senderIds),
      senderEmails: Array.from(senderEmails),
      sent: sentCount,
      opens,
      clicks,
      lastSentAt: item.last_sent_at
    });
  }
}

function populateLeadFilterDropdowns(container, data, currentSender, currentCountry) {
  const senderSelect = container.querySelector('#lead-sender-select');
  const countrySelect = container.querySelector('#lead-country-select');
  if (!senderSelect || !countrySelect) return;

  const profiles = cache.getProfiles() || [];
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  // Build unique senders
  const sendersMap = new Map();
  for (const item of data) {
    for (const sId of item.senderProfileIds || []) {
      if (!sendersMap.has(sId)) {
        const prof = profilesMap.get(sId);
        const name = prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : null;
        sendersMap.set(sId, name ? `${name} (${prof?.email || 'Comercial'})` : (prof?.email || 'Comercial'));
      }
    }
    for (const sEmail of item.senderEmails || []) {
      const prof = profiles.find(p => p.email && p.email.toLowerCase() === sEmail.toLowerCase());
      if (prof) {
        if (!sendersMap.has(prof.id)) {
          const name = `${prof.first_name || ''} ${prof.last_name || ''}`.trim();
          sendersMap.set(prof.id, name ? `${name} (${prof.email})` : prof.email);
        }
      } else {
        if (!sendersMap.has(sEmail)) {
          sendersMap.set(sEmail, sEmail);
        }
      }
    }
  }

  // Build unique countries
  const countriesSet = new Set();
  let hasSinPais = false;
  for (const item of data) {
    if (item.country && item.country !== 'Sin país') {
      countriesSet.add(item.country);
    } else {
      hasSinPais = true;
    }
  }
  const sortedCountries = Array.from(countriesSet).sort((a, b) => a.localeCompare(b, 'es'));

  // Sender options
  let senderOptions = `<option value="all">👤 Todos los remitentes</option>`;
  for (const [val, label] of sendersMap.entries()) {
    senderOptions += `<option value="${val}" ${val === currentSender ? 'selected' : ''}>${label}</option>`;
  }
  senderSelect.innerHTML = senderOptions;

  // Country options
  let countryOptions = `<option value="all">🌍 Todos los países</option>`;
  for (const c of sortedCountries) {
    countryOptions += `<option value="${c}" ${c.toLowerCase() === (currentCountry || '').toLowerCase() ? 'selected' : ''}>${c}</option>`;
  }
  if (hasSinPais) {
    countryOptions += `<option value="Sin país" ${currentCountry === 'Sin país' ? 'selected' : ''}>Sin país especificado</option>`;
  }
  countrySelect.innerHTML = countryOptions;
}

function renderLeadsBreakdown(container, query, period, sender = lastSelectedSender, country = lastSelectedCountry) {
  const tbody = container.querySelector('#leads-breakdown-tbody');
  if (!tbody) return;

  const filtered = currentLeadBreakdownData.filter(d => {
    // Filter by sender
    if (sender && sender !== 'all') {
      const matchProfile = (d.senderProfileIds || []).includes(sender);
      const matchEmail = (d.senderEmails || []).some(e => e.toLowerCase() === sender.toLowerCase());
      if (!matchProfile && !matchEmail) return false;
    }

    // Filter by country
    if (country && country !== 'all') {
      if ((d.country || '').toLowerCase() !== country.toLowerCase()) return false;
    }

    if (!query) return true;
    const q = query.toLowerCase();
    const matchesTemplates = (d.templates || []).some(t => t.toLowerCase().includes(q));
    return d.leadName.toLowerCase().includes(q) || d.contactName.toLowerCase().includes(q) || d.email.toLowerCase().includes(q) || (d.country && d.country.toLowerCase().includes(q)) || matchesTemplates;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-6 text-center text-muted italic">No se encontraron registros de interacción para los filtros seleccionados.</td>
      </tr>
    `;
    return;
  }

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortState.leads.column];
    let valB = b[sortState.leads.column];
    if (sortState.leads.column === 'template') {
      valA = (a.templates && a.templates[0]) || '';
      valB = (b.templates && b.templates[0]) || '';
    }
    if (sortState.leads.column === 'lastSentAt') {
      valA = valA ? new Date(valA).getTime() : 0;
      valB = valB ? new Date(valB).getTime() : 0;
    } else if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = (valB || '').toLowerCase();
    }
    if (valA < valB) return sortState.leads.order === 'asc' ? -1 : 1;
    if (valA > valB) return sortState.leads.order === 'asc' ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = sorted.slice(0, 100).map(d => {
    const dateFormatted = d.lastSentAt ? new Date(d.lastSentAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

    const countryBadge = d.country && d.country !== 'Sin país'
      ? `<span class="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 shrink-0" title="País: ${d.country}">${d.country}</span>`
      : '';

    let templateBadge = `<span class="text-neutral-400 text-[11px]">—</span>`;
    if (d.templates && d.templates.length > 0) {
      const allTemplatesStr = d.templates.join(' | ');
      const firstTemplate = d.templates[0];
      const extraCount = d.templates.length > 1 ? ` (+${d.templates.length - 1})` : '';
      templateBadge = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-help max-w-[170px] truncate" title="Plantilla: ${allTemplatesStr}">
          <span>📄</span>
          <span class="truncate">${firstTemplate}</span>${extraCount}
        </span>
      `;
    }

    return `
      <tr class="hover:bg-soft-stone/30 transition-colors">
        <td class="py-2.5 px-4 font-bold text-slate">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${d.leadId ? `
              <button type="button" class="btn-open-lead-stats text-left font-bold text-slate hover:text-primary hover:underline cursor-pointer flex items-center gap-1 transition-colors" data-lead-id="${d.leadId}" title="Ver detalle de ${d.leadName}">
                <span>${d.leadName}</span>
                <span class="text-[10px] text-muted opacity-70">↗</span>
              </button>
            ` : `<span>${d.leadName}</span>`}
            ${countryBadge}
          </div>
        </td>
        <td class="py-2.5 px-4 font-medium text-slate">${d.contactName}</td>
        <td class="py-2.5 px-4 font-mono text-[11px] text-muted-slate">${d.email}</td>
        <td class="py-2.5 px-4 text-center">${templateBadge}</td>
        <td class="py-2.5 px-4 text-center font-semibold">${d.sent}</td>
        <td class="py-2.5 px-4 text-center font-semibold text-emerald-600">${d.opens}</td>
        <td class="py-2.5 px-4 text-center font-semibold text-primary">${d.clicks}</td>
        <td class="py-2.5 px-4 text-right text-[11px] text-muted">${dateFormatted}</td>
      </tr>
    `;
  }).join('');

  // Attach click listener to open lead detail modal
  tbody.querySelectorAll('.btn-open-lead-stats').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const leadId = btn.dataset.leadId;
      if (leadId) {
        renderLeadDetail(leadId, () => {
          loadAndRenderStats(container, period || '30d', query, true, false);
        });
      }
    });
  });
}

function renderCampaignsTable(container, emailCampaigns, messages, events) {
  const tbody = container.querySelector('#campaigns-tbody');
  if (!tbody) return;

  if (emailCampaigns.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-muted italic">No hay campañas de mailing registradas en la plataforma.</td>
      </tr>
    `;
    return;
  }

  const campaignsData = emailCampaigns.map(c => {
    const cMsgs = messages.filter(m => m.campaign_id === c.id);
    const cMsgIds = new Set(cMsgs.map(m => m.id));

    const totalSent = c.total_sent || cMsgs.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;
    const cEvents = events.filter(e => c.id === e.campaign_id || cMsgIds.has(e.email_message_id));
    
    const opens = new Set(cEvents.filter(e => e.event_type === 'OPEN_DETECTED').map(e => e.email_message_id)).size;
    const clicks = new Set(cEvents.filter(e => e.event_type === 'CLICKED').map(e => e.email_message_id)).size;

    const openRateNum = totalSent > 0 ? ((opens / totalSent) * 100) : 0;
    const openRate = openRateNum.toFixed(1);

    return {
      id: c.id,
      name: c.name || 'Sin Nombre',
      status: c.status || 'pendiente',
      total_found: c.total_found || 0,
      sent: totalSent,
      opens,
      clicks,
      openRate: parseFloat(openRate),
      openRateStr: `${openRate}%`
    };
  });

  campaignsData.sort((a, b) => {
    let valA = a[sortState.campaigns.column];
    let valB = b[sortState.campaigns.column];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = (valB || '').toLowerCase();
    if (valA < valB) return sortState.campaigns.order === 'asc' ? -1 : 1;
    if (valA > valB) return sortState.campaigns.order === 'asc' ? 1 : -1;
    return 0;
  });

  const rowsHtml = campaignsData.map(c => {
    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">${c.status}</span>`;
    if (c.status === 'finalizada') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">Finalizada</span>`;
    } else if (c.status === 'en_ejecucion') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">En Ejecución</span>`;
    } else if (c.status === 'programada') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">Programada</span>`;
    }

    return `
      <tr class="hover:bg-soft-stone/30 transition-colors">
        <td class="py-3 px-4 font-bold text-slate">
          <a href="#campaigns" class="hover:text-primary transition-colors">${c.name}</a>
        </td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-center font-semibold">${c.total_found}</td>
        <td class="py-3 px-4 text-center font-semibold">${c.sent}</td>
        <td class="py-3 px-4 text-center font-semibold text-emerald-600">${c.opens}</td>
        <td class="py-3 px-4 text-center font-semibold text-primary">${c.clicks}</td>
        <td class="py-3 px-4 text-right font-bold text-slate">${c.openRateStr}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}
