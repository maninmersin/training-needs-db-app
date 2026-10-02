-- Fix process_impacts table schema
-- Add missing columns that exist in schema but not in database

DO $$ 
BEGIN
    -- Add new_role_rating column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'process_impacts' 
        AND column_name = 'new_role_rating'
    ) THEN
        ALTER TABLE process_impacts 
        ADD COLUMN new_role_rating INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added new_role_rating column to process_impacts table';
    ELSE
        RAISE NOTICE 'new_role_rating column already exists';
    END IF;

    -- Update constraint to include new_role_rating if needed
    BEGIN
        ALTER TABLE process_impacts 
        DROP CONSTRAINT IF EXISTS valid_ratings;
        
        ALTER TABLE process_impacts 
        ADD CONSTRAINT valid_ratings CHECK (
            process_rating >= 0 AND process_rating <= 3 AND
            role_rating >= 0 AND role_rating <= 3 AND
            new_role_rating >= 0 AND new_role_rating <= 3 AND
            workload_rating >= 0 AND workload_rating <= 3 AND
            overall_impact_rating >= 0 AND overall_impact_rating <= 5 AND
            system_complexity_rating >= 0 AND system_complexity_rating <= 3
        );
        
        RAISE NOTICE 'Updated valid_ratings constraint';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Constraint update failed or already exists: %', SQLERRM;
    END;

END $$;