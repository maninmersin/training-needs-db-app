import { supabase } from './supabaseClient';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import { fromLocalDateTime, toLocalDateTime as toLocalDateTimeUtil } from '@core/utils/dateTimeUtils';

/**
 * Service layer for training schedule and session database operations
 * Handles all CRUD operations for schedules and sessions
 */

/**
 * Generate stable session identifier for matching sessions across updates
 * CRITICAL: Identifier must be stable across time changes (drag operations)
 * and unique for each session part
 */
const generateStableSessionId = (session) => {
  const courseId = session.course?.course_id || session.course_id || 'unknown';
  const sessionNumber = session.sessionNumber || session.session_number || 1;
  const groupName = ((session.groupName || session.group_name || 'default') + '').replace(/\s+/g, '-').toLowerCase();
  const functionalArea = ((session.functionalArea || session.functional_area || 'general') + '').replace(/\s+/g, '-').toLowerCase();

  // CRITICAL: ALWAYS include part number to ensure unique identifiers for each session part
  let partSuffix = '';

  // First try to use session_part_number field (most reliable)
  if (session.session_part_number) {
    partSuffix = `-part${session.session_part_number}`;
  } else if (session.sessionPartNumber) {
    partSuffix = `-part${session.sessionPartNumber}`;
  } else {
    // Fallback: Extract from title
    const title = session.title || session.session_title || '';
    if (title && typeof title === 'string' && title.includes('Part ')) {
      const partMatch = title.match(/Part (\d+)/);
      if (partMatch) {
        // ALWAYS include part number - this ensures Part 1, Part 2, Part 3 all have unique IDs
        partSuffix = `-part${partMatch[1]}`;
      }
    }
  }

  // DON'T include timestamp - this was causing bugs where identifiers changed on drag!
  // The identifier must be stable across time changes to preserve user assignments
  return `${courseId}-session${sessionNumber}-${groupName}-${functionalArea}${partSuffix}`;
};

// Export for use in AddCourseToScheduleModal
export { generateStableSessionId };

/**
 * Calculate scheduled end date from criteria
 * @param {Object} criteria - The scheduling criteria
 * @returns {string} End date in YYYY-MM-DD format
 */
const calculateScheduledEndDate = (criteria) => {
  if (!criteria.start_date || !criteria.total_weeks) {
    return null;
  }

  const startDate = new Date(criteria.start_date);
  const schedulingDaysPerWeek = criteria.scheduling_days ? criteria.scheduling_days.length : 5;
  
  // Calculate total calendar days needed
  // This is an approximation - for exact calculation we'd need to count only valid scheduling days
  const totalCalendarDays = (criteria.total_weeks * 7) + 7; // Add buffer week for safety
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalCalendarDays);
  
  return endDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
};

/**
 * Save training schedule to database
 * @param {Object} currentCriteria - The scheduling criteria
 * @param {string} functionalArea - The functional area
 * @param {string|null} scheduleName - Optional custom schedule name
 * @param {string} projectId - The project ID this schedule belongs to
 * @returns {Promise<string>} The schedule ID
 */
export const saveTrainingSchedule = async (currentCriteria, functionalArea, scheduleName = null, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all schedule operations');
  }
  try {
    // Clean, minimal schedule object that matches your database structure
    const schedule = {
      name: scheduleName || `Generated schedule for ${functionalArea}`,
      description: `Generated schedule for ${functionalArea}`,
      version: "1.0",
      criteria: JSON.stringify(currentCriteria),
      status: 'active',
      scheduled_start_date: currentCriteria.start_date,
      scheduled_end_date: calculateScheduledEndDate(currentCriteria),
      notes: `Created via TSC Wizard with ${currentCriteria.scheduling_mode || 'course_complete'} scheduling mode`,
      functional_areas: [functionalArea],
      training_locations: currentCriteria.selected_training_locations || [],
      project_id: projectId // Project isolation
    };

    const { data, error } = await supabase
      .from('training_schedules')
      .insert([schedule])
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving schedule:', error);
      throw error;
    }

    console.log(`✅ Schedule saved with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('❌ Error in saveTrainingSchedule:', error);
    throw error;
  }
};

/**
 * Save existing schedule as a new schedule (copy)
 * @param {string} originalScheduleId - The original schedule ID to copy
 * @param {string} newScheduleName - Name for the new schedule
 * @param {string} newDescription - Optional description for the new schedule
 * @param {string} projectId - The project ID this schedule belongs to
 * @returns {Promise<Object>} The new schedule data
 */
export const saveScheduleAs = async (originalScheduleId, newScheduleName, newDescription = null, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all schedule operations');
  }
  try {
    console.log(`📋 Creating copy of schedule ${originalScheduleId} as "${newScheduleName}"`);
    
    // Step 1: Load the original schedule (with project context)
    const originalSchedule = await loadTrainingSchedule(originalScheduleId, projectId);
    
    // Step 2: Create the new schedule record
    const newScheduleData = {
      name: newScheduleName,
      description: newDescription || `Copy of ${originalSchedule.name}`,
      version: "1.0",
      criteria: originalSchedule.criteria, // Preserve original criteria
      status: 'active',
      scheduled_start_date: originalSchedule.scheduled_start_date,
      scheduled_end_date: originalSchedule.scheduled_end_date,
      notes: `Copied from "${originalSchedule.name}" on ${new Date().toLocaleDateString('en-GB')}`,
      functional_areas: originalSchedule.functional_areas,
      training_locations: originalSchedule.training_locations,
      project_id: projectId // Project isolation
    };

    const { data: newSchedule, error: scheduleError } = await supabase
      .from('training_schedules')
      .insert([newScheduleData])
      .select()
      .single();

    if (scheduleError) {
      console.error('❌ Error creating new schedule:', scheduleError);
      throw scheduleError;
    }

    console.log(`✅ New schedule created with ID: ${newSchedule.id}`);

    // Step 3: Load and copy all sessions from the original schedule (with project filter)
    const { data: originalSessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('schedule_id', originalScheduleId)
      .eq('project_id', projectId)
      .order('start_datetime');

    if (sessionsError) {
      console.error('❌ Error loading original sessions:', sessionsError);
      throw sessionsError;
    }

    if (originalSessions && originalSessions.length > 0) {
      // Step 4: Create new sessions with the new schedule_id
      const newSessions = originalSessions.map(session => {
        const { id, created_at, updated_at, ...sessionData } = session; // Remove old IDs and timestamps
        return {
          ...sessionData,
          schedule_id: newSchedule.id, // Link to new schedule
          project_id: projectId, // Project isolation
          notes: session.notes ? `${session.notes} (Copied from original schedule)` : 'Copied from original schedule'
        };
      });

      const { data: copiedSessions, error: copyError } = await supabase
        .from('training_sessions')
        .insert(newSessions)
        .select();

      if (copyError) {
        console.error('❌ Error copying sessions:', copyError);
        throw copyError;
      }

      console.log(`✅ Successfully copied ${copiedSessions.length} sessions to new schedule`);
    }

    return {
      schedule: newSchedule,
      sessionCount: originalSessions?.length || 0,
      originalScheduleName: originalSchedule.name
    };

  } catch (error) {
    console.error('❌ Error in saveScheduleAs:', error);
    throw error;
  }
};

/**
 * Update existing training schedule
 * @param {string} scheduleId - The schedule ID to update
 * @param {Object} updates - The updates to apply
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Object>} The updated schedule
 */
export const updateTrainingSchedule = async (scheduleId, updates, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all schedule operations');
  }
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('training_schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating schedule:', error);
      throw error;
    }

    console.log(`✅ Schedule updated: ${scheduleId}`);
    return data;
  } catch (error) {
    console.error('❌ Error in updateTrainingSchedule:', error);
    throw error;
  }
};

/**
 * Save training sessions to database
 * @param {Object} sessionsGrouped - The grouped sessions structure
 * @param {string} scheduleId - The parent schedule ID
 * @param {string} functionalArea - The functional area
 * @param {Object} currentCriteria - The scheduling criteria
 * @param {string} projectId - The project ID this session belongs to
 * @returns {Promise<Array>} Array of saved sessions
 */
export const saveTrainingSessionsForSchedule = async (sessionsGrouped, scheduleId, functionalArea, currentCriteria, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all session operations');
  }

  console.log('💾 saveTrainingSessionsForSchedule called with sessions:', {
    functionalArea,
    scheduleId,
    sessionGroups: Object.keys(sessionsGrouped),
    sampleSession: Object.values(Object.values(Object.values(sessionsGrouped)[0] || {})[0] || {})[0]?.[0]
  });

  try {
    const sessionsToInsert = [];

    // Check if we have the expected structure
    if (!sessionsGrouped[functionalArea]) {
      // Try to use the first available functional area if exact match not found
      const availableAreas = Object.keys(sessionsGrouped);
      if (availableAreas.length > 0) {
        functionalArea = availableAreas[0];
      } else {
        console.error('❌ No sessions found in any functional area');
        return [];
      }
    }
    
    // Iterate through the structure: functional_area -> training_location -> classroom -> [sessions]
    for (const trainingLocation in sessionsGrouped[functionalArea]) {
      for (const classroomKey in sessionsGrouped[functionalArea][trainingLocation]) {
        const sessions = sessionsGrouped[functionalArea][trainingLocation][classroomKey];
        const classroomNumber = classroomKey.replace('Classroom ', ''); // Extract just the number
        
        for (const session of sessions) {
          // Get session part number from session object or calculate from title
          let sessionPartNumber = session.sessionPartNumber || 1;
          const sessionTitle = session.title || session.session_title || '';
          if (sessionPartNumber === 1 && sessionTitle && typeof sessionTitle === 'string' && sessionTitle.includes('Part ')) {
            const partMatch = sessionTitle.match(/Part (\d+)/);
            if (partMatch) {
              sessionPartNumber = parseInt(partMatch[1]);
            }
          }
          
          // Extract clean training location and functional area from compound key
          let cleanTrainingLocation = trainingLocation;
          let cleanFunctionalArea = functionalArea;
          
          // Check if trainingLocation contains compound key (location|functional_area)
          if (trainingLocation && trainingLocation.includes('|')) {
            const parts = trainingLocation.split('|');
            cleanTrainingLocation = parts[0].trim(); // e.g., "UK Training Centre"
            cleanFunctionalArea = parts[1].trim();   // e.g., "Stores"
            console.log(`🔧 DATA CLEANUP: Split compound key "${trainingLocation}" -> location: "${cleanTrainingLocation}", functional_area: "${cleanFunctionalArea}"`);
          }
          
          // CRITICAL: Build session data object with all necessary fields for generateStableSessionId
          const sessionWithPartNumber = {
            ...session,
            session_part_number: sessionPartNumber,
            functionalArea: cleanFunctionalArea
          };

          // DEBUG: Log session times BEFORE conversion
          console.log(`💾 Processing session ${session.course.course_name} - Part ${sessionPartNumber}:`, {
            startDate: session.start,
            startHours: session.start.getHours(),
            startMinutes: session.start.getMinutes(),
            endDate: session.end,
            endHours: session.end.getHours(),
            endMinutes: session.end.getMinutes()
          });

          const sessionData = {
            schedule_id: scheduleId,
            project_id: projectId, // Project isolation
            course_id: session.course.course_id,
            course_name: session.course.course_name,
            session_number: session.sessionNumber,
            session_title: session.title,
            session_part_number: sessionPartNumber,
            classroom_number: classroomNumber,
            training_location: cleanTrainingLocation,
            functional_area: cleanFunctionalArea,
            start_datetime: toLocalDateTimeUtil(session.start),
            end_datetime: toLocalDateTimeUtil(session.end),
            max_attendees: currentCriteria.max_attendees,
            // CRITICAL FIX: Use generateStableSessionId to create unique, stable identifiers
            // This ensures Part 1/2/3 have different IDs and identifiers remain stable across time changes
            session_identifier: generateStableSessionId(sessionWithPartNumber),
            group_name: session.groupName,
            group_identifier: `${session.course.course_id}-group-${session.sessionNumber}`,
            session_status: 'scheduled',
            delivery_method: 'in_person',
            notes: `Generated by TSC Wizard${session.partSuffix ? ` - ${session.partSuffix} session` : ''}`,
            // instructor_id removed - column doesn't exist in database yet

            // Multi-day session fields
            part_of_total: session.totalParts || 1,
            total_parts: session.totalParts || 1,
            is_multi_day_course: (session.totalParts && session.totalParts > 1) || (session.daySequence && session.daySequence > 1) || false,
            course_day_sequence: session.daySequence || 1
          };
          
          sessionsToInsert.push(sessionData);
        }
      }
    }

    if (sessionsToInsert.length === 0) {
      console.warn('⚠️ No sessions to insert');
      return [];
    }

    // Debug: Check course_day_sequence values
    const daySequences = sessionsToInsert.map(s => s.course_day_sequence);
    const maxDaySequence = Math.max(...daySequences);
    console.log(`💾 Inserting ${sessionsToInsert.length} training sessions...`);
    console.log(`🔍 course_day_sequence values - Min: ${Math.min(...daySequences)}, Max: ${maxDaySequence}, All values:`, daySequences);

    // Debug: Check for duplicate session_identifiers
    const sessionIdentifiers = sessionsToInsert.map(s => s.session_identifier);
    const uniqueIdentifiers = new Set(sessionIdentifiers);
    if (sessionIdentifiers.length !== uniqueIdentifiers.size) {
      console.warn(`⚠️ DUPLICATE session_identifiers detected!`);
      console.warn(`Total: ${sessionIdentifiers.length}, Unique: ${uniqueIdentifiers.size}`);

      // Find duplicates
      const duplicates = sessionIdentifiers.filter((item, index) => sessionIdentifiers.indexOf(item) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];

      console.warn(`🔍 Duplicate identifiers:`, uniqueDuplicates);

      // Log detailed info about duplicate sessions
      uniqueDuplicates.forEach(dupId => {
        const dupSessions = sessionsToInsert.filter(s => s.session_identifier === dupId);
        console.warn(`🔍 Sessions with identifier "${dupId}":`, dupSessions.map(s => ({
          course: s.course_name,
          session: s.session_number,
          location: s.training_location,
          classroom: s.classroom_number,
          start: s.start_datetime,
          end: s.end_datetime
        })));
      });
    } else {
      console.log(`✅ All ${sessionsToInsert.length} session_identifiers are unique`);
    }

    const { data, error } = await supabase
      .from('training_sessions')
      .insert(sessionsToInsert)
      .select();

    if (error) {
      console.error('❌ Error saving training sessions:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      throw error;
    }

    console.log(`✅ Successfully saved ${data.length} training sessions`);
    return data;
  } catch (error) {
    console.error('❌ Error in saveTrainingSessionsForSchedule:', error);
    throw error;
  }
};

/**
 * Load existing schedule from database
 * @param {string} scheduleId - The schedule ID to load
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Object>} The schedule data
 */
export const loadTrainingSchedule = async (scheduleId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all schedule operations');
  }
  try {
    const { data, error } = await supabase
      .from('training_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('❌ Error loading schedule:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Error in loadTrainingSchedule:', error);
    throw error;
  }
};

/**
 * Load sessions for a schedule from database
 * @param {string} scheduleId - The schedule ID
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Object>} Sessions grouped by structure
 */
export const loadTrainingSessionsForSchedule = async (scheduleId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all session operations');
  }
  try {
    // Use SimpleAuthService to get filtered training sessions based on user permissions
    console.log('🔍 Loading training sessions with user permissions filtering...');
    console.log('🔍 Schedule ID:', scheduleId);
    console.log('🔍 Project ID:', projectId);

    const sessions = await SimpleAuthService.getFilteredTrainingSessions(scheduleId);

    console.log('🔍 Filtered sessions count:', sessions?.length || 0);
    if (sessions && sessions.length > 0) {
      console.log('🔍 Sample filtered session:', sessions[0]);
    }

    // If no sessions found through filtering, it could be due to permissions
    if (!sessions || sessions.length === 0) {
      console.log('⚠️ No sessions found through filtered query, checking if any exist...');

      // Check if any sessions exist without filtering (for debugging)
      const { data: allSessions, error: debugError } = await supabase
        .from('training_sessions')
        .select('id, functional_area, training_location, course_name, session_identifier')
        .eq('schedule_id', scheduleId)
        .eq('project_id', projectId)
        .limit(5);
      
      console.log('🔍 Debug - sessions exist in database:', {
        count: allSessions?.length || 0,
        samples: allSessions
      });
      
      if (debugError) {
        console.error('❌ Debug query error:', debugError);
      }
    }

    console.log('✅ Final filtered sessions count:', sessions?.length || 0);

    // Transform sessions back to the calendar structure
    const sessionsGroupedByStructure = {};
    
    (sessions || []).forEach(session => {
      const functionalArea = session.functional_area;
      const trainingLocation = session.training_location;
      const classroomKey = `Classroom ${session.classroom_number}`;
      
      // Initialize nested structure
      if (!sessionsGroupedByStructure[functionalArea]) {
        sessionsGroupedByStructure[functionalArea] = {};
      }
      if (!sessionsGroupedByStructure[functionalArea][trainingLocation]) {
        sessionsGroupedByStructure[functionalArea][trainingLocation] = {};
      }
      if (!sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey]) {
        sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey] = [];
      }
      
      // Transform session to match calendar format (using Schedule Manager's proven approach)
      // Use fromLocalDateTime to prevent timezone conversion issues
      const startDate = fromLocalDateTime(session.start_datetime);
      const endDate = fromLocalDateTime(session.end_datetime);

      // Debug: Log loaded session times (DETAILED)
      if (sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey].length < 3) {
        console.log(`🔍 Loading session: ${session.course_name} - Session ${session.session_number}`, {
          start_datetime_db: session.start_datetime,
          end_datetime_db: session.end_datetime,
          startDate_object: startDate,
          endDate_object: endDate,
          startDate_hours: startDate.getHours(),
          startDate_minutes: startDate.getMinutes(),
          startDate_display: startDate.toLocaleString(),
          endDate_display: endDate.toLocaleString()
        });
      }

      const calendarSession = {
        course_id: session.course_id,
        course_name: session.course_name,
        sessionNumber: session.session_number,
        session_number: session.session_number, // Clean structure field
        session_identifier: session.session_identifier, // Include session_identifier for assignment mapping
        group_type: [], // Will be populated based on criteria
        groupName: `${session.training_location} - Classroom ${session.classroom_number}`,
        group_name: session.group_name, // Clean structure field
        start: startDate,
        end: endDate,
        duration: session.duration_hours || 1,
        functional_area: session.functional_area, // Clean structure field
        training_location: session.training_location, // Clean structure field
        location: session.training_location,
        title: session.session_title || `${session.course_name} - Group ${session.session_number}`,
        custom_title: session.session_title || '',
        trainer_id: '', // Placeholder - instructor feature not yet implemented
        trainer_name: '', // Placeholder - instructor feature not yet implemented
        color: null, // Let ScheduleCalendar handle color assignment
        text_color: null,
        background_color: null,
        notes: session.notes || '',
        max_participants: session.max_attendees,
        max_attendees: session.max_attendees, // Also include the original database field name
        current_participants: session.current_attendees,
        event_id: session.id, // Use session ID as event ID (critical for assignments)
        eventId: `${session.course_id}-session${session.session_number}-${trainingLocation.replace(/\s+/g, '-').toLowerCase()}-${session.functional_area.replace(/\s+/g, '-').toLowerCase()}`, // Stable ID for assignment matching
        id: session.id, // Database ID
        calendarInstance: `${trainingLocation} - Classroom ${session.classroom_number}-${session.functional_area}`,
        
        // Multi-day session fields from new database structure
        totalParts: session.total_parts || 1,
        totalDays: session.course_day_sequence || 1,
        daySequence: session.course_day_sequence || 1,
        isMultiDay: session.is_multi_day_course || false,
        course: {
          id: session.course_id,
          course_id: session.course_id,
          course_name: session.course_name,
          duration_hrs: session.duration_hours || 1
        }
      };
      
      sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey].push(calendarSession);
    });

    console.log(`✅ Loaded ${sessions?.length || 0} sessions for schedule ${scheduleId}`);
    console.log('📊 Raw sessions from database:', sessions);
    console.log('🏗️ Grouped sessions structure:', sessionsGroupedByStructure);
    console.log('🔍 Structure keys:', Object.keys(sessionsGroupedByStructure));
    
    return sessionsGroupedByStructure;
  } catch (error) {
    console.error('❌ Error in loadTrainingSessionsForSchedule:', error);
    throw error;
  }
};

/**
 * Delete a training schedule and all its sessions
 * @param {string} scheduleId - The schedule ID to delete
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<boolean>} Success status
 */
export const deleteTrainingSchedule = async (scheduleId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all schedule operations');
  }
  try {
    // Delete sessions first (they should cascade, but being explicit)
    const { error: sessionsError } = await supabase
      .from('training_sessions')
      .delete()
      .eq('schedule_id', scheduleId)
      .eq('project_id', projectId);

    if (sessionsError) {
      console.error('❌ Error deleting sessions:', sessionsError);
      throw sessionsError;
    }

    // Delete the schedule
    const { error: scheduleError } = await supabase
      .from('training_schedules')
      .delete()
      .eq('id', scheduleId)
      .eq('project_id', projectId);

    if (scheduleError) {
      console.error('❌ Error deleting schedule:', scheduleError);
      throw scheduleError;
    }

    console.log(`✅ Deleted schedule ${scheduleId} and all associated sessions`);
    return true;
  } catch (error) {
    console.error('❌ Error in deleteTrainingSchedule:', error);
    throw error;
  }
};

/**
 * Get all training schedules for a project
 * @param {string} projectId - The project ID to filter schedules
 * @returns {Promise<Array>} Array of schedules
 */
export const getAllTrainingSchedules = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required to load schedules');
  }
  try {
    const { data, error } = await supabase
      .from('training_schedules')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading schedules:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Error in getAllTrainingSchedules:', error);
    throw error;
  }
};

/**
 * Update session details
 * @param {string} sessionId - The session ID
 * @param {Object} updates - Updates to apply
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Object>} Updated session
 */
export const updateTrainingSession = async (sessionId, updates, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all session operations');
  }
  try {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('training_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating session:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('❌ Error in updateTrainingSession:', error);
    throw error;
  }
};

/**
 * Bulk update multiple sessions
 * @param {Array} sessionUpdates - Array of {id, updates} objects
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Array>} Updated sessions
 */
export const bulkUpdateTrainingSessions = async (sessionUpdates, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all session operations');
  }
  try {
    const promises = sessionUpdates.map(({ id, updates }) => 
      updateTrainingSession(id, updates, projectId)
    );

    const results = await Promise.all(promises);
    console.log(`✅ Bulk updated ${results.length} sessions`);
    return results;
  } catch (error) {
    console.error('❌ Error in bulkUpdateTrainingSessions:', error);
    throw error;
  }
};