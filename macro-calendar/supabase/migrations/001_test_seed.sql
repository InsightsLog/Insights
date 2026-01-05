-- Test seed data for manual testing
-- Description: Sample data to verify inserts work correctly
-- Instructions: Execute after running 001_create_tables.sql
-- Note: Update release_at dates to be within 7 days of current date when testing

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

-- Insert sample releases (dates set for January 5-12, 2026 testing window)
INSERT INTO releases (indicator_id, release_at, period, forecast, previous, actual, revised, unit)
VALUES 
    -- Scheduled release (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '2026-01-06 13:30:00+00',
        'Dec 2025',
        '2.8%',
        '2.7%',
        NULL,
        NULL,
        '%'
    ),
    -- Scheduled release (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440001',
        '2026-01-07 10:00:00+00',
        'Q4 2025',
        '0.3%',
        '0.4%',
        NULL,
        NULL,
        '%'
    ),
    -- Scheduled release (no actual, no revised)
    (
        '550e8400-e29b-41d4-a716-446655440002',
        '2026-01-08 13:30:00+00',
        'Dec 2025',
        '180K',
        '227K',
        NULL,
        NULL,
        'K'
    ),
    -- Released with actual but no revised
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '2026-01-05 08:30:00+00',
        'Nov 2025',
        '2.7%',
        '2.6%', 
        '2.7%',
        NULL,
        '%'
    ),
    -- Released with actual AND revised (for T025 testing)
    (
        '550e8400-e29b-41d4-a716-446655440001',
        '2026-01-05 09:00:00+00',
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
