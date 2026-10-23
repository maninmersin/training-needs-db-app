import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { generateEventIdFromSession } from '@core/utils/eventIdUtils';
import { toLocalDateTime } from '@core/utils/dateTimeUtils';
import { generateStableSessionId } from '@core/services/scheduleService';
import { multiDayNote } from './scheduleManagerLogic';
import {
  Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue
} from '@/components/ui';

const NONE = '__none__'; // Radix Select cannot hold an empty value

const AddCourseToScheduleModal = ({ isOpen, onClose, schedule, currentSessions, onCourseAdded }) => {
  const { currentProject } = useProject();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [trainingLocations, setTrainingLocations] = useState([]);
  const [formData, setFormData] = useState({
    trainingLocation: '',
    classroom: '',
    numberOfGroups: 1,
    startDate: '',
    startTime: '09:00',
    sessionSpacing: 'daily',
    maxParticipants: 10
  });
  const [availableClassrooms, setAvailableClassrooms] = useState([]);
  const [nextSessionNumber, setNextSessionNumber] = useState(1);

  // Calculate next available session number for the selected course
  const calculateNextSessionNumber = (courseId) => {
    if (!courseId || !currentSessions) {
      console.log('🔢 No courseId or currentSessions, defaulting to 1');
      return 1;
    }

    let maxSessionNumber = 0;
    let sessionsFound = 0;

    console.log('🔢 Calculating next session number for course:', courseId);
    console.log('🔢 Current sessions structure:', currentSessions);

    // Traverse the nested structure to find all sessions for this course
    Object.entries(currentSessions).forEach(([faKey, trainingLocations]) => {
      if (trainingLocations && typeof trainingLocations === 'object') {
        Object.entries(trainingLocations).forEach(([locKey, classrooms]) => {
          if (classrooms && typeof classrooms === 'object') {
            Object.entries(classrooms).forEach(([classKey, sessionsList]) => {
              if (Array.isArray(sessionsList)) {
                sessionsList.forEach(session => {
                  console.log('🔢 Checking session:', {
                    course_id: session.course_id,
                    course_name: session.course?.course_name,
                    session_number: session.sessionNumber || session.session_number,
                    location: `${faKey}/${locKey}/${classKey}`
                  });

                  // Check both session.course_id and session.course.course_id
                  const sessionCourseId = session.course_id || session.course?.course_id;
                  const sessionNumber = session.sessionNumber || session.session_number;

                  if (sessionCourseId === courseId && sessionNumber) {
                    sessionsFound++;
                    maxSessionNumber = Math.max(maxSessionNumber, sessionNumber);
                    console.log(`🔢 Found matching session! Number: ${sessionNumber}, Max so far: ${maxSessionNumber}`);
                  }
                });
              }
            });
          }
        });
      }
    });

    const nextNumber = maxSessionNumber + 1;
    console.log(`🔢 Final result: Found ${sessionsFound} sessions, max number was ${maxSessionNumber}, next will be ${nextNumber}`);

    return nextNumber;
  };

  // Get functional areas and training locations from the current schedule
  const getScheduleContext = async () => {
    try {
      // Get functional areas from the current project only
      const { data: functionalAreasData, error: faError } = await supabase
        .from('functional_areas')
        .select('name')
        .eq('project_id', currentProject?.id)
        .eq('active', true)
        .order('name');
      
      const allFunctionalAreas = functionalAreasData?.map(fa => fa.name) || ['General'];
      
      // Get training locations from the current schedule only
      let scheduleTrainingLocations = [];
      
      // From schedule criteria
      if (schedule && schedule.criteria) {
        const parsedCriteria = typeof schedule.criteria === 'string' 
          ? JSON.parse(schedule.criteria) 
          : schedule.criteria;
        
        scheduleTrainingLocations = parsedCriteria?.selected_training_locations || 
                                   parsedCriteria?.training_locations || 
                                   parsedCriteria?.locations || [];
      }
      
      // Fallback: From schedule.training_locations field
      if (scheduleTrainingLocations.length === 0 && schedule?.training_locations) {
        scheduleTrainingLocations = Array.isArray(schedule.training_locations) 
          ? schedule.training_locations 
          : [schedule.training_locations];
      }
      
      // Fallback: Extract from existing sessions in the schedule
      if (scheduleTrainingLocations.length === 0 && currentSessions) {
        const locationSet = new Set();
        Object.values(currentSessions).forEach(trainingLocations => {
          if (trainingLocations && typeof trainingLocations === 'object') {
            Object.keys(trainingLocations).forEach(location => locationSet.add(location));
          }
        });
        scheduleTrainingLocations = Array.from(locationSet).filter(Boolean);
      }
      
      // Ultimate fallback
      if (scheduleTrainingLocations.length === 0) {
        scheduleTrainingLocations = ['TBD'];
      }
      
      console.log('🆕 Add Course - Schedule-specific options:', {
        functionalAreas: allFunctionalAreas,
        trainingLocations: scheduleTrainingLocations,
        scheduleId: schedule?.id
      });
      
      return { 
        functionalAreas: allFunctionalAreas, 
        trainingLocations: scheduleTrainingLocations 
      };
      
    } catch (error) {
      console.warn('⚠️ Failed to fetch schedule context:', error);
      
      // Ultimate fallback
      return {
        functionalAreas: ['General'],
        trainingLocations: ['TBD']
      };
    }
  };

  // Fetch and filter courses
  useEffect(() => {
    if (!isOpen || !schedule) return;


    const fetchFilteredCourses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch training data from flat file (same as TSC Wizard)
        const { data: trainingData, error: trainingError } = await supabase
          .from('training_data_combined')
          .select('*')
          .eq('project_id', currentProject?.id);

        if (trainingError) throw trainingError;

        // Extract unique courses from training data (same logic as TSC Wizard)
        const coursesMap = new Map();
        trainingData.forEach(row => {
          if (!coursesMap.has(row.course_id)) {
            coursesMap.set(row.course_id, {
              course_id: row.course_id,
              course_name: row.course_name,
              duration_hrs: row.duration_hrs,
              functional_area: row.functional_area,
              location: row.user_location || 'TBD',
              topic: row.course_topic,
              sub_topic: row.course_sub_topic,
              application: row.course_application,
              priority: row.course_priority
            });
          }
        });

        const allCourses = Array.from(coursesMap.values()).sort((a, b) =>
          (a.course_name || '').localeCompare(b.course_name || '')
        );

        // Get all available functional areas and training locations
        const { functionalAreas, trainingLocations } = await getScheduleContext();

        console.log('🆕 Add Course - Loaded all courses from flat file:', {
          totalCourses: allCourses.length,
          availableLocations: trainingLocations.length,
          availableFunctionalAreas: functionalAreas.length
        });

        // Use ALL courses from flat file
        setCourses(allCourses || []);
        setTrainingLocations(trainingLocations);

        // Set default training location and update classrooms
        if (trainingLocations.length > 0) {
          setFormData(prev => ({ ...prev, trainingLocation: trainingLocations[0] }));
          updateAvailableClassrooms(trainingLocations[0]);
        }

        // Set default max participants from criteria or use reasonable default
        const criteria = schedule.criteria?.default || schedule.criteria || {};
        const defaultMaxParticipants = criteria.max_attendees || 10;
        setFormData(prev => ({ ...prev, maxParticipants: defaultMaxParticipants }));

      } catch (err) {
        console.error('❌ Error fetching courses:', err);
        setError(`Failed to load courses: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFilteredCourses();
  }, [isOpen, schedule, currentSessions]);

  // Handle form changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // When training location changes, update available classrooms
    if (field === 'trainingLocation') {
      updateAvailableClassrooms(value);
    }
  };

  // Update available classrooms when training location changes
  const updateAvailableClassrooms = (selectedLocation) => {
    console.log('🏫 Updating classrooms for location:', selectedLocation);
    console.log('🏫 Current sessions structure:', currentSessions);
    
    if (!currentSessions || !selectedLocation) {
      console.log('🏫 No current sessions or location, using fallback');
      setAvailableClassrooms(['Classroom 1']); // Default fallback
      setFormData(prev => ({ ...prev, classroom: 'Classroom 1' }));
      return;
    }

    // Extract classrooms for the selected location from current sessions
    const classroomsSet = new Set();
    
    // Debug: Show the structure we're working with
    Object.entries(currentSessions).forEach(([functionalArea, trainingLocations]) => {
      console.log(`🏫 Functional Area: ${functionalArea}`, Object.keys(trainingLocations || {}));
      
      // Check both exact match and compound key match (backward compatibility)
      Object.entries(trainingLocations || {}).forEach(([locationKey, classrooms]) => {
        console.log(`🏫 Checking location key: "${locationKey}" against "${selectedLocation}"`);
        
        // Handle both compound keys (legacy) and clean keys (new format)
        const locationPart = locationKey.includes('|') ? locationKey.split('|')[0] : locationKey;
        const isMatch = locationKey === selectedLocation || locationPart === selectedLocation;
        
        console.log(`🏫 Location part: "${locationPart}", isMatch: ${isMatch}`);
        
        if (isMatch && classrooms) {
          console.log(`🏫 Found matching location "${locationKey}" in "${functionalArea}":`, Object.keys(classrooms));
          Object.keys(classrooms).forEach(classroom => {
            console.log(`🏫 Adding classroom: ${classroom}`);
            classroomsSet.add(classroom);
          });
        }
      });
    });

    const classroomsList = Array.from(classroomsSet).sort();
    console.log('🏫 Final classrooms list:', classroomsList);
    
    // Add "New Classroom" option and fallback
    if (classroomsList.length === 0) {
      console.log('🏫 No classrooms found, adding fallback');
      classroomsList.push('Classroom 1');
    }
    classroomsList.push('+ New Classroom');

    setAvailableClassrooms(classroomsList);
    
    // Set default classroom
    if (classroomsList.length > 0) {
      setFormData(prev => ({ ...prev, classroom: classroomsList[0] }));
    }
  };

  // Handle course selection
  const handleCourseSelect = (courseId) => {
    const course = courses.find(c => c.course_id === courseId);
    setSelectedCourse(course);

    // Calculate next available session number for this course
    const nextNumber = calculateNextSessionNumber(courseId);
    setNextSessionNumber(nextNumber);

    console.log('📋 Selected course:', course);
    console.log('📋 Next session number will be:', nextNumber);
  };

  // Generate sessions for the selected course
  const generateCourseSessions = () => {
    if (!selectedCourse || !formData.trainingLocation || !formData.classroom) {
      throw new Error('Please select a course, training location, and classroom');
    }

    // Extract AM/PM time blocks from schedule criteria (defaults match TSC Wizard)
    const parsedCriteria = typeof schedule.criteria === 'string'
      ? JSON.parse(schedule.criteria)
      : (schedule.criteria || {});

    const amStartHour = parsedCriteria.am_start_hour || 9;
    const amStartMin = parsedCriteria.am_start_min || 30;
    const amEndHour = parsedCriteria.am_end_hour || 12;
    const amEndMin = parsedCriteria.am_end_min || 30;
    const pmStartHour = parsedCriteria.pm_start_hour || 13;
    const pmStartMin = parsedCriteria.pm_start_min || 30;
    const pmEndHour = parsedCriteria.pm_end_hour || 16;
    const pmEndMin = parsedCriteria.pm_end_min || 30;

    const amBlockHours = (amEndHour + amEndMin / 60) - (amStartHour + amStartMin / 60);
    const pmBlockHours = (pmEndHour + pmEndMin / 60) - (pmStartHour + pmStartMin / 60);

    const sessions = [];
    const courseDurationHours = selectedCourse.duration_hrs || 2;

    console.log('🕐 Time blocks:', {
      amBlock: `${amStartHour}:${amStartMin.toString().padStart(2, '0')} - ${amEndHour}:${amEndMin.toString().padStart(2, '0')} (${amBlockHours}hrs)`,
      pmBlock: `${pmStartHour}:${pmStartMin.toString().padStart(2, '0')} - ${pmEndHour}:${pmEndMin.toString().padStart(2, '0')} (${pmBlockHours}hrs)`,
      courseDuration: `${courseDurationHours}hrs`
    });

    // Find the correct functional area and compound location key to use
    let targetFunctionalArea = null;
    let targetLocationKey = null;
    
    console.log('🔍 DEBUG: Looking for existing structure to match');
    console.log('🔍 DEBUG: Target location:', formData.trainingLocation);
    console.log('🔍 DEBUG: Target classroom:', formData.classroom);
    
    // Find existing functional area and location key that matches our selection
    if (currentSessions && typeof currentSessions === 'object') {
      for (const [functionalArea, trainingLocations] of Object.entries(currentSessions)) {
        console.log(`🔍 DEBUG: Checking functional area "${functionalArea}"`);
        
        for (const [locationKey, classrooms] of Object.entries(trainingLocations || {})) {
          // Handle both compound keys (legacy) and clean keys (new format)
          const locationPart = locationKey.includes('|') ? locationKey.split('|')[0] : locationKey;
          console.log(`🔍 DEBUG: Checking location key "${locationKey}" (clean part: "${locationPart}")`);
          
          if (locationPart === formData.trainingLocation && classrooms[formData.classroom]) {
            targetFunctionalArea = functionalArea;
            targetLocationKey = locationPart; // Use clean location key, not compound
            console.log(`🎯 Found existing structure: ${functionalArea} -> ${locationPart} -> ${formData.classroom}`);
            break;
          }
        }
        if (targetFunctionalArea) break;
      }
    }
    
    // Use existing structure or create new one
    if (!targetFunctionalArea) {
      targetFunctionalArea = selectedCourse.functional_area || 'General';
      targetLocationKey = formData.trainingLocation; // Use clean training location, not compound key
      console.log(`📋 Creating new structure: ${targetFunctionalArea} -> ${targetLocationKey}`);
    } else {
      console.log(`♻️ Using existing structure: ${targetFunctionalArea} -> ${targetLocationKey}`);
    }

    // Determine target classroom
    let targetClassroom = formData.classroom;
    if (targetClassroom === '+ New Classroom') {
      // Find next available classroom number
      const existingNumbers = availableClassrooms
        .filter(c => c.match(/^Classroom \d+$/))
        .map(c => parseInt(c.replace('Classroom ', '')))
        .sort((a, b) => a - b);
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      targetClassroom = `Classroom ${nextNumber}`;
    }

    // Start from the next available session number for this course
    const startingSessionNumber = nextSessionNumber;

    for (let i = 0; i < formData.numberOfGroups; i++) {
      const groupNum = startingSessionNumber + i;

      // Calculate base session start date based on spacing between groups
      let currentDate = new Date(`${formData.startDate}T00:00:00`);
      if (formData.sessionSpacing === 'daily') {
        currentDate.setDate(currentDate.getDate() + i);
      } else if (formData.sessionSpacing === 'weekly') {
        currentDate.setDate(currentDate.getDate() + (i * 7));
      }

      // Use user-selected start time or default to AM start
      const userStartTime = formData.startTime.split(':');
      const userStartHour = parseInt(userStartTime[0]);
      const userStartMin = parseInt(userStartTime[1]);
      currentDate.setHours(userStartHour, userStartMin, 0, 0);

      // Handle multi-day course splitting based on AM/PM blocks (following TSC Wizard logic)
      if (courseDurationHours <= amBlockHours) {
        // Single AM session
        const sessionStart = new Date(currentDate);
        sessionStart.setHours(amStartHour, amStartMin, 0, 0);
        const sessionEnd = new Date(sessionStart);
        sessionEnd.setTime(sessionEnd.getTime() + (courseDurationHours * 60 * 60 * 1000));

        const sessionTitle = `${selectedCourse.course_name} - Group ${groupNum}`;

        sessions.push(createSessionObject(
          sessionTitle, sessionStart, sessionEnd, groupNum, 1, 1,
          courseDurationHours, targetFunctionalArea, targetLocationKey, targetClassroom
        ));

      } else if (courseDurationHours <= pmBlockHours) {
        // Single PM session
        const sessionStart = new Date(currentDate);
        sessionStart.setHours(pmStartHour, pmStartMin, 0, 0);
        const sessionEnd = new Date(sessionStart);
        sessionEnd.setTime(sessionEnd.getTime() + (courseDurationHours * 60 * 60 * 1000));

        const sessionTitle = `${selectedCourse.course_name} - Group ${groupNum}`;

        sessions.push(createSessionObject(
          sessionTitle, sessionStart, sessionEnd, groupNum, 1, 1,
          courseDurationHours, targetFunctionalArea, targetLocationKey, targetClassroom
        ));

      } else if (courseDurationHours <= (amBlockHours + pmBlockHours)) {
        // Split across AM and PM on same day
        const amDuration = amBlockHours;
        const pmDuration = courseDurationHours - amBlockHours;

        // AM Part 1
        const amStart = new Date(currentDate);
        amStart.setHours(amStartHour, amStartMin, 0, 0);
        const amEnd = new Date(amStart);
        amEnd.setHours(amEndHour, amEndMin, 0, 0);

        sessions.push(createSessionObject(
          `${selectedCourse.course_name} - Group ${groupNum} (Part 1)`,
          amStart, amEnd, groupNum, 1, 2,
          amDuration, targetFunctionalArea, targetLocationKey, targetClassroom
        ));

        // PM Part 2
        const pmStart = new Date(currentDate);
        pmStart.setHours(pmStartHour, pmStartMin, 0, 0);
        const pmEnd = new Date(pmStart);
        pmEnd.setTime(pmEnd.getTime() + (pmDuration * 60 * 60 * 1000));

        sessions.push(createSessionObject(
          `${selectedCourse.course_name} - Group ${groupNum} (Part 2)`,
          pmStart, pmEnd, groupNum, 2, 2,
          pmDuration, targetFunctionalArea, targetLocationKey, targetClassroom
        ));

      } else {
        // Multi-day course: split into multiple AM/PM sessions
        let remainingDuration = courseDurationHours;
        let partNumber = 1;
        let dayOffset = 0;

        while (remainingDuration > 0) {
          const sessionDate = new Date(currentDate);
          sessionDate.setDate(currentDate.getDate() + dayOffset);

          // Determine if this part fits in AM or PM block
          const partDuration = Math.min(remainingDuration, amBlockHours + pmBlockHours);

          if (partDuration <= amBlockHours) {
            // Fits in AM block
            const partStart = new Date(sessionDate);
            partStart.setHours(amStartHour, amStartMin, 0, 0);
            const partEnd = new Date(partStart);
            partEnd.setTime(partEnd.getTime() + (partDuration * 60 * 60 * 1000));

            sessions.push(createSessionObject(
              `${selectedCourse.course_name} - Group ${groupNum} (Part ${partNumber})`,
              partStart, partEnd, groupNum, partNumber, Math.ceil(courseDurationHours / (amBlockHours + pmBlockHours) * 2),
              partDuration, targetFunctionalArea, targetLocationKey, targetClassroom
            ));

            remainingDuration -= partDuration;
            partNumber++;
            dayOffset++;

          } else if (partDuration <= pmBlockHours) {
            // Fits in PM block
            const partStart = new Date(sessionDate);
            partStart.setHours(pmStartHour, pmStartMin, 0, 0);
            const partEnd = new Date(partStart);
            partEnd.setTime(partEnd.getTime() + (partDuration * 60 * 60 * 1000));

            sessions.push(createSessionObject(
              `${selectedCourse.course_name} - Group ${groupNum} (Part ${partNumber})`,
              partStart, partEnd, groupNum, partNumber, Math.ceil(courseDurationHours / (amBlockHours + pmBlockHours) * 2),
              partDuration, targetFunctionalArea, targetLocationKey, targetClassroom
            ));

            remainingDuration -= partDuration;
            partNumber++;
            dayOffset++;

          } else {
            // Needs both AM and PM blocks on same day
            const amDuration = amBlockHours;
            const pmDuration = Math.min(remainingDuration - amBlockHours, pmBlockHours);

            // AM part
            const amStart = new Date(sessionDate);
            amStart.setHours(amStartHour, amStartMin, 0, 0);
            const amEnd = new Date(amStart);
            amEnd.setHours(amEndHour, amEndMin, 0, 0);

            sessions.push(createSessionObject(
              `${selectedCourse.course_name} - Group ${groupNum} (Part ${partNumber})`,
              amStart, amEnd, groupNum, partNumber, Math.ceil(courseDurationHours / (amBlockHours + pmBlockHours) * 2),
              amDuration, targetFunctionalArea, targetLocationKey, targetClassroom
            ));

            remainingDuration -= amDuration;
            partNumber++;

            // PM part
            const pmStart = new Date(sessionDate);
            pmStart.setHours(pmStartHour, pmStartMin, 0, 0);
            const pmEnd = new Date(pmStart);
            pmEnd.setTime(pmEnd.getTime() + (pmDuration * 60 * 60 * 1000));

            sessions.push(createSessionObject(
              `${selectedCourse.course_name} - Group ${groupNum} (Part ${partNumber})`,
              pmStart, pmEnd, groupNum, partNumber, Math.ceil(courseDurationHours / (amBlockHours + pmBlockHours) * 2),
              pmDuration, targetFunctionalArea, targetLocationKey, targetClassroom
            ));

            remainingDuration -= pmDuration;
            partNumber++;
            dayOffset++;
          }
        }
      }
    }

    // Helper function to create session object
    function createSessionObject(sessionTitle, sessionStart, sessionEnd, groupNum, partNum, totalParts, duration, functionalArea, locationKey, classroom) {
      // Extract classroom number from classroom string (e.g., "Classroom 1" -> 1)
      const classroomNumberMatch = classroom.match(/\d+/);
      const classroomNumber = classroomNumberMatch ? parseInt(classroomNumberMatch[0]) : 1;

      const newSession = {
        course_id: selectedCourse.course_id,
        course_name: selectedCourse.course_name,
        session_number: groupNum,
        sessionNumber: groupNum,
        session_part_number: partNum,
        sessionPartNumber: partNum,
        group_type: [],
        groupType: [],
        group_name: `${locationKey} - ${classroom}`,
        groupName: `${locationKey} - ${classroom}`,
        start: toLocalDateTime(sessionStart),
        end: toLocalDateTime(sessionEnd),
        duration: duration,
        functional_area: functionalArea,
        functionalArea: functionalArea,
        location: formData.trainingLocation,
        classroom: classroom,
        classroomNumber: classroomNumber,
        title: sessionTitle,
        custom_title: '',
        trainer_id: null,
        trainer_name: '',
        color: '#007bff',
        text_color: '#ffffff',
        background_color: '#007bff20',
        notes: `Added via Add Course functionality - Part ${partNum} of ${totalParts}`,
        max_participants: formData.maxParticipants,
        max_attendees: formData.maxParticipants,
        current_participants: 0,
        event_id: null,
        totalParts: totalParts,
        total_parts: totalParts,
        partNumber: partNum,
        isMultiDay: totalParts > 1,
        is_multi_day_course: totalParts > 1,
        course_day_sequence: partNum,
        course: {
          course_id: selectedCourse.course_id,
          course_name: selectedCourse.course_name,
          duration_hrs: selectedCourse.duration_hrs
        }
      };

      // Generate stable session_identifier using the same function as TSC Wizard
      newSession.session_identifier = generateStableSessionId(newSession);
      newSession.group_identifier = `${selectedCourse.course_id}-group-${groupNum}`;
      newSession.event_id = generateEventIdFromSession(newSession);

      return newSession;
    }

    return sessions;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      
      // Validate form
      if (!selectedCourse) {
        throw new Error('Please select a course');
      }
      if (!formData.trainingLocation) {
        throw new Error('Please select a training location');
      }
      if (!formData.startDate) {
        throw new Error('Please select a start date');
      }

      // Generate new sessions
      const newSessions = generateCourseSessions();
      console.log('🆕 Generated sessions:', newSessions);

      // Call parent callback to add sessions to schedule
      onCourseAdded(newSessions);
      
      // Reset form and close modal
      setSelectedCourse(null);
      setFormData({
        trainingLocation: '',
        numberOfGroups: 1,
        startDate: '',
        startTime: '09:00',
        sessionSpacing: 'daily',
        maxParticipants: 10
      });
      onClose();

    } catch (err) {
      console.error('❌ Error adding course:', err);
      setError(err.message);
    }
  };

  // trainingLocations is now managed by useState and set in the useEffect

  if (!isOpen) return null;

  const multiDay = selectedCourse ? multiDayNote(selectedCourse.duration_hrs, schedule.criteria) : null;
  const groupWord = `group${formData.numberOfGroups !== 1 ? 's' : ''}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add Course to Schedule</DialogTitle>
            <DialogDescription>Create sessions for one more course in this schedule.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-5">
            {loading && <p className="text-sm text-muted-foreground" role="status">Loading available courses...</p>}

            {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}

            {!loading && courses.length === 0 && (
              <div className="rounded-md bg-muted px-3 py-3 text-sm">
                <p className="font-medium">No courses available to add.</p>
                <p className="mt-1 text-muted-foreground">No courses were found in the training data for this project. Please make sure your training data has been imported.</p>
              </div>
            )}

            {!loading && courses.length > 0 && (
              <>
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-sm font-semibold">Course selection</legend>
                  <FormField label="Select Course">
                    {(props) => (
                      <Select value={selectedCourse?.course_id || NONE} onValueChange={(value) => value !== NONE && handleCourseSelect(value)}>
                        <SelectTrigger {...props}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>-- Select a Course --</SelectItem>
                          {courses.map((course) => (
                            <SelectItem key={course.course_id} value={course.course_id}>{course.course_name} ({course.functional_area} - {course.duration_hrs}hrs)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>

                  {selectedCourse && (
                    <div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2 text-sm">
                      <p><strong>Name:</strong> {selectedCourse.course_name}</p>
                      <p><strong>Functional Area:</strong> {selectedCourse.functional_area}</p>
                      <p><strong>Duration:</strong> {selectedCourse.duration_hrs} hours</p>
                      {multiDay && <p><strong>Multi-day:</strong> {multiDay}</p>}
                      {selectedCourse.application && <p><strong>Application:</strong> {selectedCourse.application}</p>}
                      <p className="mt-1 rounded bg-primary-soft px-2 py-1 text-primary-soft-foreground">
                        <strong>Next Group Number:</strong> Group {nextSessionNumber}
                        {formData.numberOfGroups > 1 && ` - ${nextSessionNumber + formData.numberOfGroups - 1}`}
                      </p>
                    </div>
                  )}
                </fieldset>

                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-sm font-semibold">Session configuration</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label="Training Location">
                      {(props) => (
                        <Select value={formData.trainingLocation || NONE} onValueChange={(value) => handleFormChange('trainingLocation', value === NONE ? '' : value)}>
                          <SelectTrigger {...props}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>-- Select Location --</SelectItem>
                            {trainingLocations.map((location) => <SelectItem key={location} value={location}>{location}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField label="Classroom">
                      {(props) => (
                        <Select value={formData.classroom || NONE} onValueChange={(value) => handleFormChange('classroom', value === NONE ? '' : value)} disabled={!formData.trainingLocation}>
                          <SelectTrigger {...props}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>-- Select Classroom --</SelectItem>
                            {availableClassrooms.map((classroom) => <SelectItem key={classroom} value={classroom}>{classroom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField label="Number of Groups">
                      <Input type="number" min="1" max="10" value={formData.numberOfGroups} onChange={(event) => handleFormChange('numberOfGroups', parseInt(event.target.value))} required />
                    </FormField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Start Date"><Input type="date" value={formData.startDate} onChange={(event) => handleFormChange('startDate', event.target.value)} required /></FormField>
                    <FormField label="Start Time"><Input type="time" value={formData.startTime} onChange={(event) => handleFormChange('startTime', event.target.value)} required /></FormField>
                    <FormField label="Session Spacing">
                      {(props) => (
                        <Select value={formData.sessionSpacing} onValueChange={(value) => handleFormChange('sessionSpacing', value)}>
                          <SelectTrigger {...props}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily (consecutive days)</SelectItem>
                            <SelectItem value="weekly">Weekly (same day each week)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField label="Max Participants">
                      <Input type="number" min="1" max="50" value={formData.maxParticipants} onChange={(event) => handleFormChange('maxParticipants', parseInt(event.target.value))} required />
                    </FormField>
                  </div>
                </fieldset>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Cancel</Button>
            {!loading && courses.length > 0 && (
              <Button type="submit" variant="default" disabled={!selectedCourse}>Add Course ({formData.numberOfGroups} {groupWord})</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCourseToScheduleModal;
