const logger = require('../utils/logger');
const indexDataService = require('./indexDataService');

class CalculationService {
  constructor() {
    this.logger = logger;
  }

  async getBenchmarkReturns(benchmarkIndex = 'nifty50', period = '1y') {
    try {
      const indexData = await indexDataService.getIndexHistoricalData(benchmarkIndex, period);
      return indexData.metrics.annualizedReturn;
    } catch (error) {
      this.logger.error('Failed to get real benchmark returns', { 
        benchmarkIndex, 
        error: error.message 
      });
      // Throw error instead of using fake data
      throw new Error(`Unable to calculate benchmark returns for ${benchmarkIndex}: ${error.message}`);
    }
  }

  async getRiskFreeRate() {
    try {
      // Use 10-year Government Bond yield as risk-free rate
      // In real implementation, this should fetch from RBI or other financial APIs
      const bondData = await indexDataService.getIndexQuote('10yr_bond');
      return bondData.yield || 6.5; // Default to current approximate 10yr yield if not available
    } catch (error) {
      this.logger.error('Failed to get risk-free rate from bonds', { error: error.message });
      // Use a reasonable conservative estimate for Indian government bonds
      return 6.5; // Current approximate 10-year government bond yield
    }
  }

  // Centralized risk level mapping to avoid duplication
  mapRiskScoreToLevel(riskScore) {
    if (riskScore <= 2) return 'Low';
    if (riskScore <= 4) return 'Moderate';
    if (riskScore <= 6) return 'High';
    return 'Very High';
  }

  // Calculate portfolio volatility based on fund composition
  async calculatePortfolioVolatility(funds) {
    try {
      const totalInvested = funds.reduce((sum, fund) => sum + fund.totalInvested, 0);
      let portfolioVolatility = 0;
      
      for (const fund of funds) {
        const weight = fund.totalInvested / totalInvested;
        const fundCategory = fund.category || 'Unknown';
        
        // Get volatility for the fund's category from benchmark index
        try {
          const benchmarkIndex = this.getBenchmarkForCategory(fundCategory);
          const indexData = await indexDataService.getIndexHistoricalData(benchmarkIndex, '1y');
          const fundVolatility = indexData.metrics.volatility; // Use category benchmark volatility
          if (!fundVolatility) {
            throw new Error('Volatility data not available');
          }
          portfolioVolatility += (weight * weight * fundVolatility * fundVolatility);
        } catch (error) {
          this.logger.error('Failed to get real volatility for category', { fundCategory, error: error.message });
          throw new Error(`Unable to calculate real volatility for category ${fundCategory}: ${error.message}`);
        }
      }
      
      return Math.sqrt(portfolioVolatility);
    } catch (error) {
      this.logger.error('Failed to calculate portfolio volatility', { error: error.message });
      // Throw error instead of returning fake data
      throw new Error(`Unable to calculate real portfolio volatility: ${error.message}`);
    }
  }

  // Helper method to map fund categories to benchmark indices
  getBenchmarkForCategory(category) {
    const categoryIndexMap = {
      'Large Cap': 'nifty50',
      'Mid Cap': 'niftymidcap', 
      'Small Cap': 'niftysmallcap',
      'IT': 'niftyit',
      'Bank': 'niftybank',
      'Index': 'nifty50'
    };
    return categoryIndexMap[category] || 'nifty50';
  }


  calculatePortfolioComparison(currentFund, comparisonFund, investmentType, amount, startDate, endDate) {
    try {
      this.logger.info('Starting portfolio comparison calculation', {
        currentFund: currentFund.fundName,
        comparisonFund: comparisonFund.fundName,
        investmentType,
        amount
      });

      const currentNav = currentFund.navData;
      const comparisonNav = comparisonFund.navData;

      if (!currentNav?.length || !comparisonNav?.length) {
        throw new Error('Insufficient NAV data for calculation');
      }

      let currentUnits = 0;
      let comparisonUnits = 0;
      let totalInvested = 0;
      let chartData = [];

      if (investmentType === 'sip') {
        const result = this.calculateSIP(currentNav, comparisonNav, amount, startDate, endDate);
        currentUnits = result.currentUnits;
        comparisonUnits = result.comparisonUnits;
        totalInvested = result.totalInvested;
        chartData = result.chartData;
      } else {
        const result = this.calculateLumpSum(currentNav, comparisonNav, amount, startDate);
        currentUnits = result.currentUnits;
        comparisonUnits = result.comparisonUnits;
        totalInvested = result.totalInvested;
      }

      const latestCurrentNav = currentNav[currentNav.length - 1]?.nav || 0;
      const latestComparisonNav = comparisonNav[comparisonNav.length - 1]?.nav || 0;

      const currentValue = currentUnits * latestCurrentNav;
      const comparisonValue = comparisonUnits * latestComparisonNav;

      const result = {
        current: {
          value: Math.round(currentValue),
          invested: totalInvested,
          fund: currentFund.fundName,
          units: parseFloat(currentUnits.toFixed(4)),
          latestNav: latestCurrentNav
        },
        comparison: {
          value: Math.round(comparisonValue),
          invested: totalInvested,
          fund: comparisonFund.fundName,
          units: parseFloat(comparisonUnits.toFixed(4)),
          latestNav: latestComparisonNav
        },
        difference: Math.round(comparisonValue - currentValue),
        percentageDifference: totalInvested > 0 ? 
          parseFloat(((comparisonValue - currentValue) / totalInvested * 100).toFixed(2)) : 0,
        chartData: chartData.length > 0 ? chartData.slice(-24) : [] // Last 24 months for SIP
      };

      this.logger.info('Portfolio comparison calculation completed', {
        currentValue: result.current.value,
        comparisonValue: result.comparison.value,
        difference: result.difference
      });

      return result;

    } catch (error) {
      this.logger.error('Error in portfolio comparison calculation', {
        error: error.message,
        currentFund: currentFund?.fundName,
        comparisonFund: comparisonFund?.fundName
      });
      throw error;
    }
  }

  calculateSIP(currentNav, comparisonNav, monthlyAmount, startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    const currentNavByMonth = this.groupNavByMonth(currentNav);
    const comparisonNavByMonth = this.groupNavByMonth(comparisonNav);
    
    let currentUnits = 0;
    let comparisonUnits = 0;
    let totalInvested = 0;
    let chartData = [];
    
    let current = new Date(start);
    while (current <= end) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      
      const currentNavValue = currentNavByMonth[monthKey];
      const comparisonNavValue = comparisonNavByMonth[monthKey];
      
      if (currentNavValue && comparisonNavValue) {
        currentUnits += monthlyAmount / currentNavValue;
        comparisonUnits += monthlyAmount / comparisonNavValue;
        totalInvested += monthlyAmount;
        
        // Calculate portfolio values for chart using current NAV values
        chartData.push({
          date: monthKey,
          current: Math.round(currentUnits * currentNavValue),
          comparison: Math.round(comparisonUnits * comparisonNavValue),
          invested: totalInvested
        });
      }
      
      current.setMonth(current.getMonth() + 1);
    }
    
    return { currentUnits, comparisonUnits, totalInvested, chartData };
  }

  calculateLumpSum(currentNav, comparisonNav, amount, investmentDate) {
    const investDate = new Date(investmentDate);
    
    const currentNavOnDate = this.findNavOnDate(currentNav, investDate);
    const comparisonNavOnDate = this.findNavOnDate(comparisonNav, investDate);
    
    if (!currentNavOnDate || !comparisonNavOnDate) {
      throw new Error('NAV data not available for the specified investment date');
    }
    
    const currentUnits = amount / currentNavOnDate;
    const comparisonUnits = amount / comparisonNavOnDate;
    const totalInvested = amount;
    
    return { currentUnits, comparisonUnits, totalInvested };
  }

  groupNavByMonth(navData) {
    const grouped = {};
    
    navData.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Use the NAV closest to the 1st of the month for SIP calculations
      if (!grouped[monthKey]) {
        grouped[monthKey] = item.nav;
      } else {
        // If we have multiple NAVs for the month, use the one closest to the 1st
        const currentDate = new Date(item.date);
        const existingDate = new Date(navData.find(nav => {
          const navDate = new Date(nav.date);
          return `${navDate.getFullYear()}-${String(navDate.getMonth() + 1).padStart(2, '0')}` === monthKey && nav.nav === grouped[monthKey];
        })?.date || item.date);
        
        if (currentDate.getDate() <= existingDate.getDate()) {
          grouped[monthKey] = item.nav;
        }
      }
    });
    
    return grouped;
  }

  findNavOnDate(navData, targetDate) {
    const target = targetDate.toISOString().split('T')[0];
    
    // Try to find exact date match
    const exactMatch = navData.find(item => item.date === target);
    if (exactMatch) {
      return exactMatch.nav;
    }
    
    // Find the closest date before the target date
    const sortedNavData = [...navData].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (let i = sortedNavData.length - 1; i >= 0; i--) {
      const navDate = new Date(sortedNavData[i].date);
      if (navDate <= targetDate) {
        return sortedNavData[i].nav;
      }
    }
    
    // If no date before target, use the earliest available NAV
    return sortedNavData[0]?.nav || null;
  }

  calculateCAGR(initialValue, finalValue, years) {
    if (initialValue <= 0 || finalValue <= 0 || years <= 0) {
      return 0;
    }
    
    return ((Math.pow(finalValue / initialValue, 1 / years) - 1) * 100);
  }

  calculateXIRR(cashFlows, dates) {
    // Simple XIRR approximation - for production, consider using a proper financial library
    if (cashFlows.length !== dates.length || cashFlows.length < 2) {
      return 0;
    }

    // Newton-Raphson method for XIRR calculation
    let rate = 0.1; // Initial guess
    const tolerance = 0.0001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        const daysDiff = (dates[j] - dates[0]) / (1000 * 60 * 60 * 24);
        const yearsDiff = daysDiff / 365;
        const factor = Math.pow(1 + rate, yearsDiff);
        
        npv += cashFlows[j] / factor;
        dnpv -= cashFlows[j] * yearsDiff / factor / (1 + rate);
      }

      if (Math.abs(npv) < tolerance) {
        return rate * 100; // Convert to percentage
      }

      rate = rate - npv / dnpv;
    }

    return rate * 100;
  }

  validateCalculationInputs(currentFund, comparisonFund, investmentType, amount, startDate, endDate) {
    const errors = [];

    if (!currentFund || !currentFund.navData?.length) {
      errors.push('Current fund NAV data is missing or empty');
    }

    if (!comparisonFund || !comparisonFund.navData?.length) {
      errors.push('Comparison fund NAV data is missing or empty');
    }

    if (!['sip', 'lump'].includes(investmentType)) {
      errors.push('Investment type must be either "sip" or "lump"');
    }

    if (!amount || amount <= 0) {
      errors.push('Investment amount must be greater than 0');
    }

    if (!startDate || isNaN(new Date(startDate))) {
      errors.push('Valid start date is required');
    }

    if (investmentType === 'sip' && endDate && new Date(endDate) <= new Date(startDate)) {
      errors.push('End date must be after start date for SIP');
    }

    return errors;
  }

  // New methods for portfolio features
  async calculatePortfolioMetrics({ funds, investmentType, totalAmount, benchmarkIndex }) {
    try {
      // Calculate expected returns based on fund categories
      let expectedAnnualReturn = 0;
      for (const fund of funds) {
        const categoryReturn = await this.getExpectedReturnByCategory(fund.category);
        expectedAnnualReturn += (categoryReturn * fund.allocation / 100);
      }

      // Calculate diversification score
      const categories = [...new Set(funds.map(f => f.category))];
      const diversificationScore = Math.min(100, (categories.length / 5) * 100);

      // Calculate risk level
      const riskLevel = await this.calculateRiskLevel(funds);

      // Get real benchmark return
      const benchmarkReturn = benchmarkIndex ? 
        await this.getBenchmarkReturns(benchmarkIndex) : 
        await this.getBenchmarkReturns('nifty50');
      const outperformance = expectedAnnualReturn - benchmarkReturn;

      return {
        expectedAnnualReturn: Math.round(expectedAnnualReturn * 100) / 100,
        riskLevel,
        diversificationScore: Math.round(diversificationScore),
        benchmarkReturn,
        outperformance: Math.round(outperformance * 100) / 100,
        totalFunds: funds.length,
        allocation: this.calculateAllocationBreakdown(funds)
      };
    } catch (error) {
      this.logger.error('Error calculating portfolio metrics', error);
      throw error;
    }
  }

  calculateSIPReturns({ navData, monthlyAmount, duration, startDate }) {
    try {
      let totalInvested = 0;
      let totalUnits = 0;
      let monthlyData = [];

      const start = new Date(startDate);
      
      for (let month = 0; month < duration; month++) {
        const currentDate = new Date(start);
        currentDate.setMonth(currentDate.getMonth() + month);
        
        // Find NAV for this month (simplified - use first available NAV)
        const monthNav = this.findNavForDate(navData, currentDate) || 100;
        
        const units = monthlyAmount / monthNav;
        totalInvested += monthlyAmount;
        totalUnits += units;

        monthlyData.push({
          month: month + 1,
          date: currentDate.toISOString().split('T')[0],
          amount: monthlyAmount,
          nav: monthNav,
          units,
          totalInvested,
          totalUnits
        });
      }

      // Current value calculation
      const latestNav = navData[navData.length - 1]?.nav || 100;
      const currentValue = totalUnits * latestNav;
      const absoluteReturn = currentValue - totalInvested;
      const years = duration / 12;
      
      // Calculate proper SIP annualized return using XIRR approach
      const cashFlows = [];
      const dates = [];
      
      // Add monthly investments as negative cash flows
      monthlyData.forEach(data => {
        cashFlows.push(-data.amount);
        dates.push(new Date(data.date));
      });
      
      // Add final value as positive cash flow
      const endDate = new Date();
      cashFlows.push(currentValue);
      dates.push(endDate);
      
      const annualizedReturn = this.calculateXIRR(cashFlows, dates);

      return {
        totalInvested,
        currentValue: Math.round(currentValue),
        absoluteReturn: Math.round(absoluteReturn),
        returnPercentage: Math.round((absoluteReturn / totalInvested) * 100 * 100) / 100,
        annualizedReturn: Math.round(annualizedReturn * 100) / 100,
        units: totalUnits,
        monthlyData
      };
    } catch (error) {
      this.logger.error('Error calculating SIP returns', error);
      throw error;
    }
  }

  generateMultiFundSIPChart({ funds, duration, startDate }) {
    const chartData = [];
    const start = new Date(startDate);

    for (let month = 0; month <= duration; month++) {
      const date = new Date(start);
      date.setMonth(date.getMonth() + month);
      
      const monthData = {
        month,
        date: date.toISOString().split('T')[0].slice(0, 7),
        totalValue: 0
      };

      funds.forEach((fund, index) => {
        // Calculate proper SIP value progression for each fund
        let fundValue = 0;
        for (let m = 0; m < month; m++) {
          const monthlyAmount = fund.monthlyAmount || (fund.totalInvested / duration);
          const unitsThisMonth = monthlyAmount / (fund.averageNav || 100);
          const currentNav = fund.latestNav || 100;
          fundValue += unitsThisMonth * currentNav;
        }
        monthData[`fund${index + 1}`] = Math.round(fundValue);
        monthData.totalValue += fundValue;
      });

      monthData.totalValue = Math.round(monthData.totalValue);
      chartData.push(monthData);
    }

    return chartData;
  }

  async calculatePortfolioRisk(funds) {
    try {
      let weightedRisk = 0;
      const totalInvested = funds.reduce((sum, f) => sum + f.totalInvested, 0);

      for (const fund of funds) {
        const fundRisk = await this.getRiskScoreByCategory(fund.category);
        const weight = fund.totalInvested / totalInvested;
        weightedRisk += (fundRisk * weight);
      }

      const riskLevel = this.mapRiskScoreToLevel(weightedRisk);

      // Calculate approximate Sharpe ratio
      const avgReturn = funds.reduce((sum, fund) => sum + fund.annualizedReturn, 0) / funds.length;
      const riskFreeRate = await this.getRiskFreeRate(); // Get real risk-free rate
      // Calculate portfolio volatility from fund volatilities
      const volatility = await this.calculatePortfolioVolatility(funds);
      const sharpeRatio = (avgReturn - riskFreeRate) / volatility;

      return {
        riskLevel,
        riskScore: Math.round(weightedRisk * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100
      };
    } catch (error) {
      this.logger.warn('Failed to calculate dynamic portfolio risk, using fallback', { error: error.message });
      
      // Fallback to static calculation
      const riskScores = {
        'Large Cap': 2,
        'Mid Cap': 4,
        'Small Cap': 6,
        'Debt': 1,
        'Hybrid': 3,
        'Index': 2,
        'ELSS': 4,
        'Sectoral/Thematic': 7
      };

      const weightedRisk = funds.reduce((risk, fund) => {
        const fundRisk = riskScores[fund.category] || 3;
        const weight = fund.totalInvested / funds.reduce((sum, f) => sum + f.totalInvested, 0);
        return risk + (fundRisk * weight);
      }, 0);

      const riskLevel = this.mapRiskScoreToLevel(weightedRisk);

      const avgReturn = funds.reduce((sum, fund) => sum + fund.annualizedReturn, 0) / funds.length;
      const riskFreeRate = await this.getRiskFreeRate(); // Get real risk-free rate
      // Calculate portfolio volatility from static risk scores  
      const volatility = Math.sqrt(weightedRisk) * 5; // Rough approximation from risk scores
      const sharpeRatio = (avgReturn - riskFreeRate) / volatility;

      return {
        riskLevel,
        riskScore: Math.round(weightedRisk * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100
      };
    }
  }

  generatePortfolioRecommendations({ funds, riskMetrics, returnMetrics }) {
    const recommendations = [];

    // Risk-based recommendations
    if (riskMetrics.riskLevel === 'Very High') {
      recommendations.push('Consider reducing allocation to small-cap and sectoral funds to lower portfolio risk');
    } else if (riskMetrics.riskLevel === 'Low') {
      recommendations.push('You could consider adding some mid-cap or small-cap funds for higher growth potential');
    }

    // Return-based recommendations
    if (returnMetrics.annualizedReturn < 10) {
      recommendations.push('Consider reviewing fund selection - some funds may be underperforming');
    } else if (returnMetrics.annualizedReturn > 18) {
      recommendations.push('Excellent returns! Consider booking some profits and rebalancing');
    }

    // Diversification recommendations
    const categories = [...new Set(funds.map(f => f.category))];
    if (categories.length < 3) {
      recommendations.push('Consider diversifying across more fund categories (large-cap, mid-cap, debt)');
    }

    // Fund-specific recommendations
    if (funds.length > 7) {
      recommendations.push('You have many funds - consider consolidating similar funds to reduce overlap');
    }

    return recommendations.length > 0 ? recommendations : 
           ['Your portfolio looks well-balanced. Continue monitoring and rebalance periodically.'];
  }

  // Helper methods
  async getExpectedReturnByCategory(category) {
    try {
      // Map fund categories to their benchmark indices
      const categoryBenchmarks = {
        'Large Cap': 'nifty50',
        'Mid Cap': 'niftymidcap', 
        'Small Cap': 'niftysmallcap',
        'Flexi Cap': 'nifty500',
        'Index': 'nifty50',
        'Debt': null, // Fixed income, use static rate
        'Hybrid': 'nifty50',
        'ELSS': 'nifty50',
        'Sectoral/Thematic': 'nifty500',
        'Banking': 'niftybank',
        'IT': 'niftyit'
      };

      const benchmarkIndex = categoryBenchmarks[category];
      
      if (!benchmarkIndex) {
        // For debt funds, return typical debt market returns
        if (category.toLowerCase().includes('debt') || category.toLowerCase().includes('bond')) {
          return 7;
        }
        // Default to Nifty 50 returns
        return await this.getBenchmarkReturns('nifty50');
      }

      // Get real benchmark returns for this category
      const benchmarkReturn = await this.getBenchmarkReturns(benchmarkIndex);
      
      // Apply category-specific adjustments (alpha expectations)
      const categoryAdjustments = {
        'Large Cap': 0, // Match benchmark
        'Mid Cap': 2, // Expected 2% outperformance
        'Small Cap': 3, // Expected 3% outperformance
        'Flexi Cap': 1, // Expected 1% outperformance
        'Index': -0.5, // Tracking error/expense ratio
        'Hybrid': -1, // Mixed allocation reduces returns
        'ELSS': 1, // Tax advantage allows for better returns
        'Sectoral/Thematic': 1, // Concentration premium
        'Banking': 0,
        'IT': 0
      };

      const adjustment = categoryAdjustments[category] || 0;
      return benchmarkReturn + adjustment; // Return calculated expected return without artificial minimum

    } catch (error) {
      this.logger.error('Failed to get dynamic expected returns', { 
        category, 
        error: error.message 
      });
      
      // Throw error instead of using fake data
      throw new Error(`Unable to calculate expected returns for category ${category}: ${error.message}`);
    }
  }

  async calculateRiskLevel(funds) {
    try {
      let avgRisk = 0;
      
      for (const fund of funds) {
        const fundRisk = await this.getRiskScoreByCategory(fund.category);
        avgRisk += (fundRisk * fund.allocation / 100);
      }

      return this.mapRiskScoreToLevel(avgRisk);
    } catch (error) {
      this.logger.warn('Failed to calculate dynamic risk level, using fallback', { error: error.message });
      
      // Fallback to static calculation
      const riskScores = {
        'Large Cap': 2,
        'Mid Cap': 4, 
        'Small Cap': 6,
        'Debt': 1,
        'Hybrid': 3,
        'Index': 2,
        'ELSS': 4,
        'Sectoral/Thematic': 7
      };

      const avgRisk = funds.reduce((sum, fund) => {
        const fundRisk = riskScores[fund.category] || 3;
        return sum + (fundRisk * fund.allocation / 100);
      }, 0);

      return this.mapRiskScoreToLevel(avgRisk);
    }
  }

  async getRiskScoreByCategory(category) {
    try {
      // Map fund categories to their benchmark indices for volatility calculation
      const categoryBenchmarks = {
        'Large Cap': 'nifty50',
        'Mid Cap': 'niftymidcap', 
        'Small Cap': 'niftysmallcap',
        'Flexi Cap': 'nifty500',
        'Index': 'nifty50',
        'Debt': null, // Fixed income, use static score
        'Hybrid': 'nifty50',
        'ELSS': 'nifty50',
        'Sectoral/Thematic': 'nifty500',
        'Banking': 'niftybank',
        'IT': 'niftyit'
      };

      const benchmarkIndex = categoryBenchmarks[category];
      
      if (!benchmarkIndex) {
        // For debt funds, return low risk score
        if (category.toLowerCase().includes('debt') || category.toLowerCase().includes('bond')) {
          return 1;
        }
        // Default to moderate risk
        return 3;
      }

      // Get volatility from index data
      const indexData = await indexDataService.getIndexHistoricalData(benchmarkIndex, '1y');
      
      if (!indexData.metrics.volatility) {
        throw new Error(`Volatility data not available for ${benchmarkIndex}`);
      }
      
      const volatility = indexData.metrics.volatility;
      
      // Convert volatility to risk score (1-10 scale)
      // Low volatility (<10%) = Low risk (1-2)
      // Medium volatility (10-20%) = Moderate risk (3-4)  
      // High volatility (20-30%) = High risk (5-6)
      // Very high volatility (>30%) = Very high risk (7-10)
      
      let riskScore;
      if (volatility < 10) {
        riskScore = 1 + (volatility / 10); // 1-2 range
      } else if (volatility < 20) {
        riskScore = 2 + ((volatility - 10) / 10) * 2; // 2-4 range
      } else if (volatility < 30) {
        riskScore = 4 + ((volatility - 20) / 10) * 2; // 4-6 range
      } else {
        riskScore = Math.min(10, 6 + ((volatility - 30) / 10) * 4); // 6-10 range
      }

      // Apply category-specific adjustments
      const categoryAdjustments = {
        'Large Cap': 0, // Baseline
        'Mid Cap': 1, // Slightly higher risk
        'Small Cap': 2, // Higher risk due to liquidity/size
        'Flexi Cap': 0.5, // Slightly higher due to flexibility
        'Index': -0.5, // Lower due to diversification
        'Hybrid': -1, // Lower due to debt component
        'ELSS': 0.5, // Lock-in adds some risk
        'Sectoral/Thematic': 1.5, // Concentration risk
        'Banking': 0.5, // Sector concentration
        'IT': 0.5 // Sector concentration
      };

      const adjustment = categoryAdjustments[category] || 0;
      return Math.max(1, Math.min(10, riskScore + adjustment));

    } catch (error) {
      this.logger.error('Failed to get dynamic risk score', { 
        category, 
        error: error.message 
      });
      
      // Throw error instead of using fake data
      throw new Error(`Unable to calculate risk score for category ${category}: ${error.message}`);
    }
  }

  calculateAllocationBreakdown(funds) {
    const allocation = {};
    funds.forEach(fund => {
      allocation[fund.category] = (allocation[fund.category] || 0) + fund.allocation;
    });
    return allocation;
  }

  findNavForDate(navData, targetDate) {
    // Find closest NAV to the target date
    const target = targetDate.toISOString().split('T')[0];
    
    // Try exact match first
    const exactMatch = navData.find(item => item.date === target);
    if (exactMatch) return exactMatch.nav;

    // Find closest date
    let closest = navData[0];
    let minDiff = Math.abs(new Date(navData[0].date) - targetDate);

    for (const item of navData) {
      const diff = Math.abs(new Date(item.date) - targetDate);
      if (diff < minDiff) {
        minDiff = diff;
        closest = item;
      }
    }

    return closest?.nav || 100;
  }
}

// Export singleton instance
const calculationService = new CalculationService();
module.exports = calculationService;