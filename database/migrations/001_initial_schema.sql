-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for mutual fund comparison app
-- Created: 2025-01-06

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schemes table (Master data of all mutual funds)
CREATE TABLE IF NOT EXISTS schemes (
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
CREATE TABLE IF NOT EXISTS nav_data (
    id SERIAL PRIMARY KEY,
    scheme_code VARCHAR(10) NOT NULL,
    nav_date DATE NOT NULL,
    nav_value DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scheme_code) REFERENCES schemes(scheme_code) ON DELETE CASCADE,
    UNIQUE(scheme_code, nav_date)
);

-- 3. User portfolios (Optional - for registered users)
CREATE TABLE IF NOT EXISTS user_portfolios (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    portfolio_name VARCHAR(200),
    scheme_code VARCHAR(10),
    investment_type VARCHAR(20), -- 'SIP' or 'LUMP_SUM'
    amount DECIMAL(12, 2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scheme_code) REFERENCES schemes(scheme_code) ON DELETE CASCADE
);

-- 4. API cache table (For caching external API responses)
CREATE TABLE IF NOT EXISTS api_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(200) UNIQUE NOT NULL,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Application logs table (For structured logging)
CREATE TABLE IF NOT EXISTS app_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    meta JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    correlation_id UUID
);

-- 6. System metrics table (For monitoring)
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 4) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_nav_data_scheme_date ON nav_data(scheme_code, nav_date);
CREATE INDEX IF NOT EXISTS idx_nav_data_date ON nav_data(nav_date);
CREATE INDEX IF NOT EXISTS idx_schemes_name ON schemes USING gin(to_tsvector('english', scheme_name));
CREATE INDEX IF NOT EXISTS idx_schemes_category ON schemes(scheme_category);
CREATE INDEX IF NOT EXISTS idx_schemes_fund_house ON schemes(fund_house);
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user_id ON user_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_recorded ON system_metrics(metric_name, recorded_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_schemes_updated_at 
    BEFORE UPDATE ON schemes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_cache WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO app_logs (level, message, meta)
    VALUES ('info', 'Cache cleanup completed', jsonb_build_object('deleted_count', deleted_count));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old logs (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app_logs WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins - n_tup_del as row_count,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
    FROM pg_stat_user_tables
    ORDER BY size_bytes DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert initial migration record
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;