// Main entry point with tab navigation

// Import CSS files
import '../css/normalize.css';
import '../css/variables.css';
import '../css/base.css';
import '../css/tables.css';
import '../css/components.css';

// Import Flatpickr CSS
import 'flatpickr/dist/flatpickr.min.css';

const REPO_API_URL = 'https://api.github.com/repos/berkpolatCE/flask-profiler-modern';

const TAB_LOADERS = {
  'tab-dashboard': {
    load: () => import('./dashboard.js'),
    init: 'initDashboard',
    cleanup: 'cleanupDashboard'
  },
  'tab-filtering': {
    load: () => import('./filtering.js'),
    init: 'initFiltering',
    cleanup: 'cleanupFiltering'
  },
  'tab-settings': {
    load: () => import('./settings.js'),
    init: 'initSettings',
    cleanup: 'cleanupSettings'
  }
};

class TabManager {
  constructor() {
    this.tabs = {};

    Object.keys(TAB_LOADERS).forEach((tabId) => {
      this.tabs[tabId] = {
        ...TAB_LOADERS[tabId],
        module: null,
        loadPromise: null,
        loaded: false
      };
    });
    
    this.currentTab = null;
    this.init();
  }
  
  init() {
    // Setup tab click handlers
    document.querySelectorAll('.tab-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = this.getTabIdFromLink(link);
        if (tabId) {
          this.switchTab(tabId);
        }
      });

      link.addEventListener('pointerenter', () => {
        const tabId = this.getTabIdFromLink(link);
        if (tabId) {
          this.prefetchTab(tabId).catch(() => {});
        }
      });

      link.addEventListener('focus', () => {
        const tabId = this.getTabIdFromLink(link);
        if (tabId) {
          this.prefetchTab(tabId).catch(() => {});
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
  
  getTabIdFromLink(link) {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) {
      return null;
    }
    return href.substring(1);
  }

  async prefetchTab(tabId) {
    const tab = this.tabs[tabId];
    if (!tab) {
      return null;
    }

    if (tab.module) {
      return tab.module;
    }

    if (!tab.loadPromise) {
      tab.loadPromise = tab.load()
        .then((module) => {
          tab.module = module;
          return module;
        })
        .catch((error) => {
          tab.loadPromise = null;
          throw error;
        });
    }

    return tab.loadPromise;
  }

  async loadTabModule(tabId) {
    return this.prefetchTab(tabId);
  }

  async switchTab(tabId, pushState = true) {
    if (!this.tabs[tabId]) {
      return;
    }

    // Don't switch if already on this tab
    if (this.currentTab === tabId) return;
    
    // Clean up previous tab if needed
    if (this.currentTab && this.tabs[this.currentTab]) {
      const prevTab = this.tabs[this.currentTab];
      if (prevTab.cleanup) {
        try {
          const prevModule = prevTab.module || (prevTab.loadPromise ? await prevTab.loadPromise : null);
          const cleanupFn = prevModule ? prevModule[prevTab.cleanup] : null;
          if (typeof cleanupFn === 'function') {
            cleanupFn();
          }
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
        const module = await this.loadTabModule(tabId);
        if (this.currentTab !== tabId) {
          return;
        }
        const initFn = module ? module[tab.init] : null;
        if (typeof initFn === 'function') {
          await initFn();
          tab.loaded = true;
        } else {
          console.warn(`Missing initializer for ${tabId}`);
        }
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

  fetchStarCount();
});

// Export for potential use in templates
window.FlaskProfiler = {
  TabManager
};

async function fetchStarCount() {
  const countEl = document.getElementById('github-star-count');
  if (!countEl) {
    return;
  }

  try {
    const response = await fetch(REPO_API_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }
    const data = await response.json();
    const stars = typeof data.stargazers_count === 'number' ? data.stargazers_count : 0;
    countEl.textContent = Intl.NumberFormat().format(stars);
  } catch (error) {
    console.warn('Unable to fetch GitHub stars:', error);
    countEl.textContent = '—';
  }
}
