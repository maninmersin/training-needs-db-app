/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TSCReviewAdjustStage from '../TSCReviewAdjustStage';

jest.mock('../../calendar/ScheduleCalendar', () => () => <div>calendar</div>);

const setup = (props = {}) => {
  const onFinish = jest.fn().mockResolvedValue();
  render(<MemoryRouter><TSCReviewAdjustStage sessionsForCalendar={{ a: [{}] }} onSessionUpdated={() => {}} onFinish={onFinish} {...props} /></MemoryRouter>);
  return { onFinish, user: userEvent.setup() };
};

describe('Review & Adjust', () => {
  test('shows the calendar when there are sessions, and a message when there are none', () => {
    setup();
    expect(screen.getByText('calendar')).toBeInTheDocument();
  });

  test('says so when there is nothing to show', () => {
    setup({ sessionsForCalendar: {} });
    expect(screen.getByText('No sessions available to display')).toBeInTheDocument();
  });

  test('saves with the trimmed name', async () => {
    const { onFinish, user } = setup();
    const name = screen.getByLabelText('Schedule Name *');
    await user.clear(name);
    await user.type(name, '  Wave 1  ');
    await user.click(screen.getByRole('button', { name: /Save Schedule/ }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('Wave 1'));
  });

  test('cannot be saved without a name', async () => {
    const { onFinish, user } = setup();
    await user.clear(screen.getByLabelText('Schedule Name *'));
    expect(screen.getByRole('button', { name: /Save Schedule/ })).toBeDisabled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
