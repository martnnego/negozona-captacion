import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { Chart, registerables } from 'chart.js';
import { toast } from '../components/toast';

Chart.register(...registerables);

export async function renderDashboard(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-8 animate-fade-in pb-12';

  // State
  let selectedCountry = localStorage.getItem('dash_filter_country') || 'All';
  let leadsData = [];
  let recentActivities = [];
  
  let stageChart = null;
  let countryChart = null;
  let trendChart = null;

  // Header & Country Filter
  container.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6">
      <div>
        <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Resumen de Actividad</h2>
        <p class="text-xs text-muted-slate mt-1 font-sans">Panel de control y métricas clave del pipeline</p>
      </div>

      <!-- Country Quick Filter -->
      <div class="flex items-center gap-1.5 overflow-x-auto py-1">
        ${['All', 'Argentina', 'España', 'México', 'Uruguay', 'Chile']
          .map(country => `
            <button 
              data-country="${country}" 
              class="country-btn px-3 py-1.5 border rounded-full font-mono text-[10px] font-bold tracking-wider uppercase transition-all duration-150 ${
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

    <!-- Cards container -->
    <div id="metrics-cards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Loading Skeleton Cards -->
      ${Array(4).fill(0).map(() => `
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
        <div class="flex-1 min-h-0 relative flex items-center justify-center">
          <canvas id="stage-chart"></canvas>
        </div>
      </div>

      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col h-[360px] lg:col-span-2">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase mb-4">Leads por País</span>
        <div class="flex-1 min-h-0 relative">
          <canvas id="country-chart"></canvas>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Trend Line Chart & Activity Feed -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Trend -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col h-[400px] lg:col-span-2">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase mb-4">Tendencia de Registro (Mensual)</span>
        <div class="flex-1 min-h-0 relative">
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

  // Fetch leads and activities
  async function loadData() {
    try {
      // 1. Fetch leads (retrieve minimal columns for charts optimization)
      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, created_at, country, pipeline_stage_id, assigned_to');

      if (leadsErr) throw leadsErr;
      leadsData = leads || [];

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
    // Filter by Country if not 'All'
    const filteredLeads = selectedCountry === 'All' 
      ? leadsData 
      : leadsData.filter(l => l.country === selectedCountry);

    // Calculate metrics
    const totalLeads = filteredLeads.length;
    
    // New leads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newLeads = filteredLeads.filter(l => new Date(l.created_at) >= sevenDaysAgo).length;

    // Unassigned
    const unassignedLeads = filteredLeads.filter(l => !l.assigned_to).length;

    // Conversion rate (Ganado stage / Total)
    const stages = cache.getStages();
    const ganadoStage = stages.find(s => s.name.toLowerCase() === 'ganado');
    const ganadoCount = ganadoStage 
      ? filteredLeads.filter(l => l.pipeline_stage_id === ganadoStage.id).length 
      : 0;
    const conversionRate = totalLeads > 0 
      ? ((ganadoCount / totalLeads) * 100).toFixed(1) 
      : '0.0';

    // Render Cards
    const cardsContainer = container.querySelector('#metrics-cards');
    cardsContainer.innerHTML = `
      <!-- Total Leads -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Total Leads</span>
        <span class="text-3xl font-light font-display text-primary">${totalLeads}</span>
      </div>

      <!-- Leads Nuevos -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Nuevos (7d)</span>
        <span class="text-3xl font-light font-display text-primary">+${newLeads}</span>
      </div>

      <!-- Sin Asignar -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase">Sin Asignar</span>
        <span class="text-3xl font-light font-display ${unassignedLeads > 0 ? 'text-coral' : 'text-primary'}">${unassignedLeads}</span>
      </div>

      <!-- Conversion Rate -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between h-28">
        <span class="font-mono text-[10px] tracking-wider text-muted font-bold uppercase font-sans">Tasa Conversión</span>
        <span class="text-3xl font-light font-display text-primary">${conversionRate}%</span>
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
    const ctx = container.querySelector('#stage-chart').getContext('2d');
    
    if (stageChart) stageChart.destroy();

    const dataMap = {};
    stages.forEach(s => { dataMap[s.id] = { name: s.name, color: s.color, count: 0 }; });

    leads.forEach(l => {
      if (dataMap[l.pipeline_stage_id]) {
        dataMap[l.pipeline_stage_id].count++;
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
    const ctx = container.querySelector('#country-chart').getContext('2d');
    
    if (countryChart) countryChart.destroy();

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
          backgroundColor: '#17171c', // Cohere primary color
          hoverBackgroundColor: '#003c33', // Deep green hover
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
    const ctx = container.querySelector('#trend-chart').getContext('2d');
    
    if (trendChart) trendChart.destroy();

    // Group by Month (last 6 months)
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
          borderColor: '#ff7759', // Coral brand color
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

  // Load everything
  loadData();

  return container;
}
