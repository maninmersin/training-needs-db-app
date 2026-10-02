import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { debugLog, debugWarn, debugError } from '@core/utils/consoleUtils';
import './AssignmentWorkspace.css';

const AssignmentWorkspace = ({ 
  schedule, 
  assignmentLevel, 
  assignments, 
  onCreateAssignment, 
  onRemoveAssignment, 
  onBack 
}) => {
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // Location and functional area filters
  const [selectedTrainingLocation, setSelectedTrainingLocation] = useState('');
  const [selectedFunctionalArea, setSelectedFunctionalArea] = useState('');

  // Helper function to get all sessions as a flat array regardless of structure
  const getAllSessionsFlat = () => {
    if (!schedule.sessions) return [];
    
    // Check if sessions are organized as sessions[location][functionalArea] structure
    if (typeof schedule.sessions === 'object' && !Array.isArray(schedule.sessions)) {
      const allSessions = [];
      Object.entries(schedule.sessions).forEach(([location, locationData]) => {
        Object.entries(locationData).forEach(([functionalArea, sessionList]) => {
          if (Array.isArray(sessionList)) {
            sessionList.forEach(session => {
              allSessions.push({
                ...session,
                _location: location, // Add location context
                _functionalArea: functionalArea // Add functional area context
              });
            });
          }
        });
      });
      return allSessions;
    }
    
    // Already a flat array
    return schedule.sessions;
  };

  // Get unique training locations from schedule
  const getUniqueTrainingLocations = () => {
    debugLog('🔍 Debug: Schedule object:', schedule);
    debugLog('🔍 Debug: Schedule.criteria:', schedule.criteria);
    debugLog('🔍 Debug: Selected training locations:', schedule.criteria?.selected_training_locations);
    
    // Check for selected training locations in criteria (nested under default)
    if (schedule.criteria && schedule.criteria.default && schedule.criteria.default.selected_training_locations && Array.isArray(schedule.criteria.default.selected_training_locations)) {
      debugLog('🔍 Debug: Found training locations in criteria.default:', schedule.criteria.default.selected_training_locations);
      return schedule.criteria.default.selected_training_locations;
    }
    
    // Direct criteria format (fallback)
    if (schedule.criteria && schedule.criteria.selected_training_locations && Array.isArray(schedule.criteria.selected_training_locations)) {
      debugLog('🔍 Debug: Found training locations in criteria:', schedule.criteria.selected_training_locations);
      return schedule.criteria.selected_training_locations;
    }
    
    // Old criteria format
    if (schedule.criteria && schedule.criteria.training_locations && Array.isArray(schedule.criteria.training_locations)) {
      debugLog('🔍 Debug: Found old format training locations:', schedule.criteria.training_locations);
      return schedule.criteria.training_locations;
    }
    
    // Check if there's a nested sessions structure
    if (schedule.sessions && typeof schedule.sessions === 'object' && !Array.isArray(schedule.sessions)) {
      const locations = Object.keys(schedule.sessions);
      debugLog('🔍 Debug: Found nested structure locations:', locations);
      return locations;
    }
    
    // Final fallback
    debugLog('🔍 Debug: Using fallback TBD');
    return ['TBD'];
  };

  // Get unique functional areas from schedule  
  const getUniqueFunctionalAreas = () => {
    // Check for selected functional areas in criteria (nested under default)
    if (schedule.criteria && schedule.criteria.default && schedule.criteria.default.selected_functional_areas && Array.isArray(schedule.criteria.default.selected_functional_areas)) {
      debugLog('🔍 Debug: Found functional areas in criteria.default:', schedule.criteria.default.selected_functional_areas);
      return schedule.criteria.default.selected_functional_areas;
    }
    
    // Direct criteria format (fallback)
    if (schedule.criteria && schedule.criteria.selected_functional_areas && Array.isArray(schedule.criteria.selected_functional_areas)) {
      debugLog('🔍 Debug: Found functional areas in criteria:', schedule.criteria.selected_functional_areas);
      return schedule.criteria.selected_functional_areas;
    }
    
    // Old criteria format
    if (schedule.criteria && schedule.criteria.functional_areas && Array.isArray(schedule.criteria.functional_areas)) {
      return schedule.criteria.functional_areas;
    }
    
    // Check if sessions are organized as sessions[location][functionalArea] structure
    if (schedule.sessions && typeof schedule.sessions === 'object' && !Array.isArray(schedule.sessions)) {
      const functionalAreas = new Set();
      Object.values(schedule.sessions).forEach(locationData => {
        if (typeof locationData === 'object') {
          Object.keys(locationData).forEach(fa => functionalAreas.add(fa));
        }
      });
      return Array.from(functionalAreas);
    }
    
    // Final fallback
    return ['General'];
  };

  // Get unique courses from schedule
  const getUniqueCourses = () => {
    const sessions = getAllSessionsFlat();
    const courseMap = new Map();
    
    sessions.forEach(session => {
      // Try different possible field names for course data
      const courseId = session.course_id || session.courseId || session.extendedProps?.course_id || session.extendedProps?.courseId || session.course_name;
      const courseName = session.course_name || session.courseName || session.extendedProps?.course_name || session.extendedProps?.courseName;
      const functionalArea = session.functional_area || session.functionalArea || session.extendedProps?.functional_area || session.extendedProps?.functionalArea || session._functionalArea;
      
      if (courseId && !courseMap.has(courseId)) {
        courseMap.set(courseId, {
          course_id: courseId,
          course_name: courseName || courseId,
          functional_area: functionalArea || 'Unknown'
        });
      }
    });
    
    return Array.from(courseMap.values());
  };

  // Get sessions for selected course
  const getCourseSessions = (courseId) => {
    const sessions = getAllSessionsFlat();
    return sessions.filter(session => session.course_id === courseId);
  };

  // Get max participants for a group (from its sessions)
  const getGroupMaxParticipants = (group) => {
    if (!group || !group.sessions || group.sessions.length === 0) return null;
    
    // Get max participants from sessions (try different possible field names)
    const maxValues = group.sessions.map(session => {
      const maxParticipants = session.max_participants || 
                              session.maxParticipants || 
                              session.extendedProps?.max_participants || 
                              session.extendedProps?.maxParticipants ||
                              session.extendedProps?.maxParticipant ||
                              session.max_participant;
      return maxParticipants ? parseInt(maxParticipants) : null;
    }).filter(val => val !== null);
    
    if (maxValues.length === 0) return null;
    
    // Use the minimum max participants across all sessions in the group
    // (most restrictive session determines the group limit)
    return Math.min(...maxValues);
  };

  // Count current assignments for a group
  const getGroupAssignmentCount = (group) => {
    if (!group) return 0;
    
    return assignments.filter(assignment => {
      // Check if this assignment is for the current group
      const isGroupMatch = assignment.assignment_level === 'group' && 
                          assignment.group_identifier === group.group_identifier;
      
      // Also check location/functional area context
      const isLocationMatch = !selectedTrainingLocation || assignment.training_location === selectedTrainingLocation;
      const isFunctionalAreaMatch = !selectedFunctionalArea || assignment.functional_area === selectedFunctionalArea;
      
      return isGroupMatch && isLocationMatch && isFunctionalAreaMatch;
    }).length;
  };

  // Check if group is over capacity
  const isGroupOverCapacity = (group) => {
    const maxParticipants = getGroupMaxParticipants(group);
    const currentCount = getGroupAssignmentCount(group);
    
    if (maxParticipants === null) return false; // No limit defined
    return currentCount > maxParticipants;
  };

  // Get capacity warning message
  const getCapacityWarning = (group) => {
    const maxParticipants = getGroupMaxParticipants(group);
    const currentCount = getGroupAssignmentCount(group);
    
    if (maxParticipants === null) return null;
    
    if (currentCount > maxParticipants) {
      return `⚠️ Over capacity: ${currentCount}/${maxParticipants} participants (${currentCount - maxParticipants} over limit)`;
    } else if (currentCount === maxParticipants) {
      return `⚠️ At capacity: ${currentCount}/${maxParticipants} participants`;
    } else {
      return `✅ ${currentCount}/${maxParticipants} participants`;
    }
  };

  // Get all unique groups from the schedule (groups can contain multiple courses)
  const getAllGroups = () => {
    const sessions = getAllSessionsFlat();
    const groupMap = new Map();
    
    sessions.forEach(session => {
      // Extract location and functional area from title if needed
      let sessionLocation = session.location || session.extendedProps?.location || session._location;
      let sessionFunctionalArea = session.functional_area || session.functionalArea || session.extendedProps?.functional_area || session.extendedProps?.functionalArea || session._functionalArea;
      
      // Parse from title if location/functional area not set or is generic
      if (session.title && session.title.includes('|')) {
        const parts = session.title.split('|');
        if (parts.length === 2) {
          if (!sessionLocation || sessionLocation === 'TBD') {
            sessionLocation = parts[0].trim();
          }
          if (!sessionFunctionalArea || sessionFunctionalArea === 'General') {
            sessionFunctionalArea = parts[1].trim();
          }
        }
      }
      
      // Skip location filtering for now since individual sessions don't have proper location info
      // We'll rely on the user's filter selection and assignment scoping instead
      // if (selectedTrainingLocation && sessionLocation !== selectedTrainingLocation) return;
      // if (selectedFunctionalArea && sessionFunctionalArea !== selectedFunctionalArea) return;
      
      if (session.title && session.title.includes('Group')) {
        const groupMatch = session.title.match(/Group (\d+)/);
        if (groupMatch) {
          const groupNumber = groupMatch[1];
          // Use selected filters for group scoping (since individual sessions don't have proper location info)
          const effectiveLocation = selectedTrainingLocation || sessionLocation || 'Unknown';
          const effectiveFunctionalArea = selectedFunctionalArea || sessionFunctionalArea || 'General';
          
          const groupKey = `${effectiveLocation}-${effectiveFunctionalArea}-Group${groupNumber}`;
          const displayName = `Group ${groupNumber}`;
          
          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              group_identifier: groupKey,
              display_name: displayName,
              training_location: effectiveLocation,
              functional_area: effectiveFunctionalArea,
              courses: new Set(),
              sessions: []
            });
          }
          const group = groupMap.get(groupKey);
          // Try different possible field names for course data
          const courseId = session.course_id || session.courseId || session.extendedProps?.course_id || session.extendedProps?.courseId || session.course_name;
          const courseName = session.course_name || session.courseName || session.extendedProps?.course_name || session.extendedProps?.courseName || session.title?.split(' - ')[0];
          
          if (courseId && courseName) {
            group.courses.add(`${courseId}: ${courseName}`);
          } else if (courseId) {
            group.courses.add(courseId);
          }
          group.sessions.push(session);
        }
      }
    });
    
    // Convert courses Set to Array for display
    const result = Array.from(groupMap.values()).map(group => ({
      ...group,
      courses: Array.from(group.courses),
      uniqueCourses: new Set(group.sessions.map(s => 
        s.course_id || s.courseId || s.extendedProps?.course_id || s.extendedProps?.courseId || s.course_name
      ).filter(id => id)).size
    }));
    
    debugLog('📦 All groups found:', result.length);
    debugLog('📦 Groups details:', result.map(g => ({
      identifier: g.group_identifier,
      location: g.training_location,
      functionalArea: g.functional_area,
      sessionCount: g.sessions.length
    })));
    debugLog('🎯 Current filters:', { selectedTrainingLocation, selectedFunctionalArea });
    
    return result;
  };

  // Generate session identifier
  const generateSessionId = (session) => {
    // CRITICAL FIX: Use the actual session_identifier from the session data if available
    // This field is stable across time changes (drag/drop operations)
    // Fallback to timestamp-based ID only for compatibility with old data
    if (session.session_identifier) {
      return session.session_identifier;
    }
    // Legacy fallback (for sessions created before session_identifier field was added)
    return `${session.course_id}-${session.session_number}-${new Date(session.start).getTime()}`;
  };

  // Fetch eligible users based on assignment level and selections
  const fetchEligibleUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      debugLog('🔍 Fetching users for level:', assignmentLevel);
      debugLog('🔍 Current selectedGroup:', selectedGroup?.group_identifier);
      debugLog('🔍 Condition check:', {
        'assignmentLevel === group': assignmentLevel === 'group',
        'selectedGroup exists': !!selectedGroup,
        'both conditions': assignmentLevel === 'group' && selectedGroup
      });
      debugLog('📋 Schedule criteria:', schedule.criteria);
      debugLog('📋 Full schedule object:', schedule);

      if (assignmentLevel === 'training_location') {
        // Use selected filters if available, otherwise use all locations from schedule criteria
        const criteriaData = schedule.criteria?.default || schedule.criteria || {};
        let locations = criteriaData.selected_training_locations || criteriaData.trainingLocations || [];
        
        // If user has selected specific training location, filter to that
        if (selectedTrainingLocation) {
          locations = [selectedTrainingLocation];
        }
        
        debugLog('📍 Training locations to query:', locations);
        debugLog('🎯 Selected training location filter:', selectedTrainingLocation);
        
        if (locations.length === 0) {
          debugWarn('⚠️ No training locations found');
          setEligibleUsers([]);
          return;
        }

        // MS Access flat table approach: Query training_data directly
        // Get project_id from schedule
        const projectId = schedule.project_id || schedule.criteria?.project_id;
        debugLog('📋 Schedule object:', schedule);
        debugLog('🆔 Project ID from schedule:', projectId);

        let query = supabase
          .from('training_data')
          .select('user_id, user_name, user_email, user_project_role, training_location, functional_area')
          .in('training_location', locations);

        // Filter by project if available
        if (projectId) {
          debugLog('✅ Filtering by project_id:', projectId);
          query = query.eq('project_id', projectId);
        } else {
          debugWarn('⚠️ No project_id found in schedule - not filtering by project!')
;
        }

        // If functional area is selected, filter by it
        if (selectedFunctionalArea) {
          debugLog('🔍 Filtering by functional area:', selectedFunctionalArea);
          query = query.eq('functional_area', selectedFunctionalArea);
        }

        const { data: trainingData, error } = await query;
        if (error) throw error;

        // Transform training_data to match end_users format (group by unique user)
        const userMap = new Map();
        trainingData.forEach(row => {
          if (!userMap.has(row.user_id)) {
            userMap.set(row.user_id, {
              id: row.user_id,
              name: row.user_name,
              email: row.user_email,
              project_role: row.user_project_role,
              training_location: row.training_location
            });
          }
        });

        const users = Array.from(userMap.values());
        debugLog('👥 Found unique users from training_data:', users.length);
        setEligibleUsers(users);
      } 
      else if (assignmentLevel === 'course' && selectedCourse) {
        // Show users eligible for this specific course via training_data
        debugLog('📚 Selected course:', selectedCourse);

        // MS Access flat table approach: Get users assigned to this course
        const projectId = schedule.project_id || schedule.criteria?.project_id;

        let courseQuery = supabase
          .from('training_data')
          .select('user_id, user_name, user_email, user_project_role, training_location')
          .eq('course_id', selectedCourse.course_id);

        if (projectId) {
          courseQuery = courseQuery.eq('project_id', projectId);
        }

        const { data: trainingData, error: mappingsError } = await courseQuery;

        if (mappingsError) throw mappingsError;

        debugLog('👥 Training data for course:', trainingData);
        const eligibleUserIds = trainingData.map(m => m.user_id);
        const criteriaData = schedule.criteria?.default || schedule.criteria || {};
        let locations = criteriaData.selected_training_locations || criteriaData.trainingLocations || [];
        
        // If user has selected specific training location, filter to that
        if (selectedTrainingLocation) {
          locations = [selectedTrainingLocation];
        }
        
        debugLog('👥 Training data records:', trainingData.length);
        debugLog('📍 Training locations to filter:', locations);
        debugLog('🎯 Selected filters:', { selectedTrainingLocation, selectedFunctionalArea });

        if (trainingData.length === 0) {
          debugWarn('⚠️ No users found in training_data for course:', selectedCourse.course_id);
          debugLog('💡 To fix: Check that CSV data was imported correctly');
          setEligibleUsers([]);
          return;
        }

        if (locations.length === 0) {
          debugWarn('⚠️ No training locations found in schedule criteria');
          setEligibleUsers([]);
          return;
        }

        // Transform training_data to user format and filter by location
        const userMap = new Map();
        trainingData
          .filter(row => locations.includes(row.training_location))
          .forEach(row => {
            if (!userMap.has(row.user_id)) {
              userMap.set(row.user_id, {
                id: row.user_id,
                name: row.user_name,
                email: row.user_email,
                project_role: row.user_project_role,
                training_location: row.training_location
              });
            }
          });

        const users = Array.from(userMap.values());
        debugLog('👥 Found users for course (with filters):', users.length);
        setEligibleUsers(users || []);
      }
      else if (assignmentLevel === 'group' && selectedGroup) {
        // Show users eligible for any course in this group via role mappings
        debugLog('🚀 fetchEligibleUsers: GROUP level processing starting');
        debugLog('👥 Selected group:', selectedGroup.group_identifier);
        debugLog('🔍 Sample sessions in group:', selectedGroup.sessions.slice(0, 2));
        debugLog('🔍 First session keys:', Object.keys(selectedGroup.sessions[0] || {}));
        debugLog('🔍 First session extendedProps:', selectedGroup.sessions[0]?.extendedProps);
        debugLog('🔍 Checking for max participants:', {
          max_participants: selectedGroup.sessions[0]?.max_participants,
          maxParticipants: selectedGroup.sessions[0]?.maxParticipants,
          extendedProps_max: selectedGroup.sessions[0]?.extendedProps?.max_participants,
          extendedProps_maxParticipants: selectedGroup.sessions[0]?.extendedProps?.maxParticipants
        });
        
        // Extract course identifiers from sessions (prioritize course_id)
        const uniqueCourseIds = [...new Set(selectedGroup.sessions.map(s => {
          // Prioritize course_id, then courseId, then fall back to course_name only if needed
          const courseId = s.course_id || s.courseId || s.extendedProps?.course_id || s.extendedProps?.courseId;
          debugLog('🔍 Session course identifier:', {
            course_name: s.course_name,
            course_id: s.course_id,
            final: courseId
          });
          return courseId;
        }).filter(id => id))];
        debugLog('📚 Course identifiers in group:', uniqueCourseIds);
        
        if (uniqueCourseIds.length === 0) {
          debugWarn('⚠️ No course IDs found in group');
          setEligibleUsers([]);
          return;
        }

        // MS Access flat table approach: Get users assigned to these courses
        const projectId = schedule.project_id || schedule.criteria?.project_id;

        let groupQuery = supabase
          .from('training_data')
          .select('user_id, user_name, user_email, user_project_role, training_location')
          .in('course_id', uniqueCourseIds);

        if (projectId) {
          groupQuery = groupQuery.eq('project_id', projectId);
        }

        const { data: trainingData, error: mappingsError } = await groupQuery;

        if (mappingsError) throw mappingsError;

        debugLog('👥 Training data for group courses:', trainingData);
        const eligibleUserIds = [...new Set(trainingData.map(m => m.user_id))];
        const criteriaData = schedule.criteria?.default || schedule.criteria || {};
        let locations = criteriaData.selected_training_locations || criteriaData.trainingLocations || [];

        // If user has selected specific training location, filter to that
        if (selectedTrainingLocation) {
          locations = [selectedTrainingLocation];
        }

        debugLog('👥 Eligible user IDs for group:', eligibleUserIds);
        debugLog('📍 Training locations to query:', locations);
        debugLog('🎯 Selected filters:', { selectedTrainingLocation, selectedFunctionalArea });

        if (eligibleUserIds.length === 0) {
          debugWarn('⚠️ No users found in training_data for group courses:', uniqueCourseIds);
          debugLog('💡 To fix: Check that CSV data was imported correctly');
          setEligibleUsers([]);
          return;
        }

        if (locations.length === 0) {
          debugWarn('⚠️ No training locations found in schedule criteria');
          setEligibleUsers([]);
          return;
        }

        // Transform training_data to user format and filter by location
        const userMap = new Map();
        trainingData
          .filter(row => locations.includes(row.training_location))
          .forEach(row => {
            if (!userMap.has(row.user_id)) {
              userMap.set(row.user_id, {
                id: row.user_id,
                name: row.user_name,
                email: row.user_email,
                project_role: row.user_project_role,
                training_location: row.training_location
              });
            }
          });

        const users = Array.from(userMap.values());
        debugLog('👥 Found users for group (with filters):', users.length);
        setEligibleUsers(users);
      }
      else if (assignmentLevel === 'session' && selectedSession) {
        // Show users eligible for this session's course via training_data
        const projectId = schedule.project_id || schedule.criteria?.project_id;

        let sessionQuery = supabase
          .from('training_data')
          .select('user_id, user_name, user_email, user_project_role, training_location')
          .eq('course_id', selectedSession.course_id);

        if (projectId) {
          sessionQuery = sessionQuery.eq('project_id', projectId);
        }

        const { data: trainingData, error: mappingsError } = await sessionQuery;

        if (mappingsError) throw mappingsError;

        const locations = schedule.criteria?.selected_training_locations || [];

        if (trainingData.length === 0 || locations.length === 0) {
          setEligibleUsers([]);
          return;
        }

        // Transform training_data to user format and filter by location
        const userMap = new Map();
        trainingData
          .filter(row => locations.includes(row.training_location))
          .forEach(row => {
            if (!userMap.has(row.user_id)) {
              userMap.set(row.user_id, {
                id: row.user_id,
                name: row.user_name,
                email: row.user_email,
                project_role: row.user_project_role,
                training_location: row.training_location
              });
            }
          });

        const users = Array.from(userMap.values());
        setEligibleUsers(users);
      }
      else {
        setEligibleUsers([]);
      }

    } catch (err) {
      debugError('❌ Error fetching eligible users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is already assigned
  const isUserAssigned = (userId) => {
    // Debug logging for assignment checking (disabled)
    // const userAssignments = assignments.filter(a => a.end_user_id === userId);
    
    return assignments.some(assignment => {
      if (assignment.end_user_id !== userId) return false;
      
      // Check location and functional area context for all assignment levels
      if (selectedTrainingLocation && assignment.training_location !== selectedTrainingLocation) {
        return false;
      }
      if (selectedFunctionalArea && assignment.functional_area !== selectedFunctionalArea) {
        return false;
      }
      
      if (assignmentLevel === 'training_location') {
        return assignment.assignment_level === 'training_location';
      } else if (assignmentLevel === 'course' && selectedCourse) {
        return assignment.assignment_level === 'course' && assignment.course_id === selectedCourse.course_id;
      } else if (assignmentLevel === 'group' && selectedGroup) {
        // CRITICAL FIX: Use the same location-scoped group identifier logic as in assignment creation
        const effectiveLocation = selectedTrainingLocation || selectedGroup.training_location;
        const effectiveFunctionalArea = selectedFunctionalArea || selectedGroup.functional_area;
        const groupNumberMatch = selectedGroup.display_name.match(/Group (\d+)/);
        const groupNumber = groupNumberMatch ? groupNumberMatch[1] : '1';
        const locationScopedGroupIdentifier = `${effectiveLocation}-${effectiveFunctionalArea}-Group${groupNumber}`;
        
        return assignment.assignment_level === 'group' && 
               assignment.group_identifier === locationScopedGroupIdentifier;
      } else if (assignmentLevel === 'session' && selectedSession) {
        const sessionId = generateSessionId(selectedSession);
        return assignment.assignment_level === 'session' && assignment.session_identifier === sessionId;
      }
      
      return false;
    });
  };

  // Handle user selection
  const handleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle bulk assignment
  const handleBulkAssign = async () => {
    debugLog('🚀🚀🚀 ASSIGN BUTTON CLICKED! Starting bulk assignment:', {
      selectedUsersCount: selectedUsers.length,
      assignmentLevel,
      selectedGroup: selectedGroup ? selectedGroup.group_identifier : null,
      selectedTrainingLocation,
      selectedFunctionalArea,
      selectedGroupDetails: selectedGroup ? {
        training_location: selectedGroup.training_location,
        functional_area: selectedGroup.functional_area
      } : null
    });

    if (selectedUsers.length === 0) {
      debugWarn('⚠️ No users selected for assignment');
      return;
    }

    try {
      setLoading(true);

      for (const userId of selectedUsers) {
        if (isUserAssigned(userId)) {
          debugLog(`⏭️ Skipping already assigned user: ${userId}`);
          continue; // Skip already assigned users
        }

        const assignmentData = {
          userId,
          level: assignmentLevel,
          type: 'standard'
        };

        if (assignmentLevel === 'course' && selectedCourse) {
          assignmentData.courseId = selectedCourse.course_id;
          assignmentData.trainingLocation = selectedTrainingLocation;
          assignmentData.functionalArea = selectedFunctionalArea;
        } else if (assignmentLevel === 'group' && selectedGroup) {
          // For group assignments, we don't need a course_id since groups can span multiple courses
          
          // CRITICAL FIX: When user has selected specific filters, create a location-scoped group identifier
          const effectiveLocation = selectedTrainingLocation || selectedGroup.training_location;
          const effectiveFunctionalArea = selectedFunctionalArea || selectedGroup.functional_area;
          
          // Extract the group number from the display name (e.g., "Group 1" -> "1")
          const groupNumberMatch = selectedGroup.display_name.match(/Group (\d+)/);
          const groupNumber = groupNumberMatch ? groupNumberMatch[1] : '1';
          
          // Create location-scoped group identifier
          const locationScopedGroupIdentifier = `${effectiveLocation}-${effectiveFunctionalArea}-Group${groupNumber}`;
          
          assignmentData.groupIdentifier = locationScopedGroupIdentifier;
          assignmentData.trainingLocation = effectiveLocation;
          assignmentData.functionalArea = effectiveFunctionalArea;
          
          debugLog('🎯 Group assignment data (FIXED):', {
            originalGroupId: selectedGroup.group_identifier,
            locationScopedGroupId: locationScopedGroupIdentifier,
            trainingLocation: assignmentData.trainingLocation,
            functionalArea: assignmentData.functionalArea,
            selectedTrainingLocationFilter: selectedTrainingLocation,
            selectedFunctionalAreaFilter: selectedFunctionalArea,
            groupNumber: groupNumber,
            userId: assignmentData.userId,
            level: assignmentData.level
          });
          
          debugLog('🔥 ASSIGNMENT DATA BEING SENT TO DATABASE:', {
            userId: assignmentData.userId,
            level: assignmentData.level,
            courseId: assignmentData.courseId,
            groupIdentifier: assignmentData.groupIdentifier,
            sessionIdentifier: assignmentData.sessionIdentifier,
            trainingLocation: assignmentData.trainingLocation,
            functionalArea: assignmentData.functionalArea,
            type: assignmentData.type
          });
        } else if (assignmentLevel === 'session' && selectedSession) {
          assignmentData.courseId = selectedSession.course_id;
          assignmentData.sessionIdentifier = generateSessionId(selectedSession);
          assignmentData.trainingLocation = selectedSession.location || selectedSession.extendedProps?.location || selectedTrainingLocation;
          assignmentData.functionalArea = selectedSession.functional_area || selectedSession.functionalArea || selectedSession.extendedProps?.functional_area || selectedSession.extendedProps?.functionalArea || selectedFunctionalArea;
        } else if (assignmentLevel === 'training_location') {
          // CRITICAL FIX: For training location assignments, ensure we always have location context
          // If user hasn't selected specific filters, use the schedule's criteria as defaults
          
          let effectiveTrainingLocation = selectedTrainingLocation;
          let effectiveFunctionalArea = selectedFunctionalArea;
          
          // If no specific location selected, use the first available location from schedule
          if (!effectiveTrainingLocation) {
            const availableLocations = getUniqueTrainingLocations();
            if (availableLocations.length > 0 && availableLocations[0] !== 'TBD') {
              effectiveTrainingLocation = availableLocations[0];
              debugLog('🔧 Auto-selected training location:', effectiveTrainingLocation);
            }
          }
          
          // If no specific functional area selected, use the first available area from schedule
          if (!effectiveFunctionalArea) {
            const availableAreas = getUniqueFunctionalAreas();
            if (availableAreas.length > 0 && availableAreas[0] !== 'General') {
              effectiveFunctionalArea = availableAreas[0];
              debugLog('🔧 Auto-selected functional area:', effectiveFunctionalArea);
            } else if (availableAreas.includes('General')) {
              effectiveFunctionalArea = 'General';
            }
          }
          
          debugLog('📍 Training location assignment context:', {
            selectedTrainingLocation,
            selectedFunctionalArea,
            effectiveTrainingLocation,
            effectiveFunctionalArea,
            availableLocations: getUniqueTrainingLocations(),
            availableAreas: getUniqueFunctionalAreas()
          });
          
          assignmentData.trainingLocation = effectiveTrainingLocation;
          assignmentData.functionalArea = effectiveFunctionalArea;
          
          // Validation: Ensure we don't create assignments with NULL location data
          if (!assignmentData.trainingLocation || !assignmentData.functionalArea) {
            throw new Error(`Cannot create training location assignment without location context. Training Location: ${assignmentData.trainingLocation}, Functional Area: ${assignmentData.functionalArea}`);
          }
        }

        debugLog('📤 CRITICAL: Assignment data being sent:', {
          userId: assignmentData.userId,
          level: assignmentData.level,
          courseId: assignmentData.courseId,
          trainingLocation: assignmentData.trainingLocation,
          functionalArea: assignmentData.functionalArea,
          groupIdentifier: assignmentData.groupIdentifier
        });
        debugLog('🚀 About to call onCreateAssignment...');
        debugLog('🔍 onCreateAssignment function:', onCreateAssignment);
        debugLog('🔍 typeof onCreateAssignment:', typeof onCreateAssignment);
        try {
          const result = await onCreateAssignment(assignmentData);
          debugLog('✅ onCreateAssignment returned:', result);
        } catch (error) {
          debugError('❌ onCreateAssignment threw error:', error);
          throw error;
        }
        debugLog('✅ onCreateAssignment completed for user:', userId);
      }

      setSelectedUsers([]);
      debugLog('🎉 Bulk assignment completed successfully');
      
    } catch (err) {
      debugError('❌ Error in bulk assignment:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle remove assignment
  const handleRemoveAssignment = async (assignment) => {
    try {
      await onRemoveAssignment(assignment.id);
    } catch (err) {
      debugError('❌ Error removing assignment:', err);
      setError(err.message);
    }
  };

  // Get current assignments for display
  const getCurrentAssignments = () => {
    return assignments.filter(assignment => {
      // Filter by location and functional area context
      if (selectedTrainingLocation && assignment.training_location !== selectedTrainingLocation) {
        return false;
      }
      if (selectedFunctionalArea && assignment.functional_area !== selectedFunctionalArea) {
        return false;
      }
      
      if (assignmentLevel === 'training_location') {
        return assignment.assignment_level === 'training_location';
      } else if (assignmentLevel === 'course' && selectedCourse) {
        return assignment.assignment_level === 'course' && assignment.course_id === selectedCourse.course_id;
      } else if (assignmentLevel === 'group' && selectedGroup) {
        // CRITICAL FIX: Use the same location-scoped group identifier logic as in assignment creation
        const effectiveLocation = selectedTrainingLocation || selectedGroup.training_location;
        const effectiveFunctionalArea = selectedFunctionalArea || selectedGroup.functional_area;
        const groupNumberMatch = selectedGroup.display_name.match(/Group (\d+)/);
        const groupNumber = groupNumberMatch ? groupNumberMatch[1] : '1';
        const locationScopedGroupIdentifier = `${effectiveLocation}-${effectiveFunctionalArea}-Group${groupNumber}`;
        
        return assignment.assignment_level === 'group' && 
               assignment.group_identifier === locationScopedGroupIdentifier;
      } else if (assignmentLevel === 'session' && selectedSession) {
        const sessionId = generateSessionId(selectedSession);
        return assignment.assignment_level === 'session' && assignment.session_identifier === sessionId;
      }
      return false;
    });
  };

  useEffect(() => {
    debugLog('🔄 useEffect triggered! selectedGroup changed to:', selectedGroup?.group_identifier);
    fetchEligibleUsers();
    setSelectedUsers([]); // Clear selections when level/course/group/session changes
  }, [assignmentLevel, selectedCourse, selectedGroup, selectedSession, schedule, selectedTrainingLocation, selectedFunctionalArea]);

  const uniqueCourses = getUniqueCourses();
  const courseSessions = selectedCourse ? getCourseSessions(selectedCourse.course_id) : [];
  const allGroups = getAllGroups();
  const currentAssignments = getCurrentAssignments();
  
  // Debug group rendering (disabled)
  // debugLog('🔍 Groups available for rendering:', allGroups.length);

  return (
    <div className="assignment-workspace">
      <div className="workspace-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Schedule Selection
        </button>
        
        <div className="schedule-info">
          <h2>{schedule.name}</h2>
          <p>Assignment Level: <strong>{assignmentLevel.replace('_', ' ').toUpperCase()}</strong></p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Location and Functional Area Filters */}
      <div className="filter-controls">
        <h3>🎯 Context Filters</h3>
        <div className="filter-row">
          <div className="filter-group">
            <label>Functional Area:</label>
            <select 
              value={selectedFunctionalArea} 
              onChange={(e) => setSelectedFunctionalArea(e.target.value)}
            >
              <option value="">All Functional Areas</option>
              {getUniqueFunctionalAreas().map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Training Location:</label>
            <select 
              value={selectedTrainingLocation} 
              onChange={(e) => setSelectedTrainingLocation(e.target.value)}
            >
              <option value="">All Locations</option>
              {getUniqueTrainingLocations().map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>
        
        {(selectedTrainingLocation || selectedFunctionalArea) && (
          <div className="active-filters">
            <strong>Active Filters:</strong>
            {selectedFunctionalArea && <span className="filter-tag">🏢 {selectedFunctionalArea}</span>}
            {selectedTrainingLocation && <span className="filter-tag">📍 {selectedTrainingLocation}</span>}
          </div>
        )}
      </div>

      {/* Level-specific selectors */}
      {assignmentLevel === 'course' && (
        <div className="course-selector">
          <h3>Select Course</h3>
          <div className="course-grid">
            {uniqueCourses.map(course => (
              <div
                key={course.course_id}
                className={`course-card ${selectedCourse?.course_id === course.course_id ? 'selected' : ''}`}
                onClick={() => setSelectedCourse(course)}
              >
                <h4>{course.course_name}</h4>
                <p>ID: {course.course_id}</p>
                <p>Area: {course.functional_area}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignmentLevel === 'group' && (
        <div className="group-selector">
          <h3>Select Group</h3>
          
          {allGroups.length === 0 ? (
            <div className="no-groups-message">
              <p>❌ No groups found in this schedule.</p>
              <p>Groups are identified by sessions with "Group X" in their titles.</p>
            </div>
          ) : (
            <>
              {/* Group Dropdown */}
              <div className="group-dropdown-container">
                <select 
                  className="group-dropdown"
                  value={selectedGroup?.group_identifier || ''}
                  onChange={(e) => {
                    debugLog('🎯 GROUP DROPDOWN CHANGED:', e.target.value);
                    const group = allGroups.find(g => g.group_identifier === e.target.value);
                    debugLog('🎯 Found group:', group?.display_name);
                    setSelectedGroup(group || null);
                  }}
                >
                  <option value="">-- Select a Group --</option>
                  {allGroups.map((group, index) => (
                    <option key={index} value={group.group_identifier}>
                      {group.display_name} - {group.training_location} | {group.functional_area}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Group Details */}
              {selectedGroup && (
                <div className="selected-group-details">
                  <div className="group-summary">
                    <h4>{selectedGroup.display_name || selectedGroup.group_identifier}</h4>
                    <p>📍 {selectedGroup.training_location} | 🏢 {selectedGroup.functional_area}</p>
                    <div className="group-stats">
                      <span>Courses: {selectedGroup.uniqueCourses}</span>
                      <span>Sessions: {selectedGroup.sessions.length}</span>
                      <span>Duration: {selectedGroup.sessions.reduce((total, s) => total + (s.duration || 0), 0)}h total</span>
                    </div>
                  </div>
                  
                  {/* Capacity Warning */}
                  {getCapacityWarning(selectedGroup) && (
                    <div className={`capacity-status ${isGroupOverCapacity(selectedGroup) ? 'over-capacity' : 'normal-capacity'}`}>
                      {getCapacityWarning(selectedGroup)}
                    </div>
                  )}
                  
                  {/* Course List */}
                  <div className="group-courses-summary">
                    <strong>Courses:</strong>
                    {selectedGroup.courses.map((course, idx) => (
                      <span key={idx} className="course-tag">{course}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {assignmentLevel === 'session' && (
        <div className="session-selector">
          <h3>Select Course and Session</h3>
          
          {!selectedCourse ? (
            <div className="course-grid">
              {uniqueCourses.map(course => (
                <div
                  key={course.course_id}
                  className="course-card"
                  onClick={() => setSelectedCourse(course)}
                >
                  <h4>{course.course_name}</h4>
                  <p>ID: {course.course_id}</p>
                  <p>Area: {course.functional_area}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="session-selection">
              <div className="selected-course">
                <strong>Selected Course:</strong> {selectedCourse.course_name}
                <button onClick={() => {
                  setSelectedCourse(null);
                  setSelectedSession(null);
                }} className="change-course-btn">
                  Change Course
                </button>
              </div>
              
              <div className="session-grid">
                {courseSessions.map((session, index) => (
                  <div
                    key={index}
                    className={`session-card ${selectedSession === session ? 'selected' : ''}`}
                    onClick={() => setSelectedSession(session)}
                  >
                    <h4>{session.title}</h4>
                    <p>Start: {new Date(session.start).toLocaleString('en-GB')}</p>
                    <p>Duration: {session.duration}h</p>
                    <p>Location: {session.location}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignment Interface */}
      {(assignmentLevel === 'training_location' || 
        (assignmentLevel === 'course' && selectedCourse) ||
        (assignmentLevel === 'group' && selectedGroup) ||
        (assignmentLevel === 'session' && selectedSession)) && (
        <div className="assignment-interface">
          <div className="assignment-panels">
            {/* Eligible Users Panel */}
            <div className="eligible-users-panel">
              <div className="panel-header">
                <h3>Eligible Users ({eligibleUsers.length})</h3>
                
                {/* Capacity Warning for Group Level */}
                {assignmentLevel === 'group' && selectedGroup && (
                  <div className={`capacity-warning ${isGroupOverCapacity(selectedGroup) ? 'over-capacity' : 'normal-capacity'}`}>
                    {getCapacityWarning(selectedGroup)}
                    {selectedUsers.length > 0 && (
                      <div className="assignment-preview">
                        {(() => {
                          const currentCount = getGroupAssignmentCount(selectedGroup);
                          const newCount = currentCount + selectedUsers.length;
                          const maxParticipants = getGroupMaxParticipants(selectedGroup);
                          
                          if (maxParticipants && newCount > maxParticipants) {
                            return (
                              <span className="over-capacity-preview">
                                ⚠️ Assigning {selectedUsers.length} users will result in {newCount}/{maxParticipants} 
                                ({newCount - maxParticipants} over limit)
                              </span>
                            );
                          } else if (maxParticipants) {
                            return (
                              <span className="normal-preview">
                                ✅ After assignment: {newCount}/{maxParticipants} participants
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bulk-actions">
                  <button
                    onClick={() => setSelectedUsers(
                      selectedUsers.length === eligibleUsers.length 
                        ? [] 
                        : eligibleUsers.filter(u => !isUserAssigned(u.id)).map(u => u.id)
                    )}
                    disabled={eligibleUsers.length === 0}
                    className="select-all-btn"
                  >
                    {selectedUsers.length === eligibleUsers.length ? 'Deselect All' : 'Select All Available'}
                  </button>
                  <button
                    onClick={handleBulkAssign}
                    disabled={selectedUsers.length === 0 || loading}
                    className="assign-selected-btn"
                  >
                    {loading ? 'Assigning...' : `Assign Selected (${selectedUsers.length})`}
                  </button>
                </div>
              </div>
              
              <div className="users-list">
                {loading ? (
                  <div className="loading-users">Loading users...</div>
                ) : eligibleUsers.length === 0 ? (
                  <div className="no-users">
                    No eligible users found for current selection
                  </div>
                ) : (
                  eligibleUsers.map(user => (
                    <div
                      key={user.id}
                      className={`user-item ${isUserAssigned(user.id) ? 'assigned' : ''} ${
                        selectedUsers.includes(user.id) ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleUserSelection(user.id)}
                        disabled={isUserAssigned(user.id)}
                      />
                      <div className="user-info">
                        <div className="user-name">{user.name}</div>
                        <div className="user-details">
                          {user.project_role} | {user.training_location}
                        </div>
                      </div>
                      {isUserAssigned(user.id) && (
                        <div className="assigned-badge">✅ Assigned</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Current Assignments Panel */}
            <div className="current-assignments-panel">
              <div className="panel-header">
                <h3>Current Assignments ({currentAssignments.length})</h3>
              </div>
              
              <div className="assignments-list">
                {currentAssignments.length === 0 ? (
                  <div className="no-assignments">
                    No users assigned yet
                  </div>
                ) : (
                  currentAssignments.map(assignment => {
                    // Find user data from eligibleUsers list since relationship query fails
                    const userData = eligibleUsers.find(u => u.id === assignment.end_user_id);
                    
                    return (
                      <div key={assignment.id} className="assignment-item">
                        <div className="assignment-info">
                          <div className="assignment-user">
                            {userData?.name || assignment.end_users?.name || `User ID: ${assignment.end_user_id}`}
                          </div>
                          <div className="assignment-details">
                            {userData?.project_role || assignment.end_users?.project_role || 'Unknown Role'} | {userData?.training_location || assignment.end_users?.training_location || 'Unknown Location'}
                          </div>
                          <div className="assignment-meta">
                            Type: {assignment.assignment_type} | 
                            Status: {assignment.assignment_status}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(assignment)}
                          className="remove-assignment-btn"
                          title="Remove assignment"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentWorkspace;