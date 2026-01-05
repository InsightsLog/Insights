-- Test seed data for manual testing
-- Description: Sample data to verify inserts work correctly
-- Instructions: Execute after running 001_create_tables.sql

-- Insert sample indicator
INSERT INTO indicators (id, name, country_code, category, source_name, source_url)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'CPI (YoY)',
    'US',
    'Inflation',
    'Bureau of Labor Statistics',
    'https://www.bls.gov/cpi/'
);

-- Insert sample releases
INSERT INTO releases (indicator_id, release_at, period, forecast, previous, unit)
VALUES 
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '2026-01-15 08:30:00-05',
        'December 2025',
        '3.2%',
        '3.1%',
        '%'
    ),
    (
        '550e8400-e29b-41d4-a716-446655440000',
        '2025-12-15 08:30:00-05',
        'November 2025',
        '3.1%',
        '3.0%',
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
    r.previous
FROM indicators i
JOIN releases r ON r.indicator_id = i.id
ORDER BY r.release_at DESC;
