import { CURRENT_VERSION, getLatestRelease } from '../data/changelog';
import { openChangelogModal } from './changelog-modal';

const STORAGE_KEY = 'crm_last_seen_version';

export function hasUnreadVersion() {
  try {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    return lastSeen !== CURRENT_VERSION;
  } catch (e) {
    return false;
  }
}

export function markVersionAsSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
  } catch (e) {
    // silently catch
  }
  
  const badge = document.getElementById('sidebar-version-badge');
  if (badge) {
    badge.classList.add('hidden');
  }
}

export function checkAndAnnounceNewVersion() {
  // Evitar duplicar el banner si ya está montado
  if (document.getElementById('version-announcer-toast')) {
    return;
  }

  if (!hasUnreadVersion()) {
    return;
  }

  const latestRelease = getLatestRelease();
  if (!latestRelease) return;

  // Creamos el banner flotante sutil (bottom right)
  const banner = document.createElement('div');
  banner.id = 'version-announcer-toast';
  banner.className = 'fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white border border-neutral-300 rounded-sm shadow-xl p-4 flex flex-col gap-3 animate-fade-in select-none';

  banner.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-full bg-coral/10 text-coral flex items-center justify-center text-sm font-bold shrink-0">
          ✨
        </div>
        <div class="flex flex-col">
          <span class="font-mono text-[10px] font-bold text-coral uppercase tracking-wider">¡Actualización disponible!</span>
          <h4 class="text-xs font-semibold text-primary">Novedades en el CRM (v${CURRENT_VERSION})</h4>
        </div>
      </div>
      <button id="close-version-banner-btn" class="cursor-pointer text-neutral-400 hover:text-neutral-600 font-mono text-xs p-1" title="Cerrar">
        ✕
      </button>
    </div>

    <p class="text-xs text-neutral-600 leading-relaxed pl-9.5">
      ${latestRelease.summary}
    </p>

    <div class="flex items-center justify-end gap-2 pt-1 border-t border-neutral-100">
      <button 
        id="dismiss-version-banner-btn" 
        class="cursor-pointer px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-full transition-colors"
      >
        Entendido
      </button>
      <button 
        id="open-changelog-btn" 
        class="cursor-pointer px-3.5 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-neutral-800 rounded-full transition-colors shadow-2xs"
      >
        Ver qué cambió
      </button>
    </div>
  `;

  function dismissBanner() {
    markVersionAsSeen();
    banner.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-200');
    setTimeout(() => {
      banner.remove();
    }, 200);
  }

  // Listeners
  banner.querySelector('#close-version-banner-btn').addEventListener('click', dismissBanner);
  banner.querySelector('#dismiss-version-banner-btn').addEventListener('click', dismissBanner);
  banner.querySelector('#open-changelog-btn').addEventListener('click', () => {
    dismissBanner();
    openChangelogModal();
  });

  document.body.appendChild(banner);
}
