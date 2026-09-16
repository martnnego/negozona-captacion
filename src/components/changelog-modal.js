import { modal } from './modal';
import { CHANGELOG, CURRENT_VERSION } from '../data/changelog';

export function openChangelogModal(initialVersion = null) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6';

  // Subheader intro banner
  const introBanner = document.createElement('div');
  introBanner.className = 'bg-neutral-50 border border-neutral-200 rounded-sm p-4 flex items-start gap-3.5';
  introBanner.innerHTML = `
    <div class="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center text-lg shrink-0">
      ✨
    </div>
    <div class="flex flex-col">
      <h4 class="text-xs font-bold font-sans uppercase tracking-wider text-primary">Novedades y Actualizaciones</h4>
      <p class="text-xs text-neutral-600 mt-0.5 leading-relaxed">
        Acá podés seguir la evolución del CRM, nuevas herramientas comerciales y mejoras continuas para potenciar la captación de franquicias.
      </p>
    </div>
  `;
  container.appendChild(introBanner);

  // Releases container
  const releasesList = document.createElement('div');
  releasesList.className = 'flex flex-col gap-6';

  CHANGELOG.forEach((rel, index) => {
    const isLatest = index === 0;
    const releaseCard = document.createElement('div');
    releaseCard.className = `border rounded-sm p-5 transition-all ${
      isLatest ? 'border-neutral-300 bg-white shadow-2xs' : 'border-neutral-200 bg-neutral-50/50'
    }`;

    // Header of release card
    const headerHtml = `
      <div class="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100 mb-3 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm font-bold text-primary">v${rel.version}</span>
          ${isLatest ? `
            <span class="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Versión Actual
            </span>
          ` : ''}
          <span class="text-[10px] font-mono uppercase tracking-wider bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full">
            ${rel.tag || 'Release'}
          </span>
        </div>
        <span class="text-xs text-neutral-400 font-sans">${rel.date}</span>
      </div>
      <h5 class="text-sm font-semibold text-primary mb-1">${rel.title}</h5>
      <p class="text-xs text-neutral-600 mb-3 leading-relaxed">${rel.summary}</p>
    `;

    // Changes list
    const changesHtml = `
      <div class="flex flex-col gap-2 pt-1">
        ${rel.changes.map(ch => {
          let badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          if (ch.type === 'mejora') badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200';
          if (ch.type === 'arreglo') badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';

          return `
            <div class="flex items-start gap-2.5 text-xs text-neutral-700">
              <span class="border px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-xs shrink-0 tracking-wider ${badgeClasses}">
                ${ch.badge}
              </span>
              <span class="leading-snug">${ch.text}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    releaseCard.innerHTML = headerHtml + changesHtml;
    releasesList.appendChild(releaseCard);
  });

  container.appendChild(releasesList);

  // Marcar como vista la versión actual en localStorage
  try {
    localStorage.setItem('crm_last_seen_version', CURRENT_VERSION);
  } catch (e) {
    // localStorage no disponible
  }

  // Quitar el badge de novedad del sidebar si estuviera visible
  const sidebarBadge = document.getElementById('sidebar-version-badge');
  if (sidebarBadge) {
    sidebarBadge.classList.add('hidden');
  }

  modal.create({
    title: 'Qué hay de nuevo en Negozona',
    content: container,
    sizeClass: 'max-w-2xl',
    actions: [
      {
        text: '¡Entendido, a trabajar!',
        primary: true,
        onClick: (closeModal) => closeModal()
      }
    ]
  });
}
