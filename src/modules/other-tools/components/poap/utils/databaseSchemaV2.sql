-- POAP v2 Database Schema
-- Comprehensive schema designed for rich timeline planning application
-- Created: January 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================================
-- PLANS TABLE - Core plan data with timeline configuration
-- ================================================================================
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- File/save name (e.g., "q1-marketing-plan")
  title TEXT NOT NULL, -- Display title (e.g., "Q1 Marketing Campaign Strategy") 
  description TEXT,
  
  -- Timeline configuration
  timeline_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  timeline_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  timeline_scale TEXT NOT NULL DEFAULT 'weeks', -- 'days', 'weeks', 'months', 'quarters'
  timeline_show_grid BOOLEAN NOT NULL DEFAULT true,
  timeline_snap_to_grid BOOLEAN NOT NULL DEFAULT true,
  
  -- Sharing and permissions
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID[] DEFAULT '{}', -- Array of user IDs
  is_public BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- SWIMLANES TABLE - Hierarchical categories with styling and milestones
-- ================================================================================
CREATE TABLE swimlanes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  
  -- Hierarchy
  parent_id UUID REFERENCES swimlanes(id) ON DELETE CASCADE,
  is_main_category BOOLEAN DEFAULT false,
  has_children BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  
  -- Content
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  
  -- Styling
  background_color TEXT DEFAULT '#F3F4F6',
  text_color TEXT DEFAULT '#1F2937',
  font_size INTEGER DEFAULT 14,
  font_weight TEXT DEFAULT 'medium', -- 'normal', 'medium', 'semibold', 'bold'
  font_family TEXT DEFAULT 'Inter',
  
  -- Milestone (optional - embedded in swimlane)
  milestone_title TEXT,
  milestone_description TEXT,
  milestone_date TIMESTAMP WITH TIME ZONE,
  milestone_color TEXT,
  milestone_position_x INTEGER,
  milestone_position_y INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- CARDS TABLE - Timeline tasks with full styling and positioning
-- ================================================================================
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  swimlane_id UUID REFERENCES swimlanes(id) ON DELETE CASCADE NOT NULL,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  
  -- Timeline positioning
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  row_index INTEGER DEFAULT 0, -- For multiple cards in same swimlane
  order_index INTEGER DEFAULT 0,
  
  -- Styling
  color TEXT DEFAULT '#3B82F6', -- Border/accent color
  background_color TEXT DEFAULT '#EFF6FF',
  text_color TEXT DEFAULT '#1E40AF',
  font_size INTEGER DEFAULT 13,
  font_weight TEXT DEFAULT 'medium',
  font_family TEXT DEFAULT 'Inter',
  
  -- Status and metadata
  status TEXT DEFAULT 'not-started', -- 'not-started', 'in-progress', 'completed', 'on-hold'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  progress INTEGER DEFAULT 0, -- 0-100
  
  -- Milestone (optional - embedded in card)
  milestone_title TEXT,
  milestone_description TEXT,
  milestone_date TIMESTAMP WITH TIME ZONE,
  milestone_color TEXT,
  milestone_position_x INTEGER,
  milestone_position_y INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- TEXT_ELEMENTS TABLE - Freeform text with complete formatting
-- ================================================================================
CREATE TABLE text_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  
  -- Content
  content TEXT NOT NULL,
  
  -- Positioning
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 200,
  height INTEGER NOT NULL DEFAULT 50,
  
  -- Styling
  font_size INTEGER DEFAULT 14,
  font_family TEXT DEFAULT 'Arial, sans-serif',
  font_weight TEXT DEFAULT 'normal', -- 'normal', 'bold'
  font_style TEXT DEFAULT 'normal', -- 'normal', 'italic'
  color TEXT DEFAULT '#000000',
  background_color TEXT DEFAULT 'transparent',
  text_align TEXT DEFAULT 'left', -- 'left', 'center', 'right'
  
  -- State
  is_selected BOOLEAN DEFAULT false,
  is_editing BOOLEAN DEFAULT false,
  z_index INTEGER DEFAULT 0, -- Layering order
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- SHAPE_ELEMENTS TABLE - Geometric shapes (rectangles, circles, arrows)
-- ================================================================================
CREATE TABLE shape_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  
  -- Shape type and properties
  shape_type TEXT NOT NULL, -- 'rectangle', 'circle', 'arrow', 'line'
  
  -- Positioning
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  width INTEGER NOT NULL DEFAULT 100,
  height INTEGER NOT NULL DEFAULT 100,
  
  -- Shape-specific properties (JSON for flexibility)
  properties JSONB DEFAULT '{}', -- rotation, border-radius, arrow direction, etc.
  
  -- Styling
  fill_color TEXT DEFAULT 'transparent',
  stroke_color TEXT DEFAULT '#000000',
  stroke_width INTEGER DEFAULT 2,
  opacity DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
  
  -- State
  is_selected BOOLEAN DEFAULT false,
  z_index INTEGER DEFAULT 0, -- Layering order
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================================
-- INDEXES for performance
-- ================================================================================

-- Plans indexes
CREATE INDEX idx_plans_owner_id ON plans(owner_id);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);
CREATE INDEX idx_plans_name ON plans(name);
CREATE INDEX idx_plans_name_owner ON plans(owner_id, name);

-- Swimlanes indexes
CREATE INDEX idx_swimlanes_plan_id ON swimlanes(plan_id);
CREATE INDEX idx_swimlanes_parent_id ON swimlanes(parent_id);
CREATE INDEX idx_swimlanes_order ON swimlanes(plan_id, order_index);

-- Cards indexes
CREATE INDEX idx_cards_plan_id ON cards(plan_id);
CREATE INDEX idx_cards_swimlane_id ON cards(swimlane_id);
CREATE INDEX idx_cards_dates ON cards(start_date, end_date);
CREATE INDEX idx_cards_order ON cards(swimlane_id, row_index, order_index);

-- Text elements indexes
CREATE INDEX idx_text_elements_plan_id ON text_elements(plan_id);
CREATE INDEX idx_text_elements_position ON text_elements(position_x, position_y);
CREATE INDEX idx_text_elements_z_index ON text_elements(z_index);

-- Shape elements indexes
CREATE INDEX idx_shape_elements_plan_id ON shape_elements(plan_id);
CREATE INDEX idx_shape_elements_type ON shape_elements(shape_type);
CREATE INDEX idx_shape_elements_position ON shape_elements(position_x, position_y);
CREATE INDEX idx_shape_elements_z_index ON shape_elements(z_index);

-- ================================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================================

-- Enable RLS on all tables
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE swimlanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE shape_elements ENABLE ROW LEVEL SECURITY;

-- Plans policies
CREATE POLICY "Users can view plans they own or are shared with" ON plans
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    auth.uid() = ANY(shared_with) OR 
    is_public = true
  );

CREATE POLICY "Users can create their own plans" ON plans
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update plans they own" ON plans
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete plans they own" ON plans
  FOR DELETE USING (owner_id = auth.uid());

-- Swimlanes policies (inherit from plan access)
CREATE POLICY "Users can view swimlanes for accessible plans" ON swimlanes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = swimlanes.plan_id 
      AND (plans.owner_id = auth.uid() OR auth.uid() = ANY(plans.shared_with) OR plans.is_public = true)
    )
  );

CREATE POLICY "Users can modify swimlanes for owned plans" ON swimlanes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = swimlanes.plan_id 
      AND plans.owner_id = auth.uid()
    )
  );

-- Cards policies (inherit from plan access)
CREATE POLICY "Users can view cards for accessible plans" ON cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = cards.plan_id 
      AND (plans.owner_id = auth.uid() OR auth.uid() = ANY(plans.shared_with) OR plans.is_public = true)
    )
  );

CREATE POLICY "Users can modify cards for owned plans" ON cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = cards.plan_id 
      AND plans.owner_id = auth.uid()
    )
  );

-- Text elements policies (inherit from plan access)
CREATE POLICY "Users can view text elements for accessible plans" ON text_elements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = text_elements.plan_id 
      AND (plans.owner_id = auth.uid() OR auth.uid() = ANY(plans.shared_with) OR plans.is_public = true)
    )
  );

CREATE POLICY "Users can modify text elements for owned plans" ON text_elements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = text_elements.plan_id 
      AND plans.owner_id = auth.uid()
    )
  );

-- Shape elements policies (inherit from plan access)
CREATE POLICY "Users can view shape elements for accessible plans" ON shape_elements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = shape_elements.plan_id 
      AND (plans.owner_id = auth.uid() OR auth.uid() = ANY(plans.shared_with) OR plans.is_public = true)
    )
  );

CREATE POLICY "Users can modify shape elements for owned plans" ON shape_elements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = shape_elements.plan_id 
      AND plans.owner_id = auth.uid()
    )
  );

-- ================================================================================
-- TRIGGERS for updated_at timestamps
-- ================================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swimlanes_updated_at BEFORE UPDATE ON swimlanes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_text_elements_updated_at BEFORE UPDATE ON text_elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shape_elements_updated_at BEFORE UPDATE ON shape_elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();