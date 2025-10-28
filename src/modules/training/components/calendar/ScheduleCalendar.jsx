import React, { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import SessionEditModal from '../schedule-manager/SessionEditModal';
import { getColorByCourseTitle } from '@core/utils/colorUtils';
import { supabase } from '@core/services/supabaseClient';
import { addWeeks, startOfWeek, format } from 'date-fns';
import './ScheduleCalendar.css';

// Utility function to generate stable session identifiers (matches ScheduleEditor and DragDropAssignmentPanel)
const generateStableSessionId = (session, location = null) => {
  const courseId = session.course_id || session.course?.course_id || 'unknown';
  const sessionNumber = session.sessionNumber || session.session_number || 1;
  const groupName = (session.groupName || session.group_name || 'default').replace(/\s+/g, '-').toLowerCase();
  const functionalArea = (session.functional_area || 'general').replace(/\s+/g, '-').toLowerCase();
  
  // Extract part number from title to differentiate Part 1, Part 2, etc.
  let partSuffix = '';
  if (session.title && session.title.includes('Part ')) {
    const partMatch = session.title.match(/Part (\d+)/);
    if (partMatch) {
      partSuffix = `-part${partMatch[1]}`;
    }
  }
  
  // For FullCalendar rendering, include location to ensure uniqueness across multiple calendar instances
  const locationSuffix = location ? `-${location.replace(/\s+/g, '-').toLowerCase()}` : '';
  
  return `${courseId}-session${sessionNumber}-${groupName}-${functionalArea}${partSuffix}${locationSuffix}`;
};

const ScheduleCalendar = ({ sessions, onSessionUpdated, criteria, selectionMode = false, selectedEventIds = [], onEventSelection }) => {
  const [editingSession, setEditingSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locationDisplayOrders, setLocationDisplayOrders] = useState({});
  const calendarRefs = useRef({});
  const workingSessionsRef = useRef(null); // Persist working sessions across re-renders
  const hasInitializedSessionsRef = useRef(false); // Track if we've initialized working sessions

  // Helper function to extract all session dates from the nested structure
  const extractSessionDates = (sessionsData) => {
    const dates = [];

    // Structure: functional_area -> training_location -> classroom -> [sessions]
    Object.values(sessionsData || {}).forEach(locations => {
      Object.values(locations || {}).forEach(classrooms => {
        Object.values(classrooms || {}).forEach(sessionList => {
          if (Array.isArray(sessionList)) {
            sessionList.forEach(session => {
              if (session.start) {
                const startDate = new Date(session.start);
                if (!isNaN(startDate.getTime())) {
                  dates.push(startDate);
                }
              }
            });
          }
        });
      });
    });

    return dates;
  };

  // Helper function to calculate optimal date range from sessions
  const calculateDateRangeFromSessions = (sessionsData) => {
    const sessionDates = extractSessionDates(sessionsData);

    if (sessionDates.length === 0) {
      // No sessions found, use default 8 weeks from today
      console.log('📅 No sessions found, using default date range');
      return {
        start: startOfWeek(new Date()),
        end: addWeeks(startOfWeek(new Date()), 8),
        weekCount: 8,
        autoDetected: false
      };
    }

    // Find earliest and latest session dates
    const earliestDate = new Date(Math.min(...sessionDates.map(d => d.getTime())));
    const latestDate = new Date(Math.max(...sessionDates.map(d => d.getTime())));

    // Expand to full weeks (start from Monday of earliest week, end on Sunday of latest week)
    const rangeStart = startOfWeek(earliestDate);
    const rangeEnd = addWeeks(startOfWeek(latestDate), 1); // Include the full week

    // Calculate number of weeks
    const weeks = Math.ceil((rangeEnd - rangeStart) / (7 * 24 * 60 * 60 * 1000));

    console.log('📅 Auto-detected date range from sessions:', {
      earliestSession: earliestDate.toISOString(),
      latestSession: latestDate.toISOString(),
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      totalWeeks: weeks,
      totalSessions: sessionDates.length
    });

    return {
      start: rangeStart,
      end: rangeEnd,
      weekCount: weeks,
      autoDetected: true
    };
  };

  // Date range state for multi-week view - initialize with auto-detected range
  // Use useMemo to ensure initial calculation only happens once
  const initialDateRange = React.useMemo(() => calculateDateRangeFromSessions(sessions), []);
  const [dateRangeStart, setDateRangeStart] = useState(initialDateRange.start);
  const [dateRangeEnd, setDateRangeEnd] = useState(initialDateRange.end);
  const [weekCount, setWeekCount] = useState(initialDateRange.weekCount);
  const [isAutoDetected, setIsAutoDetected] = useState(initialDateRange.autoDetected);
  const [hasAutoDetectedOnce, setHasAutoDetectedOnce] = useState(false);

  // Navigation handlers - shift date range by 1 week
  const navigatePreviousWeek = () => {
    setDateRangeStart(prev => addWeeks(prev, -1));
    setDateRangeEnd(prev => addWeeks(prev, -1));
    setIsAutoDetected(false);
  };

  const navigateNextWeek = () => {
    setDateRangeStart(prev => addWeeks(prev, 1));
    setDateRangeEnd(prev => addWeeks(prev, 1));
    setIsAutoDetected(false);
  };

  // Helper to find the first session date
  const findFirstSessionDate = () => {
    const sessionDates = extractSessionDates(sessionsToRender);
    if (sessionDates.length === 0) return null;
    return new Date(Math.min(...sessionDates.map(d => d.getTime())));
  };

  // Navigate all calendars when dateRangeStart changes (via Previous/Next buttons)
  useEffect(() => {
    if (!dateRangeStart) return;

    // Use setTimeout to ensure calendars are mounted
    setTimeout(() => {
      Object.entries(calendarRefs.current).forEach(([calendarKey, calendarRef]) => {
        if (calendarRef && calendarRef.getApi) {
          const api = calendarRef.getApi();
          api.gotoDate(dateRangeStart);
        }
      });
    }, 50);
  }, [dateRangeStart]);

  // Fetch location display orders from database
  const fetchLocationDisplayOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('active_training_locations')
        .select('name, display_order');
      
      if (error) {
        console.error('Error fetching location display orders:', error);
        return;
      }

      const displayOrderMap = {};
      data.forEach(location => {
        displayOrderMap[location.name] = location.display_order || 999;
      });
      setLocationDisplayOrders(displayOrderMap);
    } catch (err) {
      console.error('Error fetching location display orders:', err);
    }
  };

  // Only fetch location display orders once on mount
  useEffect(() => {
    console.log('📅 ScheduleCalendar mounted');
    fetchLocationDisplayOrders();
  }, []); // Empty dependency array - only run once on mount

  // Initialize working sessions ONCE and persist them across re-renders
  // This prevents the calendar from refreshing when switching windows
  useEffect(() => {
    if (!hasInitializedSessionsRef.current && sessions) {
      console.log('📅 ScheduleCalendar initializing working sessions (ONCE ONLY)');
      workingSessionsRef.current = JSON.parse(JSON.stringify(sessions)); // Deep clone to break reference
      hasInitializedSessionsRef.current = true;
    }
  }, []); // Empty dependency - initialize once and never update from props

  // Use working sessions ref for rendering, fallback to props if not initialized
  // CRITICAL: Always use ref, never use sessions prop after initialization
  const sessionsToRender = workingSessionsRef.current || sessions;

  console.log('🔍 ScheduleCalendar render check:', {
    hasInitialized: hasInitializedSessionsRef.current,
    usingRef: !!workingSessionsRef.current,
    sessionsFromProps: sessions ? Object.keys(sessions).length : 0,
    sessionsToRender: sessionsToRender ? Object.keys(sessionsToRender).length : 0
  });

  // Removed selection functionality - TSC Wizard is read-only


  // Removed bulk operation handlers - TSC Wizard is read-only
  const handleEventClick = (info) => {
    // Don't open modal when in selection mode
    if (selectionMode) {
      console.log('🚫 Modal disabled during selection mode');
      return;
    }
    
    console.log('🖱️ Event clicked:', info.event);
    console.log('📊 Event properties:', info.event.extendedProps);
    console.log('🏷️ Event title:', info.event.title);
    console.log('⏰ Event start:', info.event.start);
    console.log('⏰ Event end:', info.event.end);
    
    const session = {
      ...info.event.extendedProps,
      // Use the actual event data, not the extended props for timing
      start: info.event.start,
      end: info.event.end,
      title: info.event.title,
      // Preserve original identifying information
      originalStart: info.event.start,
      originalEnd: info.event.end,
      originalTitle: info.event.title,
      // Use the session's event ID or the calendar event ID
      eventId: info.event.extendedProps.eventId || info.event.id
    };
    
    console.log('🎯 Session prepared for editing:', session);
    setEditingSession(session);
    setIsModalOpen(true);
  };

  const handleSessionSave = async (updatedSession) => {
    try {
      console.log('💾 ScheduleCalendar: Saving updated session:', updatedSession);
      console.log('💾 Session update details:', {
        eventId: updatedSession.eventId,
        event_id: updatedSession.event_id,
        title: updatedSession.title,
        start: updatedSession.start,
        end: updatedSession.end
      });

      if (typeof onSessionUpdated !== 'function') {
        throw new Error('onSessionUpdated callback is not a function');
      }

      // Update the working sessions ref to persist the changes across view changes
      if (workingSessionsRef.current) {
        const updatedSessions = JSON.parse(JSON.stringify(workingSessionsRef.current));

        // Find and update the session in the nested structure
        const functionalArea = updatedSession.functional_area;
        const location = updatedSession.location || updatedSession.groupName;
        const classroomName = updatedSession.classroomName;

        if (updatedSessions[functionalArea]?.[location]?.[classroomName]) {
          const sessionList = updatedSessions[functionalArea][location][classroomName];
          const sessionIndex = sessionList.findIndex(s => {
            // Match by multiple criteria to find the exact session
            const startMatch = new Date(s.start).getTime() === new Date(updatedSession.originalStart || updatedSession.start).getTime();
            const titleMatch = s.title === (updatedSession.originalTitle || updatedSession.title);
            return startMatch && titleMatch;
          });

          if (sessionIndex !== -1) {
            // Update the session with new data
            sessionList[sessionIndex] = {
              ...sessionList[sessionIndex],
              ...updatedSession,
              start: updatedSession.start,
              end: updatedSession.end,
              title: updatedSession.custom_title || updatedSession.title,
              custom_title: updatedSession.custom_title,
              trainer_name: updatedSession.trainer_name,
              instructor_name: updatedSession.instructor_name
            };

            workingSessionsRef.current = updatedSessions;
            console.log('✅ Updated working sessions ref with saved changes');
          } else {
            console.warn('⚠️ Could not find session to update in working sessions ref');
          }
        }
      }

      await onSessionUpdated(updatedSession);
      console.log('✅ ScheduleCalendar: Session saved successfully');
      setIsModalOpen(false);
      setEditingSession(null);
    } catch (error) {
      console.error('❌ Error in ScheduleCalendar save:', error);
      console.error('💥 Full error details:', {
        message: error.message,
        stack: error.stack,
        updatedSession: updatedSession
      });
      // Don't close modal on error so user can try again
      alert('Error saving session: ' + error.message);
    }
  };

  const handleSessionDelete = async (sessionToDelete) => {
    try {
      console.log('🗑️ ScheduleCalendar: Deleting session:', sessionToDelete);
      
      if (typeof onSessionUpdated !== 'function') {
        throw new Error('onSessionUpdated callback is not a function');
      }
      
      // Mark the session as deleted - the parent will handle removing it from the schedule
      const deletedSession = {
        ...sessionToDelete,
        _deleted: true // Flag to indicate this session should be removed
      };
      
      await onSessionUpdated(deletedSession);
      console.log('✅ ScheduleCalendar: Session deleted successfully');
      setIsModalOpen(false);
      setEditingSession(null);
    } catch (error) {
      console.error('❌ Error in ScheduleCalendar delete:', error);
      alert('Error deleting session: ' + error.message);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingSession(null);
  };




  const renderEventContent = (eventInfo) => {
    const session = eventInfo.event.extendedProps;
    const trainerName = session.trainer_name || session.instructor_name;
    const location = session.location;
    const classroomNumber = session.classroomNumber;
    const functionalArea = session.functional_area;
    const startTime = eventInfo.event.start ? eventInfo.event.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    const endTime = eventInfo.event.end ? eventInfo.event.end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    
    const sessionId = eventInfo.event.extendedProps.id || eventInfo.event.extendedProps.event_id || eventInfo.event.id;
    const isSelected = selectedEventIds.includes(sessionId);
    
    return (
      <div className="custom-event-content">
        {selectionMode && (
          <div 
            className="event-selection-checkbox"
            onClick={(e) => {
              e.stopPropagation();
              if (onEventSelection) {
                // Use the database session ID, not the calendar event ID
                const sessionId = eventInfo.event.extendedProps.id || eventInfo.event.extendedProps.event_id || eventInfo.event.id;
                onEventSelection(sessionId, !isSelected);
              }
            }}
            title="Click to select/deselect this event"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                // Handle change event to show tick
                e.stopPropagation();
                if (onEventSelection) {
                  const sessionId = eventInfo.event.extendedProps.id || eventInfo.event.extendedProps.event_id || eventInfo.event.id;
                  onEventSelection(sessionId, e.target.checked);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="event-table">
          <div className="event-row event-title-row">
            <div className="event-title">{eventInfo.event.title}</div>
          </div>
          {functionalArea && (
            <div className="event-row event-functional-area-row">
              <span className="event-label">Area:</span>
              <span className="event-value">{functionalArea}</span>
            </div>
          )}
          {trainerName && (
            <div className="event-row event-trainer-row">
              <span className="event-label">Trainer:</span>
              <span className="event-value">{trainerName}</span>
            </div>
          )}
          {location && location !== 'TBD' && (
            <div className="event-row event-location-row">
              <span className="event-label">Location:</span>
              <span className="event-value">{location}</span>
            </div>
          )}
          {startTime && endTime && (
            <div className="event-row event-time-row">
              <span className="event-label">Time:</span>
              <span className="event-value">{startTime} - {endTime}</span>
            </div>
          )}
          {session.current_participants && session.max_participants && (
            <div className="event-row event-participants-row">
              <span className="event-label">Participants:</span>
              <span className="event-value">{session.current_participants}/{session.max_participants}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleEventUpdate = (info) => {
    console.log('🔄 Event updated:', info.event);
    console.log('📋 Extended props:', info.event.extendedProps);
    
    // Get the calendar instance from the event's extended props
    const eventCalendarInstance = info.event.extendedProps.calendarInstance;
    console.log('📅 Event from calendar instance:', eventCalendarInstance);
    
    // Store the current calendar view/date before making changes for ALL calendars
    const currentCalendarViews = {};
    Object.entries(calendarRefs.current).forEach(([calendarKey, calendarRef]) => {
      if (calendarRef && calendarRef.getApi) {
        const api = calendarRef.getApi();
        currentCalendarViews[calendarKey] = {
          date: api.getDate(),
          viewType: api.view.type
        };
      }
    });
    
    // Store original times for session matching
    const originalStart = info.oldEvent.start;
    const originalEnd = info.oldEvent.end;
    
    // Store current calendar views for preservation 
    setTimeout(() => {
      Object.entries(currentCalendarViews).forEach(([calendarKey, viewState]) => {
        const calendarRef = calendarRefs.current[calendarKey];
        if (calendarRef && calendarRef.getApi) {
          const api = calendarRef.getApi();
          api.gotoDate(viewState.date);
          if (api.view.type !== viewState.viewType) {
            api.changeView(viewState.viewType);
          }
        }
      });
    }, 0);
    
    // Then immediately update it to the new position via our data flow
    const updatedSession = {
      ...info.oldEvent.extendedProps,
      start: info.event.start,
      end: info.event.end,
      title: info.event.title,
      // Ensure we have the base eventId without location suffix for ScheduleEditor
      eventId: generateStableSessionId(info.oldEvent.extendedProps),
      // Preserve the calendar instance identifier
      calendarInstance: eventCalendarInstance,
      // CRITICAL: Add original time for precise session matching
      originalStart: originalStart,
      originalEnd: originalEnd
    };

    console.log('📍 Updating session via data flow:', updatedSession.title, 'from instance:', eventCalendarInstance);
    console.log('🕐 Drag operation times:', {
      title: updatedSession.title,
      eventId: updatedSession.eventId,
      originalStart: originalStart,
      originalEnd: originalEnd,
      originalStartHour: originalStart?.getHours(),
      originalStartMinutes: originalStart?.getMinutes(),
      newStart: info.event.start,
      newEnd: info.event.end,
      newStartHour: info.event.start?.getHours(),
      newStartMinutes: info.event.start?.getMinutes(),
      timeDiff: info.event.start.getTime() - originalStart.getTime(),
      timeDiffHours: (info.event.start.getTime() - originalStart.getTime()) / (1000 * 60 * 60),
      draggedFromAMtoPM: originalStart?.getHours() < 12 && info.event.start?.getHours() >= 12,
      draggedFromPMtoAM: originalStart?.getHours() >= 12 && info.event.start?.getHours() < 12,
      partNumber: updatedSession.title.match(/Part (\d+)/)?.[1]
    });

    // Update the working sessions ref to persist drag/drop changes across view changes
    if (workingSessionsRef.current) {
      const updatedSessions = JSON.parse(JSON.stringify(workingSessionsRef.current));

      const functionalArea = updatedSession.functional_area;
      const location = updatedSession.location || updatedSession.groupName;
      const classroomName = updatedSession.classroomName;

      if (updatedSessions[functionalArea]?.[location]?.[classroomName]) {
        const sessionList = updatedSessions[functionalArea][location][classroomName];
        const sessionIndex = sessionList.findIndex(s => {
          const startMatch = new Date(s.start).getTime() === originalStart.getTime();
          const titleMatch = s.title === updatedSession.title;
          return startMatch && titleMatch;
        });

        if (sessionIndex !== -1) {
          sessionList[sessionIndex] = {
            ...sessionList[sessionIndex],
            start: updatedSession.start,
            end: updatedSession.end
          };

          workingSessionsRef.current = updatedSessions;
          console.log('✅ Updated working sessions ref with drag/drop changes');
        }
      }
    }

    // Pass the updated session to the parent component
    // This will trigger a re-render with the correct position
    onSessionUpdated(updatedSession);
    
    // Also restore view state after the parent updates complete
    setTimeout(() => {
      Object.entries(currentCalendarViews).forEach(([calendarKey, viewState]) => {
        const calendarRef = calendarRefs.current[calendarKey];
        if (calendarRef && calendarRef.getApi) {
          const api = calendarRef.getApi();
          api.gotoDate(viewState.date);
          if (api.view.type !== viewState.viewType) {
            api.changeView(viewState.viewType);
          }
        }
      });
    }, 100); // Longer delay to ensure parent update completes
  };


  // Sessions are now already in the format: functional_area -> training_location -> classroom -> [sessions]
  // We need to extract the classroom-grouped sessions for calendar display while preserving order
  const classroomSessions = {};

  // Iterate through the new structure to extract classroom sessions, preserving original key order
  // IMPORTANT: Use sessionsToRender (working sessions ref) NOT sessions prop
  Object.keys(sessionsToRender).forEach(functionalArea => {
    const locations = sessionsToRender[functionalArea];
    Object.keys(locations).forEach(location => {
      if (!classroomSessions[location]) {
        classroomSessions[location] = {};
      }

      const classrooms = locations[location];
      // Sort classroom names to ensure consistent order (Classroom 1, Classroom 2, etc.)
      const sortedClassroomNames = Object.keys(classrooms).sort((a, b) => {
        // Extract numbers from classroom names for proper numeric sorting
        const aNumber = parseInt(a.replace(/[^\d]/g, '')) || 0;
        const bNumber = parseInt(b.replace(/[^\d]/g, '')) || 0;
        return aNumber - bNumber;
      });

      sortedClassroomNames.forEach(classroomName => {
        if (!classroomSessions[location][classroomName]) {
          classroomSessions[location][classroomName] = [];
        }
        classroomSessions[location][classroomName].push(...classrooms[classroomName]);
      });
    });
  });

  // Debug: Log classroom assignments
  console.log('🏫 CALENDAR DEBUG: Final classroom sessions structure:', classroomSessions);
  Object.entries(sessionsToRender).forEach(([functionalArea, locations]) => {
    Object.entries(locations).forEach(([location, classrooms]) => {
      const allLocationSessions = Object.values(classrooms).flat();
      console.log(`🏫 CALENDAR DEBUG: ${functionalArea} - ${location} sessions:`, allLocationSessions.map(s => ({
        title: s.title,
        classroomNumber: s.classroomNumber,
        sessionId: s.sessionId
      })));
    });
  });

  // Sort locations by display_order, then alphabetically as fallback
  const sortedLocationEntries = Object.entries(classroomSessions).sort(([locationA], [locationB]) => {
    const orderA = locationDisplayOrders[locationA] || 999;
    const orderB = locationDisplayOrders[locationB] || 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // If display orders are the same, sort alphabetically
    return locationA.localeCompare(locationB);
  });

  return (
    <div className="calendar-wrapper">
      {/* Removed bulk operations toolbar - TSC Wizard is read-only */}

      {/* Date Range Filter */}
      <div className="date-range-filter">
        <div className="filter-header">
          <h4>📅 Date Range Filter</h4>
          {isAutoDetected && (
            <span className="auto-detect-badge" title="Date range automatically detected from your training sessions">
              ✨ Auto-detected ({weekCount} {weekCount === 1 ? 'week' : 'weeks'})
            </span>
          )}
        </div>

        <div className="filter-controls">
          {/* Navigation Buttons */}
          <div className="navigation-controls">
            <button
              onClick={navigatePreviousWeek}
              className="nav-btn prev-btn"
              title="Go back 1 week"
            >
              ◀ Previous Week
            </button>

            <div className="date-inputs">
              <div className="date-input-group">
                <label>From:</label>
                <input
                  type="date"
                  value={format(dateRangeStart, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const newStart = new Date(e.target.value);
                    setDateRangeStart(newStart);
                    setDateRangeEnd(addWeeks(newStart, weekCount));
                    setIsAutoDetected(false);
                  }}
                />
              </div>

              <div className="date-input-group">
                <label>To:</label>
                <input
                  type="date"
                  value={format(dateRangeEnd, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    setDateRangeEnd(new Date(e.target.value));
                    setIsAutoDetected(false);
                  }}
                />
              </div>
            </div>

            <button
              onClick={navigateNextWeek}
              className="nav-btn next-btn"
              title="Go forward 1 week"
            >
              Next Week ▶
            </button>
          </div>

          <div className="preset-buttons">
            <button
              onClick={() => {
                // Find the first session date and navigate to that week
                const firstSessionDate = findFirstSessionDate();
                const start = firstSessionDate
                  ? startOfWeek(firstSessionDate)
                  : startOfWeek(new Date());

                setDateRangeStart(start);
                setDateRangeEnd(addWeeks(start, 1));
                setWeekCount(1);
                setIsAutoDetected(false);

                if (firstSessionDate) {
                  console.log('📅 1 Week view: Navigating to first session:', firstSessionDate.toISOString());
                }
              }}
              className={weekCount === 1 && !isAutoDetected ? 'active' : ''}
              title={findFirstSessionDate()
                ? `Jump to week of first session (${format(findFirstSessionDate(), 'MMM d, yyyy')})`
                : 'Show current week'}
            >
              1 Week
            </button>

            <button
              onClick={() => {
                const start = startOfWeek(new Date());
                setDateRangeStart(start);
                setDateRangeEnd(addWeeks(start, 4));
                setWeekCount(4);
                setIsAutoDetected(false);
              }}
              className={weekCount === 4 && !isAutoDetected ? 'active' : ''}
            >
              4 Weeks
            </button>

            <button
              onClick={() => {
                const start = startOfWeek(new Date());
                setDateRangeStart(start);
                setDateRangeEnd(addWeeks(start, 8));
                setWeekCount(8);
                setIsAutoDetected(false);
              }}
              className={weekCount === 8 && !isAutoDetected ? 'active' : ''}
            >
              8 Weeks
            </button>

            <button
              onClick={() => {
                const start = startOfWeek(new Date());
                setDateRangeStart(start);
                setDateRangeEnd(addWeeks(start, 12));
                setWeekCount(12);
                setIsAutoDetected(false);
              }}
              className={weekCount === 12 && !isAutoDetected ? 'active' : ''}
            >
              12 Weeks
            </button>

            <button
              onClick={() => {
                const autoRange = calculateDateRangeFromSessions(sessionsToRender);
                setDateRangeStart(autoRange.start);
                setDateRangeEnd(autoRange.end);
                setWeekCount(autoRange.weekCount);
                setIsAutoDetected(autoRange.autoDetected);
              }}
              className="reset-btn"
              title="Reset to auto-detected range based on your training sessions"
            >
              🔄 Auto-Detect
            </button>
          </div>
        </div>
      </div>

      {sortedLocationEntries.map(([location, classrooms]) => (
        <div key={location} className="calendar-group">
          <h3 style={{ color: '#495057', borderBottom: '2px solid #007bff', paddingBottom: '8px', marginBottom: '20px' }}>
            📍 {location}
          </h3>
          {Object.entries(classrooms).map(([classroomName, sessionList]) => (
            <div key={classroomName} className="calendar-block" style={{isolation: 'isolate', marginBottom: '25px'}}>
              <h4 style={{ 
                color: '#0066cc', 
                margin: '0 0 15px 0', 
                padding: '8px 12px', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6', 
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🏫 {classroomName}
                <span style={{ 
                  fontSize: '12px', 
                  color: '#6c757d', 
                  fontWeight: 'normal',
                  marginLeft: 'auto'
                }}>
                  {sessionList.length} sessions
                </span>
              </h4>
              <div className="calendar-isolation-wrapper" style={{contain: 'layout style paint'}}>
                <FullCalendar
                  key={`${location}-${classroomName}`}
                  ref={(calendarRef) => {
                    if (calendarRef) {
                      calendarRefs.current[`${location}-${classroomName}`] = calendarRef;
                    }
                  }}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                locale="en-gb"
                views={{
                  timeGridMultiWeek: {
                    type: 'timeGrid',
                    duration: { weeks: weekCount },
                    buttonText: `${weekCount} ${weekCount === 1 ? 'week' : 'weeks'}`
                  }
                }}
                initialView="timeGridMultiWeek"
                initialDate={dateRangeStart}
                allDaySlot={false}
                slotMinTime="07:00:00"
                slotMaxTime="21:00:00"
                height={800}
                contentHeight={800}
                editable={true}
                eventDrop={handleEventUpdate}
                eventResize={handleEventUpdate}
                eventDragStart={(info) => {
                  console.log('🎯 Drag start:', info.event.title);
                  // Store the drag start info for better positioning
                  info.el.style.zIndex = '9999';
                  info.el.style.transform = 'scale(1.05)';
                  info.el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                }}
                eventDragStop={(info) => {
                  console.log('🎯 Drag stop:', info.event.title);
                  // Reset styles
                  info.el.style.zIndex = '';
                  info.el.style.transform = '';
                  info.el.style.boxShadow = '';
                }}
                eventOverlap={true}
                eventConstraint={{
                  start: '07:00:00',
                  end: '21:00:00'
                }}
                selectConstraint={{
                  start: '07:00:00',
                  end: '21:00:00'
                }}
                eventStartEditable={true}
                eventDurationEditable={true}
                dragScroll={true}
                longPressDelay={100}
                eventLongPressDelay={100}
                selectLongPressDelay={100}
                eventAllow={(dropInfo, draggedEvent) => {
                  console.log('🎯 Event allow check:', {
                    draggedTitle: draggedEvent?.title,
                    dropStart: dropInfo.start,
                    dropEnd: dropInfo.end,
                    duration: draggedEvent?.end ? (draggedEvent.end - draggedEvent.start) / (1000 * 60 * 60) : 'unknown'
                  });
                  return true; // Allow all drops for now, but log them
                }}
                eventDidMount={(info) => {
                  console.log('📅 Event mounted:', {
                    title: info.event.title,
                    start: info.event.start,
                    end: info.event.end,
                    duration: info.event.end ? (info.event.end - info.event.start) / (1000 * 60 * 60) : 'unknown',
                    id: info.event.id
                  });
                }}
                forceEventDuration={true}
                nextDayThreshold="00:00:00"
                lazyFetching={false}
                eventMouseEnter={(info) => {
                  // Add hover effect for better visual feedback
                  info.el.style.cursor = 'grab';
                }}
                eventMouseLeave={(info) => {
                  // Remove hover effect
                  info.el.style.cursor = '';
                }}
                dayMaxEvents={false}
                moreLinkClick="popover"
                headerToolbar={{
                  left: 'today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridMultiWeek,timeGridDay'
                }}
                dayHeaderContent={(args) => {
                  const dayName = args.date.toLocaleDateString('en-GB', { weekday: 'short' });
                  const dateNum = args.date.getDate();
                  const monthName = args.date.toLocaleDateString('en-GB', { month: 'short' });

                  return (
                    <div className="custom-day-header">
                      <div className="header-date">{dateNum}</div>
                      <div className="header-month">{monthName}</div>
                      <div className="header-day">{dayName}</div>
                    </div>
                  );
                }}
                events={sessionList.map((session, index) => {
                  // Create a deep copy of the session to prevent shared references
                  const sessionCopy = JSON.parse(JSON.stringify(session));
                  // Restore Date objects
                  if (sessionCopy.start) sessionCopy.start = new Date(sessionCopy.start);
                  if (sessionCopy.end) sessionCopy.end = new Date(sessionCopy.end);
                  
                  // Add unique identifiers to prevent any cross-part interference
                  sessionCopy._uniqueId = `${session.title}-${session.start}-${index}`;
                  sessionCopy._renderIndex = index;
                  
                  // Get automatic color assignment based on course title (TSC Wizard approach)
                  // Extract just the course name, removing group and part information for consistent coloring
                  let courseTitle = sessionCopy.course?.course_name || sessionCopy.title;
                  if (courseTitle && !sessionCopy.course?.course_name) {
                    // Remove group and part information to get consistent course-based coloring
                    // e.g., "Transfers - Group 1 (Part 1)" becomes "Transfers"
                    courseTitle = courseTitle.replace(/\s*-\s*Group\s+\d+.*$/, '').trim();
                  }
                  const autoColor = getColorByCourseTitle(courseTitle);
                  
                  // Use auto-assigned color for consistent display (ignore database colors)
                  const sessionColor = autoColor;

                  const eventId = generateStableSessionId(sessionCopy, location);
                  
                  return {
                    id: eventId,
                    title: sessionCopy.custom_title || sessionCopy.title,
                    start: sessionCopy.start,
                    end: sessionCopy.end,
                    backgroundColor: sessionColor.backgroundColor,
                    borderColor: sessionColor.borderColor,
                    textColor: sessionColor.textColor,
                    extendedProps: {
                      ...sessionCopy,
                      // Store the auto-assigned color for reference
                      autoColor: autoColor,
                      // Ensure we have the functional area context
                      functional_area: sessionCopy.functional_area,
                      groupName: sessionCopy.groupName || location,
                      classroomName: classroomName,
                      classroomNumber: sessionCopy.classroomNumber,
                      // Add calendar instance identifier to prevent cross-calendar updates
                      calendarInstance: `${location}-${classroomName}`,
                      // Debug: Store original session data for assignment matching
                      originalEventId: sessionCopy.eventId,
                      originalTitle: sessionCopy.title,
                      originalStart: sessionCopy.start?.getTime ? sessionCopy.start.getTime() : null
                    }
                  };
                })}
                eventClick={handleEventClick}
                eventContent={renderEventContent}
                eventTimeFormat={{
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                }}
                eventDisplay="block"
                eventMinHeight={30}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
      
      <SessionEditModal
        session={editingSession}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSessionSave}
        onDelete={handleSessionDelete}
        criteria={criteria?.default || criteria}
      />
      
      {/* Removed bulk operation modals - TSC Wizard is read-only */}
    </div>
  );
};

// Wrap in React.memo to prevent re-renders when parent re-renders
// This is critical to prevent calendar refresh when switching windows
export default React.memo(ScheduleCalendar, (prevProps, nextProps) => {
  // React.memo comparison function returns TRUE if props are EQUAL (no re-render needed)
  // Returns FALSE if props changed (re-render needed)

  // Check if props are equal (if all are same, return true = skip re-render)
  const propsAreEqual =
    prevProps.selectionMode === nextProps.selectionMode &&
    (prevProps.selectedEventIds || []).length === (nextProps.selectedEventIds || []).length &&
    JSON.stringify(prevProps.criteria) === JSON.stringify(nextProps.criteria) &&
    prevProps.sessions === nextProps.sessions; // Check if sessions reference is same

  console.log('🔍 React.memo comparison:', {
    propsAreEqual,
    willRerender: !propsAreEqual,
    selectionModeChanged: prevProps.selectionMode !== nextProps.selectionMode,
    selectedIdsChanged: (prevProps.selectedEventIds || []).length !== (nextProps.selectedEventIds || []).length,
    criteriaChanged: JSON.stringify(prevProps.criteria) !== JSON.stringify(nextProps.criteria),
    sessionsRefChanged: prevProps.sessions !== nextProps.sessions
  });

  return propsAreEqual; // TRUE = props equal, skip re-render
});
