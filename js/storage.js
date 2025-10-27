/**
 * Water Level Storage Module
 * Manages localStorage persistence for historical water level data
 */

class WaterLevelStorage {
  constructor(storageKey = 'rhein-pegel-history') {
    this.storageKey = storageKey;
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.maxEntries = 1440; // One entry per minute for 24 hours
    this.version = '1.0.0';
  }

  /**
   * Save a new water level reading
   * @param {Object} data - Water level data
   * @param {number} data.waterLevel - Water level in cm
   * @param {string} data.date - Date string
   * @param {string} data.time - Time string
   * @param {number} data.timestamp - Unix timestamp
   */
  saveReading(data) {
    try {
      const storage = this.getStorageData();
      
      // Add new reading
      storage.readings.push({
        waterLevel: data.waterLevel,
        date: data.date,
        time: data.time,
        timestamp: data.timestamp
      });

      // Sort by timestamp (newest first)
      storage.readings.sort((a, b) => b.timestamp - a.timestamp);

      // Limit number of entries
      if (storage.readings.length > this.maxEntries) {
        storage.readings = storage.readings.slice(0, this.maxEntries);
      }

      // Update last updated timestamp
      storage.lastUpdated = Date.now();

      // Save to localStorage
      this.setStorageData(storage);

      // Clean old data
      this.cleanOldData();

      return true;
    } catch (error) {
      console.error('Failed to save reading:', error);
      return false;
    }
  }

  /**
   * Get historical data for the specified time period
   * @param {number} hours - Number of hours to retrieve (default: 24)
   * @returns {Array} Array of water level readings
   */
  getHistoricalData(hours = 24) {
    try {
      const storage = this.getStorageData();
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

      // Filter readings within the time period
      const filteredReadings = storage.readings.filter(
        reading => reading.timestamp >= cutoffTime
      );

      // Sort by timestamp (oldest first for chart display)
      return filteredReadings.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to get historical data:', error);
      return [];
    }
  }

  /**
   * Get the most recent reading
   * @returns {Object|null} Most recent reading or null
   */
  getLatestReading() {
    try {
      const storage = this.getStorageData();
      return storage.readings.length > 0 ? storage.readings[0] : null;
    } catch (error) {
      console.error('Failed to get latest reading:', error);
      return null;
    }
  }

  /**
   * Clean data older than maxAge
   */
  cleanOldData() {
    try {
      const storage = this.getStorageData();
      const cutoffTime = Date.now() - this.maxAge;

      // Filter out old readings
      storage.readings = storage.readings.filter(
        reading => reading.timestamp >= cutoffTime
      );

      this.setStorageData(storage);
    } catch (error) {
      console.error('Failed to clean old data:', error);
    }
  }

  /**
   * Clear all stored data
   */
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Export data as JSON
   * @returns {string} JSON string of all data
   */
  exportData() {
    try {
      const storage = this.getStorageData();
      return JSON.stringify(storage, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  /**
   * Get storage data structure
   * @private
   * @returns {Object} Storage object
   */
  getStorageData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      
      if (!data) {
        return this.createEmptyStorage();
      }

      const parsed = JSON.parse(data);

      // Validate version
      if (parsed.version !== this.version) {
        console.warn('Storage version mismatch, resetting...');
        return this.createEmptyStorage();
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse storage data:', error);
      return this.createEmptyStorage();
    }
  }

  /**
   * Save data to localStorage
   * @private
   * @param {Object} data - Data to save
   */
  setStorageData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded, clearing old data...');
        // Remove oldest half of entries
        data.readings = data.readings.slice(0, Math.floor(data.readings.length / 2));
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      } else {
        throw error;
      }
    }
  }

  /**
   * Create empty storage structure
   * @private
   * @returns {Object} Empty storage object
   */
  createEmptyStorage() {
    return {
      version: this.version,
      readings: [],
      lastUpdated: null
    };
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  getStatistics() {
    try {
      const storage = this.getStorageData();
      const dataSize = new Blob([JSON.stringify(storage)]).size;

      return {
        totalReadings: storage.readings.length,
        oldestReading: storage.readings.length > 0 
          ? new Date(storage.readings[storage.readings.length - 1].timestamp)
          : null,
        newestReading: storage.readings.length > 0
          ? new Date(storage.readings[0].timestamp)
          : null,
        lastUpdated: storage.lastUpdated ? new Date(storage.lastUpdated) : null,
        storageSize: dataSize,
        storageSizeKB: (dataSize / 1024).toFixed(2)
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return null;
    }
  }
}