-- Test seed data for manual testing
-- Description: Sample data to verify inserts work correctly
-- Instructions: Execute after running 001_create_tables.sql
-- Note: Dates are dynamically calculated to be within the next 7 days from execution time

-- Clear existing test data (safe for re-runs)
DELETE FROM releases WHERE indicator_id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
);
DELETE FROM indicators WHERE id IN (
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002'
);

-- Insert sample indicators
INSERT INTO indicators (id, name, country_code, category, source_name, source_url)
VALUES 
    (
        '550e8400-e29b-41d4-a716-446655440000',
        'CPI (YoY)',
        'US',
        'Inflation',
        'Bureau of Labor Statistics',
        'https://www.bls.gov/cpi/'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'GDP (QoQ)',
        'EU',
        'Growth',
        'Eurostat',
        'https://ec.europa.eu/eurostat'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'Non-Farm Payrolls',
        'US',
        'Employment',
        'Bureau of Labor Statistics',
        'https://www.bls.gov/ces/'
    );

-- Insert sample releases (dates dynamically calculated for the next 7 days from execution)
INSERT INTO releases (indicator_id, release_at, period, forecast, previous, actual, revised, unit)
VALUES 
    -- Scheduled release in 1 day (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440000',
        CURRENT_TIMESTAMP + INTERVAL '1 day' + INTERVAL '13 hours 30 minutes',
        'Dec 2025',
        '2.8%',
        '2.7%',
        NULL,
        NULL,
        '%'
    ),
    -- Scheduled release in 2 days (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440001',
        CURRENT_TIMESTAMP + INTERVAL '2 days' + INTERVAL '10 hours',
        'Q4 2025',
        '0.3%',
        '0.4%',
        NULL,
        NULL,
        '%'
    ),
    -- Scheduled release in 3 days (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440002',
        CURRENT_TIMESTAMP + INTERVAL '3 days' + INTERVAL '13 hours 30 minutes',
        'Dec 2025',
        '180K',
        '227K',
        NULL,
        NULL,
        'K'
    ),
    -- Scheduled release in 5 days (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440000',
        CURRENT_TIMESTAMP + INTERVAL '5 days' + INTERVAL '14 hours',
        'Jan 2026',
        '2.9%',
        '2.8%',
        NULL,
        NULL,
        '%'
    ),
    -- Scheduled release in 6 days (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440002',
        CURRENT_TIMESTAMP + INTERVAL '6 days' + INTERVAL '12 hours',
        'Jan 2026',
        '200K',
        '180K',
        NULL,
        NULL,
        'K'
    ),
    -- Released 6 hours ago with actual but no revised
    (
        '550e8400-e29b-41d4-a716-446655440000',
        CURRENT_TIMESTAMP - INTERVAL '6 hours',
        'Nov 2025',
        '2.7%',
        '2.6%', 
        '2.7%',
        NULL,
        '%'
    ),
    -- Released 12 hours ago with actual AND revised (for T025 testing)
    (
        '550e8400-e29b-41d4-a716-446655440001',
        CURRENT_TIMESTAMP - INTERVAL '12 hours',
        'Q3 2025',
        '0.4%',
        '0.3%',
        '0.4%',
        '0.35%',
        '%'
    );

-- Verify data
SELECT 
    i.name,
    i.country_code,
    i.category,
    r.release_at,
    r.period,
    r.forecast,
    r.previous,
    r.actual,
    r.revised
FROM indicators i
JOIN releases r ON r.indicator_id = i.id
ORDER BY r.release_at ASC;
