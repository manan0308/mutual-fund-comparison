import React, { useState } from 'react';
import { Calendar, DollarSign, BarChart3, PieChart, AlertCircle } from 'lucide-react';
import FundSearchDropdown from './FundSearchDropdown';
import { 
  getDefaultSipAmount, 
  getDefaultLumpAmount, 
  getDefaultStartDate, 
  getDefaultEndDate, 
  getDefaultLumpDate, 
  getDefaultInvestmentType 
} from '../utils/formDefaults';

const InvestmentForm = ({ onCalculate, loading = false }) => {
  const [currentFund, setCurrentFund] = useState(null);
  const [comparisonFund, setComparisonFund] = useState(null);
  const [investmentType, setInvestmentType] = useState(getDefaultInvestmentType());
  const [sipAmount, setSipAmount] = useState(getDefaultSipAmount());
  const [lumpAmount, setLumpAmount] = useState(getDefaultLumpAmount());
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [lumpDate, setLumpDate] = useState(getDefaultLumpDate());
  const [errors, setErrors] = useState({});

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!currentFund) {
      newErrors.currentFund = 'Please select your current fund';
    }

    if (!comparisonFund) {
      newErrors.comparisonFund = 'Please select a fund to compare against';
    }

    if (currentFund && comparisonFund && currentFund.id === comparisonFund.id) {
      newErrors.comparisonFund = 'Please select a different fund for comparison';
    }

    if (investmentType === 'sip') {
      const amount = parseFloat(sipAmount);
      if (!amount || amount <= 0) {
        newErrors.sipAmount = 'Please enter a valid SIP amount';
      } else if (amount < 500) {
        newErrors.sipAmount = 'Minimum SIP amount is �500';
      } else if (amount > 1000000) {
        newErrors.sipAmount = 'Maximum SIP amount is �10,00,000';
      }

      if (!startDate) {
        newErrors.startDate = 'Please select a start date';
      }

      if (!endDate) {
        newErrors.endDate = 'Please select an end date';
      }

      if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
        newErrors.endDate = 'End date must be after start date';
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        
        if (monthsDiff < 6) {
          newErrors.endDate = 'Investment period should be at least 6 months';
        }
        
        if (monthsDiff > 600) { // 50 years
          newErrors.endDate = 'Investment period cannot exceed 50 years';
        }
      }
    } else {
      const amount = parseFloat(lumpAmount);
      if (!amount || amount <= 0) {
        newErrors.lumpAmount = 'Please enter a valid investment amount';
      } else if (amount < 1000) {
        newErrors.lumpAmount = 'Minimum investment amount is �1,000';
      } else if (amount > 100000000) {
        newErrors.lumpAmount = 'Maximum investment amount is �10,00,00,000';
      }

      if (!lumpDate) {
        newErrors.lumpDate = 'Please select an investment date';
      } else {
        const investDate = new Date(lumpDate);
        const today = new Date();
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(today.getFullYear() - 10);

        if (investDate > today) {
          newErrors.lumpDate = 'Investment date cannot be in the future';
        } else if (investDate < fiveYearsAgo) {
          newErrors.lumpDate = 'Investment date cannot be more than 10 years ago';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (!validateForm()) {
      return;
    }

    const params = {
      currentFundCode: currentFund.schemeCode,
      comparisonFundCode: comparisonFund.schemeCode,
      investmentType,
      amount: investmentType === 'sip' ? parseFloat(sipAmount) : parseFloat(lumpAmount),
      startDate: investmentType === 'sip' ? startDate : lumpDate,
      endDate: investmentType === 'sip' ? endDate : lumpDate
    };

    onCalculate(params);
  };

  const handleAmountChange = (value, setter, field) => {
    setter(value);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleDateChange = (value, setter, field) => {
    setter(value);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleFundChange = (fund, setter, field) => {
    setter(fund);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    // Clear comparison fund error if it was about selecting the same fund
    if (field === 'currentFund' && errors.comparisonFund && comparisonFund && fund?.id === comparisonFund.id) {
      setErrors(prev => ({ ...prev, comparisonFund: 'Please select a different fund for comparison' }));
    }
  };

  // Calculate investment summary
  const getInvestmentSummary = () => {
    if (investmentType === 'sip' && sipAmount && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      const totalInvestment = parseFloat(sipAmount) * months;
      
      return {
        months,
        totalInvestment,
        years: Math.round(months / 12 * 10) / 10
      };
    } else if (investmentType === 'lump' && lumpAmount) {
      return {
        totalInvestment: parseFloat(lumpAmount),
        years: 4 // Assuming 4 years for growth calculation
      };
    }
    return null;
  };

  const summary = getInvestmentSummary();

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <PieChart className="mr-2 h-6 w-6 text-blue-600" />
        Portfolio Comparison Setup
      </h2>

      {/* Fund Selection */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Current Fund *
          </label>
          <FundSearchDropdown
            value={currentFund}
            onChange={(fund) => handleFundChange(fund, setCurrentFund, 'currentFund')}
            placeholder="Search your current mutual fund..."
            className={errors.currentFund ? 'border-red-300' : ''}
          />
          {errors.currentFund && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.currentFund}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Compare Against *
          </label>
          <FundSearchDropdown
            value={comparisonFund}
            onChange={(fund) => handleFundChange(fund, setComparisonFund, 'comparisonFund')}
            placeholder="Search fund to compare..."
            excludeId={currentFund?.id}
            className={errors.comparisonFund ? 'border-red-300' : ''}
          />
          {errors.comparisonFund && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.comparisonFund}
            </p>
          )}
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
              <span className="absolute left-3 top-2 text-gray-500">�</span>
              <input
                type="number"
                value={sipAmount}
                onChange={(e) => handleAmountChange(e.target.value, setSipAmount, 'sipAmount')}
                className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.sipAmount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={getDefaultSipAmount()}
                min="500"
                max="1000000"
              />
            </div>
            {errors.sipAmount && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.sipAmount}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange(e.target.value, setStartDate, 'startDate')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.startDate ? 'border-red-300' : 'border-gray-300'
              }`}
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.startDate}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange(e.target.value, setEndDate, 'endDate')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.endDate ? 'border-red-300' : 'border-gray-300'
              }`}
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.endDate && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.endDate}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investment Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">�</span>
              <input
                type="number"
                value={lumpAmount}
                onChange={(e) => handleAmountChange(e.target.value, setLumpAmount, 'lumpAmount')}
                className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.lumpAmount ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={getDefaultLumpAmount()}
                min="1000"
                max="100000000"
              />
            </div>
            {errors.lumpAmount && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.lumpAmount}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Investment Date *</label>
            <input
              type="date"
              value={lumpDate}
              onChange={(e) => handleDateChange(e.target.value, setLumpDate, 'lumpDate')}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.lumpDate ? 'border-red-300' : 'border-gray-300'
              }`}
              max={new Date().toISOString().split('T')[0]}
            />
            {errors.lumpDate && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.lumpDate}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Investment Summary */}
      {summary && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Investment Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <div className="font-medium">{investmentType === 'sip' ? 'SIP (Monthly)' : 'Lump Sum'}</div>
            </div>
            {summary.months && (
              <div>
                <span className="text-gray-500">Duration:</span>
                <div className="font-medium">{summary.months} months ({summary.years} years)</div>
              </div>
            )}
            <div>
              <span className="text-gray-500">Total Investment:</span>
              <div className="font-medium">�{summary.totalInvestment.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-gray-500">Amount:</span>
              <div className="font-medium">
                �{investmentType === 'sip' ? parseFloat(sipAmount).toLocaleString() : parseFloat(lumpAmount).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calculate Button */}
      <button
        onClick={handleCalculate}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Calculating...
          </>
        ) : (
          <>
            <BarChart3 className="mr-2 h-5 w-5" />
            Calculate & Compare
          </>
        )}
      </button>
    </div>
  );
};

export default InvestmentForm;