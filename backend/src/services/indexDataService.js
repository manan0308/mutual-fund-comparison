const axios = require('axios');
const logger = require('../utils/logger');

class IndexDataService {
  constructor() {
    this.logger = logger;
    this.memoryCache = new Map();
    this.cacheExpiry = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
    
    // Yahoo Finance symbol mapping for Indian indices
    this.indexSymbols = {
      nifty50: '^NSEI',
      sensex: '^BSESN', 
      nifty500: '^CRSLDX',
      niftymidcap: 'NIFTYMIDCAP50.NS',
      niftysmallcap: 'NIFTYSMALLCAP50.NS',
      niftybank: '^NSEBANK',
      niftyit: '^CNXIT'
    };
  }

  async getIndexQuote(indexKey) {
    try {
      const cacheKey = `index_quote_${indexKey}`;
      
      // Check cache first
      if (this.isMemoryCacheValid(cacheKey)) {
        return this.memoryCache.get(cacheKey);
      }

      const symbol = this.indexSymbols[indexKey];
      if (!symbol) {
        throw new Error(`Index symbol not found for: ${indexKey}`);
      }

      this.logger.info('Fetching index quote from Yahoo Finance', { indexKey, symbol });

      // Try multiple Yahoo Finance endpoints
      const urls = [
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
        `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`,
        `https://finance.yahoo.com/quote/${symbol}/`
      ];
      
      let response;
      let lastError;
      
      for (const url of urls) {
        try {
          response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          });
          break; // Success, exit loop
        } catch (error) {
          lastError = error;
          this.logger.warn(`Failed to fetch from ${url}`, { error: error.message });
          continue; // Try next URL
        }
      }
      
      if (!response) {
        throw lastError || new Error('All Yahoo Finance endpoints failed');
      }

      if (!response.data?.quoteResponse?.result?.[0]) {
        throw new Error(`No data received for index: ${indexKey}`);
      }

      const quote = response.data.quoteResponse.result[0];
      
      const indexData = {
        symbol: quote.symbol,
        name: quote.shortName || quote.longName,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        previousClose: quote.regularMarketPreviousClose,
        open: quote.regularMarketOpen,
        dayHigh: quote.regularMarketDayHigh,
        dayLow: quote.regularMarketDayLow,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        marketCap: quote.marketCap,
        volume: quote.regularMarketVolume,
        avgVolume: quote.averageDailyVolume3Month,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.memoryCache.set(cacheKey, indexData);
      this.cacheExpiry.set(cacheKey, Date.now() + this.cacheDuration);

      this.logger.info('Index quote fetched successfully', { 
        indexKey, 
        price: indexData.price,
        changePercent: indexData.changePercent 
      });

      return indexData;

    } catch (error) {
      this.logger.error('Error fetching index quote', { 
        indexKey, 
        error: error.message 
      });
      
      // Throw error instead of returning fake data
      throw new Error(`Failed to fetch real index data for ${indexKey}: ${error.message}`);
    }
  }

  async getIndexHistoricalData(indexKey, period = '1y') {
    try {
      const cacheKey = `index_history_${indexKey}_${period}`;
      
      // Check cache first
      if (this.isMemoryCacheValid(cacheKey)) {
        return this.memoryCache.get(cacheKey);
      }

      const symbol = this.indexSymbols[indexKey];
      if (!symbol) {
        throw new Error(`Index symbol not found for: ${indexKey}`);
      }

      this.logger.info('Fetching index historical data', { indexKey, symbol, period });

      // Calculate date range based on period
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = this.getStartDateForPeriod(period);

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.data?.chart?.result?.[0]) {
        throw new Error(`No historical data received for index: ${indexKey}`);
      }

      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0];

      const historicalData = timestamps.map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: prices.open[index],
        high: prices.high[index],
        low: prices.low[index],
        close: prices.close[index],
        volume: prices.volume[index]
      })).filter(item => item.close !== null);

      // Calculate additional metrics
      const metrics = this.calculateIndexMetrics(historicalData);

      const indexHistoricalData = {
        indexKey,
        symbol,
        period,
        data: historicalData,
        metrics,
        lastUpdated: new Date().toISOString()
      };

      // Cache with longer duration for historical data
      this.memoryCache.set(cacheKey, indexHistoricalData);
      this.cacheExpiry.set(cacheKey, Date.now() + (this.cacheDuration * 6)); // 30 minutes

      this.logger.info('Index historical data fetched successfully', { 
        indexKey, 
        dataPoints: historicalData.length,
        period,
        latestPrice: historicalData[historicalData.length - 1]?.close
      });

      return indexHistoricalData;

    } catch (error) {
      this.logger.error('Error fetching index historical data', { 
        indexKey, 
        period,
        error: error.message 
      });
      
      // Throw error instead of returning fake data
      throw new Error(`Failed to fetch real index historical data for ${indexKey}: ${error.message}`);
    }
  }

  async getAllIndexQuotes() {
    try {
      this.logger.info('Fetching all index quotes');
      
      const indexKeys = Object.keys(this.indexSymbols);
      const quotes = {};

      // Fetch all quotes in parallel
      await Promise.all(
        indexKeys.map(async (indexKey) => {
          try {
            quotes[indexKey] = await this.getIndexQuote(indexKey);
          } catch (error) {
            this.logger.warn('Failed to fetch quote for index', { indexKey, error: error.message });
            quotes[indexKey] = null;
          }
        })
      );

      return quotes;
    } catch (error) {
      this.logger.error('Error fetching all index quotes', { error: error.message });
      throw error;
    }
  }

  calculateIndexMetrics(historicalData) {
    if (!historicalData || historicalData.length < 2) {
      return {};
    }

    const prices = historicalData.map(item => item.close).filter(price => price !== null);
    const latest = prices[prices.length - 1];
    const oldest = prices[0];

    // Calculate returns
    const totalReturn = ((latest - oldest) / oldest) * 100;
    const days = historicalData.length;
    const years = days / 365;
    const annualizedReturn = Math.pow((latest / oldest), (1 / years)) - 1;

    // Calculate volatility (standard deviation of daily returns)
    const dailyReturns = [];
    for (let i = 1; i < prices.length; i++) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      dailyReturns.push(dailyReturn);
    }

    const avgDailyReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility

    // Calculate max drawdown
    let maxPrice = prices[0];
    let maxDrawdown = 0;
    
    for (const price of prices) {
      if (price > maxPrice) {
        maxPrice = price;
      }
      const drawdown = (maxPrice - price) / maxPrice;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      annualizedReturn: parseFloat((annualizedReturn * 100).toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
      dataPoints: prices.length,
      latest,
      oldest
    };
  }

  getStartDateForPeriod(period) {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    
    switch (period) {
      case '1d': return Math.floor((now - msPerDay) / 1000);
      case '5d': return Math.floor((now - 5 * msPerDay) / 1000);
      case '1mo': return Math.floor((now - 30 * msPerDay) / 1000);
      case '3mo': return Math.floor((now - 90 * msPerDay) / 1000);
      case '6mo': return Math.floor((now - 180 * msPerDay) / 1000);
      case '1y': return Math.floor((now - 365 * msPerDay) / 1000);
      case '2y': return Math.floor((now - 2 * 365 * msPerDay) / 1000);
      case '5y': return Math.floor((now - 5 * 365 * msPerDay) / 1000);
      case '10y': return Math.floor((now - 10 * 365 * msPerDay) / 1000);
      default: return Math.floor((now - 365 * msPerDay) / 1000);
    }
  }

  isMemoryCacheValid(key) {
    if (!this.memoryCache.has(key) || !this.cacheExpiry.has(key)) {
      return false;
    }
    
    if (Date.now() > this.cacheExpiry.get(key)) {
      this.memoryCache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    
    return true;
  }

  clearCache() {
    this.memoryCache.clear();
    this.cacheExpiry.clear();
    this.logger.info('Index data cache cleared');
  }

}

// Export singleton instance
const indexDataService = new IndexDataService();
module.exports = indexDataService;