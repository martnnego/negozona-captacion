export const toast = {
  show(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2';
      document.body.appendChild(container);
    }

    const toastEl = document.createElement('div');
    toastEl.className = `flex items-center gap-3 px-4 py-3 rounded-sm border shadow-xs animate-fade-in max-w-sm bg-white ${
      type === 'success' 
        ? 'border-emerald-200 text-emerald-800' 
        : type === 'error' 
        ? 'border-red-200 text-red-800' 
        : 'border-blue-200 text-blue-800'
    }`;
    
    let colorClass = 'text-emerald-500';
    let icon = '✓';
    if (type === 'error') {
      colorClass = 'text-red-500';
      icon = '✕';
    } else if (type === 'info') {
      colorClass = 'text-blue-500';
      icon = 'ℹ';
    }
    
    toastEl.innerHTML = `
      <span class="font-mono text-sm font-bold ${colorClass}">${icon}</span>
      <span class="text-sm font-sans">${message}</span>
    `;

    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.classList.add('opacity-0', 'transition-all', 'duration-300', 'translate-y-2');
      setTimeout(() => toastEl.remove(), 300);
    }, 4000);
  }
};
