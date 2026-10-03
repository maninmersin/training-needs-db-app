-- Trainers (TNA > Setup > Trainers, and the trainer pickers in Schedule Editor,
-- Session Edit and Bulk Trainer Assign). The MS Access instance never had this table.

CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  specializations text[] NOT NULL DEFAULT '{}',
  bio text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainers_project_id ON public.trainers(project_id);

CREATE TRIGGER trainers_updated_at
  BEFORE UPDATE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage trainers for their projects" ON public.trainers
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

-- Sessions store the chosen trainer's id here. It was an integer defaulting to 0, which
-- can't hold a trainer id; no session had a trainer, so 0 becomes NULL ("no trainer").
ALTER TABLE public.training_sessions ALTER COLUMN instructor_id DROP DEFAULT;
ALTER TABLE public.training_sessions
  ALTER COLUMN instructor_id TYPE uuid USING NULL;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_instructor_id_fkey
  FOREIGN KEY (instructor_id) REFERENCES public.trainers(id) ON DELETE SET NULL;
