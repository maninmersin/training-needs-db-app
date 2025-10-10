/**
 * SchedulingCore - Common utilities and validation for scheduling system
 * 
 * Provides shared functions used across the scheduling algorithms,
 * including session object creation, validation, and utility functions.
 */

import { TimeBlockEngine } from './TimeBlockEngine.js';
import { SessionSplitter } from './SessionSplitter.js';

/**
 * Create a standardized session object
 * @param {Object} sessionPart - Session part from SessionSplitter
 * @param {Object} course - Course object
 * @param {Object} options - Additional options
 * @returns {Object} Standardized session object
 */
export const createSessionObject = (sessionPart, course, options = {}) => {
  const {
    groupName = 'Unknown Group',
    functionalArea = 'General',
    location = 'Unknown Location',
    classroomNumber = 1,
    groupType = ['training_location'],
    maxAttendees = 10,
    userCount = 0,
    userRange = '1-1'
  } = options;
  
  return {
    // Session identification
    sessionId: sessionPart.sessionId,
    title: sessionPart.title,
    
    // Timing
    start: sessionPart.start,
    end: sessionPart.end,
    duration: sessionPart.duration,
    
    // Course information
    course: {
      course_id: course.course_id,
      course_name: course.course_name,
      duration_hrs: course.duration_hrs,
      priority: course.priority || 999
    },
    
    // Session metadata
    sessionNumber: options.sessionNumber || 1,
    sessionPartNumber: sessionPart.part,
    partSuffix: sessionPart.part > 1 ? `Part ${sessionPart.part}` : '',
    
    // Multi-day tracking (names match database fields and scheduleService expectations)
    totalParts: sessionPart.totalParts,
    totalDays: sessionPart.totalDays,
    daySequence: sessionPart.day,
    isMultiDay: sessionPart.totalDays > 1,
    
    // Location and grouping
    groupType: groupType,
    groupName: groupName,
    functional_area: functionalArea,
    location: location,
    classroomNumber: classroomNumber,
    
    // Capacity
    maxAttendees: maxAttendees,
    userCount: userCount,
    userRange: userRange,
    
    // Time block information
    blockId: sessionPart.blockId,
    blockName: sessionPart.blockName
  };
};

/**
 * Validate scheduling criteria
 * @param {Object} criteria - Scheduling criteria object
 * @returns {Object} Validation result
 */
export const validateSchedulingCriteria = (criteria) => {
  const errors = [];
  const warnings = [];
  
  // Required fields
  const requiredFields = [
    'start_date',
    'max_attendees',
    'scheduling_preference',
    'scheduling_days'
  ];
  
  requiredFields.forEach(field => {
    if (!criteria[field]) {
      errors.push(`Missing required criteria field: ${field}`);
    }
  });
  
  // Time block validation based on preference
  const preference = criteria.scheduling_preference || 'both';
  
  if (preference === 'both' || preference === 'am_only') {
    if (!criteria.start_time_am || !criteria.end_time_am) {
      errors.push('Block 1 times required for current scheduling preference');
    }
  }
  
  if (preference === 'both' || preference === 'pm_only') {
    if (!criteria.start_time_pm || !criteria.end_time_pm) {
      errors.push('Block 2 times required for current scheduling preference');
    }
  }
  
  // Scheduling days validation
  if (Array.isArray(criteria.scheduling_days) && criteria.scheduling_days.length === 0) {
    errors.push('At least one scheduling day must be selected');
  }
  
  // Max attendees validation
  if (criteria.max_attendees && criteria.max_attendees < 1) {
    errors.push('Maximum attendees must be at least 1');
  }
  
  // Date validation
  if (criteria.start_date) {
    const startDate = new Date(criteria.start_date);
    if (isNaN(startDate.getTime())) {
      errors.push('Invalid start date format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Sort courses by priority (lower number = higher priority)
 * @param {Array} courses - Array of course objects
 * @returns {Array} Sorted courses
 */
export const sortCoursesByPriority = (courses) => {
  return [...courses].sort((a, b) => {
    const aPriority = a.priority || 999;
    const bPriority = b.priority || 999;
    return aPriority - bPriority;
  });
};

/**
 * Group users by specified keys
 * @param {Array} users - Array of user objects
 * @param {Array} groupingKeys - Keys to group by
 * @returns {Object} Grouped users
 */
export const groupUsersByKeys = (users, groupingKeys) => {
  return users.reduce((groups, user) => {
    const key = groupingKeys
      .map(k => user[k]?.toString().trim() || 'Unknown')
      .join('|');
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(user);
    
    return groups;
  }, {});
};

/**
 * Calculate sessions needed for a course and group
 * @param {Array} users - Users requiring the course
 * @param {number} maxAttendees - Maximum attendees per session
 * @returns {number} Number of sessions needed
 */
export const calculateSessionsNeeded = (users, maxAttendees) => {
  if (!users.length || maxAttendees < 1) return 0;
  return Math.ceil(users.length / maxAttendees);
};

/**
 * Create session groups for a course
 * @param {Array} users - Users requiring the course
 * @param {number} maxAttendees - Maximum attendees per session
 * @returns {Array} Array of session groups
 */
export const createSessionGroups = (users, maxAttendees) => {
  const groups = [];
  const sessionsNeeded = calculateSessionsNeeded(users, maxAttendees);
  
  for (let sessionNum = 1; sessionNum <= sessionsNeeded; sessionNum++) {
    const startIndex = (sessionNum - 1) * maxAttendees;
    const endIndex = Math.min(sessionNum * maxAttendees, users.length);
    const sessionUsers = users.slice(startIndex, endIndex);
    
    groups.push({
      sessionNumber: sessionNum,
      users: sessionUsers,
      userCount: sessionUsers.length,
      userRange: `${startIndex + 1}-${endIndex}`
    });
  }
  
  return groups;
};

/**
 * Initialize scheduling engines
 * @param {Object} criteria - Scheduling criteria
 * @returns {Object} Initialized engines
 */
export const initializeSchedulingEngines = (criteria) => {
  try {
    const timeBlockEngine = new TimeBlockEngine(criteria);
    const sessionSplitter = new SessionSplitter(timeBlockEngine);
    
    // Validate configuration
    const validation = timeBlockEngine.validate();
    if (!validation.isValid) {
      throw new Error(`TimeBlock configuration invalid: ${validation.errors.join(', ')}`);
    }
    
    return {
      timeBlockEngine,
      sessionSplitter,
      validation
    };
  } catch (error) {
    console.error('❌ Failed to initialize scheduling engines:', error);
    throw error;
  }
};

/**
 * Log course priority order for debugging
 * @param {Array} courses - Sorted courses array
 * @param {string} prefix - Log prefix
 */
export const logCoursePriorityOrder = (courses, prefix = '📋 Courses ordered by priority') => {
  console.log(prefix + ':');
  courses.forEach(course => {
    console.log(`  ${course.course_name} (Priority: ${course.priority || 'default'})`);
  });
};

/**
 * Create enhanced group name for sessions
 * @param {string} baseGroupName - Base group name (e.g., location)
 * @param {Object} options - Additional naming options
 * @returns {string} Enhanced group name
 */
export const createEnhancedGroupName = (baseGroupName, options = {}) => {
  const {
    userRange = '',
    classroomNumber = 1,
    totalGroups = 1
  } = options;
  
  if (totalGroups > 1 && userRange) {
    return `${baseGroupName} Group ${userRange} Classroom ${classroomNumber}`;
  } else if (classroomNumber > 1) {
    return `${baseGroupName} Classroom ${classroomNumber}`;
  }
  
  return baseGroupName;
};

/**
 * Format session title with consistent naming
 * @param {string} courseName - Course name
 * @param {number} sessionNumber - Session number
 * @param {Object} sessionPart - Session part object
 * @param {string} groupName - Group name
 * @returns {string} Formatted session title
 */
export const formatSessionTitle = (courseName, sessionNumber, sessionPart, groupName) => {
  let title = `${courseName} - Group ${sessionNumber}`;
  
  if (sessionPart.totalParts > 1) {
    title += ` Part ${sessionPart.part}`;
  }
  
  if (groupName) {
    title += ` (${groupName})`;
  }
  
  return title;
};

/**
 * Validate session schedule for conflicts
 * @param {Array} sessions - Array of session objects
 * @returns {Object} Validation result with conflicts
 */
export const validateSessionSchedule = (sessions) => {
  const conflicts = [];
  const warnings = [];
  
  // Group sessions by location and classroom
  const sessionsByClassroom = {};
  
  sessions.forEach(session => {
    const key = `${session.location}-${session.classroomNumber}`;
    if (!sessionsByClassroom[key]) {
      sessionsByClassroom[key] = [];
    }
    sessionsByClassroom[key].push(session);
  });
  
  // Check for time conflicts within each classroom
  Object.entries(sessionsByClassroom).forEach(([classroomKey, classroomSessions]) => {
    const sortedSessions = classroomSessions.sort((a, b) => a.start.getTime() - b.start.getTime());
    
    for (let i = 0; i < sortedSessions.length - 1; i++) {
      const current = sortedSessions[i];
      const next = sortedSessions[i + 1];
      
      if (current.end > next.start) {
        conflicts.push({
          type: 'TIME_OVERLAP',
          classroom: classroomKey,
          session1: {
            title: current.title,
            start: current.start,
            end: current.end
          },
          session2: {
            title: next.title,
            start: next.start,
            end: next.end
          }
        });
      }
    }
  });
  
  // Check for very short sessions
  sessions.forEach(session => {
    if (session.duration < 0.5) {
      warnings.push({
        type: 'SHORT_SESSION',
        session: session.title,
        duration: session.duration
      });
    }
  });
  
  return {
    isValid: conflicts.length === 0,
    conflicts,
    warnings,
    totalSessions: sessions.length,
    totalClassrooms: Object.keys(sessionsByClassroom).length
  };
};

export default {
  createSessionObject,
  validateSchedulingCriteria,
  sortCoursesByPriority,
  groupUsersByKeys,
  calculateSessionsNeeded,
  createSessionGroups,
  initializeSchedulingEngines,
  logCoursePriorityOrder,
  createEnhancedGroupName,
  formatSessionTitle,
  validateSessionSchedule
};