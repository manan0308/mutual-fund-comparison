import React, { useState } from 'react';
import { Plus, Trash2, PieChart, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { apiService } from '../services/api';

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
  const [totalAmount, setTotalAmount] = useState('100000');
  const [investmentType, setInvestmentType] = useState('lumpsum');
  const [benchmarkIndex, setBenchmarkIndex] = useState('nifty50');
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

  const createPortfolio = async () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name');
      return;
    }

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
      const portfolioData = {
        name: portfolioName,
        funds: selectedFunds.map(fund => ({
          schemeCode: fund.schemeCode,
          allocation: fund.allocation
        })),
        totalAmount: parseFloat(totalAmount),
        investmentType,
        benchmarkIndex
      };

      const response = await fetch('/api/portfolio/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData)
      });

      if (!response.ok) {
        throw new Error('Failed to create portfolio');
      }

      const result = await response.json();
      onPortfolioCreate(result);
    } catch (error) {
      console.error('Error creating portfolio:', error);
      alert('Failed to create portfolio');
    } finally {
      setLoading(false);
    }
  };

  const autoBalance = () => {
    if (selectedFunds.length === 0) return;
    
    const equalAllocation = 100 / selectedFunds.length;
    setSelectedFunds(selectedFunds.map(fund => ({
      ...fund,
      allocation: Math.round(equalAllocation * 100) / 100
    })));
  };

  const totalAllocation = getTotalAllocation();
  const isValidAllocation = Math.abs(totalAllocation - 100) < 0.01;

  // Prepare data for pie chart
  const chartData = selectedFunds
    .filter(fund => fund.allocation > 0)
    .map(fund => ({
      name: fund.name.substring(0, 30) + '...',
      value: fund.allocation,
      category: fund.category
    }));

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <PieChart className="mr-2 h-6 w-6 text-blue-600" />
        Multi-Fund Portfolio Builder
      </h2>

      {/* Portfolio Name and Settings */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Portfolio Name
          </label>
          <input
            type="text"
            value={portfolioName}
            onChange={(e) => setPortfolioName(e.target.value)}
            placeholder="My Balanced Portfolio"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Investment Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">₹</span>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="100000"
            />
          </div>
        </div>
      </div>

      {/* Investment Type and Benchmark */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Investment Type
          </label>
          <select
            value={investmentType}
            onChange={(e) => setInvestmentType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="lumpsum">Lump Sum</option>
            <option value="sip">SIP</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Benchmark Index
          </label>
          <select
            value={benchmarkIndex}
            onChange={(e) => setBenchmarkIndex(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

      {/* Selected Funds */}
      {selectedFunds.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Selected Funds ({selectedFunds.length}/10)
            </h3>
            <button
              onClick={autoBalance}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Auto Balance
            </button>
          </div>

          <div className="space-y-3">
            {selectedFunds.map((fund, index) => (
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
                  
                  <button
                    onClick={() => removeFund(fund.schemeCode)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
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

      {/* Portfolio Visualization */}
      {chartData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Allocation</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({name, value}) => `${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Create Portfolio Button */}
      <button
        onClick={createPortfolio}
        disabled={!portfolioName.trim() || selectedFunds.length < 2 || !isValidAllocation || loading}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
        ) : (
          <TrendingUp className="mr-2 h-5 w-5" />
        )}
        {loading ? 'Creating Portfolio...' : 'Create Portfolio'}
      </button>
    </div>
  );
};

export default PortfolioBuilder;