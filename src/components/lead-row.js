import { cache } from '../lib/cache';
import { formatDate } from '../utils/date-format';

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
  const lastContactDate = primaryContact ? primaryContact.fecha_ultimo_contacto : null;

  const company = lead.company || '—';
  const country = lead.country || '—';

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
    <td class="px-6 py-3.5 max-w-[150px] truncate font-semibold" title="${company}">
      ${company}
      ${lead.nombre_validado ? `<span class="inline-flex items-center ml-1 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-sm text-[8px] uppercase tracking-wider font-bold">✓</span>` : ''}
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
      ${formatDate(lastContactDate)}
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
