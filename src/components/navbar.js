import { renderNotificationBell } from './notification-bell';

export function renderNavbar(currentUser, onNotificationClick) {
  const navbar = document.createElement('nav');
  navbar.className = 'h-16 bg-white border-b border-[#d9d9dd] px-8 flex items-center justify-between shrink-0 select-none';

  // Get view title based on current hash
  const hash = window.location.hash || '#dashboard';
  let viewTitle = 'Dashboard';
  if (hash === '#leads-table') viewTitle = 'Tabla de Leads';
  else if (hash === '#leads-kanban') viewTitle = 'Pipeline Kanban';
  else if (hash === '#leads-by-company') viewTitle = 'Contactos';
  else if (hash === '#campaigns') viewTitle = 'Campañas';
  else if (hash === '#automations') viewTitle = 'Automatizaciones';
  else if (hash === '#settings-profile') viewTitle = 'Mi perfil';
  else if (hash === '#settings-users') viewTitle = 'Gestión de usuarios';
  else if (hash === '#settings-pipeline') viewTitle = 'Etapas del Pipeline';
  else if (hash === '#settings-franquiday') viewTitle = 'Eventos Franquiday';
  else if (hash === '#settings-integrations') viewTitle = 'Integraciones';
  else if (hash.startsWith('#settings')) viewTitle = 'Configuración';

  navbar.innerHTML = `
    <!-- Path breadcrumb and toggle -->
    <div class="flex items-center gap-3">
      <button id="toggle-sidebar-btn" class="cursor-pointer p-1 rounded-sm text-[#616161] hover:text-primary transition-colors focus:outline-none text-base" title="Mostrar/Ocultar Menú">
        ☰
      </button>
      <div class="flex items-center gap-2 font-mono text-[11px] tracking-wider text-muted font-medium">
        <span class="uppercase">CRM</span>
        <span class="text-neutral-300 font-sans">/</span>
        <span class="text-primary font-bold uppercase">${viewTitle}</span>
      </div>
    </div>

    <!-- Actions -->
    <div id="navbar-actions" class="flex items-center gap-4">
      <!-- Bell goes here -->
    </div>
  `;

  const toggleBtn = navbar.querySelector('#toggle-sidebar-btn');
  toggleBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('aside');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    
    if (window.innerWidth < 1024) {
      // Mobile
      sidebar.classList.toggle('open');
      if (backdrop) {
        backdrop.classList.toggle('hidden');
      }
    } else {
      // Desktop
      sidebar.classList.toggle('collapsed');
    }
  });

  const actionsContainer = navbar.querySelector('#navbar-actions');
  const bellElement = renderNotificationBell(currentUser, onNotificationClick);
  actionsContainer.appendChild(bellElement);

  // Store unsubscribe function on the navbar so the layout engine can clean it up
  navbar.cleanup = () => {
    if (bellElement.unsubscribe) {
      bellElement.unsubscribe();
    }
  };

  return navbar;
}
