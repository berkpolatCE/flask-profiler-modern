// Chart components
import Chart from 'chart.js/auto';
import { getMethodColor } from './utils.js';

export function createTimeSeriesChart(canvas, seriesData) {
  // Transform backend format { "label": count } to arrays
  const labels = Object.keys(seriesData).sort();
  const values = labels.map(label => seriesData[label]);
  
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Request Count',
        data: values,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.1,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      plugins: {
        legend: { 
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { 
            display: true, 
            text: 'Request Count' 
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time'
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

export function createMethodChart(canvas, data) {
  // Ensure we have data
  if (!data || Object.keys(data).length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6c757d';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    return null;
  }
  
  const labels = Object.keys(data);
  const values = labels.map(label => data[label]);
  const colors = labels.map(label => getMethodColor(label));

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

// Destroy chart if it exists
export function destroyChart(chart) {
  if (chart) {
    chart.destroy();
  }
}
