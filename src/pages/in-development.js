export function renderInDevelopment(pageTitle) {
  const container = document.createElement('div');
  container.className = 'flex flex-col items-center justify-center min-h-[450px] h-full gap-6 animate-fade-in text-center p-8 select-none';

  container.innerHTML = `
    <div class="flex flex-col items-center gap-5 max-w-md">
      <!-- Icon/Illustration -->
      <div class="w-16 h-16 rounded-full bg-soft-stone flex items-center justify-center text-primary text-3xl animate-pulse">
        🛠️
      </div>
      
      <!-- Content -->
      <div class="flex flex-col gap-2">
        <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">${pageTitle}</h2>
        <span class="font-mono text-[9px] text-coral font-bold tracking-widest uppercase">Sección en desarrollo</span>
        <p class="text-xs text-muted-slate mt-2 font-sans max-w-xs mx-auto">
          Estamos construyendo esta sección con nuevas herramientas y automatizaciones. ¡Estará disponible muy pronto!
        </p>
      </div>

      <!-- Action / Back button -->
      <a href="#dashboard" class="mt-4 px-6 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
        Volver al Dashboard
      </a>
    </div>
  `;

  return container;
}
