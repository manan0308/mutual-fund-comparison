import React, { useState, useEffect } from 'react';
import { AlertCircle, Wifi, WifiOff, BarChart3, Calculator, TrendingUp, PieChart } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('compare'); // compare, portfolio, multisip

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

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-1">
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'compare' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Fund Comparison
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'portfolio' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <PieChart className="h-4 w-4 mr-2" />
              Portfolio Builder
            </button>
            <button
              onClick={() => setActiveTab('multisip')}
              className={`px-6 py-3 rounded-md font-medium transition-colors flex items-center ${
                activeTab === 'multisip' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Multi-SIP Calculator
            </button>
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
          <PortfolioBuilder onPortfolioCreate={(portfolio) => {
            console.log('Portfolio created:', portfolio);
            // You could show success message or redirect here
          }} />
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