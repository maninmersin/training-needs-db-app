-- TSC Wizard Stage 1 lists functional areas and training locations through these.
-- They read training_data only, so in-app projects got empty lists. Read the combined
-- view instead, and run as the caller (they were SECURITY DEFINER with no project check,
-- so any logged-in user could list any project's values).

CREATE OR REPLACE FUNCTION public.get_distinct_functional_areas(p_project_id uuid)
RETURNS TABLE (functional_area text)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT DISTINCT t.functional_area
  FROM public.training_data_combined t
  WHERE t.project_id = p_project_id AND t.functional_area IS NOT NULL
  ORDER BY t.functional_area
$$;

CREATE OR REPLACE FUNCTION public.get_distinct_training_locations(p_project_id uuid)
RETURNS TABLE (training_location text)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT DISTINCT t.training_location
  FROM public.training_data_combined t
  WHERE t.project_id = p_project_id AND t.training_location IS NOT NULL
  ORDER BY t.training_location
$$;
