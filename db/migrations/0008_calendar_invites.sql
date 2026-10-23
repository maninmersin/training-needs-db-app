-- Calendar invites: remember what meeting was sent for each training session, so later exports can send
-- only what changed (an update with a higher version number, or a cancellation) instead of duplicates.
--
-- calendar_invites : one row per meeting (one per training session part). `uid` is the meeting's permanent
--                    identity in people's calendars; `sequence` is its version; `snapshot` is exactly what was
--                    last sent (times, room, location, attendees), which later changes are compared with.
--                    session_id is set to NULL if the session is deleted, and the row stays so the meeting can be
--                    cancelled using its snapshot.
-- calendar_send_log: history of each file produced and confirmed as sent.
-- training_locations.time_zone: optional IANA time zone (for example Europe/London) used to put correct times in
--                    invites. Empty keeps times "floating" (09:30 wherever the person is), as before.

CREATE TABLE public.calendar_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  schedule_id uuid,
  session_id uuid REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  uid text NOT NULL,
  sequence integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sent_at timestamptz,
  last_sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_invites_project_uid_key UNIQUE (project_id, uid)
);
CREATE INDEX idx_calendar_invites_project_id ON public.calendar_invites(project_id);
CREATE INDEX idx_calendar_invites_schedule_id ON public.calendar_invites(schedule_id);
CREATE INDEX idx_calendar_invites_session_id ON public.calendar_invites(session_id);

CREATE TRIGGER calendar_invites_updated_at
  BEFORE UPDATE ON public.calendar_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.calendar_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.calendar_invites(id) ON DELETE SET NULL,
  uid text NOT NULL,
  action text NOT NULL CHECK (action IN ('request', 'update', 'cancel', 'cancel_attendees')),
  sequence integer NOT NULL,
  summary text,
  provider text NOT NULL DEFAULT 'ics',
  test_mode boolean NOT NULL DEFAULT false,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_send_log_project_id ON public.calendar_send_log(project_id);
CREATE INDEX idx_calendar_send_log_invite_id ON public.calendar_send_log(invite_id);

ALTER TABLE public.calendar_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage calendar invites for their projects" ON public.calendar_invites
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

CREATE POLICY "Members can manage the calendar send log for their projects" ON public.calendar_send_log
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

ALTER TABLE public.training_locations ADD COLUMN IF NOT EXISTS time_zone text;
