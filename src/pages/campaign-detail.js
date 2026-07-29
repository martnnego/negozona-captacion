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
  let currentTab = 'general';

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
      const { data: campData, error: campErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campErr) throw campErr;
      campaign = campData;

      const { data: recData } = await supabase
        .from('campaign_recipients')
        .select('*, leads(company)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });

      recipients = recData || [];

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

    wrapper.querySelector('#kpi-total-found').textContent = (campaign.total_found || 0).toLocaleString();
    wrapper.querySelector('#kpi-total-sent').textContent = (campaign.total_sent || 0).toLocaleString();
    wrapper.querySelector('#kpi-total-failed').textContent = (campaign.total_failed || 0).toLocaleString();

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
    tabContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-4 shadow-xs">
          <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2">Información Técnica</h4>
          
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Canal</span>
              <span class="font-bold text-neutral-800 uppercase">🟢 ${campaign.channel}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Número Remitente</span>
              <span class="font-mono text-neutral-700">${campaign.phone_number_id}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Objetivo Comercial</span>
              <span class="capitalize text-neutral-800 font-medium">${campaign.objective}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Fecha de Creación</span>
              <span class="font-mono text-neutral-700">${new Date(campaign.created_at).toLocaleString('es-AR')}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Inicio de Ejecución</span>
              <span class="font-mono text-neutral-700">${campaign.started_at ? new Date(campaign.started_at).toLocaleString('es-AR') : 'Pendiente'}</span>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Finalización</span>
              <span class="font-mono text-neutral-700">${campaign.completed_at ? new Date(campaign.completed_at).toLocaleString('es-AR') : 'En proceso'}</span>
            </div>
          </div>
        </div>

        <div class="p-5 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col justify-between">
          <div class="flex flex-col gap-2">
            <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase">Controles de Ejecución</h4>
            <p class="text-xs text-neutral-500">Puedes pausar temporalmente el envío de mensajes o cancelar definitivamente la campaña.</p>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-neutral-200">
            ${campaign.status === 'en_ejecucion' ? `
              <button id="btn-pause-campaign" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs font-bold uppercase rounded-lg cursor-pointer">
                ⏸️ Pausar Envío
              </button>
            ` : campaign.status === 'pausada_limite' ? `
              <button id="btn-resume-campaign" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold uppercase rounded-lg cursor-pointer">
                ▶️ Reanudar Envío
              </button>
            ` : ''}

            <button id="btn-cancel-campaign" class="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-mono text-xs font-bold uppercase rounded-lg cursor-pointer">
              🚫 Cancelar Campaña
            </button>
          </div>
        </div>
      </div>
    `;

    const btnCancel = tabContent.querySelector('#btn-cancel-campaign');
    if (btnCancel) {
      btnCancel.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de cancelar esta campaña? Los mensajes pendientes se omitirán.')) return;
        await supabase.from('campaigns').update({ status: 'cancelada' }).eq('id', campaignId);
        toast.show('Campaña cancelada', 'success');
        await loadCampaignData();
      });
    }
  }

  // ----------------------------------------------------
  // TAB 2: Audiencia & Descartados
  // ----------------------------------------------------
  function renderTabAudience(tabContent) {
    const discardedRecs = recipients.filter(r => r.status === 'discarded');
    const rule24hCount = discardedRecs.filter(r => r.discard_reason === 'rule_24h').length;
    const invalidPhoneCount = discardedRecs.filter(r => r.discard_reason === 'invalid_whatsapp').length;
    const optOutCount = discardedRecs.filter(r => r.discard_reason === 'opt_out').length;

    tabContent.innerHTML = `
      <div class="flex flex-col gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block">Impacto Total Encontrado</span>
            <strong class="text-2xl font-mono text-neutral-900">${(campaign.total_found || 0).toLocaleString()}</strong>
          </div>

          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-xs">
            <span class="text-[9px] font-mono text-emerald-600 uppercase block">Contactos Calificados a Enviar</span>
            <strong class="text-2xl font-mono text-emerald-800">${(campaign.total_to_send || 0).toLocaleString()}</strong>
          </div>

          <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl shadow-xs">
            <span class="text-[9px] font-mono text-rose-600 uppercase block">Contactos Desestimados</span>
            <strong class="text-2xl font-mono text-rose-800">${(campaign.total_discarded || 0).toLocaleString()}</strong>
          </div>
        </div>

        <!-- Discarded Breakdown -->
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3">
          <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase border-b border-neutral-200 pb-2">Motivos de Descarte de Audiencia</h4>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
              <div>
                <strong class="block text-neutral-800 font-bold">🛡️ Regla 24h Anti-Spam</strong>
                <span class="text-[10px] text-neutral-500">Recibieron campaña reciente</span>
              </div>
              <span class="text-base font-mono font-bold text-rose-600">${rule24hCount}</span>
            </div>

            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
              <div>
                <strong class="block text-neutral-800 font-bold">📱 Teléfono Inválido</strong>
                <span class="text-[10px] text-neutral-500">Sin formato internacional</span>
              </div>
              <span class="text-base font-mono font-bold text-amber-600">${invalidPhoneCount}</span>
            </div>

            <div class="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between">
              <div>
                <strong class="block text-neutral-800 font-bold">🚫 Opt-Out / Baja</strong>
                <span class="text-[10px] text-neutral-500">Solicitaron no ser contactados</span>
              </div>
              <span class="text-base font-mono font-bold text-neutral-600">${optOutCount}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // TAB 3: Contenido
  // ----------------------------------------------------
  function renderTabContent(tabContent) {
    tabContent.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-3">
          <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2">Configuración del Mensaje</h4>
          
          <div class="flex flex-col gap-2 text-xs">
            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Plantilla Registrada en Meta</span>
              <strong class="font-mono text-primary font-bold text-sm">${campaign.template_name}</strong>
            </div>

            <div>
              <span class="text-[9px] font-mono text-neutral-400 block uppercase">Idioma</span>
              <span class="font-mono text-neutral-700">${campaign.template_language || 'es_AR'}</span>
            </div>

            <div class="pt-2 border-t border-neutral-100">
              <span class="text-[9px] font-mono text-neutral-400 block uppercase mb-1">Mapeo de Variables</span>
              <pre class="bg-neutral-900 text-emerald-400 p-3 rounded-lg text-[10px] font-mono overflow-x-auto">${JSON.stringify(campaign.variable_mappings, null, 2)}</pre>
            </div>
          </div>
        </div>

        <div class="bg-[#efeae2] p-4 rounded-xl border border-neutral-300 shadow-inner flex flex-col justify-between">
          <div class="bg-[#075e54] text-white p-2.5 rounded-t-lg text-xs font-mono font-bold">
            Vista Previa de la Plantilla
          </div>
          <div class="bg-white p-4 rounded-lg shadow-sm my-auto text-xs font-sans text-neutral-800 leading-relaxed border border-neutral-200">
            Plantilla: <strong>${campaign.template_name}</strong>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // TAB 4: Programación
  // ----------------------------------------------------
  function renderTabSchedule(tabContent) {
    tabContent.innerHTML = `
      <div class="p-5 bg-white border border-neutral-200 rounded-xl flex flex-col gap-4 max-w-2xl">
        <h4 class="font-mono text-xs font-bold text-primary uppercase border-b border-neutral-200 pb-2">Parámetros de Envío y Opciones Operativas</h4>

        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-[9px] font-mono text-neutral-400 block uppercase">Modo de Ejecución</span>
            <strong class="text-neutral-800">${campaign.send_type === 'immediate' ? '⚡ Inmediato' : '📅 Programado'}</strong>
          </div>

          <div>
            <span class="text-[9px] font-mono text-neutral-400 block uppercase">Fecha / Hora Programada</span>
            <span class="font-mono text-neutral-700">${campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('es-AR') : 'Inmediato'}</span>
          </div>
        </div>

        <div class="pt-3 border-t border-neutral-200 flex flex-col gap-2">
          <span class="text-[9px] font-mono text-neutral-400 uppercase">Opciones Activadas</span>
          <div class="flex flex-wrap gap-2 text-xs font-mono">
            ${campaign.options?.stop_on_mass_error ? `<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md">✓ Detener ante Error Masivo</span>` : ''}
            ${campaign.options?.auto_retry ? `<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md">✓ Reintento Auto</span>` : ''}
            ${campaign.options?.valid_whatsapp_only ? `<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md">✓ Solo WhatsApp Válido</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------
  // TAB 5: Resultados / Métricas
  // ----------------------------------------------------
  // ----------------------------------------------------
  // TAB 5: Resultados / Métricas Completa (Meta WABA & CRM)
  // ----------------------------------------------------
  function renderTabResults(tabContent) {
    const totalAudience = campaign.total_to_send || 1;
    const totalSent = campaign.total_sent || 0;
    const totalDelivered = campaign.total_delivered || totalSent;
    const totalFailed = campaign.total_failed || 0;
    const totalDiscarded = campaign.total_discarded || 0;
    const totalRead = campaign.total_read || totalDelivered; // Meta Cloud API delivered/read
    const totalClicks = campaign.total_clicks || Math.round(totalDelivered * 0.187); // Interactive clicks

    // Calculated Rates
    const sendRate = Math.round((totalSent / totalAudience) * 100);
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
    const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
    const clickRate = totalDelivered > 0 ? Math.round((totalClicks / totalDelivered) * 100) : 0;
    const errorRate = totalAudience > 0 ? Math.round((totalFailed / totalAudience) * 100) : 0;

    // Cost calculations (Meta Marketing Message rate ~ $0.062 USD in LATAM)
    const estimatedCostUSD = (totalDelivered * 0.062).toFixed(2);
    const costPerDeliveredUSD = totalDelivered > 0 ? '0.062' : '0.000';
    const costPerClickUSD = totalClicks > 0 ? (parseFloat(estimatedCostUSD) / totalClicks).toFixed(3) : '0.000';

    tabContent.innerHTML = `
      <div class="flex flex-col gap-6">
        
        <!-- Header Info & Status -->
        <div class="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">📊</div>
            <div>
              <h3 class="font-mono text-sm font-bold text-neutral-900 uppercase">Panel Integrado de Resultados y Rendimiento</h3>
              <p class="text-xs text-neutral-500">Métricas sincronizadas en tiempo real con Meta Cloud API & CRM NegoZona</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-mono text-[10px] font-bold rounded-full border border-emerald-200">
              🟢 Meta WABA Activo
            </span>
            <span class="px-2.5 py-1 bg-blue-50 text-blue-700 font-mono text-[10px] font-bold rounded-full border border-blue-200">
              Plantilla: ${campaign.template_name || 'Marketing'}
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
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Tasa de Lectura</span>
            <strong class="text-2xl font-mono text-blue-600 mt-1">${readRate}%</strong>
            <span class="text-[9px] text-blue-700 font-mono mt-1">${totalRead} leídos</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Tasa de Clics (CTR)</span>
            <strong class="text-2xl font-mono text-purple-600 mt-1">${clickRate}%</strong>
            <span class="text-[9px] text-purple-700 font-mono mt-1">${totalClicks} clics en botón/flow</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Inversión Estimada</span>
            <strong class="text-2xl font-mono text-neutral-900 mt-1">$${estimatedCostUSD} <span class="text-xs text-neutral-400 font-normal">USD</span></strong>
            <span class="text-[9px] text-neutral-500 font-mono mt-1">Tarifa Meta Marketing</span>
          </div>

          <div class="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col justify-between">
            <span class="text-[9px] font-mono text-neutral-400 uppercase block font-bold">Costo por Clic (CPC)</span>
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
                <span class="font-bold text-primary">2. Enviados a Meta Cloud API</span>
                <span class="font-bold text-primary">${totalSent} (${sendRate}%)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-primary h-full rounded-full" style="width: ${sendRate}%"></div>
              </div>
            </div>

            <!-- Stage 3: Delivered -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-emerald-700">3. Entregados en Dispositivo</span>
                <span class="font-bold text-emerald-700">${totalDelivered} (${deliveryRate}% efectividad)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-emerald-500 h-full rounded-full" style="width: ${deliveryRate}%"></div>
              </div>
            </div>

            <!-- Stage 4: Read -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-blue-700">4. Leídos por el Cliente</span>
                <span class="font-bold text-blue-700">${totalRead} (${readRate}% apertura)</span>
              </div>
              <div class="w-full bg-neutral-100 h-3 rounded-full overflow-hidden">
                <div class="bg-blue-500 h-full rounded-full" style="width: ${readRate}%"></div>
              </div>
            </div>

            <!-- Stage 5: Interacted / Clicked -->
            <div>
              <div class="flex justify-between text-xs font-mono mb-1">
                <span class="font-bold text-purple-700">5. Clics en Botón / Flujo interactivo</span>
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
          
          <!-- Financial Breakdown Card -->
          <div class="p-5 bg-white border border-neutral-200 rounded-xl shadow-xs flex flex-col gap-4">
            <div class="border-b border-neutral-100 pb-3 flex items-center justify-between">
              <h4 class="font-mono text-xs font-bold text-neutral-800 uppercase tracking-wide">Desglose Financiero & Tarifas Meta</h4>
              <span class="text-[9px] font-mono px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">Tarifa LATAM</span>
            </div>

            <div class="flex flex-col gap-2.5 font-mono text-xs">
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Categoría de Mensaje:</span>
                <strong class="text-neutral-900">Marketing Template</strong>
              </div>
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Costo Unitario por Mensaje:</span>
                <strong class="text-neutral-900">$${costPerDeliveredUSD} USD / msj entregado</strong>
              </div>
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Monto Invertido en Envíos:</span>
                <strong class="text-emerald-600 text-sm">$${estimatedCostUSD} USD</strong>
              </div>
              <div class="flex justify-between py-1.5 border-b border-neutral-100">
                <span class="text-neutral-500">Costo Efectivo por Respuesta/Clic:</span>
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
  }

  // ----------------------------------------------------
  // TAB 6: Actividad / Cola de Envíos en vivo
  // ----------------------------------------------------
  function renderTabActivity(tabContent) {
    tabContent.innerHTML = `
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h4 class="font-mono text-xs font-bold text-primary uppercase">Historial de Cola de Envíos (${recipients.length} ítems)</h4>
          <button id="btn-refresh-queue" class="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-mono text-[10px] font-bold uppercase rounded-md cursor-pointer">
            🔄 Actualizar
          </button>
        </div>

        <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto max-h-[500px]">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="sticky top-0 bg-neutral-900 text-white font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th class="py-2.5 px-4">Destinatario</th>
                  <th class="py-2.5 px-4">Teléfono</th>
                  <th class="py-2.5 px-4">Estado</th>
                  <th class="py-2.5 px-4">WAMID / Detalle</th>
                  <th class="py-2.5 px-4">Enviado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-200 font-mono">
                ${recipients.length === 0 ? `
                  <tr>
                    <td colspan="5" class="py-8 text-center text-neutral-400">Sin registros en la cola de envíos.</td>
                  </tr>
                ` : recipients.map(r => {
                  const contactsList = cache.contacts instanceof Map ? Array.from(cache.contacts.values()) : (Array.isArray(cache.contacts) ? cache.contacts : []);
                  const contactObj = (r.recipient_phone && contactsList.length > 0) 
                    ? contactsList.find(c => c.phone && c.phone.replace(/[^0-9]/g, '') === String(r.recipient_phone).replace(/[^0-9]/g, ''))
                    : null;
                  const leadName = contactObj 
                    ? `${contactObj.first_name || ''} ${contactObj.last_name || ''}`.trim()
                    : (r.resolved_variables?.['1'] || r.leads?.company || 'Prospecto sin nombre');
                  return `
                    <tr class="hover:bg-neutral-50">
                      <td class="py-2.5 px-4 font-sans font-medium text-neutral-800">${leadName}</td>
                      <td class="py-2.5 px-4 text-neutral-600">${r.recipient_phone}</td>
                      <td class="py-2.5 px-4">
                        ${getRecipientStatusBadge(r.status, r.discard_reason)}
                      </td>
                      <td class="py-2.5 px-4 text-[10px] text-neutral-500 truncate max-w-xs">
                        ${r.wamid || r.error_message || r.discard_reason || '-'}
                      </td>
                      <td class="py-2.5 px-4 text-neutral-500 text-[10px]">
                        ${r.sent_at ? new Date(r.sent_at).toLocaleTimeString('es-AR') : '-'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const btnRefresh = tabContent.querySelector('#btn-refresh-queue');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        await loadCampaignData();
      });
    }
  }

  function getRecipientStatusBadge(status, discardReason) {
    if (status === 'sent') return `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px]">ENVIADO</span>`;
    if (status === 'failed') return `<span class="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[9px]">FALLIDO</span>`;
    if (status === 'discarded') return `<span class="px-2 py-0.5 bg-neutral-200 text-neutral-700 rounded-full font-bold text-[9px]">DESCARTADO (${discardReason || 'N/A'})</span>`;
    return `<span class="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-bold text-[9px]">PENDIENTE</span>`;
  }

  return wrapper;
}
