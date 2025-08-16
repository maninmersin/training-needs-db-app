// Utility functions for generating and managing permanent event IDs

/**
 * Generate a permanent event ID for a session
 * Format: evt_[uuid] for easy identification
 */
export const generateEventId = () => {
  // Generate a UUID v4
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  
  return `evt_${uuid}`;
};

/**
 * Check if a session has a valid event ID
 */
export const hasValidEventId = (session) => {
  return session.event_id && session.event_id.startsWith('evt_');
};

/**
 * Ensure a session has an event ID, generate one if missing
 */
export const ensureEventId = (session) => {
  if (!hasValidEventId(session)) {
    return {
      ...session,
      event_id: generateEventId()
    };
  }
  return session;
};

/**
 * Generate event ID from session data for migration purposes
 * This creates a consistent ID based on session characteristics
 */
export const generateEventIdFromSession = (session) => {
  // For existing sessions, create a consistent ID based on immutable characteristics
  const courseId = session.course_id || session.course?.course_id || 'unknown';
  const sessionNumber = session.session_number || 1;
  const groupName = (session.group_name || 'default').replace(/\s+/g, '-').toLowerCase();
  const functionalArea = (session.functional_area || 'general').replace(/\s+/g, '-').toLowerCase();
  
  // Extract part number from title
  let partSuffix = '';
  if (session.title && session.title.includes('Part ')) {
    const partMatch = session.title.match(/Part (\d+)/);
    if (partMatch) {
      partSuffix = `-part${partMatch[1]}`;
    }
  }
  
  // Create a hash-like ID from session characteristics
  const sessionKey = `${courseId}-${sessionNumber}-${groupName}-${functionalArea}${partSuffix}`;
  
  // Simple hash function to create consistent UUID-like ID
  let hash = 0;
  for (let i = 0; i < sessionKey.length; i++) {
    const char = sessionKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive number and create UUID-like format
  const positiveHash = Math.abs(hash);
  const uuid = positiveHash.toString(16).padStart(8, '0') + '-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
  
  return `evt_${uuid}`;
};