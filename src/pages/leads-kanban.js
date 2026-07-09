export function renderLeadsKanban() {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in';
  container.innerHTML = `
    <div>
      <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Pipeline Kanban</h2>
      <p class="text-xs text-muted-slate mt-1">Visualización del embudo de ventas y drag & drop de leads</p>
    </div>
    
    <div class="p-8 text-center border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50 font-sans text-sm text-neutral-400">
      <span class="block mb-2 text-lg">🗂️</span>
      La vista Kanban se implementará en la Fase 3 del desarrollo.
    </div>
  `;
  return container;
}
