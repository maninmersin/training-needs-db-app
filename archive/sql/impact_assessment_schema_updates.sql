-- =============================================
-- IMPACT ASSESSMENT SCHEMA UPDATES
-- Align database with CSV format example
-- =============================================

-- 1. Update process_impacts table to match CSV columns exactly
ALTER TABLE process_impacts 
ADD COLUMN IF NOT EXISTS as_is_raci_r TEXT,
ADD COLUMN IF NOT EXISTS as_is_raci_a TEXT,
ADD COLUMN IF NOT EXISTS as_is_raci_c TEXT,
ADD COLUMN IF NOT EXISTS as_is_raci_i TEXT,
ADD COLUMN IF NOT EXISTS to_be_raci_r TEXT,
ADD COLUMN IF NOT EXISTS to_be_raci_a TEXT,
ADD COLUMN IF NOT EXISTS to_be_raci_c TEXT,
ADD COLUMN IF NOT EXISTS to_be_raci_i TEXT,
ADD COLUMN IF NOT EXISTS business_benefits TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS actions TEXT DEFAULT '';

-- Update column names to match CSV exactly
ALTER TABLE process_impacts 
RENAME COLUMN benefits TO general_benefits;

-- Add constraints for new fields
ALTER TABLE process_impacts 
ADD CONSTRAINT valid_status CHECK (status IN ('', 'Review', 'Workshop Required', 'In Progress', 'Complete', 'On Hold', 'Cancelled'));

-- 2. Create reference data tables for dropdowns

-- Systems reference table
CREATE TABLE IF NOT EXISTS impact_assessment_systems (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    system_code VARCHAR(50) NOT NULL,
    system_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_current BOOLEAN DEFAULT true,
    is_future BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_impact_system_code_per_project') THEN
        ALTER TABLE impact_assessment_systems 
        ADD CONSTRAINT unique_impact_system_code_per_project UNIQUE (project_id, system_code);
    END IF;
END $$;

-- Stakeholder roles reference table
CREATE TABLE IF NOT EXISTS impact_assessment_stakeholder_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_code VARCHAR(20) NOT NULL,
    role_name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_impact_role_code_per_project') THEN
        ALTER TABLE impact_assessment_stakeholder_roles 
        ADD CONSTRAINT unique_impact_role_code_per_project UNIQUE (project_id, role_code);
    END IF;
END $$;

-- Status options reference table
CREATE TABLE IF NOT EXISTS impact_assessment_status_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status_code VARCHAR(50) NOT NULL,
    status_name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7) DEFAULT '#6B7280', -- Default gray
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_impact_status_per_project') THEN
        ALTER TABLE impact_assessment_status_options 
        ADD CONSTRAINT unique_impact_status_per_project UNIQUE (project_id, status_code);
    END IF;
END $$;

-- Action templates reference table
CREATE TABLE IF NOT EXISTS impact_assessment_action_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    category VARCHAR(100),
    is_template BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enable RLS on new tables
ALTER TABLE impact_assessment_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_assessment_stakeholder_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_assessment_status_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_assessment_action_templates ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for new tables
CREATE POLICY impact_systems_project_access ON impact_assessment_systems
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = impact_assessment_systems.project_id 
        AND pu.user_id = auth.uid()
    )
);

CREATE POLICY impact_roles_project_access ON impact_assessment_stakeholder_roles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = impact_assessment_stakeholder_roles.project_id 
        AND pu.user_id = auth.uid()
    )
);

CREATE POLICY impact_status_project_access ON impact_assessment_status_options
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = impact_assessment_status_options.project_id 
        AND pu.user_id = auth.uid()
    )
);

CREATE POLICY impact_actions_project_access ON impact_assessment_action_templates
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = impact_assessment_action_templates.project_id 
        AND pu.user_id = auth.uid()
    )
);

-- 5. Create indexes for performance
CREATE INDEX idx_impact_systems_project_id ON impact_assessment_systems(project_id);
CREATE INDEX idx_impact_systems_code ON impact_assessment_systems(system_code);
CREATE INDEX idx_impact_roles_project_id ON impact_assessment_stakeholder_roles(project_id);
CREATE INDEX idx_impact_roles_code ON impact_assessment_stakeholder_roles(role_code);
CREATE INDEX idx_impact_status_project_id ON impact_assessment_status_options(project_id);
CREATE INDEX idx_impact_actions_project_id ON impact_assessment_action_templates(project_id);

-- 6. Insert default reference data (will be created for each project)
-- Function to populate default reference data for a project
CREATE OR REPLACE FUNCTION populate_impact_assessment_reference_data(target_project_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insert default systems
    INSERT INTO impact_assessment_systems (project_id, system_code, system_name, description, is_current, sort_order)
    VALUES 
        (target_project_id, 'ISCM', 'ISCM', 'Integrated Supply Chain Management System', true, 1),
        (target_project_id, 'Manhattan', 'Manhattan WMS', 'Manhattan Warehouse Management System', false, 2),
        (target_project_id, 'Extranet', 'Supplier Extranet', 'External supplier portal system', true, 3),
        (target_project_id, 'Portal', 'Business Portal', 'Internal business process portal', false, 4),
        (target_project_id, 'WebFocus', 'WebFocus', 'Reporting and analytics platform', true, 5),
        (target_project_id, 'RMS', 'Retail Management System', 'Core retail operations system', true, 6)
    ON CONFLICT (project_id, system_code) DO NOTHING;
    
    -- Insert default stakeholder roles
    INSERT INTO impact_assessment_stakeholder_roles (project_id, role_code, role_name, description, sort_order)
    VALUES 
        (target_project_id, 'MAA', 'Merchandising Admin Assistant', 'Merchandising administrative support role', 1),
        (target_project_id, 'AM', 'Assistant Manager', 'Assistant management role', 2),
        (target_project_id, 'Merch', 'Merchandiser', 'Core merchandising role', 3),
        (target_project_id, 'DC', 'Distribution Center', 'Distribution center operations', 4),
        (target_project_id, 'Supplier', 'Supplier', 'External supplier stakeholder', 5),
        (target_project_id, 'BAA', 'Business Admin Assistant', 'Business administrative support', 6),
        (target_project_id, 'Brand Logistics', 'Brand Logistics', 'Brand logistics team', 7),
        (target_project_id, 'HOM', 'Head Office Management', 'Head office management team', 8),
        (target_project_id, 'Goods In', 'Goods In Team', 'Goods receiving team', 9),
        (target_project_id, 'Tech', 'Technical Team', 'Technical support and development', 10),
        (target_project_id, 'Finance', 'Finance Team', 'Financial operations team', 11),
        (target_project_id, 'Buyer', 'Buyer', 'Purchasing and buying team', 12),
        (target_project_id, 'Freight Forwarder', 'Freight Forwarder', 'External freight forwarding services', 13)
    ON CONFLICT (project_id, role_code) DO NOTHING;
    
    -- Insert default status options
    INSERT INTO impact_assessment_status_options (project_id, status_code, status_name, description, color_code, sort_order)
    VALUES 
        (target_project_id, '', 'No Status', 'No specific status assigned', '#6B7280', 0),
        (target_project_id, 'Review', 'Under Review', 'Currently being reviewed', '#F59E0B', 1),
        (target_project_id, 'Workshop Required', 'Workshop Required', 'Requires workshop session', '#EF4444', 2),
        (target_project_id, 'In Progress', 'In Progress', 'Currently being worked on', '#3B82F6', 3),
        (target_project_id, 'Complete', 'Complete', 'Analysis completed', '#10B981', 4),
        (target_project_id, 'On Hold', 'On Hold', 'Temporarily paused', '#F97316', 5),
        (target_project_id, 'Cancelled', 'Cancelled', 'No longer required', '#6B7280', 6)
    ON CONFLICT (project_id, status_code) DO NOTHING;
    
    -- Insert common action templates
    INSERT INTO impact_assessment_action_templates (project_id, action_text, category, sort_order)
    VALUES 
        (target_project_id, 'Workshop required to work out solution', 'Planning', 1),
        (target_project_id, 'Requirements session needed', 'Planning', 2),
        (target_project_id, 'Technical discussion required', 'Technical', 3),
        (target_project_id, 'Business process review needed', 'Process', 4),
        (target_project_id, 'Training requirements to be defined', 'Training', 5),
        (target_project_id, 'System integration analysis required', 'Technical', 6),
        (target_project_id, 'Impact assessment pending', 'Assessment', 7),
        (target_project_id, 'Stakeholder approval required', 'Governance', 8),
        (target_project_id, 'Documentation needs updating', 'Documentation', 9),
        (target_project_id, 'Testing strategy to be defined', 'Testing', 10);
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Auto-populate reference data for existing projects
DO $$
DECLARE 
    project_record RECORD;
BEGIN
    FOR project_record IN SELECT id FROM projects LOOP
        PERFORM populate_impact_assessment_reference_data(project_record.id);
    END LOOP;
END $$;

-- 8. Create trigger to auto-populate reference data for new projects
CREATE OR REPLACE FUNCTION auto_populate_impact_reference_data()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM populate_impact_assessment_reference_data(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new projects (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_populate_impact_reference_trigger') THEN
        CREATE TRIGGER auto_populate_impact_reference_trigger
        AFTER INSERT ON projects
        FOR EACH ROW
        EXECUTE FUNCTION auto_populate_impact_reference_data();
    END IF;
END $$;

-- 9. Add comments for documentation
COMMENT ON TABLE impact_assessment_systems IS 'System references for As-Is and To-Be system mapping in impact assessments';
COMMENT ON TABLE impact_assessment_stakeholder_roles IS 'Stakeholder role abbreviations for RACI assignments (MAA, AM, Merch, etc.)';
COMMENT ON TABLE impact_assessment_status_options IS 'Status options for impact assessment tracking';
COMMENT ON TABLE impact_assessment_action_templates IS 'Reusable action item templates';

COMMENT ON COLUMN process_impacts.as_is_raci_r IS 'As-Is Responsible parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.as_is_raci_a IS 'As-Is Accountable parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.as_is_raci_c IS 'As-Is Consulted parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.as_is_raci_i IS 'As-Is Informed parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.to_be_raci_r IS 'To-Be Responsible parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.to_be_raci_a IS 'To-Be Accountable parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.to_be_raci_c IS 'To-Be Consulted parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.to_be_raci_i IS 'To-Be Informed parties (comma-separated role codes)';
COMMENT ON COLUMN process_impacts.business_benefits IS 'Specific business benefits (separate from general benefits)';
COMMENT ON COLUMN process_impacts.status IS 'Current status of the impact assessment';
COMMENT ON COLUMN process_impacts.actions IS 'Required actions and next steps';