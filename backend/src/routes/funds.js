const express = require('express');
const router = express.Router();
const mfApiService = require('../services/mfApiService');
const calculationService = require('../services/calculationService');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateSearchFunds, validateSchemeCode, validateDateRange, validateComparePortfolios } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get all mutual funds with optional search
router.get('/funds', 
  validateSearchFunds,
  asyncHandler(async (req, res) => {
    const { search, limit = 50 } = req.query;
    
    logger.info('Fetching funds', { search, limit });
    
    const funds = await mfApiService.searchFunds(search, parseInt(limit));
    
    logger.apiResponse('/api/funds', 200, funds);
    
    res.json({
      data: funds,
      total: funds.length,
      timestamp: new Date().toISOString()
    });
  })
);

// Get NAV data for a specific fund
router.get('/funds/:schemeCode/nav',
  validateSchemeCode,
  validateDateRange,
  asyncHandler(async (req, res) => {
    const { schemeCode } = req.params;
    const { from, to } = req.query;
    
    logger.info('Fetching NAV data', { schemeCode, from, to });
    
    const navData = await mfApiService.getFundNavData(schemeCode);
    
    if (!navData || !navData.data) {
      return res.status(404).json({
        error: 'Fund not found',
        message: `No data found for scheme code ${schemeCode}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Filter by date range if provided
    let filteredNavData = navData.data;
    if (from || to) {
      filteredNavData = navData.data.filter(item => {
        const itemDate = new Date(item.date.split('-').reverse().join('-'));
        const fromDate = from ? new Date(from) : new Date('1900-01-01');
        const toDate = to ? new Date(to) : new Date();
        return itemDate >= fromDate && itemDate <= toDate;
      });
    }
    
    const result = {
      fundName: navData.meta.scheme_name,
      schemeCode: navData.meta.scheme_code,
      navData: filteredNavData.map(item => ({
        date: item.date.split('-').reverse().join('-'),
        nav: parseFloat(item.nav)
      })).reverse(),
      totalRecords: filteredNavData.length,
      dateRange: {
        from: from || (filteredNavData.length > 0 ? filteredNavData[filteredNavData.length - 1].date : null),
        to: to || (filteredNavData.length > 0 ? filteredNavData[0].date : null)
      },
      timestamp: new Date().toISOString()
    };
    
    logger.apiResponse('/api/funds/:schemeCode/nav', 200, result);
    
    res.json(result);
  })
);

// Compare two portfolios
router.post('/compare',
  validateComparePortfolios,
  asyncHandler(async (req, res) => {
    const {
      currentFundCode,
      comparisonFundCode,
      investmentType,
      amount,
      startDate,
      endDate
    } = req.body;
    
    logger.info('Comparing portfolios', {
      currentFundCode,
      comparisonFundCode,
      investmentType,
      amount
    });
    
    // Fetch NAV data for both funds
    const [currentFundData, comparisonFundData] = await Promise.all([
      mfApiService.getFundNavData(currentFundCode),
      mfApiService.getFundNavData(comparisonFundCode)
    ]);
    
    if (!currentFundData?.data || !comparisonFundData?.data) {
      return res.status(404).json({
        error: 'Fund data not found',
        message: 'One or both funds could not be found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Filter NAV data by date range
    const filterNavData = (navData, from, to) => {
      return navData.filter(item => {
        const itemDate = new Date(item.date.split('-').reverse().join('-'));
        const fromDate = new Date(from);
        const toDate = to ? new Date(to) : new Date();
        return itemDate >= fromDate && itemDate <= toDate;
      });
    };
    
    const currentNavFiltered = filterNavData(currentFundData.data, startDate, endDate);
    const comparisonNavFiltered = filterNavData(comparisonFundData.data, startDate, endDate);
    
    if (currentNavFiltered.length === 0 || comparisonNavFiltered.length === 0) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'Not enough NAV data available for the specified date range',
        timestamp: new Date().toISOString()
      });
    }
    
    const currentFundFormatted = {
      fundName: currentFundData.meta.scheme_name,
      schemeCode: currentFundData.meta.scheme_code,
      navData: currentNavFiltered.map(item => ({
        date: item.date.split('-').reverse().join('-'),
        nav: parseFloat(item.nav)
      })).reverse()
    };
    
    const comparisonFundFormatted = {
      fundName: comparisonFundData.meta.scheme_name,
      schemeCode: comparisonFundData.meta.scheme_code,
      navData: comparisonNavFiltered.map(item => ({
        date: item.date.split('-').reverse().join('-'),
        nav: parseFloat(item.nav)
      })).reverse()
    };
    
    // Calculate portfolio comparison
    const comparison = calculationService.calculatePortfolioComparison(
      currentFundFormatted,
      comparisonFundFormatted,
      investmentType,
      amount,
      startDate,
      endDate
    );
    
    const result = {
      ...comparison,
      metadata: {
        calculatedAt: new Date().toISOString(),
        investmentType,
        amount,
        dateRange: { startDate, endDate },
        dataPoints: {
          current: currentNavFiltered.length,
          comparison: comparisonNavFiltered.length
        }
      }
    };
    
    logger.apiResponse('/api/compare', 200, result);
    
    res.json(result);
  })
);

// Get fund details by scheme code
router.get('/funds/:schemeCode',
  validateSchemeCode,
  asyncHandler(async (req, res) => {
    const { schemeCode } = req.params;
    
    logger.info('Fetching fund details', { schemeCode });
    
    const fundData = await mfApiService.getFundNavData(schemeCode);
    
    if (!fundData || !fundData.meta) {
      return res.status(404).json({
        error: 'Fund not found',
        message: `No fund found with scheme code ${schemeCode}`,
        timestamp: new Date().toISOString()
      });
    }
    
    const latestNav = fundData.data && fundData.data.length > 0 
      ? fundData.data[0] 
      : null;
    
    const result = {
      schemeCode: fundData.meta.scheme_code,
      schemeName: fundData.meta.scheme_name,
      category: mfApiService.categorizeScheme(fundData.meta.scheme_name),
      fundHouse: mfApiService.extractFundHouse(fundData.meta.scheme_name),
      latestNav: latestNav ? {
        value: parseFloat(latestNav.nav),
        date: latestNav.date.split('-').reverse().join('-')
      } : null,
      totalNavRecords: fundData.data ? fundData.data.length : 0,
      timestamp: new Date().toISOString()
    };
    
    logger.apiResponse('/api/funds/:schemeCode', 200, result);
    
    res.json(result);
  })
);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Mutual Fund Comparison API',
    version: '1.0.0',
    description: 'API for comparing mutual fund portfolios and fetching NAV data',
    endpoints: {
      'GET /api/funds': 'Search and list mutual funds',
      'GET /api/funds/:schemeCode': 'Get fund details by scheme code',
      'GET /api/funds/:schemeCode/nav': 'Get NAV data for a fund',
      'POST /api/compare': 'Compare two portfolios'
    },
    documentation: 'https://github.com/your-repo/mutual-fund-comparison',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;