import { cache } from '../lib/cache';
import { formatDate } from '../utils/date-format';

export function renderLeadRow(lead, isSelected, { onSelectChange, onRowClick }) {
  const row = document.createElement('tr');
  row.className = 'border-b border-[#e5e7eb] hover:bg-neutral-50/50 transition-colors font-sans text-xs text-neutral-700 cursor-pointer select-none';

  const stage = cache.getStage(lead.pipeline_stage_id);
  const profile = cache.getProfile(lead.assigned_to);

  // Capitalize name
  const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Sin Nombre';
  const company = lead.company || '—';
  const country = lead.country || '—';
  const email = lead.email || '—';
  const phone = lead.phone || '—';

  const stageColor = stage?.color || '#94a3b8';
  const stageName = stage?.name || 'Sin Gestión';

  const assignedName = profile?.full_name || 'Sin Asignar';

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
    <td class="px-6 py-3.5 font-semibold text-primary font-display max-w-[180px] truncate" title="${fullName}">
      ${fullName}
    </td>
    <td class="px-6 py-3.5 max-w-[150px] truncate" title="${company}">
      ${company}
    </td>
    <td class="px-6 py-3.5 font-mono text-[10px] tracking-wider text-muted-slate uppercase">
      ${country}
    </td>
    <td class="px-6 py-3.5 truncate max-w-[180px]" title="${email}">
      ${email}
    </td>
    <td class="px-6 py-3.5 font-mono text-[10px] whitespace-nowrap">
      ${phone}
    </td>
    <td class="px-6 py-3.5" onclick="event.stopPropagation();">
      <!-- Stage Badge Dropdown or simple visual label -->
      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white" style="background-color: ${stageColor}">
        ${stageName}
      </span>
    </td>
    <td class="px-6 py-3.5 font-semibold text-primary truncate max-w-[120px]" title="${assignedName}">
      ${assignedName}
    </td>
    <td class="px-6 py-3.5 font-mono text-[10px] whitespace-nowrap">
      ${formatDate(lead.fecha_ultimo_contacto)}
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

  row.addEventListener('click', () => {
    onRowClick(lead.id);
  });

  return row;
}
