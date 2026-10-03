/** @jest-environment jsdom */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumberInput from '../NumberInput';

// user-event updates React outside RTL's act() wrapper here, which only prints a warning (the tests
// still assert on the final DOM). Hide just that one message so real errors stay visible.
beforeAll(() => {
  const original = console.error;
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).includes('not wrapped in act')) return;
    original(...args);
  });
});

// Mirrors how Define Criteria uses it: the parent keeps a number
const Harness = ({ initial = 5, onChangeSpy }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberInput
        aria-label="weeks"
        value={value}
        onValueChange={(n) => { onChangeSpy?.(n); setValue(n); }}
      />
      <span data-testid="parent">{value}</span>
      <button>elsewhere</button>
    </>
  );
};

describe('NumberInput', () => {
  test('backspace can clear the box (it no longer snaps to 0)', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('weeks');

    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(input.value).toBe('');
  });

  test('you can then type a new number', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('weeks');

    await user.click(input);
    await user.keyboard('{Backspace}8');

    expect(input.value).toBe('8');
    expect(screen.getByTestId('parent').textContent).toBe('8');
  });

  test('multi-digit numbers can be deleted one digit at a time', async () => {
    const user = userEvent.setup();
    render(<Harness initial={12} />);
    const input = screen.getByLabelText('weeks');

    await user.click(input);
    await user.keyboard('{Backspace}');
    expect(input.value).toBe('1');
    await user.keyboard('{Backspace}');
    expect(input.value).toBe('');
  });

  test('the parent never receives 0 or NaN while the box is empty', async () => {
    const user = userEvent.setup();
    const spy = jest.fn();
    render(<Harness initial={5} onChangeSpy={spy} />);

    await user.click(screen.getByLabelText('weeks'));
    await user.keyboard('{Backspace}');

    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByTestId('parent').textContent).toBe('5'); // last valid value kept
  });

  test('leaving the box empty puts the last valid value back', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('weeks');

    await user.click(input);
    await user.keyboard('{Backspace}');
    await user.click(screen.getByText('elsewhere')); // blur

    expect(input.value).toBe('5');
  });

  test('a typed 0 is a real value and is kept', async () => {
    const user = userEvent.setup();
    render(<Harness initial={5} />);
    const input = screen.getByLabelText('weeks');

    await user.click(input);
    await user.keyboard('{Backspace}0');

    expect(input.value).toBe('0');
    expect(screen.getByTestId('parent').textContent).toBe('0');
  });

  test('follows a value changed from outside', () => {
    const { rerender } = render(<NumberInput aria-label="w" value={3} onValueChange={() => {}} />);
    rerender(<NumberInput aria-label="w" value={9} onValueChange={() => {}} />);
    expect(screen.getByLabelText('w').value).toBe('9');
  });

  test('passes through other props such as step', () => {
    render(<NumberInput aria-label="w" value={1.5} step="0.1" onValueChange={() => {}} />);
    expect(screen.getByLabelText('w').getAttribute('step')).toBe('0.1');
  });
});
