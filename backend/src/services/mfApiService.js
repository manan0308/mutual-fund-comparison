const axios = require('axios');
const logger = require('../utils/logger');
const database = require('../database');

class MutualFundApiService {
  constructor() {
    this.baseURL = process.env.MF_API_BASE_URL || 'https://api.mfapi.in';
    this.timeout = parseInt(process.env.API_REQUEST_TIMEOUT) || 30000;
    this.databaseEnabled = process.env.ENABLE_DATABASE === 'true';
    
    // In-memory cache
    this.memoryCache = new Map();
    this.cacheExpiry = new Map();
    this.DEFAULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'MutualFundComparison/1.0',
        'Accept': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('MF API Request', { 
          url: config.url, 
          method: config.method?.toUpperCase() 
        });
        return config;
      },
      (error) => {
        logger.error('MF API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('MF API Response', { 
          url: response.config.url, 
          status: response.status,
          dataSize: JSON.stringify(response.data).length 
        });
        return response;
      },
      (error) => {
        logger.error('MF API Response Error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  handleApiError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      return new Error(`MF API Error (${status}): ${data?.message || 'Unknown error'}`);
    } else if (error.request) {
      // Request was made but no response received
      return new Error('MF API Error: No response received from server');
    } else {
      // Something else happened
      return new Error(`MF API Error: ${error.message}`);
    }
  }

  async getAllFunds(useCache = true) {
    const cacheKey = 'mf_all_funds';
    
    try {
      // Try memory cache first
      if (useCache && this.isMemoryCacheValid(cacheKey)) {
        logger.debug('Retrieved funds from memory cache');
        return this.memoryCache.get(cacheKey);
      }

      // Try database cache if enabled
      if (useCache && this.databaseEnabled) {
        try {
          const cachedData = await database.getCache(cacheKey);
          if (cachedData) {
            logger.debug('Retrieved funds from database cache');
            this.setMemoryCache(cacheKey, cachedData);
            return cachedData;
          }
        } catch (dbError) {
          logger.warn('Database cache failed, continuing with API', { error: dbError.message });
        }
      }

      logger.info('Fetching all funds from MF API');
      const startTime = Date.now();
      
      const response = await this.client.get('/mf');
      const funds = response.data;

      logger.performance('getAllFunds', startTime);
      
      // Cache in memory
      this.setMemoryCache(cacheKey, funds);
      
      // Cache in database if enabled
      if (useCache && this.databaseEnabled) {
        try {
          await database.setCache(cacheKey, funds, parseInt(process.env.CACHE_TTL_FUNDS) || 86400000);
        } catch (dbError) {
          logger.warn('Database cache set failed', { error: dbError.message });
        }
      }

      // Store in database for search functionality if enabled
      if (this.databaseEnabled) {
        await this.storeFundsInDatabase(funds);
      }

      return funds;
    } catch (error) {
      logger.error('Error fetching all funds', error);
      throw error;
    }
  }

  async getFundNavData(schemeCode, useCache = true) {
    const cacheKey = `mf_nav_${schemeCode}`;
    
    try {
      // Try memory cache first
      if (useCache && this.isMemoryCacheValid(cacheKey)) {
        logger.debug('Retrieved NAV data from memory cache', { schemeCode });
        return this.memoryCache.get(cacheKey);
      }

      // Try database cache if enabled
      if (useCache && this.databaseEnabled) {
        try {
          const cachedData = await database.getCache(cacheKey);
          if (cachedData) {
            logger.debug('Retrieved NAV data from database cache', { schemeCode });
            this.setMemoryCache(cacheKey, cachedData);
            return cachedData;
          }
        } catch (dbError) {
          logger.warn('Database cache failed for NAV data', { schemeCode, error: dbError.message });
        }
      }

      logger.info('Fetching NAV data from MF API', { schemeCode });
      const startTime = Date.now();
      
      const response = await this.client.get(`/mf/${schemeCode}`);
      const navData = response.data;

      logger.performance('getFundNavData', startTime);
      
      // Cache in memory
      this.setMemoryCache(cacheKey, navData);
      
      // Cache in database if enabled
      if (useCache && this.databaseEnabled) {
        try {
          await database.setCache(cacheKey, navData, parseInt(process.env.CACHE_TTL_NAV) || 3600000);
        } catch (dbError) {
          logger.warn('Database cache set failed for NAV data', { schemeCode, error: dbError.message });
        }
      }

      // Store NAV data in database if enabled
      if (this.databaseEnabled && navData.data && Array.isArray(navData.data)) {
        await this.storeNavDataInDatabase(schemeCode, navData.data);
      }

      return navData;
    } catch (error) {
      logger.error('Error fetching NAV data', { schemeCode, error: error.message });
      throw error;
    }
  }

  async searchFunds(searchTerm, limit = 50) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        // Return popular funds for empty search - use cached data
        const popularFunds = this.getPopularFunds(limit);
        if (popularFunds.length > 0) {
          return popularFunds;
        }
        
        // Fallback to API only if no cache
        const allFunds = await this.getAllFunds();
        return allFunds.slice(0, limit).map(fund => this.formatFundForApi(fund));
      }

      // Try database search first if enabled
      if (this.databaseEnabled) {
        try {
          const dbResults = await database.searchSchemes(searchTerm, limit);
          if (dbResults.length > 0) {
            logger.debug('Found funds in database', { searchTerm, count: dbResults.length });
            return dbResults.map(fund => this.formatFundFromDb(fund));
          }
        } catch (dbError) {
          logger.warn('Database search failed, falling back to cache/API', { searchTerm, error: dbError.message });
        }
      }

      // Search in memory cache first
      const allFunds = await this.getAllFunds();
      const filteredFunds = allFunds.filter(fund =>
        fund.schemeName.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, limit);

      logger.debug('Found funds via cache search', { searchTerm, count: filteredFunds.length });
      return filteredFunds.map(fund => this.formatFundForApi(fund));
    } catch (error) {
      logger.error('Error searching funds', { searchTerm, error: error.message });
      throw error;
    }
  }

  // Memory cache helper methods
  setMemoryCache(key, data, ttl = this.DEFAULT_CACHE_TTL) {
    this.memoryCache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + ttl);
  }

  isMemoryCacheValid(key) {
    if (!this.memoryCache.has(key)) return false;
    if (Date.now() > this.cacheExpiry.get(key)) {
      this.memoryCache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    return true;
  }

  getPopularFunds(limit = 50) {
    // Return some popular funds from memory cache if available
    const popularSchemes = [
      '120503', '118989', '119551', '120716', '122639', '120834', 
      '101206', '120505', '149181', '118825', '119578', '120503'
    ];
    
    const allFundsKey = 'mf_all_funds';
    if (this.isMemoryCacheValid(allFundsKey)) {
      const allFunds = this.memoryCache.get(allFundsKey);
      const popularFunds = popularSchemes
        .map(code => allFunds.find(fund => fund.schemeCode.toString() === code))
        .filter(Boolean)
        .slice(0, limit);
      
      if (popularFunds.length > 0) {
        return popularFunds.map(fund => this.formatFundForApi(fund));
      }
    }
    
    return [];
  }

  async storeFundsInDatabase(funds) {
    if (!this.databaseEnabled) return;
    
    try {
      logger.info('Storing funds in database', { count: funds.length });
      
      for (const fund of funds.slice(0, 1000)) { // Limit to prevent overwhelming the DB
        const schemeData = {
          scheme_code: fund.schemeCode,
          scheme_name: fund.schemeName,
          scheme_category: this.categorizeScheme(fund.schemeName),
          fund_house: this.extractFundHouse(fund.schemeName),
          scheme_type: 'Open Ended'
        };
        
        await database.upsertScheme(schemeData);
      }
      
      logger.info('Successfully stored funds in database');
    } catch (error) {
      logger.error('Error storing funds in database', error);
      // Don't throw - this is not critical for API functionality
    }
  }

  async storeNavDataInDatabase(schemeCode, navDataArray) {
    if (!this.databaseEnabled) return;
    
    try {
      const formattedNavData = navDataArray.map(item => ({
        scheme_code: schemeCode,
        nav_date: this.convertDateFormat(item.date),
        nav_value: parseFloat(item.nav)
      })).filter(item => !isNaN(item.nav_value));

      if (formattedNavData.length > 0) {
        await database.insertNavData(formattedNavData);
      }
    } catch (error) {
      logger.error('Error storing NAV data in database', { schemeCode, error: error.message });
      // Don't throw - this is not critical for API functionality
    }
  }

  formatFundForApi(fund) {
    return {
      id: fund.schemeCode,
      name: fund.schemeName,
      schemeCode: fund.schemeCode,
      category: this.categorizeScheme(fund.schemeName),
      nav: null // Will be fetched separately if needed
    };
  }

  formatFundFromDb(fund) {
    return {
      id: fund.scheme_code,
      name: fund.scheme_name,
      schemeCode: fund.scheme_code,
      category: fund.scheme_category,
      nav: null
    };
  }

  categorizeScheme(schemeName) {
    const name = schemeName.toLowerCase();
    
    if (name.includes('large cap') || name.includes('bluechip')) return 'Large Cap';
    if (name.includes('mid cap')) return 'Mid Cap';
    if (name.includes('small cap')) return 'Small Cap';
    if (name.includes('flexi cap') || name.includes('multi cap')) return 'Flexi Cap';
    if (name.includes('index')) return 'Index';
    if (name.includes('debt') || name.includes('bond') || name.includes('income')) return 'Debt';
    if (name.includes('hybrid')) return 'Hybrid';
    if (name.includes('sector') || name.includes('thematic')) return 'Sectoral/Thematic';
    if (name.includes('elss')) return 'ELSS';
    
    return 'Equity';
  }

  extractFundHouse(schemeName) {
    const fundHouses = [
      'SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Reliance', 'Birla', 'UTI',
      'Franklin', 'DSP', 'Invesco', 'Nippon', 'Mirae', 'Sundaram',
      'Tata', 'PGIM', 'Quantum', 'Mahindra', 'IDFC', 'L&T'
    ];
    
    for (const house of fundHouses) {
      if (schemeName.toLowerCase().includes(house.toLowerCase())) {
        return house;
      }
    }
    
    return 'Others';
  }

  convertDateFormat(dateString) {
    // Convert DD-MM-YYYY to YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  }

  async getHealthStatus() {
    try {
      const response = await this.client.get('/mf', { timeout: 5000 });
      return {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const mfApiService = new MutualFundApiService();

module.exports = mfApiService;