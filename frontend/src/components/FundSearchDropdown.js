import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { apiService } from '../services/api';

const FundSearchDropdown = ({ value, onChange, placeholder, excludeId = null, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search funds with debouncing
  useEffect(() => {
    const searchFunds = async () => {
      if (searchTerm.length < 2) {
        try {
          const initialFunds = await apiService.searchFunds('', 8);
          setFunds(initialFunds.filter(fund => fund.id !== excludeId));
          setError(null);
        } catch (err) {
          setError('Failed to load funds');
          setFunds([]);
        }
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const results = await apiService.searchFunds(searchTerm, 10);
        setFunds(results.filter(fund => fund.id !== excludeId));
      } catch (err) {
        setError('Search failed. Please try again.');
        setFunds([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchFunds, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, excludeId]);

  const handleFundSelect = (fund) => {
    setIsOpen(false);
    setSearchTerm('');
    onChange(fund);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (value && e.target.value !== value.name) {
      onChange(null); // Clear selection if user types something different
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (!searchTerm && value) {
      setSearchTerm(value.name);
    }
  };

  const handleClearSelection = () => {
    setSearchTerm('');
    onChange(null);
    setIsOpen(false);
  };

  const displayValue = value ? value.name : searchTerm;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
        <input
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          autoComplete="off"
        />
        {value && (
          <button
            onClick={handleClearSelection}
            className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="p-3 text-center text-gray-500">
              <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
              Searching...
            </div>
          )}
          
          {error && (
            <div className="p-3 text-center text-red-500 text-sm">
              {error}
            </div>
          )}
          
          {!loading && !error && funds.length > 0 ? (
            <>
              <div className="p-2 text-xs text-gray-500 border-b bg-gray-50">
                {funds.length} fund{funds.length !== 1 ? 's' : ''} found
              </div>
              {funds.map(fund => (
                <div
                  key={fund.id}
                  onClick={() => handleFundSelect(fund)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900 text-sm line-clamp-2">
                    {fund.name}
                  </div>
                  <div className="text-xs text-gray-500 flex justify-between items-center mt-1">
                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {fund.category}
                    </span>
                    {fund.nav && (
                      <span className="font-medium">NAV: ¹{fund.nav}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Code: {fund.schemeCode}
                  </div>
                </div>
              ))}
            </>
          ) : !loading && !error ? (
            <div className="p-3 text-gray-500 text-center text-sm">
              {searchTerm.length >= 2 
                ? 'No funds found. Try a different search term.' 
                : 'Type at least 2 characters to search funds...'}
            </div>
          ) : null}
        </div>
      )}
      
      {/* Selected fund display */}
      {value && !isOpen && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-900">{value.name}</div>
          <div className="text-xs text-blue-700 flex justify-between">
            <span>{value.category}</span>
            <span>Code: {value.schemeCode}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundSearchDropdown;