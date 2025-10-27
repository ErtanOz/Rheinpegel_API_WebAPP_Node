/**
 * Rhine Water Level API Module
 * Handles communication with the Cologne water level API
 */

class RheinPegelAPI {
  constructor(apiUrl = null) {
    // Use local proxy if running on localhost, otherwise try direct API
    this.apiUrl = apiUrl || this.getDefaultApiUrl();
    this.timeout = 10000; // 10 seconds
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.useCorsProxy = false;
    this.corsProxyUrl = 'https://cors-anywhere.herokuapp.com/';
  }

  /**
   * Get default API URL based on environment
   * @returns {string} API URL
   */
  getDefaultApiUrl() {
    // Check if running on localhost
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    
    if (isLocalhost && window.location.port) {
      // Use local proxy server
      return `http://localhost:${window.location.port}/api/pegel`;
    }
    
    // Try direct API (will likely fail due to CORS)
    return 'https://www.stadt-koeln.de/interne-dienste/hochwasser/pegel_ws.php';
  }

  /**
   * Fetch current water level from API
   * @returns {Promise<Object>} Water level data
   */
  async fetchCurrentLevel() {
    let lastError = null;

    // Try direct fetch first
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Fetching water level data (attempt ${attempt}/${this.maxRetries})...`);
        
        const url = this.useCorsProxy ? this.corsProxyUrl + this.apiUrl : this.apiUrl;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlText = await response.text();
        const data = this.parseXMLResponse(xmlText);

        console.log('Water level data fetched successfully:', data);
        return data;

      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        // If it's a CORS error and we haven't tried the proxy yet
        if (this.isCorsError(error) && !this.useCorsProxy && attempt === 1) {
          console.warn('CORS error detected, will try with proxy on next attempt');
          this.useCorsProxy = true;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to fetch data after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Parse XML response from API
   * @param {string} xmlString - XML response string
   * @returns {Object} Parsed water level data
   */
  parseXMLResponse(xmlString) {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('XML parsing error: ' + parserError.textContent);
      }

      // Extract data from XML
      const datum = xmlDoc.querySelector('Datum')?.textContent;
      const uhrzeit = xmlDoc.querySelector('Uhrzeit')?.textContent;
      const pegel = xmlDoc.querySelector('Pegel')?.textContent;
      const grafik = xmlDoc.querySelector('Grafik')?.textContent;

      // Validate required fields
      if (!datum || !uhrzeit || !pegel) {
        throw new Error('Missing required fields in XML response');
      }

      // Convert German decimal to centimeters
      const waterLevel = this.convertGermanDecimal(pegel);

      // Create timestamp from date and time
      const timestamp = this.parseGermanDateTime(datum, uhrzeit);

      return {
        waterLevel,
        date: datum.trim(),
        time: uhrzeit.trim(),
        timestamp,
        graphic: grafik?.trim() || null
      };

    } catch (error) {
      console.error('Failed to parse XML:', error);
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  /**
   * Convert German decimal format to centimeters
   * @param {string} germanNumber - Number in German format (e.g., "3,68")
   * @returns {number} Water level in centimeters
   */
  convertGermanDecimal(germanNumber) {
    try {
      // Replace comma with dot and parse as float
      const meters = parseFloat(germanNumber.trim().replace(',', '.'));
      
      if (isNaN(meters)) {
        throw new Error(`Invalid number format: ${germanNumber}`);
      }

      // Convert meters to centimeters and round
      const centimeters = Math.round(meters * 100);

      // Validate range (0-2000 cm is reasonable for Rhine)
      if (centimeters < 0 || centimeters > 2000) {
        console.warn(`Water level ${centimeters} cm seems out of normal range`);
      }

      return centimeters;

    } catch (error) {
      console.error('Failed to convert German decimal:', error);
      throw new Error(`Number conversion failed: ${error.message}`);
    }
  }

  /**
   * Parse German date and time to timestamp
   * @param {string} dateStr - German date string (e.g., "27. Oktober 2025")
   * @param {string} timeStr - Time string (e.g., "15:25")
   * @returns {number} Unix timestamp in milliseconds
   */
  parseGermanDateTime(dateStr, timeStr) {
    try {
      // German month names
      const monthNames = {
        'Januar': 0, 'Februar': 1, 'März': 2, 'April': 3,
        'Mai': 4, 'Juni': 5, 'Juli': 6, 'August': 7,
        'September': 8, 'Oktober': 9, 'November': 10, 'Dezember': 11
      };

      // Parse date: "27. Oktober 2025"
      const dateMatch = dateStr.match(/(\d+)\.\s+(\w+)\s+(\d{4})/);
      if (!dateMatch) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }

      const day = parseInt(dateMatch[1]);
      const monthName = dateMatch[2];
      const year = parseInt(dateMatch[3]);

      const month = monthNames[monthName];
      if (month === undefined) {
        throw new Error(`Unknown month: ${monthName}`);
      }

      // Parse time: "15:25"
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) {
        throw new Error(`Invalid time format: ${timeStr}`);
      }

      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);

      // Create Date object
      const date = new Date(year, month, day, hours, minutes);
      
      return date.getTime();

    } catch (error) {
      console.error('Failed to parse date/time:', error);
      // Return current time as fallback
      return Date.now();
    }
  }

  /**
   * Check if error is a CORS error
   * @param {Error} error - Error to check
   * @returns {boolean} True if CORS error
   */
  isCorsError(error) {
    return error.message.includes('CORS') ||
           error.message.includes('Network request failed') ||
           error.name === 'TypeError' && error.message.includes('Failed to fetch');
  }

  /**
   * Delay helper for retries
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test API connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async testConnection() {
    try {
      await this.fetchCurrentLevel();
      return true;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Enable CORS proxy
   * @param {string} proxyUrl - CORS proxy URL
   */
  enableCorsProxy(proxyUrl = null) {
    this.useCorsProxy = true;
    if (proxyUrl) {
      this.corsProxyUrl = proxyUrl;
    }
    console.log('CORS proxy enabled:', this.corsProxyUrl);
  }

  /**
   * Disable CORS proxy
   */
  disableCorsProxy() {
    this.useCorsProxy = false;
    console.log('CORS proxy disabled');
  }
}