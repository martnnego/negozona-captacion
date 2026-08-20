import { auth } from '../lib/auth';
import { router } from '../lib/router';

export function renderSidebar(currentUser) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar-responsive bg-white border-r border-[#d9d9dd] flex flex-col h-full shrink-0 select-none overflow-x-hidden';

  const currentHash = window.location.hash || '#dashboard';
  const isAdmin = currentUser?.profile?.role === 'super_admin';

  // Determine active section for auto-expanding accordions
  const isLeadsActive = ['#leads-table', '#leads-kanban', '#unmatched-whatsapp'].includes(currentHash);
  const isMarketingActive = ['#campaigns', '#templates', '#mailing-stats'].includes(currentHash);
  const isConfigActive = currentHash.startsWith('#settings');

  // Category 1: Dashboard (Direct link)
  const isDashboardActive = currentHash === '#dashboard';
  const dashboardHtml = `
    <a href="#dashboard" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 w-full ${
      isDashboardActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <span class="text-sm">📊</span>
      <span>Dashboard</span>
    </a>
  `;

  // Category 2: Leads (Accordion)
  const leadsHtml = `
    <div class="flex flex-col w-full my-0.5" data-accordion="leads">
      <button type="button" class="accordion-toggle flex items-center justify-between px-3.5 py-2 rounded-xs font-sans text-xs font-bold uppercase tracking-wider text-muted-slate hover:text-primary hover:bg-neutral-50 transition-colors w-full cursor-pointer">
        <div class="flex items-center gap-2.5">
          <span class="text-xs">📋</span>
          <span>Leads</span>
        </div>
        <span class="arrow text-[10px] font-mono transition-transform duration-200 ${isLeadsActive ? 'rotate-90' : ''}">▸</span>
      </button>
      <div class="accordion-content pl-3 flex flex-col gap-1 mt-1 mb-1 border-l-2 border-neutral-100 ml-5 ${isLeadsActive ? '' : 'hidden'}">
        <a href="#leads-table" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#leads-table'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>📄</span>
          <span class="truncate">Tabla</span>
        </a>
        <a href="#leads-kanban" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#leads-kanban'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>🗂️</span>
          <span class="truncate">Kanban</span>
        </a>
        <a href="#unmatched-whatsapp" class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#unmatched-whatsapp'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <div class="flex items-center gap-2 truncate">
            <span>💬</span>
            <span class="truncate">Sin Asignar</span>
          </div>
          <span id="unmatched-wa-badge" class="hidden text-[8px] font-mono font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full shrink-0">0</span>
        </a>
      </div>
    </div>
  `;

  // Category 3: Contactos (Direct link)
  const isContactosActive = currentHash === '#leads-by-company';
  const contactosHtml = `
    <a href="#leads-by-company" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 w-full ${
      isContactosActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <span class="text-sm">👥</span>
      <span>Contactos</span>
    </a>
  `;

  // Category 4: Marketing (Accordion)
  const marketingHtml = `
    <div class="flex flex-col w-full my-0.5" data-accordion="marketing">
      <button type="button" class="accordion-toggle flex items-center justify-between px-3.5 py-2 rounded-xs font-sans text-xs font-bold uppercase tracking-wider text-muted-slate hover:text-primary hover:bg-neutral-50 transition-colors w-full cursor-pointer">
        <div class="flex items-center gap-2.5">
          <span class="text-xs">📢</span>
          <span>Marketing</span>
        </div>
        <span class="arrow text-[10px] font-mono transition-transform duration-200 ${isMarketingActive ? 'rotate-90' : ''}">▸</span>
      </button>
      <div class="accordion-content pl-3 flex flex-col gap-1 mt-1 mb-1 border-l-2 border-neutral-100 ml-5 ${isMarketingActive ? '' : 'hidden'}">
        <a href="#campaigns" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#campaigns'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>📣</span>
          <span class="truncate">Campañas</span>
        </a>
        <a href="#templates" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#templates'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>📄</span>
          <span class="truncate">Plantillas</span>
        </a>
        <a href="#mailing-stats" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#mailing-stats'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>📊</span>
          <span class="truncate">Estadísticas</span>
        </a>
      </div>
    </div>
  `;

  // Category 5: Automatizaciones (Direct link)
  const isAutomationsActive = currentHash === '#automations';
  const automationsHtml = `
    <a href="#automations" class="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 w-full ${
      isAutomationsActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <div class="flex items-center gap-3 truncate">
        <span class="text-sm">🤖</span>
        <span class="truncate">Automatizaciones</span>
      </div>
      <span class="text-[8px] font-mono bg-soft-stone text-[#616161] px-1.5 py-0.5 rounded-xs font-bold uppercase tracking-wider shrink-0 ${isAutomationsActive ? 'bg-[#333] text-white' : ''}">Dev</span>
    </a>
  `;

  // Category 6: Configuración (Accordion)
  const configHtml = `
    <div class="flex flex-col w-full my-0.5" data-accordion="config">
      <button type="button" class="accordion-toggle flex items-center justify-between px-3.5 py-2 rounded-xs font-sans text-xs font-bold uppercase tracking-wider text-muted-slate hover:text-primary hover:bg-neutral-50 transition-colors w-full cursor-pointer">
        <div class="flex items-center gap-2.5">
          <span class="text-xs">⚙️</span>
          <span>Configuración</span>
        </div>
        <span class="arrow text-[10px] font-mono transition-transform duration-200 ${isConfigActive ? 'rotate-90' : ''}">▸</span>
      </button>
      <div class="accordion-content pl-3 flex flex-col gap-1 mt-1 mb-1 border-l-2 border-neutral-100 ml-5 ${isConfigActive ? '' : 'hidden'}">
        <a href="#settings-profile" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#settings-profile' || currentHash === '#settings'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>👤</span>
          <span class="truncate">Mi perfil</span>
        </a>
        ${isAdmin ? `
          <a href="#settings-users" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
            currentHash === '#settings-users'
              ? 'bg-primary text-white font-bold'
              : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
          }">
            <span>👥</span>
            <span class="truncate">Usuarios</span>
          </a>
          <a href="#settings-pipeline" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
            currentHash === '#settings-pipeline'
              ? 'bg-primary text-white font-bold'
              : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
          }">
            <span>🛤️</span>
            <span class="truncate">Etapas Pipeline</span>
          </a>
          <a href="#settings-franquiday" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
            currentHash === '#settings-franquiday'
              ? 'bg-primary text-white font-bold'
              : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
          }">
            <span>🎪</span>
            <span class="truncate">Franquiday</span>
          </a>
        ` : ''}
        <a href="#settings-integrations" class="flex items-center gap-2 px-3 py-1.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#settings-integrations'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>🔌</span>
          <span class="truncate">Integraciones</span>
        </a>
      </div>
    </div>
  `;

  sidebar.innerHTML = `
    <!-- Top Brand -->
    <div class="px-4 py-4 border-b border-[#d9d9dd] flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-3">
        <div class="shrink-0 w-9 h-9 flex items-center justify-center">
          <img src="/logo-pin.png" alt="NegoZona Logo" class="h-9 w-auto object-contain select-none" />
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-[10px] tracking-[0.2em] text-coral font-bold uppercase">NEGOZONA</span>
          <h1 class="text-sm font-semibold font-display text-primary tracking-tight">CRM Expansión</h1>
        </div>
      </div>
      <button id="close-sidebar-btn" class="cursor-pointer lg:hidden text-neutral-400 hover:text-primary font-mono text-base focus:outline-none p-1" title="Cerrar menú">
        ✕
      </button>
    </div>

    <!-- Navigation links -->
    <div class="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden no-scrollbar">
      ${dashboardHtml}
      ${leadsHtml}
      ${contactosHtml}
      ${marketingHtml}
      ${automationsHtml}
      ${configHtml}
    </div>

    <!-- Bottom User Info & Redesigned Logout Button -->
    <div class="p-3.5 border-t border-[#d9d9dd] flex items-center justify-between gap-2 bg-neutral-50 shrink-0">
      <div class="flex items-center gap-2.5 overflow-hidden min-w-0">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
          ${currentUser?.profile?.avatar_url 
            ? `<img src="${currentUser.profile.avatar_url}" class="w-8 h-8 rounded-full object-cover" />` 
            : (currentUser?.profile?.full_name || currentUser?.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div class="flex flex-col overflow-hidden min-w-0">
          <span class="text-xs font-semibold text-primary truncate font-sans">${currentUser?.profile?.full_name || 'Usuario'}</span>
          <span class="text-[9px] text-muted font-mono tracking-wider uppercase">${currentUser?.profile?.role === 'super_admin' ? 'Admin' : 'Comercial'}</span>
        </div>
      </div>

      <button 
        id="logout-btn" 
        class="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-300 hover:border-rose-400 bg-white hover:bg-rose-50 text-neutral-700 hover:text-rose-600 rounded-sm font-mono text-[10px] font-bold tracking-wider uppercase transition-all duration-150 focus:outline-none shrink-0 shadow-xs cursor-pointer" 
        title="Cerrar sesión"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
        </svg>
        <span>Salir</span>
      </button>
    </div>
  `;

  // Attach Accordion Toggle Listeners
  sidebar.querySelectorAll('.accordion-toggle').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', () => {
      const accordionWrap = toggleBtn.closest('[data-accordion]');
      const content = accordionWrap.querySelector('.accordion-content');
      const arrow = toggleBtn.querySelector('.arrow');
      
      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        arrow.classList.add('rotate-90');
      } else {
        content.classList.add('hidden');
        arrow.classList.remove('rotate-90');
      }
    });
  });

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
