// Settings page
import { APIService, showSuccess, showError } from './utils.js';

const api = new APIService();

export function initSettings() {
  const dumpBtn = document.getElementById('dump-database');
  const clearBtn = document.getElementById('clear-database');

  if (dumpBtn) {
    dumpBtn.addEventListener('click', handleDumpDatabase);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', handleClearDatabase);
  }
  
  // Display current settings if available
  displayCurrentSettings();
}

function handleDumpDatabase() {
  if (!confirm('Export all profiling data?')) return;
  
  try {
    // Direct download via browser navigation (uses Content-Disposition)
    api.dumpDatabase();
    showSuccess('Database export started');
  } catch (error) {
    console.error('Failed to export database:', error);
    showError('Failed to export database');
  }
}

async function handleClearDatabase() {
  if (!confirm('Delete all profiling data? This cannot be undone.')) return;
  
  try {
    // Show loading state
    const clearBtn = document.getElementById('clear-database');
    const originalText = clearBtn.textContent;
    clearBtn.textContent = 'Clearing...';
    clearBtn.disabled = true;
    
    await api.deleteDatabase();  // Uses GET method per current backend
    
    showSuccess('Database cleared successfully');
    
    // Reload page after a short delay to reflect changes
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    
  } catch (error) {
    console.error('Failed to clear database:', error);
    showError('Failed to clear database');
    
    // Restore button state
    const clearBtn = document.getElementById('clear-database');
    clearBtn.textContent = 'Clear Database';
    clearBtn.disabled = false;
  }
}

function displayCurrentSettings() {
  // Display current configuration if we have a settings display area
  const settingsDisplay = document.getElementById('settings-display');
  if (settingsDisplay) {
    // This would typically fetch current settings from the backend
    // For now, we'll display some basic info
    const settings = {
      'Storage Backend': 'SQLite',
      'Data Retention': 'Unlimited',
      'Sampling Rate': '100%',
      'Authentication': 'Basic Auth Enabled'
    };
    
    let html = '<dl class="settings-list">';
    for (const [key, value] of Object.entries(settings)) {
      html += `
        <dt>${key}:</dt>
        <dd>${value}</dd>
      `;
    }
    html += '</dl>';
    
    settingsDisplay.innerHTML = html;
  }
}

// Cleanup function
export function cleanupSettings() {
  // Remove event listeners if needed
  const dumpBtn = document.getElementById('dump-database');
  const clearBtn = document.getElementById('clear-database');
  
  if (dumpBtn) {
    dumpBtn.removeEventListener('click', handleDumpDatabase);
  }
  
  if (clearBtn) {
    clearBtn.removeEventListener('click', handleClearDatabase);
  }
}