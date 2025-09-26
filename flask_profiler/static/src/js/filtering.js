// Filtering page with date range picker
import { APIService, showError, formatElapsed, formatTimestamp, createMethodBadge, highlightJSON } from './utils.js';
import { ServerSideTable } from './table.js';
import flatpickr from 'flatpickr';
import dayjs from 'dayjs';

const api = new APIService();
let filteringTable;
let dateRangePicker;

export function initFiltering() {
  const container = document.getElementById('filtering-table');
  
  if (!container) {
    console.error('Filtering table container not found');
    return;
  }
  
  // Initialize server-side table for filtering
  filteringTable = new ServerSideTable(container, '/flask-profiler/api/measurements/', {
    pageSize: 25,
    columns: [
      { 
        field: 'method', 
        label: 'Method', 
        sortable: true,
        render: (value) => createMethodBadge(value)
      },
      { field: 'name', label: 'Endpoint', sortable: true },
      { 
        field: 'elapsed', 
        label: 'Duration', 
        sortable: true,
        render: (value) => formatElapsed(value)
      },
      { 
        field: 'startedAt', 
        label: 'Started At', 
        sortable: true,
        render: (value) => formatTimestamp(value)
      },
      {
        field: 'id',
        label: 'Actions',
        sortable: false,
        render: (value) => {
          const button = document.createElement('button');
          button.className = 'btn-view';
          button.dataset.id = String(value);
          button.textContent = 'View JSON';
          return button;
        }
      }
    ],
    defaultSort: 'endedAt,desc'
  });
  
  // Initialize date range picker with time and seconds
  const dateInput = document.getElementById('date-range');
  if (dateInput) {
    dateRangePicker = flatpickr(dateInput, {
      mode: 'range',
      enableTime: true,
      enableSeconds: true,
      dateFormat: 'Y-m-d H:i:S',
      time_24hr: true,
      defaultDate: [
        dayjs().subtract(7, 'day').toDate(),
        new Date()
      ],
      onChange: (selectedDates) => {
        if (selectedDates.length === 2) {
          filteringTable.filter({
            startedAt: Math.floor(selectedDates[0].getTime() / 1000),
            endedAt: Math.floor(selectedDates[1].getTime() / 1000)
          });
        }
      }
    });
  }
  
  // Setup filter controls
  setupFilterControls();
  enhanceMethodDropdown();
  
  // Listen for click-to-filter events from dashboard
  window.addEventListener('filter-endpoint', handleFilterEndpoint);
  
  // Handle View JSON buttons
  container.addEventListener('click', handleViewJSON);
}

function setupFilterControls() {
  const applyBtn = document.getElementById('apply-filters');
  const resetBtn = document.getElementById('reset-filters');
  
  if (applyBtn) {
    applyBtn.addEventListener('click', applyFilters);
  }
  
  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }
  
  // Apply filters on Enter key
  document.querySelectorAll('.filter-input').forEach(input => {
    if (input.tagName === 'SELECT') {
      input.addEventListener('change', applyFilters);
      return;
    }

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyFilters();
    });
  });
}

function enhanceMethodDropdown() {
  const select = document.getElementById('filter-method');
  if (!select || select.dataset.dropdownEnhanced === 'true') {
    return;
  }

  const parent = select.parentElement;
  if (!parent) {
    return;
  }

  select.dataset.dropdownEnhanced = 'true';

  const wrapper = document.createElement('div');
  wrapper.className = 'enhanced-dropdown';
  parent.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  select.classList.add('enhanced-dropdown__native');
  select.setAttribute('aria-hidden', 'true');

  const associatedLabel = document.querySelector(`label[for="${select.id}"]`);
  if (associatedLabel && !associatedLabel.id) {
    associatedLabel.id = `${select.id}-label`;
  }

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'enhanced-dropdown__trigger';
  trigger.id = `${select.id}-toggle`;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  if (associatedLabel) {
    trigger.setAttribute('aria-labelledby', `${associatedLabel.id} ${trigger.id}`);
  } else if (select.getAttribute('aria-label')) {
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'enhanced-dropdown__label';
  trigger.appendChild(labelEl);

  const chevronEl = document.createElement('span');
  chevronEl.className = 'enhanced-dropdown__chevron';
  chevronEl.setAttribute('aria-hidden', 'true');
  trigger.appendChild(chevronEl);

  wrapper.appendChild(trigger);

  const menu = document.createElement('ul');
  menu.className = 'enhanced-dropdown__menu';
  menu.id = `${select.id}-menu`;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('tabindex', '-1');
  trigger.setAttribute('aria-controls', menu.id);
  wrapper.appendChild(menu);

  const optionNodes = Array.from(select.options).map((option) => {
    const optionItem = document.createElement('li');
    optionItem.className = 'enhanced-dropdown__option';
    optionItem.dataset.value = option.value;
    optionItem.setAttribute('role', 'option');
    optionItem.setAttribute('tabindex', '-1');
    optionItem.textContent = option.textContent;
    menu.appendChild(optionItem);
    return optionItem;
  });

  const setSelected = (value = select.value ?? '') => {
    let target = optionNodes.find((node) => (node.dataset.value ?? '') === value);
    if (!target) {
      target = optionNodes[0];
    }

    optionNodes.forEach((node) => node.removeAttribute('aria-selected'));
    if (target) {
      target.setAttribute('aria-selected', 'true');
      labelEl.textContent = target.textContent;
    } else {
      labelEl.textContent = '';
    }

    return target;
  };

  const closeMenu = () => {
    wrapper.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  const focusOptionByOffset = (current, offset) => {
    if (!current) {
      return;
    }

    const currentIndex = optionNodes.indexOf(current);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = (currentIndex + offset + optionNodes.length) % optionNodes.length;
    optionNodes[nextIndex]?.focus();
  };

  const openMenu = () => {
    wrapper.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    const active = menu.querySelector('.enhanced-dropdown__option[aria-selected="true"]') ?? optionNodes[0];
    active?.focus();
  };

  const toggleMenu = () => {
    if (wrapper.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    toggleMenu();
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!wrapper.classList.contains('is-open')) {
        openMenu();
        return;
      }

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const activeEl = document.activeElement;
      const current = (activeEl && activeEl.classList && activeEl.classList.contains('enhanced-dropdown__option'))
        ? activeEl
        : menu.querySelector('.enhanced-dropdown__option[aria-selected="true"]');
      focusOptionByOffset(current, direction);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMenu();
    } else if (event.key === 'Escape') {
      closeMenu();
      trigger.focus();
    }
  });

  optionNodes.forEach((optionItem) => {
    optionItem.addEventListener('click', (event) => {
      event.preventDefault();
      const value = optionItem.dataset.value ?? '';
      select.value = value;
      setSelected(value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      closeMenu();
      trigger.focus();
    });

    optionItem.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusOptionByOffset(optionItem, 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        focusOptionByOffset(optionItem, -1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        optionItem.click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        trigger.focus();
      }
    });
  });

  select.addEventListener('change', () => {
    setSelected(select.value ?? '');
  });

  const onDocumentClick = (event) => {
    if (!wrapper.contains(event.target)) {
      closeMenu();
    }
  };

  document.addEventListener('click', onDocumentClick);

  select._enhancedDropdown = {
    sync: (value) => setSelected(value ?? ''),
    close: closeMenu
  };

  setSelected();
}

function handleFilterEndpoint(e) {
  const { method, name } = e.detail;
  const methodInput = document.getElementById('filter-method');
  const nameInput = document.getElementById('filter-name');

  if (nameInput) nameInput.value = name;

  if (methodInput) {
    methodInput.value = method ? method.toUpperCase() : '';
    methodInput.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    applyFilters();
  }
}

async function handleViewJSON(e) {
  if (e.target.classList.contains('btn-view')) {
    const id = e.target.dataset.id;
    await showMeasurementDetail(id);
  }
}

function applyFilters() {
  const filters = {};
  
  const method = document.getElementById('filter-method')?.value;
  if (method) filters.method = method;
  
  const name = document.getElementById('filter-name')?.value;
  if (name) filters.name = name;
  
  const elapsed = document.getElementById('filter-elapsed')?.value;
  if (elapsed) filters.elapsed = parseFloat(elapsed);
  
  filteringTable.filter(filters);
}

function resetFilters() {
  // Clear input fields
  document.querySelectorAll('.filter-input').forEach(input => {
    if (input.tagName === 'SELECT') {
      input.selectedIndex = 0;
      input.value = '';
      if (input._enhancedDropdown && typeof input._enhancedDropdown.sync === 'function') {
        input._enhancedDropdown.sync('');
      }
      if (input._enhancedDropdown && typeof input._enhancedDropdown.close === 'function') {
        input._enhancedDropdown.close();
      }
      return;
    }

    input.value = '';
  });
  
  // Reset date range to last 7 days
  if (dateRangePicker) {
    dateRangePicker.setDate([
      dayjs().subtract(7, 'day').toDate(),
      new Date()
    ]);
  }
  
  // Reset table filters
  filteringTable.filter({
    startedAt: Math.floor(dayjs().subtract(7, 'day').valueOf() / 1000),
    endedAt: Math.floor(Date.now() / 1000)
  });
}

async function showMeasurementDetail(id) {
  try {
    const detail = await api.getMeasurementDetail(id);
    
    // Create modal with JSON viewer
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="modal-close">&times;</span>
        <h3>Measurement Details</h3>
        <pre class="json-viewer"></pre>
      </div>
    `;
    
    // Safely render JSON with escaped HTML
    const jsonViewer = modal.querySelector('.json-viewer');
    jsonViewer.classList.add('json-viewer-highlighted');
    jsonViewer.innerHTML = highlightJSON(detail);
    
    document.body.appendChild(modal);
    
    // Close modal on click
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
  } catch (error) {
    console.error('Failed to load measurement detail:', error);
    showError('Failed to load measurement details');
  }
}

// Cleanup function
export function cleanupFiltering() {
  if (dateRangePicker) {
    dateRangePicker.destroy();
    dateRangePicker = null;
  }
  window.removeEventListener('filter-endpoint', handleFilterEndpoint);
}
