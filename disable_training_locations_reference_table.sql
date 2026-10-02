-- Disable the training_locations reference table so TSC Wizard uses training_data instead
-- This allows training locations to come directly from your MS Access import

-- Option 1: Delete all training locations from the reference table
-- This forces the fallback to training_data
DELETE FROM training_locations;

-- Option 2: Alternatively, set all to inactive (keeps data but disables them)
-- UPDATE training_locations SET active = false;

-- Verify the table is empty
SELECT * FROM training_locations;

-- After running this, the TSC Wizard will automatically extract unique training_location
-- values from training_data table, including "Online"
