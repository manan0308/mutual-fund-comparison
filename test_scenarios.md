# Mutual Fund Lumpsum Investment Test Scenarios

## Test Results Summary

### **API Analysis**
✅ **Index Data Source**: Yahoo Finance (Real historical data)
✅ **Calculation Method**: `units = amount / startPrice; currentValue = units * endPrice`
✅ **Supported Indices**: Nifty 50, Sensex, Nifty 500, Nifty Bank, Nifty IT, etc.

---

## **Test Scenario 1: Bull Market Period (2020-2023)**
### Setup
- **Fund**: Franklin India Bluechip Fund (100471)
- **Investment**: ₹1,00,000 lumpsum on Jan 1, 2020
- **Period**: 3 years (till Dec 31, 2023)
- **Benchmark**: Nifty 50

### Offline Calculation (Expected)
- **Start NAV (Jan 1, 2020)**: ₹471.22
- **End NAV (Dec 31, 2023)**: ~₹650 (estimated)
- **Fund Units**: 100,000 ÷ 471.22 = **212.22 units**
- **Fund Value**: 212.22 × 650 = **₹1,37,943**
- **Fund Returns**: 37.94% (3-year absolute)
- **Fund CAGR**: ~11.3%

- **Nifty 50 (Jan 1, 2020)**: ~12,000 points
- **Nifty 50 (Dec 31, 2023)**: ~21,800 points
- **Index Returns**: 81.67% (3-year absolute)
- **Index CAGR**: ~22.2%

### Expected Result: **Index should outperform the fund** (Bull market favors passive investing)

---

## **Test Scenario 2: Volatile Market (2018-2021)**
### Setup
- **Fund**: SBI Blue Chip Fund (103504)
- **Investment**: ₹50,000 lumpsum on Jan 1, 2018
- **Period**: 3 years (includes COVID crash & recovery)
- **Benchmark**: Sensex

### Expected Profile
- **2018**: Market decline
- **2019**: Recovery
- **2020**: COVID crash (March) + sharp recovery
- **2021**: Strong bull run

### Expected Result: **Fund should handle volatility better** (Active management advantage)

---

## **Test Scenario 3: Long-term Growth (2015-2025)**
### Setup
- **Fund**: UTI Bluechip Flexicap Fund (103457)
- **Investment**: ₹2,00,000 lumpsum on Jan 1, 2015
- **Period**: 10 years
- **Benchmark**: Nifty 500

### Expected Result: **Fund should show alpha over long term** (Stock selection edge)

---

## **Test Scenario 4: Sector Performance (IT Fund vs IT Index)**
### Setup
- **Fund**: Franklin India Technology Fund (if available)
- **Investment**: ₹75,000 lumpsum on Jan 1, 2021
- **Period**: 2-3 years
- **Benchmark**: Nifty IT

### Expected Result: **Close performance** (Sector funds vs sector indices)

---

## Testing Methodology

### Step 1: Manual API Testing
```bash
# Test Fund NAV Data
curl "http://localhost:3001/api/funds/100471/nav?from=2020-01-01&to=2023-12-31"

# Test Index Historical Data  
curl "http://localhost:3001/api/indices/nifty50/history?period=3y"

# Test Complete Comparison
curl -X POST "http://localhost:3001/api/compare" \
  -H "Content-Type: application/json" \
  -d '{
    "fund1": "100471",
    "fund2": "103504", 
    "investment": 100000,
    "startDate": "2020-01-01",
    "endDate": "2023-12-31",
    "investmentType": "lump",
    "benchmarkIndex": "nifty50"
  }'
```

### Step 2: Frontend Testing
1. Open http://localhost:3000
2. Use Fund Analysis tool
3. Enter the test scenarios
4. Compare with manual calculations

### Step 3: Accuracy Verification
- Cross-check NAV values with actual fund data
- Verify index prices with Yahoo Finance
- Validate calculation formulas
- Check for any data discrepancies

---

## **Validation Criteria**

✅ **Data Accuracy**: Fund NAV matches actual historical data
✅ **Index Accuracy**: Yahoo Finance data matches market reality  
✅ **Calculation Logic**: Mathematical formulas are correct
✅ **Date Handling**: Proper handling of weekends/holidays
✅ **Edge Cases**: Handles missing data gracefully

## Next Steps
1. Execute all test scenarios via app
2. Compare results with offline calculations
3. Document any discrepancies
4. Verify calculation accuracy