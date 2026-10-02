-- Add RLS policies for attendance-related tables

-- Attendance records
CREATE POLICY "attendance_records_read_all" ON public.attendance_records
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "attendance_records_insert" ON public.attendance_records
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "attendance_records_update" ON public.attendance_records
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "attendance_records_delete" ON public.attendance_records
  FOR DELETE USING (auth.role() = 'authenticated');

-- Attendance statuses
CREATE POLICY "attendance_statuses_read_all" ON public.attendance_statuses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "attendance_statuses_insert" ON public.attendance_statuses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "attendance_statuses_update" ON public.attendance_statuses
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "attendance_statuses_delete" ON public.attendance_statuses
  FOR DELETE USING (auth.role() = 'authenticated');

-- Session attendees
CREATE POLICY "session_attendees_read_all" ON public.session_attendees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "session_attendees_insert" ON public.session_attendees
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "session_attendees_update" ON public.session_attendees
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "session_attendees_delete" ON public.session_attendees
  FOR DELETE USING (auth.role() = 'authenticated');

-- Success message
SELECT 'RLS policies created for attendance-related tables.' as status;