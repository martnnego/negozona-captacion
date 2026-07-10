export function downloadCSVTemplate() {
  const headers = [
    'first_name',
    'last_name',
    'company',
    'position',
    'linkedin_url',
    'country',
    'email',
    'phone',
    'source',
    'source_detail',
    'status',
    'industry',
    'investment',
    'branches',
    'assigned_to',
    'valoracion',
    'medio_contacto',
    'notes'
  ];

  // Example row for user guidance
  const exampleRow = [
    'Juan',
    'Pérez',
    'Grido',
    'Director',
    'https://linkedin.com/in/juanperez',
    'Argentina',
    'juan.perez@grido.com.ar',
    '+5491199998888',
    'manual',
    'Campaña Franquicias',
    'Sin Gestión',
    'Heladerías',
    '50000 USD',
    '15',
    'Camila Bastard',
    '★★★★',
    'WhatsApp',
    'Interesado en expandir locales en Buenos Aires.'
  ];

  const csvContent = [
    headers.join(';'),
    exampleRow.map(val => `"${val.replace(/"/g, '""')}"`).join(';')
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'plantilla_leads_negozona.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
