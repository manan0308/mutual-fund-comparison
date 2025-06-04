import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, DollarSign, Calendar, Target, Award, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const ResultsDisplay = ({ results, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Calculating comparison...</h3>
        <p className="text-gray-500">Please wait while we analyze your investment scenarios</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-red-500 mb-4">
          <BarChart3 className="h-16 w-16 mx-auto opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-red-700 mb-2">Calculation Failed</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!results) return null;

  const { current, comparison, difference, percentageDifference, chartData, metadata } = results;
  const isPositive = difference > 0;
  const absPercentage = Math.abs(percentageDifference);

  // Calculate additional metrics
  const currentROI = ((current.value - current.invested) / current.invested) * 100;
  const comparisonROI = ((comparison.value - comparison.invested) / comparison.invested) * 100;
  const roiDifference = comparisonROI - currentROI;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
          {payload[0] && payload[1] && (
            <p className="text-sm text-gray-600 mt-1 pt-1 border-t">
              Difference: {formatCurrency(payload[1].value - payload[0].value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Current Portfolio */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Portfolio</h3>
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(current.value)}</div>
            <div className="text-sm text-gray-600 truncate" title={current.fund}>
              {current.fund}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Invested:</span>
              <span className="font-medium">{formatCurrency(current.invested)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Units:</span>
              <span className="font-medium">{current.units?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Returns:</span>
              <span className={`font-medium ${currentROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(currentROI)}
              </span>
            </div>
          </div>
        </div>

        {/* Comparison Portfolio */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alternative Portfolio</h3>
            <div className="p-2 bg-green-100 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-green-600">{formatCurrency(comparison.value)}</div>
            <div className="text-sm text-gray-600 truncate" title={comparison.fund}>
              {comparison.fund}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Invested:</span>
              <span className="font-medium">{formatCurrency(comparison.invested)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Units:</span>
              <span className="font-medium">{comparison.units?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Returns:</span>
              <span className={`font-medium ${comparisonROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(comparisonROI)}
              </span>
            </div>
          </div>
        </div>

        {/* Difference */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Difference</h3>
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
              {isPositive ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className={`text-3xl font-bold flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : '-'}{formatCurrency(Math.abs(difference))}
            </div>
            <div className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? 'Better by' : 'Worse by'} {absPercentage.toFixed(2)}%
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ROI Diff:</span>
              <span className={`font-medium ${roiDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(roiDifference)}
              </span>
            </div>
            <div className="pt-2">
              <div className={`text-xs px-2 py-1 rounded ${isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {isPositive 
                  ? ' Alternative performs better' 
                  : ' Current fund performs better'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Investment Details */}
      {metadata && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Info className="h-5 w-5 mr-2 text-blue-600" />
            Investment Details
          </h3>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-gray-500 block">Investment Type</span>
              <span className="font-medium text-gray-900">{metadata.investmentType === 'sip' ? 'SIP (Monthly)' : 'Lump Sum'}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-gray-500 block">Amount</span>
              <span className="font-medium text-gray-900">{formatCurrency(metadata.amount)}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-gray-500 block">Duration</span>
              <span className="font-medium text-gray-900">
                {metadata.dateRange.startDate} to {metadata.dateRange.endDate}
              </span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-gray-500 block">Data Points</span>
              <span className="font-medium text-gray-900">{metadata.dataPoints.current} records</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {chartData && chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
              Portfolio Growth Comparison
            </h3>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span>Current Fund</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span>Alternative Fund</span>
              </div>
            </div>
          </div>
          
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorComparison" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => value.slice(0, 7)}
                />
                <YAxis 
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `¹${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="current"
                  stroke="#3B82F6"
                  fillOpacity={1}
                  fill="url(#colorCurrent)"
                  strokeWidth={2}
                  name="Current Fund"
                />
                <Area
                  type="monotone"
                  dataKey="comparison"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorComparison)"
                  strokeWidth={2}
                  name="Alternative Fund"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="text-center">
              <span className="block text-gray-500">Peak Value Difference</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(Math.max(...chartData.map(d => d.comparison)) - Math.max(...chartData.map(d => d.current)))}
              </span>
            </div>
            <div className="text-center">
              <span className="block text-gray-500">Average Monthly Growth</span>
              <span className="font-medium text-gray-900">
                {((Math.pow(comparison.value / comparison.invested, 1/(chartData.length/12)) - 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="text-center">
              <span className="block text-gray-500">Best Performance</span>
              <span className="font-medium text-gray-900">
                {comparisonROI > currentROI ? 'Alternative Fund' : 'Current Fund'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="h-5 w-5 mr-2 text-blue-600" />
          Key Insights
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Performance Analysis</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className={`inline-block w-2 h-2 rounded-full mt-2 mr-2 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>
                  The alternative fund {isPositive ? 'outperformed' : 'underperformed'} your current fund by {formatCurrency(Math.abs(difference))} ({absPercentage.toFixed(1)}%)
                </span>
              </li>
              <li className="flex items-start">
                <span className={`inline-block w-2 h-2 rounded-full mt-2 mr-2 ${roiDifference >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span>
                  Return on investment difference: {formatPercentage(roiDifference)}
                </span>
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-blue-500"></span>
                <span>
                  Both funds generated {currentROI >= 0 ? 'positive' : 'negative'} returns over the investment period
                </span>
              </li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Recommendations</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {isPositive ? (
                <>
                  <li className="flex items-start">
                    <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-green-500"></span>
                    <span>Consider switching to the alternative fund for potentially better returns</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-yellow-500"></span>
                    <span>Review exit load and tax implications before making the switch</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start">
                    <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-blue-500"></span>
                    <span>Your current fund is performing better - consider staying invested</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-yellow-500"></span>
                    <span>Monitor performance regularly and reassess periodically</span>
                  </li>
                </>
              )}
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 rounded-full mt-2 mr-2 bg-purple-500"></span>
                <span>Consider diversifying across multiple funds to reduce risk</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;