// Recording what was sent. Pure: builds the rows to write, does not write them.
import { KIND } from './planChanges';

const ACTIONS = {
  [KIND.NEW]: 'request',
  [KIND.UPDATE]: 'update',
  [KIND.CANCEL_ATTENDEES]: 'cancel_attendees',
  [KIND.CANCEL]: 'cancel'
};

/**
 * After the invites from `items` have been sent, what to remember so the next plan only finds new changes.
 * Test sends are logged but never change the remembered state, so testing cannot hide a real change.
 * @param {Array} items - from planInviteChanges
 * @param {Object} context - { projectId, scheduleId, userId, testMode, now }
 * @returns {{ invites: Array, logs: Array }} `invites` upsert into calendar_invites (conflict on project_id + uid);
 *   `logs` insert into calendar_send_log (the writer fills invite_id from the upserted rows, matched by uid).
 */
export function recordSent(items, { projectId, scheduleId, userId = null, testMode = false, now = new Date() }) {
  const stamp = now.toISOString();
  const invites = [];
  const logs = [];

  items.forEach((item) => {
    const log = (action, summary) =>
      logs.push({ project_id: projectId, uid: item.uid, action, sequence: item.sequence, summary, provider: 'ics', test_mode: testMode, sent_by: userId, sent_at: stamp });

    log(ACTIONS[item.kind], item.description);
    if (item.kind === KIND.UPDATE && item.removed.length > 0) log('cancel_attendees', `Cancel for ${item.removed.map((p) => p.name).join(', ')}`);

    if (testMode) return;
    invites.push({
      project_id: projectId,
      schedule_id: scheduleId,
      session_id: item.sessionId || null,
      uid: item.uid,
      sequence: item.sequence,
      status: item.kind === KIND.CANCEL ? 'cancelled' : 'active',
      snapshot: item.kind === KIND.CANCEL ? item.previous : item.current,
      last_sent_at: stamp,
      last_sent_by: userId
    });
  });

  return { invites, logs };
}
