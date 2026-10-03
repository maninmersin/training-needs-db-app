/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserContextMenu from '../UserContextMenu';

const userInfo = { userId: 7, name: 'Pat Example' };
const sessionInfo = { course_id: 'A', sessionNumber: 1 };

const renderMenu = (props = {}) => {
  const handlers = {
    onClose: jest.fn(), onMoveUser: jest.fn(), onRemoveFromGroup: jest.fn(), onRemoveFromCourse: jest.fn()
  };
  render(<UserContextMenu visible x={10} y={10} userInfo={userInfo} sessionInfo={sessionInfo} {...handlers} {...props} />);
  return handlers;
};

describe('UserContextMenu', () => {
  test('offers Move to another session next to the remove options', () => {
    renderMenu();
    expect(screen.getByText('Move to another session...')).toBeInTheDocument();
    expect(screen.getByText('Remove from Group')).toBeInTheDocument();
    expect(screen.getByText('Remove from Course')).toBeInTheDocument();
  });

  test('clicking Move passes the person and session on and closes the menu', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();
    await user.click(screen.getByText('Move to another session...'));
    expect(handlers.onMoveUser).toHaveBeenCalledWith(userInfo, sessionInfo);
    expect(handlers.onClose).toHaveBeenCalled();
    expect(handlers.onRemoveFromGroup).not.toHaveBeenCalled();
  });

  test('the Move item is hidden where no move handler is provided', () => {
    renderMenu({ onMoveUser: undefined });
    expect(screen.queryByText('Move to another session...')).not.toBeInTheDocument();
    expect(screen.getByText('Remove from Group')).toBeInTheDocument();
  });

  test('remove options still work', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();
    await user.click(screen.getByText('Remove from Course'));
    expect(handlers.onRemoveFromCourse).toHaveBeenCalledWith(userInfo, sessionInfo);
  });
});
