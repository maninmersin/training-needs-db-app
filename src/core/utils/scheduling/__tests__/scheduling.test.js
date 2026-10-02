import { TimeBlockEngine, parseTimeToHours, calculateDuration } from '../TimeBlockEngine';
import { SessionSplitter } from '../SessionSplitter';
import {
  sortCoursesByPriority,
  groupUsersByKeys,
  calculateSessionsNeeded,
  createSessionGroups
} from '../SchedulingCore';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// 08:00-12:00 (4h) and 13:00-17:00 (4h) => 8h per day
const fullDayCriteria = {
  scheduling_preference: 'both',
  scheduling_days: WEEKDAYS,
  start_time_am: '08:00',
  end_time_am: '12:00',
  start_time_pm: '13:00',
  end_time_pm: '17:00'
};

// Friday 3 Jan 2025, local time
const FRIDAY = new Date(2025, 0, 3, 0, 0, 0);

beforeAll(() => {
  // The engine logs heavily; keep test output readable
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('time parsing', () => {
  test('parses HH:MM to decimal hours', () => {
    expect(parseTimeToHours('08:00')).toBe(8);
    expect(parseTimeToHours('13:30')).toBe(13.5);
  });

  test('rejects malformed times', () => {
    expect(() => parseTimeToHours('25:00')).toThrow();
    expect(() => parseTimeToHours('8')).toThrow();
    expect(() => parseTimeToHours(null)).toThrow();
  });

  test('duration requires end after start', () => {
    expect(calculateDuration('09:00', '12:30')).toBe(3.5);
    expect(() => calculateDuration('12:00', '09:00')).toThrow();
  });
});

describe('TimeBlockEngine', () => {
  test('builds AM and PM blocks and daily capacity', () => {
    const engine = new TimeBlockEngine(fullDayCriteria);
    expect(engine.getTimeBlocks().map((b) => [b.start, b.end])).toEqual([['08:00', '12:00'], ['13:00', '17:00']]);
    expect(engine.getMaxDailyHours()).toBe(8);
  });

  test('respects am_only / pm_only preferences', () => {
    expect(new TimeBlockEngine({ ...fullDayCriteria, scheduling_preference: 'am_only' }).getMaxDailyHours()).toBe(4);
    const pm = new TimeBlockEngine({ ...fullDayCriteria, scheduling_preference: 'pm_only' });
    expect(pm.getTimeBlocks()).toHaveLength(1);
    expect(pm.getTimeBlocks()[0].id).toBe(2);
  });

  test('throws when no usable blocks are configured', () => {
    expect(() => new TimeBlockEngine({ scheduling_days: WEEKDAYS })).toThrow(/No valid time blocks/);
  });

  test('fit and day calculations', () => {
    const engine = new TimeBlockEngine(fullDayCriteria);
    expect(engine.findSingleBlockFit(3).id).toBe(1);
    expect(engine.findSingleBlockFit(5)).toBeNull();
    expect(engine.canFitInSingleDay(8)).toBe(true);
    expect(engine.canFitInSingleDay(9)).toBe(false);
    expect(engine.calculateDaysNeeded(17)).toBe(3);
    expect(engine.calculateDaysNeeded(0)).toBe(0);
  });

  test('skips non-scheduling days (Friday -> Monday for Mon/Tue only)', () => {
    const engine = new TimeBlockEngine({ ...fullDayCriteria, scheduling_days: ['Monday', 'Tuesday'] });
    const next = engine.getNextValidDate(FRIDAY);
    expect(next.getDay()).toBe(1);
    expect(next.getDate()).toBe(6);
  });

  test('validate flags overlapping blocks and missing days', () => {
    const overlapping = new TimeBlockEngine({ ...fullDayCriteria, end_time_am: '14:00' });
    expect(overlapping.validate().isValid).toBe(false);
    const noDays = new TimeBlockEngine({ ...fullDayCriteria, scheduling_days: [] });
    expect(noDays.validate().errors).toContain('No scheduling days configured');
  });
});

describe('SessionSplitter', () => {
  const splitter = () => new SessionSplitter(new TimeBlockEngine(fullDayCriteria));
  const hours = (part) => (part.end - part.start) / 3600000;

  test('requires a TimeBlockEngine', () => {
    expect(() => new SessionSplitter({})).toThrow();
  });

  test('a course that fits one block becomes one session at the block start', () => {
    const parts = splitter().splitCourse(3, { courseName: 'Safety', startDate: FRIDAY });
    expect(parts).toHaveLength(1);
    expect(parts[0].start.getHours()).toBe(8);
    expect(hours(parts[0])).toBe(3);
  });

  test('a 6h course splits across AM and PM on the same day', () => {
    const parts = splitter().splitCourse(6, { courseName: 'Service', startDate: FRIDAY });
    expect(parts.length).toBe(2);
    expect(parts.reduce((sum, p) => sum + hours(p), 0)).toBeCloseTo(6);
    expect(parts[0].start.toDateString()).toBe(parts[1].start.toDateString());
    expect(parts[1].start.getHours()).toBe(13);
  });

  test('a 12h course spans two scheduling days and skips the weekend', () => {
    const parts = splitter().splitCourse(12, { courseName: 'Mgmt', startDate: FRIDAY });
    expect(parts.reduce((sum, p) => sum + hours(p), 0)).toBeCloseTo(12);
    const days = [...new Set(parts.map((p) => p.start.toDateString()))];
    expect(days).toHaveLength(2);
    parts.forEach((p) => expect([0, 6]).not.toContain(p.start.getDay()));
  });

  test('no part runs outside its time block', () => {
    const parts = splitter().splitCourse(12, { courseName: 'Mgmt', startDate: FRIDAY });
    parts.forEach((p) => {
      const startH = p.start.getHours() + p.start.getMinutes() / 60;
      const endH = p.end.getHours() + p.end.getMinutes() / 60;
      const inAm = startH >= 8 && endH <= 12;
      const inPm = startH >= 13 && endH <= 17;
      expect(inAm || inPm).toBe(true);
    });
  });

  test('rejects non-positive durations', () => {
    expect(() => splitter().splitCourse(0)).toThrow();
  });
});

describe('SchedulingCore helpers', () => {
  test('sorts by priority with unprioritised courses last', () => {
    const sorted = sortCoursesByPriority([{ id: 'c', priority: null }, { id: 'a', priority: 2 }, { id: 'b', priority: 1 }]);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  test('groups users by one or more keys, trimming and defaulting blanks', () => {
    const groups = groupUsersByKeys(
      [
        { training_location: 'Leeds ', role: 'Mgr' },
        { training_location: 'Leeds', role: 'Mgr' },
        { training_location: null, role: 'Staff' }
      ],
      ['training_location', 'role']
    );
    expect(Object.keys(groups).sort()).toEqual(['Leeds|Mgr', 'Unknown|Staff']);
    expect(groups['Leeds|Mgr']).toHaveLength(2);
  });

  test('session counts and group sizes respect max attendees', () => {
    const users = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    expect(calculateSessionsNeeded(users, 10)).toBe(3);
    expect(calculateSessionsNeeded([], 10)).toBe(0);
    const groups = createSessionGroups(users, 10);
    expect(groups.map((g) => g.userCount)).toEqual([10, 10, 5]);
    expect(groups[2].userRange).toBe('21-25');
  });
});
