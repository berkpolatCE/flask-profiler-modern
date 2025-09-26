// Filtering page with date range picker
import { APIService, showError, formatElapsed, formatTimestamp, createMethodBadge, highlightJSON } from './utils.js';
import { enhanceDropdown } from './enhancedDropdown.js';
import { ServerSideTable } from './table.js';
import flatpickr from 'flatpickr';
import dayjs from 'dayjs';

const api = new APIService();
let filteringTable;
let dateRangePicker;
let methodDropdown;

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
  methodDropdown = enhanceDropdown(document.getElementById('filter-method'));
  
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

function handleFilterEndpoint(e) {
  const { method, name } = e.detail;
  const methodInput = document.getElementById('filter-method');
  const nameInput = document.getElementById('filter-name');

  if (nameInput) nameInput.value = name;

  if (methodInput) {
    methodInput.value = method ? method.toUpperCase() : '';
    methodInput.dispatchEvent(new Event('change', { bubbles: true }));
    methodDropdown?.sync(methodInput.value ?? '');
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
      if (input === methodDropdown?.element) {
        methodDropdown.sync('');
        methodDropdown.close();
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
  if (methodDropdown) {
    methodDropdown.destroy();
    methodDropdown = null;
  }
  window.removeEventListener('filter-endpoint', handleFilterEndpoint);
}
