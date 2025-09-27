// Server-side table component
// Note: Since backend doesn't return total count, we over-fetch by 1 record
// to detect if there's a next page (frontend-only pagination solution)
export class ServerSideTable {
  constructor(container, apiEndpoint, options = {}) {
    this.container = container;
    this.apiEndpoint = apiEndpoint;
    this.currentPage = 0;
    this.pageSize = options.pageSize || 25;
    const optionSizes = Array.isArray(options.pageSizeOptions) && options.pageSizeOptions.length
      ? options.pageSizeOptions.slice()
      : [10, 25, 50, 100];
    if (!optionSizes.includes(this.pageSize)) {
      optionSizes.push(this.pageSize);
    }
    this.pageSizeOptions = optionSizes.sort((a, b) => a - b);
    this.hasNextPage = false;  // Track if there's a next page
    this.pageSizeSelect = null;
    this.pageSizeSelectId = `table-page-size-${Math.random().toString(36).slice(2, 7)}`;
    this.paginationInfoElement = null;
    this.currentDisplayCount = 0;
    
    this.params = {
      skip: 0,
      limit: this.pageSize,
      sort: options.defaultSort || 'endedAt,desc',
      startedAt: null,
      endedAt: null,
      method: null,
      name: null,
      elapsed: null
    };

    if (options.initialFilters) {
      Object.entries(options.initialFilters).forEach(([key, value]) => {
        this.params[key] = value;
      });
    }
    
    this.columns = options.columns || [];
    this.onRowClick = options.onRowClick;
    this.currentSortField = null;
    this.currentSortDir = null;
    
    // Parse initial sort
    if (this.params.sort) {
      const [field, dir] = this.params.sort.split(',');
      this.currentSortField = field;
      this.currentSortDir = dir;
    }
    
    this.init();
  }

  async init() {
    this.render();
    await this.loadData();
  }

  async loadData() {
    try {
      const params = new URLSearchParams();
      // Over-fetch by 1 to detect if there's a next page
      const fetchLimit = this.params.limit + 1;
      
      Object.entries({...this.params, limit: fetchLimit}).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.append(key, value);
        }
      });
      
      const url = new URL(this.apiEndpoint, window.location.origin);
      url.search = params.toString();
      
      const response = await fetch(url);
      const data = await response.json();
      const measurements = data.measurements || data;
      
      // Check if we got more than pageSize records
      this.hasNextPage = measurements.length > this.pageSize;
      
      // Only display pageSize records (remove the extra one if present)
      const displayData = this.hasNextPage 
        ? measurements.slice(0, this.pageSize)
        : measurements;
      
      this.currentDisplayCount = displayData.length;
      this.updateTable(displayData);
      this.updatePagination();
    } catch (error) {
      console.error('Failed to load table data:', error);
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="table-controls">
        <div class="table-filters"></div>
        <div class="table-pagination-info"></div>
      </div>
      <div class="table-container">
        <table class="server-table">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="table-pagination"></div>
    `;
    
    this.paginationInfoElement = this.container.querySelector('.table-pagination-info');
    this.renderPageSizeControl();
    this.renderHeaders();
  }

  renderPageSizeControl() {
    const controls = this.container.querySelector('.table-filters')
      || this.container.querySelector('.table-controls');

    if (!controls) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'table-page-size';

    const label = document.createElement('label');
    label.className = 'filter-label';
    label.setAttribute('for', this.pageSizeSelectId);
    label.textContent = 'Rows per page';

    const select = document.createElement('select');
    select.className = 'filter-input table-page-size__select';
    select.id = this.pageSizeSelectId;
    select.setAttribute('aria-label', 'Rows per page');

    this.pageSizeOptions.forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = size;
      select.appendChild(option);
    });

    select.value = this.pageSize;
    select.addEventListener('change', (event) => {
      const newSize = parseInt(event.target.value, 10);
      if (!Number.isNaN(newSize)) {
        this.changePageSize(newSize);
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    controls.appendChild(wrapper);

    this.pageSizeSelect = select;
  }

  renderHeaders() {
    const thead = this.container.querySelector('thead');
    const headerRow = document.createElement('tr');
    
    this.columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      
      if (col.sortable !== false) {
        th.classList.add('sortable');
        th.dataset.field = col.field;
        
        // Add sort indicator
        if (col.field === this.currentSortField) {
          th.classList.add(`sort-${this.currentSortDir}`);
        }
        
        th.addEventListener('click', () => this.sort(col.field));
      }
      
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
  }

  updateTable(data) {
    const tbody = this.container.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = this.columns.length;
      td.textContent = 'No data available';
      td.style.textAlign = 'center';
      td.style.padding = 'var(--spacing-lg)';
      td.style.color = 'var(--color-text-muted)';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    
    data.forEach(row => {
      const tr = document.createElement('tr');
      
      this.columns.forEach(col => {
        const td = document.createElement('td');
        
        if (col.render) {
          const rendered = col.render(row[col.field], row);
          if (rendered instanceof Node) {
            td.appendChild(rendered);
          } else {
            // Safely set text content for string returns
            td.textContent = String(rendered);
          }
        } else {
          td.textContent = String(row[col.field] ?? '');
        }
        
        tr.appendChild(td);
      });
      
      if (this.onRowClick) {
        tr.classList.add('clickable');
        tr.addEventListener('click', () => this.onRowClick(row));
      }
      
      tbody.appendChild(tr);
    });
  }

  sort(field) {
    const newDir = this.currentSortField === field && this.currentSortDir === 'asc' ? 'desc' : 'asc';
    this.params.sort = `${field},${newDir}`;
    this.params.skip = 0;
    this.currentPage = 0;
    this.currentSortField = field;
    this.currentSortDir = newDir;
    
    // Update sort indicators
    this.container.querySelectorAll('th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.field === field) {
        th.classList.add(`sort-${newDir}`);
      }
    });
    
    this.loadData();
  }

  paginate(page) {
    this.currentPage = page;
    this.params.skip = page * this.pageSize;
    this.loadData();
  }

  changePageSize(newSize) {
    if (newSize === this.pageSize) return;
    this.pageSize = newSize;
    this.params.limit = newSize;
    this.params.skip = 0;
    this.currentPage = 0;
    this.loadData();
  }

  async filter(filters) {
    Object.entries(filters).forEach(([key, value]) => {
      this.params[key] = value === undefined ? null : value;
    });
    this.params.skip = 0;
    this.currentPage = 0;
    return this.loadData();
  }

  updatePagination() {
    const paginationDiv = this.container.querySelector('.table-pagination');
    const hasData = this.currentDisplayCount > 0;
    const startRecord = hasData ? this.currentPage * this.pageSize + 1 : 0;
    const endRecord = hasData ? startRecord + this.currentDisplayCount - 1 : 0;

    if (this.paginationInfoElement) {
      this.paginationInfoElement.textContent = hasData
        ? `Showing ${startRecord}-${endRecord}`
        : '';
    }

    if (!hasData) {
      paginationDiv.textContent = '';
      return;
    }
    
    // Only show pagination if there are multiple pages
    if (this.currentPage === 0 && !this.hasNextPage) {
      paginationDiv.textContent = '';
      return;
    }
    
    let html = '<div class="pagination">';
    
    // Previous button
    if (this.currentPage > 0) {
      html += `<button data-page="${this.currentPage - 1}">Previous</button>`;
    }
    
    // Page info
    html += `<span class="page-info">Showing ${startRecord}-${endRecord}</span>`;
    
    // Next button
    if (this.hasNextPage) {
      html += `<button data-page="${this.currentPage + 1}">Next</button>`;
    }
    
    html += '</div>';
    paginationDiv.innerHTML = html;
    
    // Add event listeners
    paginationDiv.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.paginate(parseInt(e.target.dataset.page));
      });
    });
  }
}
