import { auth } from '../lib/auth';
import { router } from '../lib/router';

export function renderSidebar(currentUser) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar-responsive bg-white border-r border-[#d9d9dd] flex flex-col h-full shrink-0 select-none';

  const currentHash = window.location.hash || '#dashboard';
  const isAdmin = currentUser?.profile?.role === 'super_admin';

  const isDashboardActive = currentHash === '#dashboard';
  const isContactosActive = currentHash === '#leads-by-company';
  const isCampaignsActive = currentHash === '#campaigns';
  const isAutomationsActive = currentHash === '#automations';

  const dashboardHtml = `
    <a href="#dashboard" class="flex items-center gap-3 px-4 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
      isDashboardActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <span>📊</span>
      <span>Dashboard</span>
    </a>
  `;

  const leadsHtml = `
    <div class="flex flex-col gap-1 mt-1">
      <div class="flex items-center gap-3 px-4 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-muted-slate select-none">
        <span>📋</span>
        <span>Leads</span>
      </div>
      <div class="pl-4 flex flex-col gap-1 border-l border-[#d9d9dd] ml-6 mb-1">
        <a href="#leads-table" class="flex items-center gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#leads-table'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>📋</span>
          <span>Tabla</span>
        </a>
        <a href="#leads-kanban" class="flex items-center gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#leads-kanban'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>🗂️</span>
          <span>Kanban</span>
        </a>
        <a href="#unmatched-whatsapp" class="flex items-center justify-between gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#unmatched-whatsapp'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <div class="flex items-center gap-2">
            <span>💬</span>
            <span>Sin Asignar</span>
          </div>
          <span id="unmatched-wa-badge" class="hidden text-[8px] font-mono font-bold bg-rose-500 text-white px-1.5 py-0.2 rounded-full">0</span>
        </a>
      </div>
    </div>
  `;

  const contactosHtml = `
    <a href="#leads-by-company" class="flex items-center gap-3 px-4 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
      isContactosActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <span>👥</span>
      <span>Contactos</span>
    </a>
  `;

  const campaignsHtml = `
    <a href="#campaigns" class="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
      isCampaignsActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <div class="flex items-center gap-3">
        <span>📣</span>
        <span>Campañas</span>
      </div>
      <span class="text-[8px] font-mono bg-soft-stone text-[#616161] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider scale-90 ${isCampaignsActive ? 'bg-[#333] text-white' : ''}">Desarrollo</span>
    </a>
  `;

  const automationsHtml = `
    <a href="#automations" class="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
      isAutomationsActive 
        ? 'bg-primary text-white font-bold' 
        : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
    }">
      <div class="flex items-center gap-3">
        <span>🤖</span>
        <span>Automatizaciones</span>
      </div>
      <span class="text-[8px] font-mono bg-soft-stone text-[#616161] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider scale-90 ${isAutomationsActive ? 'bg-[#333] text-white' : ''}">Desarrollo</span>
    </a>
  `;

  const configHtml = `
    <div class="flex flex-col gap-1 mt-1">
      <div class="flex items-center gap-3 px-4 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-muted-slate select-none">
        <span>⚙️</span>
        <span>Configuración</span>
      </div>
      <div class="pl-4 flex flex-col gap-1 border-l border-[#d9d9dd] ml-6">
        <a href="#settings-profile" class="flex items-center gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#settings-profile' || currentHash === '#settings'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <span>👤</span>
          <span>Mi perfil</span>
        </a>
        ${isAdmin ? `
          <a href="#settings-users" class="flex items-center gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
            currentHash === '#settings-users'
              ? 'bg-primary text-white font-bold'
              : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
          }">
            <span>👥</span>
            <span>Gestión de usuarios</span>
          </a>
          <a href="#settings-pipeline" class="flex items-center gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
            currentHash === '#settings-pipeline'
              ? 'bg-primary text-white font-bold'
              : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
          }">
            <span>🛤️</span>
            <span>Etapas del Pipeline</span>
          </a>
          <a href="#settings-franquiday" class="flex items-center gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
            currentHash === '#settings-franquiday'
              ? 'bg-primary text-white font-bold'
              : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
          }">
            <span>🎪</span>
            <span>Eventos Franquiday</span>
          </a>
        ` : ''}
        <a href="#settings-integrations" class="flex items-center justify-between gap-2 px-3 py-2 rounded-xs font-sans text-xs font-semibold tracking-wider transition-all duration-150 ${
          currentHash === '#settings-integrations'
            ? 'bg-primary text-white font-bold'
            : 'text-[#616161] hover:bg-soft-stone hover:text-primary'
        }">
          <div class="flex items-center gap-2">
            <span>🔌</span>
            <span>Integraciones</span>
          </div>
        </a>
      </div>
    </div>
  `;

  let menuHtml = `
    ${dashboardHtml}
    ${leadsHtml}
    ${contactosHtml}
    ${campaignsHtml}
    ${automationsHtml}
    ${configHtml}
  `;

  sidebar.innerHTML = `
    <!-- Top Brand -->
    <div class="px-4 py-5 border-b border-[#d9d9dd] flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-3">
        <!-- Logo Image matching Favicon -->
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
