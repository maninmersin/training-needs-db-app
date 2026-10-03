import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows as fetchAll } from '@core/utils/fetchAllRows';

/**
 * Database access for moving a person between sessions. The decisions about where they can go live in
 * moveUserAssignments.js (pure); this file only reads the data that logic needs and saves the result.
 */

export const SESSION_COLUMNS = [
  'id', 'course_id', 'course_name', 'session_number', 'session_part_number', 'session_identifier',
  'session_title', 'start_datetime', 'end_datetime', 'training_location', 'functional_area',
  'classroom_number', 'max_attendees', 'instructor_name'
].join(', ');

/**
 * Load what the move dialog needs, straight from the database (not the screen's possibly stale copy).
 *
 * @param {Object} args
 * @param {string} args.scheduleId
 * @param {number} args.endUserId - the person being moved
 * @param {string} args.location - training location of the session they are in
 * @param {string} args.functionalArea - functional area of that session
 * @returns {Promise<{ sessions: Array, userRows: Array, seatRows: Array }>}
 */
export const loadMoveContext = async ({ scheduleId, endUserId, location, functionalArea }) => {
  if (!scheduleId) throw new Error('No schedule selected');

  const [sessions, userRows, seatRows] = await Promise.all([
    fetchAll(() =>
      supabase.from('training_sessions').select(SESSION_COLUMNS)
        .eq('schedule_id', scheduleId).eq('training_location', location).eq('functional_area', functionalArea)),
    fetchAll(() =>
      supabase.from('user_assignments').select('*')
        .eq('schedule_id', scheduleId).eq('end_user_id', endUserId)),
    fetchAll(() =>
      supabase.from('user_assignments').select('id, session_id, end_user_id')
        .eq('schedule_id', scheduleId).eq('training_location', location).eq('functional_area', functionalArea))
  ]);

  return { sessions, userRows, seatRows };
};

/**
 * Save a move. The old rows are removed and the new ones added in one database transaction, so a
 * failure leaves the person exactly where they were.
 * @param {{ deleteIds: string[], newRows: Object[] }} plan - from buildMovePlan
 * @returns {Promise<Array>} the new assignment rows
 */
export const saveMove = async ({ deleteIds, newRows }) => {
  const { data, error } = await supabase.rpc('move_user_assignments', {
    p_delete_ids: deleteIds,
    p_new_rows: newRows
  });
  if (error) throw error;
  return data || [];
};
