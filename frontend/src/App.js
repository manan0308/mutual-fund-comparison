import React, { useState, useEffect } from 'react';
import { AlertCircle, Wifi, WifiOff, BarChart3, Calculator, TrendingUp, PieChart, CheckCircle } from 'lucide-react';
import InvestmentForm from './components/InvestmentForm';
import ResultsDisplay from './components/ResultsDisplay';
import PortfolioBuilder from './components/PortfolioBuilder';
import MultiSipCalculator from './components/MultiSipCalculator';
import { apiService } from './services/api';

const App = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const [activeTab, setActiveTab] = useState('portfolio'); // compare, portfolio, multisip
  const [portfolioSuccess, setPortfolioSuccess] = useState(null);

  // Check API health on component mount
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const health = await apiService.healthCheck();
        setApiStatus(health.status === 'OK' ? 'online' : 'offline');
      } catch (err) {
        setApiStatus('offline');
      }
    };

    checkApiHealth();
    // Check every 30 seconds
    const interval = setInterval(checkApiHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const calculateComparison = async (params) => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await apiService.comparePortfolios(params);
      
      // Add additional calculations for display
      const years = params.investmentType === 'sip' 
        ? (new Date(params.endDate) - new Date(params.startDate)) / (1000 * 60 * 60 * 24 * 365)
        : 4;
      
      const currentCAGR = results.current.value > 0 
        ? ((results.current.value / results.current.invested) ** (1/years) - 1) * 100 
        : 0;
      const comparisonCAGR = results.comparison.value > 0 
        ? ((results.comparison.value / results.comparison.invested) ** (1/years) - 1) * 100 
        : 0;
      
      const formattedResults = {
        ...results,
        summary: {
          type: params.investmentType === 'sip' ? 'SIP (Monthly)' : 'Lump Sum',
          duration: `${Math.round(years * 10) / 10} years`,
          totalInvested: results.current.invested,
          currentCAGR: Math.round(currentCAGR * 100) / 100,
          alternativeCAGR: Math.round(comparisonCAGR * 100) / 100
        }
      };
      
      setResults(formattedResults);
    } catch (err) {
      console.error('Comparison error:', err);
      setError(err.message || 'Failed to calculate comparison. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setResults(null);
  };

  // Clear success messages when switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPortfolioSuccess(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <h1 className="text-4xl font-bold text-gray-900">
              Mutual Fund Portfolio Tools
            </h1>
            {/* API Status Indicator */}
            <div className={`ml-4 flex items-center text-sm px-3 py-1 rounded-full ${
              apiStatus === 'online' ? 'bg-green-100 text-green-800' : 
              apiStatus === 'offline' ? 'bg-red-100 text-red-800' : 
              'bg-yellow-100 text-yellow-800'
            }`}>
              {apiStatus === 'online' ? (
                <><Wifi className="h-4 w-4 mr-1" /> API Online</>
              ) : apiStatus === 'offline' ? (
                <><WifiOff className="h-4 w-4 mr-1" /> Offline Mode</>
              ) : (
                <><div className="animate-spin h-4 w-4 mr-1 border-2 border-yellow-800 border-t-transparent rounded-full"></div> Checking...</>
              )}
            </div>
          </div>
          <p className="text-xl text-gray-600">
            Portfolio builder, multi-fund SIP calculator, and fund comparison tools
          </p>
          {apiStatus === 'offline' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              Running in offline mode with sample data. Results are for demonstration only.
            </div>
          )}
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-2 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-2">
              <button
                onClick={() => handleTabChange('compare')}
                className={`p-4 rounded-lg font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                  activeTab === 'compare' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:scale-102'
                }`}
              >
                <BarChart3 className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Fund Comparison</div>
                  <div className="text-xs opacity-75">Compare 2 funds side-by-side</div>
                </div>
              </button>
              
              <button
                onClick={() => handleTabChange('portfolio')}
                className={`p-4 rounded-lg font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                  activeTab === 'portfolio' 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-700 hover:scale-102'
                }`}
              >
                <PieChart className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Portfolio Builder</div>
                  <div className="text-xs opacity-75">Build diversified portfolio</div>
                </div>
              </button>
              
              <button
                onClick={() => handleTabChange('multisip')}
                className={`p-4 rounded-lg font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                  activeTab === 'multisip' 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700 hover:scale-102'
                }`}
              >
                <Calculator className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Multi-SIP Calculator</div>
                  <div className="text-xs opacity-75">Plan SIP across funds</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        {activeTab === 'compare' && (
          <>
            <InvestmentForm onCalculate={calculateComparison} loading={loading} />
            <ResultsDisplay results={results} loading={loading} error={error} />
          </>
        )}
        
        {activeTab === 'portfolio' && (
          <>
            {portfolioSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-800">Portfolio Created Successfully!</h3>
                    <p className="text-sm text-green-700 mt-1">
                      "{portfolioSuccess.portfolio.name}" with {portfolioSuccess.portfolio.funds.length} funds
                    </p>
                    <div className="mt-2 text-xs text-green-600">
                      {portfolioSuccess.portfolio.totalMonthlyInvestment > 0 && 
                        `Monthly SIP: ₹${portfolioSuccess.portfolio.totalMonthlyInvestment.toLocaleString()}`
                      }
                      {portfolioSuccess.portfolio.totalLumpSumInvestment > 0 && 
                        ` | Lump Sum: ₹${portfolioSuccess.portfolio.totalLumpSumInvestment.toLocaleString()}`
                      }
                    </div>
                  </div>
                  <button
                    onClick={() => setPortfolioSuccess(null)}
                    className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            <PortfolioBuilder onPortfolioCreate={(portfolio) => {
              setPortfolioSuccess(portfolio);
              // Auto-scroll to success message
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 100);
            }} />
          </>
        )}
        
        {activeTab === 'multisip' && (
          <MultiSipCalculator onCalculationComplete={(calculation) => {
            console.log('SIP calculation completed:', calculation);
            // You could show additional analysis here
          }} />
        )}
        
        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>© 2025 Mutual Fund Comparison Tool. Data sourced from MFApi.in</p>
          <p className="mt-1">
            Disclaimer: This tool is for educational purposes only. Please consult a financial advisor before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;