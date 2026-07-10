import { cache } from '../lib/cache';
import { formatDate } from './date-format';

export function exportContactsToCSV(contactsList) {
  if (!contactsList || contactsList.length === 0) return;

  const headers = [
    'Nombre',
    'Apellido',
    'Email',
    'Teléfono',
    'Cargo',
    'LinkedIn',
    'Medio Contacto',
    'Última Gestión',
    'Fecha Carga',
    'Empresas',
    'Estado'
  ];

  const rows = contactsList.map(contact => {
    // Get companies linked to this contact
    const linkedLeads = cache.getContactLeads(contact.id) || [];
    const companiesStr = linkedLeads.map(l => l.company || 'Sin Empresa').join(', ');

    return [
      contact.first_name || '',
      contact.last_name || '',
      contact.email || '',
      contact.phone || '',
      contact.position || '',
      contact.linkedin_url || '',
      contact.medio_contacto || '',
      formatDate(contact.fecha_ultimo_contacto),
      formatDate(contact.fecha_carga),
      companiesStr,
      contact.is_active ? 'Activo' : 'Inactivo'
    ];
  });

  // Convert array to CSV string with Semicolon delimiter
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(val => {
      let cleaned = String(val).replace(/"/g, '""');
      if (cleaned.includes(';') || cleaned.includes('"') || cleaned.includes('\n')) {
        cleaned = `"${cleaned}"`;
      }
      return cleaned;
    }).join(';'))
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `contactos_crm_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

