import { supabase } from '../lib/supabase';
import { auth } from '../lib/auth';
import { cache } from '../lib/cache';
import { toast } from '../components/toast';
import { renderLeadDetail } from './lead-detail';

export function renderSalesqlSearch(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-16 font-sans text-xs select-none max-w-5xl mx-auto w-full';

  if (!cache.isSalesqlEnabled()) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto gap-4 animate-fade-in">
        <div class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center text-2xl border border-neutral-200">
          🔒
        </div>
        <div class="flex flex-col gap-1.5">
          <h2 class="text-base font-bold text-primary font-display">Integración con SalesQL desactivada</h2>
          <p class="text-xs text-neutral-500 leading-relaxed">
            El buscador independiente de prospectos se encuentra deshabilitado. Puedes habilitarlo en cualquier momento desde la sección de integraciones.
          </p>
        </div>
        <div class="flex items-center gap-3 pt-2">
          <a href="#leads-table" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white text-[11px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors">
            ← Volver a Leads
          </a>
          ${currentUser?.profile?.role === 'super_admin' ? `
            <a href="#settings-integrations" class="px-4 py-2 border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-[11px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors">
              Ir a Integraciones ⚙️
            </a>
          ` : ''}
        </div>
      </div>
    `;
    return container;
  }

  let activeTab = 'organizations'; // 'organizations' | 'persons'
  let personSearchMode = 'linkedin'; // 'linkedin' | 'email' | 'name_company'

  let isLoading = false;
  let searchResult = null;
  let searchError = null;
  let isRateLimit = false;
  let searchNotFound = false;
  let lastImportedLeadId = null;

  function render() {
    container.innerHTML = `
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-5">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xl">🔎</span>
            <h2 class="text-lg font-bold text-primary font-display tracking-tight">Buscador de Prospectos (SalesQL B2B)</h2>
          </div>
          <p class="text-neutral-500 text-[11px] mt-1">
            Encuentra empresas y personas clave desde cero vía API oficial de SalesQL e impórtalas directamente al pipeline del CRM.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <a href="#leads-table" class="px-3 py-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 hover:text-primary rounded-full font-mono text-[10px] font-bold uppercase tracking-wider transition-colors">
            ← Volver a Leads
          </a>
        </div>
      </div>

      <!-- Credit disclaimer notice -->
      <div class="bg-indigo-50/60 border border-indigo-200/80 rounded-sm p-3.5 flex items-start gap-3">
        <span class="text-indigo-600 text-sm mt-0.5">💳</span>
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Aviso de Consumo de Créditos</span>
          <p class="text-[11px] text-indigo-800 leading-relaxed">
            Cada consulta exitosa que devuelva datos descuenta <b>1 crédito</b> de la bolsa compartida de tu cuenta de SalesQL. Las consultas que no arrojen resultados <b>no consumen créditos</b>.
          </p>
        </div>
      </div>

      <!-- Main Search Box Card -->
      <div class="bg-white border border-[#d9d9dd] rounded-sm shadow-xs overflow-hidden">
        <!-- Tabs Bar -->
        <div class="flex border-b border-[#d9d9dd] bg-neutral-50/50">
          <button 
            id="tab-btn-organizations" 
            class="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'organizations' 
                ? 'border-primary text-primary bg-white' 
                : 'border-transparent text-neutral-500 hover:text-primary hover:bg-neutral-100/50'
            }"
          >
            <span>🏢</span>
            <span>Buscar Empresas</span>
          </button>
          <button 
            id="tab-btn-persons" 
            class="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
              activeTab === 'persons' 
                ? 'border-primary text-primary bg-white' 
                : 'border-transparent text-neutral-500 hover:text-primary hover:bg-neutral-100/50'
            }"
          >
            <span>👤</span>
            <span>Buscar Personas / Contactos</span>
          </button>
        </div>

        <!-- Tab Content: Organizations Form -->
        ${activeTab === 'organizations' ? `
          <form id="form-search-org" class="p-6 flex flex-col gap-4">
            <p class="text-neutral-500 text-[11px]">
              Ingresa al menos <b>uno</b> de los siguientes criterios para encontrar los datos de la empresa:
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1">
                <label for="org-domain" class="font-mono text-[9px] font-bold text-primary uppercase">Dominio Web (Recomendado)</label>
                <input 
                  type="text" 
                  id="org-domain" 
                  placeholder="ej: siemens.com o marca.com.ar" 
                  class="cohere-input text-xs"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label for="org-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre de la Empresa</label>
                <input 
                  type="text" 
                  id="org-name" 
                  placeholder="ej: Siemens o Café Martínez" 
                  class="cohere-input text-xs"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label for="org-linkedin" class="font-mono text-[9px] font-bold text-primary uppercase">URL LinkedIn de Empresa</label>
                <input 
                  type="text" 
                  id="org-linkedin" 
                  placeholder="ej: https://linkedin.com/company/siemens" 
                  class="cohere-input text-xs"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-neutral-100">
              <span class="text-[10px] text-neutral-400 italic">
                * Para máxima precisión, prioriza el dominio web o la URL de LinkedIn.
              </span>
              <button 
                type="submit" 
                id="btn-submit-org" 
                ${isLoading ? 'disabled' : ''} 
                class="px-6 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 cursor-pointer flex items-center gap-2"
              >
                ${isLoading ? '<span class="animate-spin inline-block">🔄</span> Buscando...' : '🔍 Buscar Empresa'}
              </button>
            </div>
          </form>
        ` : `
          <!-- Tab Content: Persons Form -->
          <form id="form-search-person" class="p-6 flex flex-col gap-4">
            <!-- Mode selection radio buttons -->
            <div class="flex flex-wrap items-center gap-4 pb-2 border-b border-neutral-100">
              <span class="font-mono text-[9px] font-bold text-primary uppercase">Criterio de búsqueda:</span>
              <label class="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-neutral-700">
                <input type="radio" name="person-mode" value="linkedin" ${personSearchMode === 'linkedin' ? 'checked' : ''} class="text-primary focus:ring-0 cursor-pointer" />
                <span>URL de LinkedIn (Recomendado)</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-neutral-700">
                <input type="radio" name="person-mode" value="email" ${personSearchMode === 'email' ? 'checked' : ''} class="text-primary focus:ring-0 cursor-pointer" />
                <span>Email de la persona</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-neutral-700">
                <input type="radio" name="person-mode" value="name_company" ${personSearchMode === 'name_company' ? 'checked' : ''} class="text-primary focus:ring-0 cursor-pointer" />
                <span>Nombre + Empresa / Dominio</span>
              </label>
            </div>

            <!-- Inputs based on mode -->
            ${personSearchMode === 'linkedin' ? `
              <div class="flex flex-col gap-1">
                <label for="person-linkedin" class="font-mono text-[9px] font-bold text-primary uppercase">URL del perfil de LinkedIn *</label>
                <input 
                  type="text" 
                  id="person-linkedin" 
                  required 
                  placeholder="ej: https://www.linkedin.com/in/nombre-apellido" 
                  class="cohere-input text-xs"
                />
              </div>
            ` : ''}

            ${personSearchMode === 'email' ? `
              <div class="flex flex-col gap-1">
                <label for="person-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email del contacto *</label>
                <input 
                  type="email" 
                  id="person-email" 
                  required 
                  placeholder="ej: jane.doe@acme.com o personal@gmail.com" 
                  class="cohere-input text-xs"
                />
              </div>
            ` : ''}

            ${personSearchMode === 'name_company' ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label for="person-fullname" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre y Apellido *</label>
                  <input 
                    type="text" 
                    id="person-fullname" 
                    required 
                    placeholder="ej: Juan Pérez" 
                    class="cohere-input text-xs"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <label for="person-org-domain" class="font-mono text-[9px] font-bold text-primary uppercase">Dominio Web o Nombre de la Empresa *</label>
                  <input 
                    type="text" 
                    id="person-org-domain" 
                    required 
                    placeholder="ej: acme.com o Acme Corp" 
                    class="cohere-input text-xs"
                  />
                </div>
              </div>
            ` : ''}

            <!-- Optional filters -->
            <div class="flex flex-wrap items-center gap-6 pt-2">
              <label class="flex items-center gap-2 cursor-pointer select-none text-[11px] text-neutral-600">
                <input type="checkbox" id="match-direct-email" class="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer" />
                <span>Requerir email directo (no corporativo genérico)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none text-[11px] text-neutral-600">
                <input type="checkbox" id="match-direct-phone" class="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer" />
                <span>Requerir número de teléfono directo</span>
              </label>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-neutral-100">
              <span class="text-[10px] text-neutral-400 italic">
                * Las búsquedas por LinkedIn URL tienen la mayor tasa de coincidencia.
              </span>
              <button 
                type="submit" 
                id="btn-submit-person" 
                ${isLoading ? 'disabled' : ''} 
                class="px-6 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 cursor-pointer flex items-center gap-2"
              >
                ${isLoading ? '<span class="animate-spin inline-block">🔄</span> Buscando...' : '🔍 Buscar Persona'}
              </button>
            </div>
          </form>
        `}
      </div>

      <!-- Results Container Section -->
      <div id="search-feedback-area">
        ${isLoading ? `
          <div class="bg-white border border-[#d9d9dd] rounded-sm p-12 flex flex-col items-center justify-center gap-3 text-neutral-500">
            <svg class="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="font-mono text-xs font-bold text-primary uppercase tracking-wider">Consultando API de SalesQL...</span>
            <p class="text-[11px] text-neutral-400">Verificando bases de datos y enriqueciendo registros.</p>
          </div>
        ` : ''}

        ${isRateLimit ? `
          <div class="bg-amber-50 border border-amber-300 text-amber-900 rounded-sm p-4 flex items-start gap-3">
            <span class="text-amber-600 text-lg">⚠️</span>
            <div class="flex flex-col gap-1.5 text-left">
              <span class="font-bold font-mono text-[10px] uppercase tracking-wider text-amber-950">Límite de Solicitudes / Plan en SalesQL (Error 429)</span>
              <p class="text-xs leading-relaxed text-amber-900">${searchError || 'Se alcanzó el límite de solicitudes de la API de SalesQL.'}</p>
              <p class="text-[11px] text-amber-800 leading-relaxed">
                SalesQL reporta <b>"Rate limit exceeded"</b> cuando se supera el límite de llamadas por minuto, la cuota diaria de la API según el plan contratado, o cuando se agotan los créditos disponibles de la cuenta.
              </p>
              <div class="pt-1">
                <a href="https://salesql.com" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 rounded-full font-mono text-[10px] font-bold transition-colors">
                  Ir al panel de SalesQL ↗
                </a>
              </div>
            </div>
          </div>
        ` : searchError ? `
          <div class="bg-rose-50 border border-rose-200 text-rose-800 rounded-sm p-4 flex items-start gap-3">
            <span class="text-rose-600 text-lg">⚠️</span>
            <div class="flex flex-col gap-1">
              <span class="font-bold font-mono text-[10px] uppercase tracking-wider">Error en la consulta</span>
              <p class="text-xs leading-relaxed">${searchError}</p>
            </div>
          </div>
        ` : ''}

        ${searchNotFound ? `
          <div class="bg-amber-50/70 border border-amber-200 text-amber-900 rounded-sm p-6 flex flex-col items-center justify-center gap-2 text-center">
            <span class="text-2xl">🔍</span>
            <h4 class="font-bold text-xs uppercase font-mono tracking-wider">Sin coincidencias encontradas</h4>
            <p class="text-[11px] text-neutral-600 max-w-md">
              SalesQL no encontró ningún registro con los criterios ingresados. Recuerda que esta consulta <b>no descontó créditos</b> de tu cuenta.
            </p>
          </div>
        ` : ''}

        ${searchResult ? renderResultCard(searchResult, activeTab) : ''}
      </div>
    `;

    setupEvents();
  }

  function renderResultCard(data, type) {
    if (type === 'organizations') {
      const orgName = data.name || 'Empresa sin nombre';
      const website = data.website || (data.website_domain ? `https://${data.website_domain}` : '');
      const domain = data.website_domain || '';
      const linkedinUrl = data.linkedin_url || '';
      const employees = data.number_of_employees || 'No informado';
      const founded = data.founded_year || 'No informado';
      const industry = data.industry || 'No especificada';
      const location = data.location || 'No especificada';

      // Check duplicates in CRM leads
      const allLeads = cache.getLeads() || [];
      const normSearchName = orgName.trim().toLowerCase();
      const existingLead = allLeads.find(l => {
        if (!l.company) return false;
        const normLeadCompany = l.company.trim().toLowerCase();
        if (normLeadCompany === normSearchName) return true;
        if (domain && l.notes && l.notes.toLowerCase().includes(domain.toLowerCase())) return true;
        return false;
      });

      const existingStage = existingLead ? cache.getStage(existingLead.pipeline_stage_id)?.name || 'Desconocida' : '';

      return `
        <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col gap-6 shadow-xs animate-fade-in">
          <!-- Card Header -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-neutral-100 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-sm bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg font-mono">
                🏢
              </div>
              <div>
                <h3 class="text-base font-bold text-primary font-display">${orgName}</h3>
                <div class="flex flex-wrap items-center gap-2 mt-0.5">
                  ${domain ? `<span class="font-mono text-[10px] text-muted-slate bg-neutral-100 px-2 py-0.5 rounded-xs">${domain}</span>` : ''}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ Encontrada en SalesQL
                  </span>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-2 shrink-0">
              ${lastImportedLeadId ? `
                <button 
                  id="btn-open-imported-lead" 
                  data-lead-id="${lastImportedLeadId}" 
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer"
                >
                  ✓ Abrir Ficha del Lead
                </button>
              ` : `
                <button 
                  id="btn-import-org" 
                  class="px-5 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer flex items-center gap-2"
                >
                  📥 Importar como Nuevo Lead
                </button>
              `}
            </div>
          </div>

          <!-- Duplicate Warning Banner -->
          ${existingLead ? `
            <div class="bg-amber-50 border border-amber-200 rounded-sm p-3.5 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class="text-amber-600 text-base">⚠️</span>
                <span class="text-xs text-amber-900">
                  Ya existe un Lead en el CRM con este nombre: <b>"${existingLead.company}"</b> (Etapa: <span class="font-mono uppercase">${existingStage}</span>).
                </span>
              </div>
              <button 
                class="btn-open-existing-lead px-3 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-mono text-[9px] font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer shrink-0" 
                data-lead-id="${existingLead.id}"
              >
                Ver Lead Existente
              </button>
            </div>
          ` : ''}

          <!-- Details Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-neutral-50/50 p-4 rounded-sm border border-neutral-100">
            <div>
              <span class="font-mono text-[9px] font-bold text-muted-slate uppercase">Industria</span>
              <p class="text-xs font-semibold text-primary mt-0.5">${industry}</p>
            </div>
            <div>
              <span class="font-mono text-[9px] font-bold text-muted-slate uppercase">Tamaño / Empleados</span>
              <p class="text-xs font-semibold text-primary mt-0.5">${employees}</p>
            </div>
            <div>
              <span class="font-mono text-[9px] font-bold text-muted-slate uppercase">Año de Fundación</span>
              <p class="text-xs font-semibold text-primary mt-0.5">${founded}</p>
            </div>
            <div>
              <span class="font-mono text-[9px] font-bold text-muted-slate uppercase">Ubicación / País</span>
              <p class="text-xs font-semibold text-primary mt-0.5">${location}</p>
            </div>
          </div>

          <!-- Links Section -->
          <div class="flex flex-wrap items-center gap-4 text-xs pt-1">
            ${website ? `
              <a href="${website.startsWith('http') ? website : 'https://' + website}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline flex items-center gap-1.5 font-mono text-[11px]">
                <span>🌐</span> <span>${website}</span> ↗
              </a>
            ` : ''}
            ${linkedinUrl ? `
              <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline flex items-center gap-1.5 font-mono text-[11px]">
                <span>🔗</span> <span>Perfil LinkedIn</span> ↗
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (type === 'persons') {
      const fullName = data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Contacto sin nombre';
      const title = data.title || data.headline || 'Sin cargo especificado';
      const headline = data.headline || '';
      const industry = data.industry || 'No especificada';
      const location = data.location || 'No especificada';
      const linkedinUrl = data.linkedin_url || '';
      const emails = Array.isArray(data.emails) ? data.emails : [];
      const phones = Array.isArray(data.phones) ? data.phones : [];

      // Duplicate check in CRM contacts
      const allContacts = Array.from(cache.contacts?.values() || []);
      const matchedContact = allContacts.find(c => {
        if (!c.email) return false;
        return emails.some(e => e.email && e.email.toLowerCase() === c.email.toLowerCase());
      });

      return `
        <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col gap-6 shadow-xs animate-fade-in">
          <!-- Card Header -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-neutral-100 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg font-mono">
                👤
              </div>
              <div>
                <h3 class="text-base font-bold text-primary font-display">${fullName}</h3>
                <p class="text-xs text-neutral-600 mt-0.5">${title}</p>
                ${headline && headline !== title ? `<p class="text-[11px] text-neutral-400 mt-0.5 italic max-w-xl">${headline}</p>` : ''}
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-2 shrink-0">
              ${lastImportedLeadId ? `
                <button 
                  id="btn-open-imported-lead" 
                  data-lead-id="${lastImportedLeadId}" 
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer"
                >
                  ✓ Abrir Ficha del Lead
                </button>
              ` : `
                <button 
                  id="btn-import-person" 
                  class="px-5 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer flex items-center gap-2"
                >
                  📥 Importar Lead y Contacto
                </button>
              `}
            </div>
          </div>

          <!-- Duplicate Warning Banner -->
          ${matchedContact ? `
            <div class="bg-amber-50 border border-amber-200 rounded-sm p-3.5 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class="text-amber-600 text-base">⚠️</span>
                <span class="text-xs text-amber-900">
                  Ya existe un Contacto en el CRM con el email <b>${matchedContact.email}</b>: <b>"${matchedContact.first_name || ''} ${matchedContact.last_name || ''}"</b>.
                </span>
              </div>
            </div>
          ` : ''}

          <!-- Grid: Details, Emails, Phones -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Col 1: General Info -->
            <div class="flex flex-col gap-3 bg-neutral-50/60 p-4 rounded-sm border border-neutral-100">
              <span class="font-mono text-[9px] font-bold text-primary uppercase border-b border-neutral-200 pb-1">Datos Profesionales</span>
              <div>
                <span class="font-mono text-[9px] text-muted-slate uppercase">Industria</span>
                <p class="text-xs font-semibold text-primary mt-0.5">${industry}</p>
              </div>
              <div>
                <span class="font-mono text-[9px] text-muted-slate uppercase">Ubicación</span>
                <p class="text-xs font-semibold text-primary mt-0.5">${location}</p>
              </div>
              ${linkedinUrl ? `
                <div class="pt-2">
                  <a href="${linkedinUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline flex items-center gap-1 font-mono text-[10px]">
                    <span>🔗</span> <span>Perfil LinkedIn</span> ↗
                  </a>
                </div>
              ` : ''}
            </div>

            <!-- Col 2: Emails found -->
            <div class="flex flex-col gap-3 bg-neutral-50/60 p-4 rounded-sm border border-neutral-100">
              <div class="flex items-center justify-between border-b border-neutral-200 pb-1">
                <span class="font-mono text-[9px] font-bold text-primary uppercase">Emails (${emails.length})</span>
                <span class="text-[9px] font-mono text-neutral-400">Verificados</span>
              </div>
              ${emails.length === 0 ? `
                <p class="text-[11px] text-neutral-400 italic">No se encontraron emails para este contacto.</p>
              ` : `
                <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  ${emails.map(em => `
                    <div class="bg-white p-2.5 rounded-xs border border-neutral-200 flex flex-col gap-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono text-[11px] font-bold text-primary select-all break-all">${em.email}</span>
                        <span class="font-mono text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          (em.status || '').toLowerCase() === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600'
                        }">
                          ${em.status || 'Email'}
                        </span>
                      </div>
                      ${em.type ? `<span class="text-[9px] text-neutral-400 uppercase font-mono">${em.type}</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Col 3: Phones found -->
            <div class="flex flex-col gap-3 bg-neutral-50/60 p-4 rounded-sm border border-neutral-100">
              <div class="flex items-center justify-between border-b border-neutral-200 pb-1">
                <span class="font-mono text-[9px] font-bold text-primary uppercase">Teléfonos (${phones.length})</span>
                <span class="text-[9px] font-mono text-neutral-400">Directos / Móviles</span>
              </div>
              ${phones.length === 0 ? `
                <p class="text-[11px] text-neutral-400 italic">No se encontraron teléfonos para este contacto.</p>
              ` : `
                <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  ${phones.map(ph => `
                    <div class="bg-white p-2.5 rounded-xs border border-neutral-200 flex flex-col gap-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono text-[11px] font-bold text-primary select-all">${ph.phone}</span>
                        <span class="font-mono text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          ph.is_valid !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600'
                        }">
                          ${ph.is_valid !== false ? 'Validado' : 'No Validado'}
                        </span>
                      </div>
                      ${ph.type ? `<span class="text-[9px] text-neutral-400 uppercase font-mono">${ph.type}</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  function setupEvents() {
    // Tab switching
    const btnTabOrg = container.querySelector('#tab-btn-organizations');
    const btnTabPerson = container.querySelector('#tab-btn-persons');

    if (btnTabOrg) {
      btnTabOrg.addEventListener('click', () => {
        if (activeTab !== 'organizations') {
          activeTab = 'organizations';
          searchResult = null;
          searchError = null;
          searchNotFound = false;
          lastImportedLeadId = null;
          render();
        }
      });
    }

    if (btnTabPerson) {
      btnTabPerson.addEventListener('click', () => {
        if (activeTab !== 'persons') {
          activeTab = 'persons';
          searchResult = null;
          searchError = null;
          searchNotFound = false;
          lastImportedLeadId = null;
          render();
        }
      });
    }

    // Person mode radio change
    const personModeRadios = container.querySelectorAll('input[name="person-mode"]');
    personModeRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        personSearchMode = e.target.value;
        searchResult = null;
        searchError = null;
        searchNotFound = false;
        render();
      });
    });

    // Form search organization submit
    const formOrg = container.querySelector('#form-search-org');
    if (formOrg) {
      formOrg.addEventListener('submit', async (e) => {
        e.preventDefault();
        const domain = container.querySelector('#org-domain')?.value.trim() || '';
        const name = container.querySelector('#org-name')?.value.trim() || '';
        const linkedin = container.querySelector('#org-linkedin')?.value.trim() || '';

        if (!domain && !name && !linkedin) {
          toast.show('Por favor ingresa al menos un dominio, nombre o URL de LinkedIn de la empresa', 'error');
          return;
        }

        isLoading = true;
        searchResult = null;
        searchError = null;
        isRateLimit = false;
        searchNotFound = false;
        lastImportedLeadId = null;
        render();

        try {
          const session = await auth.getSession();
          const jwt = session?.access_token;
          const payload = {
            action: 'enrich-organization',
            organization_domain: domain || undefined,
            organization_name: name || undefined,
            linkedin_url: linkedin || undefined
          };

          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/salesql-proxy`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (res.ok && data.success && data.data) {
            searchResult = data.data;
            toast.show('Empresa encontrada en SalesQL', 'success');
          } else if (data.not_found || res.status === 404) {
            searchNotFound = true;
          } else if (data.is_rate_limit || data.status === 429 || res.status === 429) {
            isRateLimit = true;
            searchError = data.error || 'Límite de solicitudes o créditos de SalesQL alcanzado (Rate limit exceeded).';
          } else {
            searchError = data.error || 'No se pudo obtener información de la empresa';
          }
        } catch (err) {
          console.error('Error buscando empresa:', err);
          searchError = err.message || 'Error de conexión con el servicio';
        } finally {
          isLoading = false;
          render();
        }
      });
    }

    // Form search person submit
    const formPerson = container.querySelector('#form-search-person');
    if (formPerson) {
      formPerson.addEventListener('submit', async (e) => {
        e.preventDefault();
        const directEmail = container.querySelector('#match-direct-email')?.checked;
        const directPhone = container.querySelector('#match-direct-phone')?.checked;

        let payload = {};

        if (personSearchMode === 'linkedin') {
          const linkedin = container.querySelector('#person-linkedin')?.value.trim() || '';
          if (!linkedin) {
            toast.show('Ingresa la URL de LinkedIn', 'error');
            return;
          }
          payload = {
            action: 'enrich-person',
            linkedin_url: linkedin,
            match_if_direct_email: directEmail,
            match_if_direct_phone: directPhone
          };
        } else if (personSearchMode === 'email') {
          const email = container.querySelector('#person-email')?.value.trim() || '';
          if (!email) {
            toast.show('Ingresa el email', 'error');
            return;
          }
          payload = {
            action: 'email-lookup',
            email: email
          };
        } else if (personSearchMode === 'name_company') {
          const fullname = container.querySelector('#person-fullname')?.value.trim() || '';
          const orgOrDomain = container.querySelector('#person-org-domain')?.value.trim() || '';
          if (!fullname || !orgOrDomain) {
            toast.show('Ingresa el nombre completo y la empresa o dominio', 'error');
            return;
          }

          const isDomain = orgOrDomain.includes('.');
          payload = {
            action: 'enrich-person',
            full_name: fullname,
            organization_domain: isDomain ? orgOrDomain : undefined,
            organization_name: !isDomain ? orgOrDomain : undefined,
            match_if_direct_email: directEmail,
            match_if_direct_phone: directPhone
          };
        }

        isLoading = true;
        searchResult = null;
        searchError = null;
        isRateLimit = false;
        searchNotFound = false;
        lastImportedLeadId = null;
        render();

        try {
          const session = await auth.getSession();
          const jwt = session?.access_token;

          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/salesql-proxy`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (res.ok && data.success && data.data) {
            searchResult = data.data;
            toast.show('Persona encontrada en SalesQL', 'success');
          } else if (data.not_found || res.status === 404) {
            searchNotFound = true;
          } else if (data.is_rate_limit || data.status === 429 || res.status === 429) {
            isRateLimit = true;
            searchError = data.error || 'Límite de solicitudes o créditos de SalesQL alcanzado (Rate limit exceeded).';
          } else {
            searchError = data.error || 'No se pudo obtener información de la persona';
          }
        } catch (err) {
          console.error('Error buscando persona:', err);
          searchError = err.message || 'Error de conexión con el servicio';
        } finally {
          isLoading = false;
          render();
        }
      });
    }

    // Open existing lead button
    const btnOpenExisting = container.querySelector('.btn-open-existing-lead');
    if (btnOpenExisting) {
      btnOpenExisting.addEventListener('click', (e) => {
        const leadId = e.currentTarget.dataset.leadId;
        if (leadId) renderLeadDetail(leadId);
      });
    }

    // Open newly imported lead button
    const btnOpenImported = container.querySelector('#btn-open-imported-lead');
    if (btnOpenImported) {
      btnOpenImported.addEventListener('click', (e) => {
        const leadId = e.currentTarget.dataset.leadId;
        if (leadId) renderLeadDetail(leadId);
      });
    }

    // Import Organization button
    const btnImportOrg = container.querySelector('#btn-import-org');
    if (btnImportOrg) {
      btnImportOrg.addEventListener('click', async () => {
        if (!searchResult) return;
        btnImportOrg.disabled = true;
        btnImportOrg.innerHTML = '<span class="animate-spin inline-block">🔄</span> Guardando...';

        try {
          const stages = cache.getStages() || [];
          const defaultStage = stages.find(s => s.is_default) || stages[0];

          const companyName = searchResult.name || 'Empresa (SalesQL)';
          const notesArr = [];
          if (searchResult.website) notesArr.push(`Website: ${searchResult.website}`);
          if (searchResult.website_domain) notesArr.push(`Dominio: ${searchResult.website_domain}`);
          if (searchResult.linkedin_url) notesArr.push(`LinkedIn Empresa: ${searchResult.linkedin_url}`);
          if (searchResult.founded_year) notesArr.push(`Año fundación: ${searchResult.founded_year}`);
          if (searchResult.location) notesArr.push(`Ubicación: ${searchResult.location}`);

          const newLead = {
            company: companyName,
            industry: searchResult.industry || null,
            branches: searchResult.number_of_employees ? `${searchResult.number_of_employees} empleados` : null,
            country: searchResult.location || null,
            notes: notesArr.join('\n'),
            pipeline_stage_id: defaultStage?.id || null,
            assigned_to: currentUser?.id || null,
            source: 'salesql',
            source_detail: 'Buscador CRM',
            nombre_validado: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: leadData, error: leadErr } = await supabase
            .from('leads')
            .insert([newLead])
            .select()
            .single();

          if (leadErr) throw leadErr;

          lastImportedLeadId = leadData.id;
          toast.show('Lead importado al CRM exitosamente', 'success');
          await cache.loadAll();
          render();
        } catch (err) {
          console.error('Error importando lead:', err);
          toast.show('Error al importar: ' + err.message, 'error');
          btnImportOrg.disabled = false;
          btnImportOrg.innerHTML = '📥 Importar como Nuevo Lead';
        }
      });
    }

    // Import Person button
    const btnImportPerson = container.querySelector('#btn-import-person');
    if (btnImportPerson) {
      btnImportPerson.addEventListener('click', async () => {
        if (!searchResult) return;
        btnImportPerson.disabled = true;
        btnImportPerson.innerHTML = '<span class="animate-spin inline-block">🔄</span> Guardando...';

        try {
          const stages = cache.getStages() || [];
          const defaultStage = stages.find(s => s.is_default) || stages[0];

          // 1. Obtener datos del contacto
          const firstName = searchResult.first_name || searchResult.full_name?.split(' ')[0] || 'Contacto';
          const lastName = searchResult.last_name || searchResult.full_name?.split(' ').slice(1).join(' ') || null;
          
          const emails = Array.isArray(searchResult.emails) ? searchResult.emails : [];
          const phones = Array.isArray(searchResult.phones) ? searchResult.phones : [];

          const primaryEmailObj = emails[0] || null;
          const primaryEmail = primaryEmailObj?.email || null;

          const primaryPhoneObj = phones[0] || null;
          const primaryPhone = primaryPhoneObj?.phone || null;
          const isPhoneValid = primaryPhoneObj ? primaryPhoneObj.is_valid !== false : false;

          // 2. Determinar empresa
          const companyName = searchResult.organization_name || searchResult.company || searchResult.headline?.split(' at ')[1] || 'Empresa (SalesQL)';

          // Buscar si existe el lead de la empresa o crearlo
          let leadId = null;
          const allLeads = cache.getLeads() || [];
          const matchedLead = allLeads.find(l => l.company && l.company.trim().toLowerCase() === companyName.trim().toLowerCase());

          if (matchedLead) {
            leadId = matchedLead.id;
          } else {
            const newLead = {
              company: companyName,
              industry: searchResult.industry || null,
              country: searchResult.location || null,
              notes: searchResult.headline ? `Headline: ${searchResult.headline}` : null,
              pipeline_stage_id: defaultStage?.id || null,
              assigned_to: currentUser?.id || null,
              source: 'salesql',
              source_detail: 'Buscador CRM',
              nombre_validado: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { data: createdLead, error: leadErr } = await supabase
              .from('leads')
              .insert([newLead])
              .select()
              .single();

            if (leadErr) throw leadErr;
            leadId = createdLead.id;
          }

          // 3. Crear Contacto
          const newContact = {
            first_name: firstName,
            last_name: lastName,
            email: primaryEmail,
            phone: primaryPhone,
            position: searchResult.title || searchResult.headline || null,
            linkedin_url: searchResult.linkedin_url || null,
            medio_contacto: primaryPhone ? 'whatsapp' : 'email',
            telefono_validado: isPhoneValid,
            is_active: true,
            fecha_carga: new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: createdContact, error: contactErr } = await supabase
            .from('contacts')
            .insert([newContact])
            .select()
            .single();

          if (contactErr) throw contactErr;

          // 4. Vincular contacto con lead
          await supabase
            .from('lead_contacts_link')
            .insert([{
              lead_id: leadId,
              contact_id: createdContact.id
            }]);

          // 5. Asignar como contacto principal si no tiene uno
          const { data: currentLeadRow } = await supabase
            .from('leads')
            .select('primary_contact_id')
            .eq('id', leadId)
            .single();

          if (!currentLeadRow?.primary_contact_id) {
            await supabase
              .from('leads')
              .update({ primary_contact_id: createdContact.id })
              .eq('id', leadId);
          }

          lastImportedLeadId = leadId;
          toast.show('Lead y Contacto importados exitosamente', 'success');
          await cache.loadAll();
          render();

        } catch (err) {
          console.error('Error importando persona:', err);
          toast.show('Error al importar: ' + err.message, 'error');
          btnImportPerson.disabled = false;
          btnImportPerson.innerHTML = '📥 Importar Lead y Contacto';
        }
      });
    }
  }

  render();
  return container;
}
