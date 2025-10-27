/**
 * Rhine Water Level Monitor - Main Application
 * Coordinates all modules and manages application state
 */

// Alert level configuration
const ALERT_LEVELS = {
  NORMAL: {
    min: 0,
    max: 400,
    color: '#4CAF50',
    bgColor: 'rgba(76, 175, 80, 0.1)',
    label: 'Normal',
    labelDE: 'Normal',
    icon: '✓',
    description: 'Der Wasserstand liegt im normalen Bereich.'
  },
  WARNING: {
    min: 400,
    max: 800,
    color: '#FF9800',
    bgColor: 'rgba(255, 152, 0, 0.1)',
    label: 'Warning',
    labelDE: 'Warnung',
    icon: '⚠',
    description: 'Erhöhter Wasserstand - Vorsicht geboten.'
  },
  DANGER: {
    min: 800,
    max: Infinity,
    color: '#F44336',
    bgColor: 'rgba(244, 67, 54, 0.1)',
    label: 'Danger',
    labelDE: 'Gefahr',
    icon: '⚡',
    description: 'Hochwassergefahr - Extreme Vorsicht!'
  }
};

// Application state
const AppState = {
  currentLevel: null,
  lastUpdate: null,
  isLoading: false,
  hasError: false,
  errorMessage: null,
  autoRefreshEnabled: true,
  refreshInterval: 60000, // 60 seconds
  refreshTimer: null
};

/**
 * Main Application Class
 */
class RheinPegelApp {
  constructor() {
    this.api = new RheinPegelAPI();
    this.storage = new WaterLevelStorage();
    this.chart = null;
    
    // DOM elements cache
    this.elements = {};
  }

  /**
   * Initialize the application
   */
  async initialize() {
    console.log('Initializing Rhine Water Level Monitor...');
    
    // Cache DOM elements
    this.cacheElements();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load historical data
    const history = this.storage.getHistoricalData(24);
    console.log('Loaded', history.length, 'historical readings from storage');
    
    // Initialize chart
    const canvas = document.getElementById('waterLevelChart');
    if (canvas) {
      this.chart = new WaterLevelChart(canvas);
      this.chart.initialize(history);
    } else {
      console.error('Chart canvas not found');
    }
    
    // Fetch current data
    await this.fetchAndUpdate();
    
    // Start auto-refresh
    this.startAutoRefresh();
    
    console.log('Application initialized successfully');
  }

  /**
   * Cache DOM elements for better performance
   */
  cacheElements() {
    this.elements = {
      statusCard: document.getElementById('statusCard'),
      statusIcon: document.getElementById('statusIcon'),
      statusBadge: document.getElementById('statusBadge'),
      currentLevel: document.getElementById('currentLevel'),
      statusDescription: document.getElementById('statusDescription'),
      lastUpdate: document.getElementById('lastUpdate'),
      refreshBtn: document.getElementById('refreshBtn'),
      autoRefreshToggle: document.getElementById('autoRefreshToggle'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      errorToast: document.getElementById('errorToast'),
      errorMessage: document.getElementById('errorMessage'),
      successToast: document.getElementById('successToast'),
      successMessage: document.getElementById('successMessage')
    };
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    // Manual refresh button
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => {
        this.handleManualRefresh();
      });
    }

    // Auto-refresh toggle
    if (this.elements.autoRefreshToggle) {
      this.elements.autoRefreshToggle.addEventListener('change', (e) => {
        AppState.autoRefreshEnabled = e.target.checked;
        if (AppState.autoRefreshEnabled) {
          this.showSuccessToast('Auto-Aktualisierung aktiviert');
          this.startAutoRefresh();
        } else {
          this.showSuccessToast('Auto-Aktualisierung deaktiviert');
          this.stopAutoRefresh();
        }
      });
    }

    // Toast close buttons
    document.querySelectorAll('.toast-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.toast').classList.add('hidden');
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // R key for refresh
      if (e.key === 'r' || e.key === 'R') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.handleManualRefresh();
        }
      }
    });
  }

  /**
   * Fetch data from API and update UI
   */
  async fetchAndUpdate() {
    try {
      this.setLoading(true);
      
      // Fetch current data
      const data = await this.api.fetchCurrentLevel();
      
      // Save to storage
      this.storage.saveReading(data);
      
      // Update UI
      this.updateDisplay(data);
      
      // Update chart
      if (this.chart) {
        this.chart.updateChart(data);
        this.chart.highlightAlertZone(data.waterLevel);
      }
      
      // Update state
      AppState.currentLevel = data.waterLevel;
      AppState.lastUpdate = data.timestamp;
      AppState.hasError = false;
      
    } catch (error) {
      console.error('Failed to fetch and update:', error);
      this.handleError(error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Update display with water level data
   * @param {Object} data - Water level data
   */
  updateDisplay(data) {
    // Update water level
    if (this.elements.currentLevel) {
      this.elements.currentLevel.textContent = data.waterLevel;
    }

    // Update timestamp
    if (this.elements.lastUpdate) {
      this.elements.lastUpdate.textContent = `${data.date} ${data.time}`;
    }

    // Get alert level
    const alertLevel = this.getAlertLevel(data.waterLevel);
    
    // Update alert status
    this.updateAlertStatus(alertLevel);

    console.log('Display updated:', data.waterLevel, 'cm -', alertLevel.labelDE);
  }

  /**
   * Update alert status display
   * @param {Object} alertLevel - Alert level configuration
   */
  updateAlertStatus(alertLevel) {
    if (!this.elements.statusCard) return;

    // Update status card background
    this.elements.statusCard.style.backgroundColor = alertLevel.bgColor;
    this.elements.statusCard.style.borderColor = alertLevel.color;
    
    // Update status badge
    if (this.elements.statusBadge) {
      this.elements.statusBadge.style.backgroundColor = alertLevel.color;
      this.elements.statusBadge.textContent = alertLevel.labelDE;
    }

    // Update status icon
    if (this.elements.statusIcon) {
      this.elements.statusIcon.textContent = alertLevel.icon;
    }

    // Update level number color
    if (this.elements.currentLevel) {
      this.elements.currentLevel.style.color = alertLevel.color;
    }

    // Update description
    if (this.elements.statusDescription) {
      this.elements.statusDescription.textContent = alertLevel.description;
    }
  }

  /**
   * Get alert level for water level
   * @param {number} waterLevel - Water level in cm
   * @returns {Object} Alert level configuration
   */
  getAlertLevel(waterLevel) {
    if (waterLevel < ALERT_LEVELS.NORMAL.max) {
      return ALERT_LEVELS.NORMAL;
    } else if (waterLevel < ALERT_LEVELS.WARNING.max) {
      return ALERT_LEVELS.WARNING;
    } else {
      return ALERT_LEVELS.DANGER;
    }
  }

  /**
   * Handle manual refresh button click
   */
  async handleManualRefresh() {
    console.log('Manual refresh triggered');
    
    // Disable button temporarily
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.disabled = true;
    }

    await this.fetchAndUpdate();

    // Re-enable button
    if (this.elements.refreshBtn) {
      setTimeout(() => {
        this.elements.refreshBtn.disabled = false;
      }, 1000);
    }
  }

  /**
   * Start auto-refresh timer
   */
  startAutoRefresh() {
    // Clear existing timer
    this.stopAutoRefresh();

    // Set new timer
    AppState.refreshTimer = setInterval(() => {
      if (AppState.autoRefreshEnabled) {
        console.log('Auto-refresh triggered');
        this.fetchAndUpdate();
      }
    }, AppState.refreshInterval);

    console.log('Auto-refresh started (interval:', AppState.refreshInterval, 'ms)');
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh() {
    if (AppState.refreshTimer) {
      clearInterval(AppState.refreshTimer);
      AppState.refreshTimer = null;
      console.log('Auto-refresh stopped');
    }
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    AppState.isLoading = isLoading;

    if (this.elements.loadingOverlay) {
      if (isLoading) {
        this.elements.loadingOverlay.classList.remove('hidden');
      } else {
        this.elements.loadingOverlay.classList.add('hidden');
      }
    }

    // Disable refresh button while loading
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.disabled = isLoading;
    }
  }

  /**
   * Handle errors
   * @param {Error} error - Error object
   */
  handleError(error) {
    AppState.hasError = true;
    AppState.errorMessage = error.message;

    console.error('Application error:', error);

    // Show error toast
    this.showErrorToast(error.message);

    // Try to show cached data
    const latestReading = this.storage.getLatestReading();
    if (latestReading) {
      console.log('Showing cached data from:', new Date(latestReading.timestamp));
      this.updateDisplay(latestReading);
      this.showSuccessToast('Zeige zwischengespeicherte Daten');
    }
  }

  /**
   * Show error toast
   * @param {string} message - Error message
   */
  showErrorToast(message) {
    if (this.elements.errorToast && this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
      this.elements.errorToast.classList.remove('hidden');

      // Auto-hide after 5 seconds
      setTimeout(() => {
        this.elements.errorToast.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Show success toast
   * @param {string} message - Success message
   */
  showSuccessToast(message) {
    if (this.elements.successToast && this.elements.successMessage) {
      this.elements.successMessage.textContent = message;
      this.elements.successToast.classList.remove('hidden');

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.elements.successToast.classList.add('hidden');
      }, 3000);
    }
  }

  /**
   * Cleanup on app destroy
   */
  destroy() {
    this.stopAutoRefresh();
    if (this.chart) {
      this.chart.destroy();
    }
    console.log('Application destroyed');
  }
}