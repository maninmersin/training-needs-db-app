-- =====================================================
-- SUPABASE SCHEMA EXPORT QUERY
-- Run this in your CURRENT Supabase SQL Editor
-- It will generate the complete schema as SQL statements
-- =====================================================

-- STEP 1: Export this schema to a text file
-- STEP 2: Run the output in your NEW Supabase instance

-- =====================================================
-- NOTE: This query generates SQL DDL statements
-- Copy the RESULTS and save them to a file
-- =====================================================

-- Generate CREATE TABLE statements for all tables in public schema
SELECT
    'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' ||
    string_agg(
        column_name || ' ' ||
        UPPER(data_type) ||
        CASE
            WHEN character_maximum_length IS NOT NULL
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END ||
        CASE
            WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ', '
        ORDER BY ordinal_position
    ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE 'sql_%'
GROUP BY table_name
ORDER BY table_name;

-- =====================================================
-- For a more complete export, use pg_dump instead
-- =====================================================
-- The above query gives you table structures but misses:
-- - Primary keys
-- - Foreign keys
-- - Indexes
-- - Triggers
-- - Functions
-- - RLS policies
--
-- Better approach: Use the method below
-- =====================================================
