import { generateTrainingCalendar, downloadCalendarFile } from '@core/utils/calendarInviteGenerator';
import { debugLog, debugWarn, debugError } from '@core/utils/consoleUtils';

/**
 * Assignment Calendar Utilities
 * 
 * Extracted from StakeholderCalendarEditor for use in User Assignment screens.
 * Provides calendar generation and export functionality for training assignments.
 */

/**
 * Generate and download training calendar for assignments
 * @param {Object} schedule - The training schedule object
 * @param {Array} sessions - Array of training sessions (flat or nested)
 * @param {Array} assignments - Array of user assignments
 * @param {Function} setGeneratingCalendar - State setter for loading state
 * @param {Function} setCalendarError - State setter for error messages
 * @returns {Promise<void>}
 */
export const handleGenerateAssignmentCalendar = async (
  schedule,
  sessions,
  assignments,
  setGeneratingCalendar,
  setCalendarError
) => {
  try {
    setGeneratingCalendar(true);
    setCalendarError(null);
    
    debugLog('🗓️ Starting calendar generation for schedule:', schedule?.name);
    
    // Validate required data
    if (!schedule) {
      throw new Error('No schedule selected');
    }
    
    // Handle both flat sessions array and nested sessions object
    let flatSessions = sessions;
    if (sessions && typeof sessions === 'object' && !Array.isArray(sessions)) {
      flatSessions = flattenSessionsFromObject(sessions);
    }
    
    if (!flatSessions || flatSessions.length === 0) {
      throw new Error('No sessions found in schedule');
    }
    
    if (!assignments || assignments.length === 0) {
      throw new Error('No user assignments found. Please assign users to sessions first.');
    }
    
    // Generate calendar file
    const result = await generateTrainingCalendar(schedule, flatSessions, assignments);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Download the calendar file
    downloadCalendarFile(result.content, result.filename);
    
    debugLog('✅ Calendar generated and downloaded successfully:', {
      filename: result.filename,
      eventCount: result.eventCount,
      userCount: result.userCount
    });
    
    // Show success message briefly
    setCalendarError(`✅ Calendar downloaded: ${result.eventCount} sessions, ${result.userCount} users`);
    setTimeout(() => {
      setCalendarError(null);
    }, 3000);
    
  } catch (err) {
    debugError('❌ Error generating training calendar:', err);
    setCalendarError(err.message);
  } finally {
    setGeneratingCalendar(false);
  }
};

/**
 * Flatten nested sessions object into array
 * Handles the structure: functionalArea -> location -> classroom -> [sessions]
 * @param {Object} sessionsObject - Nested sessions object
 * @returns {Array} Flat array of sessions
 */
export const flattenSessionsFromObject = (sessionsObject) => {
  if (!sessionsObject || typeof sessionsObject !== 'object') {
    return [];
  }

  const flatSessions = [];
  
  // Structure: functionalArea -> location -> classroom -> [sessions]
  Object.entries(sessionsObject).forEach(([functionalArea, locationData]) => {
    if (locationData && typeof locationData === 'object') {
      Object.entries(locationData).forEach(([location, classroomData]) => {
        if (classroomData && typeof classroomData === 'object') {
          Object.entries(classroomData).forEach(([classroom, sessionsList]) => {
            if (Array.isArray(sessionsList)) {
              // Add classroom and location information to each session
              const sessionsWithMetadata = sessionsList.map(session => ({
                ...session,
                _classroom: classroom,
                classroom_name: classroom,
                functional_area: functionalArea,
                training_location: location
              }));
              flatSessions.push(...sessionsWithMetadata);
            }
          });
        }
      });
    }
  });

  debugLog('📊 Flattened sessions for calendar:', {
    inputStructure: Object.keys(sessionsObject),
    outputCount: flatSessions.length
  });

  return flatSessions;
};

/**
 * Validate calendar generation requirements
 * @param {Object} schedule - The training schedule
 * @param {Array} sessions - Array of sessions
 * @param {Array} assignments - Array of assignments
 * @returns {Object} {isValid, error}
 */
export const validateCalendarRequirements = (schedule, sessions, assignments) => {
  if (!schedule) {
    return { isValid: false, error: 'No schedule selected' };
  }
  
  let flatSessions = sessions;
  if (sessions && typeof sessions === 'object' && !Array.isArray(sessions)) {
    flatSessions = flattenSessionsFromObject(sessions);
  }
  
  if (!flatSessions || flatSessions.length === 0) {
    return { isValid: false, error: 'No sessions found in schedule' };
  }
  
  if (!assignments || assignments.length === 0) {
    return { isValid: false, error: 'No user assignments found. Please assign users to sessions first.' };
  }
  
  return { isValid: true };
};