import { createElement } from './dom.js';

// API Service and utilities
export class APIService {
  constructor(baseURL = '/flask-profiler/api') {
    this.baseURL = baseURL;
  }

  async _fetchJson(path, params = {}, init = {}) {
    const url = new URL(`${this.baseURL}${path}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    const response = await fetch(url, init);
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(`HTTP ${response.status}${statusText}`);
    }

    return response.json();
  }

  async fetchMeasurements(params = {}) {
    return this._fetchJson('/measurements/', params);
  }

  async fetchSummary(params = {}) {
    return this._fetchJson('/measurements/grouped', params);
  }

  async fetchTimeseries(params = {}) {
    return this._fetchJson('/measurements/timeseries/', params);
  }

  async fetchMethodDistribution(params = {}) {
    return this._fetchJson('/measurements/methodDistribution/', params);
  }

  async getMeasurementDetail(measurementId) {
    return this._fetchJson(`/measurements/${measurementId}`);
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

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeHTML(value) {
  return value.replace(/[&<>]/g, (char) => HTML_ESCAPE_MAP[char]);
}

export function highlightJSON(data) {
  if (data === undefined) {
    return '';
  }

  const jsonString = JSON.stringify(data, null, 2);
  const escaped = escapeHTML(jsonString);

  return escaped.replace(/("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (match) => {
    let token = match;
    let suffix = '';
    let klass = 'json-token-number';

    if (token.endsWith(':')) {
      suffix = ':';
      token = token.slice(0, -1);
    }

    if (token.startsWith('"')) {
      klass = suffix ? 'json-token-key' : 'json-token-string';
    } else if (token === 'true' || token === 'false') {
      klass = 'json-token-boolean';
    } else if (token === 'null') {
      klass = 'json-token-null';
    } else {
      klass = 'json-token-number';
    }

    return `<span class="${klass}">${token}</span>${suffix}`;
  });
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

  const alert = createElement('div', {
    className: `alert alert-${type}`,
    text: message
  });
  
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
  const label = method ? String(method).toUpperCase() : 'UNKNOWN';
  const badge = createElement('span', {
    className: 'method-badge',
    text: label
  });
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
