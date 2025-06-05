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
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    const endpoint = `/funds${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.makeRequest(endpoint);
    return response.data || response;
  }

  async getFundDetails(schemeCode) {
    const response = await this.makeRequest(`/funds/${schemeCode}`);
    return response;
  }

  async getFundNav(schemeCode, fromDate, toDate) {
    const params = new URLSearchParams();
    if (fromDate) params.append('from', fromDate);
    if (toDate) params.append('to', toDate);
    
    const queryString = params.toString();
    const endpoint = `/funds/${schemeCode}/nav${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.makeRequest(endpoint);
    return response;
  }

  async comparePortfolios(comparisonData) {
    const response = await this.makeRequest('/compare', {
      method: 'POST',
      body: JSON.stringify(comparisonData),
    });
    return response;
  }

  async compareFundsWithIndex(comparisonData) {
    // Enhanced comparison that includes benchmark index
    const enhancedData = {
      ...comparisonData,
      benchmarkIndex: comparisonData.benchmarkIndex || 'nifty50'
    };
    
    const response = await this.makeRequest('/compare', {
      method: 'POST',
      body: JSON.stringify(enhancedData),
    });
    return response;
  }

  async healthCheck() {
    const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
    return await response.json();
  }

  // Index Data API methods
  async getIndexQuote(indexKey) {
    const response = await this.makeRequest(`/indices/${indexKey}/quote`);
    return response.data;
  }

  async getIndexHistory(indexKey, period = '1y') {
    const response = await this.makeRequest(`/indices/${indexKey}/history?period=${period}`);
    return response.data;
  }

  async getAllIndexQuotes() {
    const response = await this.makeRequest('/indices/quotes');
    return response.data;
  }

  async getAvailableIndices() {
    const response = await this.makeRequest('/indices');
    return response.data;
  }

  async compareWithIndex(comparisonData) {
    const response = await this.makeRequest('/indices/compare', {
      method: 'POST',
      body: JSON.stringify(comparisonData),
    });
    return response.data;
  }

  async checkIndexHealth() {
    const response = await this.makeRequest('/indices/health');
    return response;
  }

  // Portfolio API methods
  async createPortfolio(portfolioData) {
    const response = await this.makeRequest('/portfolio/create', {
      method: 'POST',
      body: JSON.stringify(portfolioData),
    });
    return response;
  }

  async getPortfolio(portfolioId) {
    const response = await this.makeRequest(`/portfolio/${portfolioId}`);
    return response;
  }

  async getUserPortfolios(userId = 'anonymous') {
    const response = await this.makeRequest(`/portfolio/user/${userId}`);
    return response;
  }

  async getPortfolioAnalysis(portfolioId) {
    const response = await this.makeRequest(`/portfolio/${portfolioId}/analysis`);
    return response;
  }

}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;