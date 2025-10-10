-- QUICK FIX: Disable Row Level Security for development testing
-- Run this in your Supabase SQL Editor to allow unauthenticated access

-- Disable RLS on all tables
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE swimlanes DISABLE ROW LEVEL SECURITY;
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE text_elements DISABLE ROW LEVEL SECURITY;
ALTER TABLE shape_elements DISABLE ROW LEVEL SECURITY;

-- Optional: Drop all RLS policies (they can be re-created later)
DROP POLICY IF EXISTS "Users can view plans they own or are shared with" ON plans;
DROP POLICY IF EXISTS "Users can create their own plans" ON plans;
DROP POLICY IF EXISTS "Users can update plans they own" ON plans;
DROP POLICY IF EXISTS "Users can delete plans they own" ON plans;

DROP POLICY IF EXISTS "Users can view swimlanes for accessible plans" ON swimlanes;
DROP POLICY IF EXISTS "Users can modify swimlanes for owned plans" ON swimlanes;

DROP POLICY IF EXISTS "Users can view cards for accessible plans" ON cards;
DROP POLICY IF EXISTS "Users can modify cards for owned plans" ON cards;

DROP POLICY IF EXISTS "Users can view text elements for accessible plans" ON text_elements;
DROP POLICY IF EXISTS "Users can modify text elements for owned plans" ON text_elements;

DROP POLICY IF EXISTS "Users can view shape elements for accessible plans" ON shape_elements;
DROP POLICY IF EXISTS "Users can modify shape elements for owned plans" ON shape_elements;

-- Note: This makes all data publicly accessible - only use for development!