/**
 * Complete by Course Scheduling Algorithm - REFACTORED VERSION
 * 
 * This algorithm schedules the same course across all locations before moving to the next course.
 * 
 * REFACTORED Logic:
 * - Course A: Schedule all groups across all locations (by priority)
 * - Course B: Schedule all groups across all locations (by priority)
 * - Course C: Schedule all groups across all locations (by priority)
 * - Course D: Schedule all groups across all locations (by priority)
 * 
 * Key Improvements:
 * 1. Uses TimeBlockEngine for flexible time block handling
 * 2. Uses SessionSplitter for intelligent course duration splitting
 * 3. Supports ANY course duration (1-24 hours) across 1-3 days
 * 4. No hardcoded duration logic
 * 5. Clean, maintainable code with utility functions
 */

import {
  initializeSchedulingEngines,
  sortCoursesByPriority,
  createSessionGroups,
  createSessionObject,
  formatSessionTitle,
  createEnhancedGroupName,
  logCoursePriorityOrder
} from '@core/utils/scheduling/index.js';

export const scheduleByCourseComplete = async (
  groupedEndUsers, courses, currentCriteria, sessionsGrouped,
  functionalAreaParam, locationClassroomReqs, classroomTracker,
  schedulingPreference, amStartHour, amStartMin, pmStartHour, pmStartMin,
  amBlockHours, pmBlockHours, dayNames
) => {
  console.log('🎯 Starting Course-Complete scheduling mode - REFACTORED');
  
  try {
    // Initialize scheduling engines with flexible time block parsing
    const { timeBlockEngine, sessionSplitter } = initializeSchedulingEngines(currentCriteria);
    
    // Sort courses by priority (lower number = higher priority)
    const sortedCourses = sortCoursesByPriority(courses);
    logCoursePriorityOrder(sortedCourses);
    
    // Initialize global scheduling time
    let globalCurrentTime = timeBlockEngine.getNextValidDate(new Date(currentCriteria.start_date), dayNames);
    globalCurrentTime = timeBlockEngine.setDateToBlockStart(globalCurrentTime, 1);
    
    console.log(`🚀 Starting Course-Complete scheduling at: ${globalCurrentTime.toLocaleString('en-GB')}`);
    
    // Process each course across all locations synchronously
    for (const course of sortedCourses) {
      console.log(`\n📚 === Processing course: ${course.course_name} across all locations ===`);
      
      const duration = Number(course.duration_hrs);
      console.log(`⏱️ Course duration: ${duration} hours`);
      
      // Collect all sessions needed for this course across all locations
      const courseLocationSessions = _collectCourseLocationSessions(
        course, 
        groupedEndUsers, 
        currentCriteria, 
        locationClassroomReqs
      );
      
      if (courseLocationSessions.length === 0) {
        console.log(`⚠️ No attendees for course ${course.course_name}, skipping`);
        continue;
      }
      
      // Schedule all sessions for this course using flexible duration splitting
      const courseSchedulingResult = await _scheduleAllCourseSessionsFlexibly(
        course,
        courseLocationSessions,
        globalCurrentTime,
        sessionsGrouped,
        functionalAreaParam,
        timeBlockEngine,
        sessionSplitter,
        classroomTracker,
        currentCriteria,
        dayNames
      );
      
      // Update global time to after all sessions for this course
      globalCurrentTime = courseSchedulingResult.nextAvailableTime;
      
      console.log(`✅ Course ${course.course_name} completed. Next course starts at: ${globalCurrentTime.toLocaleString('en-GB')}`);
    }
    
    console.log('✅ Course-Complete scheduling completed - REFACTORED');
    
  } catch (error) {
    console.error('❌ Error in Course-Complete scheduling:', error);
    throw error;
  }
};

/**
 * Collect all sessions needed for a course across all locations
 * @private
 */
function _collectCourseLocationSessions(course, groupedEndUsers, currentCriteria, locationClassroomReqs) {
  const courseLocationSessions = [];
  
  for (const groupName in groupedEndUsers) {
    const usersInGroup = groupedEndUsers[groupName];
    const courseUsers = usersInGroup.filter(user => user.course_id === course.course_id);
    const attendees = courseUsers.length;

    console.log(`\n🎯 Processing ${course.course_name} at ${groupName}:`);
    console.log(`   Total users in location: ${usersInGroup.length}`);
    console.log(`   Users for this course: ${attendees}`);
    console.log(`   Max attendees per session: ${currentCriteria.max_attendees}`);

    if (attendees > 0) {
      const sessionGroups = createSessionGroups(courseUsers, currentCriteria.max_attendees);
      const maxClassrooms = locationClassroomReqs.get(groupName)?.numberOfClassrooms || 1;

      console.log(`📍 Location ${groupName}: ${attendees} attendees, ${sessionGroups.length} sessions, ${maxClassrooms} classrooms`);
      
      courseLocationSessions.push({
        locationName: groupName,
        attendees,
        sessionGroups,
        maxClassrooms,
        courseUsers
      });
    }
  }
  
  return courseLocationSessions;
}

/**
 * Schedule all sessions for a course using per-location independent scheduling
 * @private
 */
async function _scheduleAllCourseSessionsFlexibly(
  course,
  courseLocationSessions,
  startTime,
  sessionsGrouped,
  functionalArea,
  timeBlockEngine,
  sessionSplitter,
  classroomTracker,
  currentCriteria,
  dayNames
) {
  const duration = Number(course.duration_hrs);
  
  console.log(`📊 Total sessions to schedule for ${course.course_name}: ${courseLocationSessions.reduce((sum, loc) => sum + loc.sessionGroups.length, 0)}`);
  
  // Schedule each location independently and concurrently
  const locationResults = [];
  
  for (const locationInfo of courseLocationSessions) {
    console.log(`\n🏢 Scheduling all ${course.course_name} groups at ${locationInfo.locationName}`);
    
    const locationResult = await _scheduleAllGroupsAtLocation(
      course,
      locationInfo,
      startTime,
      sessionsGrouped,
      functionalArea,
      timeBlockEngine,
      sessionSplitter,
      classroomTracker,
      currentCriteria,
      dayNames
    );
    
    locationResults.push(locationResult);
  }
  
  // Calculate the earliest next available time across all locations
  const nextAvailableTime = _calculateNextCourseStartTime(startTime, timeBlockEngine, dayNames);
  
  return {
    allSessionsScheduled: locationResults.every(result => result.allSessionsScheduled),
    nextAvailableTime,
    locationResults
  };
}

/**
 * Schedule all groups for a course at a specific location independently
 * @private
 */
async function _scheduleAllGroupsAtLocation(
  course,
  locationInfo,
  startTime,
  sessionsGrouped,
  functionalArea,
  timeBlockEngine,
  sessionSplitter,
  classroomTracker,
  currentCriteria,
  dayNames
) {
  const { locationName, sessionGroups, maxClassrooms } = locationInfo;
  const duration = Number(course.duration_hrs);
  let locationCurrentTime = new Date(startTime);
  let allGroupsScheduled = false;
  // CRITICAL FIX: Dynamic iteration limit based on number of sessions
  // Previously was fixed at 50, which could fail for schedules with many sessions
  const maxIterations = Math.max(100, sessionGroups.length * 20);
  let iterationCount = 0;

  console.log(`📍 Scheduling ${sessionGroups.length} groups at ${locationName} (${maxClassrooms} classrooms, max ${maxIterations} iterations)`);
  
  // Create list of sessions to schedule at this location
  const locationSessions = sessionGroups.map(sessionGroup => ({
    sessionGroup,
    scheduled: false
  }));
  
  // Schedule all groups at this location
  while (!allGroupsScheduled && iterationCount < maxIterations) {
    iterationCount++;
    console.log(`🔄 Location scheduling round ${iterationCount} for ${locationName} at ${locationCurrentTime.toLocaleString('en-GB')}`);
    
    let scheduledThisRound = false;
    
    // Try to schedule unscheduled groups at current time
    for (const sessionInfo of locationSessions) {
      if (sessionInfo.scheduled) continue;
      
      const { sessionGroup } = sessionInfo;
      console.log(`   📝 Attempting ${course.course_name} Group ${sessionGroup.sessionNumber} at ${locationName}`);
      
      const schedulingResult = await _scheduleGroupAtLocation(
        course,
        sessionGroup,
        locationName,
        maxClassrooms,
        locationCurrentTime,
        sessionsGrouped,
        functionalArea,
        timeBlockEngine,
        sessionSplitter,
        classroomTracker,
        currentCriteria,
        dayNames
      );
      
      if (schedulingResult.success) {
        sessionInfo.scheduled = true;
        scheduledThisRound = true;
        console.log(`   ✅ Successfully scheduled ${course.course_name} Group ${sessionGroup.sessionNumber} at ${locationName}`);
      }
    }
    
    // Check if all groups are scheduled
    allGroupsScheduled = locationSessions.every(session => session.scheduled);
    
    if (!allGroupsScheduled) {
      if (scheduledThisRound) {
        // Some progress made, continue with current time to fill remaining classroom capacity
        console.log(`   🔄 Continuing at current time to maximize classroom utilization`);
      } else {
        // No progress made, advance time for this location
        console.log(`   ⏰ No groups scheduled this round at ${locationName}, advancing time`);
        locationCurrentTime = _advanceToNextValidTime(locationCurrentTime, timeBlockEngine, dayNames);
        console.log(`   📅 ${locationName} advanced to: ${locationCurrentTime.toLocaleString('en-GB')}`);
      }
    }
  }
  
  // CRITICAL FIX: Error handling for incomplete scheduling
  const scheduledCount = locationSessions.filter(s => s.scheduled).length;

  if (!allGroupsScheduled) {
    const unscheduledSessions = locationSessions
      .filter(s => !s.scheduled)
      .map(s => `Group ${s.sessionGroup.sessionNumber}`)
      .join(', ');

    console.error(`❌ FAILED to schedule all sessions at ${locationName}`);
    console.error(`   Scheduled: ${scheduledCount}/${sessionGroups.length}`);
    console.error(`   Unscheduled: ${unscheduledSessions}`);
    console.error(`   Iterations used: ${iterationCount}/${maxIterations}`);

    if (iterationCount >= maxIterations) {
      console.error(`   Reason: Reached maximum iterations limit`);
    }

    throw new Error(
      `Failed to schedule all sessions for "${course.course_name}" at ${locationName}.\n\n` +
      `Scheduled: ${scheduledCount}/${sessionGroups.length} sessions (missing: ${unscheduledSessions})\n\n` +
      `This usually means there aren't enough available time slots in your schedule.\n\n` +
      `Try one of these solutions:\n` +
      `• Increase "Total Weeks" in Stage 1\n` +
      `• Add more "Scheduling Days" (e.g., include Friday or Saturday)\n` +
      `• Reduce "Daily Hours" to allow more scheduling flexibility\n` +
      `• Reduce "Max Attendees" to create fewer, smaller sessions`
    );
  }

  console.log(`✅ ${locationName} completed: ${scheduledCount}/${sessionGroups.length} groups scheduled`);

  return {
    allSessionsScheduled: allGroupsScheduled,
    scheduledCount,
    totalGroups: sessionGroups.length
  };
}

/**
 * Schedule a single group at a location
 * @private
 */
async function _scheduleGroupAtLocation(
  course,
  sessionGroup,
  locationName,
  maxClassrooms,
  currentTime,
  sessionsGrouped,
  functionalArea,
  timeBlockEngine,
  sessionSplitter,
  classroomTracker,
  currentCriteria,
  dayNames
) {
  const duration = Number(course.duration_hrs);
  
  // Use SessionSplitter to handle flexible duration splitting
  let sessionParts = sessionSplitter.splitCourse(duration, {
    courseName: course.course_name,
    sessionNumber: sessionGroup.sessionNumber,
    startDate: currentTime,
    dayNames: dayNames
  });
  
  console.log(`   ✂️ Course split into ${sessionParts.length} parts across ${sessionParts[sessionParts.length - 1].day} day(s)`);
  
  // Check if all parts can be scheduled at this location
  let canScheduleAllParts = true;
  let schedulingPlan = [];
  
  // For single-block courses, try alternative time blocks if the first choice fails
  if (sessionParts.length === 1 && sessionParts[0].totalParts === 1) {
    const timeBlocks = timeBlockEngine.getTimeBlocks();
    let triedBlocks = [];
    
    for (const timeBlock of timeBlocks) {
      // Skip if this block can't fit the duration
      if (timeBlock.duration < duration) continue;
      
      // Skip if we already tried this block
      if (triedBlocks.includes(timeBlock.id)) continue;
      triedBlocks.push(timeBlock.id);
      
      // Create session part for this time block
      const sessionDate = timeBlockEngine.getNextValidDate(currentTime, dayNames);
      const sessionStart = timeBlockEngine.setDateToBlockStart(sessionDate, timeBlock.id);
      const sessionEnd = new Date(sessionStart.getTime() + (duration * 60 * 60 * 1000));
      
      const testSessionPart = {
        part: 1,
        totalParts: 1,
        day: 1,
        totalDays: 1,
        start: sessionStart,
        end: sessionEnd,
        duration: duration,
        blockId: timeBlock.id,
        blockName: timeBlock.name,
        title: `${course.course_name} - Group ${sessionGroup.sessionNumber}`,
        sessionId: `${course.course_name.replace(/\s+/g, '-').toLowerCase()}-${sessionGroup.sessionNumber}-part1-${sessionStart.getTime()}`
      };
      
      // Check classroom availability for this time block
      const isAvailable = classroomTracker.isClassroomAvailable(
        locationName,
        testSessionPart.start,
        testSessionPart.end,
        maxClassrooms
      );
      
      if (isAvailable) {
        // Found an available time block
        sessionParts = [testSessionPart];
        schedulingPlan = [testSessionPart];
        canScheduleAllParts = true;
        console.log(`   ✅ Found available time slot in ${timeBlock.name} (Block ${timeBlock.id})`);
        break;
      } else {
        console.log(`   ⚠️ No classroom available for ${timeBlock.name} (Block ${timeBlock.id}) during ${sessionStart.toLocaleString('en-GB')}`);
        canScheduleAllParts = false;
      }
    }
  } else {
    // Multi-part courses: check all parts
    for (const sessionPart of sessionParts) {
      // Ensure session starts on valid scheduling day
      const validStartDate = timeBlockEngine.getNextValidDate(sessionPart.start, dayNames);
      if (validStartDate.getTime() !== sessionPart.start.getTime()) {
        sessionPart.start = validStartDate;
        sessionPart.end = new Date(validStartDate.getTime() + (sessionPart.duration * 60 * 60 * 1000));
      }
      
      // Check classroom availability using existing tracker
      const isAvailable = classroomTracker.isClassroomAvailable(
        locationName,
        sessionPart.start,
        sessionPart.end,
        maxClassrooms
      );
      
      if (!isAvailable) {
        console.log(`   ⚠️ No classroom available for Part ${sessionPart.part} during ${sessionPart.start.toLocaleString('en-GB')}`);
        canScheduleAllParts = false;
        break;
      }
      
      schedulingPlan.push(sessionPart);
    }
  }
  
  if (!canScheduleAllParts) {
    return { success: false };
  }
  
  // Schedule all parts
  for (let partIndex = 0; partIndex < schedulingPlan.length; partIndex++) {
    const sessionPart = schedulingPlan[partIndex];
    
    // Reserve classroom
    const assignedClassroom = classroomTracker.reserveClassroom(
      locationName,
      sessionPart.start,
      sessionPart.end,
      sessionPart.sessionId,
      maxClassrooms
    );
    
    if (assignedClassroom === null) {
      console.error(`❌ Failed to reserve classroom for ${sessionPart.sessionId} despite availability check`);
      return { success: false };
    }
    
    // Create enhanced group name
    const enhancedGroupName = createEnhancedGroupName(locationName, {
      userRange: sessionGroup.userRange,
      classroomNumber: assignedClassroom,
      totalGroups: 1 // Will be updated by calling function if needed
    });
    
    // Create session object
    const sessionObj = createSessionObject(sessionPart, course, {
      groupName: enhancedGroupName,
      functionalArea: functionalArea,
      location: locationName,
      classroomNumber: assignedClassroom,
      groupType: ['training_location'],
      maxAttendees: currentCriteria.max_attendees,
      userCount: sessionGroup.userCount,
      userRange: sessionGroup.userRange,
      sessionNumber: sessionGroup.sessionNumber
    });
    
    // Ensure structure exists in sessionsGrouped
    if (!sessionsGrouped[functionalArea]) {
      sessionsGrouped[functionalArea] = {};
    }
    if (!sessionsGrouped[functionalArea][locationName]) {
      sessionsGrouped[functionalArea][locationName] = {};
    }
    
    const classroomKey = `Classroom ${assignedClassroom}`;
    if (!sessionsGrouped[functionalArea][locationName][classroomKey]) {
      sessionsGrouped[functionalArea][locationName][classroomKey] = [];
    }
    
    sessionsGrouped[functionalArea][locationName][classroomKey].push(sessionObj);
    
    console.log(`     ✅ Scheduled ${course.course_name} Group ${sessionGroup.sessionNumber} Part ${sessionPart.part} in Classroom ${assignedClassroom}`);
    console.log(`        📅 ${sessionPart.start.toLocaleString('en-GB')} - ${sessionPart.end.toLocaleString('en-GB')} (${sessionPart.duration}hrs)`);
  }
  
  return { success: true };
}

/**
 * Advance to next valid scheduling time
 * @private
 */
function _advanceToNextValidTime(currentTime, timeBlockEngine, dayNames) {
  // Move to next day
  const nextDate = new Date(currentTime);
  nextDate.setDate(nextDate.getDate() + 1);
  
  // Find next valid scheduling day
  const validNextDate = timeBlockEngine.getNextValidDate(nextDate, dayNames);
  
  // Set to start of first time block
  return timeBlockEngine.setDateToBlockStart(validNextDate, 1);
}

/**
 * Calculate when the next course should start
 * @private
 */
function _calculateNextCourseStartTime(currentTime, timeBlockEngine, dayNames) {
  // Move to next valid day for next course
  const nextDate = new Date(currentTime);
  nextDate.setDate(nextDate.getDate() + 1);
  
  const validNextDate = timeBlockEngine.getNextValidDate(nextDate, dayNames);
  return timeBlockEngine.setDateToBlockStart(validNextDate, 1);
}

export default scheduleByCourseComplete;