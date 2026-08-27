import { supabase } from '../lib/supabase';
import { toast } from '../components/toast';
import { modal } from '../components/modal';

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'logos', label: 'Logos' },
  { id: 'banners', label: 'Banners / Imágenes' },
  { id: 'documentos', label: 'Documentos / PDF' },
  { id: 'fichas', label: 'Fichas Técnicas' },
  { id: 'otros', label: 'Otros' }
];

const CATEGORY_COLORS = {
  logos: 'bg-blue-50 text-blue-700 border-blue-200',
  banners: 'bg-purple-50 text-purple-700 border-purple-200',
  documentos: 'bg-amber-50 text-amber-700 border-amber-200',
  fichas: 'bg-teal-50 text-teal-700 border-teal-200',
  otros: 'bg-neutral-100 text-neutral-600 border-neutral-200'
};

export async function renderRecursosTab(parent, currentUser) {
  let resources = [];
  let currentCategory = 'all';
  let searchQuery = '';

  parent.innerHTML = `
    <div class="flex flex-col gap-6 font-sans text-xs select-none">
      <!-- Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border border-[#d9d9dd] rounded-sm">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-base">📁</span>
            <h3 class="font-mono text-xs font-bold text-primary tracking-wider uppercase">Biblioteca de Recursos</h3>
          </div>
          <p class="text-neutral-500 text-[11px]">
            Subí imágenes, logos y documentos a Supabase Storage y copiá su URL pública para usarlos en plantillas de email, campañas y firmas.
          </p>
        </div>

        <button id="btn-upload-resource" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white font-mono text-[10px] font-bold uppercase rounded-full shadow-xs transition-colors duration-150 flex items-center gap-2 self-start sm:self-auto cursor-pointer">
          <span class="text-xs">+</span>
          <span>Subir Recurso</span>
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-neutral-50 p-4 rounded-sm border border-[#d9d9dd]">
        <!-- Search Input -->
        <div class="relative w-full md:w-80">
          <span class="absolute left-3 top-2.5 text-neutral-400 text-xs pointer-events-none">🔍</span>
          <input type="text" id="resource-search" class="cohere-input !pl-9 text-xs w-full bg-white" placeholder="Buscar por título o archivo..." />
        </div>

        <!-- Category Pills -->
        <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold uppercase" id="category-filters-wrap">
          ${CATEGORIES.map(c => `
            <button data-cat="${c.id}" class="cat-filter-btn px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              c.id === 'all'
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-neutral-600 border-[#d9d9dd] hover:border-neutral-400'
            }">
              ${c.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Resources Grid Container -->
      <div id="resources-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <div class="col-span-full py-16 text-center text-neutral-400">
          <span class="animate-pulse mr-2">🔄</span> Cargando recursos...
        </div>
      </div>
    </div>
  `;

  const grid = parent.querySelector('#resources-grid');
  const searchInput = parent.querySelector('#resource-search');
  const btnUpload = parent.querySelector('#btn-upload-resource');
  const filterBtns = parent.querySelectorAll('.cat-filter-btn');

  btnUpload.addEventListener('click', () => openUploadModal());

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderGrid();
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.className = 'cat-filter-btn px-3 py-1.5 rounded-full border transition-all cursor-pointer bg-white text-neutral-600 border-[#d9d9dd] hover:border-neutral-400';
      });
      btn.className = 'cat-filter-btn px-3 py-1.5 rounded-full border transition-all cursor-pointer bg-primary text-white border-primary';
      currentCategory = btn.dataset.cat;
      renderGrid();
    });
  });

  await loadResources();

  async function loadResources() {
    try {
      const { data, error } = await supabase
        .from('recursos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      resources = data || [];
      renderGrid();
    } catch (err) {
      console.error('Error loading resources:', err);
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-rose-500 font-mono text-xs">
          Error al cargar recursos: ${err.message}
        </div>
      `;
    }
  }

  function renderGrid() {
    const filtered = resources.filter(r => {
      const matchesSearch = !searchQuery || 
        r.title.toLowerCase().includes(searchQuery) || 
        r.file_name.toLowerCase().includes(searchQuery);
      const matchesCategory = currentCategory === 'all' || r.category === currentCategory;
      return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-white border border-[#d9d9dd] rounded-sm py-16 px-4 flex flex-col items-center justify-center gap-3 text-center">
          <span class="text-3xl">📭</span>
          <div class="flex flex-col gap-1">
            <span class="font-display font-semibold text-sm text-primary">No se encontraron recursos</span>
            <span class="text-neutral-500 text-xs">Subí tu primer archivo o probá con otro criterio de búsqueda.</span>
          </div>
          <button id="empty-upload-btn" class="mt-2 text-action-blue font-bold hover:underline cursor-pointer text-xs">
            + Subir un recurso ahora
          </button>
        </div>
      `;
      const emptyBtn = grid.querySelector('#empty-upload-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openUploadModal());
      return;
    }

    grid.innerHTML = '';

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col justify-between hover:border-neutral-400 transition-all shadow-xs group';

      const isImage = item.mime_type && item.mime_type.startsWith('image/');
      const isPdf = item.mime_type === 'application/pdf' || item.file_name.toLowerCase().endsWith('.pdf');
      const catLabel = CATEGORIES.find(c => c.id === item.category)?.label || item.category;
      const catColorClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.otros;
      const formattedSize = formatBytes(item.file_size);
      const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('es-AR') : '';

      card.innerHTML = `
        <!-- Media / Preview Area -->
        <div class="relative w-full h-40 bg-neutral-100 flex items-center justify-center overflow-hidden border-b border-neutral-100 ${isImage ? 'cursor-pointer group-hover:bg-neutral-200/60 transition-colors' : ''}" data-preview-id="${item.id}">
          ${isImage ? `
            <img src="${item.public_url}" alt="${item.title}" class="w-full h-full object-contain p-2" loading="lazy" />
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span class="px-2.5 py-1 bg-white/90 rounded-full font-mono text-[9px] font-bold text-primary uppercase shadow-xs">👁️ Ver ampliado</span>
            </div>
          ` : isPdf ? `
            <div class="flex flex-col items-center gap-2 text-rose-600">
              <span class="text-4xl">📄</span>
              <span class="font-mono text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">PDF Document</span>
            </div>
          ` : `
            <div class="flex flex-col items-center gap-2 text-neutral-500">
              <span class="text-4xl">📎</span>
              <span class="font-mono text-[9px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded">${item.file_name.split('.').pop()?.toUpperCase() || 'FILE'}</span>
            </div>
          `}
        </div>

        <!-- Info Body -->
        <div class="p-4 flex-1 flex flex-col justify-between gap-3">
          <div class="flex flex-col gap-1.5">
            <!-- Badges -->
            <div class="flex items-center justify-between gap-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold font-mono uppercase tracking-wider border ${catColorClass}">
                ${catLabel}
              </span>
              <span class="text-[9px] font-mono text-neutral-400">${formattedSize}</span>
            </div>

            <!-- Title & File Name -->
            <h4 class="font-display font-semibold text-primary text-xs line-clamp-1 leading-snug" title="${item.title}">${item.title}</h4>
            <p class="font-mono text-[10px] text-neutral-400 truncate" title="${item.file_name}">${item.file_name}</p>
          </div>

          <!-- Bottom Actions -->
          <div class="flex flex-col gap-2 pt-2 border-t border-neutral-100">
            <!-- Copy URL Primary Button -->
            <button data-copy-url="${item.public_url}" class="btn-copy-url w-full py-1.5 bg-neutral-50 hover:bg-primary hover:text-white text-primary border border-[#d9d9dd] hover:border-primary rounded-xs font-mono text-[9px] font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer">
              <span>📋</span>
              <span class="btn-copy-text">Copiar URL</span>
            </button>

            <!-- Secondary Links: Open, Edit, Delete -->
            <div class="flex items-center justify-between text-[10px] pt-1">
              <a href="${item.public_url}" target="_blank" rel="noopener noreferrer" class="text-neutral-500 hover:text-primary transition-colors flex items-center gap-1" title="Abrir en pestaña nueva">
                <span>🔗</span>
                <span class="font-mono text-[9px]">Abrir</span>
              </a>

              <div class="flex items-center gap-2">
                <button data-edit-id="${item.id}" class="text-neutral-400 hover:text-action-blue transition-colors cursor-pointer p-0.5" title="Editar información">
                  ✏️
                </button>
                <button data-delete-id="${item.id}" class="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5" title="Eliminar recurso">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Event: Preview lightbox
      if (isImage) {
        card.querySelector('[data-preview-id]').addEventListener('click', () => {
          openLightbox(item);
        });
      }

      // Event: Copy URL
      const copyBtn = card.querySelector('.btn-copy-url');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(item.public_url);
          const textSpan = copyBtn.querySelector('.btn-copy-text');
          const originalText = textSpan.textContent;
          copyBtn.classList.remove('bg-neutral-50', 'text-primary');
          copyBtn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');
          textSpan.textContent = '¡URL Copiada!';

          toast.show('¡URL pública copiada al portapapeles!', 'success');

          setTimeout(() => {
            copyBtn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
            copyBtn.classList.add('bg-neutral-50', 'text-primary');
            textSpan.textContent = originalText;
          }, 2000);
        } catch (err) {
          toast.show('Error al copiar URL: ' + err.message, 'error');
        }
      });

      // Event: Edit
      card.querySelector('[data-edit-id]').addEventListener('click', () => {
        openEditModal(item);
      });

      // Event: Delete
      card.querySelector('[data-delete-id]').addEventListener('click', () => {
        confirmDelete(item);
      });

      grid.appendChild(card);
    });
  }

  // MODAL: UPLOAD RESOURCE
  function openUploadModal() {
    let selectedFile = null;

    modal.create({
      title: 'Subir Nuevo Recurso',
      sizeClass: 'max-w-lg',
      content: `
        <div class="flex flex-col gap-4 font-sans text-xs">
          <!-- Dropzone Area -->
          <div id="dropzone" class="border-2 border-dashed border-neutral-300 hover:border-primary rounded-sm p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50 hover:bg-neutral-100/60 transition-colors text-center">
            <input type="file" id="file-input" class="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
            <div id="dropzone-empty" class="flex flex-col items-center gap-1.5">
              <span class="text-3xl">☁️</span>
              <span class="font-semibold text-primary">Arrastrá un archivo o hacé clic para seleccionar</span>
              <span class="text-[10px] text-neutral-400 font-mono">PNG, JPG, SVG, WebP, PDF, DOCX (Máx. 10 MB)</span>
            </div>
            
            <div id="dropzone-preview" class="hidden flex-col items-center gap-2 w-full">
              <div id="preview-img-wrap" class="max-h-36 max-w-full overflow-hidden rounded-sm border border-neutral-200 hidden">
                <img id="upload-preview-img" src="" class="max-h-36 object-contain" />
              </div>
              <div id="preview-file-icon" class="text-4xl hidden">📄</div>
              <span id="selected-file-name" class="font-mono text-xs font-bold text-primary truncate max-w-xs"></span>
              <span id="selected-file-size" class="font-mono text-[10px] text-neutral-500"></span>
              <button type="button" id="btn-change-file" class="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer mt-1">Cambiar archivo</button>
            </div>
          </div>

          <!-- Form Fields -->
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <label for="resource-title" class="font-mono text-[10px] font-bold text-primary uppercase">Título Descriptivo *</label>
              <input type="text" id="resource-title" required class="cohere-input text-xs" placeholder="Ej: Logo NegoZona Blanco Fondo Transparente" />
            </div>

            <div class="flex flex-col gap-1">
              <label for="resource-category" class="font-mono text-[10px] font-bold text-primary uppercase">Categoría *</label>
              <select id="resource-category" class="cohere-input text-xs bg-white">
                <option value="logos">Logos</option>
                <option value="banners">Banners / Imágenes</option>
                <option value="documentos">Documentos / PDF</option>
                <option value="fichas">Fichas Técnicas</option>
                <option value="otros">Otros</option>
              </select>
            </div>
          </div>
        </div>
      `,
      actions: [
        { text: 'Cancelar', primary: false },
        {
          text: 'Subir y Guardar',
          primary: true,
          onClick: async (closeModal) => {
            const modalEl = document.querySelector('.modal-overlay') || document;
            const title = modalEl.querySelector('#resource-title')?.value?.trim();
            const category = modalEl.querySelector('#resource-category')?.value || 'otros';

            if (!selectedFile) {
              toast.show('Por favor seleccioná un archivo para subir', 'error');
              return;
            }

            if (!title) {
              toast.show('Por favor ingresá un título descriptivo', 'error');
              return;
            }

            if (selectedFile.size > 10 * 1024 * 1024) {
              toast.show('El archivo supera el límite de 10 MB', 'error');
              return;
            }

            const confirmBtn = modalEl.querySelector('.btn-primary') || modalEl.querySelectorAll('button')[modalEl.querySelectorAll('button').length - 1];
            const origText = confirmBtn?.textContent;
            if (confirmBtn) {
              confirmBtn.disabled = true;
              confirmBtn.textContent = 'Subiendo a Storage...';
            }

            try {
              // 1. Sanitize file name and create unique path
              const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const uniquePath = `${category}/${Date.now()}_${cleanFileName}`;

              // 2. Upload to Supabase Storage
              const { error: uploadError } = await supabase.storage
                .from('recursos')
                .upload(uniquePath, selectedFile, {
                  cacheControl: '3600',
                  upsert: false
                });

              if (uploadError) throw uploadError;

              // 3. Get Public URL
              const { data: urlData } = supabase.storage
                .from('recursos')
                .getPublicUrl(uniquePath);

              const publicUrl = urlData.publicUrl;

              // 4. Insert DB record
              const { error: dbError } = await supabase
                .from('recursos')
                .insert({
                  title,
                  category,
                  file_name: selectedFile.name,
                  file_path: uniquePath,
                  file_size: selectedFile.size,
                  mime_type: selectedFile.type || 'application/octet-stream',
                  public_url: publicUrl,
                  created_by: currentUser?.id || null
                });

              if (dbError) throw dbError;

              toast.show('¡Recurso subido con éxito!', 'success');
              closeModal();
              await loadResources();
            } catch (err) {
              console.error('Error uploading resource:', err);
              toast.show('Error al subir recurso: ' + err.message, 'error');
              if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = origText;
              }
            }
          }
        }
      ]
    });

    // Dropzone event listeners
    const modalEl = document.querySelector('.modal-overlay') || document;
    const dropzone = modalEl.querySelector('#dropzone');
    const fileInput = modalEl.querySelector('#file-input');
    const emptyZone = modalEl.querySelector('#dropzone-empty');
    const previewZone = modalEl.querySelector('#dropzone-preview');
    const previewImgWrap = modalEl.querySelector('#preview-img-wrap');
    const previewImg = modalEl.querySelector('#upload-preview-img');
    const previewFileIcon = modalEl.querySelector('#preview-file-icon');
    const fileNameSpan = modalEl.querySelector('#selected-file-name');
    const fileSizeSpan = modalEl.querySelector('#selected-file-size');
    const btnChangeFile = modalEl.querySelector('#btn-change-file');
    const titleInput = modalEl.querySelector('#resource-title');
    const categorySelect = modalEl.querySelector('#resource-category');

    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnChangeFile) fileInput.click();
    });

    btnChangeFile.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('border-primary', 'bg-neutral-100');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-primary', 'bg-neutral-100');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    function handleFileSelect(file) {
      selectedFile = file;
      fileNameSpan.textContent = file.name;
      fileSizeSpan.textContent = formatBytes(file.size);

      // Auto populate title if blank
      if (!titleInput.value) {
        const defaultName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        titleInput.value = defaultName.replace(/[-_]/g, ' ');
      }

      // Auto detect category
      if (file.type.startsWith('image/')) {
        if (file.name.toLowerCase().includes('logo')) {
          categorySelect.value = 'logos';
        } else {
          categorySelect.value = 'banners';
        }
        const reader = new FileReader();
        reader.onload = (re) => {
          previewImg.src = re.target.result;
          previewImgWrap.classList.remove('hidden');
          previewFileIcon.classList.add('hidden');
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        categorySelect.value = 'documentos';
        previewImgWrap.classList.add('hidden');
        previewFileIcon.classList.remove('hidden');
      } else {
        categorySelect.value = 'otros';
        previewImgWrap.classList.add('hidden');
        previewFileIcon.classList.remove('hidden');
      }

      emptyZone.classList.add('hidden');
      previewZone.classList.remove('hidden');
      previewZone.classList.add('flex');
    }
  }

  // MODAL: EDIT RESOURCE METADATA
  function openEditModal(item) {
    modal.create({
      title: 'Editar Recurso',
      sizeClass: 'max-w-md',
      content: `
        <div class="flex flex-col gap-4 font-sans text-xs">
          <div class="flex flex-col gap-1">
            <label for="edit-title" class="font-mono text-[10px] font-bold text-primary uppercase">Título Descriptivo *</label>
            <input type="text" id="edit-title" required value="${item.title}" class="cohere-input text-xs" />
          </div>

          <div class="flex flex-col gap-1">
            <label for="edit-category" class="font-mono text-[10px] font-bold text-primary uppercase">Categoría *</label>
            <select id="edit-category" class="cohere-input text-xs bg-white">
              <option value="logos" ${item.category === 'logos' ? 'selected' : ''}>Logos</option>
              <option value="banners" ${item.category === 'banners' ? 'selected' : ''}>Banners / Imágenes</option>
              <option value="documentos" ${item.category === 'documentos' ? 'selected' : ''}>Documentos / PDF</option>
              <option value="fichas" ${item.category === 'fichas' ? 'selected' : ''}>Fichas Técnicas</option>
              <option value="otros" ${item.category === 'otros' ? 'selected' : ''}>Otros</option>
            </select>
          </div>

          <div class="p-3 bg-neutral-50 rounded-sm border border-neutral-200 flex flex-col gap-1 text-[11px]">
            <div class="flex justify-between text-neutral-500 font-mono text-[9px]">
              <span>ARCHIVO:</span>
              <span class="font-bold text-primary">${item.file_name}</span>
            </div>
            <div class="flex justify-between text-neutral-500 font-mono text-[9px]">
              <span>TAMAÑO:</span>
              <span class="font-bold text-primary">${formatBytes(item.file_size)}</span>
            </div>
          </div>
        </div>
      `,
      actions: [
        { text: 'Cancelar', primary: false },
        {
          text: 'Guardar Cambios',
          primary: true,
          onClick: async (closeModal) => {
            const modalEl = document.querySelector('.modal-overlay') || document;
            const newTitle = modalEl.querySelector('#edit-title')?.value?.trim();
            const newCategory = modalEl.querySelector('#edit-category')?.value || 'otros';

            if (!newTitle) {
              toast.show('El título no puede estar vacío', 'error');
              return;
            }

            try {
              const { error } = await supabase
                .from('recursos')
                .update({
                  title: newTitle,
                  category: newCategory,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.id);

              if (error) throw error;

              toast.show('Recurso actualizado correctamente', 'success');
              closeModal();
              await loadResources();
            } catch (err) {
              toast.show('Error al actualizar recurso: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  }

  // MODAL: DELETE CONFIRMATION
  function confirmDelete(item) {
    modal.create({
      title: 'Eliminar Recurso',
      content: `
        <div class="flex flex-col gap-3 font-sans text-xs">
          <p class="text-neutral-700">
            ¿Estás seguro de que deseas eliminar el recurso <b>"${item.title}"</b>?
          </p>
          <p class="text-rose-600 text-[11px]">
            * Esta acción borrará el archivo físico de Supabase Storage. Si el recurso está siendo referenciado en correos o páginas externas, la imagen/archivo dejará de visualizarse.
          </p>
        </div>
      `,
      actions: [
        { text: 'Cancelar', primary: false },
        {
          text: 'Sí, Eliminar Permanentemente',
          primary: true,
          danger: true,
          onClick: async (closeModal) => {
            try {
              // 1. Delete from Storage bucket
              if (item.file_path) {
                const { error: storageErr } = await supabase.storage
                  .from('recursos')
                  .remove([item.file_path]);

                if (storageErr) {
                  console.warn('Storage delete warning:', storageErr);
                }
              }

              // 2. Delete DB record
              const { error: dbErr } = await supabase
                .from('recursos')
                .delete()
                .eq('id', item.id);

              if (dbErr) throw dbErr;

              toast.show('Recurso eliminado correctamente', 'success');
              closeModal();
              await loadResources();
            } catch (err) {
              console.error('Error deleting resource:', err);
              toast.show('Error al eliminar recurso: ' + err.message, 'error');
            }
          }
        }
      ]
    });
  }

  // LIGHTBOX / PREVIEW MODAL
  function openLightbox(item) {
    modal.create({
      title: item.title,
      sizeClass: 'max-w-4xl',
      content: `
        <div class="flex flex-col items-center gap-4">
          <div class="w-full max-h-[70vh] flex items-center justify-center bg-neutral-900/5 rounded-sm p-2 overflow-hidden">
            <img src="${item.public_url}" alt="${item.title}" class="max-h-[65vh] max-w-full object-contain rounded-sm shadow-xs" />
          </div>
          <div class="w-full flex items-center justify-between text-xs font-mono text-neutral-500 border-t border-neutral-100 pt-3">
            <span>${item.file_name} (${formatBytes(item.file_size)})</span>
            <a href="${item.public_url}" target="_blank" rel="noopener noreferrer" class="text-action-blue hover:underline">Abrir en pestaña nueva ↗</a>
          </div>
        </div>
      `,
      actions: [
        { text: 'Cerrar', primary: true }
      ]
    });
  }

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
