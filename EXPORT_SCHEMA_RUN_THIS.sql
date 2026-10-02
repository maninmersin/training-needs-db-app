-- =====================================================
-- COMPREHENSIVE SCHEMA EXPORT QUERY
-- =====================================================
-- INSTRUCTIONS:
-- 1. Open your CURRENT Supabase Dashboard
-- 2. Go to SQL Editor
-- 3. Copy and paste this ENTIRE script
-- 4. Click RUN
-- 5. Copy ALL the results and send them to me
-- 6. I will use the results to create the schema for your new instance
-- =====================================================

-- This will output a complete schema dump including:
-- - All tables with columns, types, and constraints
-- - All indexes
-- - All foreign keys
-- - All RLS policies
-- - All functions and triggers

SELECT
    '-- =====================================================',
    '-- COMPLETE SCHEMA EXPORT',
    '-- Generated: ' || NOW()::TEXT,
    '-- =====================================================';

-- =====================================================
-- PART 1: List all tables in public schema
-- =====================================================
SELECT
    '-- TABLE: ' || table_name as schema_info
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

-- =====================================================
-- PART 2: Complete table definitions with columns
-- =====================================================
SELECT
    table_name,
    column_name,
    data_type,
    COALESCE(character_maximum_length::TEXT, '') as max_length,
    column_default,
    is_nullable,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN (
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
    )
ORDER BY table_name, ordinal_position;

-- =====================================================
-- PART 3: Primary Keys
-- =====================================================
SELECT
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- =====================================================
-- PART 4: Foreign Keys
-- =====================================================
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- =====================================================
-- PART 5: Indexes
-- =====================================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- PART 6: RLS Policies
-- =====================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- PART 7: Custom Functions
-- =====================================================
SELECT
    routine_name,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- =====================================================
-- PART 8: Triggers
-- =====================================================
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- DONE!
-- Copy ALL the results from all sections above
-- Send them to me and I'll create the master schema
-- =====================================================
