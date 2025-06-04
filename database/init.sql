-- Database Schema for Mutual Fund App

-- 1. Schemes table (Master data of all mutual funds)
CREATE TABLE schemes (
    id SERIAL PRIMARY KEY,
    scheme_code VARCHAR(10) UNIQUE NOT NULL,
    scheme_name VARCHAR(500) NOT NULL,
    scheme_category VARCHAR(100),
    fund_house VARCHAR(200),
    scheme_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. NAV data table (Historical NAV values)
CREATE TABLE nav_data (
    id SERIAL PRIMARY KEY,
    scheme_code VARCHAR(10) NOT NULL,
    nav_date DATE NOT NULL,
    nav_value DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scheme_code) REFERENCES schemes(scheme_code),
    UNIQUE(scheme_code, nav_date)
);

-- 3. User portfolios (Optional - for registered users)
CREATE TABLE user_portfolios (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    portfolio_name VARCHAR(200),
    scheme_code VARCHAR(10),
    investment_type VARCHAR(20), -- 'SIP' or 'LUMP_SUM'
    amount DECIMAL(12, 2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scheme_code) REFERENCES schemes(scheme_code)
);

-- 4. API cache table (For caching external API responses)
CREATE TABLE api_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(200) UNIQUE NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_nav_data_scheme_date ON nav_data(scheme_code, nav_date);
CREATE INDEX idx_schemes_name ON schemes USING gin(to_tsvector('english', scheme_name));
CREATE INDEX idx_schemes_category ON schemes(scheme_category);
CREATE INDEX idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);

-- Data population script
-- This script fetches data from MFApi and populates the database

-- Sample data insertion
INSERT INTO schemes (scheme_code, scheme_name, scheme_category, fund_house, scheme_type) VALUES
('120503', 'ICICI Prudential Bluechip Fund Direct Plan Growth', 'Large Cap', 'ICICI Prudential', 'Open Ended'),
('120505', 'ICICI Prudential Technology Fund Direct Plan Growth', 'Sectoral', 'ICICI Prudential', 'Open Ended'),
('101206', 'SBI Small Cap Fund Direct Plan Growth', 'Small Cap', 'SBI', 'Open Ended'),
('118989', 'HDFC Mid-Cap Opportunities Fund Direct Plan Growth', 'Mid Cap', 'HDFC', 'Open Ended');

-- Function to clean up expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM api_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');