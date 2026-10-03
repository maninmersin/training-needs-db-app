import { ClassroomOccupancyTracker, calculateClassroomsNeeded } from '@core/utils/classroomCalculations';
import { scheduleByGroupComplete } from '../scheduleByGroupComplete';
import { scheduleByCourseComplete } from '../scheduleByCourseComplete';

// Courses must be scheduled in priority order (lower number first). The wizard used to drop the
// priority when building its course list, so every course looked equal and data order won.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const criteria = {
  max_attendees: 6, total_weeks: 4, daily_hours: 6, days_per_week: 5, contingency: 1,
  start_date: '2026-10-12', scheduling_preference: 'both',
  start_time_am: '09:30', end_time_am: '12:30', start_time_pm: '13:30', end_time_pm: '16:30',
  scheduling_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
};

// Listed in the "wrong" order on purpose: the highest priority course (1) is last in the data
const courses = [
  { course_id: 'SCM-C', course_name: 'Outbound', duration_hrs: 3, priority: 3 },
  { course_id: 'SCM-B', course_name: 'Inventory Mgt', duration_hrs: 3, priority: 2 },
  { course_id: 'SCM-A', course_name: 'Receiving', duration_hrs: 3, priority: 1 }
];

const users = [];
for (let i = 0; i < 6; i++) {
  for (const course of courses) {
    users.push({ id: `u${i}`, training_location: 'London', functional_area: 'Supply Chain', course_id: course.course_id });
  }
}

const firstStartByCourse = async (scheduler) => {
  const grouped = { 'London|Supply Chain': users };
  const reqs = new Map([['London|Supply Chain', calculateClassroomsNeeded(54, criteria)]]);
  const sessionsGrouped = { General: { 'London|Supply Chain': { 'Classroom 1': [] } } };
  await scheduler(
    grouped, courses, criteria, sessionsGrouped, 'General', reqs, new ClassroomOccupancyTracker(),
    'both', 9, 30, 13, 30, 3, 3, DAY_NAMES
  );
  const first = {};
  for (const room of Object.values(sessionsGrouped.General['London|Supply Chain'])) {
    for (const s of room) {
      const name = s.course.course_name;
      first[name] = Math.min(first[name] ?? Infinity, +s.start);
    }
  }
  return first;
};

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe.each([
  ['group-complete', scheduleByGroupComplete],
  ['course-complete', scheduleByCourseComplete]
])('%s scheduling follows course priority', (name, scheduler) => {
  test('priority 1 is scheduled first, then 2, then 3, whatever order the data arrives in', async () => {
    const first = await firstStartByCourse(scheduler);
    expect(first['Receiving']).toBeLessThan(first['Inventory Mgt']);
    expect(first['Inventory Mgt']).toBeLessThan(first['Outbound']);
  });
});
