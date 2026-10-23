import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { SESSION_COLUMNS, saveMove } from './assignmentMoveService';

/**
 * Database access for people who turn up to a session. What to do is decided by walkInPlan.js (pure);
 * this file reads what that needs and saves the result.
 */

/**
 * The person's bookings on this course in the schedule, the sessions those are in, and the parts of the
 * session being attended with their seats taken.
 * @param {Object} args - { session: the session row being attended (needs schedule_id), endUserId }
 * @returns {Promise<{ existingRows, existingSessions, targetParts, seatRows }>}
 */
export const loadWalkInContext = async ({ session, endUserId }) => {
  if (!session?.schedule_id) throw new Error('This session is not part of a schedule, so bookings cannot be checked');

  const [existingRows, targetParts] = await Promise.all([
    fetchAllRows(() => supabase.from('user_assignments').select('*').eq('schedule_id', session.schedule_id).eq('end_user_id', endUserId).eq('course_id', session.course_id)),
    fetchAllRows(() =>
      supabase.from('training_sessions').select(SESSION_COLUMNS)
        .eq('schedule_id', session.schedule_id).eq('course_id', session.course_id).eq('session_number', session.session_number)
        .eq('training_location', session.training_location).eq('functional_area', session.functional_area))
  ]);

  const otherSessionIds = [...new Set(existingRows.map((row) => row.session_id))];
  const existingSessions = otherSessionIds.length
    ? await fetchAllRows(() => supabase.from('training_sessions').select(SESSION_COLUMNS).in('id', otherSessionIds))
    : [];

  const partIds = targetParts.map((part) => part.id);
  const seatRows = partIds.length
    ? await fetchAllRows(() => supabase.from('user_assignments').select('id, session_id, end_user_id').in('session_id', partIds))
    : [];

  return { existingRows, existingSessions, targetParts, seatRows };
};

/**
 * Save a plan from buildWalkInPlan. A move is one all-or-nothing database call. When someone is moved,
 * any "absent" mark they already have at the old session is removed, since they are no longer booked there.
 * @returns {Promise<{ assigned: number, removed: number, clearedOldMarks: number }>}
 */
export const applyWalkInPlan = async ({ plan, projectId, endUserId, absentStatusIds = [] }) => {
  const { deleteIds, newRows, oldSessionIds } = plan;

  if (newRows.length > 0 && deleteIds.length > 0) {
    await saveMove({ deleteIds, newRows });
  } else if (newRows.length > 0) {
    const { error } = await supabase.from('user_assignments').insert(newRows);
    if (error) throw error;
  } else if (deleteIds.length > 0) {
    const { error } = await supabase.from('user_assignments').delete().in('id', deleteIds);
    if (error) throw error;
  }

  let clearedOldMarks = 0;
  if (deleteIds.length > 0 && oldSessionIds.length > 0 && absentStatusIds.length > 0) {
    const { data, error } = await supabase
      .from('attendance_records')
      .delete()
      .eq('project_id', projectId)
      .eq('attendee_id', endUserId)
      .in('session_id', oldSessionIds)
      .in('attendance_status_id', absentStatusIds)
      .select('id');
    if (error) throw new Error(`The booking was changed, but their old absence mark could not be removed: ${error.message}`);
    clearedOldMarks = (data || []).length;
  }
  return { assigned: newRows.length, removed: deleteIds.length, clearedOldMarks };
};
