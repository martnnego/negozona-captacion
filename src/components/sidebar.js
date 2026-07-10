import { auth } from '../lib/auth';
import { router } from '../lib/router';

export function renderSidebar(currentUser) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar-responsive bg-white border-r border-[#d9d9dd] flex flex-col h-full shrink-0 select-none';

  const currentHash = window.location.hash || '#dashboard';
  const isAdmin = currentUser?.profile?.role === 'super_admin';

  const menuItems = [
    { label: 'DASHBOARD', hash: '#dashboard', icon: '📊' },
    { label: 'TABLA DE LEADS', hash: '#leads-table', icon: '📋' },
    { label: 'PIPELINE KANBAN', hash: '#leads-kanban', icon: '🗂️' },
    { label: 'POR EMPRESA', hash: '#leads-by-company', icon: '🏢' },
    { label: 'CONFIGURACIÓN', hash: '#settings', icon: '⚙️' },
  ];

  let menuHtml = menuItems
    .map(item => {
      const isActive = currentHash === item.hash;
      return `
        <a href="${item.hash}" class="flex items-center gap-3 px-4 py-3 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          isActive 
            ? 'bg-primary text-white' 
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    })
    .join('');

  sidebar.innerHTML = `
    <!-- Top Brand -->
    <div class="px-4 py-5 border-b border-[#d9d9dd] flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-3">
        <!-- N Logo SVG -->
        <div class="shrink-0 w-9 h-9 rounded-lg overflow-hidden" style="background:#0f172a">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36">
            <rect width="64" height="64" rx="10" fill="#0f172a"/>
            <path d="M13 49 L13 15 L20 15 L45 41 L45 15 L51 15 L51 49 L44 49 L19 23 L19 49 Z" fill="white"/>
            <circle cx="51" cy="13" r="6" fill="#ff6b6b"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-[10px] tracking-[0.2em] text-coral font-bold uppercase">NEGOZONA</span>
          <h1 class="text-sm font-semibold font-display text-primary tracking-tight">CRM Expansión</h1>
        </div>
      </div>
      <button id="close-sidebar-btn" class="lg:hidden text-neutral-400 hover:text-primary font-mono text-base focus:outline-none p-1" title="Cerrar menú">
        ✕
      </button>
    </div>

    <!-- Navigation links -->
    <div class="flex-1 px-4 py-6 flex flex-col gap-1.5 overflow-y-auto">
      ${menuHtml}
    </div>

    <!-- Bottom User Info -->
    <div class="p-4 border-t border-[#d9d9dd] flex items-center justify-between gap-3 bg-neutral-50">
      <div class="flex items-center gap-2 overflow-hidden">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
          ${currentUser?.profile?.avatar_url 
            ? `<img src="${currentUser.profile.avatar_url}" class="w-8 h-8 rounded-full object-cover" />` 
            : (currentUser?.profile?.full_name || currentUser?.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div class="flex flex-col overflow-hidden">
          <span class="text-xs font-semibold text-primary truncate font-sans">${currentUser?.profile?.full_name || 'Usuario'}</span>
          <span class="text-[10px] text-muted font-mono tracking-wider uppercase">${currentUser?.profile?.role === 'super_admin' ? 'Admin' : 'Comercial'}</span>
        </div>
      </div>
      <button id="logout-btn" class="p-1.5 rounded-full hover:bg-neutral-200 text-[#616161] hover:text-primary transition-colors text-xs" title="Cerrar sesión">
        🚪
      </button>
    </div>
  `;

  // Attach logout handler
  sidebar.querySelector('#logout-btn').addEventListener('click', async () => {
    try {
      await auth.logout();
      router.navigate('#login');
    } catch (err) {
      alert('Error cerrando sesión: ' + err.message);
    }
  });

  // Attach mobile close handler
  const closeBtn = sidebar.querySelector('#close-sidebar-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (backdrop) backdrop.classList.add('hidden');
    });
  }

  return sidebar;
}
