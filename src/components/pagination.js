export function renderPagination({ currentPage, totalPages, rowsPerPage, onPageChange, onRowsPerPageChange }) {
  const container = document.createElement('div');
  container.className = 'w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-[#d9d9dd] font-sans text-xs select-none';

  if (totalPages < 1) totalPages = 1;

  container.innerHTML = `
    <!-- Page Select Size -->
    <div class="flex items-center gap-2 text-neutral-500">
      <span>Filas por página:</span>
      <select id="rows-per-page-select" class="bg-white border border-[#d9d9dd] rounded-sm py-1 px-1.5 font-mono text-[10px] font-bold text-primary focus:outline-none transition-colors">
        <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
        <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
        <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
      </select>
    </div>

    <!-- Navigation Buttons -->
    <div class="flex items-center gap-4">
      <button 
        id="prev-page-btn" 
        ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-1.5 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all disabled:opacity-30 disabled:pointer-events-none focus:outline-none"
      >
        ◀ Anterior
      </button>

      <div class="font-sans text-xs font-semibold text-primary">
        Página <span class="font-mono">${currentPage}</span> de <span class="font-mono">${totalPages}</span>
      </div>

      <button 
        id="next-page-btn" 
        ${currentPage === totalPages ? 'disabled' : ''} 
        class="px-3 py-1.5 border border-[#d9d9dd] text-[#616161] hover:text-primary hover:border-primary text-[10px] font-mono font-bold uppercase rounded-full bg-white transition-all disabled:opacity-30 disabled:pointer-events-none focus:outline-none"
      >
        Siguiente ▶
      </button>
    </div>
  `;

  const prevBtn = container.querySelector('#prev-page-btn');
  const nextBtn = container.querySelector('#next-page-btn');
  const selectRows = container.querySelector('#rows-per-page-select');

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  });

  selectRows.addEventListener('change', () => {
    onRowsPerPageChange(parseInt(selectRows.value, 10));
  });

  return container;
}
