-- =====================================================
-- SCHEMA BACKUP GENERATOR
-- Run this in your CURRENT Supabase SQL Editor
-- Copy all the output results and save to a file
-- =====================================================

-- Step 1: Generate CREATE TABLE statements
-- Copy the output from this query
SELECT
    'CREATE TABLE IF NOT EXISTS ' ||
    table_schema || '.' || table_name || ' (' || E'\n  ' ||
    string_agg(
        column_name || ' ' ||
        CASE
            WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
            WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' AND numeric_precision IS NOT NULL THEN
                'NUMERIC(' || numeric_precision || ',' || COALESCE(numeric_scale, 0) || ')'
            ELSE UPPER(data_type)
        END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
        ',' || E'\n  '
        ORDER BY ordinal_position
    ) || E'\n);' || E'\n' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name NOT LIKE 'pg_%'
GROUP BY table_schema, table_name
ORDER BY table_name;

-- Step 2: Generate PRIMARY KEY constraints
-- Copy the output from this query
SELECT
    'ALTER TABLE ' || table_schema || '.' || table_name ||
    ' ADD CONSTRAINT ' || constraint_name ||
    ' PRIMARY KEY (' ||
    string_agg(column_name, ', ' ORDER BY ordinal_position) ||
    ');' as pk_statement
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
GROUP BY table_schema, table_name, constraint_name
ORDER BY table_name;

-- Step 3: Generate FOREIGN KEY constraints
-- Copy the output from this query
SELECT
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name ||
    ' ADD CONSTRAINT ' || tc.constraint_name ||
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_schema || '.' || ccu.table_name ||
    '(' || ccu.column_name || ')' ||
    ' ON DELETE ' || rc.delete_rule ||
    ' ON UPDATE ' || rc.update_rule || ';' as fk_statement
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Step 4: Generate INDEX statements
-- Copy the output from this query
SELECT
    'CREATE INDEX IF NOT EXISTS ' || indexname ||
    ' ON ' || schemaname || '.' || tablename ||
    ' USING ' ||
    CASE WHEN indexdef LIKE '%USING btree%' THEN 'btree'
         WHEN indexdef LIKE '%USING hash%' THEN 'hash'
         WHEN indexdef LIKE '%USING gist%' THEN 'gist'
         WHEN indexdef LIKE '%USING gin%' THEN 'gin'
         ELSE 'btree'
    END ||
    ' (' ||
    substring(indexdef from '\((.*)\)') ||
    ');' as index_statement
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- Step 5: List all functions (you'll need to manually copy these)
-- Copy the output from this query
SELECT
    'CREATE OR REPLACE FUNCTION ' ||
    n.nspname || '.' || p.proname ||
    '(' || pg_get_function_arguments(p.oid) || ') ' ||
    'RETURNS ' || pg_get_function_result(p.oid) ||
    ' AS $$ ' || E'\n-- Function body not exported\n' ||
    '$$ LANGUAGE ' || l.lanname || ';' as function_stub
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
ORDER BY p.proname;
