-- Project isolation. The baseline gave most TNA tables the policy "Allow authenticated users full access",
-- so ANY signed-in user could read and change every project's data, and could add themselves to any
-- project through project_users. This replaces those with membership-based rules.
--
--   viewer / any member role   read the project's data
--   owner, admin, member       also change it
--   owner, admin               manage who is in the project
--
-- A person who owns or created a project counts as its owner even if their project_users row is missing.
-- Tables that already had membership policies (end_users, project_roles, user_assignments, attendance,
-- trainers, user_course_mappings, calendar tables, projects) are left as they are.

-- ---------------------------------------------------------------------------
-- The SECURITY DEFINER functions in the baseline did no project check, so anyone could call them (through the
-- API) for any project. Run them as the caller, so the policies below decide what they return.
-- ---------------------------------------------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('bulk_assign_courses', 'get_course_users', 'get_project_courses', 'get_project_users', 'get_user_courses')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', f.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers. They are SECURITY DEFINER on purpose: the policies on project_users must not query project_users
-- as the caller (that would recurse). They only ever answer about the CURRENT user (auth.uid()).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_role(p_project_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT pu.role FROM public.project_users pu
      WHERE pu.project_id = p_project_id AND pu.user_id = auth.uid() AND COALESCE(pu.is_active, true)
      LIMIT 1),
    (SELECT 'owner' FROM public.projects p
      WHERE p.id = p_project_id AND auth.uid() IS NOT NULL AND (p.owner_id = auth.uid() OR p.created_by = auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.project_role(p_project_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(public.project_role(p_project_id) IN ('owner', 'admin', 'member'), false)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(public.project_role(p_project_id) IN ('owner', 'admin'), false)
$$;

-- ---------------------------------------------------------------------------
-- Project data tables: members read, owners/admins/members change
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['courses', 'functional_areas', 'role_course_mappings', 'training_data',
                           'training_locations', 'training_schedules', 'training_sessions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Members can view project data" ON public.%I FOR SELECT USING (public.is_project_member(project_id))', t);
    EXECUTE format('CREATE POLICY "Editors can change project data" ON public.%I FOR ALL USING (public.can_edit_project(project_id)) WITH CHECK (public.can_edit_project(project_id))', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Who is in a project: members can see each other; only owners and admins change membership
-- (and the creator of a new project can add themselves as its owner)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users full access" ON public.project_users;

CREATE POLICY "Members can see who is in their projects" ON public.project_users
  FOR SELECT USING (user_id = auth.uid() OR public.is_project_member(project_id));

CREATE POLICY "Owners and admins can add members" ON public.project_users
  FOR INSERT WITH CHECK (public.can_manage_project(project_id));

CREATE POLICY "Owners and admins can change members" ON public.project_users
  FOR UPDATE USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id));

CREATE POLICY "Owners and admins can remove members" ON public.project_users
  FOR DELETE USING (public.can_manage_project(project_id));
