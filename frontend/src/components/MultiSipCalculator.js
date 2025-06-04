import React, { useState } from 'react';
import { Plus, Trash2, Calculator, TrendingUp, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { apiService } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const FundSearchDropdown = ({ onSelect, excludeIds = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  React.useEffect(() => {
    const searchFunds = async () => {
      if (searchTerm.length < 2) {
        setFunds([]);
        return;
      }
      
      setLoading(true);
      try {
        const results = await apiService.searchFunds(searchTerm);
        setFunds(results.filter(fund => !excludeIds.includes(fund.schemeCode)).slice(0, 8));
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchFunds, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, excludeIds]);

  const handleSelect = (fund) => {
    onSelect(fund);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search and add funds..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      
      {isOpen && searchTerm.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading && (
            <div className="p-3 text-center text-gray-500">Searching...</div>
          )}
          
          {!loading && funds.length > 0 ? (
            funds.map(fund => (
              <div
                key={fund.schemeCode}
                onClick={() => handleSelect(fund)}
                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900 text-sm">{fund.name}</div>
                <div className="text-xs text-gray-500">{fund.category}</div>
              </div>
            ))
          ) : !loading && searchTerm.length >= 2 ? (
            <div className="p-3 text-gray-500 text-center">No funds found</div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const MultiSipCalculator = ({ onCalculationComplete }) => {
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [monthlyAmount, setMonthlyAmount] = useState('10000');
  const [duration, setDuration] = useState('60'); // months
  const [startDate, setStartDate] = useState('2020-01-01');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const addFund = (fund) => {
    if (selectedFunds.find(f => f.schemeCode === fund.schemeCode)) {
      alert('Fund already added');
      return;
    }
    
    if (selectedFunds.length >= 10) {
      alert('Maximum 10 funds allowed');
      return;
    }

    setSelectedFunds([...selectedFunds, { ...fund, allocation: 0 }]);
  };

  const removeFund = (schemeCode) => {
    setSelectedFunds(selectedFunds.filter(f => f.schemeCode !== schemeCode));
  };

  const updateAllocation = (schemeCode, allocation) => {
    setSelectedFunds(selectedFunds.map(fund => 
      fund.schemeCode === schemeCode ? { ...fund, allocation: parseFloat(allocation) || 0 } : fund
    ));
  };

  const getTotalAllocation = () => {
    return selectedFunds.reduce((sum, fund) => sum + fund.allocation, 0);
  };

  const autoBalance = () => {
    if (selectedFunds.length === 0) return;
    
    const equalAllocation = 100 / selectedFunds.length;
    setSelectedFunds(selectedFunds.map(fund => ({
      ...fund,
      allocation: Math.round(equalAllocation * 100) / 100
    })));
  };

  const calculateSIP = async () => {
    if (selectedFunds.length < 2) {
      alert('Please add at least 2 funds');
      return;
    }

    const totalAllocation = getTotalAllocation();
    if (Math.abs(totalAllocation - 100) > 0.01) {
      alert(`Total allocation must be 100%. Current: ${totalAllocation.toFixed(2)}%`);
      return;
    }

    setLoading(true);
    try {
      const sipData = {
        funds: selectedFunds.map(fund => ({
          schemeCode: fund.schemeCode,
          allocation: fund.allocation
        })),
        monthlyAmount: parseFloat(monthlyAmount),
        duration: parseInt(duration),
        startDate
      };

      const response = await fetch('/api/portfolio/sip-calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sipData)
      });

      if (!response.ok) {
        throw new Error('Failed to calculate SIP');
      }

      const result = await response.json();
      setResults(result);
      if (onCalculationComplete) {
        onCalculationComplete(result);
      }
    } catch (error) {
      console.error('Error calculating SIP:', error);
      alert('Failed to calculate SIP');
    } finally {
      setLoading(false);
    }
  };

  const totalAllocation = getTotalAllocation();
  const isValidAllocation = Math.abs(totalAllocation - 100) < 0.01;
  const years = parseInt(duration) / 12;

  return (
    <div className="space-y-6">
      {/* SIP Configuration */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Calculator className="mr-2 h-6 w-6 text-green-600" />
          Multi-Fund SIP Calculator
        </h2>

        {/* SIP Parameters */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly SIP Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">₹</span>
              <input
                type="number"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="10000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SIP Duration
            </label>
            <div className="relative">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="60"
                min="12"
                max="600"
              />
              <span className="absolute right-3 top-2 text-gray-500 text-sm">months</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {years.toFixed(1)} years
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Add Funds */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Funds to SIP
          </label>
          <FundSearchDropdown 
            onSelect={addFund}
            excludeIds={selectedFunds.map(f => f.schemeCode)}
          />
        </div>

        {/* Selected Funds */}
        {selectedFunds.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                SIP Allocation ({selectedFunds.length}/10)
              </h3>
              <button
                onClick={autoBalance}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              >
                Auto Balance
              </button>
            </div>

            <div className="space-y-3">
              {selectedFunds.map((fund) => {
                const fundAmount = Math.round((parseFloat(monthlyAmount) * fund.allocation) / 100);
                return (
                  <div key={fund.schemeCode} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{fund.name}</div>
                      <div className="text-xs text-gray-500">{fund.category}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={fund.allocation}
                        onChange={(e) => updateAllocation(fund.schemeCode, e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-sm text-gray-500">%</span>
                      
                      <div className="text-sm text-gray-600 w-20 text-right">
                        ₹{fundAmount.toLocaleString()}
                      </div>
                      
                      <button
                        onClick={() => removeFund(fund.schemeCode)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Allocation Summary */}
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Total Allocation:</span>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${isValidAllocation ? 'text-green-600' : 'text-red-600'}`}>
                    {totalAllocation.toFixed(2)}%
                  </span>
                  {isValidAllocation ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                </div>
              </div>
              {!isValidAllocation && (
                <div className="text-sm text-red-600 mt-1">
                  Allocation must total 100%
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calculate Button */}
        <button
          onClick={calculateSIP}
          disabled={selectedFunds.length < 2 || !isValidAllocation || loading}
          className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <Calculator className="mr-2 h-5 w-5" />
          )}
          {loading ? 'Calculating...' : 'Calculate Multi-Fund SIP'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Invested</h3>
              <div className="text-2xl font-bold text-blue-600">
                ₹{results.summary.totalInvested.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                ₹{monthlyAmount}/month × {duration} months
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Value</h3>
              <div className="text-2xl font-bold text-green-600">
                ₹{results.summary.currentValue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">
                Portfolio value today
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Gains</h3>
              <div className={`text-2xl font-bold ${results.summary.absoluteReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{Math.abs(results.summary.absoluteReturn).toLocaleString()}
              </div>
              <div className={`text-sm ${results.summary.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {results.summary.returnPercentage >= 0 ? '+' : '-'}{Math.abs(results.summary.returnPercentage).toFixed(2)}%
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Annualized Return</h3>
              <div className="text-2xl font-bold text-purple-600">
                {results.summary.annualizedReturn.toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">
                CAGR
              </div>
            </div>
          </div>

          {/* Fund-wise Breakdown */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Fund-wise Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2">Fund</th>
                    <th className="text-right py-2">Allocation</th>
                    <th className="text-right py-2">Monthly SIP</th>
                    <th className="text-right py-2">Invested</th>
                    <th className="text-right py-2">Current Value</th>
                    <th className="text-right py-2">Returns</th>
                  </tr>
                </thead>
                <tbody>
                  {results.funds.map((fund, index) => (
                    <tr key={fund.schemeCode} className="border-b border-gray-100">
                      <td className="py-3">
                        <div className="font-medium text-gray-900">{fund.name}</div>
                        <div className="text-gray-500 text-xs">{fund.category}</div>
                      </td>
                      <td className="text-right py-3">{fund.allocation}%</td>
                      <td className="text-right py-3">₹{fund.monthlyAmount.toLocaleString()}</td>
                      <td className="text-right py-3">₹{fund.totalInvested.toLocaleString()}</td>
                      <td className="text-right py-3">₹{fund.currentValue.toLocaleString()}</td>
                      <td className={`text-right py-3 ${fund.annualizedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fund.annualizedReturn.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Growth Chart */}
          {results.chartData && results.chartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Portfolio Growth Over Time</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={results.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `₹${(value/1000).toFixed(0)}K`} />
                    <Tooltip 
                      formatter={(value) => [`₹${value.toLocaleString()}`, 'Portfolio Value']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalValue" 
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {results.recommendations && results.recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Recommendations</h3>
              <ul className="space-y-2">
                {results.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSipCalculator;