import React, { useState } from 'react';
import { Calendar, DollarSign, BarChart3, Target, AlertCircle, TrendingUp, Activity } from 'lucide-react';
import FundSearchDropdown from './FundSearchDropdown';
import { apiService } from '../services/api';
import { 
  getDefaultSipAmount, 
  getDefaultLumpAmount, 
  getDefaultStartDate, 
  getDefaultEndDate, 
  getDefaultLumpDate, 
  getDefaultBenchmarkIndex, 
  getDefaultInvestmentType 
} from '../utils/formDefaults';

const FundAnalysis = () => {
  const [selectedFund1, setSelectedFund1] = useState(null);
  const [selectedFund2, setSelectedFund2] = useState(null);
  const [benchmarkIndex, setBenchmarkIndex] = useState(getDefaultBenchmarkIndex());
  const [investmentType, setInvestmentType] = useState(getDefaultInvestmentType());
  const [sipAmount, setSipAmount] = useState(getDefaultSipAmount());
  const [lumpAmount, setLumpAmount] = useState(getDefaultLumpAmount());
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [lumpDate, setLumpDate] = useState(getDefaultLumpDate());
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const availableIndices = {
    nifty50: { name: 'Nifty 50', description: 'Top 50 companies by market cap' },
    sensex: { name: 'Sensex', description: 'BSE 30 stock index' },
    nifty500: { name: 'Nifty 500', description: 'Top 500 companies' },
    niftymidcap: { name: 'Nifty Midcap 50', description: 'Mid-cap companies' },
    niftysmallcap: { name: 'Nifty Smallcap 50', description: 'Small-cap companies' },
    niftybank: { name: 'Nifty Bank', description: 'Banking sector index' },
    niftyit: { name: 'Nifty IT', description: 'IT sector index' }
  };

  const validateForm = () => {
    if (!selectedFund1) {
      setError('Please select Fund 1 to analyze');
      return false;
    }
    if (!selectedFund2) {
      setError('Please select Fund 2 to compare against');
      return false;
    }

    if (investmentType === 'sip') {
      const amount = parseFloat(sipAmount);
      if (!amount || amount < 500) {
        setError('Minimum SIP amount is ₹500');
        return false;
      }
      if (!startDate || !endDate) {
        setError('Please select start and end dates');
        return false;
      }
      if (new Date(endDate) <= new Date(startDate)) {
        setError('End date must be after start date');
        return false;
      }
    } else {
      const amount = parseFloat(lumpAmount);
      if (!amount || amount < 1000) {
        setError('Minimum lump sum amount is ₹1,000');
        return false;
      }
      if (!lumpDate) {
        setError('Please select investment date');
        return false;
      }
    }

    return true;
  };

  const handleAnalyze = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Use the enhanced comparison API for 3-way comparison
      const comparisonParams = {
        currentFundCode: selectedFund1.schemeCode,
        comparisonFundCode: selectedFund2.schemeCode,
        investmentType,
        amount: investmentType === 'sip' ? parseFloat(sipAmount) : parseFloat(lumpAmount),
        startDate: investmentType === 'sip' ? startDate : lumpDate,
        endDate: investmentType === 'sip' ? endDate : lumpDate,
        benchmarkIndex
      };

      const response = await apiService.compareFundsWithIndex(comparisonParams);
      
      // Get additional fund details
      const [fund1Details, fund2Details, indexQuote] = await Promise.all([
        apiService.getFundDetails(selectedFund1.schemeCode).catch(() => null),
        apiService.getFundDetails(selectedFund2.schemeCode).catch(() => null),
        apiService.getIndexQuote(benchmarkIndex).catch(() => null)
      ]);

      setResults({
        fund1: response.current,
        fund2: response.comparison,
        index: response.index,
        fund1Details,
        fund2Details,
        indexQuote,
        comparison: {
          fund1VsFund2: ((response.current.value - response.comparison.value) / response.comparison.value * 100),
          fund1VsIndex: response.index ? 
            ((response.current.value - response.index.currentValue) / response.index.currentValue * 100) : 0,
          fund2VsIndex: response.index ? 
            ((response.comparison.value - response.index.currentValue) / response.index.currentValue * 100) : 0,
          bestPerformer: getBestPerformer(response.current.value, response.comparison.value, response.index?.currentValue)
        },
        metadata: response.metadata
      });

    } catch (err) {
      setError(err.message || 'Failed to analyze fund. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getBestPerformer = (fund1Value, fund2Value, indexValue) => {
    if (!indexValue) {
      return fund1Value > fund2Value ? 'fund1' : 'fund2';
    }
    
    const values = [
      { name: 'fund1', value: fund1Value },
      { name: 'fund2', value: fund2Value },
      { name: 'index', value: indexValue }
    ];
    
    return values.reduce((best, current) => 
      current.value > best.value ? current : best
    ).name;
  };

  return (
    <div className="space-y-6">
      {/* Fund Analysis Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Target className="mr-2 h-6 w-6 text-blue-600" />
          3-Way Fund Comparison (Fund 1 vs Fund 2 vs Index)
        </h2>
        
        <p className="text-gray-600 mb-6">
          Compare two mutual funds against each other and a benchmark index. Get comprehensive 
          insights to make informed investment decisions with 3-way performance analysis.
        </p>

        {/* Fund Selection */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fund 1 (Your Fund) *
            </label>
            <FundSearchDropdown
              value={selectedFund1}
              onChange={setSelectedFund1}
              placeholder="Search for Fund 1..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fund 2 (Compare Against) *
            </label>
            <FundSearchDropdown
              value={selectedFund2}
              onChange={setSelectedFund2}
              placeholder="Search for Fund 2..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Benchmark Index *
            </label>
            <select
              value={benchmarkIndex}
              onChange={(e) => setBenchmarkIndex(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(availableIndices).map(([key, index]) => (
                <option key={key} value={key}>
                  {index.name} - {index.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Investment Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Investment Type *</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setInvestmentType('sip')}
              className={`p-4 border-2 rounded-lg transition-all ${
                investmentType === 'sip' 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Calendar className="h-6 w-6 mx-auto mb-2" />
              <div className="font-medium">SIP (Monthly)</div>
              <div className="text-sm text-gray-500">Systematic Investment Plan</div>
            </button>
            
            <button
              type="button"
              onClick={() => setInvestmentType('lump')}
              className={`p-4 border-2 rounded-lg transition-all ${
                investmentType === 'lump' 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-6 w-6 mx-auto mb-2" />
              <div className="font-medium">Lump Sum</div>
              <div className="text-sm text-gray-500">One-time Investment</div>
            </button>
          </div>
        </div>

        {/* Investment Details */}
        {investmentType === 'sip' ? (
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly SIP Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={sipAmount}
                  onChange={(e) => setSipAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={getDefaultSipAmount()}
                  min="500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investment Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={lumpAmount}
                  onChange={(e) => setLumpAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={getDefaultLumpAmount()}
                  min="1000"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Investment Date *</label>
              <input
                type="date"
                value={lumpDate}
                onChange={(e) => setLumpDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !selectedFund1 || !selectedFund2}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Analyzing...
            </>
          ) : (
            <>
              <BarChart3 className="mr-2 h-5 w-5" />
              Compare Funds vs Index (3-Way)
            </>
          )}
        </button>
      </div>

      {/* Results Display */}
      {results && (
        <div className="space-y-6">
          {/* Performance Comparison */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
              Performance Comparison
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Fund 1 Performance */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <Target className="mr-2 h-4 w-4" />
                  Fund 1: {selectedFund1.name}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Investment:</span>
                    <span className="font-medium">{formatCurrency(results.fund1.invested)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Current Value:</span>
                    <span className="font-medium">{formatCurrency(results.fund1.value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Absolute Return:</span>
                    <span className={`font-medium ${results.fund1.value > results.fund1.invested ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(results.fund1.value - results.fund1.invested)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Return %:</span>
                    <span className={`font-medium ${results.fund1.value > results.fund1.invested ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(((results.fund1.value - results.fund1.invested) / results.fund1.invested) * 100)}
                    </span>
                  </div>
                  {results.comparison.bestPerformer === 'fund1' && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-2">
                      🏆 Best Performer
                    </div>
                  )}
                </div>
              </div>

              {/* Fund 2 Performance */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                  <Target className="mr-2 h-4 w-4" />
                  Fund 2: {selectedFund2.name}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-700">Investment:</span>
                    <span className="font-medium">{formatCurrency(results.fund2.invested)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Current Value:</span>
                    <span className="font-medium">{formatCurrency(results.fund2.value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Absolute Return:</span>
                    <span className={`font-medium ${results.fund2.value > results.fund2.invested ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(results.fund2.value - results.fund2.invested)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Return %:</span>
                    <span className={`font-medium ${results.fund2.value > results.fund2.invested ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(((results.fund2.value - results.fund2.invested) / results.fund2.invested) * 100)}
                    </span>
                  </div>
                  {results.comparison.bestPerformer === 'fund2' && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-2">
                      🏆 Best Performer
                    </div>
                  )}
                </div>
              </div>

              {/* Index Performance */}
              {results.index && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Activity className="mr-2 h-4 w-4" />
                    {availableIndices[benchmarkIndex].name}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Investment:</span>
                      <span className="font-medium">{formatCurrency(results.index.invested)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Current Value:</span>
                      <span className="font-medium">{formatCurrency(results.index.currentValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Absolute Return:</span>
                      <span className={`font-medium ${results.index.currentValue > results.index.invested ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(results.index.absoluteReturn)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Return %:</span>
                      <span className={`font-medium ${results.index.returnPercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(results.index.returnPercentage)}
                      </span>
                    </div>
                    {results.comparison.bestPerformer === 'index' && (
                      <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-2">
                        🏆 Best Performer
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analysis Summary */}
          {results.index && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Analysis Summary</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Fund vs Index Performance</h4>
                  <p className="text-sm text-gray-700 mb-2">
                    Your selected fund {results.comparison.betterChoice === 'fund' ? 'outperformed' : 'underperformed'} 
                    the {availableIndices[benchmarkIndex].name} by{' '}
                    <span className={`font-medium ${results.comparison.outperformance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(Math.abs(results.comparison.outperformance))}
                    </span>
                  </p>
                  
                  <div className="text-xs text-gray-600">
                    {results.comparison.betterChoice === 'fund' ? (
                      <div className="p-2 bg-green-100 rounded text-green-800">
                        ✅ The mutual fund provided better returns than the index
                      </div>
                    ) : (
                      <div className="p-2 bg-yellow-100 rounded text-yellow-800">
                        ⚠️ Index investment would have been more profitable
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Investment Summary</h4>
                  <div className="text-sm space-y-1">
                    <div>Investment Type: <span className="font-medium">{investmentType === 'sip' ? 'SIP' : 'Lump Sum'}</span></div>
                    <div>Time Period: <span className="font-medium">
                      {investmentType === 'sip' ? `${startDate} to ${endDate}` : lumpDate}
                    </span></div>
                    <div>Benchmark: <span className="font-medium">{availableIndices[benchmarkIndex].name}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FundAnalysis;