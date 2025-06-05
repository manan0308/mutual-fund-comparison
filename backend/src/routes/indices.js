const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const indexDataService = require('../services/indexDataService');
const logger = require('../utils/logger');

const router = express.Router();

// Get current quote for a specific index
router.get('/:indexKey/quote', asyncHandler(async (req, res) => {
  const { indexKey } = req.params;
  
  logger.info('Fetching index quote', { indexKey });

  const quote = await indexDataService.getIndexQuote(indexKey);
  
  res.json({
    success: true,
    data: quote
  });
}));

// Get historical data for a specific index
router.get('/:indexKey/history', asyncHandler(async (req, res) => {
  const { indexKey } = req.params;
  const { period = '1y' } = req.query;
  
  logger.info('Fetching index historical data', { indexKey, period });

  const historicalData = await indexDataService.getIndexHistoricalData(indexKey, period);
  
  res.json({
    success: true,
    data: historicalData
  });
}));

// Get quotes for all available indices
router.get('/quotes', asyncHandler(async (req, res) => {
  logger.info('Fetching all index quotes');

  const quotes = await indexDataService.getAllIndexQuotes();
  
  res.json({
    success: true,
    data: quotes
  });
}));

// Get available indices list
router.get('/', asyncHandler(async (req, res) => {
  const availableIndices = {
    nifty50: {
      name: 'Nifty 50',
      symbol: '^NSEI',
      description: 'Nifty 50 represents the top 50 companies based on free float market capitalization'
    },
    sensex: {
      name: 'Sensex',
      symbol: '^BSESN',
      description: 'BSE Sensex represents 30 well-established and financially sound companies'
    },
    nifty500: {
      name: 'Nifty 500',
      symbol: '^CRSLDX',
      description: 'Nifty 500 represents the top 500 companies based on full market capitalization'
    },
    niftymidcap: {
      name: 'Nifty Midcap 50',
      symbol: 'NIFTYMIDCAP50.NS',
      description: 'Nifty Midcap 50 represents 50 midcap companies'
    },
    niftysmallcap: {
      name: 'Nifty Smallcap 50',
      symbol: 'NIFTYSMALLCAP50.NS',
      description: 'Nifty Smallcap 50 represents 50 smallcap companies'
    },
    niftybank: {
      name: 'Nifty Bank',
      symbol: '^NSEBANK',
      description: 'Nifty Bank represents the most liquid and large capitalized banking stocks'
    },
    niftyit: {
      name: 'Nifty IT',
      symbol: '^CNXIT',
      description: 'Nifty IT represents the performance of the IT sector'
    }
  };

  res.json({
    success: true,
    data: availableIndices
  });
}));

// Compare fund performance against index
router.post('/compare', asyncHandler(async (req, res) => {
  const { fundCode, indexKey, startDate, endDate, investmentType, amount } = req.body;
  
  logger.info('Comparing fund against index', { fundCode, indexKey, investmentType });

  // Validate inputs
  if (!fundCode || !indexKey) {
    return res.status(400).json({
      error: 'Fund code and index key are required'
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: 'Valid investment amount is required'
    });
  }

  try {
    // Get index historical data for the same period
    const period = this.calculatePeriodFromDates(startDate, endDate);
    const indexData = await indexDataService.getIndexHistoricalData(indexKey, period);
    
    // Calculate index returns for the investment period
    const indexReturns = this.calculateIndexReturnsForPeriod(indexData, startDate, endDate, investmentType, amount);
    
    res.json({
      success: true,
      data: {
        index: {
          key: indexKey,
          name: indexData.symbol,
          returns: indexReturns,
          metrics: indexData.metrics
        },
        comparison: {
          investmentType,
          amount,
          period: {
            start: startDate,
            end: endDate
          }
        }
      }
    });

  } catch (error) {
    logger.error('Error comparing fund against index', { 
      fundCode, 
      indexKey, 
      error: error.message 
    });
    throw error;
  }
}));

// Health check for index data service
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Test by fetching Nifty 50 quote
    const niftyQuote = await indexDataService.getIndexQuote('nifty50');
    
    res.json({
      success: true,
      status: 'healthy',
      message: 'Index data service is working',
      testData: {
        nifty50: niftyQuote.price
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Index data service is not responding',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// Helper methods
router.calculatePeriodFromDates = function(startDate, endDate) {
  if (!startDate || !endDate) return '1y';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return '1w';
  if (diffDays <= 30) return '1mo';
  if (diffDays <= 90) return '3mo';
  if (diffDays <= 180) return '6mo';
  if (diffDays <= 365) return '1y';
  if (diffDays <= 730) return '2y';
  return '5y';
};

router.calculateIndexReturnsForPeriod = function(indexData, startDate, endDate, investmentType, amount) {
  const data = indexData.data;
  if (!data || data.length === 0) {
    throw new Error('No index data available for calculation');
  }

  // Find start and end prices
  const startPrice = this.findPriceForDate(data, startDate);
  const endPrice = data[data.length - 1].close;

  if (investmentType === 'lump') {
    // Lump sum calculation
    const units = amount / startPrice;
    const currentValue = units * endPrice;
    const absoluteReturn = currentValue - amount;
    const returnPercentage = (absoluteReturn / amount) * 100;

    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const years = days / 365;
    const annualizedReturn = Math.pow(currentValue / amount, 1 / years) - 1;

    return {
      invested: amount,
      currentValue: Math.round(currentValue),
      absoluteReturn: Math.round(absoluteReturn),
      returnPercentage: Math.round(returnPercentage * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100 * 100) / 100,
      units: Math.round(units * 1000) / 1000
    };
  } else {
    // SIP calculation for index
    let totalInvested = 0;
    let totalUnits = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let current = new Date(start);
    while (current <= end) {
      const monthPrice = this.findPriceForDate(data, current.toISOString().split('T')[0]);
      if (monthPrice) {
        totalUnits += amount / monthPrice;
        totalInvested += amount;
      }
      current.setMonth(current.getMonth() + 1);
    }

    const currentValue = totalUnits * endPrice;
    const absoluteReturn = currentValue - totalInvested;
    const returnPercentage = (absoluteReturn / totalInvested) * 100;

    return {
      invested: totalInvested,
      currentValue: Math.round(currentValue),
      absoluteReturn: Math.round(absoluteReturn),
      returnPercentage: Math.round(returnPercentage * 100) / 100,
      units: Math.round(totalUnits * 1000) / 1000
    };
  }
};

router.findPriceForDate = function(data, targetDate) {
  const target = new Date(targetDate);
  
  // Find exact match or closest date
  let closest = data[0];
  let minDiff = Math.abs(new Date(data[0].date) - target);

  for (const item of data) {
    const diff = Math.abs(new Date(item.date) - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = item;
    }
  }

  return closest.close;
};

module.exports = router;