/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

const Probe = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="state">{theme}/{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
};

const mockSystem = (prefersDark) => {
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches: prefersDark,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }));
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  mockSystem(false);
});

describe('ThemeProvider', () => {
  test('starts from the default and leaves <html> light', () => {
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('light/light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  test('choosing dark adds the dark class and is remembered', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>);
    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('tna-theme')).toBe('dark');
  });

  test('a saved choice wins over the default', () => {
    localStorage.setItem('tna-theme', 'dark');
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  test('"system" follows the operating system setting', () => {
    mockSystem(true);
    render(<ThemeProvider defaultTheme="system"><Probe /></ThemeProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  test('an unknown saved value is ignored', () => {
    localStorage.setItem('tna-theme', 'purple');
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>);
    expect(screen.getByTestId('state')).toHaveTextContent('light/light');
  });

  test('still works when storage is blocked', async () => {
    const user = userEvent.setup();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ThemeProvider defaultTheme="light"><Probe /></ThemeProvider>);
    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
    Storage.prototype.setItem.mockRestore();
  });

  test('useTheme outside the provider explains the mistake', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/inside <ThemeProvider>/);
    console.error.mockRestore();
  });
});
