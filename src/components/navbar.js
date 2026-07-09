import { renderNotificationBell } from './notification-bell';

export function renderNavbar(currentUser, onNotificationClick) {
  const navbar = document.createElement('nav');
  navbar.className = 'h-16 bg-white border-b border-[#d9d9dd] px-8 flex items-center justify-between shrink-0 select-none';

  // Get view title based on current hash
  const hash = window.location.hash || '#dashboard';
  let viewTitle = 'Dashboard';
  if (hash === '#leads-table') viewTitle = 'Tabla de Leads';
  else if (hash === '#leads-kanban') viewTitle = 'Pipeline Kanban';
  else if (hash === '#leads-by-company') viewTitle = 'Leads agrupados por Empresa';
  else if (hash === '#settings') viewTitle = 'Configuración del Sistema';

  navbar.innerHTML = `
    <!-- Path breadcrumb -->
    <div class="flex items-center gap-2 font-mono text-[11px] tracking-wider text-muted font-medium">
      <span class="uppercase">CRM</span>
      <span class="text-neutral-300 font-sans">/</span>
      <span class="text-primary font-bold uppercase">${viewTitle}</span>
    </div>

    <!-- Actions -->
    <div id="navbar-actions" class="flex items-center gap-4">
      <!-- Bell goes here -->
    </div>
  `;

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
