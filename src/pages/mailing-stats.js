import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';

// In-memory cache for email stats data to prevent unnecessary Supabase reads
let statsCache = {
  messages: null,
  events: null,
  campaigns: null,
  timestamp: 0
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes in-memory cache

export function renderMailingStats() {
  const container = document.createElement('div');
  container.className = 'animate-fade-in font-sans pb-12 select-none';

  let selectedPeriod = '30d'; // '7d', '30d', 'month', 'all'
  let leadSearchQuery = '';

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
          <!-- Filter Period -->
          <select id="stats-period-select" class="px-3 py-1.5 bg-soft-stone border border-[#d9d9dd] rounded-xs text-xs font-semibold text-slate focus:outline-none focus:border-primary cursor-pointer">
            <option value="7d">Últimos 7 días</option>
            <option value="30d" selected>Últimos 30 días</option>
            <option value="month">Este mes</option>
            <option value="all">Histórico Completo</option>
          </select>

          <button id="refresh-stats-btn" class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#d9d9dd] hover:bg-soft-stone text-slate font-semibold text-xs rounded-xs transition-colors cursor-pointer" title="Actualizar datos desde la base de datos">
            <span>🔄</span> Actualizar
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
              <tr class="border-b border-[#d9d9dd] bg-soft-stone/50 text-[11px] font-bold text-muted-slate uppercase tracking-wider">
                <th class="py-3 px-4">Comercial</th>
                <th class="py-3 px-4">Email Remitente</th>
                <th class="py-3 px-4 text-center">Enviados</th>
                <th class="py-3 px-4 text-center">Aperturas Detectadas</th>
                <th class="py-3 px-4 text-center">Clics</th>
                <th class="py-3 px-4 text-center">% Apertura</th>
                <th class="py-3 px-4 text-right">Cuota Usada Hoy</th>
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
        <div class="p-4 sm:p-6 border-b border-[#d9d9dd] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-soft-stone/30">
          <div>
            <h2 class="text-sm font-bold text-slate tracking-tight flex items-center gap-2 uppercase">
              <span>🏢</span> Interacción por Lead / Contacto
            </h2>
            <p class="text-[11px] text-muted mt-0.5">
              Métricas acumuladas de cada contacto asociadas a su empresa o marca.
            </p>
          </div>

          <div class="relative w-full sm:w-72">
            <input type="text" id="lead-search-input" placeholder="Buscar por Lead o Contacto..." value="${leadSearchQuery}" class="w-full pl-8 pr-3 py-1.5 bg-white border border-[#d9d9dd] rounded-xs text-xs text-slate focus:outline-none focus:border-primary">
            <span class="absolute left-2.5 top-2 text-xs text-muted">🔍</span>
          </div>
        </div>

        <div class="overflow-x-auto max-h-96 overflow-y-auto">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-soft-stone z-10 border-b border-[#d9d9dd] text-[11px] font-bold text-muted-slate uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">Lead / Empresa</th>
                <th class="py-3 px-4">Contacto</th>
                <th class="py-3 px-4">Email</th>
                <th class="py-3 px-4 text-center">Enviados</th>
                <th class="py-3 px-4 text-center">Aperturas Detectadas</th>
                <th class="py-3 px-4 text-center">Clics</th>
                <th class="py-3 px-4 text-right">Último Envío</th>
              </tr>
            </thead>
            <tbody id="leads-breakdown-tbody" class="divide-y divide-[#d9d9dd] text-xs text-slate">
              <tr>
                <td colspan="7" class="py-8 text-center text-muted">Cargando desglose de contactos...</td>
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
              <tr class="border-b border-[#d9d9dd] bg-soft-stone/50 text-[11px] font-bold text-muted-slate uppercase tracking-wider">
                <th class="py-3 px-4">Campaña</th>
                <th class="py-3 px-4">Estado</th>
                <th class="py-3 px-4 text-center">Audiencia</th>
                <th class="py-3 px-4 text-center">Enviados</th>
                <th class="py-3 px-4 text-center">Aperturas</th>
                <th class="py-3 px-4 text-center">Clics</th>
                <th class="py-3 px-4 text-right">% Apertura</th>
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
    loadAndRenderStats(container, selectedPeriod, leadSearchQuery, false);
  });

  refreshBtn.addEventListener('click', () => {
    loadAndRenderStats(container, selectedPeriod, leadSearchQuery, true);
  });

  leadSearchInput.addEventListener('input', (e) => {
    leadSearchQuery = e.target.value.toLowerCase().trim();
    renderLeadsBreakdown(container, leadSearchQuery);
  });

  // Initial load
  loadAndRenderStats(container, selectedPeriod, leadSearchQuery, false);

  return container;
}

// Global cached dataset for lead breakdown rendering
let currentLeadBreakdownData = [];

async function loadAndRenderStats(container, period, searchQuery, forceRefresh = false) {
  const now = new Date();
  const isCacheValid = !forceRefresh && statsCache.messages && (now.getTime() - statsCache.timestamp < CACHE_TTL_MS);

  if (!isCacheValid) {
    try {
      const [msgsRes, eventsRes, campaignsRes] = await Promise.all([
        supabase.from('email_messages').select('*'),
        supabase.from('email_events').select('*'),
        supabase.from('campaigns').select('*').eq('channel', 'email')
      ]);

      if (msgsRes.error) throw msgsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      statsCache = {
        messages: msgsRes.data || [],
        events: eventsRes.data || [],
        campaigns: campaignsRes.data || [],
        timestamp: now.getTime()
      };
    } catch (err) {
      console.error('Error fetching email statistics:', err);
    }
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

  // Render KPI Summary
  renderKpis(container, filteredMessages, filteredEvents, allMessages);

  // Render Commercials Comparison Table
  renderCommercials(container, filteredMessages, filteredEvents, allMessages);

  // Prepare Lead Breakdown Data and Render
  prepareLeadBreakdownData(filteredMessages, filteredEvents);
  renderLeadsBreakdown(container, searchQuery);

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

  const rowsHtml = senders.map(p => {
    const senderEmail = (p.mailing_email || p.email || '').toLowerCase();
    
    // Messages by this commercial
    const userMsgs = messages.filter(m => (m.sender_profile_id === p.id) || (m.sender_email || '').toLowerCase() === senderEmail);
    const userMsgIds = new Set(userMsgs.map(m => m.id));

    const totalSent = userMsgs.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;

    const userEvents = events.filter(e => userMsgIds.has(e.email_message_id));
    const opens = new Set(userEvents.filter(e => e.event_type === 'OPEN_DETECTED').map(e => e.email_message_id)).size;
    const clicks = new Set(userEvents.filter(e => e.event_type === 'CLICKED').map(e => e.email_message_id)).size;

    const openRate = totalSent > 0 ? ((opens / totalSent) * 100).toFixed(1) : '0.0';

    // Sent today by this commercial
    const userMsgsToday = allMessages.filter(m => {
      const matchProfile = (m.sender_profile_id === p.id) || (m.sender_email || '').toLowerCase() === senderEmail;
      const isToday = (m.created_at || '').startsWith(todayStr);
      return matchProfile && isToday && (m.status === 'SENT' || m.status === 'QUEUED');
    }).length;

    const limit = 2000;
    const usedPct = Math.min(((userMsgsToday / limit) * 100), 100).toFixed(1);

    return `
      <tr class="hover:bg-soft-stone/30 transition-colors">
        <td class="py-3 px-4 font-bold text-slate">${p.full_name || 'Comercial'}</td>
        <td class="py-3 px-4 font-mono text-[11px] text-muted-slate">${senderEmail}</td>
        <td class="py-3 px-4 text-center font-semibold">${totalSent.toLocaleString()}</td>
        <td class="py-3 px-4 text-center font-semibold text-emerald-600">${opens.toLocaleString()}</td>
        <td class="py-3 px-4 text-center font-semibold text-primary">${clicks.toLocaleString()}</td>
        <td class="py-3 px-4 text-center font-bold text-slate">${openRate}%</td>
        <td class="py-3 px-4 text-right">
          <div class="inline-flex flex-col items-end">
            <span class="font-mono text-xs font-bold">${userMsgsToday} / 2,000</span>
            <div class="w-24 bg-soft-stone h-1.5 rounded-full mt-1 overflow-hidden">
              <div class="bg-primary h-full" style="width: ${usedPct}%"></div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

function prepareLeadBreakdownData(messages, events) {
  const leads = cache.getLeads() || [];
  const contactsMap = cache.contacts || new Map();

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
    const lead = leads.find(l => l.id === item.lead_id);
    const contact = item.contact_id ? contactsMap.get(item.contact_id) : null;

    const sentCount = item.messages.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;
    
    let opens = 0;
    let clicks = 0;

    for (const m of item.messages) {
      const mEvs = eventsMsgMap.get(m.id) || [];
      if (mEvs.some(e => e.event_type === 'OPEN_DETECTED')) opens++;
      if (mEvs.some(e => e.event_type === 'CLICKED')) clicks++;
    }

    currentLeadBreakdownData.push({
      leadName: lead?.company || 'Lead s/n',
      contactName: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : (lead?.company || 'Contacto Principal'),
      email: item.recipient_email || contact?.email || '-',
      sent: sentCount,
      opens,
      clicks,
      lastSentAt: item.last_sent_at
    });
  }

  // Sort by lastSentAt descending
  currentLeadBreakdownData.sort((a, b) => new Date(b.lastSentAt) - new Date(a.lastSentAt));
}

function renderLeadsBreakdown(container, query) {
  const tbody = container.querySelector('#leads-breakdown-tbody');
  if (!tbody) return;

  const filtered = currentLeadBreakdownData.filter(d => {
    if (!query) return true;
    return d.leadName.toLowerCase().includes(query) || d.contactName.toLowerCase().includes(query) || d.email.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-6 text-center text-muted italic">No se encontraron registros de interacción para la búsqueda.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.slice(0, 50).map(d => {
    const dateFormatted = d.lastSentAt ? new Date(d.lastSentAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    return `
      <tr class="hover:bg-soft-stone/30 transition-colors">
        <td class="py-2.5 px-4 font-bold text-slate">${d.leadName}</td>
        <td class="py-2.5 px-4 font-medium text-slate">${d.contactName}</td>
        <td class="py-2.5 px-4 font-mono text-[11px] text-muted-slate">${d.email}</td>
        <td class="py-2.5 px-4 text-center font-semibold">${d.sent}</td>
        <td class="py-2.5 px-4 text-center font-semibold text-emerald-600">${d.opens}</td>
        <td class="py-2.5 px-4 text-center font-semibold text-primary">${d.clicks}</td>
        <td class="py-2.5 px-4 text-right text-[11px] text-muted">${dateFormatted}</td>
      </tr>
    `;
  }).join('');
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

  const rowsHtml = emailCampaigns.map(c => {
    const cMsgs = messages.filter(m => m.campaign_id === c.id);
    const cMsgIds = new Set(cMsgs.map(m => m.id));

    const totalSent = c.total_sent || cMsgs.filter(m => m.status === 'SENT' || m.status === 'QUEUED').length;
    const cEvents = events.filter(e => c.id === e.campaign_id || cMsgIds.has(e.email_message_id));
    
    const opens = new Set(cEvents.filter(e => e.event_type === 'OPEN_DETECTED').map(e => e.email_message_id)).size;
    const clicks = new Set(cEvents.filter(e => e.event_type === 'CLICKED').map(e => e.email_message_id)).size;

    const openRate = totalSent > 0 ? ((opens / totalSent) * 100).toFixed(1) : '0.0';

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
        <td class="py-3 px-4 text-center font-semibold">${c.total_found || 0}</td>
        <td class="py-3 px-4 text-center font-semibold">${totalSent}</td>
        <td class="py-3 px-4 text-center font-semibold text-emerald-600">${opens}</td>
        <td class="py-3 px-4 text-center font-semibold text-primary">${clicks}</td>
        <td class="py-3 px-4 text-right font-bold text-slate">${openRate}%</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}
