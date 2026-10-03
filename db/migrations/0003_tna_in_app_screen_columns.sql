-- Align the MS Access instance's TNA tables with what the in-app screens expect
-- (Reference Data, End Users, Role-Course Mappings, Export All Data, Pivot Tables).

-- The app uses project_role_name everywhere; the MS Access instance called it role_name.
-- (training_data_combined follows the rename automatically.)
ALTER TABLE public.project_roles RENAME COLUMN role_name TO project_role_name;
ALTER TABLE public.role_course_mappings RENAME COLUMN role_name TO project_role_name;

-- Reference Data > Training Locations edits these
ALTER TABLE public.training_locations
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS classrooms_count integer;

-- End Users builds its form from the end_users columns
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS TABLE (column_name text, data_type text, is_nullable text, column_default text)
LANGUAGE sql STABLE AS $$
  SELECT c.column_name::text, c.data_type::text, c.is_nullable::text, c.column_default::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = get_table_columns.table_name
  ORDER BY c.ordinal_position
$$;
