import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { generateEventIdFromSession } from '@core/utils/eventIdUtils';
import { toLocalDateTime } from '@core/utils/dateTimeUtils';
import './AddCourseToScheduleModal.css';

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

        // Get courses for the current project only
        const { data: allCourses, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('project_id', currentProject?.id)
          .order('course_name', { ascending: true });

        if (coursesError) throw coursesError;

        // Get all available functional areas and training locations 
        const { functionalAreas, trainingLocations } = await getScheduleContext();

        console.log('🆕 Add Course - Loaded all courses:', {
          totalCourses: allCourses.length,
          availableLocations: trainingLocations.length,
          availableFunctionalAreas: functionalAreas.length
        });

        // Use ALL courses - no filtering for complete freedom
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
    console.log('📋 Selected course:', course);
  };

  // Generate sessions for the selected course
  const generateCourseSessions = () => {
    if (!selectedCourse || !formData.trainingLocation || !formData.classroom) {
      throw new Error('Please select a course, training location, and classroom');
    }

    const sessions = [];
    const startDateTime = new Date(`${formData.startDate} ${formData.startTime}`);
    const courseDurationHours = selectedCourse.duration_hrs || 2;
    
    // Determine if this is a multi-day course and how many parts
    const isMultiDay = courseDurationHours > 6; // Courses longer than 6 hours are typically multi-day
    const partsPerDay = Math.ceil(courseDurationHours / 4); // 4-hour max per day
    const hoursPerPart = isMultiDay ? Math.min(4, courseDurationHours / partsPerDay) : courseDurationHours;

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

    for (let groupNum = 1; groupNum <= formData.numberOfGroups; groupNum++) {
      // Calculate base session start time based on spacing between groups
      let baseSessionStart = new Date(startDateTime);
      if (formData.sessionSpacing === 'daily') {
        baseSessionStart.setDate(startDateTime.getDate() + (groupNum - 1));
      } else if (formData.sessionSpacing === 'weekly') {
        baseSessionStart.setDate(startDateTime.getDate() + ((groupNum - 1) * 7));
      }

      // Generate sessions for each part of the course
      for (let partNum = 1; partNum <= partsPerDay; partNum++) {
        // Calculate session start time for this part
        let sessionStart = new Date(baseSessionStart);
        if (partNum > 1) {
          // Add days for subsequent parts (Part 2 = next day, etc.)
          sessionStart.setDate(baseSessionStart.getDate() + (partNum - 1));
        }

        // Calculate end time for this part
        const sessionEnd = new Date(sessionStart.getTime() + (hoursPerPart * 60 * 60 * 1000));

        // Create session title with part information if multi-day
        let sessionTitle = `${selectedCourse.course_name} - Group ${groupNum}`;
        if (isMultiDay && partsPerDay > 1) {
          sessionTitle += ` (Part ${partNum})`;
        }

        // Create session object
        const timestamp = Date.now() + (partNum * 100); // Unique timestamp per part
        const uniqueId = `${timestamp}-${groupNum}-${partNum}`;
        
        const newSession = {
          course_id: selectedCourse.course_id,
          course_name: selectedCourse.course_name,
          session_number: groupNum,
          group_type: [], // Default empty array
          group_name: `${targetLocationKey} - ${targetClassroom}`, // Clean group name format
          start: toLocalDateTime(sessionStart),
          end: toLocalDateTime(sessionEnd),
          duration: hoursPerPart,
          functional_area: targetFunctionalArea, // Use the existing functional area
          location: formData.trainingLocation,
          classroom: targetClassroom,
          title: sessionTitle,
          custom_title: '',
          trainer_id: null,
          trainer_name: '',
          color: '#007bff', // Default color
          text_color: '#ffffff',
          background_color: '#007bff20',
          notes: `Added via Add Course functionality at ${new Date().toISOString()}${isMultiDay ? ` - Multi-day course part ${partNum} of ${partsPerDay}` : ''}`,
          max_participants: formData.maxParticipants,
          current_participants: 0,
          event_id: null, // Will be generated
          _uniqueTimestamp: timestamp,
          // Multi-day course fields
          totalParts: partsPerDay,
          partNumber: partNum,
          sessionPartNumber: partNum, // For compatibility with ScheduleEditor
          isMultiDay: isMultiDay
        };

        // Generate event_id with the unique timestamp included
        newSession.event_id = generateEventIdFromSession(newSession);

        sessions.push(newSession);
      }
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

  return (
    <div className="modal-overlay">
      <div className="modal-content add-course-modal">
        <div className="modal-header">
          <h2>➕ Add Course to Schedule</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <p>🔄 Loading available courses...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
            </div>
          )}

          {!loading && courses.length === 0 && (
            <div className="empty-state">
              <p>📚 No additional courses available for this schedule.</p>
              <p><small>All courses from the courses table may already be in this schedule, or there might be no courses in the courses table.</small></p>
              <div className="debug-info" style={{marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '4px', fontSize: '12px', textAlign: 'left'}}>
                <strong>Debug Info:</strong>
                <p>• Schedule sessions: {schedule?.sessions?.length || 0}</p>
                <p>• Check browser console for detailed filtering logs</p>
              </div>
            </div>
          )}

          {!loading && courses.length > 0 && (
            <form onSubmit={handleSubmit} className="add-course-form">
              {/* Course Selection */}
              <div className="form-section">
                <h3>Course Selection</h3>
                <div className="form-group">
                  <label htmlFor="course-select">Select Course:</label>
                  <select
                    id="course-select"
                    value={selectedCourse?.course_id || ''}
                    onChange={(e) => handleCourseSelect(e.target.value)}
                    required
                  >
                    <option value="">-- Select a Course --</option>
                    {courses.map(course => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_name} ({course.functional_area} - {course.duration_hrs}hrs)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourse && (
                  <div className="course-info">
                    <h4>Course Details:</h4>
                    <div className="course-details">
                      <p><strong>Name:</strong> {selectedCourse.course_name}</p>
                      <p><strong>Functional Area:</strong> {selectedCourse.functional_area}</p>
                      <p><strong>Duration:</strong> {selectedCourse.duration_hrs} hours</p>
                      {selectedCourse.application && (
                        <p><strong>Application:</strong> {selectedCourse.application}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Session Configuration */}
              <div className="form-section">
                <h3>Session Configuration</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="training-location">Training Location:</label>
                    <select
                      id="training-location"
                      value={formData.trainingLocation}
                      onChange={(e) => handleFormChange('trainingLocation', e.target.value)}
                      required
                    >
                      <option value="">-- Select Location --</option>
                      {trainingLocations.map(location => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="classroom">Classroom:</label>
                    <select
                      id="classroom"
                      value={formData.classroom}
                      onChange={(e) => handleFormChange('classroom', e.target.value)}
                      required
                      disabled={!formData.trainingLocation}
                    >
                      <option value="">-- Select Classroom --</option>
                      {availableClassrooms.map(classroom => (
                        <option key={classroom} value={classroom}>
                          {classroom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="number-of-groups">Number of Groups:</label>
                    <input
                      type="number"
                      id="number-of-groups"
                      min="1"
                      max="10"
                      value={formData.numberOfGroups}
                      onChange={(e) => handleFormChange('numberOfGroups', parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="start-date">Start Date:</label>
                    <input
                      type="date"
                      id="start-date"
                      value={formData.startDate}
                      onChange={(e) => handleFormChange('startDate', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="start-time">Start Time:</label>
                    <input
                      type="time"
                      id="start-time"
                      value={formData.startTime}
                      onChange={(e) => handleFormChange('startTime', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="session-spacing">Session Spacing:</label>
                    <select
                      id="session-spacing"
                      value={formData.sessionSpacing}
                      onChange={(e) => handleFormChange('sessionSpacing', e.target.value)}
                    >
                      <option value="daily">Daily (consecutive days)</option>
                      <option value="weekly">Weekly (same day each week)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="max-participants">Max Participants:</label>
                    <input
                      type="number"
                      id="max-participants"
                      min="1"
                      max="50"
                      value={formData.maxParticipants}
                      onChange={(e) => handleFormChange('maxParticipants', parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <button type="button" onClick={onClose} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="add-btn" disabled={!selectedCourse}>
                  Add Course ({formData.numberOfGroups} group{formData.numberOfGroups !== 1 ? 's' : ''})
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddCourseToScheduleModal;