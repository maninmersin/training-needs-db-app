/**
 * Complete by Group Scheduling Algorithm - REFACTORED VERSION
 * 
 * This algorithm ensures that each group completes ALL courses before the next group starts.
 * Groups can run in parallel if multiple classrooms are available, with proper sequential timing.
 * 
 * REFACTORED Logic:
 * - Group 1: Course A → Course B → Course C → Course D (in Classroom 1, starts immediately)
 * - Group 2: Course A → Course B → Course C → Course D (in Classroom 2, starts immediately if available)
 * - Group 3: Course A → Course B → Course C → Course D (in earliest available classroom, after Group 1 OR 2 completes)
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

export const scheduleByGroupComplete = async (
  groupedEndUsers, courses, currentCriteria, sessionsGrouped,
  functionalArea, locationClassroomReqs, classroomTracker,
  schedulingPreference, amStartHour, amStartMin, pmStartHour, pmStartMin,
  amBlockHours, pmBlockHours, dayNames
) => {
  console.log('🎯 Starting Group-Complete scheduling mode - REFACTORED');
  
  try {
    // Initialize scheduling engines with flexible time block parsing
    const { timeBlockEngine, sessionSplitter } = initializeSchedulingEngines(currentCriteria);
    
    // Sort courses by priority (lower number = higher priority)
    const sortedCourses = sortCoursesByPriority(courses);
    logCoursePriorityOrder(sortedCourses);
    
    for (const locationName in groupedEndUsers) {
      const usersInLocation = groupedEndUsers[locationName];
      const maxClassrooms = locationClassroomReqs.get(locationName)?.numberOfClassrooms || 1;
      
      console.log(`📍 Processing location: ${locationName} with ${maxClassrooms} classrooms`);
      
      // Calculate course group data for this location
      const courseGroupData = _calculateCourseGroupData(sortedCourses, usersInLocation, currentCriteria);
      const maxGroupsNeeded = Math.max(...Object.values(courseGroupData).map(data => data.groupsNeeded));
      
      console.log(`📊 Maximum groups needed across all courses: ${maxGroupsNeeded}`);
      
      // Initialize classroom states for sequential scheduling
      const classroomStates = _initializeClassroomStates(
        maxClassrooms, 
        currentCriteria, 
        timeBlockEngine, 
        dayNames
      );
      
      // Schedule each group sequentially through all courses
      for (let groupNum = 1; groupNum <= maxGroupsNeeded; groupNum++) {
        console.log(`\n📋 === Scheduling Group ${groupNum} ===`);
        
        // Find the classroom that becomes available earliest
        const assignedClassroom = _findEarliestAvailableClassroom(classroomStates);
        const currentGroupTime = new Date(classroomStates[assignedClassroom].currentTime);
        
        console.log(`   🏫 Assigned to Classroom ${assignedClassroom}, starting at ${currentGroupTime.toLocaleString('en-GB')}`);
        
        // Mark classroom as occupied for this group
        classroomStates[assignedClassroom].isOccupied = true;
        classroomStates[assignedClassroom].currentGroup = groupNum;
        
        // Schedule all courses for this group in priority order
        let groupCurrentTime = new Date(currentGroupTime);
        
        for (const course of sortedCourses) {
          const courseData = courseGroupData[course.course_id];
          if (!courseData || groupNum > courseData.groupsNeeded) {
            // This group doesn't need this course
            continue;
          }
          
          const groupData = courseData.groups[groupNum - 1];
          const duration = Number(course.duration_hrs);
          
          console.log(`   📝 Scheduling ${course.course_name} Group ${groupNum} (${groupData.userCount} attendees, ${duration}hrs)`);
          
          // Use SessionSplitter to handle flexible duration splitting
          const sessionParts = sessionSplitter.splitCourse(duration, {
            courseName: course.course_name,
            sessionNumber: groupNum,
            startDate: groupCurrentTime,
            dayNames: dayNames
          });
          
          console.log(`   ✂️ Course split into ${sessionParts.length} parts across ${sessionParts[sessionParts.length - 1].day} day(s)`);
          
          // CRITICAL FIX: Override SessionSplitter timing with our sequential timing
          let currentPartTime = new Date(groupCurrentTime);
          
          for (let i = 0; i < sessionParts.length; i++) {
            const sessionPart = sessionParts[i];
            
            // Override the session timing with our calculated sequential timing
            sessionPart.start = new Date(currentPartTime);
            sessionPart.end = new Date(currentPartTime.getTime() + (sessionPart.duration * 60 * 60 * 1000));
            
            // Ensure session starts on valid scheduling day
            const validStartDate = timeBlockEngine.getNextValidDate(sessionPart.start, dayNames);
            if (validStartDate.getTime() !== sessionPart.start.getTime()) {
              sessionPart.start = validStartDate;
              sessionPart.end = new Date(validStartDate.getTime() + (sessionPart.duration * 60 * 60 * 1000));
            }
            
            // Calculate next part timing
            if (i < sessionParts.length - 1) {
              currentPartTime = _advanceToNextSchedulingTime(sessionPart.end, timeBlockEngine, dayNames);
            }
          }
          
          // Create sessions for each part
          let allPartsScheduled = true;
          
          for (const sessionPart of sessionParts) {
            
            // Create enhanced group name
            const enhancedGroupName = createEnhancedGroupName(locationName, {
              userRange: groupData.userRange,
              classroomNumber: assignedClassroom,
              totalGroups: maxGroupsNeeded
            });
            
            // Create session object
            const sessionObj = createSessionObject(sessionPart, course, {
              groupName: enhancedGroupName,
              functionalArea: functionalArea,
              location: locationName,
              classroomNumber: assignedClassroom,
              groupType: ['training_location'],
              maxAttendees: currentCriteria.max_attendees,
              userCount: groupData.userCount,
              userRange: groupData.userRange,
              sessionNumber: groupNum
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
            
            console.log(`     ✅ Scheduled ${course.course_name} Group ${groupNum} Part ${sessionPart.part} in Classroom ${assignedClassroom}`);
            console.log(`        📅 ${sessionPart.start.toLocaleString('en-GB')} - ${sessionPart.end.toLocaleString('en-GB')} (${sessionPart.duration}hrs)`);
          }
          
          if (!allPartsScheduled) {
            console.log(`   ❌ Failed to schedule ${course.course_name} Group ${groupNum} - will need manual intervention`);
            continue;
          }
          
          // Advance time for next course in this group
          const lastPart = sessionParts[sessionParts.length - 1];
          groupCurrentTime = new Date(lastPart.end);
          
          // Move to next valid scheduling time
          groupCurrentTime = _advanceToNextSchedulingTime(
            groupCurrentTime, 
            timeBlockEngine, 
            dayNames
          );
          
          console.log(`   ⏰ Next course will start at: ${groupCurrentTime.toLocaleString('en-GB')}`);
        }
        
        // Update classroom state after group completion
        classroomStates[assignedClassroom].currentTime = new Date(groupCurrentTime);
        classroomStates[assignedClassroom].isOccupied = false;
        classroomStates[assignedClassroom].completedGroups.push(groupNum);
        classroomStates[assignedClassroom].currentGroup = null;
        
        console.log(`   ✅ Group ${groupNum} completed all courses in Classroom ${assignedClassroom}`);
        console.log(`   🕒 Classroom ${assignedClassroom} next available: ${classroomStates[assignedClassroom].currentTime.toLocaleString('en-GB')}`);
      }
    }
    
    console.log('✅ Group-Complete scheduling completed - REFACTORED');
    
  } catch (error) {
    console.error('❌ Error in Group-Complete scheduling:', error);
    throw error;
  }
};

/**
 * Calculate course group data for a location
 * @private
 */
function _calculateCourseGroupData(courses, usersInLocation, currentCriteria) {
  const courseGroupData = {};
  
  for (const course of courses) {
    const courseUsers = usersInLocation.filter(user => user.course_id === course.course_id);
    const attendees = courseUsers.length;
    
    if (attendees > 0) {
      const sessionGroups = createSessionGroups(courseUsers, currentCriteria.max_attendees);
      
      courseGroupData[course.course_id] = {
        course,
        totalAttendees: attendees,
        groupsNeeded: sessionGroups.length,
        groups: sessionGroups
      };
      
      console.log(`📚 ${course.course_name}: ${attendees} attendees = ${sessionGroups.length} groups`);
    }
  }
  
  return courseGroupData;
}

/**
 * Initialize classroom states for sequential scheduling
 * @private
 */
function _initializeClassroomStates(maxClassrooms, currentCriteria, timeBlockEngine, dayNames) {
  const classroomStates = {};
  
  for (let i = 1; i <= maxClassrooms; i++) {
    const startDate = timeBlockEngine.getNextValidDate(new Date(currentCriteria.start_date), dayNames);
    const startTime = timeBlockEngine.setDateToBlockStart(startDate, 1); // Start with first time block
    
    classroomStates[i] = {
      currentTime: startTime,
      isOccupied: false,
      currentGroup: null,
      completedGroups: []
    };
    
    console.log(`🏫 Classroom ${i} initialized, starts at: ${startTime.toLocaleString('en-GB')}`);
  }
  
  return classroomStates;
}

/**
 * Find the classroom that becomes available earliest
 * @private
 */
function _findEarliestAvailableClassroom(classroomStates) {
  let earliestClassroom = 1;
  let earliestTime = classroomStates[1].currentTime;
  
  for (const classroomNum in classroomStates) {
    const state = classroomStates[classroomNum];
    if (state.currentTime < earliestTime) {
      earliestTime = state.currentTime;
      earliestClassroom = parseInt(classroomNum);
    }
  }
  
  return earliestClassroom;
}

/**
 * Advance time to next valid scheduling time
 * @private
 */
function _advanceToNextSchedulingTime(currentTime, timeBlockEngine, dayNames) {
  // Check which time block the current time falls into
  const timeBlocks = timeBlockEngine.getTimeBlocks();
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinutes;
  
  // Find which block we're currently in or should start from
  let nextBlockId = null;
  let nextStartTime = null;
  
  for (const block of timeBlocks) {
    const blockStartMinutes = block.startHours * 60;
    const blockEndMinutes = block.endHours * 60;
    
    if (currentTimeInMinutes < blockStartMinutes) {
      // We're before this block starts, so start from this block
      nextBlockId = block.id;
      nextStartTime = new Date(currentTime);
      nextStartTime.setHours(block.startHours, 0, 0, 0);
      break;
    } else if (currentTimeInMinutes >= blockStartMinutes && currentTimeInMinutes < blockEndMinutes) {
      // We're currently in this block, move to next block
      const nextBlockIndex = timeBlocks.findIndex(b => b.id === block.id) + 1;
      if (nextBlockIndex < timeBlocks.length) {
        // Move to next block today
        const nextBlock = timeBlocks[nextBlockIndex];
        nextBlockId = nextBlock.id;
        nextStartTime = new Date(currentTime);
        nextStartTime.setHours(nextBlock.startHours, 0, 0, 0);
        break;
      } else {
        // No more blocks today, move to next day, first block
        const nextDay = new Date(currentTime);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextValidDate = timeBlockEngine.getNextValidDate(nextDay, dayNames);
        return timeBlockEngine.setDateToBlockStart(nextValidDate, 1);
      }
    }
  }
  
  // If we haven't found a next block, we're past all blocks today, move to next day
  if (!nextStartTime) {
    const nextDay = new Date(currentTime);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextValidDate = timeBlockEngine.getNextValidDate(nextDay, dayNames);
    return timeBlockEngine.setDateToBlockStart(nextValidDate, 1);
  }
  
  // Make sure the next start time is on a valid scheduling day
  const validNextDate = timeBlockEngine.getNextValidDate(nextStartTime, dayNames);
  if (validNextDate.getTime() !== nextStartTime.getTime()) {
    // The calculated time is not on a valid day, use the valid date with the same block
    return timeBlockEngine.setDateToBlockStart(validNextDate, nextBlockId);
  }
  
  return nextStartTime;
}

export default scheduleByGroupComplete;