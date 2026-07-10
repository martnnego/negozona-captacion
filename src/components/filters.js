import { cache } from '../lib/cache';

export function renderFilters({ activeFilters, onFilterChange }) {
  const container = document.createElement('div');
  container.className = 'w-full bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans select-none';

  const stages = cache.getStages();
  const profiles = cache.getProfiles();

  container.innerHTML = `
    <!-- Search and Dropdowns -->
    <div class="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
      <!-- Search Input -->
      <div class="relative min-w-[200px] flex-1 max-w-sm">
        <input 
          type="text" 
          id="search-input" 
          value="${activeFilters.search || ''}"
          placeholder="BÚSQUEDA POR NOMBRE, EMAIL, EMPRESA..." 
          class="w-full bg-white border border-[#d9d9dd] rounded-sm py-2 pl-3 pr-8 font-sans text-xs text-primary placeholder:text-neutral-400 focus:outline-none focus:border-form-focus transition-colors uppercase tracking-wider font-semibold"
        />
        <span class="absolute right-3 top-2.5 text-neutral-400 text-xs">🔍</span>
      </div>

      <!-- Stage Filter -->
      <div class="flex flex-col gap-0.5">
        <select id="filter-stage" class="bg-white border border-[#d9d9dd] rounded-sm py-2 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          <option value="">FILTRAR ETAPA</option>
          ${stages.map(s => `
            <option value="${s.id}" ${activeFilters.stageId === s.id ? 'selected' : ''}>${s.name.toUpperCase()}</option>
          `).join('')}
        </select>
      </div>

      <!-- Comercial Filter -->
      <div class="flex flex-col gap-0.5">
        <select id="filter-comercial" class="bg-white border border-[#d9d9dd] rounded-sm py-2 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          <option value="">FILTRAR COMERCIAL</option>
          ${profiles.map(p => `
            <option value="${p.id}" ${activeFilters.assignedTo === p.id ? 'selected' : ''}>${p.full_name.toUpperCase()}</option>
          `).join('')}
        </select>
      </div>

      <!-- Country Filter -->
      <div class="flex flex-col gap-0.5">
        <select id="filter-country" class="bg-white border border-[#d9d9dd] rounded-sm py-2 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          <option value="">FILTRAR PAÍS</option>
          ${['Argentina', 'España', 'México', 'Uruguay', 'Chile']
            .map(c => `
              <option value="${c}" ${activeFilters.country === c ? 'selected' : ''}>${c.toUpperCase()}</option>
            `).join('')}
        </select>
      </div>

      <!-- Valoracion Filter -->
      <div class="flex flex-col gap-0.5">
        <select id="filter-valoracion" class="bg-white border border-[#d9d9dd] rounded-sm py-2 px-3 font-mono text-[9px] font-bold text-[#616161] hover:text-primary transition-colors focus:outline-none uppercase tracking-wider">
          <option value="">VALORACIÓN</option>
          ${['★', '★★', '★★★', '★★★★', '★★★★★'].map((stars, idx) => `
            <option value="${stars}" ${activeFilters.valoracion === stars ? 'selected' : ''}>${stars}</option>
          `).join('')}
        </select>
      </div>
    </div>

    <!-- Clear Filters Button -->
    <div id="clear-filters-container" class="flex justify-end shrink-0 ${
      Object.values(activeFilters).some(v => v !== '') ? '' : 'hidden'
    }">
      <button id="clear-filters-btn" class="px-4 py-2 border border-neutral-200 text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-neutral-50 transition-all tracking-wider focus:outline-none">
        Limpiar Filtros ✕
      </button>
    </div>
  `;

  const searchInput = container.querySelector('#search-input');
  const stageSelect = container.querySelector('#filter-stage');
  const comercialSelect = container.querySelector('#filter-comercial');
  const countrySelect = container.querySelector('#filter-country');
  const valoracionSelect = container.querySelector('#filter-valoracion');
  const clearBtn = container.querySelector('#clear-filters-btn');
  const clearContainer = container.querySelector('#clear-filters-container');

  // Debounce helper for Search input
  let debounceTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      activeFilters.search = searchInput.value.trim();
      updateClearButtonVisibility();
      onFilterChange(activeFilters);
    }, 300);
  });

  const handleSelectChange = (key, selectEl) => {
    selectEl.addEventListener('change', () => {
      activeFilters[key] = selectEl.value;
      updateClearButtonVisibility();
      onFilterChange(activeFilters);
    });
  };

  handleSelectChange('stageId', stageSelect);
  handleSelectChange('assignedTo', comercialSelect);
  handleSelectChange('country', countrySelect);
  handleSelectChange('valoracion', valoracionSelect);

  function updateClearButtonVisibility() {
    const hasActiveFilters = Object.values(activeFilters).some(v => v !== '');
    if (hasActiveFilters) {
      clearContainer.classList.remove('hidden');
    } else {
      clearContainer.classList.add('hidden');
    }
  }

  // Clear filters handler
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    stageSelect.value = '';
    comercialSelect.value = '';
    countrySelect.value = '';
    valoracionSelect.value = '';

    Object.keys(activeFilters).forEach(key => {
      activeFilters[key] = '';
    });

    clearContainer.classList.add('hidden');
    onFilterChange(activeFilters);
  });

  return container;
}
