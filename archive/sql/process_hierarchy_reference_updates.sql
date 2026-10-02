-- =============================================
-- PROCESS HIERARCHY REFERENCE DATA UPDATES
-- Convert process hierarchy to support reference data approach
-- =============================================

-- 1. Add fields to process_hierarchy table for reference data support
ALTER TABLE process_hierarchy 
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS functional_area VARCHAR(100),
ADD COLUMN IF NOT EXISTS stakeholder_roles TEXT[], -- Array of role codes
ADD COLUMN IF NOT EXISTS process_owner_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(20) DEFAULT 'medium';

-- Add constraints for new fields
ALTER TABLE process_hierarchy 
ADD CONSTRAINT valid_complexity_level CHECK (complexity_level IN ('low', 'medium', 'high', 'critical'));

-- Allow assessment_id to be NULL for template processes
ALTER TABLE process_hierarchy 
ALTER COLUMN assessment_id DROP NOT NULL;

-- Update unique constraint to handle template processes
-- First drop the existing constraint if it exists
ALTER TABLE process_hierarchy 
DROP CONSTRAINT IF EXISTS unique_process_code_per_assessment;

-- Add new constraint that allows multiple NULL assessment_ids for templates
CREATE UNIQUE INDEX IF NOT EXISTS unique_process_code_per_assessment_or_template 
ON process_hierarchy (assessment_id, process_code) 
WHERE assessment_id IS NOT NULL;

-- Add unique constraint for template processes (where assessment_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS unique_template_process_code 
ON process_hierarchy (process_code) 
WHERE assessment_id IS NULL AND is_template = true;

-- 2. Create process selection tracking table
-- This links assessments to selected processes from the reference library
CREATE TABLE IF NOT EXISTS assessment_process_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES impact_assessments(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES process_hierarchy(id) ON DELETE CASCADE,
    selected_by UUID NOT NULL REFERENCES auth_users(id),
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    selection_reason TEXT,
    meeting_notes TEXT,
    stakeholder_session VARCHAR(255), -- Which stakeholder meeting this was selected in
    
    -- Unique constraint to prevent duplicate selections
    CONSTRAINT unique_assessment_process UNIQUE (assessment_id, process_id)
);

-- 3. Create process meeting sessions table
-- Track stakeholder meetings and which processes were reviewed
CREATE TABLE IF NOT EXISTS process_meeting_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES impact_assessments(id) ON DELETE CASCADE,
    session_name VARCHAR(255) NOT NULL,
    session_date DATE,
    stakeholder_roles TEXT[], -- Which stakeholder roles attended
    meeting_objectives TEXT,
    processes_reviewed INTEGER DEFAULT 0,
    processes_completed INTEGER DEFAULT 0,
    next_steps TEXT,
    created_by UUID NOT NULL REFERENCES auth_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Enable RLS on new tables
ALTER TABLE assessment_process_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_meeting_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY assessment_selections_project_access ON assessment_process_selections
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM impact_assessments ia
        JOIN project_users pu ON pu.project_id = ia.project_id
        WHERE ia.id = assessment_process_selections.assessment_id
        AND pu.user_id = auth.uid()
    )
);

CREATE POLICY meeting_sessions_project_access ON process_meeting_sessions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM impact_assessments ia
        JOIN project_users pu ON pu.project_id = ia.project_id
        WHERE ia.id = process_meeting_sessions.assessment_id
        AND pu.user_id = auth.uid()
    )
);

-- 6. Create indexes for performance
CREATE INDEX idx_process_hierarchy_template ON process_hierarchy(is_template) WHERE is_template = true;
CREATE INDEX idx_process_hierarchy_department ON process_hierarchy(department);
CREATE INDEX idx_process_hierarchy_stakeholder_roles ON process_hierarchy USING GIN(stakeholder_roles);
CREATE INDEX idx_assessment_selections_assessment ON assessment_process_selections(assessment_id);
CREATE INDEX idx_assessment_selections_process ON assessment_process_selections(process_id);
CREATE INDEX idx_meeting_sessions_assessment ON process_meeting_sessions(assessment_id);

-- 7. Create utility functions

-- Function to get template processes with selection status for an assessment
CREATE OR REPLACE FUNCTION get_template_processes_with_selection_status(assessment_uuid UUID)
RETURNS TABLE (
    process_id UUID,
    process_code VARCHAR(20),
    process_name VARCHAR(255),
    level_number INTEGER,
    parent_id UUID,
    department VARCHAR(100),
    functional_area VARCHAR(100),
    stakeholder_roles TEXT[],
    process_owner_role VARCHAR(50),
    complexity_level VARCHAR(20),
    is_selected BOOLEAN,
    has_impact BOOLEAN,
    overall_impact_rating INTEGER,
    impact_status VARCHAR(50),
    selected_at TIMESTAMP WITH TIME ZONE,
    selection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ph.id as process_id,
        ph.process_code,
        ph.process_name,
        ph.level_number,
        ph.parent_id,
        ph.department,
        ph.functional_area,
        ph.stakeholder_roles,
        ph.process_owner_role,
        ph.complexity_level,
        (aps.id IS NOT NULL) as is_selected,
        (pi.id IS NOT NULL) as has_impact,
        pi.overall_impact_rating,
        pi.analysis_status as impact_status,
        aps.selected_at,
        aps.selection_reason
    FROM process_hierarchy ph
    LEFT JOIN assessment_process_selections aps ON aps.process_id = ph.id AND aps.assessment_id = assessment_uuid
    LEFT JOIN process_impacts pi ON pi.process_id = ph.id AND pi.assessment_id = assessment_uuid
    WHERE ph.is_template = true
    ORDER BY ph.process_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get process statistics by stakeholder role
CREATE OR REPLACE FUNCTION get_process_stats_by_stakeholder(assessment_uuid UUID, stakeholder_role_code TEXT)
RETURNS TABLE (
    total_processes INTEGER,
    selected_processes INTEGER,
    completed_impacts INTEGER,
    pending_impacts INTEGER,
    average_impact_rating NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_processes,
        COUNT(aps.id)::INTEGER as selected_processes,
        COUNT(CASE WHEN pi.analysis_status = 'completed' THEN 1 END)::INTEGER as completed_impacts,
        COUNT(CASE WHEN aps.id IS NOT NULL AND pi.analysis_status != 'completed' THEN 1 END)::INTEGER as pending_impacts,
        ROUND(AVG(pi.overall_impact_rating), 2) as average_impact_rating
    FROM process_hierarchy ph
    LEFT JOIN assessment_process_selections aps ON aps.process_id = ph.id AND aps.assessment_id = assessment_uuid
    LEFT JOIN process_impacts pi ON pi.process_id = ph.id AND pi.assessment_id = assessment_uuid
    WHERE ph.is_template = true 
    AND stakeholder_role_code = ANY(ph.stakeholder_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Insert sample master process data based on your CSV
-- This creates a template process library
-- First, clear any existing template data to avoid duplicates
DELETE FROM process_hierarchy WHERE is_template = true;

INSERT INTO process_hierarchy (
    assessment_id,
    process_code,
    process_name,
    level_number,
    parent_id,
    is_template,
    department,
    functional_area,
    stakeholder_roles,
    process_owner_role,
    complexity_level,
    is_active
) VALUES 
-- L0 Level Processes
(NULL, '1', 'PLAN', 0, NULL, true, 'Planning', 'Strategic Planning', ARRAY['MAA', 'AM', 'Merch'], 'MAA', 'medium', true),
(NULL, '2', 'BUY', 0, NULL, true, 'Procurement', 'Purchasing', ARRAY['MAA', 'AM', 'Merch', 'Supplier'], 'AM', 'high', true),
(NULL, '3', 'MOVE', 0, NULL, true, 'Logistics', 'Supply Chain', ARRAY['Brand Logistics', 'DC', 'MAA'], 'Brand Logistics', 'high', true),
(NULL, '7', 'DATA MIGRATION', 0, NULL, true, 'IT', 'Data Management', ARRAY['Tech', 'MAA'], 'Tech', 'critical', true);

-- Get the L0 process IDs for parent references
DO $$
DECLARE 
    buy_process_id UUID;
    move_process_id UUID;
BEGIN
    -- Get BUY process ID
    SELECT id INTO buy_process_id FROM process_hierarchy WHERE process_code = '2' AND is_template = true LIMIT 1;
    -- Get MOVE process ID  
    SELECT id INTO move_process_id FROM process_hierarchy WHERE process_code = '3' AND is_template = true LIMIT 1;
    
    -- Insert L1 Level Processes
    INSERT INTO process_hierarchy (
        assessment_id,
        process_code,
        process_name,
        level_number,
        parent_id,
        is_template,
        department,
        functional_area,
        stakeholder_roles,
        process_owner_role,
        complexity_level,
        is_active
    ) VALUES 
    (NULL, '2.3', 'Purchase Order Management', 1, buy_process_id, true, 'Procurement', 'Purchase Orders', ARRAY['MAA', 'AM', 'Merch'], 'MAA', 'medium', true),
    (NULL, '3.1', 'Allocation & Replenishment', 1, move_process_id, true, 'Logistics', 'Inventory Management', ARRAY['MAA', 'AM', 'Merch', 'DC'], 'MAA', 'high', true),
    (NULL, '3.2', 'Inbound Goods Movement', 1, move_process_id, true, 'Logistics', 'Inbound Operations', ARRAY['Brand Logistics', 'AM', 'Merch', 'DC'], 'Brand Logistics', 'medium', true),
    (NULL, '3.7', 'Stock Management', 1, move_process_id, true, 'Logistics', 'Inventory Control', ARRAY['MAA', 'AM', 'Merch', 'DC'], 'MAA', 'medium', true);
END $$;

-- Insert sample L2 processes (based on your CSV examples)
DO $$
DECLARE 
    po_mgmt_id UUID;
    allocation_id UUID;
    inbound_id UUID;
    stock_mgmt_id UUID;
BEGIN
    -- Get L1 process IDs
    SELECT id INTO po_mgmt_id FROM process_hierarchy WHERE process_code = '2.3' AND is_template = true LIMIT 1;
    SELECT id INTO allocation_id FROM process_hierarchy WHERE process_code = '3.1' AND is_template = true LIMIT 1;
    SELECT id INTO inbound_id FROM process_hierarchy WHERE process_code = '3.2' AND is_template = true LIMIT 1;
    SELECT id INTO stock_mgmt_id FROM process_hierarchy WHERE process_code = '3.7' AND is_template = true LIMIT 1;
    
    -- Insert L2 Level Processes
    INSERT INTO process_hierarchy (
        assessment_id,
        process_code,
        process_name,
        level_number,
        parent_id,
        is_template,
        department,
        functional_area,
        stakeholder_roles,
        process_owner_role,
        complexity_level,
        is_active
    ) VALUES 
    (NULL, '2.3.1', 'Create & Maintain Purchase Order', 2, po_mgmt_id, true, 'Procurement', 'PO Creation', ARRAY['BAA', 'AM', 'Merch', 'Supplier'], 'BAA', 'low', true),
    (NULL, '3.1.1', 'Trading Actions', 2, allocation_id, true, 'Logistics', 'Allocation Management', ARRAY['MAA', 'AM', 'Merch', 'DC'], 'MAA', 'high', true),
    (NULL, '3.2.1', 'Delivery Request', 2, inbound_id, true, 'Logistics', 'Delivery Coordination', ARRAY['Freight Forwarder', 'Supplier', 'AM', 'Merch', 'DC'], 'AM', 'medium', true),
    (NULL, '3.7.1', 'Stock Movement', 2, stock_mgmt_id, true, 'Logistics', 'Stock Transfers', ARRAY['MAA', 'AM', 'Merch', 'DC'], 'MAA', 'medium', true);
END $$;

-- 9. Create trigger to update updated_at timestamp on meeting sessions
CREATE TRIGGER update_meeting_sessions_updated_at 
BEFORE UPDATE ON process_meeting_sessions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 10. Comments for documentation
COMMENT ON TABLE assessment_process_selections IS 'Tracks which template processes have been selected for analysis in each assessment';
COMMENT ON TABLE process_meeting_sessions IS 'Records stakeholder meetings and process review sessions';

COMMENT ON COLUMN process_hierarchy.is_template IS 'Indicates if this is a reusable template process (true) or assessment-specific (false)';
COMMENT ON COLUMN process_hierarchy.stakeholder_roles IS 'Array of stakeholder role codes that are involved in this process';
COMMENT ON COLUMN process_hierarchy.process_owner_role IS 'Primary stakeholder role responsible for this process';
COMMENT ON COLUMN process_hierarchy.complexity_level IS 'Process complexity rating for planning purposes';

-- 11. Update existing process_hierarchy records to be templates if they exist
UPDATE process_hierarchy 
SET is_template = false 
WHERE is_template IS NULL;

-- Set any existing records with standard codes to be templates
UPDATE process_hierarchy 
SET is_template = true,
    stakeholder_roles = ARRAY['MAA', 'AM', 'Merch']
WHERE process_code IN ('1', '2', '3', '7') AND assessment_id IS NOT NULL;