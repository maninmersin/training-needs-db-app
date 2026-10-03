-- Move a person between sessions (Assignments > right-click a person > Move to another session...).
--
-- Removing someone's old session rows and adding the new ones must happen together: if the second
-- step failed after the first, the person would be left unassigned. This function does both in one
-- transaction, so any error (a full-table rule, a bad row, a permission problem) undoes everything.
--
-- SECURITY INVOKER: the caller's row-level security still applies to both the delete and the insert,
-- so nobody can move people in a project they are not a member of.

CREATE OR REPLACE FUNCTION public.move_user_assignments(p_delete_ids uuid[], p_new_rows jsonb)
RETURNS SETOF public.user_assignments
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  expected_deletes integer := coalesce(array_length(p_delete_ids, 1), 0);
  actual_deletes integer;
BEGIN
  IF expected_deletes = 0 THEN
    RAISE EXCEPTION 'Nothing to move: no existing assignments were given';
  END IF;

  IF p_new_rows IS NULL OR jsonb_typeof(p_new_rows) <> 'array' OR jsonb_array_length(p_new_rows) = 0 THEN
    RAISE EXCEPTION 'Nothing to move: no new assignments were given';
  END IF;

  DELETE FROM public.user_assignments WHERE id = ANY (p_delete_ids);
  GET DIAGNOSTICS actual_deletes = ROW_COUNT;

  -- Rows that no longer exist (already moved by someone else) or that RLS hides must not be
  -- silently skipped, or the person could end up in both places
  IF actual_deletes <> expected_deletes THEN
    RAISE EXCEPTION 'Expected to remove % assignments but removed % - they may have changed since you opened the dialog',
      expected_deletes, actual_deletes;
  END IF;

  -- Explicit column list (not jsonb_populate_recordset, which would turn missing keys into NULLs
  -- instead of using the column defaults)
  RETURN QUERY
  INSERT INTO public.user_assignments (
    schedule_id, project_id, end_user_id, user_name, user_email, session_id, course_id,
    session_identifier, training_location, functional_area, group_identifier,
    assignment_level, assignment_status, assignment_type, completion_status,
    assignment_source, assignment_method, assigned_at, notes
  )
  SELECT
    x.schedule_id, x.project_id, x.end_user_id, x.user_name, x.user_email, x.session_id, x.course_id,
    x.session_identifier, x.training_location, x.functional_area, x.group_identifier,
    COALESCE(x.assignment_level, 'session'),
    COALESCE(x.assignment_status, 'enrolled'),
    COALESCE(x.assignment_type, 'standard'),
    COALESCE(x.completion_status, 'pending'),
    COALESCE(x.assignment_source, 'manual'),
    COALESCE(x.assignment_method, 'manual'),
    COALESCE(x.assigned_at, now()),
    x.notes
  FROM jsonb_to_recordset(p_new_rows) AS x(
    schedule_id uuid, project_id uuid, end_user_id integer, user_name text, user_email text,
    session_id uuid, course_id text, session_identifier text, training_location text,
    functional_area text, group_identifier text, assignment_level text, assignment_status text,
    assignment_type text, completion_status text, assignment_source text, assignment_method text,
    assigned_at timestamptz, notes text
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_user_assignments(uuid[], jsonb) TO authenticated;
