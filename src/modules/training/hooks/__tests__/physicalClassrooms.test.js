import {
  ClassroomOccupancyTracker,
  calculateClassroomsNeeded,
  assignPhysicalClassrooms,
  physicalLocationOf
} from '@core/utils/classroomCalculations';
import { scheduleByGroupComplete } from '../scheduleByGroupComplete';
import { scheduleByCourseComplete } from '../scheduleByCourseComplete';

// The wizard schedules one group per "location|functional_area", each numbering its classrooms from
// 1. Saved sessions are grouped by location + classroom number, so London's Finance and HR groups
// (both "Classroom 1") collapsed into one room and were double-booked. Every area should keep its
// own rooms, all starting on the chosen start date, with room numbers unique within a location.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const START = new Date(2026, 9, 12); // Monday 12 Oct 2026

const criteria = {
  max_attendees: 6, total_weeks: 1, daily_hours: 6, days_per_week: 5, contingency: 1,
  start_date: '2026-10-12', scheduling_preference: 'both',
  start_time_am: '09:30', end_time_am: '12:30', start_time_pm: '13:30', end_time_pm: '16:30',
  scheduling_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
};

const courses = [
  { course_id: 'FIN-1', course_name: 'Fin One', duration_hrs: 3, functional_area: 'Finance', priority: 1 },
  { course_id: 'FIN-2', course_name: 'Fin Two', duration_hrs: 3, functional_area: 'Finance', priority: 2 },
  { course_id: 'HR-1', course_name: 'HR One', duration_hrs: 3, functional_area: 'HR', priority: 1 },
  { course_id: 'HR-2', course_name: 'HR Two', duration_hrs: 3, functional_area: 'HR', priority: 2 }
];

// 24 users per area per location, each taking both of their area's courses
const buildUsers = () => {
  const users = [];
  for (const location of ['London', 'Manchester']) {
    for (const [area, prefix] of [['Finance', 'FIN'], ['HR', 'HR']]) {
      for (let i = 0; i < 24; i++) {
        for (const n of [1, 2]) {
          users.push({
            id: `${location}-${area}-${i}`, name: `${location} ${area} ${i}`,
            training_location: location, functional_area: area, course_id: `${prefix}-${n}`
          });
        }
      }
    }
  }
  return users;
};

// Mirrors how TSCWizard sets up, runs and post-processes a scheduler
const generate = async (scheduler) => {
  const grouped = buildUsers().reduce((groups, user) => {
    const key = `${user.training_location}|${user.functional_area}`;
    (groups[key] = groups[key] || []).push(user);
    return groups;
  }, {});

  const reqs = new Map();
  const sessionsGrouped = { General: {} };
  for (const groupName in grouped) {
    let hours = 0;
    for (const course of courses) {
      hours += grouped[groupName].filter((u) => u.course_id === course.course_id).length * course.duration_hrs;
    }
    const req = calculateClassroomsNeeded(hours, criteria);
    reqs.set(groupName, req);
    sessionsGrouped.General[groupName] = {};
    for (let i = 1; i <= (req.numberOfClassrooms || 1); i++) sessionsGrouped.General[groupName][`Classroom ${i}`] = [];
  }

  await scheduler(
    grouped, courses, criteria, sessionsGrouped, 'General', reqs, new ClassroomOccupancyTracker(),
    'both', 9, 30, 13, 30, 3, 3, DAY_NAMES
  );
  return assignPhysicalClassrooms(sessionsGrouped);
};

// Flatten like Schedule Manager does after save + reopen: location + classroom number
const flatten = (sessionsGrouped) => {
  const sessions = [];
  for (const area in sessionsGrouped) {
    for (const group in sessionsGrouped[area]) {
      for (const room in sessionsGrouped[area][group]) {
        for (const s of sessionsGrouped[area][group][room]) {
          sessions.push({
            area: group.split('|')[1], location: physicalLocationOf(group),
            room: Number(room.replace('Classroom ', '')), start: s.start, end: s.end
          });
        }
      }
    }
  }
  return sessions;
};

const doubleBookings = (sessions) => {
  let count = 0;
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.location === b.location && a.room === b.room && a.start < b.end && b.start < a.end) count++;
    }
  }
  return count;
};

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('assignPhysicalClassrooms', () => {
  const session = (groupName, classroomNumber) => ({ groupName, classroomNumber, start: START, end: START });

  test("numbers each area's rooms after the previous areas at the same location", () => {
    const result = assignPhysicalClassrooms({
      General: {
        'London|Finance': { 'Classroom 1': [session('London|Finance', 1)], 'Classroom 2': [session('London|Finance Classroom 2', 2)] },
        'London|HR': { 'Classroom 1': [session('London|HR', 1)] },
        'Manchester|HR': { 'Classroom 1': [session('Manchester|HR', 1)] }
      }
    });
    expect(Object.keys(result.General['London|Finance'])).toEqual(['Classroom 1', 'Classroom 2']);
    expect(Object.keys(result.General['London|HR'])).toEqual(['Classroom 3']);
    expect(Object.keys(result.General['Manchester|HR'])).toEqual(['Classroom 1']); // other location starts again at 1
  });

  test('updates the classroom number and name on each session', () => {
    const result = assignPhysicalClassrooms({
      General: {
        'London|Finance': { 'Classroom 1': [session('London|Finance Group 1-6 Classroom 1', 1)] },
        'London|HR': { 'Classroom 1': [session('London|HR', 1)] }
      }
    });
    const hr = result.General['London|HR']['Classroom 2'][0];
    expect(hr.classroomNumber).toBe(2);
    expect(hr.groupName).toBe('London|HR Classroom 2');
  });

  test('drops empty classrooms so room numbers have no gaps', () => {
    const result = assignPhysicalClassrooms({
      General: {
        'London|Finance': { 'Classroom 1': [session('London|Finance', 1)], 'Classroom 2': [] },
        'London|HR': { 'Classroom 1': [session('London|HR', 1)] }
      }
    });
    expect(Object.keys(result.General['London|Finance'])).toEqual(['Classroom 1']);
    expect(Object.keys(result.General['London|HR'])).toEqual(['Classroom 2']);
  });

  test('does not modify its input', () => {
    const input = { General: { 'London|HR': { 'Classroom 1': [session('London|HR', 1)] } } };
    assignPhysicalClassrooms(input);
    expect(Object.keys(input.General['London|HR'])).toEqual(['Classroom 1']);
    expect(input.General['London|HR']['Classroom 1'][0].classroomNumber).toBe(1);
  });
});

// Group-complete runs every area's groups in parallel from the start date. Course-complete does one
// course at a time across all areas (by design), so only the schedule as a whole starts on the date.
describe.each([
  ['group-complete', scheduleByGroupComplete, true],
  ['course-complete', scheduleByCourseComplete, false]
])('%s scheduling gives each functional area its own classrooms', (name, scheduler, everyAreaStartsOnStartDate) => {
  test('no classroom is double-booked once sessions are grouped by location', async () => {
    const sessions = flatten(await generate(scheduler));
    expect(sessions.length).toBeGreaterThan(0);
    expect(doubleBookings(sessions)).toBe(0);
  });

  const ymdhm = (d) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()];

  test('the schedule starts on the chosen start date, at the first time block', async () => {
    const sessions = flatten(await generate(scheduler));
    const first = new Date(Math.min(...sessions.map((s) => +s.start)));
    expect(ymdhm(first)).toEqual([2026, 9, 12, 9, 30]);
  });

  if (everyAreaStartsOnStartDate) {
    test('every functional area starts on the chosen start date', async () => {
      const sessions = flatten(await generate(scheduler));
      for (const location of ['London', 'Manchester']) {
        for (const area of ['Finance', 'HR']) {
          const times = sessions.filter((s) => s.location === location && s.area === area).map((s) => +s.start);
          expect(ymdhm(new Date(Math.min(...times)))).toEqual([2026, 9, 12, 9, 30]);
        }
      }
    });
  }

  test('areas never share a classroom number at the same location', async () => {
    const sessions = flatten(await generate(scheduler));
    for (const location of ['London', 'Manchester']) {
      const roomsOf = (area) => new Set(sessions.filter((s) => s.location === location && s.area === area).map((s) => s.room));
      const finance = roomsOf('Finance');
      const hr = roomsOf('HR');
      expect([...finance].filter((room) => hr.has(room))).toEqual([]);
      // contiguous 1..N across the location
      const all = [...finance, ...hr].sort((a, b) => a - b);
      expect(all).toEqual(all.map((_, i) => i + 1));
    }
  });
});
