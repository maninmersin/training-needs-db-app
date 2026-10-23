import { supabase } from '@core/services/supabaseClient';
import { fetchAllRows } from '@core/utils/fetchAllRows';

/** Database access for the invite ledger (calendar_invites) and send history (calendar_send_log). */

/** Everything already sent for a schedule: one row per meeting. */
export const loadLedger = async (projectId, scheduleId) => {
  if (!projectId) throw new Error('Project ID is required to load the invite history');
  return fetchAllRows(() => supabase.from('calendar_invites').select('*').eq('project_id', projectId).eq('schedule_id', scheduleId));
};

/**
 * Save what recordSent produced: remember the meetings, then log what was sent against them.
 * Meetings are saved first and the log second, so a failure part-way never claims something was sent that was not recorded.
 */
export const saveSent = async ({ invites, logs }) => {
  const idByUid = new Map();
  if (invites.length > 0) {
    const { data, error } = await supabase.from('calendar_invites').upsert(invites, { onConflict: 'project_id,uid' }).select('id, uid');
    if (error) throw error;
    (data || []).forEach((row) => idByUid.set(row.uid, row.id));
  }
  if (logs.length > 0) {
    const { error } = await supabase.from('calendar_send_log').insert(logs.map((entry) => ({ ...entry, invite_id: idByUid.get(entry.uid) || null })));
    if (error) throw error;
  }
};

/** Recent send history for a project, newest first. */
export const loadSendLog = async (projectId, limit = 100) => {
  const { data, error } = await supabase.from('calendar_send_log').select('*').eq('project_id', projectId).order('sent_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
};
