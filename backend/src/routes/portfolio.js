const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validatePortfolioCreate, validateMultiSipCalculation } = require('../middleware/validation');
const mfApiService = require('../services/mfApiService');
const calculationService = require('../services/calculationService');
const logger = require('../utils/logger');

const router = express.Router();

// Create multi-fund portfolio
router.post('/create', validatePortfolioCreate, asyncHandler(async (req, res) => {
  const { name, funds, totalAmount, investmentType, benchmarkIndex } = req.body;
  
  logger.info('Creating multi-fund portfolio', { 
    name, 
    fundCount: funds.length, 
    totalAmount, 
    investmentType 
  });

  // Validate allocations sum to 100%
  const totalAllocation = funds.reduce((sum, fund) => sum + fund.allocation, 0);
  if (Math.abs(totalAllocation - 100) > 0.01) {
    return res.status(400).json({
      error: 'Fund allocations must sum to 100%',
      currentTotal: totalAllocation
    });
  }

  // Fetch fund details for each fund
  const fundDetails = await Promise.all(
    funds.map(async (fund) => {
      try {
        const [allFunds] = await Promise.all([
          mfApiService.getAllFunds()
        ]);
        
        const fundInfo = allFunds.find(f => f.schemeCode.toString() === fund.schemeCode.toString());
        if (!fundInfo) {
          throw new Error(`Fund with scheme code ${fund.schemeCode} not found`);
        }

        return {
          ...fund,
          name: fundInfo.schemeName,
          category: mfApiService.categorizeScheme(fundInfo.schemeName),
          amount: Math.round(totalAmount * fund.allocation / 100)
        };
      } catch (error) {
        logger.error('Error fetching fund details', { schemeCode: fund.schemeCode, error: error.message });
        throw new Error(`Failed to fetch details for fund ${fund.schemeCode}`);
      }
    })
  );

  // Calculate portfolio metrics
  const portfolioMetrics = await calculationService.calculatePortfolioMetrics({
    funds: fundDetails,
    investmentType,
    totalAmount,
    benchmarkIndex
  });

  const portfolio = {
    id: `portfolio_${Date.now()}`,
    name,
    funds: fundDetails,
    totalAmount,
    investmentType,
    benchmarkIndex,
    metrics: portfolioMetrics,
    createdAt: new Date().toISOString()
  };

  logger.info('Portfolio created successfully', { portfolioId: portfolio.id });

  res.status(201).json({
    success: true,
    portfolio,
    summary: {
      totalFunds: fundDetails.length,
      totalAmount,
      expectedReturn: portfolioMetrics.expectedAnnualReturn,
      riskLevel: portfolioMetrics.riskLevel,
      diversificationScore: portfolioMetrics.diversificationScore
    }
  });
}));

// Multi-fund SIP calculator
router.post('/sip-calculator', validateMultiSipCalculation, asyncHandler(async (req, res) => {
  const { funds, monthlyAmount, duration, startDate } = req.body;
  
  logger.info('Calculating multi-fund SIP', { 
    fundCount: funds.length, 
    monthlyAmount, 
    duration 
  });

  // Validate allocations sum to 100%
  const totalAllocation = funds.reduce((sum, fund) => sum + fund.allocation, 0);
  if (Math.abs(totalAllocation - 100) > 0.01) {
    return res.status(400).json({
      error: 'Fund allocations must sum to 100%',
      currentTotal: totalAllocation
    });
  }

  // Calculate individual fund SIPs
  const sipCalculations = await Promise.all(
    funds.map(async (fund) => {
      try {
        const fundAmount = Math.round(monthlyAmount * fund.allocation / 100);
        
        // Get fund details
        const allFunds = await mfApiService.getAllFunds();
        const fundInfo = allFunds.find(f => f.schemeCode.toString() === fund.schemeCode.toString());
        
        if (!fundInfo) {
          throw new Error(`Fund with scheme code ${fund.schemeCode} not found`);
        }

        // Get NAV data for calculation
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + duration);
        
        const navData = await mfApiService.getFundNavData(fund.schemeCode);
        
        // Calculate SIP returns for this fund
        const sipResult = calculationService.calculateSIPReturns({
          navData: navData.navData || [],
          monthlyAmount: fundAmount,
          duration,
          startDate
        });

        return {
          schemeCode: fund.schemeCode,
          name: fundInfo.schemeName,
          category: mfApiService.categorizeScheme(fundInfo.schemeName),
          allocation: fund.allocation,
          monthlyAmount: fundAmount,
          ...sipResult
        };
      } catch (error) {
        logger.error('Error calculating SIP for fund', { schemeCode: fund.schemeCode, error: error.message });
        
        // Return fallback calculation for this fund
        const fundAmount = Math.round(monthlyAmount * fund.allocation / 100);
        const totalInvested = fundAmount * duration;
        const estimatedValue = totalInvested * 1.12; // 12% assumed return
        
        return {
          schemeCode: fund.schemeCode,
          name: `Fund ${fund.schemeCode}`,
          category: 'Unknown',
          allocation: fund.allocation,
          monthlyAmount: fundAmount,
          totalInvested,
          currentValue: estimatedValue,
          absoluteReturn: estimatedValue - totalInvested,
          annualizedReturn: 12,
          units: estimatedValue / 100 // Assumed NAV
        };
      }
    })
  );

  // Calculate combined portfolio metrics
  const totalInvested = sipCalculations.reduce((sum, calc) => sum + calc.totalInvested, 0);
  const totalCurrentValue = sipCalculations.reduce((sum, calc) => sum + calc.currentValue, 0);
  const totalAbsoluteReturn = totalCurrentValue - totalInvested;
  const totalReturnPercentage = (totalAbsoluteReturn / totalInvested) * 100;
  
  // Calculate weighted average annual return
  const weightedReturn = sipCalculations.reduce((sum, calc) => {
    const weight = calc.totalInvested / totalInvested;
    return sum + (calc.annualizedReturn * weight);
  }, 0);

  // Generate chart data
  const chartData = calculationService.generateMultiFundSIPChart({
    funds: sipCalculations,
    duration,
    startDate
  });

  // Calculate risk metrics
  const riskMetrics = calculationService.calculatePortfolioRisk(sipCalculations);

  const result = {
    summary: {
      totalMonthlyAmount: monthlyAmount,
      duration,
      totalInvested,
      currentValue: totalCurrentValue,
      absoluteReturn: totalAbsoluteReturn,
      returnPercentage: totalReturnPercentage,
      annualizedReturn: weightedReturn,
      riskLevel: riskMetrics.riskLevel,
      sharpeRatio: riskMetrics.sharpeRatio
    },
    funds: sipCalculations,
    chartData,
    riskMetrics,
    recommendations: calculationService.generatePortfolioRecommendations({
      funds: sipCalculations,
      riskMetrics,
      returnMetrics: { annualizedReturn: weightedReturn }
    })
  };

  logger.info('Multi-fund SIP calculation completed', { 
    totalInvested, 
    currentValue: totalCurrentValue,
    returnPercentage: totalReturnPercentage 
  });

  res.json({
    success: true,
    ...result
  });
}));

// Get portfolio analysis
router.get('/:portfolioId/analysis', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  
  // This would typically fetch from database
  // For now, return analysis based on portfolio ID pattern
  
  logger.info('Fetching portfolio analysis', { portfolioId });

  const analysis = {
    portfolioId,
    performance: {
      return1Month: 2.5,
      return3Month: 7.8,
      return6Month: 14.2,
      return1Year: 18.5,
      return3Year: 16.7,
      return5Year: 15.2
    },
    riskMetrics: {
      volatility: 12.5,
      beta: 0.95,
      sharpeRatio: 1.24,
      maxDrawdown: -8.2
    },
    allocation: {
      largeCap: 45,
      midCap: 25,
      smallCap: 15,
      international: 10,
      debt: 5
    },
    topHoldings: [
      { name: 'HDFC Bank', percentage: 4.2 },
      { name: 'ICICI Bank', percentage: 3.8 },
      { name: 'Infosys', percentage: 3.5 },
      { name: 'TCS', percentage: 3.1 },
      { name: 'Reliance Industries', percentage: 2.9 }
    ],
    recommendations: [
      'Consider rebalancing towards small-cap funds for higher growth potential',
      'Your portfolio shows good diversification across market caps',
      'Risk level is moderate - suitable for medium-term goals'
    ]
  };

  res.json({
    success: true,
    analysis
  });
}));

module.exports = router;