import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { groupPeopleBySession, idsNeedingEmail } from '@core/calendar/inviteInputs';
import { fetchUserDirectory } from './userDirectoryService';

/**
 * Every session of the schedule with the people assigned to it (names and emails filled in from the people
 * directory where an assignment row does not carry them), ready for planInviteChanges.
 */
export async function loadInviteInputs({ scheduleId, projectId }) {
  const sessionRows = await fetchAllRows(() => supabase.from('training_sessions').select('*').eq('schedule_id', scheduleId));
  const assignmentRows = await fetchAllRows(() => supabase
    .from('user_assignments')
    .select('id, session_id, end_user_id, user_name, user_email')
    .eq('schedule_id', scheduleId));
  const directory = await fetchUserDirectory(projectId, idsNeedingEmail(assignmentRows));
  return groupPeopleBySession(sessionRows, assignmentRows, directory);
}
