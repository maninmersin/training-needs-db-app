-- ================================================
-- REFERENCE DATA TABLES FOR IMPACT ASSESSMENT
-- ================================================

-- Impact Reference Data Table
-- Stores configurable dropdown options for Impact Assessment forms
CREATE TABLE IF NOT EXISTS impact_reference_data (
  id SERIAL PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'business_process_types',
    'change_categories', 
    'impact_levels',
    'complexity_factors',
    'business_functions',
    'change_drivers'
  )),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique names within category per project
  CONSTRAINT unique_reference_item_per_project_category UNIQUE (project_id, category, name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_impact_reference_data_project_category ON impact_reference_data(project_id, category);
CREATE INDEX IF NOT EXISTS idx_impact_reference_data_active ON impact_reference_data(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_impact_reference_data_sort ON impact_reference_data(sort_order);

-- Row Level Security
ALTER TABLE impact_reference_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access reference data for projects they belong to
CREATE POLICY impact_reference_data_project_access ON impact_reference_data
FOR ALL
TO authenticated
USING (
  project_id IN (
    SELECT project_id FROM project_users 
    WHERE user_id = (auth.jwt() ->> 'sub')::uuid
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_impact_reference_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER impact_reference_data_updated_at_trigger
  BEFORE UPDATE ON impact_reference_data
  FOR EACH ROW
  EXECUTE FUNCTION update_impact_reference_data_updated_at();

-- ================================================
-- DEFAULT REFERENCE DATA
-- ================================================

-- Function to insert default reference data for a project
CREATE OR REPLACE FUNCTION insert_default_impact_reference_data(project_id_param UUID)
RETURNS void AS $$
BEGIN
  -- Business Process Types
  INSERT INTO impact_reference_data (project_id, category, name, description, sort_order) VALUES
  (project_id_param, 'business_process_types', 'Core Business Process', 'Primary processes that deliver value to customers', 1),
  (project_id_param, 'business_process_types', 'Support Process', 'Processes that support core business activities', 2),
  (project_id_param, 'business_process_types', 'Management Process', 'Processes for planning, monitoring, and control', 3),
  (project_id_param, 'business_process_types', 'Regulatory Process', 'Processes required for compliance and governance', 4);

  -- Change Categories
  INSERT INTO impact_reference_data (project_id, category, name, description, sort_order) VALUES
  (project_id_param, 'change_categories', 'Technology Change', 'Changes related to systems, tools, or technology', 1),
  (project_id_param, 'change_categories', 'Process Change', 'Changes to business processes and workflows', 2),
  (project_id_param, 'change_categories', 'Organizational Change', 'Changes to structure, roles, or reporting', 3),
  (project_id_param, 'change_categories', 'Cultural Change', 'Changes to values, behaviors, or work culture', 4);

  -- Impact Levels
  INSERT INTO impact_reference_data (project_id, category, name, description, sort_order) VALUES
  (project_id_param, 'impact_levels', 'Critical', 'Severe impact requiring immediate attention', 1),
  (project_id_param, 'impact_levels', 'High', 'Significant impact with major consequences', 2),
  (project_id_param, 'impact_levels', 'Medium', 'Moderate impact with manageable consequences', 3),
  (project_id_param, 'impact_levels', 'Low', 'Minor impact with minimal consequences', 4),
  (project_id_param, 'impact_levels', 'None', 'No significant impact expected', 5);

  -- Complexity Factors
  INSERT INTO impact_reference_data (project_id, category, name, description, sort_order) VALUES
  (project_id_param, 'complexity_factors', 'Multi-System Integration', 'Requires coordination across multiple systems', 1),
  (project_id_param, 'complexity_factors', 'Regulatory Compliance', 'Must meet specific regulatory requirements', 2),
  (project_id_param, 'complexity_factors', 'Cultural Resistance', 'May face resistance due to cultural factors', 3),
  (project_id_param, 'complexity_factors', 'Skills Gap', 'Requires new skills or training', 4),
  (project_id_param, 'complexity_factors', 'Stakeholder Complexity', 'Involves many stakeholders with different needs', 5);

  -- Business Functions
  INSERT INTO impact_reference_data (project_id, category, name, description, sort_order) VALUES
  (project_id_param, 'business_functions', 'Finance & Accounting', 'Financial planning, accounting, and reporting', 1),
  (project_id_param, 'business_functions', 'Human Resources', 'People management and HR processes', 2),
  (project_id_param, 'business_functions', 'Operations', 'Core operational activities and production', 3),
  (project_id_param, 'business_functions', 'Sales & Marketing', 'Customer acquisition and revenue generation', 4),
  (project_id_param, 'business_functions', 'Information Technology', 'Technology systems and infrastructure', 5),
  (project_id_param, 'business_functions', 'Legal & Compliance', 'Legal affairs and regulatory compliance', 6);

  -- Change Drivers
  INSERT INTO impact_reference_data (project_id, category, name, description, sort_order) VALUES
  (project_id_param, 'change_drivers', 'Operational Efficiency', 'Improve efficiency and reduce costs', 1),
  (project_id_param, 'change_drivers', 'Regulatory Compliance', 'Meet new or updated regulatory requirements', 2),
  (project_id_param, 'change_drivers', 'Business Growth', 'Support expansion and growth initiatives', 3),
  (project_id_param, 'change_drivers', 'Customer Experience', 'Improve customer satisfaction and experience', 4),
  (project_id_param, 'change_drivers', 'Risk Management', 'Reduce operational or strategic risks', 5),
  (project_id_param, 'change_drivers', 'Technology Modernization', 'Update or replace legacy systems', 6);

  RAISE NOTICE 'Default impact assessment reference data inserted for project %', project_id_param;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- UTILITY FUNCTIONS
-- ================================================

-- Function to get active reference data by category
CREATE OR REPLACE FUNCTION get_active_reference_data(
  project_id_param UUID,
  category_param TEXT
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  description TEXT,
  sort_order INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ird.id,
    ird.name,
    ird.description,
    ird.sort_order
  FROM impact_reference_data ird
  WHERE ird.project_id = project_id_param
    AND ird.category = category_param
    AND ird.is_active = true
  ORDER BY ird.sort_order, ird.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate reference data item
CREATE OR REPLACE FUNCTION validate_reference_data_item(
  project_id_param UUID,
  category_param TEXT,
  name_param TEXT,
  existing_id_param INTEGER DEFAULT NULL
)
RETURNS TEXT[] AS $$
DECLARE
  errors TEXT[] := ARRAY[]::TEXT[];
  existing_count INTEGER;
BEGIN
  -- Check if name is provided
  IF name_param IS NULL OR TRIM(name_param) = '' THEN
    errors := array_append(errors, 'Name is required');
  END IF;

  -- Check for valid category
  IF category_param NOT IN (
    'business_process_types',
    'change_categories', 
    'impact_levels',
    'complexity_factors',
    'business_functions',
    'change_drivers'
  ) THEN
    errors := array_append(errors, 'Invalid category specified');
  END IF;

  -- Check for duplicate name in same category (excluding current item if editing)
  SELECT COUNT(*) INTO existing_count
  FROM impact_reference_data
  WHERE project_id = project_id_param
    AND category = category_param
    AND LOWER(TRIM(name)) = LOWER(TRIM(name_param))
    AND (existing_id_param IS NULL OR id != existing_id_param);

  IF existing_count > 0 THEN
    errors := array_append(errors, 'An item with this name already exists in this category');
  END IF;

  RETURN errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;