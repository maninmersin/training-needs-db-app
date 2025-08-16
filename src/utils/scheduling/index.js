/**
 * Scheduling utilities barrel exports
 * 
 * Provides easy access to all scheduling utilities from a single import
 */

// Core engines
export { TimeBlockEngine, parseTimeToHours, calculateDuration } from './TimeBlockEngine.js';
export { SessionSplitter } from './SessionSplitter.js';

// Common utilities
export {
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
} from './SchedulingCore.js';

// Default export for convenience
export { default as SchedulingCore } from './SchedulingCore.js';