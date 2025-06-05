const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validatePortfolioCreate } = require('../middleware/validation');
const portfolioDbService = require('../services/portfolioDbService');
const logger = require('../utils/logger');

const router = express.Router();

// Create multi-fund portfolio
router.post('/create', validatePortfolioCreate, asyncHandler(async (req, res) => {
  const { name, funds, benchmarkIndex, userId } = req.body;
  
  logger.info('Creating multi-fund portfolio', { 
    name, 
    fundCount: funds.length, 
    benchmarkIndex,
    userId: userId || 'anonymous'
  });

  // Use the new portfolio database service
  const result = await portfolioDbService.createPortfolio({
    name,
    funds,
    benchmarkIndex: benchmarkIndex || 'nifty50',
    userId: userId || 'anonymous'
  });

  res.json(result);
}));

// Get portfolio by ID
router.get('/:portfolioId', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  
  logger.info('Fetching portfolio', { portfolioId });

  const result = await portfolioDbService.getPortfolio(portfolioId);
  res.json(result);
}));

// Update portfolio
router.put('/:portfolioId', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const updateData = req.body;
  
  logger.info('Updating portfolio', { portfolioId, updateData });

  const result = await portfolioDbService.updatePortfolio(portfolioId, updateData);
  res.json(result);
}));

// Delete portfolio
router.delete('/:portfolioId', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  
  logger.info('Deleting portfolio', { portfolioId });

  const result = await portfolioDbService.deletePortfolio(portfolioId);
  res.json(result);
}));

// Get user portfolios
router.get('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  logger.info('Fetching user portfolios', { userId });

  const result = await portfolioDbService.getUserPortfolios(userId);
  res.json(result);
}));

// Get portfolio analysis
router.get('/:portfolioId/analysis', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  
  logger.info('Fetching portfolio analysis', { portfolioId });

  try {
    const portfolio = await portfolioDbService.getPortfolio(portfolioId);
    
    if (!portfolio.success) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found',
        portfolioId
      });
    }

    // Generate fresh analysis
    const analysis = await portfolioDbService.generatePortfolioAnalysis(
      portfolioId, 
      portfolio.portfolio.funds, 
      portfolio.portfolio.benchmarkIndex || 'nifty50'
    );

    res.json({
      success: true,
      analysis,
      metadata: {
        portfolioId,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.message.includes('Database not enabled')) {
      // Return a meaningful response for non-database mode
      return res.status(501).json({
        success: false,
        error: 'Portfolio analysis requires database integration',
        message: 'This feature is available when database is enabled',
        portfolioId
      });
    }
    throw error;
  }
}));

// Compare portfolios
router.post('/compare', asyncHandler(async (req, res) => {
  const { portfolioIds } = req.body;
  
  if (!portfolioIds || !Array.isArray(portfolioIds) || portfolioIds.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Please provide at least 2 portfolio IDs for comparison'
    });
  }

  logger.info('Comparing portfolios', { portfolioIds });

  try {
    const portfolios = await Promise.all(
      portfolioIds.map(id => portfolioDbService.getPortfolio(id))
    );

    const validPortfolios = portfolios.filter(p => p.success);
    
    if (validPortfolios.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 valid portfolios are required for comparison',
        found: validPortfolios.length
      });
    }

    // Generate comparison analysis
    const comparison = {
      portfolios: validPortfolios.map(p => ({
        id: p.portfolio.id,
        name: p.portfolio.name,
        totalFunds: p.portfolio.funds?.length || 0,
        metrics: p.portfolio.analysis?.metrics || {},
        risk: p.portfolio.analysis?.risk || {},
        costs: p.portfolio.analysis?.costs || {}
      })),
      summary: {
        bestPerformer: null,
        lowestRisk: null,
        mostCostEfficient: null,
        mostDiversified: null
      }
    };

    // Calculate comparison metrics
    if (comparison.portfolios.length > 0) {
      comparison.summary.bestPerformer = comparison.portfolios.reduce((best, portfolio) => 
        (portfolio.metrics.expectedAnnualReturn || 0) > (best.metrics.expectedAnnualReturn || 0) ? portfolio : best
      );

      comparison.summary.lowestRisk = comparison.portfolios.reduce((lowest, portfolio) => 
        (portfolio.risk.riskScore || 10) < (lowest.risk.riskScore || 10) ? portfolio : lowest
      );

      comparison.summary.mostCostEfficient = comparison.portfolios.reduce((efficient, portfolio) => 
        (portfolio.costs.costEfficiencyScore || 0) > (efficient.costs.costEfficiencyScore || 0) ? portfolio : efficient
      );

      comparison.summary.mostDiversified = comparison.portfolios.reduce((diversified, portfolio) => 
        (portfolio.metrics.diversificationScore || 0) > (diversified.metrics.diversificationScore || 0) ? portfolio : diversified
      );
    }

    res.json({
      success: true,
      comparison,
      metadata: {
        comparedAt: new Date().toISOString(),
        portfoliosCompared: validPortfolios.length,
        portfoliosRequested: portfolioIds.length
      }
    });

  } catch (error) {
    if (error.message.includes('Database not enabled')) {
      return res.status(501).json({
        success: false,
        error: 'Portfolio comparison requires database integration',
        message: 'This feature is available when database is enabled'
      });
    }
    throw error;
  }
}));

// Get portfolio performance over time
router.get('/:portfolioId/performance', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const { period = '1y' } = req.query;
  
  logger.info('Fetching portfolio performance', { portfolioId, period });

  try {
    const portfolio = await portfolioDbService.getPortfolio(portfolioId);
    
    if (!portfolio.success) {
      return res.status(404).json({
        success: false,
        error: 'Portfolio not found',
        portfolioId
      });
    }

    // Calculate real portfolio performance based on actual NAV data
    const performanceData = await portfolioDbService.calculatePortfolioPerformance(
      portfolio.data.funds, 
      period
    );

    res.json({
      success: true,
      performance: performanceData,
      metadata: {
        portfolioId,
        period,
        generatedAt: new Date().toISOString(),
        note: 'Simulated data - real implementation would track historical values'
      }
    });

  } catch (error) {
    throw error;
  }
}));

module.exports = router;