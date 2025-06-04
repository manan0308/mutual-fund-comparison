-- Seed data for mutual fund comparison app
-- This file contains sample data to get started with the application

-- Sample mutual fund schemes
INSERT INTO schemes (scheme_code, scheme_name, scheme_category, fund_house, scheme_type) VALUES
-- Large Cap Funds
('120503', 'ICICI Prudential Bluechip Fund Direct Plan Growth', 'Large Cap', 'ICICI Prudential', 'Open Ended'),
('118989', 'HDFC Top 100 Fund Direct Plan Growth', 'Large Cap', 'HDFC', 'Open Ended'),
('101206', 'SBI Bluechip Fund Direct Plan Growth', 'Large Cap', 'SBI', 'Open Ended'),
('100039', 'Axis Bluechip Fund Direct Plan Growth', 'Large Cap', 'Axis', 'Open Ended'),

-- Mid Cap Funds
('118551', 'HDFC Mid-Cap Opportunities Fund Direct Plan Growth', 'Mid Cap', 'HDFC', 'Open Ended'),
('120834', 'ICICI Prudential Midcap Fund Direct Plan Growth', 'Mid Cap', 'ICICI Prudential', 'Open Ended'),
('101262', 'SBI Magnum Midcap Fund Direct Plan Growth', 'Mid Cap', 'SBI', 'Open Ended'),

-- Small Cap Funds
('118825', 'HDFC Small Cap Fund Direct Plan Growth', 'Small Cap', 'HDFC', 'Open Ended'),
('120836', 'ICICI Prudential Smallcap Fund Direct Plan Growth', 'Small Cap', 'ICICI Prudential', 'Open Ended'),
('101311', 'SBI Small Cap Fund Direct Plan Growth', 'Small Cap', 'SBI', 'Open Ended'),

-- Index Funds
('120716', 'ICICI Prudential Nifty Index Fund Direct Plan Growth', 'Index', 'ICICI Prudential', 'Open Ended'),
('118825', 'HDFC Index Fund Nifty 50 Plan Direct Plan Growth', 'Index', 'HDFC', 'Open Ended'),

-- Debt Funds
('120717', 'ICICI Prudential All Seasons Bond Fund Direct Plan Growth', 'Debt', 'ICICI Prudential', 'Open Ended'),
('118826', 'HDFC Corporate Bond Fund Direct Plan Growth', 'Debt', 'HDFC', 'Open Ended'),

-- Flexi Cap / Multi Cap Funds
('118989', 'HDFC Flexi Cap Fund Direct Plan Growth', 'Flexi Cap', 'HDFC', 'Open Ended'),
('120718', 'ICICI Prudential Multicap Fund Direct Plan Growth', 'Flexi Cap', 'ICICI Prudential', 'Open Ended'),

-- ELSS Funds
('118827', 'HDFC Tax Saver Fund Direct Plan Growth', 'ELSS', 'HDFC', 'Open Ended'),
('120719', 'ICICI Prudential Long Term Equity Fund Direct Plan Growth', 'ELSS', 'ICICI Prudential', 'Open Ended'),

-- Sectoral Funds
('120505', 'ICICI Prudential Technology Fund Direct Plan Growth', 'Sectoral/Thematic', 'ICICI Prudential', 'Open Ended'),
('118828', 'HDFC Banking and Financial Services Fund Direct Plan Growth', 'Sectoral/Thematic', 'HDFC', 'Open Ended')

ON CONFLICT (scheme_code) DO UPDATE SET
    scheme_name = EXCLUDED.scheme_name,
    scheme_category = EXCLUDED.scheme_category,
    fund_house = EXCLUDED.fund_house,
    scheme_type = EXCLUDED.scheme_type,
    updated_at = CURRENT_TIMESTAMP;

-- Sample NAV data for testing (last 30 days for one fund - ICICI Prudential Bluechip Fund)
-- In production, this would be populated by the API service
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS nav_date
),
nav_values AS (
    SELECT 
        nav_date,
        -- Generate realistic NAV values with some volatility
        ROUND(
            (450 + (RANDOM() - 0.5) * 20 + 
             SIN(EXTRACT(DOY FROM nav_date) * 2 * PI() / 365) * 10)::numeric, 
            2
        ) AS nav_value
    FROM date_series
    -- Exclude weekends (assuming no NAV on weekends)
    WHERE EXTRACT(dow FROM nav_date) NOT IN (0, 6)
)
INSERT INTO nav_data (scheme_code, nav_date, nav_value)
SELECT '120503', nav_date, nav_value
FROM nav_values
ON CONFLICT (scheme_code, nav_date) DO UPDATE SET
    nav_value = EXCLUDED.nav_value;

-- Sample user portfolios for testing
INSERT INTO user_portfolios (user_id, portfolio_name, scheme_code, investment_type, amount, start_date, end_date) VALUES
('user123', 'My SIP Portfolio', '120503', 'SIP', 5000.00, '2023-01-01', '2024-12-31'),
('user123', 'Lump Sum Investment', '118989', 'LUMP_SUM', 100000.00, '2023-06-01', NULL),
('user456', 'Emergency Fund', '120717', 'SIP', 3000.00, '2023-03-01', '2024-12-31')
ON CONFLICT DO NOTHING;

-- Sample cache entries (these would normally be managed by the application)
INSERT INTO api_cache (cache_key, cache_data, expires_at) VALUES
('sample_funds_list', '{"data": [{"schemeCode": "120503", "schemeName": "ICICI Prudential Bluechip Fund"}]}', CURRENT_TIMESTAMP + INTERVAL '1 hour'),
('health_check_cache', '{"status": "healthy", "timestamp": "2025-01-06T00:00:00Z"}', CURRENT_TIMESTAMP + INTERVAL '5 minutes')
ON CONFLICT (cache_key) DO UPDATE SET
    cache_data = EXCLUDED.cache_data,
    expires_at = EXCLUDED.expires_at,
    created_at = CURRENT_TIMESTAMP;

-- Sample application logs
INSERT INTO app_logs (level, message, meta, correlation_id) VALUES
('info', 'Database seeded successfully', '{"table": "schemes", "count": 20}', uuid_generate_v4()),
('info', 'Sample NAV data inserted', '{"scheme_code": "120503", "days": 30}', uuid_generate_v4()),
('info', 'User portfolios created', '{"count": 3}', uuid_generate_v4());

-- Sample system metrics
INSERT INTO system_metrics (metric_name, metric_value, metric_unit, tags) VALUES
('database_size', 10.5, 'MB', '{"type": "storage"}'),
('active_connections', 5, 'count', '{"type": "database"}'),
('api_response_time', 150.0, 'ms', '{"endpoint": "/api/funds"}'),
('cache_hit_ratio', 85.5, 'percentage', '{"type": "performance"}');

-- Verify the seeded data
DO $$
DECLARE
    schemes_count INTEGER;
    nav_count INTEGER;
    portfolios_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO schemes_count FROM schemes;
    SELECT COUNT(*) INTO nav_count FROM nav_data;
    SELECT COUNT(*) INTO portfolios_count FROM user_portfolios;
    
    RAISE NOTICE 'Data seeding completed:';
    RAISE NOTICE '- Schemes: % records', schemes_count;
    RAISE NOTICE '- NAV Data: % records', nav_count;
    RAISE NOTICE '- User Portfolios: % records', portfolios_count;
    
    -- Insert a summary log
    INSERT INTO app_logs (level, message, meta)
    VALUES (
        'info', 
        'Database seeding summary',
        jsonb_build_object(
            'schemes_count', schemes_count,
            'nav_count', nav_count,
            'portfolios_count', portfolios_count,
            'seeded_at', CURRENT_TIMESTAMP
        )
    );
END $$;