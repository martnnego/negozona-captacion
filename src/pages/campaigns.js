import { supabase } from '../lib/supabase';
import { openCampaignWizardModal } from '../components/campaign-wizard-modal';
import { renderCampaignDetail } from './campaign-detail';
import { toast } from '../components/toast';

export function renderCampaigns() {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-6 animate-fade-in font-sans pb-12';

  wrapper.innerHTML = `
    <!-- Header Area -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xl">📣</span>
          <h2 class="text-xl font-bold text-primary font-display">Campañas Multicanal</h2>
        </div>
        <p class="text-xs text-neutral-500 mt-1">Crea, programa y monitorea campañas de difusión por WhatsApp y Email en tiempo real.</p>
      </div>

      <button id="btn-new-campaign" class="px-5 py-2.5 bg-primary hover:bg-neutral-900 text-white font-mono text-xs font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto">
        <span>+ Nueva Campaña</span>
      </button>
    </div>

    <!-- Filters & Stats Bar -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
      <!-- Search Input -->
      <div class="relative w-full sm:w-72">
        <span class="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none z-10">🔍</span>
        <input type="text" id="campaign-search" class="cohere-input !pl-9 text-xs w-full" placeholder="Buscar por nombre o plantilla..." />
      </div>

      <!-- Status Filter Tabs -->
      <div class="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-[10px] font-mono font-bold uppercase">
        <button class="status-filter-tab px-3 py-1.5 rounded-md bg-neutral-900 text-white shadow-xs" data-status="all">Todas</button>
        <button class="status-filter-tab px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="en_ejecucion">⚡ En Ejecución</button>
        <button class="status-filter-tab px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="programada">📅 Programadas</button>
        <button class="status-filter-tab px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="finalizada">✅ Finalizadas</button>
        <button class="status-filter-tab px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200" data-status="pausada_limite">⏸️ Pausadas</button>
      </div>
    </div>

    <!-- Campaigns Data Table -->
    <div class="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-neutral-900 text-white font-mono text-[10px] uppercase tracking-wider border-b border-neutral-800">
              <th class="py-3 px-4">Campaña</th>
              <th class="py-3 px-4">Canal</th>
              <th class="py-3 px-4">Estado</th>
              <th class="py-3 px-4">Fecha / Programación</th>
              <th class="py-3 px-4">Destinatarios & Avance</th>
              <th class="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="campaigns-table-body" class="divide-y divide-neutral-200 text-xs font-medium">
            <tr>
              <td colspan="6" class="py-12 text-center text-neutral-400">
                <span class="animate-pulse">🔄 Cargando campañas...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let allCampaigns = [];
  let currentFilter = 'all';
  let searchQuery = '';

  // Attach New Campaign Wizard
  wrapper.querySelector('#btn-new-campaign').addEventListener('click', () => {
    openCampaignWizardModal(() => loadCampaigns());
  });

  // Attach search listener
  wrapper.querySelector('#campaign-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderFilteredCampaigns();
  });

  // Attach status filter tab listeners
  wrapper.querySelectorAll('.status-filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      wrapper.querySelectorAll('.status-filter-tab').forEach(b => {
        b.className = 'status-filter-tab px-3 py-1.5 rounded-md text-neutral-600 hover:bg-neutral-200';
      });
      btn.className = 'status-filter-tab px-3 py-1.5 rounded-md bg-neutral-900 text-white shadow-xs';
      currentFilter = btn.dataset.status;
      renderFilteredCampaigns();
    });
  });

  loadCampaigns();

  async function loadCampaigns() {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allCampaigns = data || [];
      renderFilteredCampaigns();
    } catch (err) {
      console.error('Error loading campaigns:', err);
      toast.show('Error al cargar campañas: ' + err.message, 'error');
    }
  }

  function renderFilteredCampaigns() {
    const tbody = wrapper.querySelector('#campaigns-table-body');
    if (!tbody) return;

    let filtered = allCampaigns.filter(c => {
      const matchSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery) || (c.template_name && c.template_name.toLowerCase().includes(searchQuery));
      const matchStatus = currentFilter === 'all' || c.status === currentFilter;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-neutral-400">
            <span class="block text-2xl mb-1">📭</span>
            <span>No se encontraron campañas registradas.</span>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const statusBadge = getStatusBadgeHtml(c.status);
      const progressPercent = c.total_to_send > 0 ? Math.round((c.total_sent / c.total_to_send) * 100) : 0;
      const formattedDate = c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : new Date(c.created_at).toLocaleDateString('es-AR');

      return `
        <tr class="hover:bg-neutral-50 transition-colors">
          <td class="py-3 px-4">
            <div class="flex flex-col">
              <strong class="text-neutral-900 font-bold">${c.name}</strong>
              <span class="text-[10px] text-neutral-500 truncate max-w-xs">${c.description || 'Sin descripción'}</span>
            </div>
          </td>

          <td class="py-3 px-4">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${c.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}">
              ${c.channel === 'whatsapp' ? '🟢 WhatsApp' : '✉️ Email'}
            </span>
          </td>

          <td class="py-3 px-4">
            ${statusBadge}
          </td>

          <td class="py-3 px-4 font-mono text-[11px] text-neutral-600">
            ${formattedDate}
          </td>

          <td class="py-3 px-4">
            <div class="flex flex-col gap-1 max-w-xs">
              <div class="flex justify-between text-[10px] font-mono text-neutral-600 font-bold">
                <span>${c.total_sent || 0} / ${c.total_to_send || 0} enviados</span>
                <span>${progressPercent}%</span>
              </div>
              <div class="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
              </div>
            </div>
          </td>

          <td class="py-3 px-4 text-right">
            <button data-campaign-id="${c.id}" class="btn-view-detail px-3 py-1.5 bg-neutral-100 hover:bg-primary hover:text-white text-neutral-700 text-[10px] font-mono font-bold uppercase rounded-md transition-colors cursor-pointer">
              Ver Detalle →
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click handlers to View Detail buttons
    tbody.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', async () => {
        const campaignId = btn.dataset.campaignId;
        const detailView = await renderCampaignDetail(campaignId);
        wrapper.replaceWith(detailView);
      });
    });
  }

  function getStatusBadgeHtml(status) {
    switch (status) {
      case 'en_ejecucion':
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> En Ejecución</span>`;
      case 'programada':
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-100 text-blue-800">📅 Programada</span>`;
      case 'finalizada':
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-100 text-purple-800">✅ Finalizada</span>`;
      case 'pausada_limite':
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 text-amber-800">⏸️ Pausada (Límite)</span>`;
      case 'cancelada':
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-800">🚫 Cancelada</span>`;
      default:
        return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-neutral-200 text-neutral-700">📝 Borrador</span>`;
    }
  }

  return wrapper;
}
