import React, { useState } from 'react';
import { Plus, Trash2, PieChart, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { apiService } from '../services/api';
import { getDefaultBenchmarkIndex } from '../utils/formDefaults';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

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

const PortfolioBuilder = ({ onPortfolioCreate }) => {
  const [portfolioName, setPortfolioName] = useState('');
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [benchmarkIndex, setBenchmarkIndex] = useState(getDefaultBenchmarkIndex());
  const [loading, setLoading] = useState(false);

  const addFund = (fund) => {
    if (selectedFunds.find(f => f.schemeCode === fund.schemeCode)) {
      alert('Fund already added to portfolio');
      return;
    }
    
    if (selectedFunds.length >= 10) {
      alert('Maximum 10 funds allowed per portfolio');
      return;
    }

    // Add fund with individual investment settings
    const today = new Date().toISOString().split('T')[0];
    setSelectedFunds([...selectedFunds, { 
      ...fund, 
      investmentType: 'sip',
      amount: 5000,
      startDate: today,
      sipDuration: 60 // months
    }]);
  };

  const removeFund = (schemeCode) => {
    setSelectedFunds(selectedFunds.filter(f => f.schemeCode !== schemeCode));
  };

  const updateFundConfig = (schemeCode, field, value) => {
    setSelectedFunds(selectedFunds.map(fund => 
      fund.schemeCode === schemeCode ? { ...fund, [field]: value } : fund
    ));
  };

  const getTotalMonthlyInvestment = () => {
    return selectedFunds.reduce((sum, fund) => {
      if (fund.investmentType === 'sip') {
        return sum + (parseFloat(fund.amount) || 0);
      }
      return sum;
    }, 0);
  };

  const getTotalLumpSumInvestment = () => {
    return selectedFunds.reduce((sum, fund) => {
      if (fund.investmentType === 'lumpsum') {
        return sum + (parseFloat(fund.amount) || 0);
      }
      return sum;
    }, 0);
  };

  const createPortfolio = async () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name');
      return;
    }

    if (selectedFunds.length < 1) {
      alert('Please add at least 1 fund');
      return;
    }

    // Validate each fund has required data
    for (const fund of selectedFunds) {
      if (!fund.amount || fund.amount <= 0) {
        alert(`Please enter a valid amount for ${fund.name}`);
        return;
      }
      if (!fund.startDate) {
        alert(`Please enter a start date for ${fund.name}`);
        return;
      }
    }

    setLoading(true);
    try {
      const portfolioData = {
        name: portfolioName,
        funds: selectedFunds.map(fund => ({
          schemeCode: fund.schemeCode,
          name: fund.name,
          category: fund.category,
          investmentType: fund.investmentType,
          amount: parseFloat(fund.amount),
          startDate: fund.startDate,
          sipDuration: fund.investmentType === 'sip' ? fund.sipDuration : null
        })),
        benchmarkIndex
      };

      // Create portfolio using real API
      const result = await apiService.createPortfolio(portfolioData);
      onPortfolioCreate(result);
    } catch (error) {
      console.error('Error creating portfolio:', error);
      alert('Failed to create portfolio');
    } finally {
      setLoading(false);
    }
  };

  const autoDistribute = () => {
    if (selectedFunds.length === 0) return;
    
    const baseAmount = 5000;
    setSelectedFunds(selectedFunds.map(fund => ({
      ...fund,
      amount: baseAmount
    })));
  };

  const totalMonthlySIP = getTotalMonthlyInvestment();
  const totalLumpSum = getTotalLumpSumInvestment();
  const sipFunds = selectedFunds.filter(f => f.investmentType === 'sip').length;
  const lumpSumFunds = selectedFunds.filter(f => f.investmentType === 'lumpsum').length;

  // Prepare data for pie chart (based on investment amounts)
  const chartData = selectedFunds
    .filter(fund => fund.amount > 0)
    .map(fund => ({
      name: fund.name.substring(0, 30) + '...',
      value: parseFloat(fund.amount) || 0,
      category: fund.category,
      type: fund.investmentType
    }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <PieChart className="mr-2 h-6 w-6 text-green-600" />
          Portfolio Builder
        </h2>

        {/* Portfolio Settings */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Portfolio Name
            </label>
            <input
              type="text"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              placeholder="My Diversified Portfolio"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Benchmark Index
            </label>
            <select
              value={benchmarkIndex}
              onChange={(e) => setBenchmarkIndex(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="nifty50">Nifty 50</option>
              <option value="sensex">Sensex</option>
              <option value="nifty500">Nifty 500</option>
              <option value="niftymidcap">Nifty Midcap</option>
              <option value="niftysmallcap">Nifty Smallcap</option>
            </select>
          </div>
        </div>

        {/* Add Funds */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Funds to Portfolio
          </label>
          <FundSearchDropdown 
            onSelect={addFund}
            excludeIds={selectedFunds.map(f => f.schemeCode)}
          />
        </div>
      </div>

      {/* Fund Configuration */}
      {selectedFunds.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">
              Fund Configuration ({selectedFunds.length}/10)
            </h3>
            <button
              onClick={autoDistribute}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
            >
              Auto Distribute ₹5000
            </button>
          </div>

          <div className="space-y-6">
            {selectedFunds.map((fund, index) => (
              <div key={fund.schemeCode} className="border border-gray-200 rounded-lg p-4">
                {/* Fund Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{fund.name}</h4>
                    <p className="text-sm text-gray-500">{fund.category}</p>
                  </div>
                  <button
                    onClick={() => removeFund(fund.schemeCode)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Investment Configuration */}
                <div className="grid md:grid-cols-4 gap-4">
                  {/* Investment Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Investment Type
                    </label>
                    <select
                      value={fund.investmentType}
                      onChange={(e) => updateFundConfig(fund.schemeCode, 'investmentType', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    >
                      <option value="sip">SIP (Monthly)</option>
                      <option value="lumpsum">Lump Sum</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {fund.investmentType === 'sip' ? 'Monthly Amount' : 'Lump Sum Amount'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-2 text-gray-500 text-sm">₹</span>
                      <input
                        type="number"
                        value={fund.amount}
                        onChange={(e) => updateFundConfig(fund.schemeCode, 'amount', e.target.value)}
                        className="w-full pl-6 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                        placeholder="5000"
                        min="100"
                      />
                    </div>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={fund.startDate}
                      onChange={(e) => updateFundConfig(fund.schemeCode, 'startDate', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* SIP Duration (only for SIP) */}
                  {fund.investmentType === 'sip' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        SIP Duration
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={fund.sipDuration}
                          onChange={(e) => updateFundConfig(fund.schemeCode, 'sipDuration', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                          placeholder="60"
                          min="12"
                          max="600"
                        />
                        <span className="absolute right-2 top-2 text-gray-500 text-xs">months</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {(fund.sipDuration / 12).toFixed(1)} years
                      </div>
                    </div>
                  )}
                </div>

                {/* Investment Summary for this fund */}
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {fund.investmentType === 'sip' 
                        ? `Total Investment: ₹${((fund.amount || 0) * (fund.sipDuration || 0)).toLocaleString()}`
                        : `Investment: ₹${(fund.amount || 0).toLocaleString()}`
                      }
                    </span>
                    <span className="text-gray-600">
                      Category: {fund.category}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Portfolio Summary */}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {sipFunds > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">SIP Investments</h4>
                <div className="text-sm text-blue-700">
                  <div>Monthly SIP: ₹{totalMonthlySIP.toLocaleString()}</div>
                  <div>Funds: {sipFunds}</div>
                </div>
              </div>
            )}
            
            {lumpSumFunds > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Lump Sum Investments</h4>
                <div className="text-sm text-green-700">
                  <div>Total Amount: ₹{totalLumpSum.toLocaleString()}</div>
                  <div>Funds: {lumpSumFunds}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio Visualization */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Investment Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({value, type}) => `₹${value.toLocaleString()} (${type})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => [`₹${value.toLocaleString()}`, `${props.payload.type.toUpperCase()}`]} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend with details */}
          <div className="mt-4 grid md:grid-cols-2 gap-2">
            {chartData.map((fund, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                ></div>
                <span className="text-gray-700">
                  {fund.name} - ₹{fund.value.toLocaleString()} ({fund.type})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Portfolio Button */}
      {selectedFunds.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <button
            onClick={createPortfolio}
            disabled={!portfolioName.trim() || selectedFunds.length < 1 || loading}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center text-lg shadow-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
            ) : (
              <TrendingUp className="mr-3 h-6 w-6" />
            )}
            {loading ? 'Creating Portfolio...' : 'Create & Analyze Portfolio'}
          </button>
          
          <div className="mt-3 text-center text-sm text-gray-500">
            Portfolio will be created with {selectedFunds.length} fund{selectedFunds.length > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioBuilder;