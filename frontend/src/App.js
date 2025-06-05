import React, { useState } from 'react';
import { AlertCircle, BarChart3, Calculator, TrendingUp, PieChart, CheckCircle, Target, Briefcase } from 'lucide-react';
import InvestmentForm from './components/InvestmentForm';
import ResultsDisplay from './components/ResultsDisplay';
import PortfolioBuilder from './components/PortfolioBuilder';
import MultiSipCalculator from './components/MultiSipCalculator';
import FundAnalysis from './components/FundAnalysis';
import { apiService } from './services/api';

const App = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('fund-analysis'); // fund-analysis, portfolio, multisip
  const [portfolioSuccess, setPortfolioSuccess] = useState(null);

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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Mutual Fund Portfolio Tools
          </h1>
          <p className="text-xl text-gray-600">
            Portfolio builder, multi-fund SIP calculator, and fund comparison tools with real-time data
          </p>
        </div>

        {/* Enhanced Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-2 max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-2">
              <button
                onClick={() => handleTabChange('fund-analysis')}
                className={`p-4 rounded-lg font-medium transition-all duration-200 flex flex-col items-center space-y-2 ${
                  activeTab === 'fund-analysis' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' 
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:scale-102'
                }`}
              >
                <Target className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Fund Analysis</div>
                  <div className="text-xs opacity-75">Analyze single fund vs index</div>
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
                <Briefcase className="h-6 w-6" />
                <div>
                  <div className="font-semibold">Portfolio Builder</div>
                  <div className="text-xs opacity-75">Build & manage portfolios</div>
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
        {activeTab === 'fund-analysis' && (
          <FundAnalysis />
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