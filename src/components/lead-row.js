import { cache } from '../lib/cache';
import { formatDate, formatDateTime } from '../utils/date-format';

let globalTooltip = null;
let globalTooltipArrow = null;
let globalTooltipContent = null;

function ensureGlobalTooltip() {
  if (globalTooltip && document.body.contains(globalTooltip)) return;

  globalTooltip = document.createElement('div');
  globalTooltip.id = 'crm-novedad-tooltip';
  globalTooltip.className = 'fixed z-[999999] bg-[#17171c] text-white p-3.5 rounded-md shadow-2xl border border-neutral-700 w-72 text-left pointer-events-none transition-opacity duration-150 opacity-0 hidden font-sans select-none';

  globalTooltipArrow = document.createElement('div');
  globalTooltipArrow.id = 'crm-tooltip-arrow';
  globalTooltipArrow.className = 'absolute w-0 h-0 border-4 border-transparent';

  globalTooltipContent = document.createElement('div');
  globalTooltipContent.id = 'crm-tooltip-content';

  globalTooltip.appendChild(globalTooltipArrow);
  globalTooltip.appendChild(globalTooltipContent);
  document.body.appendChild(globalTooltip);

  // Hide on global scroll to prevent detached floating tooltip
  window.addEventListener('scroll', hideNovedadTooltip, { passive: true });
}

function showNovedadTooltip(targetEl, data) {
  ensureGlobalTooltip();

  const { typeIcon, typeLabel, dirBadge, subject, authorName, contactedDate, bodySnippet } = data;

  globalTooltipContent.innerHTML = `
    <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-neutral-800">
      <div class="flex items-center gap-1.5">
        <span class="text-xs">${typeIcon}</span>
        <span class="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-300">${typeLabel}</span>
      </div>
      ${dirBadge}
    </div>

    <div class="mt-2 flex flex-col gap-1">
      <h5 class="text-xs font-semibold text-white leading-snug break-words">${subject}</h5>
      <div class="flex items-center justify-between text-[9px] text-neutral-400 font-mono mt-0.5">
        <span>Por: <b class="text-neutral-200">${authorName}</b></span>
        <span>${contactedDate ? formatDateTime(contactedDate) : '—'}</span>
      </div>
    </div>

    ${bodySnippet}
  `;

  globalTooltip.classList.remove('hidden');

  // Calculate position
  const rect = targetEl.getBoundingClientRect();
  const tooltipWidth = 288; // 72 * 4 = 288px
  const tooltipHeight = globalTooltip.offsetHeight || 130;

  const targetCenterX = rect.left + rect.width / 2;

  // Clamp horizontal positioning inside viewport
  let left = targetCenterX - tooltipWidth / 2;
  left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, left));

  // Determine if there is enough space above (need tooltipHeight + margin)
  const spaceAbove = rect.top;
  const showBelow = spaceAbove < (tooltipHeight + 16);

  let top = 0;
  if (showBelow) {
    top = rect.bottom + 8;
    globalTooltipArrow.className = 'absolute border-4 border-transparent border-b-[#17171c] -mt-2';
    globalTooltipArrow.style.top = '0';
    globalTooltipArrow.style.bottom = '';
  } else {
    top = rect.top - tooltipHeight - 8;
    globalTooltipArrow.className = 'absolute border-4 border-transparent border-t-[#17171c] -mb-2';
    globalTooltipArrow.style.bottom = '0';
    globalTooltipArrow.style.top = '';
  }

  // Align arrow with center of target
  const arrowOffset = Math.max(16, Math.min(tooltipWidth - 16, targetCenterX - left));
  globalTooltipArrow.style.left = `${arrowOffset}px`;
  globalTooltipArrow.style.transform = 'translateX(-50%)';

  globalTooltip.style.top = `${top}px`;
  globalTooltip.style.left = `${left}px`;

  // Animate in
  requestAnimationFrame(() => {
    if (globalTooltip) {
      globalTooltip.classList.remove('opacity-0');
      globalTooltip.classList.add('opacity-100');
    }
  });
}

function hideNovedadTooltip() {
  if (!globalTooltip) return;
  globalTooltip.classList.remove('opacity-100');
  globalTooltip.classList.add('opacity-0');
  setTimeout(() => {
    if (globalTooltip && globalTooltip.classList.contains('opacity-0')) {
      globalTooltip.classList.add('hidden');
    }
  }, 150);
}

export function renderLeadRow(lead, isSelected, { onSelectChange, onRowClick }) {
  const row = document.createElement('tr');
  row.className = 'border-b border-[#e5e7eb] hover:bg-neutral-50/50 transition-colors font-sans text-xs text-neutral-700 cursor-pointer select-none';

  const pipelineMode = localStorage.getItem('crm_active_pipeline_mode') || 'comercial';
  const activeStageId = pipelineMode === 'franquiday' 
    ? (cache.getMostRecentFranquidayStageId(lead.id) || lead.franquiday_stage_id || cache.getStages()[0]?.id) 
    : lead.pipeline_stage_id;
  
  const stage = cache.getStage(activeStageId);
  const profile = cache.getProfile(lead.assigned_to);
  const primaryContact = lead.primary_contact_id ? cache.getContact(lead.primary_contact_id) : null;

  // Resolve values from primary contact
  const fullName = primaryContact ? `${primaryContact.first_name || ''} ${primaryContact.last_name || ''}`.trim() : '—';
  const email = primaryContact ? primaryContact.email : '—';
  const phone = primaryContact ? primaryContact.phone : '—';
  // Calculate days without contact
  const dateBase = lead.fecha_ultimo_contacto ? new Date(lead.fecha_ultimo_contacto) : new Date(lead.created_at);
  const now = new Date();
  dateBase.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = Math.max(0, now - dateBase);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let dotClass = 'bg-rose-500 animate-pulse'; // Default/Critical (>=14 days)
  let trafficStatus = 'Crítico';
  if (diffDays < 7) {
    dotClass = 'bg-emerald-500';
    trafficStatus = 'Al día';
  } else if (diffDays < 14) {
    dotClass = 'bg-amber-500';
    trafficStatus = 'Atención';
  }

  const company = lead.company || '—';
  const country = lead.country || '—';

  const stageColor = stage?.color || '#94a3b8';
  const stageName = stage?.name || 'Sin Gestión';

  const assignedName = profile?.full_name || 'Sin Asignar';

  const stages = cache.getStages() || [];
  const optionsHtml = stages.map(s => `
    <option value="${s.id}" ${s.id === activeStageId ? 'selected' : ''} style="background-color: #1e1e1e; color: white;">
      ${s.name.toUpperCase()}
    </option>
  `).join('');

  const selectStageHtml = `
    <select 
      data-lead-stage-select-id="${lead.id}" 
      class="bg-transparent text-white text-[9px] font-mono font-bold uppercase tracking-wider rounded-full px-2.5 py-1 focus:outline-none cursor-pointer border-none shadow-xs text-center appearance-none" 
      style="background-color: ${stageColor};"
    >
      ${optionsHtml}
    </select>
  `;

  // Resolve latest interaction / novedad
  const latestInt = cache.getLeadLatestInteraction(lead.id);
  let novedadHtml = `<span class="text-neutral-300 font-sans select-none">—</span>`;

  let tooltipData = null;

  if (latestInt) {
    const isIncoming = latestInt.direction === 'inbound';
    
    // Icon and channel label
    const type = latestInt.contact_type || 'otro';
    let typeIcon = 'ℹ️';
    let typeLabel = 'Otro';
    if (type === 'whatsapp') { typeIcon = '🟢'; typeLabel = 'WhatsApp'; }
    else if (type === 'email') { typeIcon = '✉️'; typeLabel = 'Email'; }
    else if (type === 'telefono') { typeIcon = '📞'; typeLabel = 'Llamada'; }
    else if (type === 'meet') { typeIcon = '💻'; typeLabel = 'Meet'; }
    else if (type === 'linkedin') { typeIcon = '🔗'; typeLabel = 'LinkedIn'; }

    // Author
    let authorName = 'Comercial';
    if (isIncoming) {
      authorName = 'Cliente';
    } else {
      const authorProfile = cache.getProfile(latestInt.created_by);
      authorName = authorProfile?.full_name || 'Comercial';
    }

    const contactedDate = latestInt.contacted_at || latestInt.created_at;
    const isRecent = contactedDate && (Date.now() - new Date(contactedDate).getTime() < 24 * 60 * 60 * 1000);

    const dirBadge = isIncoming
      ? `<span class="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded-xs uppercase tracking-wider">Entrante</span>`
      : `<span class="text-[8px] font-mono font-bold text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded-xs uppercase tracking-wider">Saliente</span>`;

    const bodySnippet = latestInt.body ? `<p class="text-[10px] text-neutral-400 line-clamp-2 leading-relaxed border-t border-neutral-800 pt-1.5 mt-1.5 font-sans">${latestInt.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '';

    tooltipData = {
      typeIcon,
      typeLabel,
      dirBadge,
      subject: (latestInt.subject || 'Sin asunto').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      authorName,
      contactedDate,
      bodySnippet
    };

    novedadHtml = `
      <div class="novedad-chip inline-flex items-center gap-1.5 py-0.5 px-2 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-400 border border-[#d9d9dd] rounded-full transition-all cursor-pointer select-none" onclick="event.stopPropagation();">
        <span class="text-[11px] shrink-0">${typeIcon}</span>
        <span class="font-mono text-[9px] font-bold uppercase tracking-wider ${isIncoming ? 'text-emerald-700' : 'text-blue-700'}">
          ${isIncoming ? 'Entrante' : 'Saliente'}
        </span>
        ${isRecent ? `
          <span class="relative flex h-2 w-2 ml-0.5" title="Nueva en las últimas 24h">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        ` : ''}
      </div>
    `;
  }

  row.innerHTML = `
    <!-- Checkbox selection -->
    <td class="px-4 py-3 shrink-0 text-center" onclick="event.stopPropagation();">
      <input 
        type="checkbox" 
        class="row-checkbox rounded-xs border-neutral-300 text-primary focus:ring-primary h-3.5 w-3.5" 
        ${isSelected ? 'checked' : ''} 
      />
    </td>
    
    <!-- Lead Details -->
    <td class="px-6 py-3.5 max-w-[170px] font-semibold" title="${company}">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="truncate">${company}</span>
        ${lead.nombre_validado ? `<span class="inline-flex items-center shrink-0 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-sm text-[8px] uppercase tracking-wider font-bold" title="Nombre validado">✓</span>` : ''}
      </div>
    </td>
    <td class="px-6 py-3.5 font-semibold text-primary font-display max-w-[180px] truncate" title="${fullName}">
      ${fullName}
    </td>
    <td class="px-6 py-3.5 font-mono text-[10px] tracking-wider text-muted-slate uppercase">
      ${country}
    </td>
    <td class="px-6 py-3.5 truncate max-w-[180px]" title="${email}">
      ${email}
    </td>
    <td class="px-6 py-3.5 font-mono text-[10px] whitespace-nowrap">
      <div class="flex items-center gap-1">
        <span>${phone}</span>
        ${primaryContact && primaryContact.telefono_validado && phone !== '—'
          ? `<span class="inline-flex items-center px-1 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-sm text-[7px] uppercase tracking-wider font-bold" title="Teléfono verificado">✓</span>`
          : ''
        }
      </div>
    </td>
    <td class="px-6 py-3.5" onclick="event.stopPropagation();">
      ${selectStageHtml}
    </td>
    <td class="px-6 py-3.5 font-semibold text-primary truncate max-w-[120px]" title="${assignedName}">
      ${assignedName}
    </td>
    <td class="px-6 py-3.5 font-mono text-[10px] whitespace-nowrap">
      <div class="flex items-center gap-2" title="Inactividad: ${diffDays} días (${trafficStatus})">
        <span class="w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}"></span>
        <span>${lead.fecha_ultimo_contacto ? formatDate(lead.fecha_ultimo_contacto) : 'Sin gestión'}</span>
      </div>
    </td>
    <td class="px-6 py-3.5 whitespace-nowrap">
      ${novedadHtml}
    </td>
    <td class="px-6 py-3.5 max-w-[160px] truncate">
      ${lead.ultimo_comentario 
        ? `<div class="flex items-center gap-1.5" title="${lead.ultimo_comentario.replace(/"/g, '&quot;')}">
             <span class="text-xs shrink-0 select-none">💬</span>
             <span class="truncate text-[10px] text-neutral-500 font-sans">${lead.ultimo_comentario}</span>
           </div>`
        : `<span class="text-neutral-300 font-sans select-none">—</span>`
      }
    </td>
    <td class="px-6 py-3.5 text-coral font-mono text-[10px] tracking-widest whitespace-nowrap">
      ${lead.valoracion || '—'}
    </td>
  `;

  // Attach event handlers
  const checkbox = row.querySelector('.row-checkbox');
  checkbox.addEventListener('change', (e) => {
    onSelectChange(lead.id, e.target.checked);
  });

  const novedadChip = row.querySelector('.novedad-chip');
  if (novedadChip && tooltipData) {
    novedadChip.addEventListener('mouseenter', () => {
      showNovedadTooltip(novedadChip, tooltipData);
    });
    novedadChip.addEventListener('mouseleave', () => {
      hideNovedadTooltip();
    });
  }

  row.addEventListener('click', () => {
    hideNovedadTooltip();
    onRowClick(lead.id);
  });

  return row;
}
