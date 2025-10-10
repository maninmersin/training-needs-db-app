-- Database Migration: Add unique constraint for plan names per owner
-- This prevents duplicate plan names for the same user at the database level
-- Run this in your Supabase SQL Editor

-- Step 1: Clean up any existing duplicates (optional - only if you have duplicates)
-- This script will rename duplicates by adding a number suffix
DO $$
DECLARE
    duplicate_record RECORD;
    new_name TEXT;
    counter INTEGER;
BEGIN
    -- Find and rename duplicate plan names for each owner
    FOR duplicate_record IN 
        SELECT owner_id, name, array_agg(id ORDER BY created_at) as plan_ids
        FROM plans 
        WHERE owner_id IS NOT NULL
        GROUP BY owner_id, name 
        HAVING count(*) > 1
    LOOP
        -- Keep the first plan (oldest) with original name, rename the rest
        counter := 1;
        FOR i IN 2..array_length(duplicate_record.plan_ids, 1) LOOP
            new_name := duplicate_record.name || '-' || counter;
            
            -- Make sure the new name is also unique
            WHILE EXISTS (
                SELECT 1 FROM plans 
                WHERE owner_id = duplicate_record.owner_id 
                AND name = new_name
            ) LOOP
                counter := counter + 1;
                new_name := duplicate_record.name || '-' || counter;
            END LOOP;
            
            -- Update the duplicate plan with the new unique name
            UPDATE plans 
            SET name = new_name, updated_at = NOW()
            WHERE id = duplicate_record.plan_ids[i];
            
            RAISE NOTICE 'Renamed duplicate plan % to %', duplicate_record.name, new_name;
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- Step 2: Add the unique constraint
-- This ensures no two plans can have the same name for the same owner
ALTER TABLE plans 
ADD CONSTRAINT unique_plan_name_per_owner 
UNIQUE (owner_id, name);

-- Step 3: Add an index for better performance on name lookups
DROP INDEX IF EXISTS idx_plans_name_owner; -- Remove old index if exists
CREATE INDEX idx_plans_name_owner_unique ON plans(owner_id, name);

COMMENT ON CONSTRAINT unique_plan_name_per_owner ON plans IS 
'Ensures each user can only have one plan with a given name';