// Main entry point with tab navigation
import { initDashboard, cleanupDashboard } from './dashboard.js';
import { initFiltering, cleanupFiltering } from './filtering.js';
import { initSettings, cleanupSettings } from './settings.js';

// Import CSS files
import '../css/normalize.css';
import '../css/variables.css';
import '../css/base.css';
import '../css/tables.css';
import '../css/components.css';

// Import Flatpickr CSS
import 'flatpickr/dist/flatpickr.min.css';

class TabManager {
  constructor() {
    this.tabs = {
      'tab-dashboard': { 
        init: initDashboard, 
        cleanup: cleanupDashboard,
        loaded: false 
      },
      'tab-filtering': { 
        init: initFiltering, 
        cleanup: cleanupFiltering,
        loaded: false 
      },
      'tab-settings': { 
        init: initSettings, 
        cleanup: cleanupSettings,
        loaded: false 
      }
    };
    
    this.currentTab = null;
    this.init();
  }
  
  init() {
    // Setup tab click handlers
    document.querySelectorAll('.tab-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const tabId = href.substring(1);
          this.switchTab(tabId);
        }
      });
    });
    
    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
      this.loadTabFromHash();
    });
    
    // Handle popstate for browser navigation
    window.addEventListener('popstate', () => {
      this.loadTabFromHash();
    });
    
    // Load initial tab
    this.loadTabFromHash();
  }
  
  loadTabFromHash() {
    const hash = window.location.hash.substring(1) || 'tab-dashboard';
    if (this.tabs[hash]) {
      this.switchTab(hash, false);  // Don't push state when loading from hash
    }
  }
  
  async switchTab(tabId, pushState = true) {
    // Don't switch if already on this tab
    if (this.currentTab === tabId) return;
    
    // Clean up previous tab if needed
    if (this.currentTab && this.tabs[this.currentTab]) {
      const prevTab = this.tabs[this.currentTab];
      if (prevTab.cleanup) {
        try {
          prevTab.cleanup();
        } catch (error) {
          console.error(`Error cleaning up ${this.currentTab}:`, error);
        }
      }
    }
    
    // Update URL
    if (pushState) {
      window.location.hash = tabId;
    }
    
    // Update active tab styling
    document.querySelectorAll('.tab-link').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${tabId}`);
    });
    
    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
    
    // Update current tab
    this.currentTab = tabId;
    
    // Lazy load tab content
    const tab = this.tabs[tabId];
    if (tab) {
      try {
        // Always re-initialize to ensure fresh data
        await tab.init();
        tab.loaded = true;
      } catch (error) {
        console.error(`Failed to load ${tabId}:`, error);
      }
    }
  }
}

// Wait for DOM to be ready
function domReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

// Initialize the application
domReady(() => {
  // Check if we're on the Flask-Profiler page
  const isProfilerPage = document.querySelector('.flask-profiler-app');
  if (isProfilerPage) {
    new TabManager();
  }
});

// Export for potential use in templates
window.FlaskProfiler = {
  TabManager
};