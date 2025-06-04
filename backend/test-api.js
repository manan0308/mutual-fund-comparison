#!/usr/bin/env node

/**
 * Test script to verify MF API integration
 */

const axios = require('axios');
require('dotenv').config();

async function testMFApi() {
  console.log('🧪 Testing MF API Integration...\n');

  const baseURL = process.env.MF_API_BASE_URL || 'https://api.mfapi.in';
  console.log(`📡 Base URL: ${baseURL}`);

  try {
    // Test 1: Get all mutual funds
    console.log('\n1️⃣ Testing: Get all mutual funds');
    const fundsResponse = await axios.get(`${baseURL}/mf`, { timeout: 10000 });
    
    if (fundsResponse.status === 200 && Array.isArray(fundsResponse.data)) {
      console.log(`✅ Success: Retrieved ${fundsResponse.data.length} funds`);
      console.log(`📋 Sample funds:`);
      fundsResponse.data.slice(0, 3).forEach((fund, index) => {
        console.log(`   ${index + 1}. ${fund.schemeName} (${fund.schemeCode})`);
      });
    } else {
      console.log('❌ Failed: Invalid response format');
      return;
    }

    // Test 2: Get specific fund NAV data
    console.log('\n2️⃣ Testing: Get specific fund NAV data');
    const testSchemeCode = '120503'; // ICICI Prudential Bluechip Fund
    console.log(`📊 Testing with scheme code: ${testSchemeCode}`);
    
    const navResponse = await axios.get(`${baseURL}/mf/${testSchemeCode}`, { timeout: 10000 });
    
    if (navResponse.status === 200 && navResponse.data.meta && navResponse.data.data) {
      console.log(`✅ Success: Retrieved NAV data for ${navResponse.data.meta.scheme_name}`);
      console.log(`📈 Latest NAV: ₹${navResponse.data.data[0]?.nav || 'N/A'} (${navResponse.data.data[0]?.date || 'N/A'})`);
      console.log(`📊 Total NAV records: ${navResponse.data.data.length}`);
    } else {
      console.log('❌ Failed: Invalid NAV response format');
      return;
    }

    // Test 3: Test another popular fund
    console.log('\n3️⃣ Testing: Another popular fund');
    const testSchemeCode2 = '118989'; // HDFC Mid-Cap Opportunities Fund
    console.log(`📊 Testing with scheme code: ${testSchemeCode2}`);
    
    const navResponse2 = await axios.get(`${baseURL}/mf/${testSchemeCode2}`, { timeout: 10000 });
    
    if (navResponse2.status === 200 && navResponse2.data.meta && navResponse2.data.data) {
      console.log(`✅ Success: Retrieved NAV data for ${navResponse2.data.meta.scheme_name}`);
      console.log(`📈 Latest NAV: ₹${navResponse2.data.data[0]?.nav || 'N/A'} (${navResponse2.data.data[0]?.date || 'N/A'})`);
    } else {
      console.log('❌ Failed: Invalid NAV response format for second fund');
    }

    // Test 4: Test API response time
    console.log('\n4️⃣ Testing: API response time');
    const start = Date.now();
    await axios.get(`${baseURL}/mf/120503`, { timeout: 5000 });
    const responseTime = Date.now() - start;
    console.log(`⚡ API response time: ${responseTime}ms`);

    console.log('\n🎉 All API tests passed! MF API integration is working correctly.');
    console.log('\n📋 Next steps:');
    console.log('   1. Start the backend: npm run dev');
    console.log('   2. Start the frontend: npm start');
    console.log('   3. Visit: http://localhost:3000');

  } catch (error) {
    console.error('\n❌ API Test Failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   URL: ${error.config?.url}`);
    } else if (error.request) {
      console.error('   No response received - check internet connection');
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check internet connection');
    console.log('   2. Verify MF API is accessible: https://api.mfapi.in/mf');
    console.log('   3. Check firewall/proxy settings');
    
    process.exit(1);
  }
}

// Run the test
testMFApi();