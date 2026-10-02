-- =====================================================
-- COMPREHENSIVE SUPABASE SCHEMA EXPORT
-- Run each section in your CURRENT Supabase SQL Editor
-- Copy the results and save to separate files
-- =====================================================

-- =====================================================
-- SECTION 1: TABLE STRUCTURES
-- =====================================================
-- Run this query and copy the results
SELECT
    'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' || E'\n' ||
    '  -- Add columns here from next query' || E'\n' ||
    ');' || E'\n'
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- SECTION 2: COLUMN DEFINITIONS (Run separately)
-- =====================================================
-- For each table, this shows columns with their types
SELECT
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- =====================================================
-- SECTION 3: PRIMARY KEYS
-- =====================================================
SELECT
    'ALTER TABLE ' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' PRIMARY KEY (' || string_agg(kcu.column_name, ', ') || ');'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name;

-- =====================================================
-- SECTION 4: FOREIGN KEYS
-- =====================================================
SELECT
    'ALTER TABLE ' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ')' ||
    ' ON DELETE ' || rc.delete_rule || ';'
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';

-- =====================================================
-- SECTION 5: INDEXES
-- =====================================================
SELECT
    'CREATE INDEX IF NOT EXISTS ' || indexname ||
    ' ON ' || tablename || ' (' ||
    -- Note: This doesn't show column names, you'll need to check manually
    'column_name_here);'
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey';

-- =====================================================
-- SECTION 6: RLS POLICIES
-- =====================================================
SELECT
    'CREATE POLICY "' || policyname || '" ON ' || tablename ||
    ' FOR ' || cmd ||
    CASE
        WHEN permissive = 'PERMISSIVE' THEN ' USING (true);'
        ELSE ' USING (false);'
    END as policy_statement
FROM pg_policies
WHERE schemaname = 'public';

-- =====================================================
-- SECTION 7: FUNCTIONS (Run in SQL editor to see results)
-- =====================================================
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION';

-- =====================================================
-- EASIER ALTERNATIVE: Use Supabase CLI or Dashboard
-- =====================================================
-- Instead of running all these queries, try:
--
-- METHOD 1: Supabase Dashboard
-- 1. Go to Database → Schema
-- 2. Look for "Export" or "Download Schema" button
--
-- METHOD 2: Supabase CLI (if installed)
-- Run: supabase db dump --schema public
--
-- METHOD 3: Give me your connection string (temporarily)
-- I can help you generate the export command
-- =====================================================
