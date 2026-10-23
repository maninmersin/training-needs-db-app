-- get_training_data_stats (the counts on the MS Access import screen) ran as its owner (SECURITY DEFINER)
-- with no project check, so it bypassed row security and let any signed-in user read any project's counts.
-- Run it as the caller instead, like the distinct-value lists in 0005, so whatever row security is on
-- training_data decides what is counted.
--
-- NOTE: training_data itself still has the baseline policy "Allow authenticated users full access"
-- (as do project_users and several other tables), so every signed-in user can still read every project's
-- rows directly. Tightening that is a separate, wider change (see CLAUDE.md, "Known issues").

CREATE OR REPLACE FUNCTION public.get_training_data_stats(p_project_id uuid)
RETURNS TABLE (total_assignments integer, unique_users integer, unique_courses integer, unique_locations integer, unique_functional_areas integer)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    COUNT(*)::integer,
    COUNT(DISTINCT td.user_id)::integer,
    COUNT(DISTINCT td.course_id)::integer,
    COUNT(DISTINCT td.training_location)::integer,
    COUNT(DISTINCT td.functional_area)::integer
  FROM public.training_data td
  WHERE td.project_id = p_project_id
$$;
