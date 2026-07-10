import { cache } from '../lib/cache';
import { formatDate } from './date-format';

export function exportLeadsToCSV(leadsList) {
  if (!leadsList || leadsList.length === 0) return;

  const headers = [
    'Nombre',
    'Apellido',
    'Empresa',
    'Cargo',
    'LinkedIn',
    'País',
    'Email',
    'Teléfono',
    'Origen',
    'Detalle Origen',
    'Etapa',
    'Comercial Asignado',
    'Valoración',
    'Medio Contacto',
    'Última Gestión',
    'Fecha Carga',
    'Motivo Descarte',
    'Notas'
  ];

  const stages = cache.getStages();
  const profiles = cache.getProfiles();

  const rows = leadsList.map(lead => {
    const stage = stages.find(s => s.id === lead.pipeline_stage_id);
    const profile = profiles.find(p => p.id === lead.assigned_to);

    return [
      lead.first_name || '',
      lead.last_name || '',
      lead.company || '',
      lead.position || '',
      lead.linkedin_url || '',
      lead.country || '',
      lead.email || '',
      lead.phone || '',
      lead.source || '',
      lead.source_detail || '',
      stage ? stage.name : 'Sin Gestión',
      profile ? profile.full_name : 'Sin Asignar',
      lead.valoracion || '',
      lead.medio_contacto || '',
      formatDate(lead.fecha_ultimo_contacto),
      formatDate(lead.fecha_carga),
      lead.motivo_descarte || '',
      (lead.notes || '').replace(/[\r\n]+/g, ' ') // Clean newlines for CSV single line safety
    ];
  });

  // Convert array to CSV string with Semicolon delimiter for Excel Spanish locale support
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(val => {
      // Escape quotes and wrap with double quotes if field contains quotes or semicolons
      let cleaned = String(val).replace(/"/g, '""');
      if (cleaned.includes(';') || cleaned.includes('"') || cleaned.includes('\n')) {
        cleaned = `"${cleaned}"`;
      }
      return cleaned;
    }).join(';'))
  ].join('\r\n');

  // Add UTF-8 BOM prefix for Spanish Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `leads_negozona_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
