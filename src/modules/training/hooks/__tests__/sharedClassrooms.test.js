import {
  ClassroomOccupancyTracker,
  calculateSharedClassroomRequirements,
  physicalLocationOf
} from '@core/utils/classroomCalculations';
import { scheduleByGroupComplete } from '../scheduleByGroupComplete';
import { scheduleByCourseComplete } from '../scheduleByCourseComplete';

// The wizard schedules one group per "location|functional_area", but classrooms are physical:
// every functional area at a location must share that location's rooms. Before the fix each group
// got its own "Classroom 1", so after save + reopen (grouped by location) they were double-booked.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const criteria = {
  max_attendees: 6, total_weeks: 1, daily_hours: 6, days_per_week: 5, contingency: 1,
  start_date: '2026-10-05', scheduling_preference: 'both',
  start_time_am: '09:30', end_time_am: '12:30', start_time_pm: '13:30', end_time_pm: '16:30',
  scheduling_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
};

// Two areas x two courses of 3h; 24 users per area per location
const courses = [
  { course_id: 'FIN-1', course_name: 'Fin One', duration_hrs: 3, functional_area: 'Finance', priority: 1 },
  { course_id: 'FIN-2', course_name: 'Fin Two', duration_hrs: 3, functional_area: 'Finance', priority: 2 },
  { course_id: 'HR-1', course_name: 'HR One', duration_hrs: 3, functional_area: 'HR', priority: 1 },
  { course_id: 'HR-2', course_name: 'HR Two', duration_hrs: 3, functional_area: 'HR', priority: 2 }
];

const buildUsers = () => {
  const users = [];
  for (const location of ['London', 'Manchester']) {
    for (const area of ['Finance', 'HR']) {
      const prefix = area === 'Finance' ? 'FIN' : 'HR';
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

const groupUsers = (users) => users.reduce((groups, user) => {
  const key = `${user.training_location}|${user.functional_area}`;
  (groups[key] = groups[key] || []).push(user);
  return groups;
}, {});

// Mirrors how TSCWizard sets up and runs a scheduler
const runScheduler = async (scheduler) => {
  const grouped = groupUsers(buildUsers());
  const reqs = calculateSharedClassroomRequirements(grouped, courses, criteria);
  const sessionsGrouped = { General: {} };
  for (const groupName in grouped) {
    sessionsGrouped.General[groupName] = {};
    const rooms = reqs.get(groupName)?.numberOfClassrooms || 1;
    for (let i = 1; i <= rooms; i++) sessionsGrouped.General[groupName][`Classroom ${i}`] = [];
  }
  await scheduler(
    grouped, courses, criteria, sessionsGrouped, 'General', reqs, new ClassroomOccupancyTracker(),
    'both', 9, 30, 13, 30, 3, 3, DAY_NAMES
  );

  // What Schedule Manager shows after save + reopen: sessions grouped by location + classroom number
  const sessions = [];
  for (const group in sessionsGrouped.General) {
    for (const room in sessionsGrouped.General[group]) {
      for (const s of sessionsGrouped.General[group][room]) {
        sessions.push({
          location: physicalLocationOf(group), room: Number(room.replace('Classroom ', '')),
          start: s.start.getTime(), end: s.end.getTime()
        });
      }
    }
  }
  return { sessions, reqs };
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

describe('physicalLocationOf', () => {
  test('takes the location from a "location|functional_area" group key', () => {
    expect(physicalLocationOf('London|Finance')).toBe('London');
    expect(physicalLocationOf('London')).toBe('London');
  });
});

describe('calculateSharedClassroomRequirements', () => {
  test('sizes the pool from the whole location, and every group there gets the same pool', () => {
    const reqs = calculateSharedClassroomRequirements(groupUsers(buildUsers()), courses, criteria);
    const london = ['London|Finance', 'London|HR'].map((k) => reqs.get(k).numberOfClassrooms);
    // 288 user-hours at London / 180 per room = 2 rooms (each area alone would only need 1)
    expect(london).toEqual([2, 2]);
  });
});

describe.each([
  ['group-complete', scheduleByGroupComplete],
  ['course-complete', scheduleByCourseComplete]
])('%s scheduling shares classrooms across functional areas', (name, scheduler) => {
  test('no classroom is double-booked once sessions are grouped by location', async () => {
    const { sessions } = await runScheduler(scheduler);
    expect(sessions.length).toBeGreaterThan(0);
    expect(doubleBookings(sessions)).toBe(0);
  });

  test('uses more than one classroom per location, within the location pool', async () => {
    const { sessions, reqs } = await runScheduler(scheduler);
    for (const location of ['London', 'Manchester']) {
      const rooms = new Set(sessions.filter((s) => s.location === location).map((s) => s.room));
      const pool = reqs.get(`${location}|Finance`).numberOfClassrooms;
      expect(rooms.size).toBeGreaterThan(1);
      expect(Math.max(...rooms)).toBeLessThanOrEqual(pool);
    }
  });
});
