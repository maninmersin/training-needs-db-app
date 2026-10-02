-- =====================================================
-- COMPLETE SCHEMA EXPORT SCRIPT
-- Run this in your CURRENT Supabase SQL Editor
-- Copy the output to create a complete schema backup
-- =====================================================

-- This will generate CREATE TABLE statements for all your tables
-- Copy the results and save to a new file

SELECT
    'CREATE TABLE ' || tablename || ' (' || E'\n' ||
    '    ' || array_to_string(
        array_agg(
            column_name || ' ' ||
            data_type ||
            CASE
                WHEN character_maximum_length IS NOT NULL
                THEN '(' || character_maximum_length || ')'
                ELSE ''
            END ||
            CASE
                WHEN column_default IS NOT NULL
                THEN ' DEFAULT ' || column_default
                ELSE ''
            END ||
            CASE
                WHEN is_nullable = 'NO'
                THEN ' NOT NULL'
                ELSE ''
            END
            ORDER BY ordinal_position
        ),
        ',' || E'\n    '
    ) || E'\n' || ');' || E'\n' AS table_definition
FROM (
    SELECT
        c.table_name AS tablename,
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.column_default,
        c.is_nullable,
        c.ordinal_position
    FROM information_schema.columns c
    INNER JOIN information_schema.tables t
        ON c.table_name = t.table_name
        AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT LIKE 'pg_%'
    ORDER BY c.table_name, c.ordinal_position
) sub
GROUP BY tablename
ORDER BY tablename;
