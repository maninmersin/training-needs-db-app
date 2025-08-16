import { createEvents } from 'ics';
import { supabase } from '../supabaseClient';
import { debugLog, debugError } from './consoleUtils';

/**
 * Calendar Invite Generator Utility
 * 
 * Generates .ics calendar files for training schedules with full attendee lists
 * for easy import into Outlook and other calendar applications.
 */

/**
 * Generate a complete training calendar file for a schedule
 * @param {Object} schedule - The training schedule object
 * @param {Array} sessions - Array of training sessions
 * @param {Array} assignments - Array of user assignments
 * @returns {Promise<Object>} - {success, filename, content, error}
 */
export const generateTrainingCalendar = async (schedule, sessions, assignments) => {
  try {
    debugLog('📅 Generating training calendar for schedule:', schedule.name);
    
    // Flatten sessions if they come in nested structure
    const flatSessions = flattenSessions(sessions);
    
    if (!flatSessions || flatSessions.length === 0) {
      throw new Error('No sessions found in schedule');
    }
    
    // Get user details for all assignments
    const usersWithEmails = await getUsersWithEmails(assignments);
    
    if (usersWithEmails.length === 0) {
      throw new Error('No users with email addresses found for assignments');
    }
    
    // Create calendar events for each session
    const calendarEvents = [];
    
    for (const session of flatSessions) {
      const sessionEvent = await createSessionEvent(session, assignments, usersWithEmails);
      if (sessionEvent) {
        calendarEvents.push(sessionEvent);
      }
    }
    
    if (calendarEvents.length === 0) {
      throw new Error('No calendar events could be created');
    }
    
    // Generate .ics file content
    const { error, value } = createEvents(calendarEvents);
    
    if (error) {
      throw new Error(`Calendar generation failed: ${error.message}`);
    }
    
    // Create filename with schedule name and date
    const filename = `Training_Schedule_${sanitizeFilename(schedule.name)}_${new Date().toISOString().split('T')[0]}.ics`;
    
    debugLog('✅ Training calendar generated successfully:', {
      filename,
      eventCount: calendarEvents.length,
      totalUsers: usersWithEmails.length
    });
    
    return {
      success: true,
      filename,
      content: value,
      eventCount: calendarEvents.length,
      userCount: usersWithEmails.length
    };
    
  } catch (err) {
    debugError('❌ Error generating training calendar:', err);
    return {
      success: false,
      error: err.message
    };
  }
};

/**
 * Flatten nested session structure into array
 * @param {Object|Array} sessions - Sessions in nested or flat structure
 * @returns {Array} - Flat array of sessions
 */
const flattenSessions = (sessions) => {
  if (Array.isArray(sessions)) {
    return sessions;
  }
  
  const flatSessions = [];
  
  // Handle nested structure: functionalArea -> location -> classroom -> [sessions]
  if (sessions && typeof sessions === 'object') {
    Object.entries(sessions).forEach(([functionalArea, locationData]) => {
      if (locationData && typeof locationData === 'object') {
        Object.entries(locationData).forEach(([location, classroomData]) => {
          if (classroomData && typeof classroomData === 'object') {
            Object.entries(classroomData).forEach(([classroom, sessionsList]) => {
              if (Array.isArray(sessionsList)) {
                flatSessions.push(...sessionsList);
              }
            });
          }
        });
      }
    });
  }
  
  return flatSessions;
};

/**
 * Get user details with email addresses for assignments
 * @param {Array} assignments - User assignments array
 * @returns {Promise<Array>} - Users with email addresses
 */
const getUsersWithEmails = async (assignments) => {
  try {
    if (!assignments || assignments.length === 0) {
      return [];
    }
    
    // Get unique user IDs from assignments
    const userIds = [...new Set(assignments.map(a => a.end_user_id).filter(Boolean))];
    
    if (userIds.length === 0) {
      return [];
    }
    
    // Fetch user details including email addresses
    const { data, error } = await supabase
      .from('end_users')
      .select('id, name, email, project_role, training_location')
      .in('id', userIds);
    
    if (error) {
      debugError('Error fetching user emails:', error);
      return [];
    }
    
    // Filter users who have email addresses
    const usersWithEmails = data.filter(user => user.email && user.email.trim() !== '');
    
    debugLog('📧 Found users with emails:', {
      totalUsers: data.length,
      usersWithEmails: usersWithEmails.length,
      missingEmails: data.length - usersWithEmails.length
    });
    
    return usersWithEmails;
    
  } catch (err) {
    debugError('Error getting users with emails:', err);
    return [];
  }
};

/**
 * Create a calendar event for a training session
 * @param {Object} session - Training session object
 * @param {Array} assignments - All assignments
 * @param {Array} usersWithEmails - Users with email addresses
 * @returns {Object|null} - Calendar event object or null
 */
const createSessionEvent = async (session, assignments, usersWithEmails) => {
  try {
    // Get attendees for this session
    const attendees = getSessionAttendees(session, assignments, usersWithEmails);
    
    if (attendees.length === 0) {
      debugLog('⚠️ No attendees found for session:', session.title);
      return null;
    }
    
    // Parse session dates
    const startDate = new Date(session.start);
    const endDate = new Date(session.end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      debugLog('⚠️ Invalid dates for session:', session.title);
      return null;
    }
    
    // Format dates for ics library (expects [year, month, day, hour, minute])
    const startArray = [
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      startDate.getDate(),
      startDate.getHours(),
      startDate.getMinutes()
    ];
    
    const endArray = [
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate(),
      endDate.getHours(),
      endDate.getMinutes()
    ];
    
    // Create event object
    const event = {
      title: session.title || session.course_name || 'Training Session',
      description: createEventDescription(session, attendees),
      location: session.location || session.training_location || '',
      start: startArray,
      end: endArray,
      attendees: attendees.map(user => ({
        name: user.name,
        email: user.email,
        rsvp: true,
        partstat: 'NEEDS-ACTION',
        role: 'REQ-PARTICIPANT'
      })),
      organizer: {
        name: 'Training Coordinator',
        email: 'training@company.com' // You can customize this
      },
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      categories: ['Training'],
      uid: `training-${session.id || session.eventId || Date.now()}-${Math.random().toString(36).substr(2, 9)}@training-system`
    };
    
    debugLog('📅 Created calendar event:', {
      title: event.title,
      attendeeCount: attendees.length,
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });
    
    return event;
    
  } catch (err) {
    debugError('Error creating session event:', err);
    return null;
  }
};

/**
 * Get attendees for a specific session
 * @param {Object} session - Training session
 * @param {Array} assignments - All assignments
 * @param {Array} usersWithEmails - Users with emails
 * @returns {Array} - Array of attendee objects
 */
const getSessionAttendees = (session, assignments, usersWithEmails) => {
  const sessionId = session.eventId || session.id || session.session_identifier;
  const sessionTitle = session.title;
  
  const matchingAssignments = assignments.filter(assignment => {
    // Session-level assignments
    if (assignment.assignment_level === 'session') {
      return assignment.session_identifier === sessionId ||
             assignment.session_id === session.id;
    }
    
    // Course-level assignments
    if (assignment.assignment_level === 'course') {
      return assignment.course_id === session.course_id;
    }
    
    // Group-level assignments
    if (assignment.assignment_level === 'group' && sessionTitle) {
      const groupMatch = sessionTitle.match(/Group (\d+)/);
      if (groupMatch) {
        const sessionGroupName = `Group${groupMatch[1]}`;
        return assignment.group_identifier && 
               assignment.group_identifier.endsWith(sessionGroupName);
      }
    }
    
    // Training location assignments
    if (assignment.assignment_level === 'training_location') {
      const sessionLocation = session.training_location || 
                             (sessionTitle && sessionTitle.includes('|') ? 
                              sessionTitle.split('|')[0].trim() : '');
      return !assignment.training_location || 
             assignment.training_location === sessionLocation;
    }
    
    return false;
  });
  
  // Get users with emails for matching assignments
  const attendeeUserIds = matchingAssignments.map(a => a.end_user_id);
  const attendees = usersWithEmails.filter(user => attendeeUserIds.includes(user.id));
  
  return attendees;
};

/**
 * Create event description with course and attendee details
 * @param {Object} session - Session object
 * @param {Array} attendees - Array of attendees
 * @returns {string} - Event description
 */
const createEventDescription = (session, attendees) => {
  const lines = [];
  
  // Course information
  if (session.course_name) {
    lines.push(`Course: ${session.course_name}`);
  }
  
  if (session.trainer_name) {
    lines.push(`Trainer: ${session.trainer_name}`);
  }
  
  if (session.functional_area) {
    lines.push(`Department: ${session.functional_area}`);
  }
  
  if (session.max_attendees) {
    lines.push(`Capacity: ${attendees.length}/${session.max_attendees}`);
  }
  
  // Attendee list
  if (attendees.length > 0) {
    lines.push('');
    lines.push('Attendees:');
    attendees.forEach(user => {
      const role = user.project_role ? ` (${user.project_role})` : '';
      lines.push(`• ${user.name}${role}`);
    });
  }
  
  lines.push('');
  lines.push('Generated by Training Needs Database System');
  
  return lines.join('\\n');
};

/**
 * Sanitize filename for file system compatibility
 * @param {string} filename - Raw filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
};

/**
 * Download calendar file to user's computer
 * @param {string} content - ICS file content
 * @param {string} filename - Filename for download
 */
export const downloadCalendarFile = (content, filename) => {
  try {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    debugLog('📁 Calendar file downloaded:', filename);
    
  } catch (err) {
    debugError('Error downloading calendar file:', err);
    throw err;
  }
};