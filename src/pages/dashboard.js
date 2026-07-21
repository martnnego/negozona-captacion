import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { Chart, registerables } from 'chart.js';
import { toast } from '../components/toast';

Chart.register(...registerables);

export async function renderDashboard(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-8 animate-fade-in pb-12';

  // State
  let activePipelineMode = localStorage.getItem('crm_active_pipeline_mode') || 'comercial';
  let selectedEventId = localStorage.getItem('crm_active_franquiday_event_id') || cache.getActiveEvent()?.id || '';
  let selectedCountry = localStorage.getItem('dash_filter_country') || 'All';
  let dashPeriodDays = parseInt(localStorage.getItem('dash_period_days') || '30');
  let leadsData = [];
  let recentActivities = [];
  
  let stageChart = null;
  let countryChart = null;
  let trendChart = null;

  // If activeEventId is not set, select the active one or first available
  const events = cache.getEvents() || [];
  const activeEvent = cache.getActiveEvent();
  if (!selectedEventId && activeEvent) {
    selectedEventId = activeEvent.id;
  } else if (!selectedEventId && events.length > 0) {
    selectedEventId = events[0].id;
  }

  // Header & Switcher
  container.innerHTML = `
    <div class="flex flex-col gap-6 border-b border-[#d9d9dd] pb-6">
      <!-- Row 1: Title and Primary Switchers -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Resumen de Actividad</h2>
          <p class="text-xs text-muted-slate mt-1 font-sans">Panel de control y métricas clave del pipeline</p>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 w-full sm:w-auto select-none">
          <!-- Pipeline Mode Switcher -->
          <div class="flex items-center justify-center bg-neutral-100 rounded-full p-0.5 border border-neutral-200 w-full sm:w-auto text-[10px] font-mono font-bold tracking-wider">
            <button id="mode-comercial-btn" class="flex-1 sm:flex-initial px-4 py-1.5 rounded-full transition-all duration-150 uppercase flex items-center justify-center gap-1 cursor-pointer ${
              activePipelineMode === 'comercial' ? 'bg-white text-primary shadow-xs' : 'text-[#616161] hover:text-primary'
            }">
              💼 Negozona
            </button>
            <button id="mode-franquiday-btn" class="flex-1 sm:flex-initial px-4 py-1.5 rounded-full transition-all duration-150 uppercase flex items-center justify-center gap-1 cursor-pointer ${
              activePipelineMode === 'franquiday' ? 'bg-white text-primary shadow-xs' : 'text-[#616161] hover:text-primary'
            }">
              🎪 Franquiday
            </button>
          </div>

          <!-- Franquiday Events Selector -->
          <select id="dashboard-event-select" class="bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider w-full sm:w-auto ${
            activePipelineMode === 'franquiday' ? '' : 'hidden'
          }">
            ${events.map(e => `
              <option value="${e.id}" ${selectedEventId === e.id ? 'selected' : ''}>
                ${e.nombre} (${e.pais.toUpperCase()})
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Row 2: Secondary Filter Bar (Period & Country) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-50/50 p-4 rounded-sm border border-neutral-100">
        <!-- Period Pills -->
        <div class="flex items-center gap-1 shrink-0">
          ${[{label:'30d', val:30}, {label:'90d', val:90}, {label:'180d', val:180}, {label:'Todo', val:0}].map(p => `
            <button data-period="${p.val}" class="dash-period-btn px-3 py-1.5 border rounded-full font-mono text-[9px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
              dashPeriodDays === p.val
                ? 'bg-primary border-primary text-white'
                : 'bg-white border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary'
            }">${p.label}</button>
          `).join('')}
        </div>

        <!-- Country Quick Filter -->
        <div class="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar shrink-0">
          ${['All', 'Argentina', 'España', 'México', 'Uruguay', 'Chile']
            .map(country => `
              <button 
                data-country="${country}" 
                class="country-btn px-3 py-1.5 border rounded-full font-mono text-[10px] font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer ${
                  selectedCountry === country 
                    ? 'bg-primary border-primary text-white' 
                    : 'bg-white border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary'
                }"
              >
                ${country === 'All' ? 'TODOS' : country.toUpperCase()}
              </button>
            `).join('')}
        </div>
      </div>
    </div>

    <!-- Cards container -->
    <div id="metrics-cards" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      <!-- Loading Skeleton Cards -->
      ${Array(5).fill(0).map(() => `
        <div class="bg-neutral-50 border border-neutral-100 rounded-sm p-6 h-28 animate-pulse flex flex-col justify-between">
          <div class="h-3 w-1/3 bg-neutral-200 rounded-xs"></div>
          <div class="h-8 w-1/2 bg-neutral-200 rounded-xs"></div>
        </div>
      `).join('')}
    </div>

    <!-- Charts Layout Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col h-[360px]">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase mb-4">Leads por Etapa</span>
        <div class="flex-1 min-h-0 relative flex items-center justify-center" id="stage-chart-wrapper">
          <canvas id="stage-chart"></canvas>
        </div>
      </div>

      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col h-[360px] lg:col-span-2">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase mb-4">Leads por País</span>
        <div class="flex-1 min-h-0 relative" id="country-chart-wrapper">
          <canvas id="country-chart"></canvas>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Trend Line Chart & Activity Feed -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Trend -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col h-[400px] lg:col-span-2">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase mb-4">Tendencia de Registro (Mensual)</span>
        <div class="flex-1 min-h-0 relative" id="trend-chart-wrapper">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col h-[400px]">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase mb-4">Actividad Reciente</span>
        <div id="activity-feed-container" class="flex-1 overflow-y-auto divide-y divide-neutral-100 pr-1">
          <!-- Feed items -->
        </div>
      </div>
    </div>
  `;

  // Attach Pipeline switcher handlers
  const comercialBtn = container.querySelector('#mode-comercial-btn');
  const franquidayBtn = container.querySelector('#mode-franquiday-btn');
  const eventSelect = container.querySelector('#dashboard-event-select');

  comercialBtn.addEventListener('click', () => {
    activePipelineMode = 'comercial';
    localStorage.setItem('crm_active_pipeline_mode', 'comercial');
    comercialBtn.className = 'px-4 py-1.5 rounded-full transition-all duration-150 uppercase flex items-center gap-1 cursor-pointer bg-white text-primary shadow-xs';
    franquidayBtn.className = 'px-4 py-1.5 rounded-full transition-all duration-150 uppercase flex items-center gap-1 cursor-pointer text-[#616161] hover:text-primary';
    eventSelect.classList.add('hidden');
    calculateAndRender();
  });

  franquidayBtn.addEventListener('click', () => {
    activePipelineMode = 'franquiday';
    localStorage.setItem('crm_active_pipeline_mode', 'franquiday');
    franquidayBtn.className = 'px-4 py-1.5 rounded-full transition-all duration-150 uppercase flex items-center gap-1 cursor-pointer bg-white text-primary shadow-xs';
    comercialBtn.className = 'px-4 py-1.5 rounded-full transition-all duration-150 uppercase flex items-center gap-1 cursor-pointer text-[#616161] hover:text-primary';
    eventSelect.classList.remove('hidden');
    calculateAndRender();
  });

  eventSelect.addEventListener('change', (e) => {
    selectedEventId = e.target.value;
    localStorage.setItem('crm_active_franquiday_event_id', selectedEventId);
    calculateAndRender();
  });

  // Attach filter handlers
  container.querySelectorAll('.country-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedCountry = btn.dataset.country;
      localStorage.setItem('dash_filter_country', selectedCountry);
      
      // Update buttons style
      container.querySelectorAll('.country-btn').forEach(b => {
        b.classList.remove('bg-primary', 'border-primary', 'text-white');
        b.classList.add('bg-white', 'border-[#d9d9dd]', 'text-[#616161]');
      });
      btn.classList.add('bg-primary', 'border-primary', 'text-white');
      btn.classList.remove('bg-white', 'border-[#d9d9dd]', 'text-[#616161]');

      calculateAndRender();
    });
  });

  // Period pills
  container.querySelectorAll('.dash-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dashPeriodDays = parseInt(btn.dataset.period);
      localStorage.setItem('dash_period_days', String(dashPeriodDays));
      container.querySelectorAll('.dash-period-btn').forEach(b => {
        b.classList.remove('bg-primary', 'border-primary', 'text-white');
        b.classList.add('bg-white', 'border-[#d9d9dd]', 'text-[#616161]');
      });
      btn.classList.add('bg-primary', 'border-primary', 'text-white');
      btn.classList.remove('bg-white', 'border-[#d9d9dd]', 'text-[#616161]');
      calculateAndRender();
    });
  });

  // Fetch leads and activities
  async function loadData() {
    try {
      leadsData = cache.getLeads() || [];

      // 2. Fetch recent activities
      const { data: activities, error: actErr } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (actErr) throw actErr;
      recentActivities = activities || [];

      calculateAndRender();
    } catch (err) {
      toast.show('Error cargando métricas: ' + err.message, 'error');
    }
  }

  function calculateAndRender() {
    const stages = cache.getStages();
    let baseLeads = [];

    if (activePipelineMode === 'franquiday') {
      // Filter leads to only include those participating in the selected event
      const participations = cache.getParticipations().filter(p => p.evento_id === selectedEventId);
      const participationsMap = new Map(participations.map(p => [p.lead_id, p]));
      
      baseLeads = leadsData
        .filter(l => participationsMap.has(l.id))
        .map(l => {
          const part = participationsMap.get(l.id);
          return {
            ...l,
            active_stage_id: part ? part.pipeline_stage_id : (stages[0]?.id || '')
          };
        });
    } else {
      // Commercial mode uses pipeline_stage_id
      baseLeads = leadsData.map(l => ({
        ...l,
        active_stage_id: l.pipeline_stage_id
      }));
    }

    // Apply period filter first (from cache in memory)
    let periodLeads = baseLeads;
    if (dashPeriodDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dashPeriodDays);
      periodLeads = baseLeads.filter(l => new Date(l.created_at) >= cutoff);
    }

    // Filter by Country if not 'All'
    const filteredLeads = selectedCountry === 'All' 
      ? periodLeads 
      : periodLeads.filter(l => l.country === selectedCountry);

    // Calculate metrics
    const totalLeads = filteredLeads.length;
    
    // New leads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newLeads = filteredLeads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length;

    // Unassigned
    const unassignedLeads = filteredLeads.filter(l => !l.assigned_to).length;

    // Conversion rate (Ganado stage / Total)
    const ganadoStage = stages.find(s => s.name.toLowerCase() === 'ganado');
    const ganadoCount = ganadoStage 
      ? filteredLeads.filter(l => l.active_stage_id === ganadoStage.id).length 
      : 0;
    const conversionRate = totalLeads > 0 
      ? ((ganadoCount / totalLeads) * 100).toFixed(1) 
      : '0.0';

    // Calculate Inactivity Average
    let totalInactivityDays = 0;
    filteredLeads.forEach(l => {
      const dateBase = l.fecha_ultimo_contacto ? new Date(l.fecha_ultimo_contacto) : new Date(l.created_at);
      const now = new Date();
      dateBase.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      const diffTime = Math.max(0, now - dateBase);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      totalInactivityDays += diffDays;
    });

    const avgInactivity = totalLeads > 0 
      ? (totalInactivityDays / totalLeads).toFixed(1) 
      : '0.0';

    let inactivityColorClass = 'text-rose-600'; // Critical (>=14)
    if (parseFloat(avgInactivity) < 7) {
      inactivityColorClass = 'text-emerald-600';
    } else if (parseFloat(avgInactivity) < 14) {
      inactivityColorClass = 'text-amber-500';
    }

    // Render Cards
    const cardsContainer = container.querySelector('#metrics-cards');
    cardsContainer.innerHTML = `
      <!-- Total Leads -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28 select-none">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Total Leads</span>
        <span class="text-3xl font-light font-display text-primary">${totalLeads}</span>
      </div>

      <!-- Leads Nuevos -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28 select-none">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Nuevos (7d)</span>
        <span class="text-3xl font-light font-display text-primary">+${newLeads}</span>
      </div>

      <!-- Sin Asignar -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28 select-none">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Sin Asignar</span>
        <span class="text-3xl font-light font-display ${unassignedLeads > 0 ? 'text-coral' : 'text-primary'}">${unassignedLeads}</span>
      </div>

      <!-- Conversion Rate -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28 select-none">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase font-sans">Tasa Conversión</span>
        <span class="text-3xl font-light font-display text-primary">${conversionRate}%</span>
      </div>

      <!-- Inactividad Promedio -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28 select-none" title="Promedio de días transcurridos desde el último contacto registrado">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Inactividad Promedio</span>
        <span class="text-3xl font-light font-display ${inactivityColorClass}">${avgInactivity} días</span>
      </div>
    `;

    // Render Charts
    renderStageChart(filteredLeads, stages);
    renderCountryChart(filteredLeads);
    renderTrendChart(filteredLeads);

    // Render Activity Feed
    renderActivityFeed();
  }

  function renderStageChart(leads, stages) {
    const wrapper = container.querySelector('#stage-chart-wrapper');
    if (!wrapper) return;

    if (stageChart) {
      stageChart.destroy();
      stageChart = null;
    }

    if (leads.length === 0) {
      wrapper.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-neutral-400 font-sans text-xs select-none">
          <span>Sin datos para mostrar</span>
        </div>
      `;
      return;
    }

    // Restore canvas
    wrapper.innerHTML = '<canvas id="stage-chart"></canvas>';
    const canvas = wrapper.querySelector('#stage-chart');
    const ctx = canvas.getContext('2d');

    // Official Chart.js destruction hook
    Chart.getChart(canvas)?.destroy();

    const dataMap = {};
    stages.forEach(s => { dataMap[s.id] = { name: s.name, color: s.color, count: 0 }; });

    leads.forEach(l => {
      if (dataMap[l.active_stage_id]) {
        dataMap[l.active_stage_id].count++;
      }
    });

    const dataset = Object.values(dataMap);

    stageChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: dataset.map(d => d.name),
        datasets: [{
          data: dataset.map(d => d.count),
          backgroundColor: dataset.map(d => d.color),
          borderWidth: 1.5,
          borderColor: '#ffffff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              padding: 12,
              font: {
                family: 'Inter',
                size: 9
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  function renderCountryChart(leads) {
    const wrapper = container.querySelector('#country-chart-wrapper');
    if (!wrapper) return;

    if (countryChart) {
      countryChart.destroy();
      countryChart = null;
    }

    if (leads.length === 0) {
      wrapper.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-neutral-400 font-sans text-xs select-none">
          <span>Sin datos para mostrar</span>
        </div>
      `;
      return;
    }

    wrapper.innerHTML = '<canvas id="country-chart"></canvas>';
    const canvas = wrapper.querySelector('#country-chart');
    const ctx = canvas.getContext('2d');

    Chart.getChart(canvas)?.destroy();

    const countryMap = {
      'Argentina': 0,
      'España': 0,
      'México': 0,
      'Uruguay': 0,
      'Chile': 0,
      'Otros': 0
    };

    leads.forEach(l => {
      const country = l.country || 'Otros';
      if (countryMap[country] !== undefined) {
        countryMap[country]++;
      } else {
        countryMap['Otros']++;
      }
    });

    const countries = Object.keys(countryMap);
    const counts = Object.values(countryMap);

    countryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: countries.map(c => c.toUpperCase()),
        datasets: [{
          label: 'Leads',
          data: counts,
          backgroundColor: '#17171c',
          hoverBackgroundColor: '#003c33',
          borderRadius: 4,
          maxBarThickness: 32,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: {
              color: '#f3f4f6',
              drawTicks: false
            },
            ticks: {
              font: { family: 'JetBrains Mono', size: 9 },
              color: '#93939f',
              stepSize: 5
            },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'JetBrains Mono', size: 9 },
              color: '#93939f'
            },
            border: { display: false }
          }
        }
      }
    });
  }

  function renderTrendChart(leads) {
    const wrapper = container.querySelector('#trend-chart-wrapper');
    if (!wrapper) return;

    if (trendChart) {
      trendChart.destroy();
      trendChart = null;
    }

    if (leads.length === 0) {
      wrapper.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-neutral-400 font-sans text-xs select-none">
          <span>Sin datos para mostrar</span>
        </div>
      `;
      return;
    }

    wrapper.innerHTML = '<canvas id="trend-chart"></canvas>';
    const canvas = wrapper.querySelector('#trend-chart');
    const ctx = canvas.getContext('2d');

    Chart.getChart(canvas)?.destroy();

    const monthCounts = {};
    const monthLabels = [];
    const date = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const label = d.toLocaleString('es-ES', { month: 'short', year: 'numeric' });
      monthLabels.push(label);
      monthCounts[label] = 0;
    }

    leads.forEach(l => {
      const createdDate = new Date(l.created_at);
      const label = createdDate.toLocaleString('es-ES', { month: 'short', year: 'numeric' });
      if (monthCounts[label] !== undefined) {
        monthCounts[label]++;
      }
    });

    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Leads cargados',
          data: Object.values(monthCounts),
          borderColor: '#ff7759',
          backgroundColor: 'rgba(255, 119, 89, 0.05)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointBackgroundColor: '#ff7759',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            grid: {
              color: '#f3f4f6',
              drawTicks: false
            },
            ticks: {
              font: { family: 'JetBrains Mono', size: 9 },
              color: '#93939f'
            },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'JetBrains Mono', size: 9 },
              color: '#93939f'
            },
            border: { display: false }
          }
        }
      }
    });
  }

  function renderActivityFeed() {
    const feed = container.querySelector('#activity-feed-container');
    
    if (recentActivities.length === 0) {
      feed.innerHTML = `<div class="p-8 text-center text-xs text-neutral-400 font-sans">No hay actividad registrada</div>`;
      return;
    }

    feed.innerHTML = recentActivities
      .map(act => {
        const time = new Date(act.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                     new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let typeBadge = '';
        if (act.type === 'lead_assigned') {
          typeBadge = '<span class="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">ASIGNACIÓN</span>';
        } else if (act.type === 'stage_changed') {
          typeBadge = '<span class="text-[9px] font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-sm">ETAPA</span>';
        } else {
          typeBadge = '<span class="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm">IMPORTACIÓN</span>';
        }

        return `
          <div class="py-3 flex flex-col gap-1 font-sans text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-primary truncate">${act.title}</span>
              <span class="text-[10px] text-muted shrink-0">${time}</span>
            </div>
            <p class="text-[11px] text-[#616161]">${act.message || ''}</p>
            <div class="mt-1 flex items-center justify-between">
              ${typeBadge}
              ${act.lead_id ? `<a href="#leads-table" class="text-[10px] text-action-blue hover:underline font-semibold" onclick="localStorage.setItem('lead_detail_open', '${act.lead_id}')">Ver Lead ➔</a>` : ''}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Subscribe to changes in cache
  const unsubscribeCache = cache.subscribe(() => {
    leadsData = cache.getLeads() || [];
    calculateAndRender();
  });

  container.cleanup = () => {
    unsubscribeCache();
    if (stageChart) { stageChart.destroy(); stageChart = null; }
    if (countryChart) { countryChart.destroy(); countryChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
  };

  // Load everything
  loadData();

  return container;
}
