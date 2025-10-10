-- =============================================
-- BUSINESS PROCESS IMPACT ASSESSMENT MODULE
-- Database Schema for Enterprise Change Management
-- =============================================
-- Version: 1.0
-- Created: 2025-01-29
-- Purpose: Support detailed business process impact analysis with RACI mapping

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- =============================================
-- CORE IMPACT ASSESSMENT TABLES
-- =============================================

-- Process hierarchy templates (reusable) - CREATE FIRST
CREATE TABLE IF NOT EXISTS process_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(100), -- retail, manufacturing, financial_services, etc.
    change_type VARCHAR(100), -- system_implementation, organizational_restructure, process_optimization
    hierarchy_structure JSONB NOT NULL, -- Stores L0/L1/L2 structure
    is_public BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Main impact assessments (project-level)
CREATE TABLE IF NOT EXISTS impact_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    assessment_type VARCHAR(50) DEFAULT 'business_process', -- business_process, organizational, technical
    status VARCHAR(50) DEFAULT 'draft', -- draft, in_progress, completed, approved
    template_id UUID REFERENCES process_templates(id),
    created_by UUID NOT NULL REFERENCES auth_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    total_processes INTEGER DEFAULT 0,
    total_high_impact INTEGER DEFAULT 0,
    total_medium_impact INTEGER DEFAULT 0,
    total_low_impact INTEGER DEFAULT 0,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('draft', 'in_progress', 'completed', 'approved')),
    CONSTRAINT valid_assessment_type CHECK (assessment_type IN ('business_process', 'organizational', 'technical', 'hybrid'))
);

-- Process hierarchy (L0/L1/L2 structure)
CREATE TABLE IF NOT EXISTS process_hierarchy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES impact_assessments(id) ON DELETE CASCADE,
    process_code VARCHAR(20) NOT NULL, -- e.g., "2.3.1", "3.1.1"
    process_name VARCHAR(255) NOT NULL,
    level_number INTEGER NOT NULL, -- 0, 1, 2 (L0, L1, L2)
    parent_id UUID REFERENCES process_hierarchy(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_level CHECK (level_number >= 0 AND level_number <= 3),
    CONSTRAINT unique_process_code_per_assessment UNIQUE (assessment_id, process_code)
);

-- =============================================
-- PROCESS IMPACT ANALYSIS TABLES
-- =============================================

-- Main process impact records
CREATE TABLE IF NOT EXISTS process_impacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES impact_assessments(id) ON DELETE CASCADE,
    process_id UUID NOT NULL REFERENCES process_hierarchy(id) ON DELETE CASCADE,
    
    -- As-Is vs To-Be Analysis
    as_is_description TEXT,
    to_be_description TEXT,
    as_is_core_system VARCHAR(255),
    to_be_core_system VARCHAR(255),
    
    -- Change Analysis
    change_statement TEXT,
    benefits TEXT,
    comments TEXT,
    
    -- Multi-dimensional Impact Ratings (0-3 scale as per your example)
    process_rating INTEGER DEFAULT 0, -- Process complexity impact
    role_rating INTEGER DEFAULT 0, -- Role/responsibility changes
    new_role_rating INTEGER DEFAULT 0, -- Impact of new roles being created
    workload_rating INTEGER DEFAULT 0, -- Workload impact
    workload_direction VARCHAR(10) DEFAULT 'neutral', -- increase, decrease, neutral (for Workload +/-)
    overall_impact_rating INTEGER DEFAULT 0, -- Overall assessment
    impact_direction VARCHAR(10) DEFAULT 'neutral', -- positive, negative, neutral
    
    -- System Integration
    system_complexity_rating INTEGER DEFAULT 0,
    data_migration_required BOOLEAN DEFAULT false,
    training_required BOOLEAN DEFAULT false,
    
    -- Status and Tracking
    analysis_status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, reviewed
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES auth_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_ratings CHECK (
        process_rating >= 0 AND process_rating <= 3 AND
        role_rating >= 0 AND role_rating <= 3 AND
        new_role_rating >= 0 AND new_role_rating <= 3 AND
        workload_rating >= 0 AND workload_rating <= 3 AND
        overall_impact_rating >= 0 AND overall_impact_rating <= 5 AND
        system_complexity_rating >= 0 AND system_complexity_rating <= 3
    ),
    CONSTRAINT valid_impact_direction CHECK (impact_direction IN ('positive', 'negative', 'neutral')),
    CONSTRAINT valid_workload_direction CHECK (workload_direction IN ('increase', 'decrease', 'neutral')),
    CONSTRAINT valid_analysis_status CHECK (analysis_status IN ('pending', 'in_progress', 'completed', 'reviewed')),
    CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low'))
);

-- =============================================
-- RACI STAKEHOLDER MAPPING TABLES
-- =============================================

-- Stakeholder roles (predefined and custom)
CREATE TABLE IF NOT EXISTS stakeholder_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_code VARCHAR(20) NOT NULL, -- MAA, AM, Merch, DC, Supplier, etc.
    role_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- System roles vs project-specific
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_role_code_per_project UNIQUE (project_id, role_code)
);

-- RACI assignments for processes
CREATE TABLE IF NOT EXISTS process_raci (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    process_impact_id UUID NOT NULL REFERENCES process_impacts(id) ON DELETE CASCADE,
    stakeholder_role_id UUID REFERENCES stakeholder_roles(id),
    stakeholder_id INTEGER REFERENCES stakeholders(id), -- Link to actual stakeholder (integer to match existing table)
    
    -- As-Is RACI
    as_is_responsible BOOLEAN DEFAULT false,
    as_is_accountable BOOLEAN DEFAULT false,
    as_is_consulted BOOLEAN DEFAULT false,
    as_is_informed BOOLEAN DEFAULT false,
    
    -- To-Be RACI
    to_be_responsible BOOLEAN DEFAULT false,
    to_be_accountable BOOLEAN DEFAULT false,
    to_be_consulted BOOLEAN DEFAULT false,
    to_be_informed BOOLEAN DEFAULT false,
    
    -- Change Impact
    responsibility_change_impact INTEGER DEFAULT 0, -- 0-3 scale
    training_requirements TEXT,
    change_readiness_score INTEGER, -- 1-5 scale
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_responsibility_change CHECK (responsibility_change_impact >= 0 AND responsibility_change_impact <= 3),
    CONSTRAINT valid_readiness_score CHECK (change_readiness_score >= 1 AND change_readiness_score <= 5),
    CONSTRAINT stakeholder_or_role_required CHECK (stakeholder_role_id IS NOT NULL OR stakeholder_id IS NOT NULL)
);

-- =============================================
-- SYSTEM AND REFERENCE DATA TABLES
-- =============================================

-- System references (As-Is and To-Be systems)
CREATE TABLE IF NOT EXISTS system_references (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    system_code VARCHAR(50) NOT NULL,
    system_name VARCHAR(255) NOT NULL,
    system_type VARCHAR(50), -- core, peripheral, external, legacy
    description TEXT,
    vendor VARCHAR(255),
    is_current BOOLEAN DEFAULT true, -- Current system vs future system
    retirement_date DATE,
    implementation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_system_code_per_project UNIQUE (project_id, system_code)
);

-- System dependencies and integrations
CREATE TABLE IF NOT EXISTS process_systems (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    process_impact_id UUID NOT NULL REFERENCES process_impacts(id) ON DELETE CASCADE,
    system_id UUID NOT NULL REFERENCES system_references(id),
    usage_type VARCHAR(50), -- as_is, to_be, integration_point
    dependency_level VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    integration_complexity INTEGER DEFAULT 1, -- 1-5 scale
    migration_required BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_usage_type CHECK (usage_type IN ('as_is', 'to_be', 'integration_point')),
    CONSTRAINT valid_dependency_level CHECK (dependency_level IN ('high', 'medium', 'low')),
    CONSTRAINT valid_integration_complexity CHECK (integration_complexity >= 1 AND integration_complexity <= 5)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Core impact assessment indexes
CREATE INDEX idx_impact_assessments_project_id ON impact_assessments(project_id);
CREATE INDEX idx_impact_assessments_status ON impact_assessments(status);
CREATE INDEX idx_impact_assessments_created_at ON impact_assessments(created_at);

-- Process hierarchy indexes
CREATE INDEX idx_process_hierarchy_assessment_id ON process_hierarchy(assessment_id);
CREATE INDEX idx_process_hierarchy_parent_id ON process_hierarchy(parent_id);
CREATE INDEX idx_process_hierarchy_level_number ON process_hierarchy(level_number);
CREATE INDEX idx_process_hierarchy_process_code ON process_hierarchy(process_code);

-- Process impact indexes
CREATE INDEX idx_process_impacts_assessment_id ON process_impacts(assessment_id);
CREATE INDEX idx_process_impacts_process_id ON process_impacts(process_id);
CREATE INDEX idx_process_impacts_overall_rating ON process_impacts(overall_impact_rating);
CREATE INDEX idx_process_impacts_priority ON process_impacts(priority);
CREATE INDEX idx_process_impacts_analysis_status ON process_impacts(analysis_status);

-- RACI indexes
CREATE INDEX idx_process_raci_process_impact_id ON process_raci(process_impact_id);
CREATE INDEX idx_process_raci_stakeholder_id ON process_raci(stakeholder_id);

-- System indexes
CREATE INDEX idx_system_references_project_id ON system_references(project_id);
CREATE INDEX idx_process_systems_process_impact_id ON process_systems(process_impact_id);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_raci ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_systems ENABLE ROW LEVEL SECURITY;

-- Impact assessments policy (project-based access)
CREATE POLICY impact_assessments_project_access ON impact_assessments
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = impact_assessments.project_id 
        AND pu.user_id = auth.uid()
    )
);

-- Process templates policy (public templates + owned templates)
CREATE POLICY process_templates_access ON process_templates
FOR ALL USING (
    is_public = true OR created_by = auth.uid()
);

-- Process hierarchy policy (inherits from impact assessment)
CREATE POLICY process_hierarchy_project_access ON process_hierarchy
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM impact_assessments ia
        JOIN project_users pu ON pu.project_id = ia.project_id
        WHERE ia.id = process_hierarchy.assessment_id
        AND pu.user_id = auth.uid()
    )
);

-- Process impacts policy (inherits from impact assessment)
CREATE POLICY process_impacts_project_access ON process_impacts
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM impact_assessments ia
        JOIN project_users pu ON pu.project_id = ia.project_id
        WHERE ia.id = process_impacts.assessment_id
        AND pu.user_id = auth.uid()
    )
);

-- Stakeholder roles policy
CREATE POLICY stakeholder_roles_project_access ON stakeholder_roles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = stakeholder_roles.project_id 
        AND pu.user_id = auth.uid()
    )
);

-- Process RACI policy (inherits from process impact)
CREATE POLICY process_raci_project_access ON process_raci
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM process_impacts pi
        JOIN impact_assessments ia ON ia.id = pi.assessment_id
        JOIN project_users pu ON pu.project_id = ia.project_id
        WHERE pi.id = process_raci.process_impact_id
        AND pu.user_id = auth.uid()
    )
);

-- System references policy
CREATE POLICY system_references_project_access ON system_references
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM project_users pu 
        WHERE pu.project_id = system_references.project_id 
        AND pu.user_id = auth.uid()
    )
);

-- Process systems policy (inherits from process impact)
CREATE POLICY process_systems_project_access ON process_systems
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM process_impacts pi
        JOIN impact_assessments ia ON ia.id = pi.assessment_id
        JOIN project_users pu ON pu.project_id = ia.project_id
        WHERE pi.id = process_systems.process_impact_id
        AND pu.user_id = auth.uid()
    )
);

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to calculate overall impact assessment statistics
CREATE OR REPLACE FUNCTION calculate_assessment_stats(assessment_uuid UUID)
RETURNS TABLE (
    total_processes INTEGER,
    high_impact_count INTEGER,
    medium_impact_count INTEGER,
    low_impact_count INTEGER,
    avg_process_rating NUMERIC,
    avg_role_rating NUMERIC,
    avg_workload_rating NUMERIC,
    processes_needing_training INTEGER,
    systems_affected INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_processes,
        COUNT(CASE WHEN overall_impact_rating >= 4 THEN 1 END)::INTEGER as high_impact_count,
        COUNT(CASE WHEN overall_impact_rating = 2 OR overall_impact_rating = 3 THEN 1 END)::INTEGER as medium_impact_count,
        COUNT(CASE WHEN overall_impact_rating <= 1 THEN 1 END)::INTEGER as low_impact_count,
        ROUND(AVG(process_rating), 2) as avg_process_rating,
        ROUND(AVG(role_rating), 2) as avg_role_rating,
        ROUND(AVG(workload_rating), 2) as avg_workload_rating,
        COUNT(CASE WHEN training_required = true THEN 1 END)::INTEGER as processes_needing_training,
        COUNT(DISTINCT COALESCE(as_is_core_system, to_be_core_system))::INTEGER as systems_affected
    FROM process_impacts 
    WHERE assessment_id = assessment_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get process hierarchy with impact summary
CREATE OR REPLACE FUNCTION get_process_hierarchy_with_impacts(assessment_uuid UUID)
RETURNS TABLE (
    process_id UUID,
    process_code VARCHAR(20),
    process_name VARCHAR(255),
    level_number INTEGER,
    parent_id UUID,
    has_impact BOOLEAN,
    overall_impact_rating INTEGER,
    priority VARCHAR(20),
    analysis_status VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ph.id as process_id,
        ph.process_code,
        ph.process_name,
        ph.level_number,
        ph.parent_id,
        (pi.id IS NOT NULL) as has_impact,
        pi.overall_impact_rating,
        pi.priority,
        pi.analysis_status
    FROM process_hierarchy ph
    LEFT JOIN process_impacts pi ON pi.process_id = ph.id
    WHERE ph.assessment_id = assessment_uuid
    ORDER BY ph.process_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INITIAL REFERENCE DATA
-- =============================================

-- Insert default stakeholder roles (these will be project-specific)
-- This is a template - actual roles will be created per project

-- Insert default system types for reference
INSERT INTO system_references (id, project_id, system_code, system_name, system_type, description, is_current)
SELECT 
    gen_random_uuid(),
    p.id,
    'TEMPLATE_SYSTEM',
    'Template System Reference',
    'template',
    'Template entry for system references - replace with actual systems',
    false
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 FROM system_references sr 
    WHERE sr.project_id = p.id AND sr.system_code = 'TEMPLATE_SYSTEM'
)
LIMIT 1; -- Only create one template entry

-- =============================================
-- VALIDATION AND CONSTRAINTS
-- =============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_impact_assessments_updated_at BEFORE UPDATE ON impact_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_process_templates_updated_at BEFORE UPDATE ON process_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_process_impacts_updated_at BEFORE UPDATE ON process_impacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE impact_assessments IS 'Main impact assessment records for enterprise change management projects';
COMMENT ON TABLE process_hierarchy IS 'Hierarchical structure of business processes (L0/L1/L2 levels) for impact analysis';
COMMENT ON TABLE process_impacts IS 'Detailed impact analysis for individual processes including As-Is vs To-Be comparison';
COMMENT ON TABLE process_raci IS 'RACI responsibility matrix for process stakeholders in As-Is and To-Be states';
COMMENT ON TABLE stakeholder_roles IS 'Predefined stakeholder roles for RACI assignments (MAA, AM, Merch, etc.)';
COMMENT ON TABLE system_references IS 'System inventory for As-Is and To-Be system mapping';

COMMENT ON COLUMN process_impacts.process_rating IS 'Process complexity impact rating (0-3 scale)';
COMMENT ON COLUMN process_impacts.role_rating IS 'Role/responsibility change rating (0-3 scale)';  
COMMENT ON COLUMN process_impacts.workload_rating IS 'Workload impact rating (0-3 scale)';
COMMENT ON COLUMN process_impacts.overall_impact_rating IS 'Overall process impact rating (0-5 scale)';
COMMENT ON COLUMN process_impacts.impact_direction IS 'Direction of impact: positive (+), negative (-), or neutral';