export function renderSettings() {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in';
  container.innerHTML = `
    <div>
      <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Configuración</h2>
      <p class="text-xs text-muted-slate mt-1">Administración de usuarios, etapas del pipeline y perfil</p>
    </div>
    
    <div class="p-8 text-center border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50 font-sans text-sm text-neutral-400">
      <span class="block mb-2 text-lg">⚙️</span>
      La configuración del sistema se implementará en la Fase 4 del desarrollo.
    </div>
  `;
  return container;
}
