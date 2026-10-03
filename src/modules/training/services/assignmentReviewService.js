import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';
import { fetchUserDirectory } from './userDirectoryService';
import { SESSION_COLUMNS, saveMove } from './assignmentMoveService';
import { planReviewImport } from '../components/assignments/reviewSheet';

/**
 * Database side of the stakeholder review sheet: read the current data for a schedule, then plan and
 * apply the moves from a returned sheet. The rules are in reviewSheet.js; each move is saved with the
 * same all-or-nothing database function the Move dialog uses.
 */

/** Everything the review export and the import plan need, read fresh from the database. */
export const loadReviewData = async ({ scheduleId, projectId }) => {
  if (!scheduleId) throw new Error('No schedule selected');

  const [sessions, assignments] = await Promise.all([
    fetchAllRows(() =>
      supabase.from('training_sessions').select(SESSION_COLUMNS).eq('schedule_id', scheduleId)),
    fetchAllRows(() =>
      supabase.from('user_assignments')
        .select('id, session_id, end_user_id, course_id, user_name, user_email, training_location, functional_area')
        .eq('schedule_id', scheduleId))
  ]);

  const directory = await fetchUserDirectory(projectId, assignments.map((a) => a.end_user_id));
  return { sessions, assignments, directory };
};

/** Plan an import against the data as it is now. Changes nothing. */
export const previewReviewImport = async ({ items, schedule, projectId, allowFull = false, filters = {} }) => {
  const data = await loadReviewData({ scheduleId: schedule.id, projectId });
  return planReviewImport({
    items, ...data, schedule: { id: schedule.id, project_id: schedule.project_id || projectId }, allowFull, filters
  });
};

const friendlyError = (error) => {
  const message = error?.message || 'The move failed';
  // The database refuses when the rows it was asked to remove have since changed
  if (/Expected to remove/i.test(message)) {
    return 'This person was changed by someone else a moment ago, so this row was not applied. Nothing was changed for it.';
  }
  if (/unique_user_session|duplicate key/i.test(message)) {
    return 'The person is already booked on a session in the group being moved to. Nothing was changed for this row.';
  }
  return `${message}. Nothing was changed for this row.`;
};

/**
 * Apply an import. The data is read again and the moves re-planned first, so the result reflects the
 * database right now rather than what the preview showed a few minutes ago. Each row is saved on its
 * own, all-or-nothing, so one bad row never stops or undoes the others.
 *
 * @returns {Promise<{ outcomes: Array, summary: { applied: number, failed: number, notApplied: number } }>}
 */
export const applyReviewImport = async ({ items, schedule, projectId, allowFull = false, filters = {} }) => {
  const { results } = await previewReviewImport({ items, schedule, projectId, allowFull, filters });

  const outcomes = [];
  const summary = { applied: 0, failed: 0, notApplied: 0 };

  for (const result of results) {
    const base = {
      rowNumber: result.rowNumber, person: result.person, course: result.course,
      fromGroup: result.fromGroup, toGroup: result.toGroup
    };
    if (!result.plan) {
      summary.notApplied += 1;
      outcomes.push({ ...base, ok: false, applied: false, message: result.message, status: result.status });
      continue;
    }
    try {
      await saveMove(result.plan);
      summary.applied += 1;
      outcomes.push({ ...base, ok: true, applied: true, message: result.message, status: result.status });
    } catch (error) {
      summary.failed += 1;
      outcomes.push({ ...base, ok: false, applied: false, message: friendlyError(error), status: 'error' });
    }
  }
  return { outcomes, summary };
};
