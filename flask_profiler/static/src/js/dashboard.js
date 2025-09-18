// Dashboard page with grouped summary table
import { APIService, showError, formatElapsed, createMethodBadge } from './utils.js';
import { createTimeSeriesChart, createMethodChart } from './charts.js';
import { ServerSideTable } from './table.js';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const api = new APIService();
let summaryTable;
let timeseriesChart;
let methodChart;
let updateInterval;
let rangeButtons = [];

const DASHBOARD_RANGES = {
  '24h': { amount: 24, unit: 'hour' },
  '7d': { amount: 7, unit: 'day' },
  '30d': { amount: 30, unit: 'day' }
};

let currentRangeKey = '24h';

// Helper functions
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
const isVisible = el => el && el.offsetParent !== null && el.offsetWidth && el.offsetHeight;

export async function initDashboard() {
  const rangeParams = getRangeParams(currentRangeKey);

  // Initialize grouped summary table
  const summaryContainer = document.getElementById('summary-table');
  if (summaryContainer) {
    summaryTable = new ServerSideTable(summaryContainer, '/flask-profiler/api/measurements/grouped', {
      columns: [
        { 
          field: 'method', 
          label: 'Method', 
          sortable: true,
          render: (value) => createMethodBadge(value)
        },
        { field: 'name', label: 'Endpoint', sortable: true },
        { field: 'count', label: 'Count', sortable: true },
        { 
          field: 'avgElapsed',  // Backend uses camelCase
          label: 'Avg Duration', 
          sortable: true,
          render: (value) => formatElapsed(value)
        },
        { 
          field: 'maxElapsed',  // Backend uses camelCase
          label: 'Max Duration', 
          sortable: true,
          render: (value) => formatElapsed(value)
        },
        { 
          field: 'minElapsed',  // Backend uses camelCase
          label: 'Min Duration', 
          sortable: true,
          render: (value) => formatElapsed(value)
        }
      ],
      defaultSort: 'count,desc',
      initialFilters: rangeParams,
      onRowClick: (row) => {
        // Click-to-filter: populate filtering tab with this endpoint's data
        window.location.hash = '#tab-filtering';
        window.dispatchEvent(new CustomEvent('filter-endpoint', { 
          detail: { method: row.method, name: row.name }
        }));
      }
    });
  }

  setupRangeControls();
  await loadDashboardData(currentRangeKey);

  // Setup auto-refresh for relative timestamps
  updateRelativeTime();
  updateInterval = setInterval(updateRelativeTime, 5000);
}

function updateRelativeTime() {
  document.querySelectorAll('[data-timestamp]').forEach(el => {
    const timestamp = Number(el.dataset.timestamp);
    el.textContent = dayjs.unix(timestamp).fromNow();
  });
}

// Cleanup function
export function cleanupDashboard() {
  if (timeseriesChart) {
    timeseriesChart.destroy();
    timeseriesChart = null;
  }
  if (methodChart) {
    methodChart.destroy();
    methodChart = null;
  }
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  rangeButtons.forEach(button => {
    button.removeEventListener('click', handleRangeSelection);
  });
  rangeButtons = [];
}

function getRangeParams(rangeKey = currentRangeKey) {
  const option = DASHBOARD_RANGES[rangeKey] || DASHBOARD_RANGES['24h'];
  const now = dayjs();
  const start = now.subtract(option.amount, option.unit).unix();
  return {
    startedAt: start,
    endedAt: now.unix()
  };
}

async function loadDashboardData(rangeKey = currentRangeKey) {
  currentRangeKey = rangeKey;
  const rangeParams = getRangeParams(rangeKey);
  updateRangeSelection();

  if (summaryTable) {
    await summaryTable.filter(rangeParams);
  }

  let timeseries;
  let methods;
  try {
    [timeseries, methods] = await Promise.all([
      api.fetchTimeseries(rangeParams),
      api.fetchMethodDistribution(rangeParams)
    ]);
  } catch (error) {
    console.error('Data fetch failed:', error);
    showError('Failed to load dashboard data');
    return;
  }

  if (timeseriesChart) {
    timeseriesChart.destroy();
    timeseriesChart = null;
  }
  if (methodChart) {
    methodChart.destroy();
    methodChart = null;
  }

  await nextFrame();

  try {
    const timeseriesCanvas = document.getElementById('timeseries-chart');
    if (isVisible(timeseriesCanvas) && timeseries && timeseries.series) {
      timeseriesChart = createTimeSeriesChart(timeseriesCanvas, timeseries.series);
    }

    const methodCanvas = document.getElementById('method-chart');
    if (isVisible(methodCanvas) && methods && methods.distribution) {
      methodChart = createMethodChart(methodCanvas, methods.distribution);
    }
  } catch (chartError) {
    console.warn('Chart initialization issue:', chartError);
  }
}

function setupRangeControls() {
  const toggle = document.querySelector('.range-toggle');
  if (!toggle) return;

  rangeButtons = Array.from(toggle.querySelectorAll('.range-option'));
  rangeButtons.forEach(button => {
    button.addEventListener('click', handleRangeSelection);
  });
  updateRangeSelection();
}

function handleRangeSelection(event) {
  const { range } = event.currentTarget.dataset;
  if (!range || range === currentRangeKey) {
    return;
  }
  loadDashboardData(range);
}

function updateRangeSelection() {
  rangeButtons.forEach(button => {
    const isActive = button.dataset.range === currentRangeKey;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}
