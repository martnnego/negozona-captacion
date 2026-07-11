import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { renderLeadDetail } from './lead-detail';
import { formatDate } from '../utils/date-format';
import { toast } from '../components/toast';
import { modal } from '../components/modal';
import { parseCSV } from '../utils/csv-parser';
import { exportContactsToCSV } from '../utils/csv-export';
import { downloadCSVTemplate } from '../utils/csv-template';
import { checkDuplicateEmails } from '../utils/duplicate-checker';
import { openContactEditModal } from '../components/contact-edit-modal';

export function renderLeadsByCompany(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none';

  // State
  let activeTab = localStorage.getItem('contacts_active_tab') || 'grouped'; // 'grouped' | 'list'
  let contacts = [];
  let leads = [];
  let searchQuery = '';
  let collapsedCompanies = new Set();
  let currentPage = 1;
  let rowsPerPage = 10;

  container.innerHTML = `
    <!-- Header Title -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6 shrink-0">
      <div>
        <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Directorio de Contactos</h2>
        <p class="text-xs text-muted-slate mt-1 font-sans">Administración de personas y sus vínculos con marcas/empresas.</p>
      </div>

      <!-- Actions Panel -->
      <div class="flex items-center gap-3 select-none">
        <button id="import-contacts-btn" class="px-4 py-2 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none">
          📥 Importar CSV
        </button>
        <button id="export-contacts-btn" class="px-4 py-2 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all tracking-wider focus:outline-none">
          📤 Exportar CSV
        </button>
      </div>
    </div>

    <!-- Tabs + Search Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <!-- Tabs Selector -->
      <div class="flex border-b border-[#e5e7eb] w-fit font-mono text-[9px] font-bold tracking-wider uppercase">
        <button id="tab-grouped-btn" class="px-5 py-2.5 border-b-2 transition-all focus:outline-none ${
          activeTab === 'grouped'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-slate hover:text-primary'
        }">
          Agrupados por Empresa
        </button>
        <button id="tab-list-btn" class="px-5 py-2.5 border-b-2 transition-all focus:outline-none ${
          activeTab === 'list'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-slate hover:text-primary'
        }">
          Listado de Contactos
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative min-w-[240px] max-w-xs">
        <input 
          type="text" 
          id="contacts-search-input" 
          placeholder="BUSCAR CONTACTO O EMPRESA..." 
          class="w-full bg-white border border-[#d9d9dd] rounded-sm py-2 pl-3 pr-8 font-sans text-xs text-primary placeholder:text-neutral-400 focus:outline-none focus:border-form-focus transition-colors uppercase tracking-wider font-semibold"
        />
        <span class="absolute right-3 top-2.5 text-neutral-400 text-xs">🔍</span>
      </div>
    </div>

    <!-- Main Content Area -->
    <div id="contacts-content-area" class="flex flex-col gap-4">
      <!-- Dynamic Content Rendered Here -->
    </div>
  `;

  const contentArea = container.querySelector('#contacts-content-area');
  const searchInput = container.querySelector('#contacts-search-input');
  
  // Tab Elements
  const tabGroupedBtn = container.querySelector('#tab-grouped-btn');
  const tabListBtn = container.querySelector('#tab-list-btn');

  // Tab Events
  tabGroupedBtn.addEventListener('click', () => {
    activeTab = 'grouped';
    localStorage.setItem('contacts_active_tab', 'grouped');
    updateTabUI();
    renderContent();
  });

  tabListBtn.addEventListener('click', () => {
    activeTab = 'list';
    localStorage.setItem('contacts_active_tab', 'list');
    updateTabUI();
    renderContent();
  });

  function updateTabUI() {
    [tabGroupedBtn, tabListBtn].forEach(btn => {
      btn.classList.remove('border-primary', 'text-primary');
      btn.classList.add('border-transparent', 'text-muted-slate');
    });
    if (activeTab === 'grouped') {
      tabGroupedBtn.classList.add('border-primary', 'text-primary');
      tabGroupedBtn.classList.remove('border-transparent', 'text-muted-slate');
    } else {
      tabListBtn.classList.add('border-primary', 'text-primary');
      tabListBtn.classList.remove('border-transparent', 'text-muted-slate');
    }
  }

  // Debounced search
  let debounceTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      searchQuery = searchInput.value.trim().toLowerCase();
      currentPage = 1; // Reset to page 1 on new search
      renderContent();
    }, 200);
  });

  // Load Data
  loadData();

  function loadData() {
    try {
      contacts = cache.getContacts() || [];
      leads = cache.getLeads() || [];
      renderContent();
    } catch (err) {
      toast.show('Error al cargar contactos: ' + err.message, 'error');
    }
  }

  // Subscribe to cache
  const unsubscribeCache = cache.subscribe(() => {
    contacts = cache.getContacts() || [];
    leads = cache.getLeads() || [];
    renderContent();
  });

  container.cleanup = () => {
    unsubscribeCache();
  };

  // Render main content based on tab
  function renderContent() {
    contentArea.innerHTML = '';
    if (activeTab === 'grouped') {
      renderGroupedView();
    } else {
      renderListView();
    }
  }

  // View 1: Grouped by Company accordion
  function renderGroupedView() {
    // Group contacts by company
    const groups = {};
    
    // Add all active leads as empty groups first so companies show even if they have no contacts
    leads.forEach(l => {
      groups[l.company || 'Sin Empresa'] = { lead: l, contactsList: [] };
    });
    
    // Group
    contacts.forEach(c => {
      const linkedLeads = cache.getContactLeads(c.id);
      if (linkedLeads.length > 0) {
        linkedLeads.forEach(l => {
          const groupName = l.company || 'Sin Empresa';
          if (!groups[groupName]) {
            groups[groupName] = { lead: l, contactsList: [] };
          }
          groups[groupName].contactsList.push(c);
        });
      } else {
        // Group under "Sin empresa" generic group
        const noCompanyGroupName = 'Sin empresa';
        if (!groups[noCompanyGroupName]) {
          const genericLead = leads.find(l => l.id === '00000000-0000-0000-0000-000000000000') || { id: '00000000-0000-0000-0000-000000000000', company: 'Sin empresa' };
          groups[noCompanyGroupName] = { lead: genericLead, contactsList: [] };
        }
        groups[noCompanyGroupName].contactsList.push(c);
      }
    });

    let companyNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    
    // Apply search filter (checks contact name/email/phone or company name)
    if (searchQuery) {
      companyNames = companyNames.filter(name => {
        const matchesCompany = name.toLowerCase().includes(searchQuery);
        const matchesContact = groups[name].contactsList.some(c => 
          `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(searchQuery) ||
          (c.email || '').toLowerCase().includes(searchQuery) ||
          (c.phone || '').toLowerCase().includes(searchQuery)
        );
        return matchesCompany || matchesContact;
      });
    }

    if (companyNames.length === 0) {
      contentArea.innerHTML = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No se encontraron contactos agrupados con el filtro especificado.
        </div>
      `;
      return;
    }

    companyNames.forEach(name => {
      const { lead, contactsList } = groups[name];
      const isCollapsed = collapsedCompanies.has(name);

      const accordion = document.createElement('div');
      accordion.className = 'bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col transition-all duration-150';
      
      // Accordion Header
      accordion.innerHTML = `
        <div class="accordion-header px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-50/50 select-none border-b ${
          isCollapsed ? 'border-transparent' : 'border-neutral-100'
        }">
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono text-[#616161]">${isCollapsed ? '▶' : '▼'}</span>
            <span class="text-sm font-semibold text-primary font-display">${name}</span>
            ${lead.nombre_validado ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Validado</span>` : ''}
            <span class="font-mono text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">${contactsList.length} ${
              contactsList.length === 1 ? 'contacto' : 'contactos'
            }</span>
          </div>
          ${lead.id && lead.id !== '00000000-0000-0000-0000-000000000000' ? `
            <button class="view-lead-btn font-mono text-[9px] font-bold tracking-wider uppercase border border-[#d9d9dd] hover:border-primary hover:text-primary bg-white px-3 py-1 rounded-full transition-all focus:outline-none">
              Ver Empresa ➔
            </button>
          ` : ''}
        </div>
        
        <!-- Accordion Body -->
        <div class="overflow-x-auto ${isCollapsed ? 'hidden' : ''}">
          <table class="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr class="bg-neutral-50/60 border-b border-[#e5e7eb] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
                <th class="px-6 py-2.5">Nombre</th>
                <th class="px-6 py-2.5">Email</th>
                <th class="px-6 py-2.5">Teléfono</th>
                <th class="px-6 py-2.5">Cargo</th>
                <th class="px-6 py-2.5">LinkedIn</th>
                <th class="px-6 py-2.5">Estado</th>
                <th class="px-6 py-2.5">Medio Contacto</th>
                <th class="px-6 py-2.5">Principal</th>
                <th class="px-6 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100 text-neutral-700">
              ${contactsList.length === 0 ? `
                <tr>
                  <td colspan="9" class="px-6 py-4 text-center text-neutral-400 italic">No hay contactos vinculados a esta marca.</td>
                </tr>
              ` : contactsList.map(c => {
                const isPrimary = lead.primary_contact_id === c.id;
                return `
                  <tr class="hover:bg-neutral-50/30 transition-colors">
                    <td class="px-6 py-3 font-semibold text-primary font-display">${c.first_name || ''} ${c.last_name || ''}</td>
                    <td class="px-6 py-3">${c.email || '—'}</td>
                    <td class="px-6 py-3 font-mono text-[10px]">${c.phone || '—'}</td>
                    <td class="px-6 py-3">${c.position || '—'}</td>
                    <td class="px-6 py-3">
                      ${c.linkedin_url ? `<a href="${c.linkedin_url}" target="_blank" class="text-action-blue hover:underline">LinkedIn ➔</a>` : '—'}
                    </td>
                    <td class="px-6 py-3 select-none">
                      <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                        c.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }">
                        ${c.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td class="px-6 py-3 font-mono text-[10px] uppercase text-muted-slate">${c.medio_contacto || '—'}</td>
                    <td class="px-6 py-3 font-semibold ${isPrimary ? 'text-emerald-600' : 'text-neutral-300'}">${isPrimary ? '★ Principal' : '—'}</td>
                    <td class="px-6 py-3">
                      <button data-edit-contact-id="${c.id}" class="p-1 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-50 transition-colors focus:outline-none text-[12px]" title="Editar contacto">
                        ✏️
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Header click collapse
      const header = accordion.querySelector('.accordion-header');
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-lead-btn')) return;
        if (collapsedCompanies.has(name)) {
          collapsedCompanies.delete(name);
        } else {
          collapsedCompanies.add(name);
        }
        renderContent();
      });

      // View lead button click
      const viewLeadBtn = accordion.querySelector('.view-lead-btn');
      if (viewLeadBtn) {
        viewLeadBtn.addEventListener('click', () => {
          renderLeadDetail(lead.id, () => {
            loadData();
          });
        });
      }

      // Edit contact click
      accordion.querySelectorAll('[data-edit-contact-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const contactId = btn.dataset.editContactId;
          openContactEditModal(contactId, () => {
            loadData();
          });
        });
      });

      contentArea.appendChild(accordion);
    });
  }

  // View 2: Flat Contacts Table
  function renderListView() {
    let filteredContacts = [...contacts];

    // Search Query filter
    if (searchQuery) {
      filteredContacts = filteredContacts.filter(c => {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        const matchesContact = fullName.includes(searchQuery) ||
          (c.email || '').toLowerCase().includes(searchQuery) ||
          (c.phone || '').toLowerCase().includes(searchQuery);

        const linkedLeads = cache.getContactLeads(c.id);
        const matchesCompany = linkedLeads.some(l => (l.company || '').toLowerCase().includes(searchQuery));

        return matchesContact || matchesCompany;
      });
    }

    // Default sorting helper: Sort by the first linked company's name alphabetically
    function getFirstCompanyName(contactId) {
      const linkedLeads = cache.getContactLeads(contactId);
      if (linkedLeads.length > 0) {
        return linkedLeads[0].company || 'Sin Empresa';
      }
      return 'Sin empresa';
    }

    filteredContacts.sort((a, b) => {
      const companyA = getFirstCompanyName(a.id).toLowerCase();
      const companyB = getFirstCompanyName(b.id).toLowerCase();
      return companyA.localeCompare(companyB);
    });

    if (filteredContacts.length === 0) {
      contentArea.innerHTML = `
        <div class="py-12 text-center text-xs text-neutral-400 font-sans border border-dashed border-[#d9d9dd] rounded-sm bg-neutral-50/50">
          No se encontraron contactos en la base de datos con los criterios de búsqueda.
        </div>
      `;
      return;
    }

    // Pagination calculations
    const totalRows = filteredContacts.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    
    // Adjust currentPage if it overflows after search
    if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col';
    tableWrapper.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
              <th class="px-6 py-3">Nombre</th>
              <th class="px-6 py-3">Email</th>
              <th class="px-6 py-3">Teléfono</th>
              <th class="px-6 py-3">Empresas</th>
              <th class="px-6 py-3">Cargo</th>
              <th class="px-6 py-3">Medio</th>
              <th class="px-6 py-3">Estado</th>
              <th class="px-6 py-3">Última Gestión</th>
              <th class="px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#e5e7eb] text-neutral-700">
            ${paginatedContacts.map(c => {
              const linkedLeads = cache.getContactLeads(c.id);
              const companiesStr = linkedLeads.length > 0 
                ? linkedLeads.map(l => l.company || 'Sin Empresa').join(', ') 
                : 'Sin empresa';

              return `
                <tr class="hover:bg-neutral-50/50 transition-colors">
                  <td class="px-6 py-3.5 font-semibold text-primary font-display">${c.first_name || ''} ${c.last_name || ''}</td>
                  <td class="px-6 py-3.5">${c.email || '—'}</td>
                  <td class="px-6 py-3.5 font-mono text-[10px]">${c.phone || '—'}</td>
                  <td class="px-6 py-3.5 font-semibold text-primary font-sans">${companiesStr}</td>
                  <td class="px-6 py-3.5 text-muted-slate">${c.position || '—'}</td>
                  <td class="px-6 py-3.5 font-mono text-[10px] uppercase text-muted-slate">${c.medio_contacto || '—'}</td>
                  <td class="px-6 py-3.5 select-none">
                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                      c.is_active 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }">
                      ${c.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td class="px-6 py-3.5 font-mono text-[10px]">${formatDate(c.fecha_ultimo_contacto)}</td>
                  <td class="px-6 py-3.5">
                    <button data-edit-contact-id="${c.id}" class="p-1 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-50 transition-colors focus:outline-none text-[12px]" title="Editar contacto">
                      ✏️
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="px-6 py-4 border-t border-[#e5e7eb] bg-neutral-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs select-none">
        <div class="flex items-center gap-2">
          <span class="text-neutral-500">Filas por página:</span>
          <select id="contacts-rows-per-page" class="bg-white border border-[#d9d9dd] rounded-sm py-1 px-1.5 font-mono text-[10px] font-bold text-primary focus:outline-none transition-colors">
            ${[10, 25, 50].map(v => `<option value="${v}" ${rowsPerPage === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <span class="text-neutral-400 ml-4 font-mono text-[10px]">
            Mostrando ${totalRows === 0 ? 0 : startIndex + 1} a ${endIndex} de ${totalRows} contactos
          </span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button id="contacts-prev-page" class="px-3 py-1.5 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all disabled:opacity-30 disabled:pointer-events-none focus:outline-none" ${currentPage === 1 ? 'disabled' : ''}>
            ANTERIOR
          </button>
          
          <div class="flex items-center gap-1">
            ${Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              if (totalPages > 5 && Math.abs(currentPage - pageNum) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                if (pageNum === 2 || pageNum === totalPages - 1) {
                  return '<span class="text-neutral-400 px-1 font-mono">...</span>';
                }
                return '';
              }
              return `
                <button data-page="${pageNum}" class="contacts-page-btn w-6 h-6 rounded-full font-mono text-[10px] font-bold transition-all ${
                  currentPage === pageNum 
                    ? 'bg-primary text-white' 
                    : 'text-[#616161] hover:bg-neutral-100'
                }">${pageNum}</button>
              `;
            }).join('')}
          </div>

          <button id="contacts-next-page" class="px-3 py-1.5 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all disabled:opacity-30 disabled:pointer-events-none focus:outline-none" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>
            SIGUIENTE
          </button>
        </div>
      </div>
    `;

    // Row edit contact click
    tableWrapper.querySelectorAll('[data-edit-contact-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const contactId = btn.dataset.editContactId;
        openContactEditModal(contactId, () => {
          loadData();
        });
      });
    });

    // Rows per page change listener
    tableWrapper.querySelector('#contacts-rows-per-page').addEventListener('change', (e) => {
      rowsPerPage = parseInt(e.target.value);
      currentPage = 1;
      renderContent();
    });

    // Prev page button
    tableWrapper.querySelector('#contacts-prev-page').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderContent();
      }
    });

    // Next page button
    tableWrapper.querySelector('#contacts-next-page').addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderContent();
      }
    });

    // Page buttons
    tableWrapper.querySelectorAll('.contacts-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        renderContent();
      });
    });

    contentArea.appendChild(tableWrapper);
  }

  // --- ACTIONS ---

  // Export Contacts Click Handler
  container.querySelector('#export-contacts-btn').addEventListener('click', () => {
    try {
      exportContactsToCSV(contacts);
      toast.show('¡Exportación de contactos completada!', 'success');
    } catch (err) {
      toast.show('Error al exportar contactos: ' + err.message, 'error');
    }
  });

  // Import Contacts Click Handler
  container.querySelector('#import-contacts-btn').addEventListener('click', () => {
    let parsedRows = [];
    let fileHeaders = [];
    let selectedFile = null;

    const form = document.createElement('div');
    form.className = 'flex flex-col gap-4 font-sans text-xs select-none';
    form.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-neutral-500 font-medium">Sube tu archivo para añadir contactos masivamente.</span>
        <button id="download-template-btn" type="button" class="text-action-blue hover:underline font-mono text-[9px] font-bold uppercase tracking-wider">
          ➔ Descargar Plantilla CSV
        </button>
      </div>

      <!-- Drag & Drop Zone -->
      <div id="drag-drop-zone" class="border-2 border-dashed border-neutral-300 rounded-sm p-8 text-center bg-neutral-50/50 hover:bg-neutral-50 hover:border-primary transition-all cursor-pointer">
        <span class="text-2xl block mb-1">📄</span>
        <span class="font-sans text-[11px] font-bold text-primary block" id="upload-status-text">
          ARRASTRA TU ARCHIVO CSV AQUÍ O HAZ CLIC PARA SELECCIONAR
        </span>
        <input type="file" id="csv-file-input" class="hidden" accept=".csv" />
      </div>

      <!-- Duplicates Selector -->
      <div class="flex flex-col gap-1">
        <label for="dup-behavior" class="font-mono text-[9px] font-bold text-primary uppercase">Detección de Duplicados (por email)</label>
        <select id="dup-behavior" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-2 px-3">
          <option value="skip">Omitir duplicados (mantener datos existentes en CRM)</option>
          <option value="update">Actualizar datos de contactos existentes (preservar relaciones)</option>
        </select>
      </div>

      <!-- Preview Panel -->
      <div id="import-preview-section" class="hidden border-t border-neutral-100 pt-4">
        <h4 class="font-mono text-[9px] font-bold text-primary uppercase mb-2" id="preview-title-text">Previsualización (Primeras filas)</h4>
        <div class="overflow-x-auto max-h-40 border border-[#d9d9dd] rounded-sm">
          <table class="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[8px] font-bold text-muted-slate uppercase" id="preview-thead">
              </tr>
            </thead>
            <tbody id="preview-tbody" class="divide-y divide-neutral-100 text-neutral-600">
            </tbody>
          </table>
        </div>
      </div>

      <!-- Progress Panel -->
      <div id="import-progress-section" class="hidden border-t border-neutral-100 pt-4 flex flex-col gap-2">
        <div class="flex items-center justify-between font-semibold">
          <span id="import-progress-text" class="text-neutral-500">Importando registros...</span>
          <span id="import-progress-percent" class="font-mono text-primary text-[10px]">0%</span>
        </div>
        <div class="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200">
          <div id="import-progress-bar" class="bg-primary h-full w-0 transition-all duration-100"></div>
        </div>
      </div>
    `;

    const dropZone = form.querySelector('#drag-drop-zone');
    const fileInput = form.querySelector('#csv-file-input');
    const uploadStatus = form.querySelector('#upload-status-text');
    const previewSection = form.querySelector('#import-preview-section');
    const previewThead = form.querySelector('#preview-thead');
    const previewTbody = form.querySelector('#preview-tbody');
    const previewTitle = form.querySelector('#preview-title-text');
    const dupBehavior = form.querySelector('#dup-behavior');

    // Template download
    form.querySelector('#download-template-btn').addEventListener('click', () => {
      downloadCSVTemplate();
    });

    dropZone.addEventListener('click', () => fileInput.click());

    // Drag drop handlers
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-neutral-50');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-primary', 'bg-neutral-50');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-neutral-50');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
      }
    });

    function handleFileSelect(file) {
      selectedFile = file;
      uploadStatus.innerHTML = `ARCHIVO SELECCIONADO: <b class="text-action-blue">${file.name}</b> (${Math.round(file.size / 1024)} KB)`;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const allLines = parseCSV(text);
        
        if (allLines.length < 2) {
          toast.show('El archivo CSV está vacío o le faltan registros', 'error');
          return;
        }

        fileHeaders = allLines[0];
        parsedRows = allLines.slice(1);

        renderPreview();
      };
      reader.readAsText(file, 'UTF-8');
    }

    function renderPreview() {
      previewThead.innerHTML = fileHeaders.map(h => `<th class="px-4 py-2">${h}</th>`).join('');
      
      const firstRows = parsedRows.slice(0, 5);
      previewTbody.innerHTML = firstRows.map(row => `
        <tr class="hover:bg-neutral-50/50">
          ${row.map(val => `<td class="px-4 py-2 max-w-[120px] truncate" title="${val}">${val}</td>`).join('')}
        </tr>
      `).join('');

      previewTitle.textContent = `Previsualización (${parsedRows.length} filas encontradas)`;
      previewSection.classList.remove('hidden');
    }

    modal.create({
      title: 'Importar Contactos desde CSV',
      content: form,
      actions: [
        { text: 'Cancelar' },
        {
          text: 'Comenzar Importación',
          primary: true,
          onClick: async (closeImportModal, actionButtons) => {
            if (parsedRows.length === 0 || !selectedFile) {
              toast.show('Por favor, selecciona un archivo CSV válido primero', 'info');
              return;
            }

            const btnCancel = actionButtons[0];
            const btnImport = actionButtons[1];
            btnCancel.disabled = true;
            btnImport.disabled = true;
            btnImport.textContent = 'Importando...';

            const progressSection = form.querySelector('#import-progress-section');
            const progressBar = form.querySelector('#import-progress-bar');
            const progressPercent = form.querySelector('#import-progress-percent');
            const progressText = form.querySelector('#import-progress-text');
            
            progressSection.classList.remove('hidden');

            const behavior = dupBehavior.value;
            const stages = cache.getStages();
            const defaultStageId = stages.find(s => s.is_default)?.id || stages[0]?.id;

            // Header mapping indexes
            const firstNameIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'first_name' || h.toLowerCase() === 'nombre');
            const lastNameIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'last_name' || h.toLowerCase() === 'apellido');
            const emailIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'email');
            const phoneIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'phone' || h.toLowerCase() === 'telefono');
            const companyIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'company' || h.toLowerCase() === 'empresa');
            const positionIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'position' || h.toLowerCase() === 'cargo');
            const linkedinIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'linkedin_url' || h.toLowerCase() === 'linkedin');
            const medioIdx = fileHeaders.findIndex(h => h.toLowerCase() === 'medio_contacto');

            // Collect emails
            const emailsToCheck = [];
            if (emailIdx !== -1) {
              parsedRows.forEach(row => {
                const em = row[emailIdx];
                if (em) emailsToCheck.push(em);
              });
            }

            progressText.textContent = 'Buscando duplicados...';
            const duplicateMap = await checkDuplicateEmails(emailsToCheck);

            let okCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const errorDetails = [];
            const total = parsedRows.length;
            const todayStr = new Date().toISOString().split('T')[0];

            for (let i = 0; i < total; i++) {
              const row = parsedRows[i];
              
              const percent = Math.round((i / total) * 100);
              progressBar.style.width = `${percent}%`;
              progressPercent.textContent = `${percent}%`;
              progressText.textContent = `Procesando ${i + 1} de ${total}...`;

              const getValue = (idx) => (idx !== -1 && row[idx]) ? row[idx].trim() : null;

              const email = getValue(emailIdx);
              const cleanEmail = email ? email.toLowerCase() : null;
              const companyName = getValue(companyIdx);

              const contactObj = {
                first_name: getValue(firstNameIdx) || 'Sin Nombre',
                last_name: getValue(lastNameIdx) || '',
                email: cleanEmail,
                phone: getValue(phoneIdx),
                position: getValue(positionIdx),
                linkedin_url: getValue(linkedinIdx),
                medio_contacto: getValue(medioIdx) || 'Email',
                fecha_carga: todayStr,
                fecha_ultimo_contacto: todayStr,
                is_active: true
              };

              try {
                // 1. Resolve or create lead/company
                let leadId = '00000000-0000-0000-0000-000000000000'; // Sin empresa by default
                
                if (companyName && companyName.toLowerCase() !== 'sin empresa') {
                  const matchedLead = leads.find(l => (l.company || '').toLowerCase() === companyName.toLowerCase());
                  
                  if (matchedLead) {
                    leadId = matchedLead.id;
                  } else {
                    const { data: newLead, error: leadErr } = await supabase
                      .from('leads')
                      .insert([{
                        company: companyName,
                        nombre_validado: false,
                        pipeline_stage_id: defaultStageId,
                        source: 'csv_import',
                        fecha_carga: todayStr
                      }])
                      .select()
                      .single();

                    if (leadErr) throw leadErr;
                    
                    leadId = newLead.id;
                    cache.addLead(newLead);
                    leads.push(newLead);
                  }
                }

                // 2. Resolve or create contact
                let contactId = cleanEmail ? duplicateMap[cleanEmail] : null;

                if (contactId) {
                  if (behavior === 'skip') {
                    skippedCount++;
                    continue;
                  } else {
                    const { error: contactErr } = await supabase
                      .from('contacts')
                      .update(contactObj)
                      .eq('id', contactId);

                    if (contactErr) throw contactErr;
                    okCount++;
                  }
                } else {
                  const { data: newContact, error: contactErr } = await supabase
                    .from('contacts')
                    .insert([contactObj])
                    .select()
                    .single();

                  if (contactErr) throw contactErr;
                  
                  contactId = newContact.id;
                  cache.addContact(newContact);
                  okCount++;
                }

                // 3. Link contact to company
                const { error: linkErr } = await supabase
                  .from('lead_contacts_link')
                  .insert([{
                    lead_id: leadId,
                    contact_id: contactId
                  }])
                  .select();
                
                if (linkErr && !linkErr.message.includes('duplicate key')) {
                  throw linkErr;
                }

                cache.addLink({ lead_id: leadId, contact_id: contactId });

                // 4. Set as primary contact if company has no primary contact
                const currentLeadObj = leads.find(l => l.id === leadId);
                if (currentLeadObj && !currentLeadObj.primary_contact_id) {
                  const { error: primaryErr } = await supabase
                    .from('leads')
                    .update({ primary_contact_id: contactId })
                    .eq('id', leadId);

                  if (!primaryErr) {
                    currentLeadObj.primary_contact_id = contactId;
                    cache.updateLead(currentLeadObj);
                  }
                }

              } catch (err) {
                errorCount++;
                errorDetails.push({ 
                  row: i + 2, 
                  name: `${contactObj.first_name} ${contactObj.last_name}`, 
                  error: err.message 
                });
              }
            }

            try {
              await supabase
                .from('import_logs')
                .insert([{
                  file_name: selectedFile.name,
                  total_rows: total,
                  imported_ok: okCount,
                  duplicates_skipped: skippedCount,
                  errors: errorCount,
                  error_details: errorDetails,
                  imported_by: currentUser.id
                }]);
            } catch (err) {
              console.error('Error saving import logs:', err);
            }

            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = `¡Importación completada! OK: ${okCount}, Omitidos: ${skippedCount}, Errores: ${errorCount}`;

            await cache.loadAll();
            
            setTimeout(() => {
              closeImportModal();
              if (errorCount > 0) {
                modal.create({
                  title: 'Errores durante la importación',
                  content: `<div class="font-sans text-xs text-rose-600 flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                    ${errorDetails.map(e => `<p>Fila ${e.row} (${e.name}): ${e.error}</p>`).join('')}
                  </div>`
                });
              } else {
                toast.show(`Importación completada correctamente`, 'success');
              }
            }, 1000);
          }
        }
      ]
    });
  });

  return container;
}
