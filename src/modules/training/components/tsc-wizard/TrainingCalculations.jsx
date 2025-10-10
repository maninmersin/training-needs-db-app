import { useEffect, useState } from 'react';
import { supabase } from '@core/services/supabaseClient';

// ✅ Fixed standalone session generator
export const calculateSessions = (criteria, courses, endUsers, groupingKeys = ['training_location']) => {
  if (!criteria || !courses?.length || !endUsers?.length) return {};

  const sessionsGrouped = {};

  const groupedEndUsers = endUsers.reduce((groups, user) => {
    const key = groupingKeys.map(k => user[k]?.toString().trim() || 'Unknown').join('|');
    (groups[key] = groups[key] || []).push(user);
    return groups;
  }, {});

  // Initialize new session structure: functional_area -> training_location -> classroom -> [sessions]
  const functionalArea = criteria.functionalArea || 'General';
  if (!sessionsGrouped[functionalArea]) {
    sessionsGrouped[functionalArea] = {};
  }

  for (const groupName in groupedEndUsers) {
    // Initialize location in the structure
    if (!sessionsGrouped[functionalArea][groupName]) {
      sessionsGrouped[functionalArea][groupName] = {};
    }
    
    // For basic calculations, we'll use a single classroom per location
    const classroomKey = 'Classroom 1';
    if (!sessionsGrouped[functionalArea][groupName][classroomKey]) {
      sessionsGrouped[functionalArea][groupName][classroomKey] = [];
    }

    // Handle scheduling preference for initial time setting
    const schedulingPreference = criteria.scheduling_preference || 'both';
    let currentSessionStartTime = new Date(criteria.start_date);
    
    if (schedulingPreference === 'pm_only' && criteria.start_time_pm) {
      const [pmStartHour, pmStartMin] = criteria.start_time_pm.split(':').map(Number);
      currentSessionStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
    } else if (criteria.start_time_am) {
      const [amStartHour, amStartMin] = criteria.start_time_am.split(':').map(Number);
      currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const sortedCourses = [...courses].sort((a, b) => (a.course_id || '').localeCompare(b.course_id || ''));
    const usersInGroup = groupedEndUsers[groupName];

    for (const course of sortedCourses) {
      const attendees = usersInGroup.filter(user => user.course_id === course.course_id).length;
      console.log(`👥 ${groupName} - ${course.course_name}: ${attendees} attendees`);

      const sessionsNeeded = Math.ceil(attendees / criteria.max_attendees) || 1;
      const duration = Number(course.duration_hrs);

      for (let i = 1; i <= sessionsNeeded; i++) {
        let sessionEndTime = new Date(currentSessionStartTime);
        sessionEndTime.setHours(sessionEndTime.getHours() + duration);

        // Parse time boundaries based on scheduling preference
        let endTimeAm, startTimePm, endTimePm;
        
        if ((schedulingPreference === 'both' || schedulingPreference === 'am_only') && criteria.end_time_am) {
          endTimeAm = new Date(currentSessionStartTime);
          endTimeAm.setHours(...criteria.end_time_am.split(':').map(Number), 0, 0);
        }

        if ((schedulingPreference === 'both' || schedulingPreference === 'pm_only') && criteria.start_time_pm) {
          startTimePm = new Date(currentSessionStartTime);
          startTimePm.setHours(...criteria.start_time_pm.split(':').map(Number), 0, 0);
        }

        if ((schedulingPreference === 'both' || schedulingPreference === 'pm_only') && criteria.end_time_pm) {
          endTimePm = new Date(currentSessionStartTime);
          endTimePm.setHours(...criteria.end_time_pm.split(':').map(Number), 0, 0);
        }

        // Handle time boundary checking based on scheduling preference
        if (schedulingPreference === 'both' && endTimeAm && startTimePm && sessionEndTime > endTimeAm && sessionEndTime < startTimePm) {
          sessionEndTime = new Date(startTimePm);
          sessionEndTime.setHours(sessionEndTime.getHours() + duration);
        } else if (schedulingPreference === 'am_only' && endTimeAm && sessionEndTime > endTimeAm) {
          // Move to next day for AM-only scheduling
          do {
            currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
          } while (!criteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));

          const [amStartHour, amStartMin] = criteria.start_time_am.split(':').map(Number);
          currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
          sessionEndTime = new Date(currentSessionStartTime);
          sessionEndTime.setHours(sessionEndTime.getHours() + duration);
        } else if (schedulingPreference === 'pm_only' && endTimePm && sessionEndTime > endTimePm) {
          // Move to next day for PM-only scheduling
          do {
            currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
          } while (!criteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));

          const [pmStartHour, pmStartMin] = criteria.start_time_pm.split(':').map(Number);
          currentSessionStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
          sessionEndTime = new Date(currentSessionStartTime);
          sessionEndTime.setHours(sessionEndTime.getHours() + duration);
        } else if (schedulingPreference === 'both' && endTimePm && sessionEndTime > endTimePm) {
          // Move to next day for both AM/PM scheduling
          do {
            currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
          } while (!criteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));

          const [amStartHour, amStartMin] = criteria.start_time_am.split(':').map(Number);
          currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
          sessionEndTime = new Date(currentSessionStartTime);
          sessionEndTime.setHours(sessionEndTime.getHours() + duration);
        }

        // Create title with scheduling preference indicator
        const sessionTitle = schedulingPreference === 'am_only' ? 
          `${course.course_name} - Session ${i} (AM) (${groupName}, ${groupingKeys})` :
          schedulingPreference === 'pm_only' ? 
          `${course.course_name} - Session ${i} (PM) (${groupName}, ${groupingKeys})` :
          `${course.course_name} - Session ${i} (${groupName}, ${groupingKeys})`;

        sessionsGrouped[functionalArea][groupName][classroomKey].push({
          title: sessionTitle,
          start: new Date(currentSessionStartTime),
          end: sessionEndTime,
          course,
          sessionNumber: i,
          groupType: groupingKeys,
          groupName,
          duration,
          functional_area: criteria.functionalArea,
          location: course.location || 'TBD',
        });

        currentSessionStartTime = new Date(sessionEndTime);
      }

      do {
        currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
      } while (!criteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));

      currentSessionStartTime.setHours(new Date(criteria.start_time_am).getHours(), 0, 0, 0);
    }
  }

  console.log('✅ sessionsGrouped:', sessionsGrouped);
  return sessionsGrouped;
};


// ✅ React Component for table view of training needs
const TrainingCalculations = ({ criteria, courses, endUsers, sessions }) => {
  const [calculations, setCalculations] = useState([]);

  const calculateRequirements = () => {
    if (!criteria || !courses?.length || !endUsers?.length) return [];

    const attendeesPerCourse = courses.reduce((acc, course) => {
      acc[course.id] = endUsers.filter(user => user.course_id === course.id).length;
      return acc;
    }, {});

    const totalHours = courses.reduce((sum, course) => {
      return sum + (Number(course.duration_hrs) * (attendeesPerCourse[course.id] || 0));
    }, 0);

    const available = Number(criteria.total_weeks) *
                      Number(criteria.days_per_week) *
                      Number(criteria.daily_hours) *
                      Number(criteria.contingency);

    const sessionsNeeded = Math.ceil(totalHours / (available * Number(criteria.max_attendees)));
    const classroomsNeeded = Math.ceil(sessionsNeeded / (Number(criteria.days_per_week) * Number(criteria.total_weeks)));

    return [
      { description: "Total Training Hours", total: totalHours },
      { description: "Available Hours", total: available.toFixed(1) },
      { description: "Classrooms Needed", total: classroomsNeeded },
      { description: "Total Sessions Required", total: sessionsNeeded }
    ];
  };

  useEffect(() => {
    if (courses?.length && endUsers?.length && criteria) {
      setCalculations(calculateRequirements());
    }
  }, [courses, endUsers, criteria]);

  return (
    <div className="training-calculations">
      <h2>Training Requirements Calculation</h2>
      <table className="calculations-table">
        <thead>
          <tr>
            <th>METRIC</th>
            <th>VALUE</th>
          </tr>
        </thead>
        <tbody>
          {calculations.map((calc, idx) => (
            <tr key={idx}>
              <td>{calc.description}</td>
              <td>{calc.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TrainingCalculations;
