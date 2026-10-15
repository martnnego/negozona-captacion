import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { renderCampaigns } from './campaigns';
import { toast } from '../components/toast';

export async function renderCampaignDetail(campaignId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-6 animate-fade-in font-sans pb-12';

  wrapper.innerHTML = `
    <!-- Top Back Navigation -->
    <div class="flex items-center justify-between border-b border-neutral-200 pb-3">
      <button id="btn-back-campaigns" class="text-xs font-mono font-bold text-neutral-600 hover:text-primary cursor-pointer flex items-center gap-1.5 transition-colors">
        ← Volver a Campañas
      </button>

      <div class="flex items-center gap-2" id="campaign-actions-container">
        <!-- Actions rendered dynamically -->
      </div>
    </div>

    <!-- Campaign Header Card -->
    <div class="bg-neutral-900 text-white p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-3">
          <h2 id="camp-title" class="text-2xl font-bold font-display text-white">Cargando campaña...</h2>
          <span id="camp-status-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-800 text-neutral-300">...</span>
        </div>
        <p id="camp-desc" class="text-xs text-neutral-400">...</p>
      </div>

      <div class="flex items-center gap-6 border-t md:border-t-0 md:border-l border-neutral-800 pt-3 md:pt-0 md:pl-6 text-xs font-mono">
        <div>
          <span class="text-[9px] text-neutral-500 uppercase block">Total Audiencia</span>
          <strong id="kpi-total-found" class="text-lg font-bold text-white">0</strong>
        </div>

        <div>
          <span class="text-[9px] text-neutral-500 uppercase block">Enviados</span>
          <strong id="kpi-total-sent" class="text-lg font-bold text-emerald-400">0</strong>
        </div>

        <div>
          <span class="text-[9px] text-neutral-500 uppercase block">Fallidos</span>
          <strong id="kpi-total-failed" class="text-lg font-bold text-rose-400">0</strong>
        </div>
      </div>
    </div>

    <!-- 6 Tabs Navigation Bar -->
    <div class="flex items-center gap-1 border-b border-neutral-200 overflow-x-auto text-xs font-mono font-bold uppercase">
      <button class="camp-tab px-4 py-2.5 border-b-2 border-primary text-primary" data-tab="general">General</button>
      <button class="camp-tab px-4 py-2.5 text-neutral-500 hover:text-primary" data-tab="audience">Audiencia</button>
      <button class="camp-tab px-4 py-2.5 text-neutral-500 hover:text-primary" data-tab="content">Contenido</button>
      <button class="camp-tab px-4 py-2.5 text-neutral-500 hover:text-primary" data-tab="schedule">Programación</button>
      <button class="camp-tab px-4 py-2.5 text-neutral-500 hover:text-primary" data-tab="results">Resultados / Métricas</button>
      <button class="camp-tab px-4 py-2.5 text-neutral-500 hover:text-primary" data-tab="activity">Actividad / Cola</button>
    </div>

    <!-- Tab Content Container -->
    <div id="tab-content" class="min-h-[300px]">
      <div class="py-12 text-center text-neutral-400 font-mono text-xs">
        <span class="animate-pulse">🔄 Cargando detalle...</span>
      </div>
    </div>
  `;

  wrapper.querySelector('#btn-back-campaigns').addEventListener('click', () => {
    const campaignsView = renderCampaigns();
    wrapper.replaceWith(campaignsView);
  });

  let campaign = null;
  let recipients = [];
  let emailEventsMap = new Map();
  let phoneNumbersMap = new Map();
  let stagesMap = new Map();
  let profilesMap = new Map();
  let currentTab = 'general';

  // State for Tab 6 Activity / Queue
  let activityStatusFilter = 'all';
  let activitySearchTerm = '';

  function formatDuration(start, end) {
    if (!start) return '—';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((e - s) / 1000));
    if (diffSec < 60) return `${diffSec} seg`;
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    if (min < 60) return `${min} min ${sec} seg`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return `${hr} h ${remMin} min`;
  }

  // Attach tab switching
  wrapper.querySelectorAll('.camp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      wrapper.querySelectorAll('.camp-tab').forEach(b => {
        b.className = 'camp-tab px-4 py-2.5 text-neutral-500 hover:text-primary border-b-2 border-transparent';
      });
      btn.className = 'camp-tab px-4 py-2.5 border-b-2 border-primary text-primary';
      currentTab = btn.dataset.tab;
      renderActiveTab();
    });
  });

  loadCampaignData();

  async function loadCampaignData() {
    try {
      const [campRes, recRes, numbersRes, stagesRes, profilesRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', campaignId).single(),
        supabase.from('campaign_recipients').select('*, leads(company)').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
        supabase.from('whatsapp_numbers').select('*'),
        supabase.from('pipeline_stages').select('*').order('position', { ascending: true }),
        supabase.from('profiles').select('id, full_name, email, mailing_email')
      ]);

      if (campRes.error) throw campRes.error;
      campaign = campRes.data;

      if (recRes.error) {
        console.warn('Error loading recipients with leads relation, using fallback:', recRes.error);
        const { data: fallbackRecs } = await supabase
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true });
        recipients = fallbackRecs || [];
      } else {
        recipients = recRes.data || [];
      }

      if (!cache.isLoaded) {
        cache.loadAll().then(() => {
          if (currentTab === 'activity') {
            const tabContent = wrapper.querySelector('#tab-content');
            if (tabContent) renderTabActivity(tabContent);
          }
        }).catch(() => {});
      }

      phoneNumbersMap.clear();
      if (numbersRes.data) {
        numbersRes.data.forEach(num => {
          if (num.phone_number_id) phoneNumbersMap.set(num.phone_number_id, num);
          if (num.id) phoneNumbersMap.set(num.id, num);
        });
      }

      stagesMap.clear();
      if (stagesRes.data) {
        stagesRes.data.forEach(st => stagesMap.set(st.id, st));
      }

      profilesMap.clear();
      if (profilesRes.data) {
        profilesRes.data.forEach(p => profilesMap.set(p.id, p));
      }

      // Fetch email tracking events if mailing campaign
      emailEventsMap = new Map();
      if (campaign.channel === 'email') {
        const { data: evData } = await supabase
          .from('email_events')
          .select('email_message_id, event_type, created_at, url')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: true });

        if (evData && evData.length > 0) {
          for (const ev of evData) {
            if (!ev.email_message_id) continue;
            if (!emailEventsMap.has(ev.email_message_id)) {
              emailEventsMap.set(ev.email_message_id, { opens: [], clicks: [] });
            }
            const bucket = emailEventsMap.get(ev.email_message_id);
            if (ev.event_type === 'OPEN_DETECTED') {
              bucket.opens.push(ev);
            } else if (ev.event_type === 'CLICKED') {
              bucket.clicks.push(ev);
            }
          }
        }
      }

      updateHeaderCards();
      renderActiveTab();
    } catch (err) {
      console.error('Error loading campaign detail:', err);
      toast.show('Error al cargar detalle de campaña: ' + err.message, 'error');
    }
  }

  function updateHeaderCards() {
    if (!campaign) return;

    wrapper.querySelector('#camp-title').textContent = campaign.name;
    wrapper.querySelector('#camp-desc').textContent = campaign.description || 'Sin descripción adicional';

    const sentCount = (recipients || []).filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length || campaign.total_sent || 0;
    const failedCount = (recipients || []).filter(r => r.status === 'failed').length || campaign.total_failed || 0;
    const totalFoundCount = campaign.total_found || (recipients || []).length || 0;

    wrapper.querySelector('#kpi-total-found').textContent = totalFoundCount.toLocaleString();
    wrapper.querySelector('#kpi-total-sent').textContent = sentCount.toLocaleString();
    wrapper.querySelector('#kpi-total-failed').textContent = failedCount.toLocaleString();

    const badgeContainer = wrapper.querySelector('#camp-status-badge');
    badgeContainer.className = 'px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider shadow-xs';

    if (campaign.status === 'en_ejecucion') {
      badgeContainer.className += ' bg-emerald-500 text-white';
      badgeContainer.textContent = '⚡ En Ejecución';
    } else if (campaign.status === 'programada') {
      badgeContainer.className += ' bg-blue-500 text-white';
      badgeContainer.textContent = '📅 Programada';
    } else if (campaign.status === 'finalizada') {
      badgeContainer.className += ' bg-purple-500 text-white';
      badgeContainer.textContent = '✅ Finalizada';
    } else if (campaign.status === 'pausada_limite') {
      badgeContainer.className += ' bg-amber-500 text-white';
      badgeContainer.textContent = '⏸️ Pausada por Límite';
    } else {
      badgeContainer.className += ' bg-neutral-700 text-neutral-200';
      badgeContainer.textContent = '📝 Borrador';
    }
  }

  function renderActiveTab() {
    const tabContent = wrapper.querySelector('#tab-content');
    if (!tabContent || !campaign) return;

    switch (currentTab) {
      case 'general':
        renderTabGeneral(tabContent);
        break;
      case 'audience':
        renderTabAudience(tabContent);
        break;
      case 'content':
        renderTabContent(tabContent);
        break;
      case 'schedule':
        renderTabSchedule(tabContent);
        break;
      case 'results':
        renderTabResults(tabContent);
        break;
      case 'activity':
        renderTabActivity(tabContent);
        break;
    }
  }

  // ----------------------------------------------------
  // TAB 1: General
  // ----------------------------------------------------
  function renderTabGeneral(tabContent) {
    const isEmail = campaign.channel === 'email';
    const senderNum = !isEmail ? phoneNumbersMap.get(campaign.phone_number_id) : null;
    const creator = profilesMap.get(campaign.created_by);

    const objectiveLabels = {
      promocion: '🎯 Promoción',
      difusion: '📢 Difusión',
      reactivacion: '🔄 Reactivación',
      fidelizacion: '🤝 Fidelización',
      recordatorio: '⏰ Recordatorio',
      seguimiento: '📋 Seguimiento',
      notificacion: '🔔 Notificación',
      otro: '📌 General / Otro'
    };

    const durationText = campaign.completed_at
      ? formatDuration(campaign.started_at, campaign.completed_at)
      : (campaign.status === 'en_ejecucion' ? `${formatDuration(campaign.started_at, null)} (en curso)` : '—');

    tabContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-4 shadow-xs">
          <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2 flex items-center justify-between">
            <span>Información Técnica y Comercial</span>
            <span class="text-[10px] text-neutral-400 font-normal">Canal: ${isEmail ? 'Mailing B2B' : 'Meta WABA'}</span>
          </h4>
          
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Canal de Envío</span>
              <span class="font-bold text-neutral-800 uppercase flex items-center gap-1.5">
                ${isEmail ? '✉️ Email (Workspace)' : '🟢 WhatsApp (Meta API)'}
              </span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">${isEmail ? 'Estrategia Remitente' : 'Línea / Remitente'}</span>
              ${isEmail ? `
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-neutral-800">
                    ${campaign.sender_strategy === 'lead_owner' ? '👤 Propietario del Lead' : (campaign.sender_strategy === 'single' ? '👤 Remitente Fijo' : '🔄 Round-Robin')}
                  </span>
                  ${campaign.sender_profile_ids && campaign.sender_profile_ids.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mt-1">
                      ${campaign.sender_profile_ids.map(pid => {
                        const p = profilesMap.get(pid);
                        return `<span class="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[9.5px] font-mono text-neutral-700" title="${p?.mailing_email || p?.email || ''}">${p?.full_name || 'Comercial'}</span>`;
                      }).join('')}
                    </div>
                  ` : ''}
                </div>
              ` : `
                <div class="flex flex-col gap-0.5">
                  <span class="font-bold text-neutral-900">${senderNum?.verified_name || 'Línea WhatsApp'}</span>
                  <span class="font-mono text-neutral-600 text-[11px]">${senderNum?.display_phone_number || campaign.phone_number_id}</span>
                  <div class="flex items-center gap-1 mt-1">
                    ${senderNum?.quality_rating ? `<span class="text-[8.5px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-bold">● ${senderNum.quality_rating}</span>` : ''}
                    <span class="text-[8.5px] font-mono text-neutral-400">ID: ${campaign.phone_number_id}</span>
                  </div>
                </div>
              `}
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Objetivo Comercial</span>
              <span class="text-neutral-800 font-semibold">${objectiveLabels[campaign.objective] || campaign.objective || 'General'}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Creado Por</span>
              <span class="text-neutral-800 font-medium" title="${creator?.email || ''}">
                ${creator?.full_name || 'Usuario del CRM'}
              </span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Fecha de Creación</span>
              <span class="font-mono text-neutral-700">${new Date(campaign.created_at).toLocaleString('es-AR')}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Momento Programado</span>
              <span class="font-mono text-neutral-700">${campaign.send_type === 'immediate' ? '⚡ Inmediato' : (campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('es-AR') : 'Inmediato')}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Inicio de Ejecución</span>
              <span class="font-mono text-neutral-700">${campaign.started_at ? new Date(campaign.started_at).toLocaleString('es-AR') : 'Pendiente'}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Finalización / Cierre</span>
              <span class="font-mono text-neutral-700">${campaign.completed_at ? new Date(campaign.completed_at).toLocaleString('es-AR') : (campaign.status === 'en_ejecucion' ? 'En proceso activo...' : 'Pendiente')}</span>
            </div>

            <div class="col-span-2 pt-2 border-t border-neutral-100 flex items-center justify-between">
              <span class="text-[9px] font-mono text-neutral-400 uppercase">Duración de la Corrida:</span>
              <strong class="font-mono text-xs ${campaign.completed_at ? 'text-purple-700' : 'text-neutral-600'}">${durationText}</strong>
            </div>
          </div>
        </div>

        <div class="p-5 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col justify-between shadow-2xs">
          <div class="flex flex-col gap-2">
            <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase flex items-center gap-1.5">
              <span>⚙️</span> Controles de Ejecución
            </h4>
            <p class="text-xs text-neutral-500 leading-relaxed">
              Supervisa el ciclo de vida del despacho. Puedes pausar temporalmente los lotes si necesitas revisar la plantilla o cancelar los mensajes pendientes.
            </p>

            <div class="p-3 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs font-mono mt-1">
              <span class="text-neutral-500">Estado actual:</span>
              <strong class="font-bold text-neutral-900 uppercase">${campaign.status.replace('_', ' ')}</strong>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-neutral-200">
            ${campaign.status === 'en_ejecucion' ? `
              <button id="btn-pause-campaign" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors shadow-2xs">
                ⏸️ Pausar Envío
              </button>
            ` : campaign.status === 'pausada_limite' ? `
              <button id="btn-resume-campaign" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors shadow-2xs">
                ▶️ Reanudar Envío
              </button>
            ` : ''}

            ${['programada', 'en_ejecucion', 'pausada_limite'].includes(campaign.status) ? `
              <button id="btn-cancel-campaign" class="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-mono text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors">
                🚫 Cancelar Campaña
              </button>
            ` : `
              <span class="text-neutral-400 font-mono text-xs italic">Campaña en estado terminal (sin acciones pendientes).</span>
            `}
          </div>
        </div>
      </div>
    `;

    const btnCancel = tabContent.querySelector('#btn-cancel-campaign');
    if (btnCancel) {
      btnCancel.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de cancelar esta campaña? Los mensajes pendientes se omitirán definitivamente.')) return;
        await supabase.from('campaigns').update({ status: 'cancelada' }).eq('id', campaignId);
        toast.show('Campaña cancelada', 'success');
        await loadCampaignData();
      });
    }

    const btnPause = tabContent.querySelector('#btn-pause-campaign');
    if (btnPause) {
      btnPause.addEventListener('click', async () => {
        await supabase.from('campaigns').update({ status: 'pausada_limite' }).eq('id', campaignId);
        toast.show('Campaña pausada', 'success');
        await loadCampaignData();
      });
    }

    const btnResume = tabContent.querySelector('#btn-resume-campaign');
    if (btnResume) {
      btnResume.addEventListener('click', async () => {
        await supabase.from('campaigns').update({ status: 'en_ejecucion' }).eq('id', campaignId);
        toast.show('Campaña reanudada', 'success');
        await loadCampaignData();
      });
    }
  }

  // ----------------------------------------------------
  // TAB 2: Audiencia & Segmentación
  // ----------------------------------------------------
  function renderTabAudience(tabContent) {
    const isEmail = campaign.channel === 'email';
    const discardedRecs = recipients.filter(r => r.status === 'discarded');
    const rule24hCount = discardedRecs.filter(r => r.discard_reason === 'rule_24h').length;
    const invalidPhoneCount = discardedRecs.filter(r => r.discard_reason === 'invalid_whatsapp' || r.discard_reason === 'missing_email').length;
    const optOutCount = discardedRecs.filter(r => r.discard_reason === 'opt_out').length;

    const pipelineTypeLabel = campaign.audience_filters?.pipeline_type === 'franquiday' ? '🎪 Franquiday' : '💼 Negozona';
    const stageId = campaign.audience_filters?.pipeline_stage_id || campaign.audience_filters?.franquiday_stage_id;
    const stageName = stageId ? (stagesMap.get(stageId)?.name || 'Etapa configurada') : 'Todas las etapas';

    tabContent.innerHTML = `
      <div class="flex flex-col gap-6">
        <!-- Top Metrics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block">Impacto Total Encontrado</span>
            <strong class="text-2xl font-mono text-neutral-900">${(campaign.total_found || 0).toLocaleString()}</strong>
            <span class="text-[10px] text-neutral-400 block font-mono mt-0.5">Prospectos evaluados en CRM</span>
          </div>

          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-xs">
            <span class="text-[9px] font-mono text-emerald-600 uppercase block">Contactos Calificados a Enviar</span>
            <strong class="text-2xl font-mono text-emerald-800">${(campaign.total_to_send || 0).toLocaleString()}</strong>
            <span class="text-[10px] text-emerald-700 block font-mono mt-0.5">Cumplen filtros y reglas de canal</span>
          </div>

          <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl shadow-xs">
            <span class="text-[9px] font-mono text-rose-600 uppercase block">Contactos Desestimados</span>
            <strong class="text-2xl font-mono text-rose-800">${(campaign.total_discarded || 0).toLocaleString()}</strong>
            <span class="text-[10px] text-rose-700 block font-mono mt-0.5">Filtrados por reglas o datos incompletos</span>
          </div>
        </div>

        <!-- Criterios de Segmentación Card -->
        <div class="p-5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
            <h4 class="font-mono text-xs font-bold text-primary uppercase flex items-center gap-1.5">
              <span>🎯</span> Criterios de Segmentación Seleccionados en el Alta
            </h4>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${campaign.audience_type === 'dynamic_segment' ? 'bg-amber-100 text-amber-900 border border-amber-300' : (campaign.audience_type === 'static_segment' ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-neutral-100 text-neutral-700 border border-neutral-300')}">
              ${campaign.audience_type === 'dynamic_segment' ? '⚡ Segmento Dinámico' : (campaign.audience_type === 'static_segment' ? '📌 Segmento Estático' : '👥 Audiencia Completa')}
            </span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span class="text-[9px] font-mono text-neutral-400 block uppercase font-bold">Tipo de Pipeline</span>
              <span class="font-bold text-neutral-800 mt-0.5 block">${pipelineTypeLabel}</span>
            </div>

            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span class="text-[9px] font-mono text-neutral-400 block uppercase font-bold">Etapa del Embudo</span>
              <span class="font-bold text-neutral-800 mt-0.5 block">${stageName}</span>
            </div>

            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span class="text-[9px] font-mono text-neutral-400 block uppercase font-bold">País</span>
              <span class="font-bold text-neutral-800 mt-0.5 block">${campaign.audience_filters?.country || 'Todos los países'}</span>
            </div>

            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <span class="text-[9px] font-mono text-neutral-400 block uppercase font-bold">Inactividad Comercial</span>
              <span class="font-bold text-neutral-800 mt-0.5 block">${campaign.audience_filters?.days_inactive ? `Más de ${campaign.audience_filters.days_inactive} días sin gestión` : 'Sin filtro de inactividad'}</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs pt-2 border-t border-neutral-100 gap-2">
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-mono text-neutral-400 uppercase font-bold">Alcance de Contactos:</span>
              <span class="font-medium text-neutral-800">
                ${campaign.audience_filters?.primary_contact_only ? '👤 Solo contacto principal de cada empresa' : '👥 Todos los contactos vinculados a cada empresa'}
              </span>
            </div>

            ${campaign.audience_type === 'static_segment' && campaign.audience_filters?.selected_lead_ids?.length ? `
              <span class="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                ✓ ${campaign.audience_filters.selected_lead_ids.length} contactos congelados al crear la campaña
              </span>
            ` : (campaign.audience_type === 'dynamic_segment' ? `
              <span class="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                ⚡ Filtra prospectos en vivo al momento de la ejecución
              </span>
            ` : '')}
          </div>
        </div>

        <!-- Discarded Breakdown -->
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3 shadow-xs">
          <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase border-b border-neutral-200 pb-2 flex items-center justify-between">
            <span>Motivos de Descarte y Protección de Audiencia</span>
            <span class="text-[10px] font-mono text-rose-600 font-bold">${campaign.total_discarded || 0} desestimados en total</span>
          </h4>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            ${isEmail ? `
              <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                <div>
                  <strong class="block text-neutral-800 font-bold">✉️ Email Faltante / Inválido</strong>
                  <span class="text-[10px] text-neutral-500">Sin correo electrónico o con sintaxis errónea</span>
                </div>
                <span class="text-xl font-mono font-bold text-amber-600">${invalidPhoneCount}</span>
              </div>

              <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                <div>
                  <strong class="block text-neutral-800 font-bold">🛡️ Regla 24h Anti-Saturación</strong>
                  <span class="text-[10px] text-neutral-500">Recibieron otro correo en las últimas 24h</span>
                </div>
                <span class="text-xl font-mono font-bold text-rose-600">${rule24hCount}</span>
              </div>

              <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                <div>
                  <strong class="block text-neutral-800 font-bold">🚫 Opt-Out / Solicitó Baja</strong>
                  <span class="text-[10px] text-neutral-500">Suscriptores desestimados</span>
                </div>
                <span class="text-xl font-mono font-bold text-neutral-600">${optOutCount}</span>
              </div>
            ` : `
              <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                <div>
                  <strong class="block text-neutral-800 font-bold">🛡️ Regla 24h Anti-Spam</strong>
                  <span class="text-[10px] text-neutral-500">Recibieron campaña en las últimas 24h</span>
                </div>
                <span class="text-xl font-mono font-bold text-rose-600">${rule24hCount}</span>
              </div>

              <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                <div>
                  <strong class="block text-neutral-800 font-bold">📱 Teléfono Inválido</strong>
                  <span class="text-[10px] text-neutral-500">Sin formato internacional E.164</span>
                </div>
                <span class="text-xl font-mono font-bold text-amber-600">${invalidPhoneCount}</span>
              </div>

              <div class="p-3.5 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
                <div>
                  <strong class="block text-neutral-800 font-bold">🚫 Opt-Out / Baja</strong>
                  <span class="text-[10px] text-neutral-500">Solicitaron no ser contactados</span>
                </div>
                <span class="text-xl font-mono font-bold text-neutral-600">${optOutCount}</span>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // TAB 3: Contenido
  // ----------------------------------------------------
  async function renderTabContent(tabContent) {
    const isEmail = campaign.channel === 'email';

    if (isEmail) {
      tabContent.innerHTML = `
        <div class="p-8 text-center text-neutral-400 font-mono text-xs">
          <span class="animate-pulse">🔄 Cargando plantilla de email...</span>
        </div>
      `;

      let tmpl = null;
      if (campaign.email_template_id) {
        const { data: tData } = await supabase.from('email_templates').select('*').eq('id', campaign.email_template_id).single();
        tmpl = tData;
      }

      tabContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3 shadow-xs">
            <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2">Configuración del Email</h4>
            
            <div class="flex flex-col gap-3 text-xs">
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Plantilla de Email</span>
                <strong class="font-mono text-primary font-bold text-sm">${tmpl?.name || campaign.template_name || 'Plantilla de Email'}</strong>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Asunto</span>
                <span class="font-semibold text-neutral-800">${tmpl?.subject || 'Sin asunto'}</span>
              </div>

              ${tmpl?.preview_text ? `
                <div>
                  <span class="text-[9px] font-mono text-neutral-400 block uppercase">Texto de Vista Previa (Preheader)</span>
                  <span class="font-mono text-neutral-600 italic text-[11px]">${tmpl.preview_text}</span>
                </div>
              ` : ''}

              <div class="pt-2 border-t border-neutral-100">
                <span class="text-[9px] font-mono text-neutral-400 block uppercase mb-1">Variables Dinámicas Detectadas</span>
                <div class="flex flex-wrap gap-1 font-mono text-[10px]">
                  ${(tmpl?.variables || []).map(v => `<span class="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-primary font-bold">${v}</span>`).join('') || '<span class="text-neutral-400">Ninguna variable</span>'}
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col gap-3">
            <div class="font-mono text-xs font-bold text-neutral-800 border-b border-neutral-100 pb-2 flex items-center justify-between">
              <span>Vista Previa del Cuerpo HTML</span>
              <span class="text-[10px] text-neutral-400 font-normal">Renderizado final</span>
            </div>
            <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-lg font-sans text-xs text-neutral-800 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
              ${tmpl?.body_html || '<span class="text-neutral-400 italic">No hay vista previa disponible</span>'}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // --- WHATSAPP CONTENT VIEW ---
    const senderNum = phoneNumbersMap.get(campaign.phone_number_id);
    const comps = Array.isArray(campaign.template_components) ? campaign.template_components : [];
    const headerComp = comps.find(c => c.type === 'HEADER');
    const bodyComp = comps.find(c => c.type === 'BODY');
    const footerComp = comps.find(c => c.type === 'FOOTER');
    const buttonsComp = comps.find(c => c.type === 'BUTTONS');

    const bodyRawText = bodyComp?.text || 'Mensaje de la plantilla de WhatsApp';
    const mappings = campaign.variable_mappings || {};
    const mappingKeys = Object.keys(mappings);

    // Replace variables in preview
    let previewRenderedText = bodyRawText;
    mappingKeys.forEach(k => {
      const m = mappings[k];
      const val = typeof m === 'object' ? (m.fallback || m.field || `{{${k}}}`) : m;
      previewRenderedText = previewRenderedText.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), `[${val}]`);
    });

    const headerImageUrl = campaign.options?.header_media_url || headerComp?.example?.header_handle?.[0] || null;

    tabContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Left: Variable Mappings & Metadata -->
        <div class="flex flex-col gap-4">
          <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3 shadow-xs">
            <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2 flex items-center justify-between">
              <span>Configuración de la Plantilla Meta</span>
              <span class="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">🟢 Aprobada en Meta</span>
            </h4>
            
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Nombre de Plantilla</span>
                <strong class="font-mono text-neutral-900 font-bold text-xs">${campaign.template_name}</strong>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Idioma</span>
                <span class="font-mono text-neutral-700">${campaign.template_language || 'es_AR'}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Encabezado Multimedia</span>
                <span class="font-mono text-neutral-700">${headerComp ? `🖼️ ${headerComp.format || 'IMAGEN'}` : 'Sin multimedia'}</span>
              </div>

              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Botones Interactivos</span>
                <span class="font-mono text-neutral-700">${buttonsComp?.buttons?.length ? `${buttonsComp.buttons.length} botón(es)` : 'Sin botones'}</span>
              </div>
            </div>
          </div>

          <!-- Mapeo de Variables Table -->
          <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3 shadow-xs">
            <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase border-b border-neutral-200 pb-2 flex items-center justify-between">
              <span>Mapeo de Variables Dinámicas</span>
              <span class="text-[10px] font-mono text-neutral-400">${mappingKeys.length} asignadas</span>
            </h4>

            ${mappingKeys.length === 0 ? `
              <p class="text-xs text-neutral-400 font-mono italic">Esta plantilla no tiene variables dinámicas configuradas.</p>
            ` : `
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-neutral-100 font-mono text-[9px] uppercase text-neutral-600">
                    <tr>
                      <th class="py-2 px-3">Variable</th>
                      <th class="py-2 px-3">Campo Asignado</th>
                      <th class="py-2 px-3">Valor de Respaldo</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100 font-mono text-[11px]">
                    ${mappingKeys.map(k => {
                      const m = mappings[k] || {};
                      const fieldStr = typeof m === 'object' ? (m.field || '-') : m;
                      const fallbackStr = typeof m === 'object' ? (m.fallback || '-') : '-';
                      let prettyField = fieldStr;
                      if (fieldStr === 'lead.first_name') prettyField = '👤 Nombre del Contacto';
                      else if (fieldStr === 'lead.company') prettyField = '🏢 Empresa / Marca';
                      else if (fieldStr === 'lead.phone') prettyField = '📞 Teléfono';
                      else if (fieldStr.startsWith('static:')) prettyField = `📝 Fijo: ${fieldStr.slice(7)}`;

                      return `
                        <tr>
                          <td class="py-2 px-3 font-bold text-primary">{{${k}}}</td>
                          <td class="py-2 px-3 font-medium text-neutral-800">${prettyField}</td>
                          <td class="py-2 px-3 text-neutral-500 font-italic">${fallbackStr}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>

        <!-- Right: Realistic WhatsApp Chat Mockup -->
        <div class="flex flex-col rounded-xl overflow-hidden border border-neutral-300 shadow-md">
          <!-- WhatsApp Bar Header -->
          <div class="bg-[#075e54] text-white p-3 flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
              🟢
            </div>
            <div class="flex flex-col min-w-0">
              <strong class="text-xs font-bold leading-tight truncate">${senderNum?.verified_name || 'NegoZona Argentina'}</strong>
              <span class="text-[9.5px] text-emerald-200 font-mono">${senderNum?.display_phone_number || 'Cuenta de Empresa Oficial'}</span>
            </div>
          </div>

          <!-- Chat Canvas Body -->
          <div class="bg-[#efeae2] p-5 flex-1 flex flex-col justify-start">
            <div class="bg-white rounded-lg p-3.5 shadow-sm max-w-sm text-xs text-neutral-800 leading-relaxed border border-neutral-200">
              <!-- Header Image -->
              ${headerImageUrl ? `
                <div class="rounded-md overflow-hidden mb-2.5 bg-neutral-900 border border-neutral-200">
                  <img src="${headerImageUrl}" alt="Header Media" class="w-full max-h-52 object-cover" />
                </div>
              ` : ''}

              <!-- Body Text -->
              <div class="whitespace-pre-wrap font-sans text-neutral-900 leading-relaxed text-[12.5px]">${previewRenderedText}</div>

              <!-- Footer -->
              ${footerComp?.text ? `
                <p class="text-[10.5px] text-neutral-400 mt-2 font-sans">${footerComp.text}</p>
              ` : ''}

              <!-- Timestamp & Ticks -->
              <div class="flex items-center justify-end gap-1 mt-1 text-[9px] text-neutral-400 font-mono">
                <span>10:00</span>
                <span class="text-blue-500 font-bold">✓✓</span>
              </div>

              <!-- Buttons Container -->
              ${buttonsComp?.buttons?.length ? `
                <div class="mt-2.5 flex flex-col gap-1.5 border-t border-neutral-100 pt-2">
                  ${buttonsComp.buttons.map(b => `
                    <div class="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-md py-2 px-3 text-center text-xs font-semibold text-primary shadow-2xs flex items-center justify-center gap-1.5">
                      <span>${b.type === 'FLOW' ? '⚡' : (b.type === 'QUICK_REPLY' ? '↩️' : '🔗')}</span>
                      <span>${b.text}</span>
                      ${b.type === 'FLOW' ? '<span class="text-[9px] font-mono font-normal text-neutral-400">(Flow)</span>' : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // TAB 4: Programación & Políticas
  // ----------------------------------------------------
  function renderTabSchedule(tabContent) {
    const creator = profilesMap.get(campaign.created_by);
    const durationText = campaign.completed_at
      ? formatDuration(campaign.started_at, campaign.completed_at)
      : (campaign.status === 'en_ejecucion' ? `${formatDuration(campaign.started_at, null)} (en curso)` : '—');

    tabContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <!-- Timeline de Ejecución -->
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-4 shadow-xs">
          <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2 flex items-center gap-1.5">
            <span>⏱️</span> Línea de Tiempo Operativa
          </h4>
          
          <div class="flex flex-col gap-3.5 text-xs">
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center text-xs shrink-0 mt-0.5">📝</div>
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">1. Campaña Creada</span>
                <strong class="text-neutral-800">${new Date(campaign.created_at).toLocaleString('es-AR')}</strong>
                <span class="text-[10.5px] text-neutral-500 block font-mono">Por: ${creator?.full_name || 'Usuario'}</span>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-xs shrink-0 mt-0.5">📅</div>
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">2. Momento Programado</span>
                <strong class="text-neutral-800">${campaign.send_type === 'immediate' ? '⚡ Despacho Inmediato' : new Date(campaign.scheduled_at).toLocaleString('es-AR')}</strong>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-xs shrink-0 mt-0.5">⚡</div>
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">3. Inicio de Despacho</span>
                <strong class="text-neutral-800">${campaign.started_at ? new Date(campaign.started_at).toLocaleString('es-AR') : 'Pendiente de inicio'}</strong>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full ${campaign.status === 'finalizada' ? 'bg-purple-100 border-purple-300' : 'bg-neutral-100 border-neutral-300'} flex items-center justify-center text-xs shrink-0 mt-0.5">🏁</div>
              <div>
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">4. Finalización y Cierre</span>
                <strong class="text-neutral-800">${campaign.completed_at ? new Date(campaign.completed_at).toLocaleString('es-AR') : (campaign.status === 'en_ejecucion' ? 'En proceso activo...' : 'Pendiente')}</strong>
                ${campaign.completed_at && campaign.started_at ? `
                  <span class="text-[10.5px] text-purple-700 block font-mono font-bold mt-0.5">⏱️ Duración de corrida: ${durationText}</span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Matriz de Políticas -->
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-4 shadow-xs">
          <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase border-b border-neutral-200 pb-2 flex items-center gap-1.5">
            <span>🛡️</span> Políticas de Protección y Entrega
          </h4>

          <div class="flex flex-col gap-3 text-xs">
            <!-- Regla 24h Antispam -->
            <div class="p-3 rounded-lg border ${campaign.channel === 'whatsapp' || campaign.options?.anti_saturation_24h !== false ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'} flex items-start gap-2.5">
              <span class="text-base shrink-0">${campaign.channel === 'whatsapp' || campaign.options?.anti_saturation_24h !== false ? '🛡️' : '⚠️'}</span>
              <div class="flex flex-col gap-0.5 w-full">
                <div class="flex items-center justify-between">
                  <strong class="font-bold text-neutral-900">Regla Anti-Saturación 24h</strong>
                  <span class="text-[9.5px] font-mono font-bold ${campaign.channel === 'whatsapp' ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded' : (campaign.options?.anti_saturation_24h !== false ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded' : 'text-amber-800 bg-amber-100 px-2 py-0.5 rounded')}">
                    ${campaign.channel === 'whatsapp' ? 'Activa Permanente' : (campaign.options?.anti_saturation_24h !== false ? 'Activada' : 'Desactivada por usuario')}
                  </span>
                </div>
                <p class="text-[11px] text-neutral-600 leading-relaxed mt-0.5">
                  ${campaign.channel === 'whatsapp' 
                    ? 'Protege la calificación de calidad en Meta impidiendo despachar más de una campaña en 24h al mismo prospecto.' 
                    : 'Omite automáticamente a los contactos que hayan recibido un correo de campaña en las últimas 24 horas.'}
                </p>
              </div>
            </div>

            <!-- Corte por Error Masivo -->
            <div class="p-3 rounded-lg border ${campaign.options?.stop_on_mass_error !== false ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-50 border-neutral-200 opacity-60'} flex items-start gap-2.5">
              <span class="text-base shrink-0">🛑</span>
              <div class="flex flex-col gap-0.5 w-full">
                <div class="flex items-center justify-between">
                  <strong class="font-bold text-neutral-900">Corte por Error Masivo</strong>
                  <span class="text-[9.5px] font-mono font-bold ${campaign.options?.stop_on_mass_error !== false ? 'text-neutral-700' : 'text-neutral-400'}">
                    ${campaign.options?.stop_on_mass_error !== false ? '✓ Activado' : '✗ Desactivado'}
                  </span>
                </div>
                <p class="text-[11px] text-neutral-600 leading-relaxed mt-0.5">
                  Pausa automática de emergencia si la tasa de fallos supera el umbral crítico del 15%.
                </p>
              </div>
            </div>

            <!-- Reintento Automático -->
            <div class="p-3 rounded-lg border ${campaign.options?.auto_retry ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-50 border-neutral-200 opacity-60'} flex items-start gap-2.5">
              <span class="text-base shrink-0">🔄</span>
              <div class="flex flex-col gap-0.5 w-full">
                <div class="flex items-center justify-between">
                  <strong class="font-bold text-neutral-900">Reintento Automático</strong>
                  <span class="text-[9.5px] font-mono font-bold ${campaign.options?.auto_retry ? 'text-neutral-700' : 'text-neutral-400'}">
                    ${campaign.options?.auto_retry ? '✓ Activado' : '✗ Desactivado'}
                  </span>
                </div>
                <p class="text-[11px] text-neutral-600 leading-relaxed mt-0.5">
                  Reintenta el despacho de mensajes en caso de errores de conexión o timeouts de red.
                </p>
              </div>
            </div>

            <!-- Validación de Canal -->
            <div class="p-3 rounded-lg border ${campaign.options?.valid_whatsapp_only !== false ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-50 border-neutral-200 opacity-60'} flex items-start gap-2.5">
              <span class="text-base shrink-0">📱</span>
              <div class="flex flex-col gap-0.5 w-full">
                <div class="flex items-center justify-between">
                  <strong class="font-bold text-neutral-900">Validación de Sintaxis</strong>
                  <span class="text-[9.5px] font-mono font-bold ${campaign.options?.valid_whatsapp_only !== false ? 'text-neutral-700' : 'text-neutral-400'}">
                    ${campaign.options?.valid_whatsapp_only !== false ? '✓ Activado' : '✗ Desactivado'}
                  </span>
                </div>
                <p class="text-[11px] text-neutral-600 leading-relaxed mt-0.5">
                  Verifica que el teléfono cumpla con el estándar internacional E.164 antes de intentar el envío.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  // ----------------------------------------------------
  // TAB 5: Resultados / Métricas
  // ----------------------------------------------------
  function renderTabResults(tabContent) {
    const isEmail = campaign.channel === 'email';
    const totalAudience = campaign.total_to_send || (recipients || []).length || 1;
    const totalSent = (recipients || []).filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length || campaign.total_sent || 0;
    const totalDelivered = isEmail ? totalSent : ((recipients || []).filter(r => ['delivered', 'read'].includes(r.status)).length || campaign.total_delivered || totalSent);
    const totalFailed = (recipients || []).filter(r => r.status === 'failed').length || campaign.total_failed || 0;
    const totalDiscarded = (recipients || []).filter(r => r.status === 'discarded').length || campaign.total_discarded || 0;
    const totalRead = isEmail
      ? (recipients || []).filter(r => (emailEventsMap.get(r.email_message_id)?.opens.length || 0) > 0).length || campaign.total_read || 0
      : ((recipients || []).filter(r => r.status === 'read').length || campaign.total_read || 0);
    const totalClicks = isEmail
      ? Array.from(emailEventsMap.values()).reduce((sum, item) => sum + (item.clicks?.length || 0), 0)
      : (campaign.total_clicks || 0);

    // Calculated Rates
    const sendRate = Math.round((totalSent / totalAudience) * 100);
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
    const clickRate = totalDelivered > 0 ? Math.round((totalClicks / totalDelivered) * 100) : 0;
    const errorRate = totalAudience > 0 ? Math.round((totalFailed / totalAudience) * 100) : 0;

    // Cost calculations
    const estimatedCostUSD = isEmail ? '0.00' : (totalDelivered * 0.062).toFixed(2);
    const costPerDeliveredUSD = isEmail ? '0.000' : (totalDelivered > 0 ? '0.062' : '0.000');
    const costPerClickUSD = isEmail ? '0.000' : (totalClicks > 0 ? (parseFloat(estimatedCostUSD) / totalClicks).toFixed(3) : '0.000');

    tabContent.innerHTML = `
      <div class="flex flex-col gap-6">
        
        <!-- Header Info & Status -->
        <div class="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">📊</div>
            <div>
              <h3 class="font-mono text-sm font-bold text-neutral-900 uppercase">Panel de Resultados y Rendimiento ${isEmail ? 'Mailing B2B' : 'WhatsApp'}</h3>
              <p class="text-xs text-neutral-500">${isEmail ? 'Métricas sincronizadas en tiempo real vía Google Workspace Gmail API' : 'Métricas sincronizadas en tiempo real con Meta Cloud API'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-open-glossary-results" type="button" class="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs">
              <span>📖</span> <span>Glosario de Métricas</span>
            </button>
            <span class="px-2.5 py-1 ${isEmail ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} font-mono text-[10px] font-bold rounded-full border">
              ${isEmail ? '✉️ Gmail API Activo' : '🟢 Meta WABA Activo'}
            </span>
          </div>
        </div>

        <!-- 1. Top KPI Summary Grid (6 Cards) -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Tasa de Envío</span>
            <strong class="text-2xl font-mono text-primary mt-1">${sendRate}%</strong>
            <span class="text-[9px] text-neutral-500 font-mono mt-1">${totalSent} de ${totalAudience} msjs</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Tasa de Entrega</span>
            <strong class="text-2xl font-mono text-emerald-600 mt-1">${deliveryRate}%</strong>
            <span class="text-[9px] text-emerald-700 font-mono mt-1">${totalDelivered} entregados</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Aperturas Detectadas</span>
            <strong class="text-2xl font-mono text-blue-600 mt-1">${readRate}%</strong>
            <span class="text-[9px] text-blue-700 font-mono mt-1">${totalRead} aperturas</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Tasa de Clics (CTR)</span>
            <strong class="text-2xl font-mono text-purple-600 mt-1">${clickRate}%</strong>
            <span class="text-[9px] text-purple-700 font-mono mt-1">${totalClicks} clics en CTA</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Inversión Mensajes</span>
            <strong class="text-2xl font-mono text-neutral-900 mt-1">$${estimatedCostUSD} <span class="text-xs text-neutral-400 font-normal">USD</span></strong>
            <span class="text-[9px] text-neutral-500 font-mono mt-1">${isEmail ? 'Incluido en Workspace' : 'Tarifa Meta Marketing'}</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Costo por Clic</span>
            <strong class="text-2xl font-mono text-amber-600 mt-1">$${costPerClickUSD} <span class="text-xs text-neutral-400 font-normal">USD</span></strong>
            <span class="text-[9px] text-amber-700 font-mono mt-1">Costo por interacción</span>
          </div>
        </div>

        <!-- 2. Conversion Funnel Visual Card -->
        <div class="p-5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase tracking-wide">Embudo Visual de Conversión y Retención</h4>
            <span class="text-[10px] font-mono text-neutral-400">Paso a paso de la audiencia</span>
          </div>

          <div class="flex flex-col gap-3">
            <!-- Stage 1: Target Audience -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-neutral-700">1. Audiencia Seleccionada</span>
                <span class="font-bold text-neutral-900">${totalAudience} destinatarios (100%)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-neutral-800 h-full rounded-full" style="width: 100%"></div>
              </div>
            </div>

            <!-- Stage 2: Sent -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-primary">2. ${isEmail ? 'Emails Procesados por Gmail API' : 'Enviados a Meta Cloud API'}</span>
                <span class="font-bold text-primary">${totalSent} (${sendRate}%)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-primary h-full rounded-full" style="width: ${sendRate}%"></div>
              </div>
            </div>

            <!-- Stage 3: Delivered -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-emerald-700">3. Entregados en Buzón</span>
                <span class="font-bold text-emerald-700">${totalDelivered} (${deliveryRate}% efectividad)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-emerald-500 h-full rounded-full" style="width: ${deliveryRate}%"></div>
              </div>
            </div>

            <!-- Stage 4: Read / Opened -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-blue-700">4. ${isEmail ? 'Aperturas Detectadas (Píxel Invisible 1x1)' : 'Leídos por el Cliente'}</span>
                <span class="font-bold text-blue-700">${totalRead} (${readRate}% apertura)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-blue-500 h-full rounded-full" style="width: ${readRate}%"></div>
              </div>
            </div>

            <!-- Stage 5: Interacted / Clicked -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-purple-700">5. Clics en Enlaces CTA</span>
                <span class="font-bold text-purple-700">${totalClicks} (${clickRate}% respuesta)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-purple-500 h-full rounded-full" style="width: ${Math.max(clickRate, 5)}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Financial & Benchmark Grid (2 Columns) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Financial Details Card -->
          <div class="p-5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col gap-3">
            <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase tracking-wide border-b border-neutral-100 pb-2">Desglose Financiero de Envíos</h4>
            <div class="flex flex-col gap-2 text-xs">
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Proveedor de Envío:</span>
                <strong class="text-neutral-900">${isEmail ? 'Gmail API (Cuenta de Servicio)' : 'Meta Cloud API (WABA)'}</strong>
              </div>
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Costo Unitario por Mensaje:</span>
                <strong class="text-neutral-900">${isEmail ? '$0.00 USD (Incluido)' : `$${costPerDeliveredUSD} USD / msj entregado`}</strong>
              </div>
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Monto Invertido en Envíos:</span>
                <strong class="text-emerald-600 text-sm">$${estimatedCostUSD} USD</strong>
              </div>
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Costo Efectivo por Clic:</span>
                <strong class="text-purple-600 text-sm">$${costPerClickUSD} USD</strong>
              </div>
            </div>
          </div>

          <!-- Industry Benchmarks Comparison Card -->
          <div class="p-5 bg-neutral-900 text-white rounded-xl flex flex-col gap-4 shadow-md">
            <div class="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 text-sm">📊</span>
                <h4 class="font-mono text-xs font-bold text-white uppercase tracking-wider">Meta Industry Benchmarks (Percentil 75)</h4>
              </div>
              <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold rounded-full border border-emerald-500/30">Argentina 30d</span>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-1">
              <div class="p-3 bg-neutral-800/60 rounded-lg border border-neutral-800 flex flex-col justify-between">
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Benchmark Lectura</span>
                <strong class="text-xl font-mono text-emerald-400 mt-1">~70.2%</strong>
                <span class="text-[9px] text-emerald-300 block mt-1 font-mono">
                  ${readRate >= 70 ? '🚀 Supera el Benchmark' : '🟢 Dentro del Promedio'}
                </span>
              </div>

              <div class="p-3 bg-neutral-800/60 rounded-lg border border-neutral-800 flex flex-col justify-between">
                <span class="text-[9px] font-mono text-neutral-400 block uppercase">Benchmark Clics</span>
                <strong class="text-xl font-mono text-purple-400 mt-1">~18.7%</strong>
                <span class="text-[9px] text-purple-300 block mt-1 font-mono">
                  ${clickRate >= 18 ? '⚡ Alto Rendimiento' : '🔵 Rendimiento Normal'}
                </span>
              </div>
            </div>
          </div>

        </div>

        <!-- 4. Diagnostics & Error Metrics Card -->
        <div class="p-4 bg-rose-50/40 border border-rose-200/60 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 font-bold text-sm">🛡️</div>
            <div>
              <h5 class="font-mono text-xs font-bold text-rose-900 uppercase">Diagnóstico y Calidad de Envíos</h5>
              <p class="text-[11px] text-rose-700">${totalDiscarded} destinatarios filtrados automáticamente por la regla de protección antispam de 24h.</p>
            </div>
          </div>

          <div class="flex items-center gap-4 text-xs font-mono">
            <div>
              <span class="text-neutral-500 block text-[9px] uppercase">Envíos Fallidos</span>
              <strong class="text-rose-700 text-sm">${totalFailed}</strong>
            </div>
            <div>
              <span class="text-neutral-500 block text-[9px] uppercase">Tasa de Error</span>
              <strong class="text-rose-700 text-sm">${errorRate}%</strong>
            </div>
          </div>
        </div>

      </div>
    `;

    const btnGlossary = tabContent.querySelector('#btn-open-glossary-results');
    if (btnGlossary) {
      btnGlossary.addEventListener('click', () => openCampaignGlossaryModal('metrics'));
    }
  }

  // ----------------------------------------------------
  // TAB 6: Actividad / Cola de Envíos en vivo
  // ----------------------------------------------------
  function renderTabActivity(tabContent) {
    const isEmail = campaign.channel === 'email';

    const sentDeliveredCount = recipients.filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length;
    const readCount = isEmail 
      ? recipients.filter(r => (emailEventsMap.get(r.email_message_id)?.opens.length || 0) > 0).length
      : recipients.filter(r => r.status === 'read').length;
    const pendingCount = recipients.filter(r => ['pending', 'processing'].includes(r.status)).length;
    const failedCount = recipients.filter(r => r.status === 'failed').length;
    const discardedCount = recipients.filter(r => r.status === 'discarded').length;

    tabContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <!-- Header Actions & Controls -->
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-2">
            <h4 class="font-mono text-xs font-bold text-primary uppercase">Historial de Cola de Envíos (${recipients.length} ítems)</h4>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${isEmail ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
              ${isEmail ? '✉️ Canal Mailing B2B' : '🟢 Canal WhatsApp'}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-export-queue-csv" type="button" class="px-3 py-1.5 bg-white hover:bg-neutral-50 text-neutral-800 font-mono text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 border border-neutral-200 shadow-2xs">
              <span>📥</span> <span>Exportar CSV</span>
            </button>
            <button id="btn-open-glossary-queue" type="button" class="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-mono text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 border border-neutral-200 shadow-2xs">
              <span>📖</span> <span>Glosario de Estados</span>
            </button>
            <button id="btn-refresh-queue" type="button" class="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs">
              <span>🔄</span> <span>Actualizar</span>
            </button>
          </div>
        </div>

        <!-- Filter Bar: Search + Status Filter Pills -->
        <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <!-- Status Pills -->
          <div class="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
            <button type="button" class="filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activityStatusFilter === 'all' ? 'bg-primary text-white shadow-2xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}" data-filter="all">
              Todos (${recipients.length})
            </button>
            <button type="button" class="filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activityStatusFilter === 'sent_delivered' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}" data-filter="sent_delivered">
              Entregados (${sentDeliveredCount})
            </button>
            <button type="button" class="filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activityStatusFilter === 'read' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}" data-filter="read">
              Leídos (${readCount})
            </button>
            <button type="button" class="filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activityStatusFilter === 'pending' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}" data-filter="pending">
              Pendientes (${pendingCount})
            </button>
            <button type="button" class="filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activityStatusFilter === 'failed' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}" data-filter="failed">
              Fallidos (${failedCount})
            </button>
            <button type="button" class="filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activityStatusFilter === 'discarded' ? 'bg-neutral-800 text-white shadow-2xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}" data-filter="discarded">
              Descartados (${discardedCount})
            </button>
          </div>

          <!-- Search Input -->
          <div class="relative min-w-[260px]">
            <input type="text" id="input-queue-search" placeholder="🔍 Buscar contacto, empresa, email o tel..." value="${activitySearchTerm}" class="cohere-input text-xs w-full py-1.5 pl-3 pr-8" />
            ${activitySearchTerm ? `
              <button id="btn-clear-search" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs font-bold cursor-pointer">✕</button>
            ` : ''}
          </div>
        </div>

        <!-- Filter Count Subtitle -->
        <div class="flex items-center justify-between text-xs font-mono text-neutral-500 px-1">
          <span id="queue-display-count">Cargando lista filtrada...</span>
          <span class="text-[10px] text-neutral-400">Ordenado por fecha de creación</span>
        </div>

        <!-- Table Container -->
        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto max-h-[550px]">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="sticky top-0 bg-neutral-900 text-white font-mono text-[10px] uppercase tracking-wider z-10">
                ${isEmail ? `
                  <tr>
                    <th class="py-2.5 px-4">Destinatario</th>
                    <th class="py-2.5 px-4">Empresa / Marca</th>
                    <th class="py-2.5 px-4">Estado Final</th>
                    <th class="py-2.5 px-4 text-center">Enviado</th>
                    <th class="py-2.5 px-4 text-center">Aperturas</th>
                    <th class="py-2.5 px-4 text-center">Clics CTA</th>
                    <th class="py-2.5 px-4">Detalle / ID</th>
                  </tr>
                ` : `
                  <tr>
                    <th class="py-2.5 px-4">Destinatario</th>
                    <th class="py-2.5 px-4">Empresa / Marca</th>
                    <th class="py-2.5 px-4">Estado Final</th>
                    <th class="py-2.5 px-4 text-center">Enviado</th>
                    <th class="py-2.5 px-4 text-center">Entregado</th>
                    <th class="py-2.5 px-4 text-center">Leído</th>
                    <th class="py-2.5 px-4 text-center">Clics CTA</th>
                    <th class="py-2.5 px-4">WAMID / Detalle</th>
                  </tr>
                `}
              </thead>
              <tbody id="queue-table-body" class="divide-y divide-neutral-200 font-mono">
                <!-- Dynamically rendered -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Filter computation
    function getFilteredRecipients() {
      return recipients.filter(r => {
        // Status Filter
        if (activityStatusFilter === 'sent_delivered' && !['sent', 'delivered', 'read'].includes(r.status)) return false;
        if (activityStatusFilter === 'read') {
          const isRead = isEmail 
            ? ((emailEventsMap.get(r.email_message_id)?.opens.length || 0) > 0) 
            : (r.status === 'read');
          if (!isRead) return false;
        }
        if (activityStatusFilter === 'pending' && !['pending', 'processing'].includes(r.status)) return false;
        if (activityStatusFilter === 'failed' && r.status !== 'failed') return false;
        if (activityStatusFilter === 'discarded' && r.status !== 'discarded') return false;

        // Search Term Filter
        if (activitySearchTerm.trim()) {
          const q = activitySearchTerm.toLowerCase().trim();
          const company = (r.leads?.company || '').toLowerCase();
          const phone = (r.recipient_phone || '').toLowerCase();
          const email = (r.recipient_email || '').toLowerCase();
          const name = (r.resolved_variables?.['1'] || '').toLowerCase();
          const errorMsg = (r.error_message || r.discard_reason || r.wamid || '').toLowerCase();
          return company.includes(q) || phone.includes(q) || email.includes(q) || name.includes(q) || errorMsg.includes(q);
        }

        return true;
      });
    }

    // Render table rows
    function updateQueueTable() {
      const tbody = tabContent.querySelector('#queue-table-body');
      const countEl = tabContent.querySelector('#queue-display-count');
      if (!tbody) return;

      const filtered = getFilteredRecipients();
      if (countEl) {
        countEl.textContent = `Mostrando ${filtered.length.toLocaleString()} de ${recipients.length.toLocaleString()} destinatarios`;
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${isEmail ? 7 : 8}" class="py-12 text-center text-neutral-400 font-mono">
              No se encontraron registros que coincidan con los filtros aplicados.
            </td>
          </tr>
        `;
        return;
      }

      const contactsList = cache.contacts instanceof Map ? Array.from(cache.contacts.values()) : (Array.isArray(cache.contacts) ? cache.contacts : []);

      tbody.innerHTML = filtered.map(r => {
        let contactObj = null;
        if (isEmail && r.recipient_email && contactsList.length > 0) {
          contactObj = contactsList.find(c => c.email && c.email.toLowerCase() === String(r.recipient_email).toLowerCase());
        } else if (r.recipient_phone && contactsList.length > 0) {
          const cleanPhone = String(r.recipient_phone).replace(/[^0-9]/g, '');
          contactObj = contactsList.find(c => c.phone && c.phone.replace(/[^0-9]/g, '') === cleanPhone);
        }

        const leadName = contactObj 
          ? `${contactObj.first_name || ''} ${contactObj.last_name || ''}`.trim()
          : (r.resolved_variables?.['1'] || r.leads?.company || 'Prospecto sin nombre');
        const companyName = r.leads?.company || '-';
        const contactContactInfo = isEmail ? (r.recipient_email || '-') : (r.recipient_phone || '-');

        if (isEmail) {
          // --- Telemetría para MAILING ---
          const evData = r.email_message_id ? emailEventsMap.get(r.email_message_id) : null;
          const opens = evData?.opens || [];
          const clicks = evData?.clicks || [];

          let sentCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (r.sent_at) {
            sentCell = `
              <div class="flex flex-col items-center">
                <span class="text-teal-700 font-bold flex items-center gap-1 font-mono text-[11px]">
                  <span class="text-teal-600 font-extrabold">✓</span> ${new Date(r.sent_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono">${new Date(r.sent_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
            `;
          } else if (r.status === 'failed') {
            sentCell = `<span class="text-rose-500 font-mono text-[11px] font-bold">✗ Fallido</span>`;
          } else if (r.status === 'discarded') {
            sentCell = `<span class="text-neutral-400 font-mono text-[11px]">🚫 Excluido</span>`;
          } else {
            sentCell = `<span class="text-amber-600 font-mono text-[11px]">🕒 En cola</span>`;
          }

          let opensCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (opens.length > 0) {
            const lastOpen = opens[opens.length - 1];
            opensCell = `
              <div class="flex flex-col items-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs flex items-center gap-1">
                  🟢 ${opens.length} ${opens.length === 1 ? 'apertura' : 'aperturas'}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono mt-0.5" title="${new Date(lastOpen.created_at).toLocaleString('es-AR')}">
                  Últ: ${new Date(lastOpen.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            `;
          } else if (['sent', 'delivered', 'read'].includes(r.status)) {
            opensCell = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-100 border border-neutral-200">⚪ Sin abrir</span>`;
          }

          let clicksCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (clicks.length > 0) {
            const lastClick = clicks[clicks.length - 1];
            const uniqueUrls = [...new Set(clicks.map(c => c.url).filter(Boolean))].join(' | ');
            clicksCell = `
              <div class="flex flex-col items-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs flex items-center gap-1 cursor-help" title="${uniqueUrls || 'Clic registrado'}">
                  🟣 ${clicks.length} ${clicks.length === 1 ? 'clic' : 'clics'}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono mt-0.5">
                  Últ: ${new Date(lastClick.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            `;
          } else if (['sent', 'delivered', 'read'].includes(r.status)) {
            clicksCell = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-100 border border-neutral-200">⚪ Sin clics</span>`;
          }

          return `
            <tr class="hover:bg-neutral-50 transition-colors">
              <td class="py-2.5 px-4 font-sans font-medium text-neutral-800">
                <div class="flex flex-col">
                  <span>${leadName}</span>
                  <span class="text-[10px] font-mono text-neutral-400">${contactContactInfo}</span>
                </div>
              </td>
              <td class="py-2.5 px-4 font-sans font-semibold text-neutral-900">${companyName}</td>
              <td class="py-2.5 px-4">
                ${getRecipientStatusBadge(r.status, r.discard_reason)}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${sentCell}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${opensCell}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${clicksCell}
              </td>
              <td class="py-2.5 px-4 text-[10px] text-neutral-500 truncate max-w-xs font-mono">
                ${r.error_message || r.discard_reason || (r.email_message_id ? r.email_message_id.slice(0, 8) + '...' : '-')}
              </td>
            </tr>
          `;
        } else {
          // --- Telemetría para WHATSAPP ---
          let sentCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (r.sent_at) {
            sentCell = `
              <div class="flex flex-col items-center">
                <span class="text-teal-700 font-bold flex items-center gap-1 font-mono text-[11px]">
                  <span class="text-teal-600 font-bold">✓</span> ${new Date(r.sent_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono">${new Date(r.sent_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
            `;
          } else if (r.status === 'failed') {
            sentCell = `<span class="text-rose-500 font-mono text-[11px] font-bold">✗ Fallido</span>`;
          } else if (r.status === 'discarded') {
            sentCell = `<span class="text-neutral-400 font-mono text-[11px]">🚫 Excluido</span>`;
          } else {
            sentCell = `<span class="text-amber-600 font-mono text-[11px]">🕒 En cola</span>`;
          }

          let deliveredCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (r.delivered_at) {
            deliveredCell = `
              <div class="flex flex-col items-center">
                <span class="text-emerald-700 font-bold flex items-center gap-1 font-mono text-[11px]">
                  <span class="text-emerald-600 font-bold">✓✓</span> ${new Date(r.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono">${new Date(r.delivered_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
            `;
          } else if (['delivered', 'read'].includes(r.status)) {
            deliveredCell = `<span class="text-emerald-700 font-mono text-[11px] font-bold flex items-center justify-center gap-1"><span class="text-emerald-600 font-bold">✓✓</span> Confirmado</span>`;
          } else if (r.status === 'sent') {
            deliveredCell = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-100 border border-neutral-200">En tránsito</span>`;
          }

          let readCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (r.read_at) {
            readCell = `
              <div class="flex flex-col items-center">
                <span class="text-blue-700 font-bold flex items-center gap-1 font-mono text-[11px]">
                  <span class="text-blue-600 font-extrabold">✓✓</span> ${new Date(r.read_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono">${new Date(r.read_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
              </div>
            `;
          } else if (r.status === 'read') {
            readCell = `<span class="text-blue-700 font-mono text-[11px] font-bold flex items-center justify-center gap-1"><span class="text-blue-600 font-extrabold">✓✓</span> Leído</span>`;
          } else if (['sent', 'delivered'].includes(r.status)) {
            readCell = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-100 border border-neutral-200">⚪ No leído</span>`;
          }

          let clicksCell = `<span class="text-neutral-300 font-mono text-[11px]">—</span>`;
          if (r.cta_clicked_at) {
            clicksCell = `
              <div class="flex flex-col items-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs flex items-center gap-1">
                  ⚡ ${r.cta_detail || 'Completado'}
                </span>
                <span class="text-[9px] text-neutral-400 font-mono mt-0.5">
                  ${new Date(r.cta_clicked_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            `;
          } else if (['sent', 'delivered', 'read'].includes(r.status)) {
            clicksCell = `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-100 border border-neutral-200">⚪ Sin clics</span>`;
          }

          return `
            <tr class="hover:bg-neutral-50 transition-colors">
              <td class="py-2.5 px-4 font-sans font-medium text-neutral-800">
                <div class="flex flex-col">
                  <span>${leadName}</span>
                  <span class="text-[10px] font-mono text-neutral-400">${contactContactInfo}</span>
                </div>
              </td>
              <td class="py-2.5 px-4 font-sans font-semibold text-neutral-900">${companyName}</td>
              <td class="py-2.5 px-4">
                ${getRecipientStatusBadge(r.status, r.discard_reason)}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${sentCell}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${deliveredCell}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${readCell}
              </td>
              <td class="py-2.5 px-4 text-center">
                ${clicksCell}
              </td>
              <td class="py-2.5 px-4 text-[10px] text-neutral-500 truncate max-w-xs font-mono">
                ${r.wamid || r.error_message || r.discard_reason || '-'}
              </td>
            </tr>
          `;
        }
      }).join('');
    }

    // Attach search listener
    const searchInput = tabContent.querySelector('#input-queue-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        activitySearchTerm = e.target.value;
        updateQueueTable();
      });
    }

    const btnClearSearch = tabContent.querySelector('#btn-clear-search');
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        activitySearchTerm = '';
        if (searchInput) searchInput.value = '';
        updateQueueTable();
      });
    }

    // Attach pill click listeners
    tabContent.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activityStatusFilter = pill.dataset.filter;
        tabContent.querySelectorAll('.filter-pill').forEach(p => {
          p.className = 'filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer bg-neutral-100 text-neutral-600 hover:bg-neutral-200';
        });
        const activeColor = activityStatusFilter === 'sent_delivered' ? 'bg-emerald-600' :
          activityStatusFilter === 'read' ? 'bg-blue-600' :
          activityStatusFilter === 'pending' ? 'bg-amber-600' :
          activityStatusFilter === 'failed' ? 'bg-rose-600' :
          activityStatusFilter === 'discarded' ? 'bg-neutral-800' : 'bg-primary';
        pill.className = `filter-pill px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${activeColor} text-white shadow-2xs`;
        updateQueueTable();
      });
    });

    // Attach CSV Export listener
    const btnExportCSV = tabContent.querySelector('#btn-export-queue-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => {
        const filtered = getFilteredRecipients();
        if (filtered.length === 0) {
          toast.show('No hay registros para exportar con los filtros seleccionados', 'error');
          return;
        }

        const headers = ['Contacto', 'Empresa', 'Canal', 'Destino', 'Estado', 'Enviado_En', 'Entregado_En', 'Leido_En', 'Clics', 'Detalle_Error'];
        const rows = filtered.map(r => {
          const contactInfo = isEmail ? (r.recipient_email || '') : (r.recipient_phone || '');
          const leadName = r.resolved_variables?.['1'] || r.leads?.company || '';
          const company = r.leads?.company || '';
          const status = r.status;
          const sentAt = r.sent_at ? new Date(r.sent_at).toLocaleString('es-AR') : '';
          const deliveredAt = r.delivered_at ? new Date(r.delivered_at).toLocaleString('es-AR') : '';
          const readAt = r.read_at ? new Date(r.read_at).toLocaleString('es-AR') : '';
          const clicks = isEmail ? (emailEventsMap.get(r.email_message_id)?.clicks?.length || 0) : (r.cta_clicked_at ? 1 : 0);
          const detail = (r.error_message || r.discard_reason || r.wamid || '').replace(/"/g, '""');

          return [
            `"${leadName.replace(/"/g, '""')}"`,
            `"${company.replace(/"/g, '""')}"`,
            `"${isEmail ? 'Email' : 'WhatsApp'}"`,
            `"${contactInfo}"`,
            `"${status}"`,
            `"${sentAt}"`,
            `"${deliveredAt}"`,
            `"${readAt}"`,
            `"${clicks}"`,
            `"${detail}"`
          ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        const cleanName = (campaign.name || 'campana').toLowerCase().replace(/[^a-z0-9]/g, '_');
        link.setAttribute('download', `${cleanName}_cola_envios.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.show('Cola exportada exitosamente a CSV', 'success');
      });
    }

    const btnRefresh = tabContent.querySelector('#btn-refresh-queue');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        await loadCampaignData();
      });
    }

    const btnGlossary = tabContent.querySelector('#btn-open-glossary-queue');
    if (btnGlossary) {
      btnGlossary.addEventListener('click', () => openCampaignGlossaryModal('statuses'));
    }

    // Initial table render
    updateQueueTable();
  }

  function getRecipientStatusBadge(status, discardReason) {
    if (status === 'read') return `<span class="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span class="text-blue-600 font-extrabold">✓✓</span> LEÍDO</span>`;
    if (status === 'delivered') return `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span class="text-emerald-600 font-bold">✓✓</span> ENTREGADO</span>`;
    if (status === 'sent') return `<span class="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span class="text-teal-600 font-bold">✓</span> ENVIADO</span>`;
    if (status === 'processing') return `<span class="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span class="text-indigo-600 font-bold animate-pulse">⚡</span> PROCESANDO</span>`;
    if (status === 'failed') return `<span class="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span class="text-rose-600 font-bold">✗</span> FALLIDO</span>`;
    if (status === 'discarded') return `<span class="px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span>🚫</span> DESCARTADO (${discardReason || 'Regla 24h'})</span>`;
    return `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[9px] flex items-center gap-1 w-fit"><span class="text-amber-600 font-bold">🕒</span> PENDIENTE</span>`;
  }

  // ----------------------------------------------------
  // Interactive Glossary Modal
  // ----------------------------------------------------
  function openCampaignGlossaryModal(initialTab = 'statuses') {
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans';
    
    modalOverlay.innerHTML = `
      <div class="bg-white border border-neutral-200 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        
        <!-- Modal Header -->
        <div class="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">📖</span>
            <div>
              <h3 class="font-mono text-sm font-bold uppercase tracking-wide">Glosario de Campañas y Métricas</h3>
              <p class="text-[11px] text-neutral-400">Guía de referencia para entender estados, embudos y costos</p>
            </div>
          </div>
          <button id="btn-close-glossary" class="text-neutral-400 hover:text-white text-lg font-bold cursor-pointer px-2 py-1 transition-colors">✕</button>
        </div>

        <!-- Glossary Tabs -->
        <div class="bg-neutral-100 border-b border-neutral-200 px-6 py-2 flex items-center gap-2 text-xs font-mono font-bold uppercase">
          <button id="tab-btn-statuses" class="gloss-tab px-3 py-1.5 rounded-lg ${initialTab === 'statuses' ? 'bg-primary text-white' : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'} cursor-pointer transition-colors">
            1. Estados de la Cola
          </button>
          <button id="tab-btn-metrics" class="gloss-tab px-3 py-1.5 rounded-lg ${initialTab === 'metrics' ? 'bg-primary text-white' : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'} cursor-pointer transition-colors">
            2. Métricas y Embudo
          </button>
        </div>

        <!-- Modal Body Content -->
        <div id="glossary-tab-content" class="p-6 overflow-y-auto flex-1 bg-neutral-50 flex flex-col gap-4 text-xs">
          <!-- Content rendered dynamically -->
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-3 bg-white border-t border-neutral-200 flex justify-end">
          <button id="btn-glossary-done" class="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors">
            Entendido
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modalOverlay);

    const glossContent = modalOverlay.querySelector('#glossary-tab-content');
    const tabBtnStatuses = modalOverlay.querySelector('#tab-btn-statuses');
    const tabBtnMetrics = modalOverlay.querySelector('#tab-btn-metrics');
    const btnClose = modalOverlay.querySelector('#btn-close-glossary');
    const btnDone = modalOverlay.querySelector('#btn-glossary-done');

    const closeModal = () => modalOverlay.remove();
    btnClose.addEventListener('click', closeModal);
    btnDone.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    const renderStatusesTab = () => {
      tabBtnStatuses.className = 'gloss-tab px-3 py-1.5 rounded-lg bg-primary text-white cursor-pointer transition-colors';
      tabBtnMetrics.className = 'gloss-tab px-3 py-1.5 rounded-lg bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200 cursor-pointer transition-colors';

      glossContent.innerHTML = `
        <div class="flex flex-col gap-4">
          <p class="text-neutral-600 text-[11.5px] leading-relaxed">
            Cada fila en la solapa <strong>Actividad / Cola</strong> detalla el ciclo de vida y telemetría de cada mensaje enviado según el canal:
          </p>

          <!-- Canal Mailing -->
          <div class="border border-blue-200 bg-blue-50/40 rounded-xl p-3 flex flex-col gap-2">
            <h5 class="font-mono text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
              <span>✉️</span> Columnas y Métricas de Mailing (Email)
            </h5>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
              <div class="p-2.5 bg-white border border-blue-100 rounded-lg shadow-2xs">
                <strong class="text-teal-700 block font-bold">1. Enviado (✓)</strong>
                <span class="text-neutral-600">Fecha y hora en que Google Workspace Gmail API despachó el correo.</span>
              </div>
              <div class="p-2.5 bg-white border border-blue-100 rounded-lg shadow-2xs">
                <strong class="text-blue-700 block font-bold">2. Aperturas (🟢)</strong>
                <span class="text-neutral-600">Detección por píxel invisible 1x1. Cantidad y hora más reciente.</span>
              </div>
              <div class="p-2.5 bg-white border border-blue-100 rounded-lg shadow-2xs">
                <strong class="text-purple-700 block font-bold">3. Clics CTA (🟣)</strong>
                <span class="text-neutral-600">Clics en botones y enlaces rastreados vía redireccionador.</span>
              </div>
            </div>
          </div>

          <!-- Canal WhatsApp -->
          <div class="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex flex-col gap-2">
            <h5 class="font-mono text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
              <span>🟢</span> Columnas y Checks de WhatsApp
            </h5>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px]">
              <div class="p-2.5 bg-white border border-emerald-100 rounded-lg shadow-2xs">
                <strong class="text-teal-700 block font-bold">✓ Enviado</strong>
                <span class="text-neutral-600">Aceptado por Meta con WAMID.</span>
              </div>
              <div class="p-2.5 bg-white border border-emerald-100 rounded-lg shadow-2xs">
                <strong class="text-emerald-700 block font-bold">✓✓ Entregado</strong>
                <span class="text-neutral-600">Recibido en el móvil del cliente.</span>
              </div>
              <div class="p-2.5 bg-white border border-emerald-100 rounded-lg shadow-2xs">
                <strong class="text-blue-700 block font-bold">✓✓ Leído</strong>
                <span class="text-neutral-600">Visto en WhatsApp (doble check azul).</span>
              </div>
              <div class="p-2.5 bg-white border border-emerald-100 rounded-lg shadow-2xs">
                <strong class="text-purple-700 block font-bold">⚡ Clics CTA</strong>
                <span class="text-neutral-600">Pulsación de botón o Flow completado.</span>
              </div>
            </div>
          </div>

          <h5 class="font-mono text-xs font-bold text-neutral-800 uppercase mt-1">Estados Finales del Despacho</h5>
          <div class="grid grid-cols-1 gap-2.5">
            
            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300/80 rounded-full font-mono font-bold text-[9.5px] shrink-0">🕒 PENDIENTE</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">En cola de espera</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  El contacto fue seleccionado y calificado por los filtros de la audiencia, pero el despachador automático aún no procesó su envío (se despachan en lotes cada minuto).
                </p>
              </div>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-indigo-100 text-indigo-900 border border-indigo-300/80 rounded-full font-mono font-bold text-[9.5px] shrink-0">⚡ PROCESANDO</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">En despacho activo</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  El destinatario fue reclamado de manera atómica por el motor de envíos y se está conectando con la API de Meta para transmitir la plantilla de forma segura.
                </p>
              </div>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-300/80 rounded-full font-mono font-bold text-[9.5px] shrink-0">✓ ENVIADO</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">Transmitido a Meta Cloud API</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  El mensaje salió del CRM y fue aceptado exitosamente por los servidores de Meta. Meta devuelve un código <code>wamid</code> como comprobante de salida.
                </p>
              </div>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300/80 rounded-full font-mono font-bold text-[9.5px] shrink-0">✓✓ ENTREGADO</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">Recibido en el celular del contacto</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  Meta envió el webhook de confirmación indicando que el mensaje ingresó con éxito a la aplicación de WhatsApp del destinatario (equivalente al doble check gris).
                </p>
              </div>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-300/80 rounded-full font-mono font-bold text-[9.5px] shrink-0">✓✓ LEÍDO</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">Apertura detectada</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  El destinatario abrió la conversación de WhatsApp y visualizó el mensaje de la plantilla (equivalente al doble check azul).
                </p>
              </div>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-rose-100 text-rose-900 border border-rose-300/80 rounded-full font-mono font-bold text-[9.5px] shrink-0">✗ FALLIDO</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">Rechazado por Meta API</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  Meta no pudo enviar el mensaje. La causa exacta se indica en la columna <em>WAMID / Detalle</em> (por ej. número inválido o no registrado en WhatsApp, error de plantilla o saldo de cuenta).
                </p>
              </div>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex items-start gap-3">
              <span class="px-2.5 py-1 bg-neutral-200 text-neutral-800 border border-neutral-300 rounded-full font-mono font-bold text-[9.5px] shrink-0">🚫 DESCARTADO</span>
              <div class="flex flex-col gap-0.5">
                <strong class="text-neutral-900 text-xs font-bold">Protección Antispam (Regla 24h)</strong>
                <p class="text-neutral-600 text-[11px] leading-relaxed">
                  El contacto formaba parte del segmento pero se excluyó automáticamente antes del envío porque ya había recibido otro mensaje de campaña en las últimas 24 horas, protegiendo la reputación del número comercial.
                </p>
              </div>
            </div>

          </div>
        </div>
      `;
    };

    const renderMetricsTab = () => {
      tabBtnMetrics.className = 'gloss-tab px-3 py-1.5 rounded-lg bg-primary text-white cursor-pointer transition-colors';
      tabBtnStatuses.className = 'gloss-tab px-3 py-1.5 rounded-lg bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200 cursor-pointer transition-colors';

      glossContent.innerHTML = `
        <div class="flex flex-col gap-3">
          <p class="text-neutral-600 text-[11.5px] leading-relaxed">
            Métricas de rendimiento comercial calculadas en la solapa <strong>Resultados / Métricas</strong>:
          </p>

          <div class="grid grid-cols-1 gap-2.5">
            
            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <strong class="text-primary font-mono text-xs font-bold">Tasa de Envío (%)</strong>
                <span class="text-[10px] font-mono text-neutral-400">Total Enviados / Audiencia Total</span>
              </div>
              <p class="text-neutral-600 text-[11px]">
                Porcentaje de contactos de la audiencia a los que el sistema intentó y despachó el mensaje con éxito a Meta Cloud API.
              </p>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <strong class="text-emerald-700 font-mono text-xs font-bold">Tasa de Entrega (%)</strong>
                <span class="text-[10px] font-mono text-neutral-400">Total Entregados / Total Enviados</span>
              </div>
              <p class="text-neutral-600 text-[11px]">
                Porcentaje de mensajes que efectivamente llegaron al celular del usuario (confirmación de entrega en dispositivo).
              </p>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <strong class="text-blue-700 font-mono text-xs font-bold">Aperturas / Tasa de Lectura (%)</strong>
                <span class="text-[10px] font-mono text-neutral-400">Total Leídos / Total Entregados</span>
              </div>
              <p class="text-neutral-600 text-[11px]">
                Porcentaje de contactos que abrieron la conversación de WhatsApp y leyeron el mensaje de la plantilla.
              </p>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <strong class="text-purple-700 font-mono text-xs font-bold">Tasa de Clics / CTR (%)</strong>
                <span class="text-[10px] font-mono text-neutral-400">Total Clics / Total Entregados</span>
              </div>
              <p class="text-neutral-600 text-[11px]">
                Porcentaje de prospectos que hicieron clic en el botón de acción interactivo (Flow de WhatsApp o enlace CTA).
              </p>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <strong class="text-neutral-900 font-mono text-xs font-bold">Inversión Mensajes ($ USD)</strong>
                <span class="text-[10px] font-mono text-neutral-400">Tarifa Meta Marketing (~$0.062 USD/msj)</span>
              </div>
              <p class="text-neutral-600 text-[11px]">
                Costo estimado facturado por Meta por las conversaciones de Marketing iniciadas con éxito en Argentina.
              </p>
            </div>

            <div class="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <strong class="text-amber-700 font-mono text-xs font-bold">Costo por Clic ($ USD)</strong>
                <span class="text-[10px] font-mono text-neutral-400">Inversión Total / Total Clics</span>
              </div>
              <p class="text-neutral-600 text-[11px]">
                Costo unitario por cada interacción o formulario Flow completado por los prospectos.
              </p>
            </div>

          </div>
        </div>
      `;
    };

    tabBtnStatuses.addEventListener('click', renderStatusesTab);
    tabBtnMetrics.addEventListener('click', renderMetricsTab);

    if (initialTab === 'metrics') {
      renderMetricsTab();
    } else {
      renderStatusesTab();
    }
  }

  return wrapper;
}
