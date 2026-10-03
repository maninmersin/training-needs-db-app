-- TNA data source per project: 'access' (rows imported from MS Access into training_data)
-- or 'app' (people, roles, courses and mappings managed in the app).
-- Screens read training_data_combined, which returns the same columns either way.
--
-- Also restores what the main app's project and TNA screens need but the MS Access
-- instance lacked: full project columns, and write access to projects, end_users and
-- project_roles for project members.

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS project_code text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS target_end_date date,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS training_data_source text NOT NULL DEFAULT 'access'
    CONSTRAINT projects_training_data_source_check CHECK (training_data_source IN ('access', 'app'));

UPDATE public.projects SET title = name WHERE title IS NULL;

ALTER TABLE public.project_users
  ADD COLUMN IF NOT EXISTS added_by uuid;

CREATE POLICY "Owners can view their projects" ON public.projects
  FOR SELECT USING (owner_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Project owners and admins can update projects" ON public.projects
  FOR UPDATE USING (
    owner_id = auth.uid() OR id IN (
      SELECT pu.project_id FROM public.project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true AND pu.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Project owners can delete projects" ON public.projects
  FOR DELETE USING (
    owner_id = auth.uid() OR id IN (
      SELECT pu.project_id FROM public.project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true AND pu.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- In-app TNA data: members can edit people and roles in their projects
-- (the MS Access instance only had SELECT policies on these tables)
-- ---------------------------------------------------------------------------
CREATE POLICY "Members can modify data for their projects" ON public.end_users
  FOR ALL USING (
    project_id IN (
      SELECT pu.project_id FROM public.project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true AND pu.role IN ('owner', 'admin', 'member')
    )
  ) WITH CHECK (
    project_id IN (
      SELECT pu.project_id FROM public.project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true AND pu.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Members can modify data for their projects" ON public.project_roles
  FOR ALL USING (
    project_id IN (
      SELECT pu.project_id FROM public.project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true AND pu.role IN ('owner', 'admin', 'member')
    )
  ) WITH CHECK (
    project_id IN (
      SELECT pu.project_id FROM public.project_users pu
      WHERE pu.user_id = auth.uid() AND pu.is_active = true AND pu.role IN ('owner', 'admin', 'member')
    )
  );

-- ---------------------------------------------------------------------------
-- training_data_combined: one row per person per course, in training_data's shape
-- ---------------------------------------------------------------------------
CREATE VIEW public.training_data_combined WITH (security_invoker = true) AS
SELECT td.id, td.user_id, td.user_name, td.user_email, td.business_unit, td.organization,
       td.user_country, td.user_department, td.user_job_title, td.user_location,
       td.training_location, td.user_project_role, td.course_id, td.course_name,
       td.duration_hrs, td.course_topic, td.course_sub_topic, td.course_application,
       td.course_priority, td.functional_area, td.sub_functional_area,
       td.functional_area_short, td.project_id, td.assigned_by, td.assigned_date,
       td.assignment_notes, td.created_at, td.updated_at
FROM public.training_data td
JOIN public.projects p ON p.id = td.project_id
WHERE p.training_data_source = 'access'

UNION ALL

-- In-app: a person's courses = their role's courses plus any individually assigned
-- courses (an individual assignment wins when both exist, for the audit fields).
SELECT md5(eu.project_id::text || ':' || eu.id::text || ':' || a.course_id)::uuid,
       eu.id::text, eu.name, eu.email, eu.division, NULL,
       eu.country, eu.sub_division, eu.job_title, eu.location_name,
       COALESCE(NULLIF(eu.training_location, ''), 'TBD'), eu.project_role, c.course_id,
       COALESCE(c.course_name, c.course_id),
       c.duration_hrs, NULL, NULL, c.application,
       c.priority, c.functional_area, NULL,
       NULL, eu.project_id, a.assigned_by, a.assigned_date,
       a.notes, a.assigned_date, a.assigned_date
FROM public.end_users eu
JOIN public.projects p ON p.id = eu.project_id AND p.training_data_source = 'app'
JOIN LATERAL (
  SELECT DISTINCT ON (s.course_id) s.course_id, s.assigned_by, s.assigned_date, s.notes
  FROM (
    SELECT ucm.course_id, ucm.assigned_by, ucm.assigned_date, ucm.notes, 1 AS precedence
    FROM public.user_course_mappings ucm
    WHERE ucm.end_user_id = eu.id AND ucm.project_id = eu.project_id
    UNION ALL
    SELECT rcm.course_id, 'role', rcm.created_at, NULL, 2
    FROM public.role_course_mappings rcm
    WHERE rcm.project_id = eu.project_id AND rcm.role_name = eu.project_role
  ) s
  ORDER BY s.course_id, s.precedence
) a ON true
JOIN public.courses c ON c.course_id = a.course_id;

-- ---------------------------------------------------------------------------
-- projects_with_stats: real columns and counts (was name-as-title and zeros),
-- and respects RLS instead of listing every project to every user
-- ---------------------------------------------------------------------------
DROP VIEW public.projects_with_stats;

CREATE VIEW public.projects_with_stats WITH (security_invoker = true) AS
SELECT p.*,
       (SELECT count(*) FROM public.project_users pu
         WHERE pu.project_id = p.id AND pu.is_active)::int AS member_count,
       (SELECT count(*) FROM public.training_schedules s
         WHERE s.project_id = p.id)::int AS schedule_count,
       (SELECT count(DISTINCT t.course_id) FROM public.training_data_combined t
         WHERE t.project_id = p.id)::int AS course_count,
       (SELECT count(DISTINCT t.user_id) FROM public.training_data_combined t
         WHERE t.project_id = p.id)::int AS user_count,
       (SELECT count(*) FROM public.training_data_combined t
         WHERE t.project_id = p.id)::int AS training_data_count
FROM public.projects p;
