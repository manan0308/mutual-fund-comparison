const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.timeout = parseInt(process.env.REACT_APP_API_TIMEOUT) || 30000;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async searchFunds(searchTerm = '', limit = 50) {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (limit) params.append('limit', limit.toString());
      
      const queryString = params.toString();
      const endpoint = `/funds${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return response.data || response;
    } catch (error) {
      console.warn('Falling back to mock data due to API error:', error.message);
      return this.getMockFunds().filter(fund => 
        !searchTerm || fund.name.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, limit);
    }
  }

  async getFundDetails(schemeCode) {
    try {
      const response = await this.makeRequest(`/funds/${schemeCode}`);
      return response;
    } catch (error) {
      console.warn('Falling back to mock fund details:', error.message);
      const mockFund = this.getMockFunds().find(f => f.schemeCode === schemeCode);
      return mockFund || this.generateMockFundDetails(schemeCode);
    }
  }

  async getFundNav(schemeCode, fromDate, toDate) {
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      
      const queryString = params.toString();
      const endpoint = `/funds/${schemeCode}/nav${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.makeRequest(endpoint);
      return response;
    } catch (error) {
      console.warn('Falling back to mock NAV data:', error.message);
      return this.generateMockNav(schemeCode, fromDate, toDate);
    }
  }

  async comparePortfolios(comparisonData) {
    try {
      const response = await this.makeRequest('/compare', {
        method: 'POST',
        body: JSON.stringify(comparisonData),
      });
      return response;
    } catch (error) {
      console.warn('Falling back to mock comparison:', error.message);
      return this.generateMockComparison(comparisonData);
    }
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
      return await response.json();
    } catch (error) {
      return { status: 'unavailable', error: error.message };
    }
  }

  // Mock data methods for offline functionality
  getMockFunds() {
    return [
      { id: '120503', name: "ICICI Prudential Bluechip Fund Direct Plan Growth", category: "Large Cap", nav: 89.45, schemeCode: '120503' },
      { id: '120505', name: "ICICI Prudential Technology Fund Direct Plan Growth", category: "Sectoral/Thematic", nav: 156.78, schemeCode: '120505' },
      { id: '101206', name: "SBI Small Cap Fund Direct Plan Growth", category: "Small Cap", nav: 134.22, schemeCode: '101206' },
      { id: '118989', name: "HDFC Mid-Cap Opportunities Fund Direct Plan Growth", category: "Mid Cap", nav: 267.89, schemeCode: '118989' },
      { id: '119551', name: "Axis Bluechip Fund Direct Plan Growth", category: "Large Cap", nav: 98.34, schemeCode: '119551' },
      { id: '120716', name: "Mirae Asset Large Cap Fund Direct Plan Growth", category: "Large Cap", nav: 78.56, schemeCode: '120716' },
      { id: '122639', name: "Parag Parikh Flexi Cap Fund Direct Plan Growth", category: "Flexi Cap", nav: 234.67, schemeCode: '122639' },
      { id: '120834', name: "UTI Nifty 50 Index Fund Direct Plan Growth", category: "Index", nav: 189.23, schemeCode: '120834' },
      { id: '118825', name: "HDFC Small Cap Fund Direct Plan Growth", category: "Small Cap", nav: 345.12, schemeCode: '118825' },
      { id: '101311', name: "SBI Magnum Midcap Fund Direct Plan Growth", category: "Mid Cap", nav: 156.78, schemeCode: '101311' },
      { id: '120717', name: "ICICI Prudential All Seasons Bond Fund Direct Plan Growth", category: "Debt", nav: 45.67, schemeCode: '120717' },
      { id: '118826', name: "HDFC Corporate Bond Fund Direct Plan Growth", category: "Debt", nav: 23.45, schemeCode: '118826' },
      { id: '118827', name: "HDFC Tax Saver Fund Direct Plan Growth", category: "ELSS", nav: 678.90, schemeCode: '118827' },
      { id: '120719', name: "ICICI Prudential Long Term Equity Fund Direct Plan Growth", category: "ELSS", nav: 234.56, schemeCode: '120719' },
      { id: '118828', name: "HDFC Banking and Financial Services Fund Direct Plan Growth", category: "Sectoral/Thematic", nav: 145.67, schemeCode: '118828' }
    ];
  }

  generateMockFundDetails(schemeCode) {
    const fund = this.getMockFunds().find(f => f.schemeCode === schemeCode);
    return {
      schemeCode,
      schemeName: fund?.name || 'Mock Fund',
      category: fund?.category || 'Equity',
      fundHouse: this.extractFundHouse(fund?.name || 'Mock Fund'),
      latestNav: {
        value: fund?.nav || 100,
        date: new Date().toISOString().split('T')[0]
      },
      totalNavRecords: 1000,
      timestamp: new Date().toISOString()
    };
  }

  generateMockNav(schemeCode, fromDate, toDate) {
    const fund = this.getMockFunds().find(f => f.schemeCode === schemeCode);
    const currentNav = fund ? fund.nav : 100;
    const navData = [];
    
    const startDate = fromDate ? new Date(fromDate) : new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
    const endDate = toDate ? new Date(toDate) : new Date();
    
    let nav = currentNav * 0.7; // Start from 70% of current NAV
    const daysDiff = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
    
    for (let i = 0; i <= daysDiff; i += 7) { // Weekly data points
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Simulate realistic market movements
      const volatility = Math.random() * 0.1 - 0.05; // -5% to +5%
      const trend = 0.0002; // Small upward trend
      nav = nav * (1 + trend + volatility);
      
      navData.push({
        date: date.toISOString().split('T')[0],
        nav: Math.round(nav * 100) / 100
      });
    }
    
    return {
      fundName: fund ? fund.name : 'Mock Fund',
      schemeCode,
      navData: navData.reverse(), // Most recent first
      totalRecords: navData.length,
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      },
      timestamp: new Date().toISOString()
    };
  }

  generateMockComparison(comparisonData) {
    const { amount, investmentType, startDate, endDate } = comparisonData;
    
    // Calculate investment period
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const months = Math.max(1, Math.ceil((end - start) / (30 * 24 * 60 * 60 * 1000)));
    
    const totalInvested = investmentType === 'sip' ? amount * months : amount;
    
    // Generate realistic returns (CAGR between 8-15%)
    const currentCAGR = 0.08 + Math.random() * 0.07; // 8-15%
    const comparisonCAGR = 0.08 + Math.random() * 0.07; // 8-15%
    
    const years = months / 12;
    const currentValue = totalInvested * Math.pow(1 + currentCAGR, years);
    const comparisonValue = totalInvested * Math.pow(1 + comparisonCAGR, years);
    
    const currentFund = this.getMockFunds().find(f => f.schemeCode === comparisonData.currentFundCode);
    const comparisonFund = this.getMockFunds().find(f => f.schemeCode === comparisonData.comparisonFundCode);
    
    return {
      current: {
        value: Math.round(currentValue),
        invested: totalInvested,
        fund: currentFund?.name || 'Current Fund',
        units: Math.round((totalInvested / (currentFund?.nav || 100)) * 100) / 100,
        latestNav: currentFund?.nav || 100
      },
      comparison: {
        value: Math.round(comparisonValue),
        invested: totalInvested,
        fund: comparisonFund?.name || 'Comparison Fund',
        units: Math.round((totalInvested / (comparisonFund?.nav || 100)) * 100) / 100,
        latestNav: comparisonFund?.nav || 100
      },
      difference: Math.round(comparisonValue - currentValue),
      percentageDifference: Math.round(((comparisonValue - currentValue) / currentValue * 100) * 100) / 100,
      chartData: this.generateMockChartData(months, totalInvested, currentCAGR, comparisonCAGR),
      metadata: {
        calculatedAt: new Date().toISOString(),
        investmentType,
        amount,
        dateRange: { startDate, endDate },
        dataPoints: {
          current: months,
          comparison: months
        }
      }
    };
  }

  generateMockChartData(months, totalInvested, currentCAGR, comparisonCAGR) {
    const data = [];
    let currentValue = 0;
    let comparisonValue = 0;
    let invested = 0;
    
    for (let i = 1; i <= Math.min(months, 60); i++) { // Limit to 5 years for chart
      invested += totalInvested / months;
      
      // Calculate compound growth
      const monthlyReturn1 = Math.pow(1 + currentCAGR, i / 12);
      const monthlyReturn2 = Math.pow(1 + comparisonCAGR, i / 12);
      
      currentValue = (totalInvested / months * i) * monthlyReturn1;
      comparisonValue = (totalInvested / months * i) * monthlyReturn2;
      
      const date = new Date();
      date.setMonth(date.getMonth() - months + i);
      
      data.push({
        date: date.toISOString().split('T')[0].slice(0, 7), // YYYY-MM format
        current: Math.round(currentValue),
        comparison: Math.round(comparisonValue),
        invested: Math.round(invested)
      });
    }
    
    return data;
  }

  extractFundHouse(schemeName) {
    const fundHouses = [
      'SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'Reliance', 'Birla', 'UTI',
      'Franklin', 'DSP', 'Invesco', 'Nippon', 'Mirae', 'Sundaram',
      'Tata', 'PGIM', 'Quantum', 'Mahindra', 'IDFC', 'L&T', 'Parag Parikh'
    ];
    
    for (const house of fundHouses) {
      if (schemeName.toLowerCase().includes(house.toLowerCase())) {
        return house;
      }
    }
    
    return 'Others';
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;