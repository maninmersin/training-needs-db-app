// The organiser and test-mode choices for calendar invites. Kept in this browser, per project: the organiser is
// whoever is sending, so it is a per-person setting, and it needs no permission to save.

export const DEFAULT_SETTINGS = { organizerName: '', organizerEmail: '', testMode: true, testEmail: '' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const keyFor = (projectId) => `tna-invite-settings:${projectId}`;

/** Saved settings for a project, with `defaults` (for example the signed-in person) filling anything missing. */
export function loadSettings(projectId, defaults = {}, storage = globalThis.localStorage) {
  let saved = {};
  try {
    saved = JSON.parse(storage?.getItem(keyFor(projectId)) || '{}') || {};
  } catch {
    saved = {};
  }
  return { ...DEFAULT_SETTINGS, ...defaults, ...saved };
}

export function saveSettings(projectId, settings, storage = globalThis.localStorage) {
  try {
    storage?.setItem(keyFor(projectId), JSON.stringify(settings));
  } catch {
    // Not being able to remember the choices must never stop anyone sending
  }
}

/** Messages to show next to the fields; empty when the settings are usable. */
export function validateSettings(settings) {
  const problems = {};
  if (!EMAIL.test(String(settings.organizerEmail || '').trim())) problems.organizerEmail = 'Enter the email address the invitations come from';
  if (settings.testMode && !EMAIL.test(String(settings.testEmail || '').trim())) problems.testEmail = 'Enter the address the test invitations go to';
  return problems;
}
