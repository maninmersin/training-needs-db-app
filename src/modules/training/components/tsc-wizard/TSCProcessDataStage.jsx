import React, { useEffect, useState } from 'react';
import { calculateSessions } from './TrainingCalculations';
import { 
  calculateClassroomsNeeded, 
  ClassroomOccupancyTracker,
  validateClassroomCapacity 
} from '@core/utils/classroomCalculations';

const TSCProcessDataStage = ({
  criteria,
  setSessionsForCalendar,
  courses,
  endUsers,
  groupingKeys,
  onNextStage,
  onPreviousStage
}) => {
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [calculationError, setCalculationError] = useState(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [classroomConstraints, setClassroomConstraints] = useState(null);
  const [classroomWarnings, setClassroomWarnings] = useState([]);

  useEffect(() => {
    if (hasProcessed) return;

    const processData = async () => {
      setLoadingSessions(true);
      setCalculationError(null);

      console.log('📌 Inside processData');
      console.log('🔍 criteria:', criteria);
      console.log('🔍 courses:', courses);
      console.log('🔍 endUsers:', endUsers);
      console.log('🔍 groupingKeys:', groupingKeys);

      try {
        if (
          criteria &&
          Array.isArray(courses) && courses.length > 0 &&
          Array.isArray(endUsers) && endUsers.length > 0 &&
          Array.isArray(groupingKeys) && groupingKeys.length > 0
        ) {
          console.log('📊 First end user sample:', endUsers[0]);
          console.log('📊 First course sample:', courses[0]);

          const safeCalculateSessions = (criteria, courses, endUsers, groupingKeys) => {
            if (!criteria || !courses?.length || !endUsers?.length) return {};
            const sessionsGrouped = {};
            const classroomTracker = new ClassroomOccupancyTracker();
            const locationClassroomReqs = new Map();
            const warnings = [];

            const groupedEndUsers = endUsers.reduce((groups, user) => {
              const key = groupingKeys.map(k => user[k]?.toString().trim() || 'Unknown').join('|');
              (groups[key] = groups[key] || []).push(user);
              return groups;
            }, {});

            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            // Handle scheduling preference
            const schedulingPreference = criteria.scheduling_preference || 'both';
            let amStartHour = 0, amStartMin = 0, amEndHour = 0, amEndMin = 0;
            let pmStartHour = 0, pmStartMin = 0, pmEndHour = 0, pmEndMin = 0;
            let amBlockHours = 0, pmBlockHours = 0;

            if (schedulingPreference === 'both' || schedulingPreference === 'am_only') {
              if (criteria.start_time_am && criteria.end_time_am) {
                [amStartHour, amStartMin] = criteria.start_time_am.split(':').map(Number);
                [amEndHour, amEndMin] = criteria.end_time_am.split(':').map(Number);
                amBlockHours = (amEndHour + amEndMin / 60) - (amStartHour + amStartMin / 60);
              }
            }

            if (schedulingPreference === 'both' || schedulingPreference === 'pm_only') {
              if (criteria.start_time_pm && criteria.end_time_pm) {
                [pmStartHour, pmStartMin] = criteria.start_time_pm.split(':').map(Number);
                [pmEndHour, pmEndMin] = criteria.end_time_pm.split(':').map(Number);
                pmBlockHours = (pmEndHour + pmEndMin / 60) - (pmStartHour + pmStartMin / 60);
              }
            }

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
              const classroomReq = calculateClassroomsNeeded(totalTrainingHours, criteria);
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
            
            // Second pass: Schedule sessions with classroom constraints
            // Initialize new session structure: functional_area -> training_location -> classroom -> [sessions]
            const functionalArea = criteria.functionalArea || 'General';
            if (!sessionsGrouped[functionalArea]) {
              sessionsGrouped[functionalArea] = {};
            }

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
              console.log(`🏫 SETUP: ${groupName} has ${maxClassrooms} classrooms available`);

              let currentDate = new Date(criteria.start_date);
              // Set initial time based on scheduling preference
              if (schedulingPreference === 'pm_only') {
                currentDate.setHours(pmStartHour, pmStartMin, 0, 0);
              } else {
                currentDate.setHours(amStartHour, amStartMin, 0, 0);
              }

              const sortedCourses = [...courses].sort((a, b) => (a.course_id || '').localeCompare(b.course_id || ''));
              const usersInGroup = groupedEndUsers[groupName];

              for (const course of sortedCourses) {
                const attendees = usersInGroup.filter(user => user.course_id === course.course_id).length;
                console.log(`👥 ${groupName} - ${course.course_name}: ${attendees} attendees`);

                const duration = Number(course.duration_hrs);
                if (!course.duration_hrs || isNaN(duration)) {
                  console.warn('⚠️ Skipping course with invalid duration_hrs:', course);
                  continue;
                }

                const sessionsNeeded = Math.ceil(attendees / criteria.max_attendees) || 1;

                // Schedule multiple sessions concurrently when possible
                for (let i = 1; i <= sessionsNeeded; i++) {
                  // For multiple sessions of the same course, try to schedule them at the same time
                  // if we have multiple classrooms available
                  if (i > 1 && maxClassrooms > 1) {
                    // Try to schedule this session at the same time as the first session
                    const firstSessionStart = new Date(currentDate);
                    firstSessionStart.setDate(firstSessionStart.getDate() - (i - 1)); // Go back to when first session was scheduled
                    
                    // Find the start time of the first session for this course
                    const existingSessions = sessionsGrouped[groupName][criteria.functionalArea || 'General'];
                    const firstSessionOfThisCourse = existingSessions.find(session => 
                      session.course.course_id === course.course_id && session.sessionNumber === 1
                    );
                    
                    if (firstSessionOfThisCourse) {
                      const concurrentStart = new Date(firstSessionOfThisCourse.start);
                      const concurrentEnd = new Date(firstSessionOfThisCourse.end);
                      
                      // Check if we can schedule concurrently
                      if (classroomTracker.isClassroomAvailable(groupName, concurrentStart, concurrentEnd, maxClassrooms)) {
                        currentDate = new Date(concurrentStart);
                      }
                    }
                  }
                  // 🏫 Find best time slot for this session (allowing concurrent sessions in different classrooms)
                  let sessionStart = new Date(currentDate);
                  let sessionEnd = new Date(sessionStart);
                  sessionEnd.setHours(sessionStart.getHours() + duration);
                  
                  // Check if we can schedule at current time in any available classroom
                  if (!classroomTracker.isClassroomAvailable(groupName, sessionStart, sessionEnd, maxClassrooms)) {
                    // Try to advance time to next slot before moving to next day
                    let foundSlot = false;
                    let attempts = 0;
                    const maxAttempts = 365; // Prevent infinite loop
                    
                    while (attempts < maxAttempts && !foundSlot) {
                      // First try moving forward by duration hours to see if classrooms free up
                      const nextSlotStart = new Date(sessionStart);
                      nextSlotStart.setHours(nextSlotStart.getHours() + duration);
                      const nextSlotEnd = new Date(nextSlotStart);
                      nextSlotEnd.setHours(nextSlotStart.getHours() + duration);
                      
                      // Check if next slot is within working hours
                      const nextSlotHour = nextSlotStart.getHours() + nextSlotStart.getMinutes() / 60;
                      let isValidTime = false;
                      
                      if (schedulingPreference === 'both') {
                        const amStart = amStartHour + amStartMin / 60;
                        const amEnd = amEndHour + amEndMin / 60;
                        const pmStart = pmStartHour + pmStartMin / 60;
                        const pmEnd = pmEndHour + pmEndMin / 60;
                        isValidTime = (nextSlotHour >= amStart && nextSlotEnd.getHours() + nextSlotEnd.getMinutes() / 60 <= amEnd) || 
                                     (nextSlotHour >= pmStart && nextSlotEnd.getHours() + nextSlotEnd.getMinutes() / 60 <= pmEnd);
                      } else if (schedulingPreference === 'am_only') {
                        const amStart = amStartHour + amStartMin / 60;
                        const amEnd = amEndHour + amEndMin / 60;
                        isValidTime = (nextSlotHour >= amStart && nextSlotEnd.getHours() + nextSlotEnd.getMinutes() / 60 <= amEnd);
                      } else if (schedulingPreference === 'pm_only') {
                        const pmStart = pmStartHour + pmStartMin / 60;
                        const pmEnd = pmEndHour + pmEndMin / 60;
                        isValidTime = (nextSlotHour >= pmStart && nextSlotEnd.getHours() + nextSlotEnd.getMinutes() / 60 <= pmEnd);
                      }
                      
                      if (isValidTime && classroomTracker.isClassroomAvailable(groupName, nextSlotStart, nextSlotEnd, maxClassrooms)) {
                        sessionStart = nextSlotStart;
                        sessionEnd = nextSlotEnd;
                        currentDate = new Date(sessionStart);
                        foundSlot = true;
                      } else {
                        // Move to next day
                        do {
                          currentDate.setDate(currentDate.getDate() + 1);
                        } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                        
                        // Reset to appropriate start time based on preference
                        if (schedulingPreference === 'pm_only') {
                          currentDate.setHours(pmStartHour, pmStartMin, 0, 0);
                        } else {
                          currentDate.setHours(amStartHour, amStartMin, 0, 0);
                        }
                        
                        sessionStart = new Date(currentDate);
                        sessionEnd = new Date(sessionStart);
                        sessionEnd.setHours(sessionStart.getHours() + duration);
                        
                        if (classroomTracker.isClassroomAvailable(groupName, sessionStart, sessionEnd, maxClassrooms)) {
                          foundSlot = true;
                        }
                      }
                      attempts++;
                    }
                    
                    if (attempts >= maxAttempts) {
                      warnings.push({
                        location: groupName,
                        message: `Unable to schedule ${course.course_name} - Group ${i} due to classroom capacity constraints`,
                        severity: 'error',
                        course: course.course_name,
                        sessionNumber: i
                      });
                      continue; // Skip this session
                    }
                  }
                  
                  // ⏱ Enforce working hours strictly based on scheduling preference
                  const currentHour = currentDate.getHours() + currentDate.getMinutes() / 60;
                  let isValidTime = false;
                  
                  if (schedulingPreference === 'both') {
                    const amStart = amStartHour + amStartMin / 60;
                    const amEnd = amEndHour + amEndMin / 60;
                    const pmStart = pmStartHour + pmStartMin / 60;
                    const pmEnd = pmEndHour + pmEndMin / 60;
                    isValidTime = (currentHour >= amStart && currentHour < amEnd) || (currentHour >= pmStart && currentHour < pmEnd);
                  } else if (schedulingPreference === 'am_only') {
                    const amStart = amStartHour + amStartMin / 60;
                    const amEnd = amEndHour + amEndMin / 60;
                    isValidTime = (currentHour >= amStart && currentHour < amEnd);
                  } else if (schedulingPreference === 'pm_only') {
                    const pmStart = pmStartHour + pmStartMin / 60;
                    const pmEnd = pmEndHour + pmEndMin / 60;
                    isValidTime = (currentHour >= pmStart && currentHour < pmEnd);
                  }

                  if (!isValidTime) {
                    do {
                      currentDate.setDate(currentDate.getDate() + 1);
                    } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                    
                    // Reset to appropriate start time based on preference
                    if (schedulingPreference === 'pm_only') {
                      currentDate.setHours(pmStartHour, pmStartMin, 0, 0);
                    } else {
                      currentDate.setHours(amStartHour, amStartMin, 0, 0);
                    }
                  }

                  // Update session times for final scheduling
                  sessionStart = new Date(currentDate);
                  sessionEnd = new Date(sessionStart);

                  // Handle session duration based on scheduling preference
                  if (schedulingPreference === 'am_only') {
                    // Only AM sessions allowed
                    if (duration <= amBlockHours) {
                      sessionEnd.setHours(sessionStart.getHours() + duration);
                    } else {
                      // Split into multiple AM sessions across days
                      let remainingDuration = duration;
                      let partNumber = 1;
                      
                      while (remainingDuration > 0) {
                        const partDuration = Math.min(remainingDuration, amBlockHours);
                        const partStart = new Date(currentDate);
                        const partEnd = new Date(partStart);
                        partEnd.setHours(partStart.getHours() + partDuration);
                        
                        const partTitle = `${course.course_name} - Group ${i} (Part ${partNumber})`;
                        
                        // Create unique session ID for this part
                        const partSessionId = `${course.course_id}-${i}-part${partNumber}-${partStart.getTime()}`;
                        
                        // Reserve classroom for this part and get assigned classroom number
                        const assignedClassroom = classroomTracker.reserveClassroom(groupName, partStart, partEnd, partSessionId, maxClassrooms);
                        const classroomKey = `Classroom ${assignedClassroom}`;
                        
                        sessionsGrouped[functionalArea][groupName][classroomKey].push({
                          title: partTitle,
                          start: partStart,
                          end: partEnd,
                          course,
                          sessionNumber: i,
                          groupType: groupingKeys,
                          groupName,
                          duration: partDuration,
                          functional_area: criteria.functionalArea,
                          location: course.location || 'TBD',
                          classroomNumber: assignedClassroom,
                          sessionId: partSessionId,
                          classroomOccupancy: classroomTracker.getUtilizationSummary(groupName)
                        });
                        
                        remainingDuration -= partDuration;
                        partNumber++;
                        
                        if (remainingDuration > 0) {
                          // Move to next available day
                          do {
                            currentDate.setDate(currentDate.getDate() + 1);
                          } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                          currentDate.setHours(amStartHour, amStartMin, 0, 0);
                        }
                      }
                      
                      // Move to next available day for the next session
                      do {
                        currentDate.setDate(currentDate.getDate() + 1);
                      } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                      currentDate.setHours(amStartHour, amStartMin, 0, 0);
                      continue; // Skip the single session creation below
                    }
                  } else if (schedulingPreference === 'pm_only') {
                    // Only PM sessions allowed
                    if (duration <= pmBlockHours) {
                      sessionEnd.setHours(sessionStart.getHours() + duration);
                    } else {
                      // Split into multiple PM sessions across days
                      let remainingDuration = duration;
                      let partNumber = 1;
                      
                      while (remainingDuration > 0) {
                        const partDuration = Math.min(remainingDuration, pmBlockHours);
                        const partStart = new Date(currentDate);
                        const partEnd = new Date(partStart);
                        partEnd.setHours(partStart.getHours() + partDuration);
                        
                        const partTitle = `${course.course_name} - Group ${i} (Part ${partNumber})`;
                        
                        // Create unique session ID for this part
                        const partSessionId = `${course.course_id}-${i}-part${partNumber}-${partStart.getTime()}`;
                        
                        // Reserve classroom for this part and get assigned classroom number
                        const assignedClassroom = classroomTracker.reserveClassroom(groupName, partStart, partEnd, partSessionId, maxClassrooms);
                        const classroomKey = `Classroom ${assignedClassroom}`;
                        
                        sessionsGrouped[functionalArea][groupName][classroomKey].push({
                          title: partTitle,
                          start: partStart,
                          end: partEnd,
                          course,
                          sessionNumber: i,
                          groupType: groupingKeys,
                          groupName,
                          duration: partDuration,
                          functional_area: criteria.functionalArea,
                          location: course.location || 'TBD',
                          classroomNumber: assignedClassroom,
                          sessionId: partSessionId,
                          classroomOccupancy: classroomTracker.getUtilizationSummary(groupName)
                        });
                        
                        remainingDuration -= partDuration;
                        partNumber++;
                        
                        if (remainingDuration > 0) {
                          // Move to next available day
                          do {
                            currentDate.setDate(currentDate.getDate() + 1);
                          } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                          currentDate.setHours(pmStartHour, pmStartMin, 0, 0);
                        }
                      }
                      
                      // Move to next available day for the next session
                      do {
                        currentDate.setDate(currentDate.getDate() + 1);
                      } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                      currentDate.setHours(pmStartHour, pmStartMin, 0, 0);
                      continue; // Skip the single session creation below
                    }
                  } else {
                    // Both AM and PM sessions allowed (original logic)
                    if (duration <= amBlockHours) {
                      sessionEnd.setHours(sessionStart.getHours() + duration);
                    } else if (duration <= pmBlockHours) {
                      sessionStart.setHours(pmStartHour, pmStartMin, 0, 0);
                      sessionEnd = new Date(sessionStart);
                      sessionEnd.setHours(sessionStart.getHours() + duration);
                    } else if (duration <= (amBlockHours + pmBlockHours)) {
                    // Split across AM and PM
                    let amPart = amBlockHours;
                    let pmPart = duration - amBlockHours;

                    const amSessionEnd = new Date(sessionStart);
                    amSessionEnd.setHours(amEndHour, amEndMin, 0, 0);

                    const pmSessionStart = new Date(sessionStart);
                    pmSessionStart.setHours(pmStartHour, pmStartMin, 0, 0);

                    const pmSessionEnd = new Date(pmSessionStart);
                    pmSessionEnd.setHours(pmSessionStart.getHours() + pmPart);

                    // Create unique session IDs for AM and PM parts
                    const amSessionId = `${course.course_id}-${i}-am-${sessionStart.getTime()}`;
                    const pmSessionId = `${course.course_id}-${i}-pm-${pmSessionStart.getTime()}`;
                    
                    // Reserve classroom for AM part and get assigned classroom number
                    const amAssignedClassroom = classroomTracker.reserveClassroom(groupName, sessionStart, amSessionEnd, amSessionId, maxClassrooms);
                    const amClassroomKey = `Classroom ${amAssignedClassroom}`;
                    
                    // Add AM part
                    sessionsGrouped[functionalArea][groupName][amClassroomKey].push({
                      title: `${course.course_name} - Group ${i} (Part 1)`,
                      start: sessionStart,
                      end: amSessionEnd,
                      course,
                      sessionNumber: i,
                      groupType: groupingKeys,
                      groupName,
                      duration: amPart,
                      functional_area: criteria.functionalArea,
                      location: course.location || 'TBD',
                      classroomNumber: amAssignedClassroom,
                      sessionId: amSessionId,
                      classroomOccupancy: classroomTracker.getUtilizationSummary(groupName)
                    });

                    // Reserve classroom for PM part and get assigned classroom number
                    const pmAssignedClassroom = classroomTracker.reserveClassroom(groupName, pmSessionStart, pmSessionEnd, pmSessionId, maxClassrooms);
                    const pmClassroomKey = `Classroom ${pmAssignedClassroom}`;
                    
                    // Add PM part
                    sessionsGrouped[functionalArea][groupName][pmClassroomKey].push({
                      title: `${course.course_name} - Group ${i} (Part 2)`,
                      start: pmSessionStart,
                      end: pmSessionEnd,
                      course,
                      sessionNumber: i,
                      groupType: groupingKeys,
                      groupName,
                      duration: pmPart,
                      functional_area: criteria.functionalArea,
                      location: course.location || 'TBD',
                      classroomNumber: pmAssignedClassroom,
                      sessionId: pmSessionId,
                      classroomOccupancy: classroomTracker.getUtilizationSummary(groupName)
                    });

                      currentDate = new Date(pmSessionEnd);
                      continue;
                    } else {
                      console.warn('⚠️ Session too long to fit in one day:', duration, 'hrs');
                      continue;
                    }
                  }

                  // Create single session for AM-only, PM-only, or normal single-block sessions
                  const sessionTitle = schedulingPreference === 'am_only' ? 
                    `${course.course_name} - Group ${i} (AM)` :
                    schedulingPreference === 'pm_only' ? 
                    `${course.course_name} - Group ${i} (PM)` :
                    `${course.course_name} - Group ${i}`;

                  // Create unique session ID for classroom assignment
                  const sessionId = `${course.course_id}-${i}-${sessionStart.getTime()}`;
                  
                  // Reserve classroom for this session and get assigned classroom number
                  const assignedClassroom = classroomTracker.reserveClassroom(groupName, sessionStart, sessionEnd, sessionId, maxClassrooms);
                  const classroomKey = `Classroom ${assignedClassroom}`;
                  
                  console.log(`🏫 CLASSROOM ASSIGNMENT: ${groupName} - ${course.course_name} Group ${i} -> Classroom ${assignedClassroom} at ${sessionStart.toISOString()}`);
                  
                  sessionsGrouped[functionalArea][groupName][classroomKey].push({
                    title: sessionTitle,
                    start: sessionStart,
                    end: sessionEnd,
                    course,
                    sessionNumber: i,
                    groupType: groupingKeys,
                    groupName,
                    duration,
                    functional_area: criteria.functionalArea,
                    location: course.location || 'TBD',
                    classroomNumber: assignedClassroom,
                    sessionId: sessionId,
                    classroomOccupancy: classroomTracker.getUtilizationSummary(groupName)
                  });

                  // After scheduling a session, check if we can fit the next session in PM slot
                  const sessionEndTime = new Date(sessionEnd);
                  const sessionEndHour = sessionEndTime.getHours() + sessionEndTime.getMinutes() / 60;
                  
                  // If we just finished an AM session and PM is available, move to PM start time
                  if (schedulingPreference === 'both' && sessionEndHour <= (pmStartHour + pmStartMin / 60)) {
                    currentDate.setHours(pmStartHour, pmStartMin, 0, 0);
                  } else {
                    // Otherwise move to next day
                    do {
                      currentDate.setDate(currentDate.getDate() + 1);
                    } while (!criteria.scheduling_days.includes(dayNames[currentDate.getDay()]));
                    currentDate.setHours(amStartHour, amStartMin, 0, 0);
                  }
                }
              }
            }
            
            // Store classroom constraints and warnings for review
            setClassroomConstraints({
              locationRequirements: Object.fromEntries(locationClassroomReqs),
              utilizationSummary: classroomTracker.getUtilizationSummary()
            });
            setClassroomWarnings(warnings);

            console.log('✅ sessionsGrouped:', sessionsGrouped);
            console.log('🏫 classroom constraints:', locationClassroomReqs);
            console.log('⚠️ classroom warnings:', warnings);
            return sessionsGrouped;
          };

          const grouped = safeCalculateSessions(criteria, courses, endUsers, groupingKeys);

          if (!grouped || Object.keys(grouped).length === 0) {
            console.error('❌ Empty grouped object. Possible issues:');
            console.error('criteria:', criteria);
            console.error('groupingKeys:', groupingKeys);
            console.error('user sample:', endUsers[0]);
            console.error('course sample:', courses[0]);
            setCalculationError('No sessions could be generated. Please check your grouping or data.');
            return;
          } else {
            setSessionsForCalendar(grouped);
            setHasProcessed(true);
            
            // Auto-proceed to next stage when processing is complete
            if (onNextStage) {
              setTimeout(onNextStage, 100); // Small delay to ensure state is updated
            }
          }
        } else {
          console.error('❌ Invalid input: missing required data');
          setCalculationError('Invalid input data. Please ensure all inputs are set correctly.');
        }
      } catch (err) {
        console.error('❌ Error calculating sessions:', err);
        setCalculationError('Failed to calculate sessions.');
      } finally {
        setLoadingSessions(false);
      }
    };

    processData();
  }, [criteria, courses, endUsers, groupingKeys, hasProcessed, onNextStage]);

  if (loadingSessions) return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div>🧮 Calculating sessions...</div>
      <div style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        Analyzing classroom capacity constraints...
      </div>
    </div>
  );
  
  if (calculationError) return (
    <div className="error" style={{ textAlign: 'center', padding: '40px' }}>
      ⚠️ {calculationError}
    </div>
  );

  // This should normally not be reached due to auto-proceed
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div>✅ Sessions calculated successfully...</div>
      
      {/* Classroom Warnings Display */}
      {classroomWarnings && classroomWarnings.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeaa7', 
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>
            🏫 Classroom Capacity Notifications
          </h4>
          {classroomWarnings.map((warning, index) => (
            <div key={index} style={{ 
              marginBottom: '8px', 
              fontSize: '14px',
              color: warning.severity === 'error' ? '#721c24' : '#856404'
            }}>
              <strong>{warning.location}:</strong> {warning.message}
            </div>
          ))}
        </div>
      )}
      
      {/* Classroom Requirements Summary */}
      {classroomConstraints && (
        <div style={{ 
          marginTop: '15px', 
          padding: '15px', 
          backgroundColor: '#e7f3ff', 
          border: '1px solid #b8daff', 
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#004085' }}>
            📊 Classroom Requirements Summary
          </h4>
          {Object.entries(classroomConstraints.locationRequirements).map(([location, req]) => (
            <div key={location} style={{ marginBottom: '5px', fontSize: '14px' }}>
              <strong>{location}:</strong> {req.numberOfClassrooms} classrooms needed 
              ({req.totalTrainingHours.toFixed(1)} training hours)
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TSCProcessDataStage;
