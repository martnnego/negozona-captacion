import { auth } from '../lib/auth';

/**
 * Maps the current location hash to a human-readable module name.
 * @param {string} hash 
 * @returns {string}
 */
export function getModuleNameFromHash(hash = window.location.hash) {
  const [baseHash] = (hash || '#dashboard').split('?');
  
  const map = {
    '#dashboard': 'Dashboard',
    '#leads-table': 'Tabla de Leads',
    '#leads-kanban': 'Pipeline Kanban',
    '#leads-by-company': 'Contactos',
    '#salesql-search': 'Buscador SalesQL',
    '#unmatched-whatsapp': 'WhatsApp Sin Asignar',
    '#campaigns': 'Campañas',
    '#templates': 'Plantillas de Email',
    '#mailing-stats': 'Estadísticas de Mailing',
    '#automations': 'Automatizaciones',
    '#automation-detail': 'Detalle de Automatización',
    '#settings': 'Configuración',
    '#settings-profile': 'Configuración / Mi perfil',
    '#settings-users': 'Configuración / Gestión de usuarios',
    '#settings-pipeline': 'Configuración / Etapas del Pipeline',
    '#settings-franquiday': 'Configuración / Eventos Franquiday',
    '#settings-recursos': 'Configuración / Recursos',
    '#settings-integrations': 'Configuración / Integraciones',
    '#settings-feedback': 'Configuración / Feedback'
  };

  return map[baseHash] || baseHash.replace('#', '') || 'Dashboard';
}

/**
 * Detects if there is an active entity open on screen (e.g. Lead Detail modal, drawer, etc.)
 * @returns {Object|null} { type: string, id?: string, name?: string }
 */
export function detectActiveEntity() {
  // 1. Check for Lead Detail modal
  const leadModalEl = document.querySelector('[data-lead-id]');
  if (leadModalEl) {
    return {
      type: 'lead',
      id: leadModalEl.dataset.leadId || null,
      name: leadModalEl.dataset.companyName || leadModalEl.querySelector('h2, h3')?.textContent?.trim() || null
    };
  }

  // 2. Check for open modal headers with lead names or titles
  const openModals = document.querySelectorAll('.fixed.inset-0.z-40, .fixed.inset-0.z-50');
  for (const m of openModals) {
    const titleEl = m.querySelector('h3, h2');
    if (titleEl && titleEl.textContent) {
      const text = titleEl.textContent.trim();
      if (text.includes('Ficha de Empresa') || text.includes('Lead') || text.includes('Contacto')) {
        return {
          type: 'modal',
          title: text
        };
      }
    }
  }

  // 3. Check for URL parameters (e.g., #automation-detail?id=...)
  const hash = window.location.hash || '';
  if (hash.includes('?')) {
    const [, queryString] = hash.split('?');
    const params = new URLSearchParams(queryString);
    if (params.has('id')) {
      const isAuto = hash.startsWith('#automation');
      return {
        type: isAuto ? 'automation' : 'item',
        id: params.get('id')
      };
    }
  }

  return null;
}

/**
 * Captures comprehensive current context for the feedback submission.
 * @returns {Promise<Object>}
 */
export async function captureFeedbackContext() {
  const currentUser = await auth.getCurrentUser();
  const currentHash = window.location.hash || '#dashboard';
  const moduleName = getModuleNameFromHash(currentHash);
  const activeEntity = detectActiveEntity();

  return {
    user: {
      id: currentUser?.id || null,
      email: currentUser?.email || null,
      name: currentUser?.profile?.full_name || currentUser?.email || 'Usuario'
    },
    module: moduleName,
    page_url: window.location.href,
    hash: currentHash,
    entity_context: activeEntity || {},
    metadata: {
      screen: `${window.innerWidth}x${window.innerHeight}`,
      device: window.innerWidth < 1024 ? 'mobile' : 'desktop',
      userAgent: navigator.userAgent,
      language: navigator.language,
      timestamp: new Date().toISOString()
    }
  };
}
