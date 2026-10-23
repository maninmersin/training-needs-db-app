/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionEditModal from '../SessionEditModal';
import { supabase } from '@core/services/supabaseClient';

jest.mock('@core/services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

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

const TRAINERS = [{ id: 't1', name: 'Tess', email: 'tess@x.com', specializations: ['Finance'], active: true }];
const SESSION = {
  title: 'Budgeting - Group 1',
  course: { course_name: 'Budgeting' },
  sessionNumber: 1,
  start: new Date(2026, 9, 5, 9, 30),
  end: new Date(2026, 9, 5, 12, 30),
  location: 'Dubai Office',
  trainer_id: '',
  max_participants: 12,
  current_participants: 3
};

const setup = (props = {}) => {
  supabase.from.mockImplementation(() => {
    const query = { select: () => query, eq: () => query, order: () => query, then: (resolve) => resolve({ data: TRAINERS, error: null }) };
    return query;
  });
  const onSave = jest.fn().mockResolvedValue();
  const onDelete = jest.fn().mockResolvedValue();
  const onClose = jest.fn();
  const user = userEvent.setup();
  render(<SessionEditModal session={SESSION} isOpen onClose={onClose} onSave={onSave} onDelete={onDelete} criteria={{ max_attendees: 10 }} {...props} />);
  return { user, onSave, onDelete, onClose };
};

describe('SessionEditModal', () => {
  test('shows the session in the form', async () => {
    setup();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Start Time')).toHaveValue('2026-10-05T09:30');
    expect(within(dialog).getByLabelText('End Time')).toHaveValue('2026-10-05T12:30');
    expect(within(dialog).getByLabelText('Duration')).toHaveValue('3.0 hours');
    expect(within(dialog).getByLabelText('Location')).toHaveValue('Dubai Office');
    expect(within(dialog).getByLabelText('Generated Title')).toHaveValue('Budgeting - Group 1');
  });

  test('renders nothing when closed', () => {
    setup({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('saves the changes, keeping the original identifying details, then closes', async () => {
    const { user, onSave, onClose } = setup();
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Custom Title (Optional)'), 'Special');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: 'Special', custom_title: 'Special', location: 'Dubai Office', max_participants: 12, originalTitle: 'Budgeting - Group 1',
      originalStart: SESSION.start
    });
    expect(onSave.mock.calls[0][0].start).toEqual(new Date(2026, 9, 5, 9, 30));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('an end time before the start is refused with a message', async () => {
    const { user, onSave } = setup();
    const dialog = await screen.findByRole('dialog');
    const end = within(dialog).getByLabelText('End Time');
    await user.clear(end);
    await user.type(end, '2026-10-05T08:00');
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('End time must be after start time');
    expect(onSave).not.toHaveBeenCalled();
  });

  test('Delete asks first, naming the session, and does nothing if cancelled', async () => {
    const { user, onDelete } = setup();
    await user.click(await screen.findByRole('button', { name: /Delete Session/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Budgeting - Group 1');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('confirming Delete deletes the session and closes', async () => {
    const { user, onDelete, onClose } = setup();
    await user.click(await screen.findByRole('button', { name: /Delete Session/ }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete Session' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(SESSION));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('no Delete button when deleting is not available', async () => {
    setup({ onDelete: undefined });
    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: /Delete Session/ })).not.toBeInTheDocument();
  });
});
