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
      
      // Execute the page renderer
      this.appContainer.innerHTML = '';
      const view = await renderFn(userSession);
      this.currentView = view;

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

export const router = new Router();
