const logger = require('../utils/logger');

class CalculationService {
  constructor() {
    this.logger = logger;
    this.benchmarkReturns = {
      nifty50: 12.5,
      sensex: 12.2,
      nifty500: 11.8,
      niftymidcap: 15.2,
      niftysmallcap: 18.5
    };
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
          parseFloat(((comparisonValue - currentValue) / currentValue * 100).toFixed(2)) : 0,
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
        
        // Calculate current portfolio values for chart
        const latestCurrentNav = currentNav[currentNav.length - 1]?.nav || currentNavValue;
        const latestComparisonNav = comparisonNav[comparisonNav.length - 1]?.nav || comparisonNavValue;
        
        chartData.push({
          date: monthKey,
          current: Math.round(currentUnits * latestCurrentNav),
          comparison: Math.round(comparisonUnits * latestComparisonNav),
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
      
      // Use the first NAV of the month (typically the earliest date)
      if (!grouped[monthKey]) {
        grouped[monthKey] = item.nav;
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
  calculatePortfolioMetrics({ funds, investmentType, totalAmount, benchmarkIndex }) {
    try {
      // Calculate expected returns based on fund categories
      const expectedAnnualReturn = funds.reduce((weighted, fund) => {
        const categoryReturn = this.getExpectedReturnByCategory(fund.category);
        return weighted + (categoryReturn * fund.allocation / 100);
      }, 0);

      // Calculate diversification score
      const categories = [...new Set(funds.map(f => f.category))];
      const diversificationScore = Math.min(100, (categories.length / 5) * 100);

      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(funds);

      // Benchmark comparison
      const benchmarkReturn = benchmarkIndex ? this.benchmarkReturns[benchmarkIndex] || 12 : 12;
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
      const annualizedReturn = ((currentValue / totalInvested) ** (1/years) - 1) * 100;

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
        const monthlyInvestment = month * fund.monthlyAmount;
        const currentValue = fund.currentValue * (month / duration);
        monthData[`fund${index + 1}`] = Math.round(currentValue);
        monthData.totalValue += currentValue;
      });

      monthData.totalValue = Math.round(monthData.totalValue);
      chartData.push(monthData);
    }

    return chartData;
  }

  calculatePortfolioRisk(funds) {
    // Simplified risk calculation based on fund categories
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

    const riskLevel = weightedRisk <= 2 ? 'Low' : 
                     weightedRisk <= 4 ? 'Moderate' : 
                     weightedRisk <= 6 ? 'High' : 'Very High';

    // Calculate approximate Sharpe ratio
    const avgReturn = funds.reduce((sum, fund) => sum + fund.annualizedReturn, 0) / funds.length;
    const riskFreeRate = 6; // Assume 6% risk-free rate
    const volatility = weightedRisk * 3; // Simplified volatility calculation
    const sharpeRatio = (avgReturn - riskFreeRate) / volatility;

    return {
      riskLevel,
      riskScore: Math.round(weightedRisk * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100
    };
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
  getExpectedReturnByCategory(category) {
    const returns = {
      'Large Cap': 11,
      'Mid Cap': 14,
      'Small Cap': 16,
      'Flexi Cap': 12,
      'Index': 10,
      'Debt': 7,
      'Hybrid': 9,
      'ELSS': 13,
      'Sectoral/Thematic': 15
    };
    return returns[category] || 12;
  }

  calculateRiskLevel(funds) {
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

    return avgRisk <= 2 ? 'Low' : 
           avgRisk <= 4 ? 'Moderate' : 
           avgRisk <= 6 ? 'High' : 'Very High';
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