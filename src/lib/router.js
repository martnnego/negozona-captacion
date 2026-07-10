import { auth } from './auth';

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.appContainer = null;
    this.onRouteChanged = null;

    window.addEventListener('hashchange', () => this.handleRouting());
  }

  init(appContainer, routes, onRouteChanged) {
    this.appContainer = appContainer;
    this.routes = routes;
    this.onRouteChanged = onRouteChanged;
    this.handleRouting();
  }

  async handleRouting() {
    let hash = window.location.hash || '#dashboard';
    
    // Auth Guard
    const userSession = await auth.getCurrentUser();
    
    if (!userSession && hash !== '#login') {
      window.location.hash = '#login';
      return;
    }

    if (userSession && hash === '#login') {
      window.location.hash = '#dashboard';
      return;
    }

    const routeKey = this.routes[hash] ? hash : '#dashboard';
    const renderFn = this.routes[routeKey];
    
    if (renderFn) {
      // Execute cleanup on previous view if defined
      if (this.currentView && typeof this.currentView.cleanup === 'function') {
        try {
          this.currentView.cleanup();
        } catch (e) {
          console.error('Error cleaning up previous view:', e);
        }
      }

      this.currentRoute = routeKey;
      if (this.onRouteChanged) {
        this.onRouteChanged(routeKey, userSession);
      }

      // Show skeleton preloader immediately
      this.appContainer.innerHTML = '';
      this.appContainer.appendChild(buildPageSkeleton());

      // Yield to the browser so it actually paints the skeleton before we
      // start building the real page DOM. Without this, sync renderFns
      // resolve in the same JS task and the skeleton is never drawn.
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Execute the page renderer
      const view = await renderFn(userSession);
      this.currentView = view;

      // Swap skeleton → real view
      this.appContainer.innerHTML = '';
      if (view instanceof HTMLElement) {
        this.appContainer.appendChild(view);
      } else if (typeof view === 'string') {
        this.appContainer.innerHTML = view;
      }
    }
  }

  navigate(hash) {
    window.location.hash = hash;
  }
}

/** Builds a lightweight animated skeleton that mimics the general page structure. */
function buildPageSkeleton() {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-8 animate-fade-in pb-12 w-full';
  wrap.innerHTML = `
    <!-- Header skeleton -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6">
      <div class="flex flex-col gap-2">
        <div class="h-7 w-52 bg-neutral-100 rounded-sm animate-pulse"></div>
        <div class="h-3 w-72 bg-neutral-100 rounded-sm animate-pulse"></div>
      </div>
      <div class="flex gap-2">
        <div class="h-8 w-20 bg-neutral-100 rounded-full animate-pulse"></div>
        <div class="h-8 w-20 bg-neutral-100 rounded-full animate-pulse"></div>
        <div class="h-8 w-28 bg-neutral-100 rounded-full animate-pulse"></div>
      </div>
    </div>

    <!-- Metric cards skeleton -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      ${Array(4).fill(0).map(() => `
        <div class="bg-neutral-50 border border-neutral-100 rounded-sm p-6 h-28 flex flex-col justify-between">
          <div class="h-2.5 w-24 bg-neutral-200 rounded-sm animate-pulse"></div>
          <div class="h-8 w-16 bg-neutral-200 rounded-sm animate-pulse"></div>
        </div>
      `).join('')}
    </div>

    <!-- Table / content skeleton -->
    <div class="bg-white border border-[#d9d9dd] rounded-sm overflow-hidden">
      <!-- Table head -->
      <div class="px-6 py-3 border-b border-[#d9d9dd] bg-neutral-50 flex gap-6">
        ${Array(5).fill(0).map(() => `<div class="h-2.5 w-20 bg-neutral-200 rounded-sm animate-pulse"></div>`).join('')}
      </div>
      <!-- Table rows -->
      ${Array(8).fill(0).map((_, i) => `
        <div class="px-6 py-4 border-b border-[#e5e7eb] flex items-center gap-6" style="opacity:${1 - i * 0.1}">
          <div class="h-3 w-3 bg-neutral-200 rounded-xs animate-pulse shrink-0"></div>
          <div class="h-3 w-32 bg-neutral-200 rounded-sm animate-pulse"></div>
          <div class="h-3 w-28 bg-neutral-200 rounded-sm animate-pulse"></div>
          <div class="h-3 w-16 bg-neutral-200 rounded-sm animate-pulse"></div>
          <div class="h-3 w-36 bg-neutral-200 rounded-sm animate-pulse"></div>
          <div class="h-5 w-20 bg-neutral-100 rounded-full animate-pulse ml-auto"></div>
        </div>
      `).join('')}
    </div>
  `;
  return wrap;
}

export const router = new Router();
