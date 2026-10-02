import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import ScheduleCalendar from '../calendar/ScheduleCalendar';
import AddCourseToScheduleModal from './AddCourseToScheduleModal';
import { ensureEventId, generateEventIdFromSession } from '@core/utils/eventIdUtils';
import { toLocalDateTime } from '@core/utils/dateTimeUtils';
import { saveScheduleAs } from '@core/services/scheduleService';
import { getColorPaletteOptions } from '@core/utils/colorUtils';
import './AddCourseToScheduleModal.css'; // Import modal styles
import './ScheduleEditor.css'; // Import ScheduleEditor styles

// Get the modern color palette
const colorPalette = getColorPaletteOptions();

// Utility function to generate stable session identifiers
const generateStableSessionId = (session) => {
  const courseId = session.course_id || session.course?.course_id || 'unknown';
  const sessionNumber = session.session_number || session.sessionNumber || 1;
  const groupName = ((session.group_name || session.groupName || 'default') + '').replace(/\s+/g, '-').toLowerCase();
  const functionalArea = ((session.functional_area || session.functionalArea || 'general') + '').replace(/\s+/g, '-').toLowerCase();

  // CRITICAL: Include part number to differentiate Part 1, Part 2, Part 3 sessions
  let partSuffix = '';

  // First try to use session_part_number field (most reliable)
  if (session.session_part_number) {
    // ALWAYS include part number, even for Part 1 - CRITICAL for unique identifiers!
    partSuffix = `-part${session.session_part_number}`;
  } else {
    // Fallback: Extract from title
    const title = session.title || session.session_title || '';
    if (title && typeof title === 'string' && title.includes('Part ')) {
      const partMatch = title.match(/Part (\d+)/);
      if (partMatch) {
        // ALWAYS include part number, even for Part 1 - CRITICAL for unique identifiers!
        partSuffix = `-part${partMatch[1]}`;
      }
    }
  }

  // DON'T include timestamp - this was causing the bug where session identifiers changed on drag!
  // The identifier should be stable across time changes to preserve user assignments

  return `${courseId}-session${sessionNumber}-${groupName}-${functionalArea}${partSuffix}`;
};

const ScheduleEditor = ({ schedule, onSave, onBack }) => {
  const { currentProject } = useProject();
  const [sessionsForCalendar, setSessionsForCalendar] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsForm, setSaveAsForm] = useState({ name: '', description: '' });
  const [saveAsLoading, setSaveAsLoading] = useState(false);

  // Multi-select functionality state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [bulkColor, setBulkColor] = useState('');
  const [bulkTrainer, setBulkTrainer] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0); // Force re-render key

  // CRITICAL: Store initial sessions in ref to prevent prop changes from re-rendering calendar
  const initialSessionsRef = React.useRef(null);

  // Initialize sessions once on mount - DO NOT re-run when schedule prop changes
  useEffect(() => {
    console.log('🔍 ScheduleEditor useEffect running - hasInitialized:', hasInitialized);

    const sessionStorageKey = `unsaved-sessions-${schedule?.id}`;

    if (schedule && schedule.sessions && !hasInitialized) {
      // Check if there are unsaved changes in sessionStorage
      const savedUnsavedSessions = sessionStorage.getItem(sessionStorageKey);

      if (savedUnsavedSessions) {
        console.log('♻️ ScheduleEditor RESTORING UNSAVED sessions from sessionStorage');
        try {
          const parsedSessions = JSON.parse(savedUnsavedSessions);
          // Restore Date objects that were serialized to strings
          const restoredSessions = JSON.parse(JSON.stringify(parsedSessions), (key, value) => {
            if (key === 'start' || key === 'end') {
              return new Date(value);
            }
            return value;
          });

          initialSessionsRef.current = restoredSessions;
          setSessionsForCalendar(restoredSessions);
          setHasChanges(true); // Mark as having unsaved changes
          console.log('✅ Unsaved sessions restored from sessionStorage');
        } catch (e) {
          console.error('❌ Error parsing saved sessions:', e);
          // Fall back to original sessions
          initialSessionsRef.current = schedule.sessions;
          setSessionsForCalendar(schedule.sessions);
        }
      } else {
        console.log('📥 ScheduleEditor INITIALIZING sessions from schedule prop');
        initialSessionsRef.current = schedule.sessions;
        setSessionsForCalendar(schedule.sessions);
      }

      setLoading(false);
      setHasInitialized(true);
      console.log('✅ ScheduleEditor initialization complete');
    }
  }, [hasInitialized, schedule?.id]); // Depend on schedule.id to reinitialize if different schedule loaded

  // Fetch available trainers for the current project
  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        if (!currentProject) {
          setTrainers([]);
          return;
        }

        const { data, error } = await supabase
          .from('trainers')
          .select('id, name, email, specializations, active')
          .eq('project_id', currentProject.id)
          .eq('active', true)
          .order('name');
        
        if (error) {
          console.warn('Could not fetch trainers:', error);
          setTrainers([]);
        } else {
          setTrainers(data || []);
        }
      } catch (error) {
        console.error('Error fetching trainers:', error);
        setTrainers([]);
      }
    };

    fetchTrainers();
  }, [currentProject]);

  const handleSessionUpdate = async (updatedSession) => {
    try {
      console.log('🔄 ScheduleEditor: Handling session update:', updatedSession);
      console.log('🕐 ScheduleEditor: Time change details:', {
        title: updatedSession.title,
        eventId: updatedSession.eventId,
        newStart: updatedSession.start,
        newEnd: updatedSession.end,
        startHour: updatedSession.start?.getHours?.(),
        isPM: updatedSession.start?.getHours?.() >= 12
      });
      console.log('📊 Current sessions structure:', {
        keys: Object.keys(sessionsForCalendar),
        structure: Object.keys(sessionsForCalendar).map(key => ({
          key: key,
          subKeys: Object.keys(sessionsForCalendar[key] || {})
        }))
      });
    
    // Deep clone sessions to prevent any reference sharing between calendar instances
    const newSessions = JSON.parse(JSON.stringify(sessionsForCalendar));
    
    console.log('🔍 After JSON clone, structure check:', {
      keys: Object.keys(newSessions),
      structure: Object.keys(newSessions).map(key => ({
        key: key,
        type: typeof newSessions[key],
        subKeys: Object.keys(newSessions[key] || {}).map(subKey => ({
          subKey: subKey,
          type: typeof newSessions[key][subKey],
          isArray: Array.isArray(newSessions[key][subKey])
        }))
      }))
    });
    
    // Restore Date objects that were converted to strings during JSON serialization
    // Structure: functionalArea -> trainingLocation -> classroom -> sessions[]
    for (const functionalArea in newSessions) {
      for (const trainingLocation in newSessions[functionalArea]) {
        for (const classroom in newSessions[functionalArea][trainingLocation]) {
          const sessions = newSessions[functionalArea][trainingLocation][classroom];
          console.log(`🔍 Restoring dates for ${functionalArea}[${trainingLocation}][${classroom}]:`, {
            type: typeof sessions,
            isArray: Array.isArray(sessions),
            sessionCount: Array.isArray(sessions) ? sessions.length : 0
          });
          
          if (Array.isArray(sessions)) {
            sessions.forEach(session => {
              if (session.start && typeof session.start === 'string') {
                session.start = new Date(session.start);
              }
              if (session.end && typeof session.end === 'string') {
                session.end = new Date(session.end);
              }
            });
          } else {
            console.error(`❌ Expected sessions array but got:`, typeof sessions, sessions);
          }
        }
      }
    }
    
    // Find the session in the nested structure
    // Structure: functionalArea -> trainingLocation -> classroom -> sessions[]
    let found = false;
    for (const functionalArea in newSessions) {
      for (const trainingLocation in newSessions[functionalArea]) {
        for (const classroom in newSessions[functionalArea][trainingLocation]) {
          const sessions = newSessions[functionalArea][trainingLocation][classroom];
          const sessionIndex = sessions.findIndex(session => {
          // Simplified matching for free-form editing - prioritize event IDs for reliability
          
          // Primary: Database session ID (most reliable for saved sessions)
          if (updatedSession.event_id && session.event_id) {
            return session.event_id === updatedSession.event_id;
          }
          
          // Secondary: Generated event ID (for new sessions or calendar operations)
          if (updatedSession.eventId && session.eventId) {
            return session.eventId === updatedSession.eventId;
          }
          
          // Fallback: Original time matching for precise identification
          if (updatedSession.originalStart && session.start) {
            const sessionStartTime = session.start.getTime();
            const originalStartTime = updatedSession.originalStart.getTime();
            const sameCourse = session.course?.course_id === updatedSession.course?.course_id;
            const sameTitle = session.title === updatedSession.originalTitle;
            
            return sessionStartTime === originalStartTime && sameCourse && sameTitle;
          }
          
          return false;
        });
        
          if (sessionIndex !== -1) {
            console.log('✅ Found session to update at:', { functionalArea, trainingLocation, classroom, sessionIndex });
            console.log('📊 Session array before update:', {
              totalSessions: sessions.length,
              sessionTitles: sessions.map(s => s.title),
              targetSessionTitle: sessions[sessionIndex].title,
              updatedSessionTitle: updatedSession.title
            });
            
            // Handle session deletion
            if (updatedSession._deleted) {
              console.log('🗑️ Deleting session:', sessions[sessionIndex].title);
              sessions.splice(sessionIndex, 1);
              
              // Clean up empty classrooms, locations, and functional areas
              if (sessions.length === 0) {
                delete newSessions[functionalArea][trainingLocation][classroom];
                console.log(`🧹 Removed empty classroom: ${classroom}`);
                
                // If the location has no more classrooms, remove the location
                if (Object.keys(newSessions[functionalArea][trainingLocation]).length === 0) {
                  delete newSessions[functionalArea][trainingLocation];
                  console.log(`🧹 Removed empty location: ${trainingLocation}`);
                  
                  // If the functional area has no more locations, remove the functional area
                  if (Object.keys(newSessions[functionalArea]).length === 0) {
                    delete newSessions[functionalArea];
                    console.log(`🧹 Removed empty functional area: ${functionalArea}`);
                  }
                }
              }
            } else {
              // Normal session update
              const startTime = new Date(updatedSession.start);
              const endTime = new Date(updatedSession.end);
              const durationHours = (endTime - startTime) / (1000 * 60 * 60); // Calculate duration in hours
              
              const sessionToUpdate = {
                ...updatedSession,
                start: startTime,
                end: endTime,
                duration: durationHours // Update duration automatically when times change
              };
              
              console.log('🕐 Session time update:', {
                originalTitle: sessions[sessionIndex].title,
                originalStart: sessions[sessionIndex].start,
                originalEnd: sessions[sessionIndex].end,
                newTitle: sessionToUpdate.title,
                newStart: sessionToUpdate.start,
                newEnd: sessionToUpdate.end,
                timeDiff: sessionToUpdate.start.getTime() - sessions[sessionIndex].start.getTime()
              });
              
              sessions[sessionIndex] = sessionToUpdate;
            }
            
            console.log('📊 Session array after update:', {
              totalSessions: sessions.length,
              sessionTitles: sessions.map(s => s.title),
              updatedSessionAtIndex: sessions[sessionIndex]?.title
            });
            
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    
    if (!found) {
      console.error('❌ Could not find session to update');
      console.error('🔍 Looking for session:', {
        eventId: updatedSession.eventId,
        event_id: updatedSession.event_id,
        title: updatedSession.title,
        originalStart: updatedSession.originalStart
      });
      console.error('🔍 Available sessions for debugging:', {
        totalGroups: Object.keys(newSessions).length,
        groups: Object.keys(newSessions),
        allSessions: Object.entries(newSessions).map(([groupName, functionalAreas]) => ({
          groupName,
          functionalAreas: Object.entries(functionalAreas).map(([faName, sessions]) => ({
            functionalArea: faName,
            sessionCount: sessions.length,
            sessionTitles: sessions.map(s => ({ 
              title: s.title, 
              eventId: s.eventId, 
              event_id: s.event_id,
              start: s.start 
            }))
          }))
        }))
      });
      // Don't throw error - just return without updating to prevent data loss
      console.warn('⚠️ Skipping session update to prevent data corruption');
      return;
    }
    
    console.log('🔄 CALLING setSessionsForCalendar with updated sessions');
    console.log('🔄 Updated session details:', {
      title: updatedSession.title,
      newStart: updatedSession.start,
      newStartTime: updatedSession.start instanceof Date ? updatedSession.start.toLocaleString() : 'N/A',
      newStartHour: updatedSession.start instanceof Date ? updatedSession.start.getHours() : 'N/A'
    });

    // CRITICAL: Update BOTH the state AND the ref that's passed to ScheduleCalendar
    initialSessionsRef.current = newSessions;
    setSessionsForCalendar(newSessions);
    setHasChanges(true);

    // Save unsaved changes to sessionStorage to persist across component unmounts
    const sessionStorageKey = `unsaved-sessions-${schedule.id}`;
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(newSessions));
    console.log('💾 Saved unsaved sessions to sessionStorage');

    console.log('✅ Updated both initialSessionsRef and sessionsForCalendar state');

    // Save trainer assignments to database immediately
    if (updatedSession.trainer_id || updatedSession.instructor_id) {
      try {
        const { updateTrainingSession } = await import('@core/services/scheduleService');
        const sessionId = updatedSession.id || updatedSession.event_id;
        
        if (sessionId) {
          const updateData = {
            instructor_id: updatedSession.trainer_id || updatedSession.instructor_id,
            instructor_name: updatedSession.trainer_name || updatedSession.instructor_name
          };
          
          console.log('💾 Saving trainer assignment to database:', { sessionId, updateData });
          await updateTrainingSession(sessionId, updateData);
          console.log('✅ Trainer assignment saved to database');
        }
      } catch (error) {
        console.error('❌ Error saving trainer to database:', error);
      }
    }
    
    console.log('✅ Session updated successfully');
    } catch (error) {
      console.error('❌ Error in handleSessionUpdate:', error);
      console.error('💥 Error details:', {
        message: error.message,
        stack: error.stack,
        updatedSession: updatedSession,
        currentSessions: sessionsForCalendar
      });
      throw error; // Re-throw to surface the error to the caller
    }
  };

  // Multi-select handler functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedEventIds([]); // Clear selections when toggling
    setBulkColor('');
    setBulkTrainer('');
  };

  const handleEventSelection = (eventId, isSelected) => {
    if (isSelected) {
      setSelectedEventIds(prev => [...prev, eventId]);
    } else {
      setSelectedEventIds(prev => prev.filter(id => id !== eventId));
    }
  };

  const handleBulkSave = async () => {
    if (selectedEventIds.length === 0) return;
    
    try {
      setBulkSaving(true);
      
      console.log('🔍 DEBUG: Starting bulk save with:', {
        selectedEventIds: selectedEventIds,
        bulkColor: bulkColor,
        bulkTrainer: bulkTrainer,
        selectedTrainer: trainers.find(t => t.id === bulkTrainer)
      });
      
      // Import the bulk update function
      const { bulkUpdateTrainingSessions } = await import('@core/services/scheduleService');
      
      // Find actual database session IDs for selected events
      const sessionUpdates = [];
      
      for (const functionalArea in sessionsForCalendar) {
        for (const trainingLocation in sessionsForCalendar[functionalArea]) {
          for (const classroom in sessionsForCalendar[functionalArea][trainingLocation]) {
            const sessions = sessionsForCalendar[functionalArea][trainingLocation][classroom];
            if (Array.isArray(sessions)) {
              sessions.forEach(session => {
                // Check if this session is selected (using both possible ID formats)
                const isSelected = selectedEventIds.includes(session.id) || 
                                 selectedEventIds.includes(session.eventId) ||
                                 selectedEventIds.includes(session.event_id);
                
                if (isSelected && session.event_id) {
                  const updateData = {};
                  if (bulkColor) updateData.color_theme = bulkColor;
                  if (bulkTrainer) {
                    const selectedTrainer = trainers.find(t => t.id === bulkTrainer);
                    updateData.instructor_id = bulkTrainer;
                    updateData.instructor_name = selectedTrainer ? selectedTrainer.name : '';
                  }
                  
                  sessionUpdates.push({
                    id: session.event_id, // Use the actual database ID (event_id corresponds to training_sessions.id)
                    updates: updateData
                  });
                }
              });
            }
          }
        }
      }
      
      console.log('🔍 DEBUG: Session updates prepared:', sessionUpdates);
      
      if (sessionUpdates.length === 0) {
        console.error('❌ DEBUG: No sessions found to update!');
        console.error('❌ DEBUG: Selected event IDs:', selectedEventIds);
        console.error('❌ DEBUG: Sessions structure:', sessionsForCalendar);
        alert('No sessions found to update. Check browser console for details.');
        return;
      }
      
      // Apply bulk updates to database
      console.log('💾 DEBUG: Sending updates to database:', sessionUpdates);
      const updateResults = await bulkUpdateTrainingSessions(sessionUpdates);
      console.log('✅ DEBUG: Database update results:', updateResults);
      
      // Update local sessions data with a completely fresh object structure to ensure React re-renders
      const newSessions = JSON.parse(JSON.stringify(sessionsForCalendar)); // Deep clone first
      
      // Apply updates to selected sessions
      for (const functionalArea in newSessions) {
        for (const trainingLocation in newSessions[functionalArea]) {
          for (const classroom in newSessions[functionalArea][trainingLocation]) {
            const sessions = newSessions[functionalArea][trainingLocation][classroom];
            if (Array.isArray(sessions)) {
              sessions.forEach(session => {
                // Restore Date objects that were serialized
                if (session.start && typeof session.start === 'string') {
                  session.start = new Date(session.start);
                }
                if (session.end && typeof session.end === 'string') {
                  session.end = new Date(session.end);
                }
                
                // Apply updates to selected sessions
                const isSelected = selectedEventIds.includes(session.id) || 
                                 selectedEventIds.includes(session.eventId) || 
                                 selectedEventIds.includes(session.event_id);
                
                if (isSelected) {
                  if (bulkColor) {
                    session.color = bulkColor;
                  }
                  if (bulkTrainer) {
                    const selectedTrainer = trainers.find(t => t.id === bulkTrainer);
                    session.trainer_id = bulkTrainer;
                    session.trainer_name = selectedTrainer ? selectedTrainer.name : '';
                    session.instructor_id = bulkTrainer;
                    session.instructor_name = selectedTrainer ? selectedTrainer.name : '';
                  }
                }
              });
            }
          }
        }
      }
      
      // Update calendar display
      console.log('🔄 DEBUG: Updating local sessions state with:', newSessions);
      setSessionsForCalendar(newSessions);
      setHasChanges(true);
      setCalendarKey(prev => prev + 1); // Force calendar re-render
      
      // Reset selection
      setSelectedEventIds([]);
      setBulkColor('');
      setBulkTrainer('');
      setSelectionMode(false);
      
      console.log(`✅ Bulk updated ${sessionUpdates.length} sessions`);
      alert(`✅ Successfully updated ${sessionUpdates.length} sessions with trainer assignment.`);
    } catch (error) {
      console.error('❌ Error in bulk save:', error);
      alert('Error saving selected sessions: ' + error.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      // CRITICAL FIX: Parse schedule criteria to get correct max_attendees and training_locations
      let parsedCriteria = {};
      try {
        parsedCriteria = typeof schedule.criteria === 'string'
          ? JSON.parse(schedule.criteria)
          : schedule.criteria || {};
        console.log('📋 Parsed schedule criteria:', {
          max_attendees: parsedCriteria.max_attendees,
          training_locations: parsedCriteria.selected_training_locations
        });
      } catch (e) {
        console.error('❌ Error parsing schedule criteria:', e);
      }

      // Debug: Log the sessions structure before conversion
      console.log('📊 DEBUG: sessionsForCalendar structure before save:', {
        keys: Object.keys(sessionsForCalendar),
        totalFunctionalAreas: Object.keys(sessionsForCalendar).length,
        structure: Object.entries(sessionsForCalendar).map(([functionalArea, locations]) => ({
          functionalArea,
          locations: Object.keys(locations || {}),
          totalSessions: Object.values(locations || {})
            .flatMap(classrooms => Object.values(classrooms || {}))
            .flatMap(sessions => sessions || []).length
        }))
      });

      // Debug: Log ALL session times before conversion to database format
      console.log('🕐 DEBUG: ALL SESSION TIMES BEFORE CONVERSION:');
      console.log('🔍 sessionsForCalendar keys:', Object.keys(sessionsForCalendar));
      let sessionCounter = 0;
      Object.entries(sessionsForCalendar).forEach(([functionalArea, locations]) => {
        console.log(`🔍 Functional Area: ${functionalArea}`, typeof locations);
        console.log(`🔍 Locations keys:`, Object.keys(locations || {}));
        Object.entries(locations || {}).forEach(([location, classrooms]) => {
          console.log(`  🔍 Location: ${location}`, typeof classrooms);
          console.log(`  🔍 Classrooms keys:`, Object.keys(classrooms || {}));
          Object.entries(classrooms || {}).forEach(([classroom, sessions]) => {
            console.log(`    🔍 Classroom: ${classroom}`, typeof sessions, 'isArray:', Array.isArray(sessions));
            if (Array.isArray(sessions)) {
              console.log(`    🔍 Sessions count: ${sessions.length}`);
              sessions.forEach((session, index) => {
                const startDate = session.start instanceof Date ? session.start : new Date(session.start);
                const endDate = session.end instanceof Date ? session.end : new Date(session.end);
                console.log(`   [${sessionCounter++}] ${session.title || 'Untitled'}`);
                console.log(`      START: ${startDate.toLocaleString()} (Hour: ${startDate.getHours()})`);
                console.log(`      END: ${endDate.toLocaleString()}`);
                console.log(`      Location: ${functionalArea}/${location}/${classroom}`);
              });
            } else {
              console.error(`    ❌ Expected array but got:`, typeof sessions);
            }
          });
        });
      });

      // Convert sessions back to normalized format for new database structure
      // Handle TSC Wizard structure: functional_area -> training_location -> classroom -> [sessions]
      const allSessionsBeforeFilter = Object.values(sessionsForCalendar)
        .flatMap(locations => Object.values(locations)) // functional_area -> training_location
        .flatMap(classrooms => Object.values(classrooms)) // training_location -> classroom
        .flatMap(sessionList => sessionList); // classroom -> [sessions]

      console.log(`🔍 FLATMAP RESULT: Found ${allSessionsBeforeFilter.length} sessions before filter`);
      allSessionsBeforeFilter.slice(0, 3).forEach((s, i) => {
        console.log(`  [${i}]`, s?.title, 'has start:', !!s?.start, 'has end:', !!s?.end);
      });

      const sessionsToSave = allSessionsBeforeFilter
        .filter(session => {
          // Filter out invalid sessions
          if (!session) {
            console.warn('⚠️ Skipping null/undefined session');
            return false;
          }
          if (!session.start || !session.end) {
            console.warn('⚠️ Skipping session with missing dates:', {
              title: session.title,
              start: session.start,
              end: session.end,
              eventId: session.eventId
            });
            return false;
          }
          if (!session.title && !session.course?.course_name) {
            console.warn('⚠️ Skipping session with no title or course name:', session);
            return false;
          }
          return true;
        })
        .map(session => {
          console.log('💾 Converting session for save to new structure:', {
            title: session.title,
            eventId: session.eventId,
            event_id: session.event_id,
            originalStart: session.originalStart,
            newStart: session.start,
            partNumber: session.title?.match(/Part (\d+)/)?.[1]
          });

          // Extract classroom number from group name if available
          const classroomMatch = session.groupName?.match(/Classroom (\w+)/);
          const classroomNumber = classroomMatch ? classroomMatch[1] : '1';

          // CRITICAL: Extract session_part_number FIRST so we can use it in generateStableSessionId
          const sessionPartNumber = session.session_part_number ||
            (session.title?.match(/Part (\d+)/)?.[1] ? parseInt(session.title.match(/Part (\d+)/)?.[1]) : 1);

          // Build session object with part number for generateStableSessionId
          const sessionWithPartNumber = {
            ...session,
            session_part_number: sessionPartNumber
          };

          // Generate stable identifier
          const generatedIdentifier = generateStableSessionId(sessionWithPartNumber);

          // CRITICAL FIX: Check if existing identifier is broken (missing part number)
          // If identifier doesn't have "-part" suffix, regenerate it
          let finalIdentifier = session.session_identifier || session.eventId || generatedIdentifier;
          const identifierHasPartNumber = finalIdentifier && finalIdentifier.includes('-part');

          if (!identifierHasPartNumber) {
            console.log(`🔧 Regenerating identifier for "${session.title}" (missing part number)`);
            finalIdentifier = generatedIdentifier; // Force regeneration
          }

          return {
            // Use existing session ID if this is an update, otherwise generate new one
            id: session.event_id, // This should be the session ID from training_sessions table
            schedule_id: schedule.id,
            course_id: session.course?.id || session.course?.course_id || null,
            course_name: session.course?.course_name || session.title?.split(' - ')[0] || 'Unknown Course',
            session_number: session.sessionNumber || 1,
            session_title: session.title || 'Untitled Session',
            session_part_number: sessionPartNumber,
            classroom_number: classroomNumber,
            // NOTE: Each session can have its own training_location, so preserve session-specific location
            // If you need to bulk-update all sessions to a new location, use the "Add Course" feature
            training_location: session.location || session.training_location || 'TBD',
            functional_area: session.functional_area || 'General',
            start_datetime: (() => {
              const startDate = new Date(session.start);
              if (isNaN(startDate.getTime())) {
                console.error('❌ Invalid start date for session:', session.title, 'start:', session.start);
                throw new Error(`Invalid start date for session "${session.title}": ${session.start}`);
              }
              return toLocalDateTime(startDate);
            })(),
            end_datetime: (() => {
              const endDate = new Date(session.end);
              if (isNaN(endDate.getTime())) {
                console.error('❌ Invalid end date for session:', session.title, 'end:', session.end);
                throw new Error(`Invalid end date for session "${session.title}": ${session.end}`);
              }
              return toLocalDateTime(endDate);
            })(),
            duration_hrs: session.duration || ((new Date(session.end) - new Date(session.start)) / (1000 * 60 * 60)) || 1,
            // CRITICAL FIX: Use max_attendees from schedule criteria (source of truth), not from session
            // Write to BOTH fields to ensure compatibility with database schema
            max_attendees: parsedCriteria.max_attendees || session.max_participants || session.max_attendees || null,
            max_participants: parsedCriteria.max_attendees || session.max_participants || session.max_attendees || null,
            instructor_id: session.trainer_id || null,
            instructor_name: session.trainer_name || '',
            notes: session.notes || '',
            session_status: 'scheduled',
            project_id: currentProject?.id || schedule.project_id,

            // New database fields to maintain compatibility with TSC Wizard
            // CRITICAL: Use finalIdentifier which regenerates broken identifiers without part numbers
            session_identifier: finalIdentifier,
            group_name: session.groupName || `${session.location || 'TBD'} - Classroom ${classroomNumber}`,
            group_identifier: `${session.course?.course_id || 'unknown'}-group-${session.sessionNumber || 1}`,
            delivery_method: 'in_person',

            // Multi-day session fields
            part_of_total: session.totalParts || 1,
            total_parts: session.totalParts || 1,
            is_multi_day_course: (session.totalParts && session.totalParts > 1) || false,
            course_day_sequence: session.daySequence || 1
          };
        });

      console.log('💾 Sessions prepared for new database structure:', sessionsToSave);
      
      // CRITICAL CHECK: Prevent accidental deletion of all sessions
      if (sessionsToSave.length === 0) {
        console.error('🚨 CRITICAL: No sessions to save! This would delete all existing sessions.');
        console.error('🚨 DEBUG: Original sessions structure:', sessionsForCalendar);
        alert('⚠️ CRITICAL ERROR: No sessions found to save. This would delete all your existing sessions. Save operation cancelled.');
        return;
      }

      // Step 1: Query existing sessions for this schedule
      console.log('🔍 Querying existing sessions for schedule:', schedule.id);
      const { data: existingSessions, error: queryError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('schedule_id', schedule.id);

      if (queryError) {
        console.error('❌ Error querying existing sessions:', queryError);
        throw queryError;
      }

      console.log(`📊 Found ${existingSessions?.length || 0} existing sessions in database`);

      // Step 2: Build lookup maps using session_identifier as stable key
      const existingSessionMap = new Map();
      (existingSessions || []).forEach(session => {
        existingSessionMap.set(session.session_identifier, session);
      });

      const newSessionMap = new Map();
      sessionsToSave.forEach(session => {
        newSessionMap.set(session.session_identifier, session);
      });

      // Step 3: Categorize sessions into UPDATE, INSERT, DELETE
      const sessionsToUpdate = [];
      const sessionsToInsert = [];
      const sessionIdsToDelete = [];

      // Identify sessions to UPDATE or INSERT
      sessionsToSave.forEach(newSession => {
        const existingSession = existingSessionMap.get(newSession.session_identifier);
        if (existingSession) {
          // Session exists - UPDATE it (preserve the ID to maintain foreign key relationships)
          sessionsToUpdate.push({
            ...newSession,
            id: existingSession.id  // Keep the existing ID to preserve attendee assignments
          });
        } else {
          // Session is new - INSERT it
          sessionsToInsert.push(newSession);
        }
      });

      // Identify sessions to DELETE (in database but not in new sessions)
      (existingSessions || []).forEach(existingSession => {
        if (!newSessionMap.has(existingSession.session_identifier)) {
          sessionIdsToDelete.push(existingSession.id);
        }
      });

      console.log('📋 UPSERT Operation Summary:');
      console.log(`   🔄 Sessions to UPDATE: ${sessionsToUpdate.length}`);
      console.log(`   ➕ Sessions to INSERT: ${sessionsToInsert.length}`);
      console.log(`   🗑️ Sessions to DELETE: ${sessionIdsToDelete.length}`);

      // Step 4: Execute UPDATE operations (preserve IDs and attendee relationships)
      if (sessionsToUpdate.length > 0) {
        console.log('🔄 Updating existing sessions...');
        for (const session of sessionsToUpdate) {
          // CRITICAL FIX: Exclude session_identifier from updates to preserve the original stable reference
          // This prevents breaking user assignment links when sessions are moved or edited
          const { id, session_identifier, ...sessionData } = session;

          const { error: updateError } = await supabase
            .from('training_sessions')
            .update(sessionData)  // session_identifier NOT included, database keeps original value
            .eq('id', id);

          if (updateError) {
            console.error(`❌ Error updating session ${id}:`, updateError);
            throw updateError;
          }
        }
        console.log(`✅ Updated ${sessionsToUpdate.length} sessions (session_identifiers preserved, attendee assignments intact)`);
      }

      // Step 5: Execute INSERT operations (new sessions)
      let insertedSessions = [];
      if (sessionsToInsert.length > 0) {
        console.log('➕ Inserting new sessions...');
        // Debug: Log sample sessions with times being saved
        console.log('🔍 Sample NEW sessions being inserted:');
        sessionsToInsert.slice(0, 5).forEach(s => {
          console.log(`   💾 ${s.session_title}:`, {
            start_datetime: s.start_datetime,
            end_datetime: s.end_datetime,
            training_location: s.training_location,
            classroom_number: s.classroom_number,
            group_name: s.group_name
          });
        });

        const { data, error: insertError } = await supabase
          .from('training_sessions')
          .insert(sessionsToInsert.map(session => {
            // Remove the id field for new inserts (let database generate)
            const { id, ...sessionWithoutId } = session;
            return sessionWithoutId;
          }))
          .select();

        if (insertError) {
          console.error('❌ Error inserting new sessions:', insertError);
          throw insertError;
        }

        insertedSessions = data || [];
        console.log(`✅ Inserted ${insertedSessions.length} new sessions`);
      }

      // Step 6: Execute DELETE operations (removed sessions)
      if (sessionIdsToDelete.length > 0) {
        console.log('🗑️ Deleting removed sessions...');
        const { error: deleteError } = await supabase
          .from('training_sessions')
          .delete()
          .in('id', sessionIdsToDelete);

        if (deleteError) {
          console.error('❌ Error deleting removed sessions:', deleteError);
          throw deleteError;
        }
        console.log(`✅ Deleted ${sessionIdsToDelete.length} removed sessions`);
      }

      console.log('✅ All session changes saved successfully (UPSERT complete)');

      // Step 3: Update schedule metadata (updated timestamp)
      const { error: scheduleError } = await supabase
        .from('training_schedules')
        .update({ 
          updated_at: toLocalDateTime(new Date()),
          // Update functional areas and training locations based on current sessions
          functional_areas: [...new Set(sessionsToSave.map(s => s.functional_area))],
          training_locations: [...new Set(sessionsToSave.map(s => s.training_location))]
        })
        .eq('id', schedule.id);

      if (scheduleError) {
        console.error('❌ Error updating schedule metadata:', scheduleError);
        throw scheduleError;
      }

      console.log('✅ Schedule metadata updated successfully');

      // Keep the current calendar view - don't revert to original
      // The sessionsForCalendar already contains the user's changes
      setHasChanges(false);

      // Clear unsaved changes from sessionStorage since we've saved to database
      const sessionStorageKey = `unsaved-sessions-${schedule.id}`;
      sessionStorage.removeItem(sessionStorageKey);
      console.log('🗑️ Cleared unsaved sessions from sessionStorage');

      alert('✅ Schedule saved successfully!');
      
      // Optionally refresh parent component (for schedule list updates)
      if (onSave) {
        onSave();
      }

    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      alert(`Failed to save schedule: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCourseAdded = (newSessions) => {
    console.log('🆕 Adding new course sessions:', newSessions);
    
    // Convert new sessions to the correct 3-level calendar format
    const newSessionsForCalendar = {};
    
    newSessions.forEach(session => {
      const functionalArea = session.functional_area || 'General';
      const trainingLocation = session.location || 'TBD';
      const classroom = session.classroom || `Classroom 1`; // Use session's classroom or default
      
      // Initialize 3-level structure: functionalArea -> trainingLocation -> classroom -> sessions[]
      if (!newSessionsForCalendar[functionalArea]) {
        newSessionsForCalendar[functionalArea] = {};
      }
      if (!newSessionsForCalendar[functionalArea][trainingLocation]) {
        newSessionsForCalendar[functionalArea][trainingLocation] = {};
      }
      if (!newSessionsForCalendar[functionalArea][trainingLocation][classroom]) {
        newSessionsForCalendar[functionalArea][trainingLocation][classroom] = [];
      }
      
      const startTime = new Date(session.start);
      const endTime = new Date(session.end);
      
      const calendarSession = {
        start: startTime,
        end: endTime,
        sessionNumber: session.session_number || 1,
        groupType: session.group_type || [],
        groupName: session.group_name || `${trainingLocation} - ${classroom}`,
        functional_area: functionalArea,
        location: trainingLocation,
        classroomNumber: '1', // Default classroom number
        duration: session.duration || 1,
        title: session.title || 'Untitled Session',
        custom_title: session.custom_title || '',
        trainer_id: session.trainer_id || '',
        trainer_name: session.trainer_name || '',
        color: null, // Let ScheduleCalendar auto-assign colors
        text_color: null,
        background_color: null,
        notes: session.notes || '',
        max_participants: session.max_participants || null,
        current_participants: session.current_participants || 0,
        event_id: session.event_id,
        eventId: generateStableSessionId(session),
        calendarInstance: `${trainingLocation}-${classroom}`,
        _uniqueTimestamp: session._uniqueTimestamp, // Preserve timestamp for ID generation
        course: {
          id: session.course_id,
          course_id: session.course_id,
          course_name: session.course_name || 'Unknown Course',
          duration_hrs: session.duration || 1
        }
      };
      
      newSessionsForCalendar[functionalArea][trainingLocation][classroom].push(calendarSession);
    });
    
    // Merge with existing sessions using correct 3-level structure
    const updatedSessions = { ...sessionsForCalendar };
    
    // Structure: functionalArea -> trainingLocation -> classroom -> sessions[]
    Object.entries(newSessionsForCalendar).forEach(([functionalArea, trainingLocations]) => {
      if (!updatedSessions[functionalArea]) updatedSessions[functionalArea] = {};
      
      Object.entries(trainingLocations).forEach(([trainingLocation, classrooms]) => {
        if (!updatedSessions[functionalArea][trainingLocation]) {
          updatedSessions[functionalArea][trainingLocation] = {};
        }
        
        Object.entries(classrooms).forEach(([classroom, sessions]) => {
          if (!updatedSessions[functionalArea][trainingLocation][classroom]) {
            updatedSessions[functionalArea][trainingLocation][classroom] = [];
          }
          updatedSessions[functionalArea][trainingLocation][classroom].push(...sessions);
        });
      });
    });
    
    console.log('✅ Updated sessions with new course:', updatedSessions);
    
    // Debug: Show detailed 3-level structure
    Object.entries(updatedSessions).forEach(([functionalArea, trainingLocations]) => {
      console.log(`📊 Functional Area "${functionalArea}":`);
      Object.entries(trainingLocations).forEach(([trainingLocation, classrooms]) => {
        console.log(`  📍 Location "${trainingLocation}":`);
        Object.entries(classrooms).forEach(([classroom, sessions]) => {
          console.log(`    🏫 ${classroom}: ${sessions.length} sessions`);
          sessions.forEach((session, index) => {
            console.log(`      ${index + 1}. ${session.title} (Course: ${session.course?.course_name})`);
          });
        });
      });
    });
    setSessionsForCalendar(updatedSessions);
    setHasChanges(true);

    // Save unsaved changes to sessionStorage to persist across component unmounts
    const sessionStorageKey = `unsaved-sessions-${schedule.id}`;
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(updatedSessions));
    console.log('💾 Saved newly added courses to sessionStorage');

    // Show success message
    alert(`✅ Course added successfully! ${newSessions.length} session${newSessions.length !== 1 ? 's' : ''} created.`);
  };

  const handleSaveAs = () => {
    // Initialize form with default name
    setSaveAsForm({
      name: `${schedule.name} (Copy)`,
      description: `Copy of ${schedule.name} created on ${new Date().toLocaleDateString('en-GB')}`
    });
    setShowSaveAsModal(true);
  };

  const handleSaveAsSubmit = async () => {
    if (!saveAsForm.name.trim()) {
      alert('Please enter a name for the new schedule');
      return;
    }

    try {
      setSaveAsLoading(true);

      const result = await saveScheduleAs(
        schedule.id,
        saveAsForm.name.trim(),
        saveAsForm.description.trim() || null
      );

      console.log('✅ Schedule copied successfully:', result);

      alert(`✅ Schedule copied successfully!\n\nNew schedule: "${result.schedule.name}"\nCopied ${result.sessionCount} sessions from "${result.originalScheduleName}"\n\nThe new schedule is now available in the Schedule Manager.`);

      setShowSaveAsModal(false);
      setSaveAsForm({ name: '', description: '' });

      // Optionally refresh the parent to show the new schedule
      if (onSave) {
        onSave();
      }

    } catch (error) {
      console.error('❌ Error saving schedule as copy:', error);
      alert(`Failed to copy schedule: ${error.message}`);
    } finally {
      setSaveAsLoading(false);
    }
  };

  const discardChanges = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
      );
      if (!confirmed) return;
    }
    onBack();
  };

  if (loading) {
    return (
      <div className="schedule-editor">
        <div className="loading-state">
          <div>📅 Loading schedule...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-editor">
      <div className="editor-header">
        <div className="header-info">
          <h2>✏️ Edit Schedule: {schedule.name}</h2>
          <div className="schedule-metadata">
            <span>Created: {new Date(schedule.created_at).toLocaleDateString('en-GB')}</span>
            <span>•</span>
            <span>Version: {schedule.version ? new Date(schedule.version).toLocaleDateString('en-GB') : 'v1.0'}</span>
            <span>•</span>
            <span
              title="Click to copy full schedule ID"
              onClick={() => {navigator.clipboard.writeText(schedule.id); alert('Schedule ID copied: ' + schedule.id);}}
              style={{cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9em'}}
            >
              ID: {schedule.id.substring(0, 8)}... (click to copy full)
            </span>
            {hasChanges && <span className="changes-indicator">• Unsaved changes</span>}
          </div>
        </div>

        <div className="header-actions">
          <button 
            onClick={() => setShowAddCourseModal(true)} 
            className="add-course-btn"
            disabled={saving}
          >
            ➕ Add Course
          </button>
          <button 
            onClick={handleSaveAs} 
            className="save-as-btn"
            disabled={saving}
            title="Create a copy of this schedule"
          >
            📋 Save As...
          </button>
          
          {/* Multi-select controls */}
          <div className="multi-select-divider" style={{width: '1px', height: '30px', background: '#dee2e6', margin: '0 8px'}}></div>
          
          <button 
            onClick={toggleSelectionMode}
            className={selectionMode ? 'select-btn active' : 'select-btn'}
            disabled={saving}
            title="Toggle selection mode"
          >
            {selectionMode ? '✅ Exit Select' : '☑️ Select'}
          </button>
          
          {/* Bulk controls - only show when events are selected */}
          {selectionMode && selectedEventIds.length > 0 && (
            <>
              <div className="bulk-controls">
                <span className="selection-count">{selectedEventIds.length} selected</span>
                
                <div className="color-section">
                  <div className="color-palette">
                    {colorPalette.map((colorOption) => (
                      <button
                        key={colorOption.id}
                        type="button"
                        className={`color-option ${bulkColor === colorOption.backgroundColor ? 'selected' : ''}`}
                        style={{ 
                          backgroundColor: colorOption.backgroundColor,
                          color: colorOption.textColor,
                          border: `2px solid ${colorOption.borderColor}`,
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          margin: '0 2px'
                        }}
                        onClick={() => setBulkColor(colorOption.backgroundColor)}
                        title={colorOption.name}
                      >
                      </button>
                    ))}
                  </div>
                  <input
                    type="color"
                    value={bulkColor || '#007bff'}
                    onChange={(e) => setBulkColor(e.target.value)}
                    className="custom-color-picker"
                    title="Custom Color"
                  />
                </div>
                
                <select
                  value={bulkTrainer}
                  onChange={(e) => setBulkTrainer(e.target.value)}
                  className="bulk-trainer-picker"
                >
                  <option value="">Choose Trainer</option>
                  {trainers.map((trainer) => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name} {trainer.email && `(${trainer.email})`}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={handleBulkSave}
                  className="bulk-save-btn"
                  disabled={bulkSaving || (!bulkColor && !bulkTrainer)}
                >
                  {bulkSaving ? '⏳ Saving...' : '💾 Save Selected'}
                </button>
              </div>
            </>
          )}
          
          <button onClick={discardChanges} className="cancel-btn">
            Cancel
          </button>
          <button 
            onClick={saveChanges} 
            className="save-btn" 
            disabled={!hasChanges || saving}
          >
            {saving ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      <div className="editor-instructions">
        <p>
          <strong>Instructions:</strong> Drag sessions to reschedule them. 
          Click and drag the edges to resize session duration. 
          Changes are tracked automatically.
        </p>
      </div>

      <div className="editor-content">
        {sessionsForCalendar && Object.keys(sessionsForCalendar).length > 0 ? (
          <ScheduleCalendar
            key="schedule-calendar-singleton"
            sessions={sessionsForCalendar}
            onSessionUpdated={handleSessionUpdate}
            criteria={schedule.criteria}
            selectionMode={selectionMode}
            selectedEventIds={selectedEventIds}
            onEventSelection={handleEventSelection}
          />
        ) : (
          <div className="empty-schedule">
            <h3>📅 No Sessions Found</h3>
            <p>This schedule doesn't contain any sessions.</p>
          </div>
        )}
      </div>

      {/* Session Statistics */}
      <div className="editor-footer">
        <div className="session-stats">
          <div className="stat-item">
            <strong>Total Sessions:</strong> {
              (() => {
                try {
                  return Object.values(sessionsForCalendar)
                    .flatMap(trainingLocations => Object.values(trainingLocations || {}))
                    .flatMap(classrooms => Object.values(classrooms || {}))
                    .flatMap(sessions => sessions || []).length;
                } catch (error) {
                  console.warn('Error calculating session count:', error);
                  return 0;
                }
              })()
            }
          </div>
          <div className="stat-item">
            <strong>Functional Areas:</strong> {Object.keys(sessionsForCalendar || {}).length}
          </div>
          <div className="stat-item">
            <strong>Unique Courses:</strong> {
              (() => {
                try {
                  return [...new Set(
                    Object.values(sessionsForCalendar)
                      .flatMap(trainingLocations => Object.values(trainingLocations || {}))
                      .flatMap(classrooms => Object.values(classrooms || {}))
                      .flatMap(sessions => sessions || [])
                      .map(session => session.course?.course_name || session.course_name || 'Unknown Course')
                      .filter(Boolean)
                  )].length;
                } catch (error) {
                  console.warn('Error calculating unique courses:', error);
                  return 0;
                }
              })()
            }
          </div>
        </div>
      </div>

      {/* Add Course Modal */}
      <AddCourseToScheduleModal
        isOpen={showAddCourseModal}
        onClose={() => setShowAddCourseModal(false)}
        schedule={schedule}
        currentSessions={sessionsForCalendar}
        onCourseAdded={handleCourseAdded}
      />

      {/* Save As Modal */}
      {showSaveAsModal && (
        <div className="modal-overlay">
          <div className="modal-content save-as-modal" style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid #dee2e6'
          }}>
            <div className="modal-header">
              <h2>📋 Save Schedule As...</h2>
              <button 
                onClick={() => setShowSaveAsModal(false)} 
                className="close-btn"
                disabled={saveAsLoading}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="save-as-info" style={{
                background: '#f8f9fa',
                padding: '16px',
                borderRadius: '4px',
                marginBottom: '20px',
                border: '1px solid #dee2e6'
              }}>
                <p style={{ margin: '0 0 8px 0' }}><strong>Original Schedule:</strong> {schedule.name}</p>
                <p style={{ margin: '0' }}><strong>Sessions to copy:</strong> {
                  (() => {
                    try {
                      return Object.values(sessionsForCalendar)
                        .flatMap(trainingLocations => Object.values(trainingLocations || {}))
                        .flatMap(classrooms => Object.values(classrooms || {}))
                        .flatMap(sessions => sessions || []).length;
                    } catch (error) {
                      return 0;
                    }
                  })()
                }</p>
              </div>

              <div className="form-group">
                <label htmlFor="save-as-name">New Schedule Name: *</label>
                <input
                  type="text"
                  id="save-as-name"
                  value={saveAsForm.name}
                  onChange={(e) => setSaveAsForm({ ...saveAsForm, name: e.target.value })}
                  placeholder="Enter name for the new schedule"
                  disabled={saveAsLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="save-as-description">Description (Optional):</label>
                <textarea
                  id="save-as-description"
                  value={saveAsForm.description}
                  onChange={(e) => setSaveAsForm({ ...saveAsForm, description: e.target.value })}
                  placeholder="Optional description for the new schedule"
                  disabled={saveAsLoading}
                  rows="3"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => setShowSaveAsModal(false)} 
                className="cancel-btn"
                disabled={saveAsLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAsSubmit} 
                className="save-btn"
                disabled={saveAsLoading || !saveAsForm.name.trim()}
              >
                {saveAsLoading ? '⏳ Creating Copy...' : '📋 Create Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleEditor;