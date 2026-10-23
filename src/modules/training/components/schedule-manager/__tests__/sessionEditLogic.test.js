import { durationHours, formatDateTimeLocal, generateTitle, partTextFromTitle, validateTimes } from '../sessionEditLogic';

describe('formatDateTimeLocal', () => {
  test('keeps the wall-clock time with zero padding', () => {
    expect(formatDateTimeLocal(new Date(2026, 0, 5, 9, 5))).toBe('2026-01-05T09:05');
    expect(formatDateTimeLocal(new Date(2026, 10, 25, 14, 30))).toBe('2026-11-25T14:30');
  });
});

describe('partTextFromTitle', () => {
  test('finds the part in the usual shapes and wraps it in brackets', () => {
    expect(partTextFromTitle('Course - Group 1 (Part 1 AM)')).toBe('(Part 1 AM)');
    expect(partTextFromTitle('Course - Group 1 - Part 2 PM')).toBe('(Part 2 PM)');
    expect(partTextFromTitle('Course (Part 3)')).toBe('(Part 3)');
  });
  test('no part, no text', () => {
    expect(partTextFromTitle('Course - Group 1')).toBeNull();
    expect(partTextFromTitle(undefined)).toBeNull();
  });
});

describe('generateTitle', () => {
  const session = { course: { course_name: 'Budgeting' }, sessionNumber: 2, title: 'Budgeting - Group 2 (Part 1 AM)' };
  test('course, group, part and trainer in that order', () => {
    expect(generateTitle(session, 'Tess')).toBe('Budgeting - Group 2 - (Part 1 AM) - (Tess)');
  });
  test('leaves out what is missing', () => {
    expect(generateTitle({ course: { course_name: 'Budgeting' } }, '')).toBe('Budgeting');
    expect(generateTitle(null, '')).toBe('');
  });
});

describe('validateTimes', () => {
  test('needs both times, valid dates, and an end after the start', () => {
    expect(validateTimes('', '2026-10-05T10:00')).toBe('Start and end times are required');
    expect(validateTimes('nope', '2026-10-05T10:00')).toBe('Invalid date format');
    expect(validateTimes('2026-10-05T10:00', '2026-10-05T10:00')).toBe('End time must be after start time');
    expect(validateTimes('2026-10-05T09:00', '2026-10-05T10:00')).toBeNull();
  });
});

describe('durationHours', () => {
  test('hours with one decimal, 0 when unusable', () => {
    expect(durationHours('2026-10-05T09:30', '2026-10-05T12:30')).toBe('3.0');
    expect(durationHours('2026-10-05T09:00', '2026-10-05T10:30')).toBe('1.5');
    expect(durationHours('2026-10-05T10:00', '2026-10-05T09:00')).toBe('0');
    expect(durationHours('', '')).toBe('0');
  });
});
