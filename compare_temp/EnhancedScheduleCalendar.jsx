import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getColorByCourseTitle } from '../utils/colorUtils';
import { supabase } from '../supabaseClient';
import { generateEventIdFromSession } from '../utils/eventIdUtils';
// Temporarily enable debug logging for classroom troubleshooting
import { debugLog, debugWarn, debugError } from '../utils/consoleUtils';
import './EnhancedScheduleCalendar.css';

const EnhancedScheduleCalendar = ({ 
  sessions, 
  onSessionUpdated, 
  criteria,
  dragMode = false,
  capacityData = {},
  assignments = [],
  currentSchedule,
  onScheduleChange,
  onAssignmentUpdate,
  hiddenDays = [],
  onUserContextMenu,
  onRemoveFromGroup,
  onRemoveFromCourse,
  // New props for stakeholder mode
  onSessionClick,
  readOnlyMode = false,
  stakeholderMode = false
}) => {
  const [userAssignments, setUserAssignments] = useState([]);
  const [locationDisplayOrders, setLocationDisplayOrders] = useState({});
  // Use refs instead of state to prevent re-renders from datesSet callback
  const calendarViewRef = useRef('timeGridWeek');
  const calendarDateRef = useRef(new Date());
  
  // Cache for assignment data to prevent repeated database calls
  const assignmentsCacheRef = useRef(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  debugLog('📅 EnhancedScheduleCalendar rendering with drag mode:', dragMode);
  debugLog('📅 ASSIGNMENTS PROP CHECK:', {
    assignmentsReceived: !!assignments,
    assignmentsLength: assignments?.length || 0,
    assignmentsType: typeof assignments,
    assignmentsIsArray: Array.isArray(assignments)
  });
  debugLog('📅 Sessions data:', sessions);
  debugLog('📅 Sessions type:', typeof sessions);
  debugLog('📅 Sessions is array:', Array.isArray(sessions));
  if (Array.isArray(sessions) && sessions.length > 0) {
    debugLog('📅 First session sample:', sessions[0]);
  }

  // Memoize assignments to prevent unnecessary re-renders - simplified for better change detection
  const memoizedAssignments = useMemo(() => {
    // Only log changes, not on every render
    debugLog(`📊 CALENDAR: Assignments prop changed - length: ${assignments?.length || 0}`);
    
    // If assignments is null or undefined, return empty array to stabilize
    if (!assignments) {
      return [];
    }
    
    // Deep stabilize the assignments array to prevent object reference changes from causing re-renders
    return assignments.map(assignment => ({
      id: assignment.id,
      end_user_id: assignment.end_user_id,
      session_identifier: assignment.session_identifier,
      session_id: assignment.session_id,
      assignment_level: assignment.assignment_level,
      training_location: assignment.training_location,
      course_id: assignment.course_id,
      group_identifier: assignment.group_identifier,
      functional_area: assignment.functional_area,
      end_users: assignment.end_users ? {
        id: assignment.end_users.id,
        name: assignment.end_users.name,
        email: assignment.end_users.email,
        project_role: assignment.end_users.project_role,
        training_location: assignment.end_users.training_location
      } : null
    }));
  }, [assignments]);

  // Use refs to track previous state
  const previousAssignments = useRef(null);


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

  // Fetch location display orders when component mounts or sessions change
  useEffect(() => {
    fetchLocationDisplayOrders();
  }, [sessions]);



  const fetchUserAssignments = async (scheduleId) => {
    debugLog('🔥 fetchUserAssignments CALLED with scheduleId:', scheduleId);
    try {
      const { data, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users (id, name, project_role, training_location)
        `)
        .eq('schedule_id', scheduleId);

      if (error) {
        debugWarn('🔥 Assignment query failed, trying basic query:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .select('*')
          .eq('schedule_id', scheduleId);
        
        if (!basicError && basicData) {
          const userIds = [...new Set(basicData.map(assignment => assignment.end_user_id))];
          const { data: userData, error: userError } = await supabase
            .from('end_users')
            .select('id, name, project_role, training_location')
            .in('id', userIds);
          
          if (!userError && userData) {
            const enrichedAssignments = basicData.map(assignment => ({
              ...assignment,
              end_users: userData.find(user => user.id === assignment.end_user_id)
            }));
            debugLog('🔥 Setting enrichedAssignments:', enrichedAssignments.length);
            setUserAssignments(enrichedAssignments);
          } else {
            debugLog('🔥 Setting basicData:', basicData.length);
            setUserAssignments(basicData);
          }
        }
        return;
      }

      debugLog('🔥 Fetched user assignments from database:', {
        count: data?.length || 0,
        assignments: data?.map(a => ({
          level: a.assignment_level,
          userId: a.end_user_id,
          userName: a.end_users?.name,
          sessionId: a.session_identifier,
          courseId: a.course_id,
          groupId: a.group_identifier
        })) || []
      });
      debugLog('🔥 Setting userAssignments from database:', data?.length || 0);
      setUserAssignments(data || []);
    } catch (err) {
      debugError('🔥 ERROR in fetchUserAssignments - CLEARING userAssignments:', err);
      setUserAssignments([]);
    }
  };

  // Single promise to prevent race conditions
  const loadingPromiseRef = useRef(null);

  // Load all assignments once and cache them
  const loadAllAssignments = useCallback(async () => {
    if (!currentSchedule?.id) return [];
    
    // Return cached data if available and not stale
    if (assignmentsCacheRef.current && assignmentsCacheRef.current.scheduleId === currentSchedule.id) {
      return assignmentsCacheRef.current.data;
    }

    // If already loading, return the existing promise
    if (loadingPromiseRef.current) {
      return loadingPromiseRef.current;
    }

    // Create a new loading promise
    loadingPromiseRef.current = (async () => {
      try {
        setAssignmentsLoading(true);
        
        const { data: assignments, error } = await supabase
          .from('user_assignments')
          .select(`
            *,
            end_users!inner(
              id,
              name,
              email,
              project_role,
              training_location
            )
          `)
          .eq('schedule_id', currentSchedule.id);

        if (error) {
          debugError('🔍 Error fetching assignments:', error);
          return [];
        }

        // Cache the results
        assignmentsCacheRef.current = {
          scheduleId: currentSchedule.id,
          data: assignments || [],
          timestamp: Date.now()
        };

        setUserAssignments(assignments || []);
        return assignments || [];
        
      } catch (err) {
        debugError('🔍 Error loading assignments:', err);
        return [];
      } finally {
        setAssignmentsLoading(false);
        // Clear the loading promise
        loadingPromiseRef.current = null;
      }
    })();

    return loadingPromiseRef.current;
  }, [currentSchedule?.id]);

  // Get assigned users for a session - use cached data
  const getAssignedUsersForSession = useCallback(async (session) => {
    debugLog(`🔍 GETTING USERS for session: ${session.title}, using cached data`);
    
    const allAssignments = await loadAllAssignments();
    
    if (!allAssignments || allAssignments.length === 0) {
      return [];
    }

    // Filter assignments for this specific session using existing logic
    const sessionId = session.eventId || session.id || 
      `${session.title || 'untitled'}-${new Date(session.start).getTime()}-${new Date(session.end).getTime()}`;
    
    const matchingAssignments = allAssignments.filter(assignment => {
      // Training Location Level
      if (assignment.assignment_level === 'training_location') {
        let sessionLocation = session.training_location;
        if (!sessionLocation && session.title && session.title.includes('|')) {
          sessionLocation = session.title.split('|')[0].trim();
        }
        const shouldInclude = !assignment.training_location || 
                             (assignment.training_location && sessionLocation && 
                              assignment.training_location === sessionLocation);
        return shouldInclude;
      }
      // Session Level
      else if (assignment.assignment_level === 'session') {
        if (assignment.session_id && session.id) {
          return assignment.session_id === session.id;
        } else if (assignment.session_identifier) {
          return assignment.session_identifier === sessionId ||
                 assignment.session_identifier === session.session_identifier ||
                 assignment.session_identifier === session.eventId;
        }
      }
      // Course Level
      else if (assignment.assignment_level === 'course' && 
               assignment.course_id === (session.course_id || session.course?.course_id)) {
        return true;
      }
      // Group Level
      else if (assignment.assignment_level === 'group' && 
               session.title && assignment.group_identifier) {
        const groupMatch = session.title.match(/Group (\d+)/);
        if (groupMatch) {
          const sessionGroupName = `Group${groupMatch[1]}`;
          
          if (assignment.group_identifier.endsWith(sessionGroupName)) {
            let sessionLocation = session.training_location;
            if (!sessionLocation && session.title && session.title.includes('|')) {
              sessionLocation = session.title.split('|')[0].trim();
            }
            
            if (!assignment.training_location || 
                (sessionLocation && assignment.training_location === sessionLocation)) {
              return true;
            }
          }
        }
      }
      
      return false;
    });

    debugLog('🔍 Session assignment search complete:', {
      sessionTitle: session.title,
      foundAssignments: matchingAssignments.length
    });

    return matchingAssignments;
  }, [loadAllAssignments]);

  // Load assignments when schedule changes
  useEffect(() => {
    if (currentSchedule?.id) {
      // Clear cache and loading promise when schedule changes
      assignmentsCacheRef.current = null;
      loadingPromiseRef.current = null;
      loadAllAssignments();
    }
  }, [currentSchedule?.id, loadAllAssignments]);

  const getCapacityInfo = useCallback((session) => {
    // Calculate assigned users directly instead of calling the callback to avoid dependency chain
    let assignedUsersCount = 0;
    
    if (userAssignments.length && currentSchedule) {
      const sessionId = session.eventId || session.id || 
        `${session.title || 'untitled'}-${new Date(session.start).getTime()}-${new Date(session.end).getTime()}`;
      
      userAssignments.forEach((assignment) => {
        let isMatch = false;
        
        // Training Location Level
        if (assignment.assignment_level === 'training_location') {
          let sessionLocation = session.training_location;
          if (!sessionLocation && session.title && session.title.includes('|')) {
            sessionLocation = session.title.split('|')[0].trim();
          }
          const shouldInclude = !assignment.training_location || 
                               (assignment.training_location && sessionLocation && 
                                assignment.training_location === sessionLocation);
          if (shouldInclude) isMatch = true;
        }
        // Session Level
        else if (assignment.assignment_level === 'session') {
          if (assignment.session_id && session.id) {
            isMatch = assignment.session_id === session.id;
          } else if (assignment.session_identifier) {
            isMatch = assignment.session_identifier === sessionId;
          }
        }
        // Course Level
        else if (assignment.assignment_level === 'course' && 
                 assignment.course_id === (session.course_id || session.course?.course_id)) {
          isMatch = true;
        }
        // Group Level
        else if (assignment.assignment_level === 'group' && 
                 session.title && assignment.group_identifier) {
          const groupMatch = session.title.match(/Group (\d+)/);
          if (groupMatch) {
            const sessionGroupName = `Group${groupMatch[1]}`;
            if (assignment.group_identifier.endsWith(sessionGroupName)) {
              isMatch = true;
            }
          }
        }
        
        if (isMatch) assignedUsersCount++;
      });
    }
    
    // Get max capacity prioritizing session's max_attendees from database
    let maxCapacity = session.max_attendees ||           // Database field (primary)
                     session.max_participants ||         // Legacy field
                     session.maxParticipants || 
                     session.extendedProps?.max_attendees ||  // Database field in extended props
                     session.extendedProps?.max_participants || 
                     session.extendedProps?.maxParticipants;
    
    // If no session-specific capacity, use criteria.max_attendees
    if (!maxCapacity && criteria) {
      const actualCriteria = criteria?.default || criteria;
      maxCapacity = actualCriteria?.max_attendees;
    }
    
    // Final fallback to default
    if (!maxCapacity) {
      maxCapacity = 25;
    }
    
    return {
      current: assignedUsersCount,
      max: maxCapacity,
      available: Math.max(0, maxCapacity - assignedUsersCount),
      isAtCapacity: assignedUsersCount >= maxCapacity,
      isNearCapacity: assignedUsersCount >= maxCapacity * 0.8
    };
  }, [userAssignments, currentSchedule, criteria]);

  // Removed toggleExpandedEvent function since we now show all users with scrollbar

  const renderEventContent = useCallback((eventInfo) => {
    const session = eventInfo.event.extendedProps;
    const trainerName = session.trainer_name;
    const location = session.location;
    const startTime = eventInfo.event.start ? eventInfo.event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const endTime = eventInfo.event.end ? eventInfo.event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    debugLog(`🎨 RENDERING event "${session.title}" - using cached assignments`);

    // Use cached assignments instead of async loading
    const cachedAssignments = assignmentsCacheRef.current?.data || userAssignments || [];
    
    // Filter assignments for this session synchronously
    const sessionId = session.eventId || session.id || 
      `${session.title || 'untitled'}-${new Date(session.start).getTime()}-${new Date(session.end).getTime()}`;
    
    const assignedUsers = cachedAssignments.filter(assignment => {
      // Training Location Level
      if (assignment.assignment_level === 'training_location') {
        let sessionLocation = session.training_location;
        if (!sessionLocation && session.title && session.title.includes('|')) {
          sessionLocation = session.title.split('|')[0].trim();
        }
        const shouldInclude = !assignment.training_location || 
                             (assignment.training_location && sessionLocation && 
                              assignment.training_location === sessionLocation);
        return shouldInclude;
      }
      // Session Level
      else if (assignment.assignment_level === 'session') {
        if (assignment.session_id && session.id) {
          return assignment.session_id === session.id;
        } else if (assignment.session_identifier) {
          return assignment.session_identifier === sessionId ||
                 assignment.session_identifier === session.session_identifier ||
                 assignment.session_identifier === session.eventId;
        }
      }
      // Course Level
      else if (assignment.assignment_level === 'course' && 
               assignment.course_id === (session.course_id || session.course?.course_id)) {
        return true;
      }
      // Group Level
      else if (assignment.assignment_level === 'group' && 
               session.title && assignment.group_identifier) {
        const groupMatch = session.title.match(/Group (\d+)/);
        if (groupMatch) {
          const sessionGroupName = `Group${groupMatch[1]}`;
          
          if (assignment.group_identifier.endsWith(sessionGroupName)) {
            let sessionLocation = session.training_location;
            if (!sessionLocation && session.title && session.title.includes('|')) {
              sessionLocation = session.title.split('|')[0].trim();
            }
            
            if (!assignment.training_location || 
                (sessionLocation && assignment.training_location === sessionLocation)) {
              return true;
            }
          }
        }
      }
      
      return false;
    });

    const capacityInfo = {
      current: assignedUsers.length,
      max: session.max_attendees || 6,
      isAtCapacity: assignedUsers.length >= (session.max_attendees || 6),
      isNearCapacity: assignedUsers.length >= (session.max_attendees || 6) * 0.8
    };

    const eventContent = (
        <div className="custom-event-content">
          {/* Existing event table structure */}
          <div className="event-table">
            <div className="event-row event-title-row">
              <div className="event-title">{eventInfo.event.title}</div>
            </div>
            
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
            
            {/* Enhanced capacity row */}
            <div className="event-row event-capacity-row">
              <span className="event-label">Capacity:</span>
              <span className={`event-value capacity-indicator ${
                capacityInfo.isAtCapacity ? 'at-capacity' : 
                capacityInfo.isNearCapacity ? 'near-capacity' : 'available'
              }`}>
                {`${capacityInfo.current}/${capacityInfo.max}`}
                {capacityInfo.isAtCapacity && ' 🔴'}
                {capacityInfo.isNearCapacity && !capacityInfo.isAtCapacity && ' 🟡'}
                {!capacityInfo.isNearCapacity && ' 🟢'}
              </span>
            </div>
            
            {/* Assigned users - Table format with aligned columns */}
            {assignedUsers.length > 0 && (
              <div className="event-row event-assigned-users-row">
                <div className="assigned-users-list">
                  <table className="assigned-users-table">
                    <thead>
                      <tr>
                        <th className="user-id-header">ID</th>
                        <th className="user-name-header">Name</th>
                        <th className="user-actions-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedUsers
                        .sort((a, b) => {
                          const nameA = a.end_users?.name || `User ${a.end_user_id}`;
                          const nameB = b.end_users?.name || `User ${b.end_user_id}`;
                          return nameA.localeCompare(nameB);
                        })
                        .map((assignment, index) => (
                        <tr 
                          key={index} 
                          className="assigned-user-row"
                        >
                          <td className="user-id">{assignment.end_user_id}</td>
                          <td className="user-name">
                            {assignment.end_users?.name || `User ${assignment.end_user_id}`}
                          </td>
                          <td className="user-actions">
                            <button
                              className="user-menu-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onUserContextMenu) {
                                  const userInfo = {
                                    userId: assignment.end_user_id,
                                    name: assignment.end_users?.name || `User ${assignment.end_user_id}`,
                                    trainingLocation: assignment.training_location
                                  };
                                  const rect = e.target.getBoundingClientRect();
                                  onUserContextMenu(userInfo, session, rect.left, rect.bottom + 5);
                                }
                              }}
                              title={`Options for ${assignment.end_users?.name || `User ${assignment.end_user_id}`}`}
                            >
                              ⋮
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="user-count-indicator">
                    👥 {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''} assigned
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );

    const eventId = eventInfo.event.id;

    return (
      <DroppableEvent 
        eventId={eventId} 
        dragMode={dragMode}
        capacityInfo={capacityInfo}
        session={session}
      >
        {eventContent}
      </DroppableEvent>
    );

  }, [dragMode, onUserContextMenu, userAssignments, assignmentsCacheRef]);

  // Transform sessions array into grouped structure
  const transformSessionsToGrouped = (sessionsArray) => {
    if (!Array.isArray(sessionsArray)) {
      return sessionsArray;
    }
    
    // Get available training locations from criteria



    
    // Handle nested criteria structure (criteria.default.selected_training_locations)
    const actualCriteria = criteria?.default || criteria;
    const availableLocations = actualCriteria?.selected_training_locations || [];


    
    // Also check other possible location field names
    const altLocations = actualCriteria?.training_locations || actualCriteria?.locations || [];

    
    // If no locations in criteria, fall back to extracting from sessions
    let locationsToUse = availableLocations;
    if (locationsToUse.length === 0 && altLocations.length > 0) {
      locationsToUse = altLocations;

    }
    
    if (locationsToUse.length === 0) {
      // Extract unique locations from sessions (excluding TBD)
      const sessionLocations = [...new Set(
        sessionsArray
          .map(s => s.location || s.training_location)
          .filter(loc => loc && loc !== 'TBD')
      )];

      locationsToUse = sessionLocations.length > 0 ? sessionLocations : ['Kuwait Training Centre', 'Dubai Training Centre'];
    }
    

    
    const grouped = {};
    
    // Group sessions using clean data structure: training_location -> functional_area -> sessions
    sessionsArray.forEach((session, index) => {
      // PRIORITY 1: Use direct fields from clean data structure
      let trainingLocation = session.training_location || 'Default Location';
      let functionalArea = session.functional_area || 'General';
      
      // FALLBACK: Parse from legacy compound keys if clean fields not available
      if ((trainingLocation === 'Default Location' || functionalArea === 'General') && 
          (session.group_name || session.groupName)) {
        const compoundKey = session.group_name || session.groupName;
        if (compoundKey.includes('|')) {
          const parts = compoundKey.split('|');
          if (trainingLocation === 'Default Location') {
            trainingLocation = parts[0].trim();
          }
          if (functionalArea === 'General' && parts[1]) {
            functionalArea = parts[1].trim();
          }
        } else if (trainingLocation === 'Default Location') {
          trainingLocation = compoundKey;
        }
      }
      
      // Initialize nested structure if it doesn't exist
      if (!grouped[trainingLocation]) {
        grouped[trainingLocation] = {};
      }
      if (!grouped[trainingLocation][functionalArea]) {
        grouped[trainingLocation][functionalArea] = [];
      }
      
      // Use existing max_attendees from database if available, otherwise use criteria
      const maxParticipants = session.max_attendees || actualCriteria?.max_attendees || 25;
      
      const enhancedSession = {
        ...session,
        max_participants: maxParticipants,
        max_attendees: maxParticipants, // Ensure both field names are available
        current_participants: session.current_participants || 0
      };
      
      grouped[trainingLocation][functionalArea].push(enhancedSession);
    });
    
    return grouped;
  };

  const handleEventClick = useCallback((info) => {
    debugLog('🖱️ Event clicked:', info.event.title);
    
    if (dragMode) {
      // In drag mode, prevent normal event editing
      return;
    }
    
    if (stakeholderMode && onSessionClick) {
      // In stakeholder mode, trigger session edit panel
      const sessionData = {
        ...info.event.extendedProps,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        session_identifier: info.event.extendedProps.session_identifier || info.event.id
      };
      
      debugLog('📝 Opening session edit panel for:', sessionData);
      onSessionClick(sessionData);
      return;
    }
    
    // Use existing event click logic for non-stakeholder modes
  }, [dragMode, stakeholderMode, onSessionClick]);

  // Memoize sessions transformation to prevent unnecessary re-renders
  const groupedSessions = useMemo(() => {
    debugLog('🎯 EnhancedScheduleCalendar - Processing sessions:', sessions);
    debugLog('🎯 EnhancedScheduleCalendar - Sessions type:', typeof sessions);
    debugLog('🎯 EnhancedScheduleCalendar - Sessions is array:', Array.isArray(sessions));
    debugLog('🎯 EnhancedScheduleCalendar - Sessions length:', sessions?.length);
    
    const result = transformSessionsToGrouped(sessions);
    debugLog('🎯 EnhancedScheduleCalendar - Grouped result keys:', Object.keys(result || {}));
    
    return result;
  }, [sessions, criteria]);

  // Extract classroom sessions similar to ScheduleCalendar
  const classroomSessions = {};
  
  // Process the grouped sessions to create classroom-based structure
  if (groupedSessions && typeof groupedSessions === 'object') {
    Object.entries(groupedSessions).forEach(([trainingLocation, functionalAreas]) => {
      if (!classroomSessions[trainingLocation]) {
        classroomSessions[trainingLocation] = {};
      }
      
      // Merge sessions from all functional areas for this location
      if (functionalAreas && typeof functionalAreas === 'object') {
        Object.entries(functionalAreas).forEach(([functionalArea, sessionList]) => {
          if (Array.isArray(sessionList)) {
            // Group sessions by classroom
            sessionList.forEach(session => {
              // Debug: Log all possible classroom fields
              debugLog(`🏫 Session classroom data for "${session.title}":`, {
                _classroom: session._classroom,
                classroom: session.classroom,
                classroom_name: session.classroom_name,
                classroomName: session.classroomName,
                location: session.location,
                training_location: session.training_location,
                room: session.room,
                venue: session.venue
              });
              
              // Try multiple possible classroom field names
              const classroomName = session._classroom || 
                                   session.classroom || 
                                   session.classroom_name || 
                                   session.classroomName || 
                                   session.room || 
                                   'Classroom 1';
              
              debugLog(`🏫 Using classroom name: "${classroomName}" for session: ${session.title}`);
              
              if (!classroomSessions[trainingLocation][classroomName]) {
                classroomSessions[trainingLocation][classroomName] = [];
              }
              
              classroomSessions[trainingLocation][classroomName].push(session);
            });
          }
        });
      }
    });
  }
  
  debugLog('🏫 ENHANCED CALENDAR: Final classroom sessions structure:', classroomSessions);

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
    <div className={`enhanced-schedule-calendar ${dragMode ? 'drag-mode' : ''}`}>
      {sortedLocationEntries.map(([trainingLocation, classrooms]) => (
        <div key={trainingLocation} className="calendar-group">
          <h3 style={{ color: '#495057', borderBottom: '2px solid #007bff', paddingBottom: '8px', marginBottom: '20px' }}>
            📍 {trainingLocation}
          </h3>
          {Object.entries(classrooms).sort(([classroomA], [classroomB]) => {
            // Extract numbers from classroom names for proper numeric sorting
            const aNumber = parseInt(classroomA.replace(/[^\d]/g, '')) || 0;
            const bNumber = parseInt(classroomB.replace(/[^\d]/g, '')) || 0;
            return aNumber - bNumber;
          }).map(([classroomName, sessionList]) => (
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
              <FullCalendar
                key={`${trainingLocation}-${classroomName}`}
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView={calendarViewRef.current}
                initialDate={calendarDateRef.current}
                allDaySlot={false}
                slotMinTime="07:00:00"
                slotMaxTime="21:00:00"
                contentHeight={1000} // Use contentHeight instead of height for better control
                aspectRatio={0.8} // Make calendar taller (lower ratio = taller)
                slotLabelInterval="01:00:00" // Show hour labels
                slotDuration="00:30:00" // 30-minute time slots for better spacing
                expandRows={true} // Allow rows to expand to fill available height
                // slotMinHeight removed - not supported in this FullCalendar version
                editable={!dragMode} // Disable editing in drag mode
                hiddenDays={hiddenDays}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={sessionList.map((session, index) => {
                  // Create a deep copy like Schedule Manager does
                  const sessionCopy = JSON.parse(JSON.stringify(session));
                  // Restore Date objects
                  if (sessionCopy.start) sessionCopy.start = new Date(sessionCopy.start);
                  if (sessionCopy.end) sessionCopy.end = new Date(sessionCopy.end);
                  
                  // Add unique identifiers to prevent any cross-part interference
                  sessionCopy._uniqueId = `${session.title}-${session.start}-${index}`;
                  sessionCopy._renderIndex = index;
                  
                  // Get automatic color assignment based on course title (Schedule Manager approach)
                  let courseTitle = sessionCopy.course?.course_name || sessionCopy.title;
                  if (courseTitle && !sessionCopy.course?.course_name) {
                    courseTitle = courseTitle.replace(/\s*-\s*Group\s+\d+.*$/, '').trim();
                  }
                  const autoColor = getColorByCourseTitle(courseTitle);
                  
                  // Use auto-assigned color for consistent display (Schedule Manager approach)
                  const sessionColor = autoColor;

                  const eventId = `${trainingLocation}-${classroomName}-${sessionCopy.title}-${index}`;
                  
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
                      autoColor: autoColor,
                      functional_area: sessionCopy.functional_area,
                      training_location: trainingLocation,
                      classroom_name: classroomName,
                      groupName: sessionCopy.groupName || trainingLocation,
                      classroomName: classroomName,
                      calendarInstance: `${trainingLocation}-${classroomName}`,
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
                dayMaxEvents={false}
                eventMinHeight={30}
                datesSet={useCallback((dateInfo) => {
                  // Track when user navigates to different dates/views using refs to prevent re-renders
                  calendarDateRef.current = dateInfo.start;
                  calendarViewRef.current = dateInfo.view.type;
                  debugLog('📅 Calendar navigation:', { date: dateInfo.start, view: dateInfo.view.type });
                }, [])}
              />
            </div>
          ))}
        </div>
      ))}
      {Object.keys(classroomSessions).length === 0 && (
        <div className="no-sessions-message">
          <p>No sessions available to display</p>
        </div>
      )}
    </div>
  );
};

// Droppable Event Wrapper Component
const DroppableEvent = ({ eventId, dragMode, capacityInfo, session, children }) => {
  const isDisabled = !dragMode || capacityInfo?.isAtCapacity;

  
  const { isOver, setNodeRef } = useDroppable({
    id: eventId,
    data: {
      type: 'calendar-event',
      session,
      capacityInfo
    },
    disabled: isDisabled
  });



  return (
    <div
      ref={setNodeRef}
      className={`droppable-event ${isOver ? 'drag-over' : ''} ${
        capacityInfo.isAtCapacity ? 'at-capacity' : ''
      }`}
    >
      {children}
    </div>
  );
};

export default React.memo(EnhancedScheduleCalendar);