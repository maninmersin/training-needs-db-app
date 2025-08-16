import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { saveAs } from 'file-saver';
import { supabase } from '../supabaseClient';
import UserPool from './UserPool';
import EnhancedScheduleCalendar from './EnhancedScheduleCalendar';
import AssignmentStats from './AssignmentStats';
import CalendarDayControls from './CalendarDayControls';
import UserContextMenu from './UserContextMenu';
import AssignmentStatsModal from './AssignmentStatsModal';
import { generateEventIdFromSession } from '../utils/eventIdUtils';


// Utility function to generate stable session identifiers (matches ScheduleEditor and ScheduleCalendar)
const generateStableSessionId = (session) => {
  const courseId = session.course_id || session.course?.course_id || 'unknown';
  const sessionNumber = session.session_number || 1;
  
  // Use direct field access for clean data structure
  let groupName = 'default';
  let functionalArea = 'general';
  
  // PRIORITY 1: Use direct fields from new clean structure
  if (session.training_location) {
    groupName = session.training_location.replace(/\s+/g, '-').toLowerCase();
  }
  if (session.functional_area) {
    functionalArea = session.functional_area.replace(/\s+/g, '-').toLowerCase();
  }
  
  // FALLBACK: Only needed if direct database fields are missing (shouldn't happen with current schema)
  if (groupName === 'default' && session.group_name) {
    // For any remaining legacy data, extract location part only (no parsing dependency on specific terms)
    if (session.group_name.includes('|')) {
      const parts = session.group_name.split('|');
      groupName = parts[0].trim().replace(/\s+/g, '-').toLowerCase();
      if (functionalArea === 'general' && parts[1]) {
        functionalArea = parts[1].trim().replace(/\s+/g, '-').toLowerCase();
      }
    } else if (session.group_name.includes('-')) {
      // Use first part before dash as location (works with any naming convention)
      const parts = session.group_name.split('-');
      groupName = parts[0].trim().replace(/\s+/g, '-').toLowerCase();
    } else {
      groupName = session.group_name.replace(/\s+/g, '-').toLowerCase();
    }
  }
  
  // Extract part number from title to differentiate Part 1, Part 2, etc.
  let partSuffix = '';
  if (session.title && session.title.includes('Part ')) {
    const partMatch = session.title.match(/Part (\d+)/);
    if (partMatch) {
      partSuffix = `-part${partMatch[1]}`;
    }
  }
  
  return `${courseId}-session${sessionNumber}-${groupName}-${functionalArea}${partSuffix}`;
};

// Utility function to generate session ID with backwards compatibility
const getSessionId = (session) => {
  // Always use stable ID for new assignments
  return generateStableSessionId(session);
};

// Utility function to get both stable and legacy session identifiers for matching
const getSessionIdentifiers = (session) => {
  const stableId = generateStableSessionId(session);
  const legacyId = session.eventId || session.id || 
    `${session.title || 'untitled'}-${new Date(session.start).getTime()}-${new Date(session.end).getTime()}`;
    
  return {
    stable: stableId,
    legacy: legacyId,
    all: [stableId, legacyId]
  };
};
// Completely disable debug logging for performance
const debugLog = () => {};
const debugWarn = () => {};
const debugError = () => {};
import './DragDropAssignmentPanel.css';

const DragDropAssignmentPanel = ({ 
  schedule, 
  currentSchedule, 
  onScheduleChange, 
  onAssignmentUpdate,
  onClose 
}) => {
  const [activeUser, setActiveUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dragMode = true; // Always enabled - no toggle needed
  
  // User categorization state
  const [userCategories, setUserCategories] = useState({
    allCoursesNeeded: [],
    someCoursesNeeded: {},
    unassigned: [],
    partiallyAssigned: []
  });
  
  // Assignment and capacity tracking
  const [assignments, setAssignments] = useState([]);
  const [capacityData, setCapacityData] = useState({});
  const [assignmentStats, setAssignmentStats] = useState({
    total: 0,
    fullyAssigned: 0,
    partiallyAssigned: 0,
    unassigned: 0,
    waitlisted: 0
  });
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    userInfo: null,
    sessionInfo: null
  });
  
  // Filters
  const [selectedTrainingLocation, setSelectedTrainingLocation] = useState('');
  const [selectedFunctionalArea, setSelectedFunctionalArea] = useState('');

  // Calendar day visibility controls
  const [visibleDays, setVisibleDays] = useState(() => {
    // Load from localStorage or default to business days (Mon-Fri)
    const saved = localStorage.getItem('calendarVisibleDays');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved day visibility settings');
      }
    }
    // Default: Business days only (Monday=1 to Friday=5)
    return {
      0: false, // Sunday
      1: true,  // Monday
      2: true,  // Tuesday
      3: true,  // Wednesday
      4: true,  // Thursday
      5: true,  // Friday
      6: false  // Saturday
    };
  });
  
  const [dayControlsCollapsed, setDayControlsCollapsed] = useState(true);

  // Drag and drop sensors - more permissive for multi-select
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced distance for easier drag initiation
        delay: 100,  // Add small delay to avoid conflict with clicks
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize component data
  useEffect(() => {
    if (schedule) {
      initializeAssignmentData();
    }
  }, [schedule]);


  const initializeAssignmentData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      // Fetch existing assignments and get the fresh data
      const freshAssignments = await fetchAssignments();
      
      // Categorize users based on course requirements using fresh assignment data
      await categorizeUsers(freshAssignments);
      
      // Initialize capacity tracking
      await initializeCapacityTracking();
      
      // Calculate initial stats
      await updateAssignmentStats();
      
      
    } catch (err) {
      debugError('❌ Error initializing assignment data:', err);
      setError(`Failed to initialize assignment data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    if (!schedule?.id) return [];
    
    try {
      const { data, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users (id, name, email, project_role, training_location)
        `)
        .eq('schedule_id', schedule.id);

      if (error) {
        debugWarn('Assignment query with join failed, trying basic query:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .select('*')
          .eq('schedule_id', schedule.id);
        
        if (basicError) throw basicError;
        const assignments = basicData || [];
        setAssignments(assignments);
        return assignments;
      }

      const assignments = data || [];
      setAssignments(assignments);
      return assignments;
      
    } catch (err) {
      debugError('❌ Error fetching assignments:', err);
      throw err;
    }
  };

  const categorizeUsers = async (assignmentsData = null) => {
    try {
      
      // Use fresh assignment data if provided, otherwise fall back to state
      const currentAssignments = assignmentsData || assignments;
      
      // Get all eligible users based on filters
      let usersQuery = supabase.from('end_users').select('*');
      
      if (selectedTrainingLocation) {
        usersQuery = usersQuery.eq('training_location', selectedTrainingLocation);
      }
      
      const { data: allUsers, error: usersError } = await usersQuery;
      if (usersError) throw usersError;
      
      // Don't filter out users with assignments - we need to check all users
      // to properly categorize those with partial assignments
      const availableUsers = allUsers || [];
      
      // Get all courses in the schedule
      const scheduleCourses = getScheduleCourses();
      
      // Get role-course mappings
      const { data: roleMappings, error: mappingsError } = await supabase
        .from('role_course_mappings')
        .select('*');
      if (mappingsError) throw mappingsError;
      
      // Create course name mapping for the UI
      const courseNameMap = new Map();
      scheduleCourses.forEach(course => {
        courseNameMap.set(course.course_id, course.course_name);
      });

      // Categorize users
      const categories = {
        allCoursesNeeded: [],
        someCoursesNeeded: {},
        unassigned: [],
        partiallyAssigned: [],
        courseNames: courseNameMap
      };
      
      for (const user of availableUsers) {
        const userCourseRequirements = roleMappings
          .filter(mapping => mapping.project_role_name === user.project_role)
          .map(mapping => mapping.course_id);
        
        const scheduleCourseIds = scheduleCourses.map(c => c.course_id);
        const requiredCoursesInSchedule = userCourseRequirements.filter(courseId => 
          scheduleCourseIds.includes(courseId)
        );
        
        // Get user's current assignments
        const userAssignments = currentAssignments.filter(a => a.end_user_id === user.id);
        const assignedCourseIds = [...new Set(userAssignments.map(a => a.course_id))];
        
        if (requiredCoursesInSchedule.length === scheduleCourseIds.length) {
          // User needs all courses in schedule - check assignment status
          const missingCourses = requiredCoursesInSchedule.filter(courseId => 
            !assignedCourseIds.includes(courseId)
          );
          
          if (missingCourses.length === scheduleCourseIds.length) {
            // User needs all courses and has none assigned - keep in All Courses category
            categories.allCoursesNeeded.push(user);
          } else if (missingCourses.length > 0) {
            // User needs all courses but has some assigned - add to partiallyAssigned category
            // This handles auto-assigned users who can still be dragged to different groups
            categories.partiallyAssigned.push(user);
            
            // ALSO add them to someCoursesNeeded for each missing course
            // This ensures they appear in the course-specific pools for reassignment
            missingCourses.forEach(courseId => {
              if (!categories.someCoursesNeeded[courseId]) {
                categories.someCoursesNeeded[courseId] = [];
              }
              categories.someCoursesNeeded[courseId].push(user);
            });
          }
          // If fully assigned, they won't appear in any category (already assigned)
        } else if (requiredCoursesInSchedule.length > 0) {
          // User needs some courses - check assignment status
          const hasAnyAssignments = assignedCourseIds.some(courseId => 
            requiredCoursesInSchedule.includes(courseId)
          );
          
          if (hasAnyAssignments) {
            // User has some assignments but not all required - put in partiallyAssigned
            categories.partiallyAssigned.push(user);
            
            // ALSO add them to someCoursesNeeded for each missing course
            requiredCoursesInSchedule.forEach(courseId => {
              if (!assignedCourseIds.includes(courseId)) {
                if (!categories.someCoursesNeeded[courseId]) {
                  categories.someCoursesNeeded[courseId] = [];
                }
                categories.someCoursesNeeded[courseId].push(user);
              }
            });
          } else {
            // User needs some courses but has none assigned - add to someCoursesNeeded for each missing course
            requiredCoursesInSchedule.forEach(courseId => {
              if (!assignedCourseIds.includes(courseId)) {
                // User still needs this course
                if (!categories.someCoursesNeeded[courseId]) {
                  categories.someCoursesNeeded[courseId] = [];
                }
                categories.someCoursesNeeded[courseId].push(user);
              }
            });
          }
        } else {
          // User doesn't need any courses in this schedule
          categories.unassigned.push(user);
        }
      }
      
      setUserCategories(categories);
      
    } catch (err) {
      debugError('❌ Error categorizing users:', err);
      throw err;
    }
  };

  const getScheduleCourses = () => {
    if (!schedule?.sessions) return [];
    
    const courses = new Map();
    const sessions = getAllSessionsFlat();
    
    sessions.forEach(session => {
      const courseId = session.course_id || session.courseId || session.extendedProps?.course_id;
      const courseName = session.course_name || session.courseName || session.extendedProps?.course_name;
      
      if (courseId && !courses.has(courseId)) {
        courses.set(courseId, {
          course_id: courseId,
          course_name: courseName || courseId
        });
      }
    });
    
    return Array.from(courses.values());
  };

  const getUniqueFunctionalAreas = () => {
    try {
      const functionalAreas = new Set();
      const sessions = getAllSessionsFlat();
      
      sessions.forEach((session, index) => {
        
        // Extract from group_name - need to check the actual format in your data
        if (session.group_name && session.group_name.includes('|')) {
          const parts = session.group_name.split('|');
          
          if (parts.length >= 2) {
            // Check if first part looks like a location (has "Training" or "Centre")
            const firstPart = parts[0].trim();
            const secondPart = parts[1].trim();
            
            if (firstPart.includes('Training') || firstPart.includes('Centre')) {
              // Format is "Location | FunctionalArea"
              functionalAreas.add(secondPart);
            } else {
              // Format is "FunctionalArea | Location"
              functionalAreas.add(firstPart);
            }
            return; // Found it, skip other checks
          }
        }
        
        // Extract functional area from session data as fallback
        if (session._functionalArea) {
          functionalAreas.add(session._functionalArea);
        } else if (session.functional_area) {
          functionalAreas.add(session.functional_area);
        }
      });
      
      // Convert to sorted array, with fallback if no data found
      const areas = Array.from(functionalAreas).sort();
      if (areas.length === 0) {
        return ['General'];
      }
      return areas;
      
    } catch (err) {
      return ['General'];
    }
  };

  // Memoized version of getAllSessionsFlat to prevent infinite re-renders
  const flattenedSessions = useMemo(() => {
    console.log('🔍 getAllSessionsFlat called');
    console.log('📋 Schedule exists:', !!schedule);
    console.log('📋 Schedule.sessions exists:', !!schedule?.sessions);
    console.log('📋 Schedule.sessions type:', typeof schedule?.sessions);
    console.log('📋 Schedule.sessions data:', schedule?.sessions);
    
    if (!schedule?.sessions) {
      console.log('❌ No sessions found, returning empty array');
      return [];
    }
    
    if (typeof schedule.sessions === 'object' && !Array.isArray(schedule.sessions)) {
      const allSessions = [];
      console.log('🔍 Processing nested session structure...');
      Object.entries(schedule.sessions).forEach(([functionalArea, functionalAreaData]) => {
        console.log(`🔍 Processing functional area: ${functionalArea}`, functionalAreaData);
        if (functionalAreaData && typeof functionalAreaData === 'object') {
          Object.entries(functionalAreaData).forEach(([trainingLocation, trainingLocationData]) => {
            console.log(`🔍 Processing training location: ${trainingLocation}`, trainingLocationData);
            if (trainingLocationData && typeof trainingLocationData === 'object') {
              Object.entries(trainingLocationData).forEach(([classroom, sessionList]) => {
                console.log(`🔍 Processing classroom: ${classroom}`, sessionList);
                if (Array.isArray(sessionList)) {
                  console.log(`✅ Found ${sessionList.length} sessions in ${functionalArea}-${trainingLocation}-${classroom}`);
                  sessionList.forEach((session, index) => {
                    allSessions.push({
                      ...session,
                      _location: trainingLocation,
                      _functionalArea: functionalArea,
                      _classroom: classroom
                    });
                  });
                } else {
                  console.log(`⚠️ ${classroom} is not an array:`, sessionList);
                }
              });
            } else {
              console.log(`⚠️ ${trainingLocation} is not an object:`, trainingLocationData);
            }
          });
        } else {
          console.log(`⚠️ ${functionalArea} functionalAreaData is not an object:`, functionalAreaData);
        }
      });
      console.log(`✅ Flattened to ${allSessions.length} total sessions`);
      console.log('📊 Sample flattened session:', allSessions[0]);
      return allSessions;
    }
    
    console.log('✅ Sessions already flat, returning as-is');
    return schedule.sessions;
  }, [schedule?.sessions]);

  // Keep the function version for existing code that calls it
  const getAllSessionsFlat = () => {
    return flattenedSessions;
  };

  const initializeCapacityTracking = async () => {
    try {
      
      const sessions = getAllSessionsFlat();
      const capacities = {};
      
      // Get max participants from schedule criteria
      const getMaxParticipantsFromCriteria = () => {
        try {
          if (schedule?.criteria) {
            const criteria = typeof schedule.criteria === 'string' ? 
              JSON.parse(schedule.criteria) : schedule.criteria;
            // Use the same field name as event boxes: max_attendees
            const actualCriteria = criteria?.default || criteria;
            return actualCriteria?.max_attendees || 25;
          }
        } catch (err) {
        }
        return 25; // Default fallback
      };
      
      const defaultMaxParticipants = getMaxParticipantsFromCriteria();

      
      sessions.forEach(session => {
        if (session.title && session.title.includes('Group')) {
          const groupMatch = session.title.match(/Group (\d+)/);
          if (groupMatch) {
            const groupId = `${session.course_id || 'unknown'}-group-${groupMatch[1]}`;
            // Use criteria max participants, fallback to session data, then default
            const maxParticipants = defaultMaxParticipants || 
                                   session.max_participants || 
                                   session.maxParticipant || 25;
            
            if (!capacities[groupId]) {
              capacities[groupId] = {
                maxCapacity: maxParticipants,
                currentCount: 0,
                waitlist: [],
                sessions: [],
                trainingLocation: session._location || 'Unknown',
                functionalArea: session._functionalArea || 'Unknown',
                courseName: session.course_name || session.courseName || 'Unknown Course'
              };
            }
            
            capacities[groupId].sessions.push(session);
          }
        }
      });
      
      // Now calculate current assignments for each group
      await updateCapacityWithAssignments(capacities);
      
      setCapacityData(capacities);
      
    } catch (err) {
      debugError('❌ Error initializing capacity tracking:', err);
      throw err;
    }
  };

  const updateCapacityWithAssignments = async (capacities) => {
    try {
      
      // Reset current counts
      Object.keys(capacities).forEach(groupId => {
        capacities[groupId].currentCount = 0;
        capacities[groupId].assignedUsers = new Set();
      });
      
      // Count users assigned to each group
      assignments.forEach(assignment => {
        const groupId = assignment.group_identifier;
        if (capacities[groupId]) {
          capacities[groupId].assignedUsers.add(assignment.end_user_id);
        }
      });
      
      // Update current counts based on unique users per group
      Object.keys(capacities).forEach(groupId => {
        capacities[groupId].currentCount = capacities[groupId].assignedUsers.size;
      });
      
      
    } catch (err) {
      debugError('❌ Error updating capacity with assignments:', err);
    }
  };

  const updateAssignmentStats = async () => {
    try {
      
      // Calculate total users across all categories
      const allCoursesUsers = userCategories.allCoursesNeeded || [];
      const someCoursesUsers = Object.values(userCategories.someCoursesNeeded || {}).flat();
      const unassignedUsers = userCategories.unassigned || [];
      
      const totalUsers = allCoursesUsers.length + someCoursesUsers.length + unassignedUsers.length;
      
      // Get all required courses for this schedule
      const scheduleCourses = getScheduleCourses();
      const courseIds = scheduleCourses.map(c => c.course_id);
      

      
      let fullyAssigned = 0;
      let partiallyAssigned = 0;
      let unassigned = 0;
      
      // Check each user's assignment status
      const allUsers = [...allCoursesUsers, ...someCoursesUsers, ...unassignedUsers];
      
      allUsers.forEach(user => {
        const userAssignments = assignments.filter(a => a.end_user_id === user.id);
        const assignedCourseIds = [...new Set(userAssignments.map(a => a.course_id))];
        
        // Determine what courses this user needs
        let requiredCourses = [];
        
        if (allCoursesUsers.includes(user)) {
          // User needs all courses
          requiredCourses = courseIds;
        } else {
          // User needs specific courses - find which category they're in
          for (const [courseId, users] of Object.entries(userCategories.someCoursesNeeded || {})) {
            if (users.includes(user)) {
              requiredCourses.push(courseId);
            }
          }
        }
        
        if (requiredCourses.length === 0) {
          // User doesn't need any courses from this schedule
          unassigned++;
        } else if (requiredCourses.every(courseId => assignedCourseIds.includes(courseId))) {
          // User is assigned to all required courses
          fullyAssigned++;
        } else if (assignedCourseIds.some(courseId => requiredCourses.includes(courseId))) {
          // User is assigned to some but not all required courses
          partiallyAssigned++;
        } else {
          // User is not assigned to any required courses
          unassigned++;
        }
      });
      
      
      setAssignmentStats({
        total: totalUsers,
        fullyAssigned,
        partiallyAssigned,
        unassigned,
        waitlisted: 0 // Not implemented yet
      });
      
    } catch (err) {
      debugError('❌ Error updating assignment stats:', err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event) => {
    const dragData = event.active?.data?.current;
    const userId = event.active.id;

    
    // Find the user being dragged from categories
    let draggedUser = null;
    
    // Search in all categories
    draggedUser = userCategories.allCoursesNeeded.find(u => u.id.toString() === userId) ||
                 Object.values(userCategories.someCoursesNeeded).flat().find(u => u.id.toString() === userId) ||
                 userCategories.unassigned.find(u => u.id.toString() === userId) ||
                 userCategories.partiallyAssigned.find(u => u.id.toString() === userId);
    
    setActiveUser(draggedUser);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    setActiveUser(null);
    
    console.log('🎯 DRAG END EVENT:', {
      activeId: active?.id,
      overId: over?.id,
      overType: over?.data?.current?.type,
      sessionTitle: over?.data?.current?.session?.title,
      sessionEventId: over?.data?.current?.session?.eventId,
      sessionId: over?.data?.current?.session?.id
    });
    
    // Extract and log the group number from the session title for debugging
    if (over?.data?.current?.session?.title) {
      const title = over.data.current.session.title;
      const groupMatch = title.match(/Group (\d+)/);
      if (groupMatch) {
        console.log('🎯 DETECTED TARGET GROUP:', groupMatch[1], 'from title:', title);
      }
    }
    
    if (!over) {
      console.log('❌ No drop target found');
      return;
    }
    
    // Check if we're dropping on a valid drop zone
    if (over.data?.current?.type !== 'calendar-event') {
      console.log('❌ Invalid drop target type:', over.data?.current?.type);
      return;
    }
    
    const dragData = active?.data?.current;
    const targetEventId = over.id;
    
    console.log('🎯 RECEIVED targetEventId:', targetEventId);
    console.log('🎯 SESSION from drop data:', over?.data?.current?.session?.title);
    
    // Get the target session from drop data
    const targetSession = over?.data?.current?.session;
    const targetSessionLocation = targetSession?.training_location || targetSession?.location;
    
    console.log('🔍 TARGET SESSION LOCATION:', targetSessionLocation);
    
    try {
      
      if (dragData?.type === 'multi-user') {
        // Handle multi-user assignment - validate locations for all users
        const userIds = dragData.userIds;
        const invalidUsers = [];
        
        // Check each user's location against target session location
        for (const userId of userIds) {
          const user = userCategories.allCoursesNeeded.find(u => u.id.toString() === userId) ||
                      Object.values(userCategories.someCoursesNeeded).flat().find(u => u.id.toString() === userId) ||
                      userCategories.unassigned.find(u => u.id.toString() === userId) ||
                      userCategories.partiallyAssigned.find(u => u.id.toString() === userId);
          
          if (user && targetSessionLocation && user.training_location !== targetSessionLocation) {
            invalidUsers.push(user);
          }
        }
        
        if (invalidUsers.length > 0) {
          setError(`❌ Cannot assign users to different training location:\n${invalidUsers.map(u => `${u.name} (${u.training_location})`).join(', ')}\nTarget session location: ${targetSessionLocation}`);
          return;
        }
        
        await handleBulkUserAssignment(dragData.userIds, targetEventId);
      } else {
        // Handle single user assignment - validate location
        const userId = active.id;
        const user = userCategories.allCoursesNeeded.find(u => u.id.toString() === userId) ||
                     Object.values(userCategories.someCoursesNeeded).flat().find(u => u.id.toString() === userId) ||
                     userCategories.unassigned.find(u => u.id.toString() === userId) ||
                     userCategories.partiallyAssigned.find(u => u.id.toString() === userId);
        
        console.log('🔍 LOCATION CHECK:', {
          userId,
          userName: user?.name,
          userLocation: user?.training_location,
          targetLocation: targetSessionLocation
        });
        
        if (user && targetSessionLocation && user.training_location !== targetSessionLocation) {
          setError(`❌ Cannot assign ${user.name} to different training location.\nUser location: ${user.training_location}\nTarget session location: ${targetSessionLocation}`);
          return;
        }
        
        await handleUserAssignment(userId, targetEventId);
      }
    } catch (err) {
      debugError('❌ Error handling user assignment:', err);
      setError(`Failed to assign user(s): ${err.message}`);
    }
  };

  const handleBulkUserAssignment = async (userIds, targetEventId) => {
    
    setLoading(true);
    const results = {
      successful: [],
      failed: []
    };
    
    try {
      // Parse target event once for all users
      console.log('🔍 BULK ASSIGNMENT - Parsing targetEventId:', targetEventId);
      const { assignmentData, sessionData } = parseTargetEventId(targetEventId);

      console.log('🔍 BULK ASSIGNMENT - Parse result:', { assignmentData, sessionData });
      
      if (!assignmentData) {
        console.error('❌ BULK ASSIGNMENT - assignmentData is null/undefined');
        throw new Error('Could not parse target event for assignment');
      }
      
      // Categorize users by their assignment type
      
      const allCoursesUsers = [];
      const someCoursesUsers = [];
      const otherUsers = [];
      

      for (const userId of userIds) {
        // Convert userId to both string and number for comparison
        const userIdStr = userId.toString();
        const userIdNum = parseInt(userId);
        
        const isAllCoursesUser = userCategories.allCoursesNeeded.some(u => 
          u.id === userIdNum || u.id === userIdStr || u.id.toString() === userIdStr
        );
        const isSomeCoursesUser = Object.values(userCategories.someCoursesNeeded).flat().some(u => 
          u.id === userIdNum || u.id === userIdStr || u.id.toString() === userIdStr
        );
        
        if (isAllCoursesUser) {
          allCoursesUsers.push(userId);
        } else if (isSomeCoursesUser) {
          someCoursesUsers.push(userId);
        } else {
          otherUsers.push(userId);
        }
      }
      
      console.log('🔍 BULK ASSIGNMENT - User categorization:', {
        allCoursesUsers: allCoursesUsers.length,
        someCoursesUsers: someCoursesUsers.length,
        otherUsers: otherUsers.length
      });
      

      
      
      
      // Handle All Courses users with multi-course assignment
      if (allCoursesUsers.length > 0) {
        console.log('🔍 BULK ASSIGNMENT - Processing All Courses users:', allCoursesUsers.length);
        for (const userId of allCoursesUsers) {
          try {
            const multiAssignments = await handleMultiCourseAssignment(userId, assignmentData, sessionData);
            results.successful.push(userId);
          } catch (err) {
            debugError(`❌ Failed multi-course assignment for user ${userId}:`, err);
            results.failed.push({ userId, error: err.message });
          }
        }
      }
      
      // Handle Some Courses users with single-course assignment (all sessions of the course)
      if (someCoursesUsers.length > 0) {
        console.log('🔍 BULK ASSIGNMENT - Processing Some Courses users:', someCoursesUsers.length);
        for (const userId of someCoursesUsers) {
          try {
            const singleCourseAssignments = await handleSingleCourseAssignment(userId, assignmentData, sessionData);
            results.successful.push(userId);
          } catch (err) {
            debugError(`❌ Failed single-course assignment for user ${userId}:`, err);
            results.failed.push({ userId, error: err.message });
          }
        }
      }
      
      // Handle other users with single-session assignment
      if (otherUsers.length > 0) {
        for (const userId of otherUsers) {
          try {
            
            // Create single session assignment (skip the category detection in handleUserAssignment)
            // Find the session_id from training_sessions table using session identifier
            let sessionId = null;
            if (sessionData?.id) {
              sessionId = sessionData.id;
            } else {
              // Try to find session_id by matching session identifier
              const { data: sessionLookup } = await supabase
                .from('training_sessions')
                .select('id')
                .eq('schedule_id', schedule.id)
                .eq('session_identifier', assignmentData.sessionIdentifier)
                .single();
              sessionId = sessionLookup?.id;
            }
            
            const insertData = {
              schedule_id: schedule.id,
              end_user_id: parseInt(userId),
              assignment_level: 'session',
              course_id: assignmentData.courseId,
              group_identifier: assignmentData.groupIdentifier,
              session_identifier: assignmentData.sessionIdentifier,
              // Use session_id per new database schema (removed event_id)
              session_id: sessionId,
              training_location: assignmentData.trainingLocation,
              functional_area: assignmentData.functionalArea,
              assignment_type: 'standard',
              notes: `Assigned via bulk drag-and-drop to ${sessionData?.title || 'session'}`
            };
            
            const { data, error } = await supabase
              .from('user_assignments')
              .insert([insertData])
              .select('*');
            
            if (error) throw error;
            
            results.successful.push(userId);
          } catch (err) {
            debugError(`❌ Failed single-session assignment for user ${userId}:`, err);
            results.failed.push({ userId, error: err.message });
          }
        }
      }
      
      
      // Refresh data after bulk assignment
      
      // Immediately update assignments state with successful assignments
      const tempAssignments = results.successful.map(userId => ({
        id: Date.now() + Math.random(), // temporary ID
        end_user_id: parseInt(userId),
        schedule_id: schedule.id,
        assignment_level: assignmentData.assignment_level,
        course_id: assignmentData.course_id,
        session_identifier: assignmentData.session_identifier,
        training_location: assignmentData.training_location,
        functional_area: assignmentData.functional_area,
        group_identifier: assignmentData.group_identifier
      }));
      
      setAssignments(prev => [...prev, ...tempAssignments]);
      
      // Immediately recategorize users
      await categorizeUsers();
      
      // Then do full refresh from database (with delay for consistency)
      setTimeout(async () => {
        await initializeAssignmentData();
      }, 200);
      
      // Show results summary
      if (results.failed.length === 0) {
      } else if (results.successful.length === 0) {
        throw new Error(`Failed to assign all ${userIds.length} users`);
      } else {
        debugWarn(`⚠️ Partial success: ${results.successful.length} succeeded, ${results.failed.length} failed`);
        setError(`Assigned ${results.successful.length} users successfully, ${results.failed.length} failed`);
      }
      
      return results;
      
    } catch (err) {
      debugError('❌ Error in bulk user assignment:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleUserAssignment = async (userId, targetEventId) => {
    
    try {
      // Find the user being dragged and determine their category
      const draggedUser = userCategories.allCoursesNeeded.find(u => u.id.toString() === userId) ||
                         Object.values(userCategories.someCoursesNeeded).flat().find(u => u.id.toString() === userId) ||
                         userCategories.unassigned.find(u => u.id.toString() === userId) ||
                         userCategories.partiallyAssigned.find(u => u.id.toString() === userId);
      
      const isAllCoursesUser = userCategories.allCoursesNeeded.some(u => u.id.toString() === userId);
      const isSomeCoursesUser = Object.values(userCategories.someCoursesNeeded).flat().some(u => u.id.toString() === userId);
      const isPartiallyAssigned = userCategories.partiallyAssigned.some(u => u.id.toString() === userId);
      
      console.log('🔍 SINGLE ASSIGNMENT - User categorization:', { 
        isAllCoursesUser, 
        isSomeCoursesUser, 
        isPartiallyAssigned,
        userName: draggedUser?.name 
      });

      // If user is already assigned (partially or fully), we need to handle reassignment
      // This handles the case where a user was auto-assigned and is being manually moved
      if (isPartiallyAssigned) {
        console.log('🔄 REASSIGNMENT - User is partially assigned, handling as reassignment');
        
        // Check if this is a cross-group assignment by looking at existing assignments
        const userAssignments = assignments.filter(a => a.end_user_id === parseInt(userId));
        console.log('🔍 REASSIGNMENT - Current user assignments:', userAssignments.length);
        
        // Parse target to see which course and group we're moving to
        const { assignmentData } = parseTargetEventId(targetEventId, draggedUser?.training_location);
        if (assignmentData) {
          const targetGroupId = assignmentData.group_identifier;
          const targetCourseId = assignmentData.courseId || assignmentData.course_id;
          console.log('🔍 REASSIGNMENT - Target group:', targetGroupId, 'Target course:', targetCourseId);
          
          // Check if user has assignments in the SAME COURSE but different group
          // This is true group reassignment - only clear assignments for same course
          const conflictingGroupAssignments = userAssignments.filter(assignment => 
            assignment.course_id === targetCourseId && 
            assignment.group_identifier && 
            assignment.group_identifier !== targetGroupId
          );
          
          if (conflictingGroupAssignments.length > 0) {
            console.log('🔄 REASSIGNMENT - Removing conflicting group assignments within same course');
            
            // Remove conflicting assignments from database - ONLY for the same course
            const { error: deleteError } = await supabase
              .from('user_assignments')
              .delete()
              .eq('end_user_id', parseInt(userId))
              .eq('schedule_id', schedule.id)
              .eq('course_id', targetCourseId); // Only remove assignments for this specific course
            
            if (deleteError) {
              console.error('❌ Error removing conflicting course assignments:', deleteError);
              throw new Error('Failed to remove existing course assignments');
            }
            
            // Remove from local state - ONLY for the same course
            setAssignments(prev => prev.filter(a => 
              !(a.end_user_id === parseInt(userId) && a.course_id === targetCourseId)
            ));
            
            // Recategorize user immediately
            await categorizeUsers();
            
            console.log('✅ REASSIGNMENT - Cleared conflicting course assignments, proceeding with new assignment');
          } else {
            console.log('✅ CROSS-COURSE ASSIGNMENT - No conflicts, adding to different course');
          }
        }
      }
      
      
      // Parse the targetEventId to extract assignment details
      // Pass user's training location for better session matching in drag-and-drop
      const userTrainingLocation = draggedUser?.training_location;
      console.log('🔍 SINGLE ASSIGNMENT - Parsing targetEventId:', targetEventId, 'for user location:', userTrainingLocation);
      const { assignmentData, sessionData } = parseTargetEventId(targetEventId, userTrainingLocation);
      
      console.log('🔍 SINGLE ASSIGNMENT - Parse result:', { assignmentData, sessionData });
      
      if (!assignmentData) {
        console.error('❌ SINGLE ASSIGNMENT - assignmentData is null/undefined');
        throw new Error('Could not parse target event for assignment');
      }
      
      // Re-check user categorization after potential assignment clearing
      // If we cleared assignments, the user should now be treated as needing all courses
      const currentAssignments = assignments.filter(a => a.end_user_id === parseInt(userId));
      const hasAnyAssignments = currentAssignments.length > 0;
      
      // Determine assignment strategy based on current state
      const shouldHandleAsAllCourses = isAllCoursesUser || (!hasAnyAssignments && !isSomeCoursesUser);
      
      console.log('🔍 ASSIGNMENT STRATEGY:', {
        shouldHandleAsAllCourses,
        hasAnyAssignments,
        currentAssignmentsCount: currentAssignments.length
      });

      // If this is an "All Courses Needed" user or cleared user, handle multi-course assignment
      if (shouldHandleAsAllCourses) {
        const multiAssignments = await handleMultiCourseAssignment(userId, assignmentData, sessionData);
        
        // Refresh data after multi-course assignment
        
        // Immediately update assignments state with multi-course assignments
        const tempAssignments = multiAssignments.map(assignment => ({
          id: Date.now() + Math.random(), // temporary ID
          end_user_id: parseInt(userId),
          schedule_id: schedule.id,
          assignment_level: assignment.assignment_level,
          course_id: assignment.course_id,
          session_identifier: assignment.session_identifier,
          training_location: assignment.training_location,
          functional_area: assignment.functional_area,
          group_identifier: assignment.group_identifier
        }));
        
        setAssignments(prev => [...prev, ...tempAssignments]);
        
        // Immediately recategorize users
        await categorizeUsers();
        
        // Then do full refresh from database (with delay for consistency)
        setTimeout(async () => {
          await initializeAssignmentData();
          if (onAssignmentUpdate) {
            onAssignmentUpdate();
          }
        }, 200);
        
        return multiAssignments;
      } else if (isSomeCoursesUser) {
        // Handle "Some Courses Needed" users with single-course assignment (all sessions of the course)
        console.log('🔍 SINGLE ASSIGNMENT - Processing Some Courses user');
        const singleCourseAssignments = await handleSingleCourseAssignment(userId, assignmentData, sessionData);
        
        // Immediately update assignments state
        console.log(`🔄 SOME COURSES - Creating ${singleCourseAssignments.length} temp assignments`);
        const tempAssignments = singleCourseAssignments.map(assignment => ({
          id: Date.now() + Math.random(), // temporary ID
          end_user_id: parseInt(userId),
          schedule_id: schedule.id,
          assignment_level: assignment.assignment_level,
          course_id: assignment.course_id,
          session_identifier: assignment.session_identifier,
          training_location: assignment.training_location,
          functional_area: assignment.functional_area,
          group_identifier: assignment.group_identifier
        }));
        
        console.log(`🔄 SOME COURSES - Temp assignments:`, tempAssignments);
        console.log(`🔄 SOME COURSES - Before update: ${assignments.length} assignments`);
        
        setAssignments(prev => {
          const updated = [...prev, ...tempAssignments];
          console.log(`🔄 SOME COURSES - After update: ${updated.length} assignments`);
          return updated;
        });
        
        // Immediately recategorize users
        await categorizeUsers();
        
        // Refresh all data from database like removeUserFromCourse does
        console.log(`🔄 SOME COURSES - Refreshing all data from database...`);
        await initializeAssignmentData();
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
        
        return singleCourseAssignments;
      }
      
      // Create single session assignment for other users
      console.log(`🔄 CREATING ASSIGNMENT for user ${userId}`);
      // Find the session_id from training_sessions table using session identifier
      let sessionId = null;
      if (sessionData?.id) {
        sessionId = sessionData.id;
      } else {
        // Try to find session_id by matching session identifier
        const { data: sessionLookup } = await supabase
          .from('training_sessions')
          .select('id')
          .eq('schedule_id', schedule.id)
          .eq('session_identifier', assignmentData.sessionIdentifier)
          .single();
        sessionId = sessionLookup?.id;
      }
      
      const insertData = {
        schedule_id: schedule.id,
        end_user_id: parseInt(userId),
        assignment_level: 'session',
        course_id: assignmentData.courseId,
        group_identifier: assignmentData.groupIdentifier,
        session_identifier: assignmentData.sessionIdentifier,
        // Use session_id per new database schema (removed event_id)
        session_id: sessionId,
        training_location: assignmentData.trainingLocation,
        functional_area: assignmentData.functionalArea,
        assignment_type: 'standard',
        notes: `Assigned via drag-and-drop to ${sessionData?.title || 'session'}`
      };
      console.log(`🔄 INSERT DATA:`, insertData);
      
      
      // Try insert with join first
      console.log(`🔄 CALLING SUPABASE INSERT...`);
      let { data, error } = await supabase
        .from('user_assignments')
        .insert([insertData])
        .select(`
          *,
          end_users (id, name, email, project_role, training_location)
        `);
      
      console.log(`🔄 SUPABASE RESULT:`, { data, error });
      
      if (error) {
        console.log(`🔄 INSERT WITH JOIN FAILED:`, error.message);
        debugWarn('Assignment with join failed, trying basic insert:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .insert([insertData])
          .select('*');
        
        console.log(`🔄 BASIC INSERT RESULT:`, { basicData, basicError });
        
        if (basicError) throw basicError;
        data = basicData; // Use the basic data for state update
      } else {
        console.log(`🔄 INSERT WITH JOIN SUCCEEDED`);
      }
      
      // Update local assignments state
      console.log(`🔄 BEFORE UPDATE: Current assignments: ${assignments.length}, Adding: ${(data || []).length}`);
      console.log(`🔄 Data to add:`, data);
      
      setAssignments(prev => {
        console.log(`🔄 INSIDE setAssignments: prev.length = ${prev.length}`);
        const newAssignments = [...prev, ...(data || [])];
        console.log(`🔄 IMMEDIATE UPDATE: Added ${(data || []).length} assignments, total now: ${newAssignments.length}`);
        console.log(`🔄 New assignment details:`, data?.[0]);
        console.log(`🔄 Last assignment in new array:`, newAssignments[newAssignments.length - 1]);
        return newAssignments;
      });
      
      
    } catch (err) {
      debugError('❌ Error creating user assignment:', err);
      throw err;
    }
    
    // Refresh data after assignment
    console.log(`✅ Assignment successful - triggering recategorization`);
    
    // Immediately recategorize users with the updated assignments (assignment already added above)
    await categorizeUsers();
    
    // Force a re-render by calling the parent update handler immediately
    if (onAssignmentUpdate) {
      onAssignmentUpdate();
    }
    
    // Then do full refresh from database (with delay for consistency)
    setTimeout(async () => {
      await initializeAssignmentData();
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
    }, 200);
    
  };

  const handleMultiCourseAssignment = async (userId, assignmentData, sessionData) => {
    console.log(`🔍 MULTI-COURSE ASSIGNMENT START:`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Assignment Data:`, assignmentData);
    console.log(`  Session Data:`, sessionData);
    
    try {
      // Get all sessions in the same training location and functional area
      const allSessions = getAllSessionsFlat();
      const targetLocation = assignmentData.trainingLocation;
      const targetFunctionalArea = assignmentData.functionalArea;
      
      console.log(`🔍 Multi-course assignment parameters:`);
      console.log(`  Target Location: "${targetLocation}"`);
      console.log(`  Target Functional Area: "${targetFunctionalArea}"`);
      console.log(`  Total sessions available: ${allSessions.length}`);
      
      // Extract group information from the target session
      const targetGroupMatch = sessionData.title?.match(/Group (\d+)/);
      const targetGroupNumber = targetGroupMatch ? targetGroupMatch[1] : '1';
      
      
      // Find all sessions that match the target location, functional area, and group
      const matchingSessions = allSessions.filter(session => {
        // PRIORITY 1: Use direct fields from clean data structure
        let sessionLocation = session.training_location;
        let sessionFunctionalArea = session.functional_area;
        
        // FALLBACK: Use legacy parsing if clean fields not available (shouldn't happen with current schema)
        if (!sessionLocation) {
          sessionLocation = session._location;
          if (!sessionLocation && session.group_name) {
            if (session.group_name.includes('|')) {
              sessionLocation = session.group_name.split('|')[0].trim();
            } else if (session.group_name.includes('-')) {
              // Use first part before dash (works with any location name)
              sessionLocation = session.group_name.split('-')[0].trim();
            }
          }
        }
        if (!sessionFunctionalArea) {
          sessionFunctionalArea = session._functionalArea;
          if (!sessionFunctionalArea && session.group_name) {
            if (session.group_name.includes('|')) {
              sessionFunctionalArea = session.group_name.split('|')[1]?.trim();
            }
            // Note: Dash format doesn't typically include functional area, only location-classroom
          }
        }
        
        // Extract group number from session title
        const sessionGroupMatch = session.title?.match(/Group (\d+)/);
        const sessionGroupNumber = sessionGroupMatch ? sessionGroupMatch[1] : '1';
        
        const matches = sessionLocation === targetLocation && 
                       sessionFunctionalArea === targetFunctionalArea &&
                       sessionGroupNumber === targetGroupNumber;
        
        if (matches) {
          console.log(`🔍 FOUND MATCHING SESSION: ${session.title} (${sessionLocation}|${sessionFunctionalArea}, Group ${sessionGroupNumber})`);
        }
        
        return matches;
      });
      
      console.log(`🔍 Found ${matchingSessions.length} matching sessions for multi-course assignment`);
      
      // Group sessions by course to avoid duplicate assignments
      const sessionsByCourse = new Map();
      matchingSessions.forEach(session => {
        const courseId = session.course_id || session.courseId || session.extendedProps?.course_id;
        if (courseId) {
          if (!sessionsByCourse.has(courseId)) {
            sessionsByCourse.set(courseId, []);
          }
          sessionsByCourse.get(courseId).push(session);
        }
      });
      
      
      // Create assignments for all sessions
      const assignmentPromises = [];
      
      for (const [courseId, courseSessions] of sessionsByCourse) {
        for (const session of courseSessions) {
          const sessionId = getSessionId(session);
          
          // Find the session_id from training_sessions table 
          let sessionDbId = null;
          if (session?.id) {
            sessionDbId = session.id;
          } else {
            // Try to find session_id by matching session identifier
            const { data: sessionLookup } = await supabase
              .from('training_sessions')
              .select('id')
              .eq('schedule_id', schedule.id)
              .eq('session_identifier', sessionId)
              .single();
            sessionDbId = sessionLookup?.id;
          }
          
          const courseAssignmentData = {
            schedule_id: schedule.id,
            end_user_id: parseInt(userId),
            assignment_level: 'session',
            course_id: courseId,
            group_identifier: `${courseId}-group-${targetGroupNumber}`,
            session_identifier: sessionId,
            // Use session_id per new database schema (removed event_id)
            session_id: sessionDbId,
            training_location: targetLocation,
            functional_area: targetFunctionalArea,
            assignment_type: 'standard',
            notes: `Assigned via drag-and-drop multi-course assignment to ${session.title || 'session'} (Group ${targetGroupNumber})`
          };
          
          // Create the assignment
          console.log(`🔍 DATABASE INSERT ATTEMPT:`, courseAssignmentData);
          
          const assignmentPromise = supabase
            .from('user_assignments')
            .insert([courseAssignmentData])
            .select('*')
            .then(result => {
              if (result.error) {
                console.error(`❌ DATABASE INSERT FAILED:`, result.error);
                console.error(`❌ Failed data:`, courseAssignmentData);
              } else {
                console.log(`✅ DATABASE INSERT SUCCESS:`, result.data);
              }
              return result;
            });
            
          assignmentPromises.push(assignmentPromise);
        }
      }
      
      // Execute all assignments
      console.log(`🔍 Executing ${assignmentPromises.length} assignment promises...`);
      const results = await Promise.all(assignmentPromises);
      
      // Check for errors and collect successful assignments
      console.log(`🔍 Processing ${results.length} assignment results...`);
      const successfulAssignments = [];
      const errors = [];
      
      results.forEach((result, index) => {
        if (result.error) {
          errors.push(result.error);
          debugError('❌ Assignment creation failed:', result.error);
        } else {
          console.log(`✅ Assignment ${index + 1} successful:`, result.data);
          successfulAssignments.push(...(result.data || []));
        }
      });
      
      if (errors.length > 0) {
        debugWarn(`⚠️ ${errors.length} assignments failed, ${successfulAssignments.length} succeeded`);
      }
      
      
      // Update local assignments state with successful assignments
      if (successfulAssignments.length > 0) {
        setAssignments(prev => {
          const newAssignments = [...prev, ...successfulAssignments];
          return newAssignments;
        });
      }
      
      return successfulAssignments;
      
    } catch (err) {
      debugError('❌ Error in multi-course assignment:', err);
      throw err;
    }
  };

  const handleSingleCourseAssignment = async (userId, assignmentData, sessionData) => {
    console.log(`🔍 SINGLE-COURSE ASSIGNMENT START:`);
    console.log(`  User ID: ${userId}`);
    console.log(`  Assignment Data:`, assignmentData);
    console.log(`  Session Data:`, sessionData);
    
    try {
      // Get all sessions for the specific course in the same training location and functional area
      const allSessions = getAllSessionsFlat();
      const targetLocation = assignmentData.trainingLocation;
      const targetFunctionalArea = assignmentData.functionalArea;
      const targetCourseId = assignmentData.courseId;
      
      console.log(`🔍 Single-course assignment parameters:`);
      console.log(`  Target Location: "${targetLocation}"`);
      console.log(`  Target Functional Area: "${targetFunctionalArea}"`);
      console.log(`  Target Course ID: "${targetCourseId}"`);
      console.log(`  Total sessions available: ${allSessions.length}`);
      
      // Extract group information from the target session
      const targetGroupMatch = sessionData.title?.match(/Group (\d+)/);
      const targetGroupNumber = targetGroupMatch ? targetGroupMatch[1] : '1';
      
      console.log(`🔍 Target Group Number: ${targetGroupNumber}`);
      
      // Find all sessions for this specific course in the target location, functional area, and group
      const matchingSessions = allSessions.filter(session => {
        // PRIORITY 1: Use direct fields from clean data structure
        let sessionLocation = session.training_location;
        let sessionFunctionalArea = session.functional_area;
        
        // FALLBACK: Use legacy parsing if clean fields not available (shouldn't happen with current schema)
        if (!sessionLocation) {
          sessionLocation = session._location;
          if (!sessionLocation && session.group_name) {
            if (session.group_name.includes('|')) {
              sessionLocation = session.group_name.split('|')[0].trim();
            } else if (session.group_name.includes('-')) {
              // Use first part before dash (works with any location name)
              sessionLocation = session.group_name.split('-')[0].trim();
            }
          }
        }
        if (!sessionFunctionalArea) {
          sessionFunctionalArea = session._functionalArea;
          if (!sessionFunctionalArea && session.group_name) {
            if (session.group_name.includes('|')) {
              sessionFunctionalArea = session.group_name.split('|')[1]?.trim();
            }
            // Note: Dash format doesn't typically include functional area, only location-classroom
          }
        }
        
        // Extract group number from session title
        const sessionGroupMatch = session.title?.match(/Group (\d+)/);
        const sessionGroupNumber = sessionGroupMatch ? sessionGroupMatch[1] : '1';
        
        // Extract course ID from session
        const sessionCourseId = session.course_id || session.courseId || session.extendedProps?.course_id;
        
        const matches = sessionLocation === targetLocation && 
                       sessionFunctionalArea === targetFunctionalArea &&
                       sessionGroupNumber === targetGroupNumber &&
                       sessionCourseId === targetCourseId;
        
        if (matches) {
          console.log(`🔍 FOUND MATCHING SESSION: ${session.title} (${sessionLocation}|${sessionFunctionalArea}, Group ${sessionGroupNumber}, Course ${sessionCourseId})`);
        }
        
        return matches;
      });
      
      console.log(`🔍 Found ${matchingSessions.length} matching sessions for single-course assignment`);
      
      // Create assignments for all sessions of this course
      const assignmentPromises = [];
      
      for (const session of matchingSessions) {
        const sessionId = getSessionId(session);
        
        // Find the session_id from training_sessions table
        let sessionDbId = null;
        if (session?.id) {
          sessionDbId = session.id;
        } else {
          // Try to find session_id by matching session identifier
          const { data: sessionLookup } = await supabase
            .from('training_sessions')
            .select('id')
            .eq('schedule_id', schedule.id)
            .eq('session_identifier', sessionId)
            .single();
          sessionDbId = sessionLookup?.id;
        }
        
        const courseAssignmentData = {
          schedule_id: schedule.id,
          end_user_id: parseInt(userId),
          assignment_level: 'session',
          course_id: targetCourseId,
          session_identifier: sessionId,
          // Use session_id per new database schema (removed event_id)
          session_id: sessionDbId,
          training_location: targetLocation,
          functional_area: targetFunctionalArea,
          group_identifier: assignmentData.groupIdentifier,
          assignment_type: 'standard',
          notes: `Assigned via single-course drag-and-drop to ${session.title || 'session'}`
        };
        
        console.log(`🔍 Creating assignment for session: ${session.title}`);
        assignmentPromises.push(
          supabase.from('user_assignments').insert(courseAssignmentData)
        );
      }
      
      // Execute all assignments
      console.log(`🔍 Executing ${assignmentPromises.length} assignment promises...`);
      const results = await Promise.allSettled(assignmentPromises);
      const successfulAssignments = [];
      const failedAssignments = [];
      
      console.log(`🔍 Assignment results:`, results);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && !result.value.error) {
          console.log(`✅ Assignment ${index} succeeded`);
          successfulAssignments.push({
            assignment_level: 'session',
            course_id: targetCourseId,
            session_identifier: matchingSessions[index].eventId || matchingSessions[index].id,
            training_location: targetLocation,
            functional_area: targetFunctionalArea,
            group_identifier: assignmentData.groupIdentifier
          });
        } else {
          console.log(`❌ Assignment ${index} failed:`, result);
          failedAssignments.push({
            session: matchingSessions[index].title,
            error: result.reason || result.value?.error
          });
        }
      });
      
      console.log(`🔍 Single-course assignment complete:`, {
        successful: successfulAssignments.length,
        failed: failedAssignments.length
      });
      
      if (failedAssignments.length > 0) {
        console.warn('⚠️ Some single-course assignments failed:', failedAssignments);
      }
      
      return successfulAssignments;
      
    } catch (err) {
      console.error('❌ Error in single-course assignment:', err);
      throw err;
    }
  };

  // Remove user from all sessions in a specific group
  const removeUserFromGroup = async (userInfo, sessionInfo) => {
    try {
      console.log('🗑️ Removing user from group:', userInfo, sessionInfo);
      
      // Extract group information from session
      const groupMatch = sessionInfo.title?.match(/Group (\d+)/);
      const groupNumber = groupMatch ? groupMatch[1] : '1';
      
      // Extract training location from session using clean structure
      let trainingLocation = sessionInfo.training_location || 'Unknown';
      
      // FALLBACK: Parse from legacy compound key if clean field not available
      if (trainingLocation === 'Unknown' && sessionInfo.group_name && sessionInfo.group_name.includes('|')) {
        const parts = sessionInfo.group_name.split('|');
        trainingLocation = parts[0]?.trim() || trainingLocation;
      }
      
      // Delete all assignments for this user in this group at this training location
      const { error } = await supabase
        .from('user_assignments')
        .delete()
        .eq('schedule_id', schedule.id)
        .eq('end_user_id', userInfo.userId || userInfo.end_user_id)
        .eq('training_location', trainingLocation)
        .like('group_identifier', `%-group-${groupNumber}`);
      
      if (error) {
        console.error('❌ Error removing user from group:', error);
        throw error;
      }
      
      console.log('✅ Successfully removed user from group');
      
      // Refresh the assignment data
      await initializeAssignmentData();
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
      
    } catch (err) {
      console.error('❌ Error in removeUserFromGroup:', err);
      throw err;
    }
  };

  // Remove user from all sessions of a specific course
  const removeUserFromCourse = async (userInfo, sessionInfo) => {
    try {
      console.log('🗑️ Removing user from course:', userInfo, sessionInfo);
      
      // Extract course ID from session
      const courseId = sessionInfo.course_id || sessionInfo.courseId;
      
      // Extract training location from session using clean structure
      let trainingLocation = sessionInfo.training_location || 'Unknown';
      
      // FALLBACK: Parse from legacy compound key if clean field not available
      if (trainingLocation === 'Unknown' && sessionInfo.group_name && sessionInfo.group_name.includes('|')) {
        const parts = sessionInfo.group_name.split('|');
        trainingLocation = parts[0]?.trim() || trainingLocation;
      }
      
      // Delete all assignments for this user for this course at this training location
      const { error } = await supabase
        .from('user_assignments')
        .delete()
        .eq('schedule_id', schedule.id)
        .eq('end_user_id', userInfo.userId || userInfo.end_user_id)
        .eq('course_id', courseId)
        .eq('training_location', trainingLocation);
      
      if (error) {
        console.error('❌ Error removing user from course:', error);
        throw error;
      }
      
      console.log('✅ Successfully removed user from course');
      
      // Refresh the assignment data
      await initializeAssignmentData();
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
      
    } catch (err) {
      console.error('❌ Error in removeUserFromCourse:', err);
      throw err;
    }
  };

  // Remove all assignments for the current schedule
  const handleRemoveAllAssignments = async () => {
    try {
      // First confirmation dialog
      const firstConfirm = window.confirm(
        `⚠️ WARNING: Remove All Assignments\n\n` +
        `This will permanently remove ALL user assignments from:\n` +
        `• Schedule: ${schedule?.name}\n` +
        `• All courses and events\n` +
        `• All groups and training locations\n\n` +
        `This action cannot be undone!\n\n` +
        `Are you sure you want to continue?`
      );

      if (!firstConfirm) {
        return; // User cancelled
      }

      // Second confirmation with exact count
      const currentAssignmentCount = assignments?.length || 0;
      const secondConfirm = window.confirm(
        `⚠️ FINAL CONFIRMATION\n\n` +
        `You are about to DELETE ${currentAssignmentCount} assignments.\n\n` +
        `Type 'DELETE' in the next prompt to confirm this action.`
      );

      if (!secondConfirm) {
        return; // User cancelled
      }

      // Third confirmation requiring user to type DELETE
      const deleteConfirmation = window.prompt(
        `⚠️ FINAL SAFETY CHECK\n\n` +
        `To permanently delete all ${currentAssignmentCount} assignments, type: DELETE\n\n` +
        `(This action is irreversible)`
      );

      if (deleteConfirmation !== 'DELETE') {
        alert('❌ Action cancelled. You must type "DELETE" exactly to confirm.');
        return;
      }

      setLoading(true);
      setError(null);

      // Delete all assignments for this schedule
      const { error } = await supabase
        .from('user_assignments')
        .delete()
        .eq('schedule_id', schedule.id);

      if (error) {
        throw new Error(`Failed to remove assignments: ${error.message}`);
      }

      // Refresh the assignment data
      await initializeAssignmentData();
      
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }

      alert(`✅ Successfully removed all ${currentAssignmentCount} assignments from the schedule.`);

    } catch (err) {
      console.error('❌ Error removing all assignments:', err);
      setError(`Failed to remove assignments: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Export user assignment data to CSV
  const handleExportAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📄 Starting assignment data export...');

      // Query user assignments with joined user data only
      let query = supabase
        .from('user_assignments')
        .select(`
          *,
          end_users!inner(id, name, training_location, project_role)
        `)
        .eq('schedule_id', schedule.id);

      // Filter by training location if specified
      if (selectedTrainingLocation) {
        query = query.eq('end_users.training_location', selectedTrainingLocation);
      }

      const { data: assignmentData, error } = await query;
      
      if (error) {
        throw new Error(`Failed to fetch assignment data: ${error.message}`);
      }

      // Get course data separately
      const courseIds = [...new Set(assignmentData.map(assignment => assignment.course_id).filter(Boolean))];
      let coursesData = [];
      
      if (courseIds.length > 0) {
        const { data: courses, error: coursesError } = await supabase
          .from('courses_tbl')
          .select('course_id, course_name, duration_hrs')
          .in('course_id', courseIds);
        
        if (coursesError) {
          console.warn('Could not fetch course details:', coursesError.message);
        } else {
          coursesData = courses || [];
        }
      }

      // Create a course lookup map
      const courseMap = {};
      coursesData.forEach(course => {
        courseMap[course.course_id] = course;
      });

      if (!assignmentData || assignmentData.length === 0) {
        alert('📄 No assignment data to export for the current selection.');
        return;
      }

      // Get session details for context
      const sessions = getAllSessionsFlat();
      console.log('🔍 Export: Found', sessions.length, 'sessions');
      console.log('🔍 Export: Sample session structure:', sessions[0]);
      
      // Create session map using multiple matching strategies since session_identifier formats don't match
      const sessionMap = {};
      
      sessions.forEach(session => {
        // Strategy 1: Use session_identifier if available
        if (session.session_identifier) {
          sessionMap[session.session_identifier] = session;
        }
        
        // Strategy 2: Create composite key for more reliable matching
        // Using course_id, session_number, training_location, functional_area
        const compositeKey = `${session.course_id}-session${session.session_number || session.sessionNumber}-${session.training_location?.toLowerCase().replace(/\s+/g, '-')}-${session.functional_area?.toLowerCase().replace(/\s+/g, '-')}`;
        sessionMap[compositeKey] = session;
        
        // Strategy 3: Also try with part information for multi-part sessions
        if (session.title && session.title.includes('Part')) {
          const partMatch = session.title.match(/Part (\d+)/);
          if (partMatch) {
            const partKey = `${compositeKey}-part${partMatch[1]}`;
            sessionMap[partKey] = session;
          }
        }
      });
      
      console.log('🔍 Export: Created sessionMap with', Object.keys(sessionMap).length, 'entries');
      console.log('🔍 Export: SessionMap sample keys:', Object.keys(sessionMap).slice(0, 10));

      // Transform data for CSV export with stakeholder-friendly format
      const csvData = assignmentData.map((assignment, index) => {
        const course = courseMap[assignment.course_id] || {};
        
        // Try multiple strategies to find the matching session
        let session = {};
        
        // Strategy 1: Direct session_identifier match
        if (assignment.session_identifier && sessionMap[assignment.session_identifier]) {
          session = sessionMap[assignment.session_identifier];
        }
        // Strategy 2: Try composite key matching
        else if (assignment.course_id && assignment.training_location && assignment.functional_area) {
          // Extract session number from group_identifier if available
          const sessionNumber = assignment.group_identifier?.match(/session(\d+)/)?.[1] || '1';
          const compositeKey = `${assignment.course_id}-session${sessionNumber}-${assignment.training_location.toLowerCase().replace(/\s+/g, '-')}-${assignment.functional_area.toLowerCase().replace(/\s+/g, '-')}`;
          
          if (sessionMap[compositeKey]) {
            session = sessionMap[compositeKey];
          }
          // Strategy 3: Try with part information if session_identifier suggests it's a multi-part session
          else if (assignment.session_identifier && assignment.session_identifier.includes('part')) {
            const partMatch = assignment.session_identifier.match(/part(\d+)/);
            if (partMatch) {
              const partKey = `${compositeKey}-part${partMatch[1]}`;
              if (sessionMap[partKey]) {
                session = sessionMap[partKey];
              }
            }
          }
        }
        
        // Debug first few assignments
        if (index < 3) {
          console.log(`🔍 Export: Assignment ${index}:`, {
            assignmentSessionId: assignment.session_identifier,
            courseId: assignment.course_id,
            trainingLocation: assignment.training_location,
            functionalArea: assignment.functional_area,
            groupIdentifier: assignment.group_identifier,
            sessionFound: Object.keys(session).length > 0,
            sessionKeys: Object.keys(session),
            sessionStart: session.start,
            sessionEnd: session.end
          });
        }
        
        return {
          // Core assignment info
          'User Name': assignment.end_users?.name || 'Unknown',
          'Training Location': assignment.end_users?.training_location || 'Unknown',
          'Project Role': assignment.end_users?.project_role || 'Unknown',
          
          // Course details
          'Course Name': course.course_name || 'Unknown',
          'Course Duration (Hours)': course.duration_hrs || 'Unknown',
          
          // Current assignment details
          'Current Group': assignment.group_identifier || 'N/A',
          'Functional Area': assignment.functional_area || 'Unknown',
          
          // Session schedule context (if available)
          'Session Start Date': session.start ? new Date(session.start).toLocaleDateString('en-GB') : 'N/A',
          'Session Start Time': session.start ? new Date(session.start).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}) : 'N/A',
          'Session End Time': session.end ? new Date(session.end).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}) : 'N/A',
          
          // Stakeholder input columns
          'Proposed Group Change': '', // Empty for stakeholder to fill
          'Proposed Course Change': '', // Empty for stakeholder to fill
          'Reviewer Comments': '', // Empty for stakeholder to fill
          'Change Reason': '', // Empty for stakeholder to fill
          
          // Technical details (hidden in later columns for reference)
          'Course ID': assignment.course_id || 'Unknown',
          'Session Identifier': assignment.session_identifier || 'N/A',
          'Assignment Type': assignment.assignment_type || 'Unknown',
          'Assignment Level': assignment.assignment_level || 'Unknown',
          'Current Notes': assignment.notes || '',
          'Created At': assignment.created_at ? new Date(assignment.created_at).toLocaleString('en-GB') : 'Unknown'
        };
      });

      // Convert to CSV using the same utility pattern as ExportAllData
      const convertToCSV = (objArray) => {
        const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
        let str = `${Object.keys(array[0])
          .map((value) => `"${value}"`)
          .join(',')}\r\n`;

        return (
          str +
          array
            .map((obj) => {
              return Object.values(obj)
                .map((value) => `"${value || ''}"`)
                .join(',');
            })
            .join('\r\n')
        );
      };

      const csv = convertToCSV(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      
      // Generate filename with schedule name and date
      const scheduleName = schedule?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'schedule';
      const locationSuffix = selectedTrainingLocation ? `_${selectedTrainingLocation.replace(/\s+/g, '_')}` : '';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `assignments_for_review_${scheduleName}${locationSuffix}_${dateStr}.csv`;
      
      saveAs(blob, filename);
      
      console.log(`✅ Successfully exported ${csvData.length} assignment records to ${filename}`);

    } catch (err) {
      console.error('❌ Error exporting assignment data:', err);
      setError(`Failed to export assignment data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Import user assignment data from CSV
  const handleImportAssignments = async (csvData) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📥 Starting assignment data import...');
      
      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
        changes: []
      };

      // Parse CSV data and validate changes
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        results.processed++;
        
        try {
          // Skip rows without proposed changes
          if (!row['Proposed Group Change'] && !row['Proposed Course Change']) {
            continue;
          }
          
          const userName = row['User Name'];
          const currentGroup = row['Current Group'];
          const proposedGroup = row['Proposed Group Change'];
          const proposedCourse = row['Proposed Course Change'];
          const reason = row['Change Reason'] || 'Stakeholder review';
          
          // Find user in database
          const { data: users, error: userError } = await supabase
            .from('end_users')
            .select('id, name, training_location')
            .eq('name', userName)
            .limit(1);
            
          if (userError || !users || users.length === 0) {
            results.failed++;
            results.errors.push(`Row ${i + 1}: User "${userName}" not found`);
            continue;
          }
          
          const user = users[0];
          
          // Process group change
          if (proposedGroup && proposedGroup !== currentGroup) {
            // Remove user from current assignments
            const { error: deleteError } = await supabase
              .from('user_assignments')
              .delete()
              .eq('schedule_id', schedule.id)
              .eq('end_user_id', user.id)
              .eq('group_identifier', currentGroup);
              
            if (deleteError) {
              results.failed++;
              results.errors.push(`Row ${i + 1}: Failed to remove user from group "${currentGroup}": ${deleteError.message}`);
              continue;
            }
            
            // Add user to new group (this would need to be implemented based on your group assignment logic)
            // For now, we'll log the change
            results.changes.push({
              user: userName,
              type: 'group_change',
              from: currentGroup,
              to: proposedGroup,
              reason: reason
            });
          }
          
          results.successful++;
          
        } catch (rowError) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }
      
      // Refresh assignment data
      await initializeAssignmentData();
      
      console.log(`✅ Import completed: ${results.successful} successful, ${results.failed} failed`);
      
      return results;
      
    } catch (err) {
      console.error('❌ Error importing assignment data:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Parse CSV file for import preview
  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          
          const data = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
              const values = line.split(',').map(v => v.replace(/"/g, '').trim());
              const row = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              return row;
            });
          
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const parseTargetEventId = (targetEventId, userTrainingLocation = null) => {
    console.log(`🔍 PARSE TARGET EVENT ID START: "${targetEventId}"`);
    console.log(`🔍 User training location context: "${userTrainingLocation}"`);
    console.log(`🔍 Event ID length: ${targetEventId.length}`);
    console.log(`🔍 Event ID split by '-':`, targetEventId.split('-'));
    
    // Check if this is the new unique format by looking for multiple dashes
    const isNewFormat = (targetEventId.match(/-/g) || []).length > 4;
    console.log(`🔍 Detected ID format: ${isNewFormat ? 'NEW (unique)' : 'OLD (legacy)'}`);
    
    // Extract location from targetEventId if it has location suffix
    let locationFromId = null;
    let baseEventId = targetEventId;
    
    // Check if targetEventId has location suffix (new format from auto-assignment)
    // Look for any location name by checking if the last part looks like a location (no spaces, alphanumeric)
    const parts = targetEventId.split('-');
    const lastPart = parts[parts.length - 1];
    
    // Check if last part looks like a location suffix (CamelCase, no spaces, not "Unknown")
    const looksLikeLocationSuffix = lastPart && 
                                  lastPart !== 'Unknown' && 
                                  lastPart.length > 3 && 
                                  /^[A-Z][a-zA-Z]+$/.test(lastPart) && 
                                  !lastPart.includes(' ');
    
    if (looksLikeLocationSuffix && isNewFormat) {
      // Convert camelCase back to spaced format
      locationFromId = lastPart.replace(/([A-Z])/g, ' $1').trim();
      baseEventId = parts.slice(0, -1).join('-'); // Remove location suffix
      console.log(`🔍 AUTO-ASSIGNMENT FORMAT: Extracted location "${locationFromId}" from ID suffix "${lastPart}"`);
    } else {
      // Regular drag-and-drop format (no location suffix)
      baseEventId = targetEventId;
      console.log(`🔍 DRAG-DROP FORMAT: Using targetEventId as-is`);
    }
    
    // Find the session data from schedule by checking both flattened and original grouped structure
    const sessions = getAllSessionsFlat();
    
    let matchingSessions = [];
    
    // Handle new Schedule Manager format: trainingLocation-classroomName-sessionTitle-index
    if (baseEventId.includes('-')) {
      const parts = baseEventId.split('-');
      
      // Handle our specific format: "Kuwait Training Centre-Classroom 1-Transfers - Group 1 Part 1-0"
      // Split gives us: ['Kuwait Training Centre', 'Classroom 1', 'Transfers ', ' Group 1 Part 1', '0']
      if (parts.length === 5) {
        const trainingLocationFromId = parts[0]; // "Kuwait Training Centre"
        const classroomFromId = parts[1]; // "Classroom 1"
        // Reconstruct the title by joining the middle parts and cleaning up extra spaces
        const sessionTitleFromId = (parts[2] + '-' + parts[3]).trim(); // "Transfers - Group 1 Part 1"
        const indexPart = parts[4]; // "0"
        
        console.log(`🔍 NEW FORMAT DETECTED: location="${trainingLocationFromId}", classroom="${classroomFromId}", title="${sessionTitleFromId}", index="${indexPart}"`);
        
        // Normalize location name (already correct)
        let normalizedLocation = trainingLocationFromId;
        
        console.log(`🔍 Normalized location: "${normalizedLocation}"`);
        
        // Find sessions that match the extracted information
        if (normalizedLocation && sessionTitleFromId) {
          matchingSessions = sessions.filter(session => {
            // Match by exact title (sessions should have the exact title)
            const titleMatch = session.title === sessionTitleFromId;
            
            // Match by location using our added metadata
            const locationMatch = session._location === normalizedLocation || 
                                 session.training_location === normalizedLocation ||
                                 (session.group_name && session.group_name.includes(normalizedLocation));
            
            // Also check classroom if we extracted it
            let classroomMatch = true;
            if (classroomFromId) {
              classroomMatch = session._classroom === classroomFromId;
            }
            
            console.log(`🔍 Session check: "${session.title}", location="${session._location}", classroom="${session._classroom}"`);
            console.log(`🔍   Title match: ${titleMatch}, Location match: ${locationMatch}, Classroom match: ${classroomMatch}`);
            
            return titleMatch && locationMatch && classroomMatch;
          });
        } else {
          console.log('⚠️ Could not extract location or title from new format, falling back to old logic');
          matchingSessions = [];
        }
      } else {
        // Fall back to old format matching for backwards compatibility
        matchingSessions = sessions.filter(session => {
          // Direct ID match first
          if (session.eventId === baseEventId || session.id === baseEventId) {
            return true;
          }
          
          // For old generated IDs, extract key components and match
          const title = session.title || 'untitled';
          
          // Check if the ID starts with the session title
          if (baseEventId.startsWith(title)) {
            // Extract timestamps from the end of the ID (last two parts should be timestamps)
            const lastTwoParts = parts.slice(-2);
            if (lastTwoParts.length === 2) {
              const [startTimeStr, endTimeStr] = lastTwoParts;
              const sessionStart = new Date(session.start).getTime().toString();
              const sessionEnd = new Date(session.end).getTime().toString();
              
              // Match by title and timestamps
              return startTimeStr === sessionStart && endTimeStr === sessionEnd;
            }
          }
          
          return false;
        });
      }
    } else {
      // Simple ID matching for non-hyphenated IDs
      matchingSessions = sessions.filter(session => {
        return session.eventId === baseEventId || session.id === baseEventId;
      });
    }
    
    console.log(`🔍 Found ${matchingSessions.length} sessions with matching ID`);
    matchingSessions.forEach((session, index) => {
      const sessionLocation = session.training_location || session.location || 'Unknown';
      console.log(`🔍 Session ${index + 1}: Location="${sessionLocation}", group_name="${session.group_name}"`);
    });
    
    let sessionData;
    
    // If we have a location from ID (auto-assignment), find the session that matches that location
    if (locationFromId) {
      sessionData = matchingSessions.find(session => {
        const sessionLocation = session.training_location || session.location || 'Unknown';
        const locationMatches = sessionLocation === locationFromId;
        console.log(`🔍 Auto-assignment location check: session="${sessionLocation}", expected="${locationFromId}", matches=${locationMatches}`);
        return locationMatches;
      });
    } else {
      // For drag-and-drop, use the user's training location to pick the right session
      if (matchingSessions.length > 1 && userTrainingLocation) {
        console.log(`🔍 Multiple sessions found - using user location "${userTrainingLocation}" to resolve`);
        sessionData = matchingSessions.find(session => {
          const sessionLocation = session.training_location || session.location || 'Unknown';
          const matches = sessionLocation === userTrainingLocation;
          console.log(`🔍 Session location "${sessionLocation}" matches user location "${userTrainingLocation}": ${matches}`);
          return matches;
        });
        
        // Fallback to first session if no location match
        if (!sessionData) {
          console.log(`⚠️ No session found matching user location, using first available`);
          sessionData = matchingSessions[0];
        }
      } else {
        sessionData = matchingSessions[0];
        console.log(`🔍 Drag-drop: Using single/first session`);
      }
    }
    
    console.log(`🔍 SESSION SEARCH RESULT:`, sessionData ? 'FOUND' : 'NOT FOUND');
    if (sessionData) {
      console.log(`✅ SELECTED SESSION:`, {
        title: sessionData.title,
        group_name: sessionData.group_name,
        eventId: sessionData.eventId,
        id: sessionData.id
      });
      
      // Extract group number for verification
      const groupMatch = sessionData.title?.match(/Group (\d+)/);
      if (groupMatch) {
        console.log(`✅ FINAL TARGET GROUP: ${groupMatch[1]} (from session: ${sessionData.title})`);
      }
    } else {
      console.log(`❌ No session found with baseEventId: "${baseEventId}"`);
      console.log(`🔍 Available session IDs:`, sessions.slice(0, 5).map(s => 
        s.eventId || s.id || `${s.title || 'untitled'}-${new Date(s.start).getTime()}-${new Date(s.end).getTime()}`
      ));
    }
    
    // SOLUTION: Detect correct training location from the original schedule structure
    // Handle both flat array (numeric keys) and nested object structure
    let correctTrainingLocation = null;
    let correctFunctionalArea = null;
    
    console.log('🔍 LOCATION DETECTION: Starting search in schedule structure...');
    console.log('🔍 Schedule sessions type:', typeof schedule?.sessions);
    console.log('🔍 Schedule sessions keys:', schedule?.sessions ? Object.keys(schedule.sessions) : 'none');
    console.log('🔍 Target Event ID:', targetEventId);
    
    // Debug: Show all sessions with same title to see potential ID conflicts
    const sessionsWithSameTitle = sessions.filter(s => s.title === 'Transfers - Group 1 (Part 1)');
    console.log('🔍 ALL SESSIONS WITH TITLE "Transfers - Group 1 (Part 1)":', 
      sessionsWithSameTitle.map(s => ({
        eventId: s.eventId || s.id || `${s.title || 'untitled'}-${new Date(s.start).getTime()}-${new Date(s.end).getTime()}`,
        groupName: s.group_name,
        title: s.title,
        start: s.start,
        end: s.end
      }))
    );
    
    if (schedule?.sessions && typeof schedule.sessions === 'object') {
      // Check if we have a flat array structure (numeric keys like "0", "1", "2"...)
      const sessionKeys = Object.keys(schedule.sessions);
      const isNumericKeys = sessionKeys.every(key => !isNaN(key));
      
      if (isNumericKeys) {
        console.log('🔍 Detected flat array structure with numeric keys');
        
        // For flat array structure, search directly through sessions
        // IMPORTANT: Use find() to get the first match, not forEach() which processes all
        const matchedSession = Object.values(schedule.sessions).find((session) => {
          if (session && typeof session === 'object') {
            const sId = getSessionId(session);
            return sId === targetEventId;
          }
          return false;
        });
        
        if (matchedSession) {
          console.log('🔍 DEBUGGING MATCHED SESSION:', {
            sessionTitle: matchedSession.title,
            sessionGroupName: matchedSession.group_name,
            sessionLocation: matchedSession.location,
            allSessionFields: Object.keys(matchedSession)
          });
          
          // Extract location and functional area from session's group_name
          if (matchedSession.group_name && typeof matchedSession.group_name === 'string' && matchedSession.group_name.includes('|')) {
            const groupParts = matchedSession.group_name.split('|');
            console.log('🔍 GROUP PARTS ANALYSIS:', {
              originalGroupName: matchedSession.group_name,
              splitParts: groupParts,
              part0: groupParts[0]?.trim(),
              part1: groupParts[1]?.trim()
            });
            
            // Training locations typically contain "Training" or "Centre"
            for (let i = 0; i < groupParts.length; i++) {
              const part = groupParts[i].trim();
              console.log(`🔍 PART ${i}: "${part}" - contains Training: ${part.includes('Training')}, contains Centre: ${part.includes('Centre')}`);
              
              if (part.includes('Training') || part.includes('Centre')) {
                correctTrainingLocation = part;
              } else {
                correctFunctionalArea = part;
              }
            }
            
            console.log('🎯 FOUND CORRECT LOCATION (from flat structure):', {
              targetEventId,
              sessionTitle: matchedSession.title,
              correctLocation: correctTrainingLocation,
              correctFunctionalArea: correctFunctionalArea,
              sessionGroupName: matchedSession.group_name
            });
          } else {
            console.log('🔍 NO PIPE DELIMITER IN GROUP NAME:', matchedSession.group_name);
            // Try other fields as fallback
            if (matchedSession.location) {
              correctTrainingLocation = matchedSession.location;
              console.log('🔍 USING session.location AS FALLBACK:', matchedSession.location);
            }
          }
        }
      } else {
        // Original nested structure search
        console.log('🔍 Detected nested object structure');
        Object.entries(schedule.sessions).forEach(([location, locationData]) => {
          console.log('🔍 Searching location:', location, 'type:', typeof locationData);
          
          if (locationData && typeof locationData === 'object') {
            Object.entries(locationData).forEach(([functionalArea, sessionList]) => {
              console.log('🔍 Searching functional area:', functionalArea, 'sessions:', Array.isArray(sessionList) ? sessionList.length : 'not array');
              
              if (Array.isArray(sessionList)) {
                const foundInThisSection = sessionList.find(s => {
                  const sId = s.eventId || s.id || 
                    `${s.title || 'untitled'}-${new Date(s.start).getTime()}-${new Date(s.end).getTime()}`;
                  
                  if (s.title === 'Transfers - Group 1 (Part 1)') {
                    console.log('🔍 Found matching title session with ID:', sId, 'vs target:', targetEventId);
                  }
                  
                  return sId === targetEventId;
                });
                
                if (foundInThisSection) {
                  correctTrainingLocation = location;
                  correctFunctionalArea = functionalArea;
                  console.log('🎯 FOUND CORRECT LOCATION (from nested structure):', {
                    targetEventId,
                    sessionTitle: foundInThisSection.title,
                    correctLocation: location,
                    correctFunctionalArea: functionalArea,
                    sessionGroupName: foundInThisSection.group_name
                  });
                }
              }
            });
          }
        });
      }
    }
    
    if (!sessionData) {
      debugError('❌ Could not find session data for targetEventId:', targetEventId);
      debugError('❌ Available session IDs:', sessions.map(s => s.eventId || s.id || `${s.title || 'untitled'}-${new Date(s.start).getTime()}-${new Date(s.end).getTime()}`));
      debugError('❌ Available session titles:', sessions.map(s => s.title));
      debugError('❌ Available session locations:', sessions.map(s => ({ title: s.title, _location: s._location, _classroom: s._classroom })));
      console.log('🔍 FULL SESSION DUMP:', sessions.slice(0, 3)); // Show first 3 sessions
      return { assignmentData: null, sessionData: null };
    }
    
    // Only log when assignment actually happens - remove excessive debug logging
    
    // Extract assignment details from session
    const courseId = sessionData.course_id || sessionData.courseId || sessionData.extendedProps?.course_id;
    const courseName = sessionData.course_name || sessionData.courseName || sessionData.extendedProps?.course_name;
    
    // Parse group from title (e.g., "Transfers - Group 1 (Part 1)")
    const groupMatch = sessionData.title?.match(/Group (\d+)/);
    const groupNumber = groupMatch ? groupMatch[1] : '1';
    const groupIdentifier = `${courseId}-group-${groupNumber}`;
    
    // Create session identifier from title and timestamp
    // Use base ID (without location suffix) since that's what's stored in database
    const sessionIdentifier = baseEventId;
    
    // Extract training location and functional area from session data using clean structure
    // PRIORITY 1: Use direct fields from clean data structure
    let trainingLocation = sessionData.training_location;
    let functionalArea = sessionData.functional_area;
    
    // FALLBACK: Parse from legacy compound keys if clean fields not available
    if (!trainingLocation || !functionalArea) {
      // Try to get from nested structure traversal results
      if (correctTrainingLocation) trainingLocation = correctTrainingLocation;
      if (correctFunctionalArea) functionalArea = correctFunctionalArea;
      
      // Try to get from session metadata
      if (!trainingLocation) trainingLocation = sessionData._location;
      if (!functionalArea) functionalArea = sessionData._functionalArea;
      
      // Last resort: Parse from compound keys
      if ((!trainingLocation || !functionalArea) && sessionData.group_name && sessionData.group_name.includes('|')) {
        const parts = sessionData.group_name.split('|');
        if (!trainingLocation) {
          trainingLocation = parts[0]?.trim() || 'Unknown';
        }
        if (!functionalArea) {
          functionalArea = parts[1]?.trim() || 'General';
        }
      }
    }
    
    // Set defaults if still not found after all fallback attempts
    if (!trainingLocation) trainingLocation = 'Unknown Location';
    if (!functionalArea) functionalArea = 'General';
    
    const assignmentData = {
      courseId,
      courseName,
      groupIdentifier,
      sessionIdentifier,
      trainingLocation: trainingLocation,
      functionalArea: functionalArea
    };
    
    // TARGETED LOG - Location assignment verification with detailed parsing info
    console.log('=== LOCATION ASSIGNMENT CHECK ===');
    console.log('Session Title:', sessionData.title);
    console.log('Session group_name:', sessionData.group_name);
    console.log('Session groupName:', sessionData.groupName);
    console.log('Session _location:', sessionData._location);
    console.log('Session _functionalArea:', sessionData._functionalArea);
    console.log('Extracted trainingLocation:', trainingLocation);
    console.log('Extracted functionalArea:', functionalArea);
    console.log('Final Training Location:', trainingLocation);
    console.log('Status:', trainingLocation?.includes('UK') ? 'CORRECT - UK' : trainingLocation?.includes('Kuwait') ? 'WRONG - Kuwait' : 'UNKNOWN');
    console.log('================================');
    
    
    return { assignmentData, sessionData };
  };

  // Day visibility handlers
  const handleDayToggle = (dayIndex, isVisible) => {
    setVisibleDays(prev => {
      const newVisibleDays = {
        ...prev,
        [dayIndex]: isVisible
      };
      
      // Save to localStorage
      try {
        localStorage.setItem('calendarVisibleDays', JSON.stringify(newVisibleDays));
      } catch (e) {
        console.warn('Failed to save day visibility settings to localStorage');
      }
      
      return newVisibleDays;
    });
  };

  const toggleDayControls = () => {
    setDayControlsCollapsed(prev => !prev);
  };

  // Helper function to organize sessions for auto-assignment
  const organizeSessionsForAutoAssignment = () => {
    const sessions = getAllSessionsFlat();
    const organized = {};
    
    
    sessions.forEach((session, index) => {
      // Use direct training_location field from database (works with any location name)
      const trainingLocation = session.training_location || session.location || 'Unknown';
      
      
      const courseId = session.course_id;
      const courseKey = `${courseId}_${session.course_name || 'Unknown'}`;
      
      // Extract group number from title
      const groupMatch = session.title?.match(/Group (\d+)/);
      const groupNumber = groupMatch ? parseInt(groupMatch[1]) : 1;
      
      // Initialize nested structure
      if (!organized[trainingLocation]) {
        organized[trainingLocation] = {};
      }
      if (!organized[trainingLocation][courseKey]) {
        organized[trainingLocation][courseKey] = {};
      }
      if (!organized[trainingLocation][courseKey][groupNumber]) {
        organized[trainingLocation][courseKey][groupNumber] = [];
      }
      
      organized[trainingLocation][courseKey][groupNumber].push(session);
    });
    
    // Essential logging only
    console.log('🎯 AUTO-ASSIGNMENT: Locations found:', Object.keys(organized));
    Object.keys(organized).forEach(location => {
      const courseCount = Object.keys(organized[location]).length;
      const groupCounts = {};
      Object.keys(organized[location]).forEach(courseKey => {
        const maxGroup = Math.max(...Object.keys(organized[location][courseKey]).map(Number));
        groupCounts[courseKey.split('_')[1]] = maxGroup;
      });
      console.log(`🎯 ${location}: ${courseCount} courses, max groups per course:`, groupCounts);
    });
    
    // DEBUG: Check UK sessions specifically
    if (organized['UK Training Centre']) {
      console.log('🔍 DEBUG: UK Training Centre sessions found');
      console.log('🔍 DEBUG: UK courses:', Object.keys(organized['UK Training Centre']));
      Object.keys(organized['UK Training Centre']).forEach(courseKey => {
        console.log(`🔍 DEBUG: UK ${courseKey} groups:`, Object.keys(organized['UK Training Centre'][courseKey]));
      });
    } else {
      console.log('❌ DEBUG: UK Training Centre sessions NOT found in organized structure');
    }
    
    return organized;
  };

  // Helper function to assign user to complete group (all courses)
  const assignUserToCompleteGroup = async (user, sessionsByLocation, maxAttendees, localCapacityTracker = {}, preloadedCapacityMap = {}, batchCollector = null) => {
    const userLocation = user.training_location;
    
    if (!sessionsByLocation[userLocation]) {
      console.log(`❌ AUTO-ASSIGN: No sessions for location "${userLocation}"`);
      return false;
    }
    
    const locationSessions = sessionsByLocation[userLocation];
    const allCourses = Object.keys(locationSessions);
    
    // Find the lowest group number that has all courses and available capacity
    for (let groupNum = 1; groupNum <= 10; groupNum++) { // Check up to 10 groups
      const groupHasAllCourses = allCourses.every(courseKey => 
        locationSessions[courseKey][groupNum] && locationSessions[courseKey][groupNum].length > 0
      );
      
      if (!groupHasAllCourses) continue;
      
      // Check if this group has capacity using group-level tracking
      // IMPORTANT: Check total users assigned to the entire group across all classrooms
      const groupKey = `${userLocation}-Group${groupNum}`;
      
      // PERF OPTIMIZATION: Use preloaded capacity data instead of individual database queries
      let dbGroupCount = 0;
      if (preloadedCapacityMap[userLocation] && preloadedCapacityMap[userLocation][groupNum]) {
        dbGroupCount = preloadedCapacityMap[userLocation][groupNum];
      } else {
        // Fallback to individual query if preloaded data not available
        const { data: groupAssignments, error } = await supabase
          .from('user_assignments')
          .select('end_user_id')
          .eq('schedule_id', schedule.id)
          .eq('training_location', userLocation)
          .like('group_identifier', `%Group ${groupNum}%`);
        
        if (!error && groupAssignments) {
          const uniqueUsers = new Set(groupAssignments.map(assignment => assignment.end_user_id));
          dbGroupCount = uniqueUsers.size;
        }
      }
      
      // Add locally tracked assignments for this group
      const localGroupCount = localCapacityTracker[groupKey] || 0;
      
      const totalGroupAssigned = dbGroupCount + localGroupCount;
      const hasGroupCapacity = totalGroupAssigned < maxAttendees;
      
      // Minimal capacity logging only for full groups
      if (!hasGroupCapacity) {
        console.log(`⚠️ GROUP CAPACITY FULL: Group ${groupNum} at ${userLocation} (${totalGroupAssigned}/${maxAttendees})`);
      }
      
      if (hasGroupCapacity) {
        // Reduced logging for assignment decisions
        
        // Assign user to ALL courses in this group (complete group assignment)
        let assignmentSuccessful = true;
        let courseCount = 0;
        
        for (const courseKey of allCourses) {
          try {
            const sessions = locationSessions[courseKey][groupNum];
            if (!sessions || sessions.length === 0) continue;
            
            const firstSession = sessions[0];  // Use first session of this course for this group
            
            // Use the session's existing eventId (already location-specific)
            const targetEventId = firstSession.eventId || firstSession.id || 
              `${firstSession.title || 'untitled'}-${new Date(firstSession.start).getTime()}-${new Date(firstSession.end).getTime()}`;
            
            // Reduced logging - only log first course assignment per user
            if (courseCount === 0) {
              console.log(`📝 ${user.name} → Group ${groupNum} (${allCourses.length} courses)`);
            }
            
            // PERF OPTIMIZATION: Collect assignment for batch processing instead of immediate execution
            if (batchCollector) {
              batchCollector.addAssignment(user.id.toString(), targetEventId, user);
              courseCount++;
            } else {
              // Fallback to immediate assignment if no batch collector provided
              await handleUserAssignment(user.id.toString(), targetEventId);
              courseCount++;
            }
            
          } catch (error) {
            console.error(`❌ Failed to assign user ${user.name} to course ${courseKey} in group ${groupNum}:`, error);
            assignmentSuccessful = false;
            break;
          }
        }
        
        if (assignmentSuccessful && courseCount > 0) {
          // Update local capacity tracker for this group (one user added to the group)
          localCapacityTracker[groupKey] = (localCapacityTracker[groupKey] || 0) + 1;
          
          // PERF OPTIMIZATION: Also update preloaded capacity map for subsequent lookups
          if (preloadedCapacityMap[userLocation]) {
            preloadedCapacityMap[userLocation][groupNum] = (preloadedCapacityMap[userLocation][groupNum] || 0) + 1;
          }
          
          return true;
        } else {
          console.error(`❌ Failed to assign ${user.name} to complete group ${groupNum} (assigned to ${courseCount}/${allCourses.length} courses)`);
          return false;
        }
      } else {
        console.log(`⚠️ Group ${groupNum} at ${userLocation}: No capacity (${totalGroupAssigned}/${maxAttendees} assigned)`);
      }
    }
    
    console.log(`❌ AUTO-ASSIGN FAILED: No capacity for ${user.name} at ${userLocation}`);
    return false;
  };

  // Helper function to assign user to specific course
  const assignUserToSpecificCourse = async (user, courseId, sessionsByLocation, maxAttendees) => {
    const userLocation = user.training_location;
    
    if (!sessionsByLocation[userLocation]) {
      console.log(`🎯 No sessions available for user location: ${userLocation}`);
      return false;
    }
    
    const locationSessions = sessionsByLocation[userLocation];
    const courseKey = Object.keys(locationSessions).find(key => key.startsWith(courseId));
    
    if (!courseKey || !locationSessions[courseKey]) {
      console.log(`🎯 No sessions found for course ${courseId} at ${userLocation}`);
      return false;
    }
    
    // Find the lowest group number with available capacity
    const courseSessions = locationSessions[courseKey];
    
    for (let groupNum = 1; groupNum <= 10; groupNum++) {
      if (!courseSessions[groupNum]) continue;
      
      const sessions = courseSessions[groupNum];
      
      // Check each session for available capacity
      let availableSession = null;
      for (const session of sessions) {
        const currentAssigned = await getCurrentAssignedCount(session);
        if (currentAssigned < maxAttendees) {
          availableSession = session;
          break;
        }
      }
      
      if (availableSession) {
        console.log(`🎯 Assigning user ${user.name} to course ${courseId}, group ${groupNum} at ${userLocation}`);
        
        const targetEventId = availableSession.eventId || availableSession.id || 
          `${availableSession.title || 'untitled'}-${new Date(availableSession.start).getTime()}-${new Date(availableSession.end).getTime()}`;
        
        try {
          console.log(`🎯 Attempting assignment: User ${user.name} (${user.id}) to course ${courseId}, targetEventId: ${targetEventId}`);
          await handleUserAssignment(user.id.toString(), targetEventId);
          console.log(`✅ Successfully assigned user ${user.name} to course ${courseId}, group ${groupNum}`);
          return true;
        } catch (error) {
          console.error(`❌ Failed to assign user ${user.name} (${user.id}) to course ${courseId}:`, error);
          debugError(`Failed to assign user ${user.id} to course ${courseId}:`, error);
          return false;
        }
      }
    }
    
    return false; // No available capacity found
  };

  // Helper function to get current assigned count for a session (fetch fresh data)
  const getCurrentAssignedCount = async (session) => {
    // Get both stable and legacy session identifiers for backwards compatibility
    const sessionIds = getSessionIdentifiers(session);
    
    // Use direct training location from database field
    const sessionTrainingLocation = session.training_location || session.location || 'Unknown';
    
    try {
      // Get fresh assignment count from database - FILTER BY TRAINING LOCATION
      // Use .in() to check both stable and legacy session identifiers
      const { data: currentAssignments, error } = await supabase
        .from('user_assignments')
        .select('id')
        .eq('schedule_id', schedule.id)
        .in('session_identifier', sessionIds.all)
        .eq('training_location', sessionTrainingLocation);
      
      if (error) {
        debugError('Error fetching current assignments:', error);
        return 0;
      }
      
      const assignedCount = currentAssignments?.length || 0;
      
      return assignedCount;
    } catch (error) {
      debugError('Error in getCurrentAssignedCount:', error);
      return 0;
    }
  };

  // Simple, reliable assignment approach - no complex batching

  // Preload all assignment data for fast capacity checking
  const preloadAssignmentData = async () => {
    
    try {
      // Single query to get all assignments for this schedule
      const { data: allAssignments, error } = await supabase
        .from('user_assignments')
        .select('end_user_id, training_location, group_identifier')
        .eq('schedule_id', schedule.id);
      
      if (error) {
        console.error('❌ Failed to preload assignment data:', error);
        return {}; // Return empty map, will fall back to individual queries
      }
      
      // Build capacity tracker map: location -> group -> user count
      const capacityTracker = {};
      
      if (allAssignments && allAssignments.length > 0) {
        allAssignments.forEach(assignment => {
          const location = assignment.training_location;
          const groupMatch = assignment.group_identifier?.match(/Group (\d+)/);
          const groupNum = groupMatch ? parseInt(groupMatch[1]) : 1;
          
          if (!capacityTracker[location]) {
            capacityTracker[location] = {};
          }
          if (!capacityTracker[location][groupNum]) {
            capacityTracker[location][groupNum] = new Set();
          }
          
          // Use Set to automatically handle unique users per group
          capacityTracker[location][groupNum].add(assignment.end_user_id);
        });
      }
      
      // Convert Sets to counts for easier usage
      const capacityMap = {};
      Object.keys(capacityTracker).forEach(location => {
        capacityMap[location] = {};
        Object.keys(capacityTracker[location]).forEach(groupNum => {
          capacityMap[location][groupNum] = capacityTracker[location][groupNum].size;
        });
      });
      
      console.log(`✅ PERF: Preloaded ${allAssignments?.length || 0} assignments from ${Object.keys(capacityMap).length} locations`);
      
      return capacityMap;
    } catch (error) {
      console.error('❌ Error preloading assignment data:', error);
      return {}; // Return empty map, will fall back to individual queries
    }
  };

  const performAutoAssignment = async () => {
    console.log('🎯 Starting auto-assignment process...');
    
    const results = {
      successful: [],
      failed: [],
      summary: {
        allCoursesUsers: 0,
        someCoursesUsers: 0,
        totalProcessed: 0
      }
    };
    
    try {
      // Simple approach: Get fresh user categories 
      const freshAssignments = await fetchAssignments();
      await categorizeUsers(freshAssignments);
      
      // Get max attendees from criteria
      const getMaxAttendeesFromCriteria = () => {
        try {
          if (schedule?.criteria) {
            const criteria = typeof schedule.criteria === 'string' ? 
              JSON.parse(schedule.criteria) : schedule.criteria;
            const actualCriteria = criteria?.default || criteria;
            return actualCriteria?.max_attendees || 25;
          }
        } catch (err) {
          debugError('Error parsing criteria:', err);
        }
        return 25; // Default fallback
      };
      
      const maxAttendees = getMaxAttendeesFromCriteria();
      console.log('🎯 Using max attendees from criteria:', maxAttendees);
      
      // Get all sessions organized by training location, course, and group
      const sessionsByLocation = organizeSessionsForAutoAssignment();
      
      // Priority 1: Assign "All Courses Needed" users to complete groups
      console.log('🎯 AUTO-ASSIGN: Starting Phase 1 (All Courses Users)');
      const allCoursesUsers = userCategories.allCoursesNeeded || [];
      
      console.log(`🎯 Assigning ${allCoursesUsers.length} users to complete groups...`);
      
      // Simple sequential assignment with capacity checking
      const locationGroupCounts = {}; // Track users per location/group
      
      for (const user of allCoursesUsers) {
        try {
          console.log(`🎯 Assigning ${user.name} to available group...`);
          
          const userLocation = user.training_location;
          if (!sessionsByLocation[userLocation]) {
            console.log(`❌ No sessions for location: ${userLocation}`);
            results.failed.push({ userId: user.id, error: `No sessions for location ${userLocation}` });
            continue;
          }
          
          // Initialize location tracking if not exists
          if (!locationGroupCounts[userLocation]) {
            locationGroupCounts[userLocation] = {};
          }
          
          // Find available group with capacity
          const locationSessions = sessionsByLocation[userLocation];
          const firstCourseKey = Object.keys(locationSessions)[0];
          let assignedGroup = null;
          
          // Check groups 1-10 for available capacity
          for (let groupNum = 1; groupNum <= 10; groupNum++) {
            const currentCount = locationGroupCounts[userLocation][groupNum] || 0;
            
            if (currentCount < maxAttendees) {
              // Check if this group exists
              const groupSessions = locationSessions[firstCourseKey]?.[groupNum];
              if (groupSessions && groupSessions.length > 0) {
                assignedGroup = groupNum;
                break;
              }
            }
          }
          
          if (assignedGroup) {
            const targetSession = locationSessions[firstCourseKey][assignedGroup][0];
            const targetEventId = targetSession.eventId || targetSession.id;
            
            console.log(`✅ Assigning ${user.name} to Group ${assignedGroup} (${locationGroupCounts[userLocation][assignedGroup] || 0}/${maxAttendees})`);
            await handleUserAssignment(user.id.toString(), targetEventId);
            
            // Update group count
            locationGroupCounts[userLocation][assignedGroup] = (locationGroupCounts[userLocation][assignedGroup] || 0) + 1;
            
            results.successful.push(user.id);
            results.summary.allCoursesUsers++;
          } else {
            console.log(`❌ No available group capacity for ${user.name} at ${userLocation}`);
            results.failed.push({ userId: user.id, error: 'No available group capacity' });
          }
        } catch (error) {
          console.error(`❌ Failed to assign ${user.name}:`, error);
          results.failed.push({ userId: user.id, error: error.message });
        }
      }
      
      // Priority 2: Assign "Some Courses Needed" users to specific courses
      const someCoursesUsers = userCategories.someCoursesNeeded || {};
      
      // Priority 3: Assign "Unassigned" users (users who don't need any courses but can be assigned)
      console.log('🎯 AUTO-ASSIGN: Starting Phase 3 (Unassigned Users)');
      const unassignedUsers = userCategories.unassigned || [];
      
      console.log(`🎯 Category breakdown:`);
      console.log(`  - All courses: ${allCoursesUsers.length}`);
      console.log(`  - Some courses: ${Object.values(someCoursesUsers).flat().length}`);
      console.log(`  - Unassigned: ${unassignedUsers.length}`);
      
      // Check if UK users are in unassigned category
      const ukUnassignedUsers = unassignedUsers.filter(user => user.training_location === 'UK Training Centre');
      if (ukUnassignedUsers.length > 0) {
        console.log(`🎯 UK users in unassigned category: ${ukUnassignedUsers.length}`);
        ukUnassignedUsers.forEach(user => {
          console.log(`  - ${user.name} (${user.training_location})`);
        });
      }
      
      // Simple assignment for "Some Courses" users
      console.log('🎯 AUTO-ASSIGN: Starting Phase 2 (Some Courses Users)');
      for (const [courseId, users] of Object.entries(someCoursesUsers)) {
        for (const user of users) {
          try {
            console.log(`🎯 Assigning ${user.name} to specific course ${courseId}...`);
            const assigned = await assignUserToSpecificCourse(user, courseId, sessionsByLocation, maxAttendees);
            if (assigned) {
              results.successful.push(user.id);
              results.summary.someCoursesUsers++;
            } else {
              results.failed.push({ userId: user.id, error: `No available capacity for course ${courseId}` });
            }
          } catch (error) {
            console.error(`❌ Failed to assign ${user.name} to course ${courseId}:`, error);
            results.failed.push({ userId: user.id, error: error.message });
          }
        }
      }
      
      // Priority 3: Handle unassigned users by treating them like "all courses needed"
      for (const user of unassignedUsers) {
        try {
          const assigned = await assignUserToCompleteGroup(user, sessionsByLocation, maxAttendees);
          if (assigned) {
            results.successful.push(user.id);
            results.summary.allCoursesUsers++; // Count as all-courses assignment
          } else {
            results.failed.push({ userId: user.id, error: 'No available capacity in complete groups (unassigned user)' });
          }
        } catch (error) {
          debugError(`Failed to assign unassigned user ${user.id}:`, error);
          results.failed.push({ userId: user.id, error: error.message });
        }
      }
      
      results.summary.totalProcessed = results.successful.length + results.failed.length;
      
      console.log('🎯 Auto-assignment completed:', results.summary);
      return results;
      
    } catch (error) {
      debugError('❌ Auto-assignment process failed:', error);
      throw error;
    }
  };

  // Convert visibleDays to hiddenDays array for FullCalendar
  const hiddenDays = Object.entries(visibleDays)
    .filter(([day, visible]) => !visible)
    .map(([day]) => parseInt(day));

  const handleAutoAssign = async () => {
    try {
      setLoading(true);
      
      const results = await performAutoAssignment();
      
      // Show results to user
      const successCount = results.successful.length;
      const failedCount = results.failed.length;
      const message = `Auto-assignment completed: ${successCount} users assigned successfully` + 
                     (failedCount > 0 ? `, ${failedCount} failed` : '');
      
      alert(message);
      
      // Refresh data
      await initializeAssignmentData();
      
    } catch (err) {
      debugError('❌ Error in auto-assignment:', err);
      setError(`Auto-assignment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && Object.keys(userCategories).length === 0) {
    return (
      <div className="drag-drop-assignment-panel loading">
        <div className="loading-message">
          🔄 Loading assignment interface...
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="drag-drop-assignment-panel">
        {/* Header with controls */}
        <div className="assignment-panel-header">
          <div className="header-title">
            <h2>🎯 Drag & Drop Assignment</h2>
            <span className="schedule-name">{schedule?.name}</span>
          </div>
          
          <div className="header-controls">
            <button 
              onClick={handleAutoAssign} 
              disabled={loading}
              className="auto-assign-btn"
            >
              {loading ? '🔄 Processing...' : '🎯 Auto Assign All'}
            </button>
            
            <button 
              onClick={handleRemoveAllAssignments}
              disabled={loading}
              className="remove-all-btn"
              title="Remove all user assignments from this schedule"
            >
              🗑️ Remove All Assignments
            </button>
            
            <button 
              onClick={handleExportAssignments}
              disabled={loading || !schedule?.id}
              className="export-assignments-btn"
              title="Export user assignment data to CSV for stakeholder review"
            >
              📄 Export Assignments
            </button>
            
            <button 
              onClick={() => setShowImportModal(true)}
              disabled={loading || !schedule?.id}
              className="import-assignments-btn"
              title="Import assignment changes from stakeholder review CSV"
            >
              📥 Import Changes
            </button>
            
            <button 
              onClick={() => setShowStatsModal(true)}
              className="assignment-stats-btn"
            >
              📊 Assignment Stats
            </button>
            
            <button onClick={onClose} className="close-btn">
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <div className="assignment-panel-content">
          {/* Left: User Pool */}
          <div className="user-pool-section">

            <CalendarDayControls
              visibleDays={visibleDays}
              onDayToggle={handleDayToggle}
              collapsed={dayControlsCollapsed}
              onToggle={toggleDayControls}
            />
            
            <UserPool
              userCategories={userCategories}
              selectedTrainingLocation={selectedTrainingLocation}
              selectedFunctionalArea={selectedFunctionalArea}
              onLocationChange={setSelectedTrainingLocation}
              onFunctionalAreaChange={setSelectedFunctionalArea}
              availableFunctionalAreas={getUniqueFunctionalAreas()}
              dragMode={dragMode}
            />
          </div>

          {/* Right: Enhanced Calendar */}
          <div className="calendar-section">
            <EnhancedScheduleCalendar
              sessions={flattenedSessions}
              onSessionUpdated={() => {}} // Would connect to existing handler
              criteria={schedule?.criteria}
              dragMode={dragMode}
              capacityData={capacityData}
              assignments={assignments}
              currentSchedule={currentSchedule}
              onScheduleChange={onScheduleChange}
              onAssignmentUpdate={onAssignmentUpdate}
              hiddenDays={hiddenDays}
              onUserContextMenu={(userInfo, sessionInfo, x, y) => {
                setContextMenu({
                  visible: true,
                  x,
                  y,
                  userInfo,
                  sessionInfo
                });
              }}
              onRemoveFromGroup={removeUserFromGroup}
              onRemoveFromCourse={removeUserFromCourse}
            />
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeUser ? (
            <div className="drag-preview">
              👤 {activeUser.name}
            </div>
          ) : null}
        </DragOverlay>

        {/* Context Menu */}
        <UserContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          userInfo={contextMenu.userInfo}
          sessionInfo={contextMenu.sessionInfo}
          onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
          onRemoveFromGroup={removeUserFromGroup}
          onRemoveFromCourse={removeUserFromCourse}
        />
        
        {/* Assignment Stats Modal */}
        <AssignmentStatsModal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          schedule={schedule}
          selectedTrainingLocation={selectedTrainingLocation}
        />
        
        {/* Import Assignments Modal */}
        {showImportModal && (
          <div className="import-modal-overlay">
            <div className="import-modal">
              <div className="modal-header">
                <h3>📥 Import Assignment Changes</h3>
                <button onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview(null);
                }} className="close-btn">✕</button>
              </div>
              
              <div className="modal-content">
                <div className="import-instructions">
                  <p><strong>Instructions:</strong></p>
                  <ol>
                    <li>Export assignments using the "Export Assignments" button</li>
                    <li>Share the CSV file with stakeholders for review</li>
                    <li>Ask stakeholders to fill in the "Proposed Group Change" and "Change Reason" columns</li>
                    <li>Upload the modified CSV file here to import changes</li>
                  </ol>
                </div>
                
                {!importFile && (
                  <div className="file-upload-section">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            setImportFile(file);
                            const csvData = await parseCSVFile(file);
                            setImportPreview(csvData);
                          } catch (error) {
                            setError(`Failed to parse CSV file: ${error.message}`);
                          }
                        }
                      }}
                      className="file-input"
                    />
                    <p className="file-help">Select a CSV file with stakeholder changes</p>
                  </div>
                )}
                
                {importPreview && (
                  <div className="import-preview-section">
                    <h4>Preview of Changes</h4>
                    <div className="preview-table">
                      <div className="preview-header">
                        <span>User</span>
                        <span>Current Group</span>
                        <span>Proposed Group</span>
                        <span>Reason</span>
                      </div>
                      {importPreview
                        .filter(row => row['Proposed Group Change'])
                        .slice(0, 5)
                        .map((row, index) => (
                        <div key={index} className="preview-row">
                          <span>{row['User Name']}</span>
                          <span>{row['Current Group']}</span>
                          <span>{row['Proposed Group Change']}</span>
                          <span>{row['Change Reason'] || 'No reason provided'}</span>
                        </div>
                      ))}
                      {importPreview.filter(row => row['Proposed Group Change']).length > 5 && (
                        <div className="preview-more">
                          ... and {importPreview.filter(row => row['Proposed Group Change']).length - 5} more changes
                        </div>
                      )}
                    </div>
                    
                    <div className="import-actions">
                      <button 
                        onClick={() => {
                          setImportFile(null);
                          setImportPreview(null);
                        }}
                        className="cancel-import-btn"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const results = await handleImportAssignments(importPreview);
                            alert(`Import completed:\n${results.successful} successful changes\n${results.failed} failed changes`);
                            if (results.errors.length > 0) {
                              console.log('Import errors:', results.errors);
                            }
                            setShowImportModal(false);
                            setImportFile(null);
                            setImportPreview(null);
                          } catch (error) {
                            setError(`Import failed: ${error.message}`);
                          }
                        }}
                        className="apply-import-btn"
                        disabled={loading}
                      >
                        {loading ? 'Importing...' : 'Apply Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
};

export default DragDropAssignmentPanel;