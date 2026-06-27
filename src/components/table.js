// ============================================
// Reusable Data Table Component
// ============================================

export function renderTable(container, {
  columns,
  data,
  onRowClick,
  searchable = false,
  pageSize = 15,
  id = 'data-table',
  emptyMessage = 'No data found',
}) {
  let currentPage = 0;
  let sortCol = null;
  let sortDir = 'asc';
  let filteredData = [...data];
  let searchTerm = '';

  function applySort(d) {
    if (!sortCol) return d;
    return [...d].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function applySearch(d) {
    if (!searchTerm) return d;
    const term = searchTerm.toLowerCase();
    return d.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
      })
    );
  }

  function renderContent() {
    filteredData = applySort(applySearch(data));
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);
    const start = currentPage * pageSize;
    const pageData = filteredData.slice(start, start + pageSize);

    let html = '';

    if (searchable) {
      html += `
        <div class="actions-row">
          <div class="actions-left">
            <div class="search-container">
              <span class="search-icon">🔍</span>
              <input type="text" class="search-input" id="${id}-search" placeholder="Search..." value="${searchTerm}">
            </div>
            <span class="text-muted" style="font-size:12px">${filteredData.length} records</span>
          </div>
        </div>
      `;
    }

    if (filteredData.length === 0) {
      html += `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">${emptyMessage}</div></div>`;
    } else {
      html += `<div class="table-container glass-card" style="padding:0;overflow:hidden;">`;
      html += `<table class="data-table" id="${id}-table">`;
      html += `<thead><tr>`;
      columns.forEach(col => {
        const isSorted = sortCol === col.key;
        const arrow = isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
        html += `<th class="${isSorted ? 'sorted' : ''} ${col.align === 'right' ? 'text-right' : ''}" data-sort-key="${col.key}">${col.label}${arrow}</th>`;
      });
      html += `</tr></thead><tbody>`;

      pageData.forEach((row, idx) => {
        html += `<tr class="${onRowClick ? 'clickable' : ''}" data-row-index="${start + idx}">`;
        columns.forEach(col => {
          const val = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—');
          html += `<td class="${col.align === 'right' ? 'text-right' : ''}">${val}</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;

      // Pagination
      if (totalPages > 1) {
        html += `<div class="flex items-center justify-between mt-2" style="padding:8px 0">`;
        html += `<span class="text-muted" style="font-size:12px">Page ${currentPage + 1} of ${totalPages}</span>`;
        html += `<div class="btn-group">`;
        html += `<button class="btn btn-sm" id="${id}-prev" ${currentPage === 0 ? 'disabled' : ''}>← Prev</button>`;
        html += `<button class="btn btn-sm" id="${id}-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>`;
        html += `</div></div>`;
      }
    }

    container.innerHTML = html;

    // Event listeners
    if (searchable) {
      const searchInput = document.getElementById(`${id}-search`);
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchTerm = e.target.value;
          currentPage = 0;
          renderContent();
          // Re-focus search input
          const newInput = document.getElementById(`${id}-search`);
          if (newInput) { newInput.focus(); newInput.selectionStart = newInput.selectionEnd = searchTerm.length; }
        });
      }
    }

    // Sort handlers
    container.querySelectorAll('[data-sort-key]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        if (sortCol === key) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = key;
          sortDir = 'asc';
        }
        renderContent();
      });
    });

    // Row click
    if (onRowClick) {
      container.querySelectorAll('[data-row-index]').forEach(tr => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.dataset.rowIndex);
          onRowClick(filteredData[idx], idx);
        });
      });
    }

    // Pagination
    const prevBtn = document.getElementById(`${id}-prev`);
    const nextBtn = document.getElementById(`${id}-next`);
    if (prevBtn) prevBtn.addEventListener('click', () => { currentPage--; renderContent(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentPage++; renderContent(); });
  }

  renderContent();
}
