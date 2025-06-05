const database = require('../database');
const logger = require('../utils/logger');
const calculationService = require('./calculationService');
const indexDataService = require('./indexDataService');
const mfApiService = require('./mfApiService');

class PortfolioDbService {
  constructor() {
    this.logger = logger;
    this.databaseEnabled = process.env.ENABLE_DATABASE === 'true';
  }

  async createPortfolio(portfolioData) {
    try {
      if (!this.databaseEnabled) {
        // If database is not enabled, use in-memory storage
        return this.createInMemoryPortfolio(portfolioData);
      }

      const { name, funds, benchmarkIndex, userId = 'anonymous' } = portfolioData;
      
      this.logger.info('Creating portfolio in database', { 
        name, 
        fundCount: funds.length, 
        benchmarkIndex,
        userId 
      });

      // Validate portfolio data
      const validationErrors = this.validatePortfolioData(portfolioData);
      if (validationErrors.length > 0) {
        throw new Error(`Portfolio validation failed: ${validationErrors.join(', ')}`);
      }

      // Calculate portfolio metrics
      const portfolioMetrics = await this.calculatePortfolioMetrics(funds, benchmarkIndex);

      // Insert portfolio into database
      const portfolioId = await this.insertPortfolio({
        name,
        userId,
        benchmarkIndex,
        totalFunds: funds.length,
        totalInvestment: this.calculateTotalInvestment(funds),
        expectedReturn: portfolioMetrics.expectedAnnualReturn,
        riskLevel: portfolioMetrics.riskLevel,
        diversificationScore: portfolioMetrics.diversificationScore,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Insert portfolio funds
      await this.insertPortfolioFunds(portfolioId, funds);

      // Calculate and store portfolio analysis
      const analysis = await this.generatePortfolioAnalysis(portfolioId, funds, benchmarkIndex);

      const result = {
        success: true,
        portfolio: {
          id: portfolioId,
          name,
          funds: funds.length,
          metrics: portfolioMetrics,
          analysis,
          createdAt: new Date().toISOString()
        }
      };

      this.logger.info('Portfolio created successfully', { portfolioId, name });
      return result;

    } catch (error) {
      this.logger.error('Error creating portfolio', { error: error.message });
      throw error;
    }
  }

  async getPortfolio(portfolioId) {
    try {
      if (!this.databaseEnabled) {
        throw new Error('Database not enabled - portfolio retrieval not available');
      }

      this.logger.info('Retrieving portfolio', { portfolioId });

      const portfolio = await this.fetchPortfolioById(portfolioId);
      if (!portfolio) {
        throw new Error(`Portfolio with ID ${portfolioId} not found`);
      }

      const portfolioFunds = await this.fetchPortfolioFunds(portfolioId);
      const analysis = await this.fetchPortfolioAnalysis(portfolioId);

      return {
        success: true,
        portfolio: {
          ...portfolio,
          funds: portfolioFunds,
          analysis
        }
      };

    } catch (error) {
      this.logger.error('Error retrieving portfolio', { portfolioId, error: error.message });
      throw error;
    }
  }

  async updatePortfolio(portfolioId, updateData) {
    try {
      if (!this.databaseEnabled) {
        throw new Error('Database not enabled - portfolio updates not available');
      }

      this.logger.info('Updating portfolio', { portfolioId, updateData });

      // Recalculate metrics if funds are updated
      if (updateData.funds) {
        const portfolioMetrics = await this.calculatePortfolioMetrics(
          updateData.funds, 
          updateData.benchmarkIndex
        );
        updateData.expectedReturn = portfolioMetrics.expectedAnnualReturn;
        updateData.riskLevel = portfolioMetrics.riskLevel;
        updateData.diversificationScore = portfolioMetrics.diversificationScore;
      }

      updateData.updatedAt = new Date().toISOString();

      await this.updatePortfolioInDb(portfolioId, updateData);

      if (updateData.funds) {
        await this.updatePortfolioFunds(portfolioId, updateData.funds);
      }

      this.logger.info('Portfolio updated successfully', { portfolioId });
      return { success: true, portfolioId };

    } catch (error) {
      this.logger.error('Error updating portfolio', { portfolioId, error: error.message });
      throw error;
    }
  }

  async deletePortfolio(portfolioId) {
    try {
      if (!this.databaseEnabled) {
        throw new Error('Database not enabled - portfolio deletion not available');
      }

      this.logger.info('Deleting portfolio', { portfolioId });

      await this.deletePortfolioFromDb(portfolioId);

      this.logger.info('Portfolio deleted successfully', { portfolioId });
      return { success: true, portfolioId };

    } catch (error) {
      this.logger.error('Error deleting portfolio', { portfolioId, error: error.message });
      throw error;
    }
  }

  async getUserPortfolios(userId = 'anonymous') {
    try {
      if (!this.databaseEnabled) {
        return { success: true, portfolios: [] };
      }

      this.logger.info('Fetching user portfolios', { userId });

      const portfolios = await this.fetchUserPortfolios(userId);

      return {
        success: true,
        portfolios,
        count: portfolios.length
      };

    } catch (error) {
      this.logger.error('Error fetching user portfolios', { userId, error: error.message });
      throw error;
    }
  }

  async generatePortfolioAnalysis(portfolioId, funds, benchmarkIndex) {
    try {
      this.logger.info('Generating portfolio analysis', { portfolioId, benchmarkIndex });

      // Get enhanced fund data from real API
      const enhancedFunds = await Promise.all(
        funds.map(async (fund) => {
          try {
            const fundData = await mfApiService.getFundNavData(fund.schemeCode);
            const category = mfApiService.categorizeScheme(fundData?.meta?.scheme_name || '');
            const fundHouse = mfApiService.extractFundHouse(fundData?.meta?.scheme_name || '');
            
            return {
              ...fund,
              category: category || 'Unknown',
              fundHouse: fundHouse || 'Unknown',
              schemeName: fundData?.meta?.scheme_name || fund.name || 'Unknown Fund'
            };
          } catch (error) {
            this.logger.warn('Failed to get fund details', { schemeCode: fund.schemeCode, error: error.message });
            return {
              ...fund,
              category: 'Unknown',
              fundHouse: 'Unknown',
              schemeName: fund.name || 'Unknown Fund'
            };
          }
        })
      );

      // Calculate portfolio metrics
      const portfolioMetrics = await calculationService.calculatePortfolioMetrics({
        funds: enhancedFunds,
        benchmarkIndex
      });

      // Calculate risk metrics
      const riskMetrics = await calculationService.calculatePortfolioRisk(enhancedFunds);

      // Get benchmark comparison
      const benchmarkReturn = await calculationService.getBenchmarkReturns(benchmarkIndex);

      // Generate recommendations
      const recommendations = calculationService.generatePortfolioRecommendations({
        funds: enhancedFunds,
        riskMetrics,
        returnMetrics: portfolioMetrics
      });

      const analysis = {
        portfolioId,
        metrics: portfolioMetrics,
        risk: riskMetrics,
        benchmark: {
          index: benchmarkIndex,
          return: benchmarkReturn,
          outperformance: portfolioMetrics.expectedAnnualReturn - benchmarkReturn
        },
        allocation: this.calculateDetailedAllocation(enhancedFunds),
        performance: {
          expectedAnnualReturn: portfolioMetrics.expectedAnnualReturn,
          riskAdjustedReturn: portfolioMetrics.expectedAnnualReturn / riskMetrics.riskScore,
          sharpeRatio: riskMetrics.sharpeRatio,
          diversificationBenefit: portfolioMetrics.diversificationScore
        },
        costs: {
          weightedExpenseRatio: this.calculateWeightedExpenseRatio(enhancedFunds),
          totalExpenseImpact: this.calculateExpenseImpact(enhancedFunds),
          costEfficiencyScore: this.calculateCostEfficiencyScore(enhancedFunds)
        },
        recommendations,
        generatedAt: new Date().toISOString()
      };

      // Store analysis in database if enabled
      if (this.databaseEnabled) {
        await this.storePortfolioAnalysis(portfolioId, analysis);
      }

      return analysis;

    } catch (error) {
      this.logger.error('Error generating portfolio analysis', { portfolioId, error: error.message });
      throw error;
    }
  }

  // Database operation methods
  async insertPortfolio(portfolioData) {
    if (!this.databaseEnabled) {
      throw new Error('Database not enabled');
    }

    const query = `
      INSERT INTO portfolios (name, user_id, benchmark_index, total_funds, total_investment, 
                             expected_return, risk_level, diversification_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      portfolioData.name,
      portfolioData.userId,
      portfolioData.benchmarkIndex,
      portfolioData.totalFunds,
      portfolioData.totalInvestment,
      portfolioData.expectedReturn,
      portfolioData.riskLevel,
      portfolioData.diversificationScore,
      portfolioData.createdAt,
      portfolioData.updatedAt
    ];

    const result = await database.query(query, values);
    return result.insertId;
  }

  async insertPortfolioFunds(portfolioId, funds) {
    if (!this.databaseEnabled) {
      throw new Error('Database not enabled');
    }

    const query = `
      INSERT INTO portfolio_funds (portfolio_id, scheme_code, fund_name, category, 
                                  investment_type, amount, start_date, allocation_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const fund of funds) {
      const values = [
        portfolioId,
        fund.schemeCode,
        fund.name,
        fund.category,
        fund.investmentType,
        fund.amount,
        fund.startDate,
        fund.allocation || 0
      ];

      await database.query(query, values);
    }
  }

  async storePortfolioAnalysis(portfolioId, analysis) {
    if (!this.databaseEnabled) {
      throw new Error('Database not enabled');
    }

    const query = `
      INSERT INTO portfolio_analysis (portfolio_id, analysis_data, generated_at)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        analysis_data = VALUES(analysis_data),
        generated_at = VALUES(generated_at)
    `;

    const values = [
      portfolioId,
      JSON.stringify(analysis),
      analysis.generatedAt
    ];

    await database.query(query, values);
  }

  // Helper methods
  validatePortfolioData(portfolioData) {
    const errors = [];

    if (!portfolioData.name || portfolioData.name.trim().length < 3) {
      errors.push('Portfolio name must be at least 3 characters long');
    }

    if (!portfolioData.funds || !Array.isArray(portfolioData.funds) || portfolioData.funds.length === 0) {
      errors.push('Portfolio must contain at least one fund');
    }

    if (portfolioData.funds && portfolioData.funds.length > 20) {
      errors.push('Portfolio cannot contain more than 20 funds');
    }

    portfolioData.funds?.forEach((fund, index) => {
      if (!fund.schemeCode) {
        errors.push(`Fund ${index + 1}: Scheme code is required`);
      }
      if (!fund.amount || fund.amount <= 0) {
        errors.push(`Fund ${index + 1}: Valid amount is required`);
      }
      if (!fund.investmentType || !['sip', 'lumpsum'].includes(fund.investmentType)) {
        errors.push(`Fund ${index + 1}: Investment type must be 'sip' or 'lumpsum'`);
      }
    });

    return errors;
  }

  calculateTotalInvestment(funds) {
    return funds.reduce((total, fund) => {
      if (fund.investmentType === 'sip') {
        return total + (fund.amount * (fund.sipDuration || 12));
      }
      return total + fund.amount;
    }, 0);
  }

  async calculatePortfolioMetrics(funds, benchmarkIndex) {
    return await calculationService.calculatePortfolioMetrics({
      funds,
      benchmarkIndex,
      investmentType: 'mixed',
      totalAmount: this.calculateTotalInvestment(funds)
    });
  }

  calculateDetailedAllocation(funds) {
    const totalInvestment = this.calculateTotalInvestment(funds);
    const allocation = {
      byCategory: {},
      byInvestmentType: { sip: 0, lumpsum: 0 },
      byRisk: { low: 0, moderate: 0, high: 0 },
      topFunds: funds.slice(0, 5).map(fund => ({
        name: fund.name,
        allocation: ((fund.amount / totalInvestment) * 100).toFixed(2)
      }))
    };

    funds.forEach(fund => {
      const category = fund.category || 'Unknown';
      const amount = fund.amount || 0;
      const percentage = (amount / totalInvestment) * 100;

      // By category
      allocation.byCategory[category] = (allocation.byCategory[category] || 0) + percentage;

      // By investment type
      allocation.byInvestmentType[fund.investmentType] += percentage;

      // By risk (simplified mapping)
      const riskLevel = this.getFundRiskLevel(category);
      allocation.byRisk[riskLevel] += percentage;
    });

    return allocation;
  }

  calculateWeightedExpenseRatio(funds) {
    const totalInvestment = this.calculateTotalInvestment(funds);
    let weightedExpense = 0;

    funds.forEach(fund => {
      const weight = fund.amount / totalInvestment;
      const expenseRatio = fund.expenseRatio || 1.0;
      weightedExpense += weight * expenseRatio;
    });

    return Math.round(weightedExpense * 100) / 100;
  }

  calculateExpenseImpact(funds) {
    const totalInvestment = this.calculateTotalInvestment(funds);
    const weightedExpenseRatio = this.calculateWeightedExpenseRatio(funds);
    
    return {
      annualCost: Math.round(totalInvestment * (weightedExpenseRatio / 100)),
      tenYearImpact: Math.round(totalInvestment * (weightedExpenseRatio / 100) * 10),
      impactOnReturns: Math.round(weightedExpenseRatio * 100) / 100
    };
  }

  calculateCostEfficiencyScore(funds) {
    const avgExpenseRatio = funds.reduce((sum, fund) => sum + (fund.expenseRatio || 1.0), 0) / funds.length;
    const avgReturn = funds.reduce((sum, fund) => sum + (fund.return3Y || 0), 0) / funds.length;
    
    // Score based on return per unit of expense
    const efficiencyRatio = avgReturn / avgExpenseRatio;
    
    // Convert to 0-100 scale
    return Math.min(100, Math.max(0, (efficiencyRatio - 10) * 5));
  }

  getFundRiskLevel(category) {
    const riskMapping = {
      'Large Cap': 'low',
      'Debt': 'low',
      'Hybrid': 'low',
      'Mid Cap': 'moderate',
      'ELSS': 'moderate',
      'Small Cap': 'high',
      'Sectoral/Thematic': 'high'
    };
    return riskMapping[category] || 'moderate';
  }

  // In-memory portfolio creation for when database is disabled
  createInMemoryPortfolio(portfolioData) {
    const portfolioId = `portfolio_${Date.now()}`;
    
    return {
      success: true,
      portfolio: {
        id: portfolioId,
        name: portfolioData.name,
        funds: portfolioData.funds,
        benchmarkIndex: portfolioData.benchmarkIndex,
        createdAt: new Date().toISOString(),
        totalFunds: portfolioData.funds.length,
        totalInvestment: this.calculateTotalInvestment(portfolioData.funds),
        isInMemory: true
      }
    };
  }

  // Database fetch methods (placeholder implementations)
  async fetchPortfolioById(portfolioId) {
    if (!this.databaseEnabled) return null;
    // Implementation would query the portfolios table
    const query = 'SELECT * FROM portfolios WHERE id = ?';
    const results = await database.query(query, [portfolioId]);
    return results[0] || null;
  }

  async fetchPortfolioFunds(portfolioId) {
    if (!this.databaseEnabled) return [];
    // Implementation would query the portfolio_funds table
    const query = 'SELECT * FROM portfolio_funds WHERE portfolio_id = ?';
    return await database.query(query, [portfolioId]);
  }

  async fetchPortfolioAnalysis(portfolioId) {
    if (!this.databaseEnabled) return null;
    // Implementation would query the portfolio_analysis table
    const query = 'SELECT analysis_data FROM portfolio_analysis WHERE portfolio_id = ? ORDER BY generated_at DESC LIMIT 1';
    const results = await database.query(query, [portfolioId]);
    return results[0] ? JSON.parse(results[0].analysis_data) : null;
  }

  async fetchUserPortfolios(userId) {
    if (!this.databaseEnabled) return [];
    // Implementation would query user's portfolios
    const query = 'SELECT * FROM portfolios WHERE user_id = ? ORDER BY updated_at DESC';
    return await database.query(query, [userId]);
  }

  async updatePortfolioInDb(portfolioId, updateData) {
    if (!this.databaseEnabled) return;
    // Implementation would update the portfolios table
    const fields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updateData);
    const query = `UPDATE portfolios SET ${fields} WHERE id = ?`;
    await database.query(query, [...values, portfolioId]);
  }

  async updatePortfolioFunds(portfolioId, funds) {
    if (!this.databaseEnabled) return;
    // Delete existing funds and insert new ones
    await database.query('DELETE FROM portfolio_funds WHERE portfolio_id = ?', [portfolioId]);
    await this.insertPortfolioFunds(portfolioId, funds);
  }

  async deletePortfolioFromDb(portfolioId) {
    if (!this.databaseEnabled) return;
    // Delete portfolio and related records
    await database.query('DELETE FROM portfolio_analysis WHERE portfolio_id = ?', [portfolioId]);
    await database.query('DELETE FROM portfolio_funds WHERE portfolio_id = ?', [portfolioId]);
    await database.query('DELETE FROM portfolios WHERE id = ?', [portfolioId]);
  }
}

// Export singleton instance
const portfolioDbService = new PortfolioDbService();
module.exports = portfolioDbService;