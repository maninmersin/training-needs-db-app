import { TimeBlockEngine } from '@core/utils/scheduling/TimeBlockEngine';
import { _advanceToNextSchedulingTime } from '../scheduleByGroupComplete';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// The Schedule Creator defaults: blocks that start on the half hour
const engine = new TimeBlockEngine({
  scheduling_preference: 'both',
  scheduling_days: WEEKDAYS,
  start_time_am: '09:30',
  end_time_am: '12:30',
  start_time_pm: '13:30',
  end_time_pm: '16:30'
});

// Monday 6 Jan 2025, local time
const at = (h, m = 0, day = 6) => new Date(2025, 0, day, h, m, 0);
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('_advanceToNextSchedulingTime keeps block start minutes', () => {
  test('after the morning block, the next slot is the afternoon start (13:30, not 13:00)', () => {
    const next = _advanceToNextSchedulingTime(at(12, 30), engine, DAY_NAMES);
    expect(hhmm(next)).toBe('13:30');
    expect(next.getDate()).toBe(6);
  });

  test('a session ending mid morning block also moves to 13:30', () => {
    const next = _advanceToNextSchedulingTime(at(11, 30), engine, DAY_NAMES);
    expect(hhmm(next)).toBe('13:30');
  });

  test('before the morning block, the next slot is 09:30 (not 09:00)', () => {
    const next = _advanceToNextSchedulingTime(at(8, 0), engine, DAY_NAMES);
    expect(hhmm(next)).toBe('09:30');
  });

  test('after the last block, the next slot is the next valid day at 09:30', () => {
    const next = _advanceToNextSchedulingTime(at(16, 30), engine, DAY_NAMES);
    expect(hhmm(next)).toBe('09:30');
    expect(next.getDate()).toBe(7);
  });

  test('skips non-scheduling days (Friday afternoon -> Monday morning)', () => {
    const next = _advanceToNextSchedulingTime(at(16, 30, 10), engine, DAY_NAMES);
    expect(hhmm(next)).toBe('09:30');
    expect(next.getDay()).toBe(1);
  });
});
