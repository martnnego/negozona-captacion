import './style.css';
import { auth } from './lib/auth';
import { cache } from './lib/cache';
import { router } from './lib/router';
import { renderSidebar } from './components/sidebar';
import { renderNavbar } from './components/navbar';

// Pages
import { renderLogin } from './pages/login';
import { renderDashboard } from './pages/dashboard';
import { renderLeadsTable } from './pages/leads-table';
import { renderLeadsKanban } from './pages/leads-kanban';
import { renderLeadsByCompany } from './pages/leads-by-company';
import { renderSettings } from './pages/settings';
import { renderLeadDetail } from './pages/lead-detail';

const routes = {
  '#login': renderLogin,
  '#dashboard': renderDashboard,
  '#leads-table': renderLeadsTable,
  '#leads-kanban': renderLeadsKanban,
  '#leads-by-company': renderLeadsByCompany,
  '#settings': renderSettings,
};

let activeNavbar = null;

// Initialize App
async function initApp() {
  const appElement = document.getElementById('app');
  
  // Set up auth state change listener to handle routing and caching dynamically
  auth.onAuthStateChange(async (event, userSession) => {
    console.log('Auth state changed:', event);
    
    if (userSession) {
      if (!cache.isLoaded) {
        await cache.loadAll();
      }
      // Re-trigger routing to apply updated layout
      router.handleRouting();
    } else {
      cache.clear();
      if (activeNavbar?.cleanup) {
        activeNavbar.cleanup();
      }
      activeNavbar = null;
      window.location.hash = '#login';
    }
  });

  // Setup hash-based routing with layout support
  router.init(
    appElement, 
    routes, 
    (hash, userSession) => {
      // Setup structural layout: Sidebar/Navbar for dashboard pages, clear screen for login
      if (hash === '#login') {
        if (activeNavbar?.cleanup) {
          activeNavbar.cleanup();
        }
        activeNavbar = null;
        appElement.className = 'h-full flex flex-col bg-white';
        router.appContainer = appElement;
        // Router will render login inside appElement directly
      } else {
        appElement.className = 'h-full flex overflow-hidden bg-white relative';
        
        // Build dashboard layout containers
        const sidebar = renderSidebar(userSession);
        
        // Create backdrop for mobile sidebar drawer
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/30 z-40 hidden lg:hidden transition-opacity duration-300';
        
        const mainArea = document.createElement('div');
        mainArea.className = 'flex-1 flex flex-col min-w-0 h-full';
        
        if (activeNavbar?.cleanup) {
          activeNavbar.cleanup();
        }
        
        // Define navigation callback to open detail modal on notification click
        const onNotificationClick = (leadId) => {
          renderLeadDetail(leadId, () => {
            // Trigger refresh on current view
            router.handleRouting();
          });
        };
        
        activeNavbar = renderNavbar(userSession, onNotificationClick);
        
        const contentArea = document.createElement('main');
        contentArea.id = 'main-content-view';
        contentArea.className = 'flex-1 overflow-y-auto bg-white p-8 relative';
        
        mainArea.appendChild(activeNavbar);
        mainArea.appendChild(contentArea);
        
        // Close sidebar on backdrop click
        backdrop.addEventListener('click', () => {
          sidebar.classList.remove('open');
          backdrop.classList.add('hidden');
        });
        
        appElement.innerHTML = '';
        appElement.appendChild(sidebar);
        appElement.appendChild(backdrop);
        appElement.appendChild(mainArea);
        
        // Update router container target to render page inside contentArea
        router.appContainer = contentArea;
      }
    }
  );
}

document.addEventListener('DOMContentLoaded', initApp);
