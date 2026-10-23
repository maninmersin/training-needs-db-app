/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import InviteChangesDialog from '../InviteChangesDialog';
import { loadLedger, saveSent } from '@core/services/calendarInviteService';
import { loadInviteInputs } from '../../../services/inviteDataService';
import { groupPeopleBySession } from '@core/calendar/inviteInputs';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
// The calendar library only uses nanoid when it has to make up an id; ours are always given (and its browser build is ESM)
jest.mock('nanoid', () => ({ nanoid: () => 'generated-id' }));
jest.mock('@core/components/shell/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'u1', email: 'me@x.com' } }) }));
jest.mock('@core/services/calendarInviteService', () => ({ loadLedger: jest.fn(), saveSent: jest.fn() }));
jest.mock('../../../services/inviteDataService', () => ({ loadInviteInputs: jest.fn() }));

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

const sessionRow = (id, day, name) => ({
  id, course_name: name, session_number: 1, training_location: 'Dubai', classroom_number: 1, instructor_name: 'Tess',
  start_datetime: `2026-10-${String(day).padStart(2, '0')}T09:30:00`, end_datetime: `2026-10-${String(day).padStart(2, '0')}T12:30:00`
});
const SESSIONS = [sessionRow('s1', 5, 'Budgeting'), sessionRow('s2', 6, 'Ledger'), sessionRow('s3', 7, 'Empty course'), sessionRow('s4', 8, 'Reporting')];
const ROWS = [
  { session_id: 's1', end_user_id: 1, user_name: 'Pat', user_email: 'pat@x.com' },
  { session_id: 's2', end_user_id: 1, user_name: 'Pat', user_email: 'pat@x.com' },
  { session_id: 's2', end_user_id: 2, user_name: 'No Email', user_email: '' },
  { session_id: 's4', end_user_id: 3, user_name: 'Lee', user_email: 'lee@x.com' }
];

const blobText = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });

const setup = ({ ledger = [], ledgerError = null } = {}) => {
  localStorage.clear();
  loadInviteInputs.mockResolvedValue(groupPeopleBySession(SESSIONS, ROWS));
  if (ledgerError) loadLedger.mockRejectedValue(ledgerError);
  else loadLedger.mockResolvedValue(ledger);
  saveSent.mockResolvedValue();
  const onClose = jest.fn();
  const user = userEvent.setup();
  render(<InviteChangesDialog isOpen onClose={onClose} schedule={{ id: 'sch1', name: 'Wave One' }} projectId="p1" />);
  return { user, onClose };
};

beforeEach(() => jest.clearAllMocks());

describe('InviteChangesDialog', () => {
  test('starts in test mode with your own address, and lists the first meetings that have someone to invite', async () => {
    setup();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Budgeting - Group 1')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Test mode')).toBeChecked();
    expect(within(dialog).getByLabelText('Your email address (the organiser)')).toHaveValue('me@x.com');
    expect(within(dialog).getByLabelText('Send the test to')).toHaveValue('me@x.com');
    expect(within(dialog).getByText('Reporting - Group 1')).toBeInTheDocument();
    expect(within(dialog).queryByText('Empty course - Group 1')).not.toBeInTheDocument(); // nobody to invite
  });

  test('the number of meetings in the test can be limited', async () => {
    const { user } = setup();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Budgeting - Group 1');
    const limit = within(dialog).getByLabelText('Number of meetings in the test');
    await user.clear(limit);
    await user.type(limit, '1');
    expect(within(dialog).queryByText('Ledger - Group 1')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Budgeting - Group 1')).toBeInTheDocument();
  });

  test('Create test file downloads an .ics file for the test address only, and remembers nothing', async () => {
    const { user } = setup();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Budgeting - Group 1');
    await user.click(within(dialog).getByRole('button', { name: /Create test file/ }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const [blob, filename] = saveAs.mock.calls[0];
    expect(filename).toMatch(/^TEST_Wave_One_Invites_\d{4}-\d{2}-\d{2}\.ics$/);
    const text = await blobText(blob);
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('METHOD:REQUEST');
    expect(text).toContain('[TEST] Budgeting - Group 1');
    expect(text).toContain('mailto:me@x.com');
    expect(text).not.toContain('pat@x.com'); // the real people are not invited in a test
    expect(saveSent).not.toHaveBeenCalled();
    expect(await within(dialog).findByText(/Test files created/)).toBeInTheDocument();
  });

  test('an organiser email is required', async () => {
    const { user } = setup();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Budgeting - Group 1');
    await user.clear(within(dialog).getByLabelText('Your email address (the organiser)'));
    await user.click(within(dialog).getByRole('button', { name: /Create test file/ }));
    expect(await within(dialog).findByText('Enter the email address the invitations come from')).toBeInTheDocument();
    expect(saveAs).not.toHaveBeenCalled();
  });

  test('the choices are remembered for next time', async () => {
    const { user } = setup();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Budgeting - Group 1');
    await user.type(within(dialog).getByLabelText('Your name (shown as the organiser)'), 'Stuart');
    await user.click(within(dialog).getByRole('button', { name: /Create test file/ }));
    await waitFor(() => expect(saveAs).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem('tna-invite-settings:p1'))).toMatchObject({ organizerName: 'Stuart', testMode: true });
  });

  test('real mode lists what changed since the last send, and Mark as sent remembers it', async () => {
    const unchangedSnapshot = {
      title: 'Budgeting - Group 1', location: 'Dubai', room: '1', trainer: 'Tess', functionalArea: '', start: '2026-10-05T09:30', end: '2026-10-05T12:30',
      attendees: [{ id: 1, name: 'Pat', email: 'pat@x.com' }]
    };
    const { user } = setup({ ledger: [{ id: 'l1', session_id: 's1', uid: 'training-s1@training-system', sequence: 0, status: 'active', snapshot: unchangedSnapshot }] });
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Budgeting - Group 1');
    await user.click(within(dialog).getByLabelText('Test mode'));
    // s1 is unchanged, so only the two other meetings with people are listed
    await waitFor(() => expect(within(dialog).queryByText('Budgeting - Group 1')).not.toBeInTheDocument());
    expect(within(dialog).getByText('Ledger - Group 1')).toBeInTheDocument();
    expect(within(dialog).getByText('Reporting - Group 1')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 assignment\(s\) have no email address/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Create invite files/ }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).not.toMatch(/^TEST_/);
    await user.click(await within(dialog).findByRole('button', { name: /mark as sent/ }));
    await waitFor(() => expect(saveSent).toHaveBeenCalledTimes(1));
    const { invites, logs } = saveSent.mock.calls[0][0];
    expect(invites.map((i) => i.uid)).toEqual(['training-s2@training-system', 'training-s4@training-system']);
    expect(logs.every((l) => l.test_mode === false)).toBe(true);
  });

  test('without the invite history tables, test mode still works and real mode explains what to do', async () => {
    const { user } = setup({ ledgerError: { code: 'PGRST205', message: "Could not find the table 'public.calendar_invites' in the schema cache" } });
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Budgeting - Group 1')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Create test file/ })).toBeEnabled();
    await user.click(within(dialog).getByLabelText('Test mode'));
    expect(await within(dialog).findByText(/real invitations cannot be created/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Create invite files/ })).toBeDisabled();
  });
});
