export const modal = {
  create({ title, content, actions = [], onClose = null, sizeClass = 'max-w-2xl' }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in';
    
    const container = document.createElement('div');
    container.className = `bg-white w-full ${sizeClass} rounded-sm border border-neutral-200 shadow-xl flex flex-col max-h-[90vh] overflow-hidden`;
    
    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-6 py-4 border-b border-neutral-200';
    header.innerHTML = `
      <h3 class="text-lg font-medium font-display text-primary">${title}</h3>
      <button class="close-btn text-neutral-400 hover:text-neutral-600 transition-colors font-mono text-lg p-1">✕</button>
    `;
    
    // Content body
    const body = document.createElement('div');
    body.className = 'flex-1 p-6 overflow-y-auto font-sans text-sm text-neutral-700';
    if (content instanceof HTMLElement) {
      body.appendChild(content);
    } else {
      body.innerHTML = content;
    }
    
    container.appendChild(header);
    container.appendChild(body);
    
    // Footer Actions
    if (actions.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-3';
      
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.textContent = action.text;
        
        if (action.primary) {
          btn.className = 'px-4 py-2 bg-primary text-white text-xs font-medium rounded-full hover:bg-cohere-black transition-colors';
        } else {
          btn.className = 'px-4 py-2 text-neutral-600 text-xs font-medium rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors';
        }
        
        btn.addEventListener('click', () => {
          if (action.onClick) {
            action.onClick(closeModal);
          } else {
            closeModal();
          }
        });
        
        footer.appendChild(btn);
      });
      
      container.appendChild(footer);
    }
    
    backdrop.appendChild(container);
    document.body.appendChild(backdrop);
    
    // Prevent body scroll
    document.body.classList.add('overflow-hidden');
    
    function closeModal() {
      backdrop.classList.add('opacity-0');
      container.classList.add('translate-y-4');
      setTimeout(() => {
        backdrop.remove();
        document.body.classList.remove('overflow-hidden');
        if (onClose) onClose();
      }, 200);
    }
    
    // Close events
    header.querySelector('.close-btn').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    
    return {
      close: closeModal,
      bodyEl: body
    };
  }
};
