import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';

import TSCDefineCriteriaStage from './TSCDefineCriteriaStage';
import TSCFetchDataStage from './TSCFetchDataStage';
import TSCProcessDataStage from './TSCProcessDataStage';
import TSCReviewAdjustStage from './TSCReviewAdjustStage';
import './TSCWizard.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  calculateClassroomsNeeded, 
  ClassroomOccupancyTracker,
  validateClassroomCapacity 
} from '@core/utils/classroomCalculations';
import { getCurrentLocalDateTime } from '@core/utils/dateTimeUtils';
import { useSchedulingEngine } from '@modules/training/hooks/useSchedulingEngine';
import { 
  saveTrainingSchedule, 
  saveTrainingSessionsForSchedule
} from '@core/services/scheduleService';

const visibleStageTitles = [
  'Define Criteria',
  'Review & Adjust'
];

const TSCWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const schedulingEngine = useSchedulingEngine();
  const { currentProject } = useProject();
  const [visibleStage, setVisibleStage] = useState(0);
  const [runningHiddenStage, setRunningHiddenStage] = useState(null);
  const [processingInBackground, setProcessingInBackground] = useState(false);

  const [selectedFunctionalArea, setSelectedFunctionalArea] = useState('default');
  const [criteria, setCriteria] = useState({});
  const [sessionsForCalendar, setSessionsForCalendar] = useState([]);
  const [schedulesList, setSchedulesList] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [endUsers, setEndUsers] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [groupingKeys, setGroupingKeys] = useState([]);
  const [pivotState, setPivotState] = useState({});
  
  // Simple schedule name state (read-only wizard with save only)
  const [scheduleName, setScheduleName] = useState('');

  // Reset wizard to beginning
  const resetWizard = () => {
    setVisibleStage(0);
    setRunningHiddenStage(null);
    setProcessingInBackground(false);
    setSelectedFunctionalArea('default');
    setCriteria({});
    setSessionsForCalendar([]);
    setSchedulesList([]);
    setLoadingSchedules(false);
    setEndUsers([]);
    setFilteredData([]);
    setGroupingKeys([]);
    setPivotState({});
    setScheduleName('');
    localStorage.removeItem('tscWizardState');
  };

  // Check for restart parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('restart') === 'true') {
      resetWizard();
      // Clean up URL without triggering a re-render
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  useEffect(() => {
    localStorage.setItem('tscWizardState', JSON.stringify({
      visibleStage,
      selectedFunctionalArea,
      criteria,
      sessionsForCalendar,
      schedulesList,
      pivotState,
      groupingKeys,
      endUsers
    }));
  }, [visibleStage, selectedFunctionalArea, criteria, sessionsForCalendar, schedulesList, pivotState, groupingKeys, endUsers]);

  // Background processing functions
  const fetchDataInBackground = async () => {
    try {
      if (!currentProject) {
        throw new Error('No project selected');
      }

      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('project_id', currentProject.id);

      const { data: projectRoles, error: rolesError } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', currentProject.id);

      if (coursesError || rolesError) {
        console.error('❌ Courses Error:', coursesError?.message);
        console.error('❌ Roles Error:', rolesError?.message);
        throw new Error('One or more datasets failed to load');
      }

      console.log('✅ Courses fetched:', courses);
      console.log('✅ Project roles fetched:', projectRoles);

      setSchedulesList({
        courses,
        end_users: projectRoles
      });

      return { courses, projectRoles };
    } catch (error) {
      console.error('🔥 Fetch error:', error.message);
      throw error;
    }
  };

  // Legacy database functions - will be removed after refactoring
  const legacySaveTrainingSchedule = async (currentCriteria, functionalArea, scheduleName = null) => {
    // Use the extracted service function instead
    return await saveTrainingSchedule(currentCriteria, functionalArea, scheduleName);
  };

  const legacySaveTrainingSessionsForSchedule = async (sessionsGrouped, scheduleId, functionalArea, currentCriteria) => {
    // Use the extracted service function instead
    return await saveTrainingSessionsForSchedule(sessionsGrouped, scheduleId, functionalArea, currentCriteria);
  };

  // NOTE: User assignments are now handled via the Drag & Drop Assignment interface

  const processDataInBackground = async (courses, projectRoles) => {
    try {
      let currentCriteria = criteria[selectedFunctionalArea];
      
      if (!currentCriteria || Object.keys(currentCriteria).length === 0) {
        // Fallback: use the first available criteria if selectedFunctionalArea doesn't have data
        const availableKeys = Object.keys(criteria).filter(key => 
          criteria[key] && Object.keys(criteria[key]).length > 0
        );
        
        if (availableKeys.length > 0) {
          currentCriteria = criteria[availableKeys[0]];
        }
      }
      
      if (!currentCriteria || Object.keys(currentCriteria).length === 0) {
        throw new Error(`No criteria defined for functional area '${selectedFunctionalArea}'. Please ensure criteria are properly set in the Define Criteria stage.`);
      }
      
      if (!Array.isArray(courses) || courses.length === 0) {
        throw new Error('No courses data available');
      }
      
      if (!Array.isArray(endUsers) || endUsers.length === 0) {
        throw new Error('No end users data available');
      }
      
      if (!Array.isArray(groupingKeys) || groupingKeys.length === 0) {
        throw new Error('No grouping keys defined');
      }
      
      // Check required criteria fields based on scheduling preference
      const schedulingPreference = currentCriteria.scheduling_preference || 'both';
      const baseRequiredFields = ['start_date', 'max_attendees'];
      const timeRequiredFields = [];
      
      if (schedulingPreference === 'both') {
        timeRequiredFields.push('start_time_am', 'end_time_am', 'start_time_pm', 'end_time_pm');
      } else if (schedulingPreference === 'am_only') {
        timeRequiredFields.push('start_time_am', 'end_time_am');
      } else if (schedulingPreference === 'pm_only') {
        timeRequiredFields.push('start_time_pm', 'end_time_pm');
      }

      const requiredFields = [...baseRequiredFields, ...timeRequiredFields];
      for (const field of requiredFields) {
        if (!currentCriteria[field]) {
          throw new Error(`Missing required criteria field: ${field}`);
        }
      }

      // Complete scheduling logic (from TSCProcessDataStage)
      const sessionsGrouped = {};
      const classroomTracker = new ClassroomOccupancyTracker();
      const locationClassroomReqs = new Map();
      const warnings = [];
      
      const groupedEndUsers = endUsers.reduce((groups, user) => {
        const key = groupingKeys.map(k => user[k]?.toString().trim() || 'Unknown').join('|');
        (groups[key] = groups[key] || []).push(user);
        return groups;
      }, {});

      // First pass: Calculate classroom requirements per location
      for (const groupName in groupedEndUsers) {
        const usersInGroup = groupedEndUsers[groupName];
        let totalTrainingHours = 0;
        
        // Calculate total training hours for this group
        for (const course of courses) {
          const attendees = usersInGroup.filter(user => user.course_id === course.course_id).length;
          const duration = Number(course.duration_hrs);
          if (attendees > 0 && !isNaN(duration)) {
            totalTrainingHours += attendees * duration;
          }
        }
        
        // Calculate classroom requirements for this location
        const classroomReq = calculateClassroomsNeeded(totalTrainingHours, currentCriteria);
        locationClassroomReqs.set(groupName, classroomReq);
        
        // Validate classroom capacity
        const validation = validateClassroomCapacity(classroomReq.numberOfClassrooms);
        if (validation.severity === 'warning' || validation.severity === 'error') {
          warnings.push({
            location: groupName,
            message: validation.message,
            severity: validation.severity,
            classroomsNeeded: classroomReq.numberOfClassrooms
          });
        }
      }

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Parse time slots based on scheduling preference
      let amStartHour = 0, amStartMin = 0, amEndHour = 0, amEndMin = 0;
      let pmStartHour = 0, pmStartMin = 0, pmEndHour = 0, pmEndMin = 0;
      let amBlockHours = 0, pmBlockHours = 0;

      if (schedulingPreference === 'both' || schedulingPreference === 'am_only') {
        [amStartHour, amStartMin] = currentCriteria.start_time_am.split(':').map(Number);
        [amEndHour, amEndMin] = currentCriteria.end_time_am.split(':').map(Number);
        amBlockHours = (amEndHour + amEndMin / 60) - (amStartHour + amStartMin / 60);
      }

      if (schedulingPreference === 'both' || schedulingPreference === 'pm_only') {
        [pmStartHour, pmStartMin] = currentCriteria.start_time_pm.split(':').map(Number);
        [pmEndHour, pmEndMin] = currentCriteria.end_time_pm.split(':').map(Number);
        pmBlockHours = (pmEndHour + pmEndMin / 60) - (pmStartHour + pmStartMin / 60);
      }

      // Group-Complete scheduling function moved to useSchedulingEngine hook
      // (Original 300+ line implementation removed for better maintainability)
      
      // Legacy function wrapper for backwards compatibility during transition
      const scheduleByGroupComplete_REMOVED = async (
        groupedEndUsers, courses, currentCriteria, sessionsGrouped, 
        functionalArea, locationClassroomReqs, classroomTracker,
        schedulingPreference, amStartHour, amStartMin, pmStartHour, pmStartMin,
        amBlockHours, pmBlockHours, dayNames
      ) => {
        console.log('🎯 Starting Group-Complete scheduling mode - FIXED');
        
        for (const groupName in groupedEndUsers) {
          const usersInGroup = groupedEndUsers[groupName];
          const maxClassrooms = locationClassroomReqs.get(groupName)?.numberOfClassrooms || 1;
          
          console.log(`📍 Processing location: ${groupName} with ${maxClassrooms} classrooms`);
          
          // Get all session groups needed for this location
          const sessionGroupsForLocation = [];
          
          for (const course of courses) {
            const courseUsers = usersInGroup.filter(user => user.course_id === course.course_id);
            const attendees = courseUsers.length;
            
            if (attendees > 0) {
              const sessionsNeeded = Math.ceil(attendees / currentCriteria.max_attendees);
              
              // Create session groups with specific user ranges
              for (let sessionNum = 1; sessionNum <= sessionsNeeded; sessionNum++) {
                const startIndex = (sessionNum - 1) * currentCriteria.max_attendees;
                const endIndex = Math.min(sessionNum * currentCriteria.max_attendees, attendees) - 1;
                const sessionUsers = courseUsers.slice(startIndex, endIndex + 1);
                
                sessionGroupsForLocation.push({
                  course,
                  sessionNumber: sessionNum,
                  userCount: sessionUsers.length,
                  userRange: `${startIndex + 1}-${endIndex + 1}`,
                  users: sessionUsers,
                  originalGroupName: groupName
                });
              }
            }
          }
          
          console.log(`📚 Group ${groupName} needs ${sessionGroupsForLocation.length} session groups across ${maxClassrooms} classrooms`);
          
          // Distribute session groups across available classrooms
          const classroomQueues = [];
          for (let i = 1; i <= maxClassrooms; i++) {
            classroomQueues.push({
              classroomNum: i,
              sessionGroups: [],
              totalSessions: 0
            });
          }
          
          // Distribute individual session groups to balance load across classrooms
          for (const sessionGroup of sessionGroupsForLocation) {
            const targetClassroom = classroomQueues.reduce((min, classroom) => 
              classroom.totalSessions < min.totalSessions ? classroom : min
            );
            
            const enhancedSessionGroup = {
              ...sessionGroup,
              classroomNum: targetClassroom.classroomNum,
              enhancedGroupName: `${groupName} Group ${sessionGroup.userRange} Classroom ${targetClassroom.classroomNum}`
            };
            
            targetClassroom.sessionGroups.push(enhancedSessionGroup);
            targetClassroom.totalSessions += 1;
            
            console.log(`📋 Assigned ${sessionGroup.course.course_name} Session ${sessionGroup.sessionNumber} (Users ${sessionGroup.userRange}) to Classroom ${targetClassroom.classroomNum}`);
          }
          
          // Schedule sessions for each classroom independently
          for (const classroom of classroomQueues) {
            if (classroom.sessionGroups.length === 0) continue;
            
            const classroomKey = `Classroom ${classroom.classroomNum}`;
            
            // Initialize start time for this classroom
            let currentDate = new Date(currentCriteria.start_date);
            while (!currentCriteria.scheduling_days.includes(dayNames[currentDate.getDay()])) {
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            let currentSessionStartTime = new Date(currentDate);
            if (schedulingPreference === 'pm_only') {
              currentSessionStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
            } else {
              currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
            }
            
            // Ensure the structure exists
            if (!sessionsGrouped[functionalArea]) {
              sessionsGrouped[functionalArea] = {};
            }
            if (!sessionsGrouped[functionalArea][groupName]) {
              sessionsGrouped[functionalArea][groupName] = {};
            }
            if (!sessionsGrouped[functionalArea][groupName][classroomKey]) {
              sessionsGrouped[functionalArea][groupName][classroomKey] = [];
            }
            
            // Schedule each session group
            for (const sessionGroup of classroom.sessionGroups) {
              const { course, sessionNumber } = sessionGroup;
              const duration = Number(course.duration_hrs);
              
              // Handle AM/PM scheduling and session splitting
              let sessionParts = [];
              
              if (schedulingPreference === 'both') {
                const currentHour = currentSessionStartTime.getHours() + currentSessionStartTime.getMinutes() / 60;
                const amEndHour = amStartHour + amBlockHours;
                const pmStartHour_actual = pmStartHour + pmStartMin / 60;
                const pmEndHour = pmStartHour + pmBlockHours;
                
                // Check if session fits in current time block
                if (currentHour >= amStartHour && currentHour + duration <= amEndHour) {
                  // Fits in AM
                  sessionParts = [{
                    start: new Date(currentSessionStartTime),
                    end: new Date(currentSessionStartTime.getTime() + (duration * 60 * 60 * 1000)),
                    duration: duration,
                    part: 1,
                    partSuffix: 'AM'
                  }];
                } else if (currentHour >= pmStartHour_actual && currentHour + duration <= pmEndHour) {
                  // Fits in PM
                  sessionParts = [{
                    start: new Date(currentSessionStartTime),
                    end: new Date(currentSessionStartTime.getTime() + (duration * 60 * 60 * 1000)),
                    duration: duration,
                    part: 1,
                    partSuffix: 'PM'
                  }];
                } else if (currentHour >= amStartHour && currentHour < amEndHour && duration > (amEndHour - currentHour)) {
                  // Split across AM/PM
                  const amDuration = amEndHour - currentHour;
                  const pmDuration = duration - amDuration;
                  
                  if (pmDuration <= pmBlockHours) {
                    const amEndTime = new Date(currentSessionStartTime);
                    amEndTime.setHours(amStartHour + Math.floor(amBlockHours), Math.floor((amBlockHours % 1) * 60), 0, 0);
                    
                    const pmStartTime = new Date(currentSessionStartTime);
                    pmStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
                    
                    sessionParts = [
                      {
                        start: new Date(currentSessionStartTime),
                        end: new Date(amEndTime),
                        duration: amDuration,
                        part: 1,
                        partSuffix: 'AM'
                      },
                      {
                        start: new Date(pmStartTime),
                        end: new Date(pmStartTime.getTime() + (pmDuration * 60 * 60 * 1000)),
                        duration: pmDuration,
                        part: 2,
                        partSuffix: 'PM'
                      }
                    ];
                  } else {
                    // Move to PM slot if it fits
                    if (duration <= pmBlockHours) {
                      const pmStartTime = new Date(currentSessionStartTime);
                      pmStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
                      sessionParts = [{
                        start: pmStartTime,
                        end: new Date(pmStartTime.getTime() + (duration * 60 * 60 * 1000)),
                        duration: duration,
                        part: 1,
                        partSuffix: 'PM'
                      }];
                      currentSessionStartTime = pmStartTime;
                    } else {
                      // Move to next day
                      do {
                        currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
                      } while (!currentCriteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));
                      currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
                      
                      sessionParts = [{
                        start: new Date(currentSessionStartTime),
                        end: new Date(currentSessionStartTime.getTime() + (duration * 60 * 60 * 1000)),
                        duration: duration,
                        part: 1,
                        partSuffix: ''
                      }];
                    }
                  }
                } else {
                  // Try PM slot for sessions that fit
                  if (duration <= pmBlockHours) {
                    const pmStartTime = new Date(currentSessionStartTime);
                    pmStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
                    sessionParts = [{
                      start: pmStartTime,
                      end: new Date(pmStartTime.getTime() + (duration * 60 * 60 * 1000)),
                      duration: duration,
                      part: 1,
                      partSuffix: 'PM'
                    }];
                    currentSessionStartTime = pmStartTime;
                  } 
                  // Force split for 8-hour sessions
                  else if (duration === 8 && (amBlockHours + pmBlockHours) >= duration) {
                    const amDuration = amBlockHours;
                    const pmDuration = duration - amBlockHours;
                    
                    // Reset to AM start
                    currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
                    
                    const amEndTime = new Date(currentSessionStartTime);
                    amEndTime.setHours(amStartHour + Math.floor(amBlockHours), Math.floor((amBlockHours % 1) * 60), 0, 0);
                    
                    const pmStartTime = new Date(currentSessionStartTime);
                    pmStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
                    
                    sessionParts = [
                      {
                        start: new Date(currentSessionStartTime),
                        end: new Date(amEndTime),
                        duration: amDuration,
                        part: 1,
                        partSuffix: 'AM'
                      },
                      {
                        start: new Date(pmStartTime),
                        end: new Date(pmStartTime.getTime() + (pmDuration * 60 * 60 * 1000)),
                        duration: pmDuration,
                        part: 2,
                        partSuffix: 'PM'
                      }
                    ];
                    console.log(`🔄 Group mode: Force splitting ${duration}hr session: ${amDuration}hrs AM + ${pmDuration}hrs PM`);
                  } else {
                    // Move to next day
                    do {
                      currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
                    } while (!currentCriteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));
                    currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
                    
                    sessionParts = [{
                      start: new Date(currentSessionStartTime),
                      end: new Date(currentSessionStartTime.getTime() + (duration * 60 * 60 * 1000)),
                      duration: duration,
                      part: 1,
                      partSuffix: ''
                    }];
                  }
                }
              } else {
                // Single time block (AM only or PM only)
                sessionParts = [{
                  start: new Date(currentSessionStartTime),
                  end: new Date(currentSessionStartTime.getTime() + (duration * 60 * 60 * 1000)),
                  duration: duration,
                  part: 1,
                  partSuffix: schedulingPreference === 'am_only' ? 'AM' : schedulingPreference === 'pm_only' ? 'PM' : ''
                }];
              }
              
              // Create session objects for each part
              for (const part of sessionParts) {
                const sessionId = `${course.course_id}-${sessionNumber}-part${part.part}-${part.start.getTime()}`;
                const partTitle = sessionParts.length > 1 ?
                  `${course.course_name} - Group ${sessionNumber} Part ${part.part} ${part.partSuffix} (${sessionGroup.enhancedGroupName})` :
                  `${course.course_name} - Group ${sessionNumber} (${sessionGroup.enhancedGroupName})`;
                
                const sessionObj = {
                  sessionId: sessionId,
                  title: partTitle,
                  start: part.start,
                  end: part.end,
                  course,
                  sessionNumber: sessionNumber,
                  sessionPartNumber: part.part,
                  partSuffix: part.partSuffix,
                  groupType: ['training_location'],
                  groupName: sessionGroup.enhancedGroupName,
                  duration: part.duration,
                  functional_area: functionalArea,
                  location: groupName,
                  classroomNumber: classroom.classroomNum,
                  userCount: sessionGroup.userCount,
                  userRange: sessionGroup.userRange
                };
                
                sessionsGrouped[functionalArea][groupName][classroomKey].push(sessionObj);
              }
              
              // Advance time for next session
              const lastPart = sessionParts[sessionParts.length - 1];
              currentSessionStartTime = new Date(lastPart.end);
              
              // If we're in both mode and just finished AM, try PM next
              if (schedulingPreference === 'both' && sessionParts[0].partSuffix === 'AM' && sessionParts.length === 1) {
                const currentHour = currentSessionStartTime.getHours() + currentSessionStartTime.getMinutes() / 60;
                const pmStartHour_actual = pmStartHour + pmStartMin / 60;
                
                // If we finished AM session and can move to PM
                if (currentHour <= pmStartHour_actual) {
                  currentSessionStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
                } else {
                  // Move to next day
                  do {
                    currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
                  } while (!currentCriteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));
                  currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
                }
              } else if (sessionParts.length === 1) {
                // Move to next appropriate time slot
                do {
                  currentSessionStartTime.setDate(currentSessionStartTime.getDate() + 1);
                } while (!currentCriteria.scheduling_days.includes(dayNames[currentSessionStartTime.getDay()]));
                
                if (schedulingPreference === 'pm_only') {
                  currentSessionStartTime.setHours(pmStartHour, pmStartMin, 0, 0);
                } else {
                  currentSessionStartTime.setHours(amStartHour, amStartMin, 0, 0);
                }
              }
            }
          }
        }
        
        console.log('✅ Group-Complete scheduling completed');
      };

      const functionalArea = currentCriteria.functionalArea || 'General';
      if (!sessionsGrouped[functionalArea]) {
        sessionsGrouped[functionalArea] = {};
      }

      // Get scheduling mode from criteria
      const schedulingMode = currentCriteria.scheduling_mode || 'course_complete';
      
      for (const groupName in groupedEndUsers) {
        // Initialize location in the structure
        if (!sessionsGrouped[functionalArea][groupName]) {
          sessionsGrouped[functionalArea][groupName] = {};
        }
        
        // Get the number of classrooms needed for this location
        const maxClassrooms = locationClassroomReqs.get(groupName)?.numberOfClassrooms || 1;
        
        // Initialize all classrooms for this location
        for (let classroomNum = 1; classroomNum <= maxClassrooms; classroomNum++) {
          const classroomKey = `Classroom ${classroomNum}`;
          if (!sessionsGrouped[functionalArea][groupName][classroomKey]) {
            sessionsGrouped[functionalArea][groupName][classroomKey] = [];
          }
        }
      }

      // Apply different scheduling logic based on mode using extracted scheduling engine
      const { scheduleByGroupComplete, scheduleByCourseComplete } = schedulingEngine;
      
      if (schedulingMode === 'group_complete') {
        // Mode 1: Group-Complete (Independent Classrooms)
        await scheduleByGroupComplete(
          groupedEndUsers, courses, currentCriteria, sessionsGrouped, 
          functionalArea, locationClassroomReqs, classroomTracker,
          schedulingPreference, amStartHour, amStartMin, pmStartHour, pmStartMin,
          amBlockHours, pmBlockHours, dayNames
        );
      } else {
        // Mode 2: Course-Complete (Synchronized Classrooms)  
        await scheduleByCourseComplete(
          groupedEndUsers, courses, currentCriteria, sessionsGrouped,
          functionalArea, locationClassroomReqs, classroomTracker,
          schedulingPreference, amStartHour, amStartMin, pmStartHour, pmStartMin,
          amBlockHours, pmBlockHours, dayNames
        );
      }

      console.log('📊 Generated sessions for calendar view...');
      console.log('ℹ️ Sessions will be saved to database from Review & Adjust screen');
      
      setSessionsForCalendar(sessionsGrouped);
      return sessionsGrouped;
    } catch (error) {
      console.error('❌ Process error:', error.message);
      throw error;
    }
  };

  const handleNext = async () => {
    if (visibleStage === 0) {
      console.log('🚀 Starting background processing from Define Criteria...');
      console.log('📊 Current state:', { 
        selectedFunctionalArea, 
        fullCriteriaObject: criteria,
        criteriaForSelectedArea: criteria[selectedFunctionalArea],
        endUsersCount: endUsers.length,
        groupingKeysCount: groupingKeys.length 
      });
      
      // Validate that we have the required data from the criteria stage
      if (!endUsers.length || !groupingKeys.length) {
        alert('Please select at least one Functional Area and Training Location in the criteria stage.');
        return;
      }
      
      // Run background processing and then advance to Review & Adjust
      setProcessingInBackground(true);
      try {
        console.log('📥 Fetching data...');
        const { courses, projectRoles } = await fetchDataInBackground();
        console.log('📥 Data fetched successfully:', { coursesCount: courses?.length, rolesCount: projectRoles?.length });
        
        console.log('⚙️ Processing data...');
        const result = await processDataInBackground(courses, projectRoles);
        console.log('⚙️ Data processed successfully:', { sessionGroups: Object.keys(result || {}).length });
        
        console.log('🎯 Advancing to Review & Adjust stage...');
        setVisibleStage(1); // Go directly to Review & Adjust (now stage 1)
        console.log('✅ Successfully moved to stage 1');
      } catch (error) {
        console.error('❌ Background processing failed:', error);
        console.error('❌ Error details:', error.message);
        // Stay on current stage if there's an error
        alert(`Processing failed: ${error.message}`);
      } finally {
        setProcessingInBackground(false);
        console.log('🏁 Background processing complete');
      }
    } else {
      setVisibleStage(prev => Math.min(prev + 1, visibleStageTitles.length - 1));
    }
  };

  const handlePrevious = () => {
    setVisibleStage(prev => Math.max(prev - 1, 0));
  };

  const handleFinish = async (scheduleNameFromReview) => {
    try {
      // Check if project is selected
      if (!currentProject?.id) {
        throw new Error('No project selected. Please select a project before saving schedules.');
      }

      // Update schedule name state
      setScheduleName(scheduleNameFromReview);

      // Create new schedule (read-only wizard only creates, never edits)
      console.log('💾 Saving new schedule:', scheduleNameFromReview);
      console.log('🏢 Using project ID:', currentProject.id);
      
      const scheduleId = await saveTrainingSchedule(
        criteria[selectedFunctionalArea] || {}, 
        selectedFunctionalArea, 
        scheduleNameFromReview,
        currentProject.id
      );
      await saveTrainingSessionsForSchedule(sessionsForCalendar, scheduleId, selectedFunctionalArea, criteria[selectedFunctionalArea] || {}, currentProject.id);
      
      console.log('✅ Schedule created successfully');
      alert(`✅ Schedule "${scheduleNameFromReview}" saved successfully!\n\nUse the Schedule Manager to edit or delete schedules.`);

      // Navigate back to main menu after successful save
      localStorage.removeItem('tscWizardState');
      navigate('/');
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      alert(`Failed to save schedule: ${error.message}`);
    }
  };



  // Removed editing functionality - TSC Wizard is now read-only with Save only

  const renderStage = () => {
    switch (visibleStage) {
      case 0:
        return (
          <TSCDefineCriteriaStage
            criteria={criteria[selectedFunctionalArea] || {}}
            setCriteria={(updated) => setCriteria(prev => ({ ...prev, [selectedFunctionalArea]: updated }))}
            onNextStage={handleNext}
            onPreviousStage={handlePrevious}
            setEndUsers={setEndUsers}
            setGroupingKeys={setGroupingKeys}
            scheduleName={scheduleName}
            setScheduleName={setScheduleName}
          />
        );
      case 1:
        return (
          <TSCReviewAdjustStage
            sessionsForCalendar={sessionsForCalendar}
            onSessionUpdated={setSessionsForCalendar}
            onFinish={handleFinish}
            criteria={criteria[selectedFunctionalArea] || {}}
            scheduleName={scheduleName}
          />
        );
      default:
        return <div>Unknown stage</div>;
    }
  };

  return (
    <div className="tsc-wizard-container">
      <h2>Training Schedule Creator</h2>
      
      {processingInBackground && (
        <div style={{ 
          position: 'relative',
          minHeight: '200px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(249, 249, 249, 0.9)',
          borderRadius: '8px',
          padding: '40px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔄</div>
            <div>Processing training schedule...</div>
          </div>
        </div>
      )}
      
      {!processingInBackground && renderStage()}
    </div>
  );
};

export default TSCWizard;