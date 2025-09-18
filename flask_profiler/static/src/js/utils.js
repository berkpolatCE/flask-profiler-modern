// API Service and utilities
export class APIService {
  constructor(baseURL = '/flask-profiler/api') {
    this.baseURL = baseURL;
  }

  async fetchMeasurements(params = {}) {
    const url = new URL(`${this.baseURL}/measurements/`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async fetchSummary(params = {}) {
    const url = new URL(`${this.baseURL}/measurements/grouped`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async fetchTimeseries(params = {}) {
    const url = new URL(`${this.baseURL}/measurements/timeseries/`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async fetchMethodDistribution(params = {}) {
    const url = new URL(`${this.baseURL}/measurements/methodDistribution/`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async getMeasurementDetail(measurementId) {
    const response = await fetch(`${this.baseURL}/measurements/${measurementId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async deleteDatabase() {
    // Note: Current backend uses GET, not DELETE
    const response = await fetch('/flask-profiler/db/deleteDatabase');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  // Direct download via browser navigation
  dumpDatabase() {
    window.location.href = '/flask-profiler/db/dumpDatabase';
  }
}

// Safe rendering - always use textContent for untrusted data
export function safeText(element, text) {
  element.textContent = text;
}

// Escape JSON for safe display
export function escapeJSON(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

// Show success message
export function showSuccess(message) {
  showAlert(message, 'success');
}

// Show error message
export function showError(message) {
  showAlert(message, 'error');
}

// Show alert message
function showAlert(message, type = 'info') {
  // Remove any existing alerts
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  // Insert at the beginning of main content
  const main = document.querySelector('.main');
  if (main) {
    main.insertBefore(alert, main.firstChild);
  } else {
    document.body.insertBefore(alert, document.body.firstChild);
  }
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Method color palette reused across charts and tables
const METHOD_COLORS = {
  GET: '#28a745',
  POST: '#007bff',
  PUT: '#ffc107',
  DELETE: '#dc3545',
  PATCH: '#17a2b8',
  HEAD: '#6610f2',
  OPTIONS: '#e83e8c'
};

const METHOD_COLOR_DEFAULT = '#6c757d';

export function getMethodColor(method) {
  if (!method) {
    return METHOD_COLOR_DEFAULT;
  }
  const key = String(method).toUpperCase();
  return METHOD_COLORS[key] || METHOD_COLOR_DEFAULT;
}

export function createMethodBadge(method) {
  const badge = document.createElement('span');
  const label = method ? String(method).toUpperCase() : 'UNKNOWN';
  badge.className = 'method-badge';
  badge.textContent = label;
  badge.style.setProperty('--method-badge-color', getMethodColor(label));
  return badge;
}

// Format elapsed time
export function formatElapsed(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) {
    return '—';
  }
  return `${value.toFixed(7)}s`;
}

// Format timestamp
export function formatTimestamp(unixTimestamp) {
  const date = new Date(Number(unixTimestamp) * 1000);
  return date.toLocaleString();
}
