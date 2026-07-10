export function downloadCSVTemplate() {
  const headers = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'company',
    'position',
    'linkedin_url',
    'medio_contacto'
  ];

  // Example row for user guidance
  const exampleRow = [
    'Juan',
    'Pérez',
    'juan.perez@grido.com.ar',
    '+5491199998888',
    'Grido',
    'Director',
    'https://linkedin.com/in/juanperez',
    'WhatsApp'
  ];

  const csvContent = [
    headers.join(';'),
    exampleRow.map(val => `"${val.replace(/"/g, '""')}"`).join(';')
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'plantilla_contactos_crm.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

