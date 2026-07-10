import { cache } from '../lib/cache';

export function renderStageCards(countsMap, onCollapseChange = null) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-3 w-full select-none';

  const isCollapsed = localStorage.getItem('leads_stages_collapsed') === 'true';
  const stages = cache.getStages();

  const totalLeads = Object.values(countsMap).reduce((sum, count) => sum + count, 0);

  let cardsHtml = '';
  if (!isCollapsed) {
    cardsHtml = `
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 animate-fade-in">
        ${stages.map(stage => {
          const count = countsMap[stage.id] || 0;
          return `
            <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between h-20 transition-all hover:border-primary duration-150">
              <div class="flex items-center gap-1.5 overflow-hidden">
                <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${stage.color}"></span>
                <span class="font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase truncate" title="${stage.name}">${stage.name}</span>
              </div>
              <span class="text-xl font-light font-display text-primary mt-1">${count}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Header with Toggle Collapse -->
    <div class="flex items-center justify-between text-xs border-b border-[#d9d9dd] pb-2">
      <div class="flex items-center gap-2">
        <span class="font-mono text-[10px] font-bold tracking-wider text-primary uppercase">Métricas Pipeline</span>
        <span class="font-sans text-[10px] text-muted-slate">(${totalLeads} leads en total)</span>
      </div>
      <button id="toggle-collapse-btn" class="font-mono text-[10px] font-bold text-action-blue hover:underline uppercase tracking-wider focus:outline-none">
        ${isCollapsed ? 'MOSTRAR DETALLE ➔' : 'COLAPSAR ▲'}
      </button>
    </div>
    
    <!-- Stage Cards List -->
    <div id="cards-body">
      ${cardsHtml}
    </div>
  `;

  // Attach event listener
  container.querySelector('#toggle-collapse-btn').addEventListener('click', () => {
    const nextCollapsed = localStorage.getItem('leads_stages_collapsed') !== 'true';
    localStorage.setItem('leads_stages_collapsed', nextCollapsed);
    
    // Re-render
    const cardsBody = container.querySelector('#cards-body');
    const toggleBtn = container.querySelector('#toggle-collapse-btn');
    
    if (nextCollapsed) {
      cardsBody.innerHTML = '';
      toggleBtn.textContent = 'MOSTRAR DETALLE ➔';
    } else {
      toggleBtn.textContent = 'COLAPSAR ▲';
      cardsBody.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 animate-fade-in">
          ${stages.map(stage => {
            const count = countsMap[stage.id] || 0;
            return `
              <div class="bg-white border border-[#d9d9dd] rounded-sm p-4 flex flex-col justify-between h-20 transition-all hover:border-primary duration-150">
                <div class="flex items-center gap-1.5 overflow-hidden">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${stage.color}"></span>
                  <span class="font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase truncate" title="${stage.name}">${stage.name}</span>
                </div>
                <span class="text-xl font-light font-display text-primary mt-1">${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (onCollapseChange) {
      onCollapseChange(nextCollapsed);
    }
  });

  return container;
}
