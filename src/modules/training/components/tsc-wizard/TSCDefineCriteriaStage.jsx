import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { calculateClassroomsNeeded, validateClassroomCapacity } from '@core/utils/classroomCalculations';

const TSCDefineCriteriaStage = ({ 
  criteria, 
  setCriteria, 
  onNextStage, 
  onPreviousStage, 
  setEndUsers, 
  setGroupingKeys
}) => {
  const { currentProject } = useProject();
  const defaultValues = {
    max_attendees: 10,
    total_weeks: 4,
    daily_hours: 8,
    days_per_week: 5,
    contingency: 1,
    start_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    scheduling_preference: 'both', // 'both', 'am_only', 'pm_only'
    scheduling_mode: 'group_complete', // 'group_complete', 'course_complete'
    start_time_am: '08:00',
    end_time_am: '12:00',
    start_time_pm: '13:00',
    end_time_pm: '17:00',
    scheduling_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    selected_functional_areas: [],
    selected_training_locations: []
  };

  // Initialize with existing criteria or defaults
  const [formValues, setFormValues] = useState({
    ...defaultValues,
    ...criteria
  });

  // Selection data state
  const [availableFunctionalAreas, setAvailableFunctionalAreas] = useState([]);
  const [availableTrainingLocations, setAvailableTrainingLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionPreview, setSelectionPreview] = useState({ users: 0, courses: 0 });
  const [classroomRequirements, setClassroomRequirements] = useState([]);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState({
    functional_areas: false,
    training_locations: false
  });
  const [showValidation, setShowValidation] = useState(false);

  // Validation function
  const validateSelections = (values = formValues) => {
    const errors = {
      functional_areas: values.selected_functional_areas.length === 0,
      training_locations: values.selected_training_locations.length === 0
    };
    setValidationErrors(errors);
    return !errors.functional_areas && !errors.training_locations;
  };

  // Fetch available functional areas and training locations
  useEffect(() => {
    const fetchSelectionData = async () => {
      try {
        setLoading(true);

        // Fetch functional areas from reference table for current project only
        const { data: areasData, error: areasError } = await supabase
          .from('functional_areas')
          .select('name')
          .eq('project_id', currentProject?.id)
          .eq('active', true)
          .order('display_order');
        
        let uniqueAreas;
        if (areasError) {
          console.warn('Reference table not available, falling back to courses extraction');
          // Fallback: Fetch distinct functional areas from courses for current project
          const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select('functional_area')
            .eq('project_id', currentProject?.id)
            .order('functional_area');
          
          if (coursesError) throw coursesError;
          uniqueAreas = [...new Set(courses.map(c => c.functional_area).filter(Boolean))];
        } else {
          uniqueAreas = areasData.map(area => area.name);
        }

        // Fetch training locations from reference table for current project only
        const { data: locationsData, error: locationsError } = await supabase
          .from('training_locations')
          .select('name')
          .eq('project_id', currentProject?.id)
          .eq('active', true)
          .order('display_order');
        
        let uniqueLocations;
        if (locationsError) {
          console.warn('Reference table not available, falling back to users extraction');
          // Fallback: Fetch distinct training locations from end users for current project
          const { data: users, error: usersError } = await supabase
            .from('end_users')
            .select('training_location')
            .eq('project_id', currentProject?.id)
            .order('training_location');
          
          if (usersError) throw usersError;
          uniqueLocations = [...new Set(users.map(u => u.training_location).filter(Boolean))];
        } else {
          uniqueLocations = locationsData.map(location => location.name);
        }

        setAvailableFunctionalAreas(uniqueAreas);
        setAvailableTrainingLocations(uniqueLocations);
        
        console.log('✅ Loaded selection data:', { 
          functionalAreas: uniqueAreas.length, 
          trainingLocations: uniqueLocations.length,
          usingReferenceTables: !areasError && !locationsError
        });

      } catch (error) {
        console.error('❌ Error fetching selection data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSelectionData();
  }, []);


  // Update formValues when criteria prop changes
  useEffect(() => {
    setFormValues(prev => ({
      ...defaultValues,
      ...criteria
    }));
  }, [criteria]);

  // Auto-save initial default values when component mounts or formValues change
  useEffect(() => {
    if (!criteria || Object.keys(criteria).length === 0) {
      console.log('📝 Auto-saving initial default criteria values:', formValues);
      setCriteria(formValues);
    }
  }, [formValues, criteria, setCriteria]); // Run when formValues or criteria change

  const handleChange = (key, value) => {
    let newValues = { ...formValues, [key]: value };
    
    // Handle scheduling preference changes
    if (key === 'scheduling_preference') {
      // Clear or set default times based on preference
      if (value === 'am_only') {
        newValues = {
          ...newValues,
          start_time_pm: '',
          end_time_pm: ''
        };
      } else if (value === 'pm_only') {
        newValues = {
          ...newValues,
          start_time_am: '',
          end_time_am: ''
        };
      } else if (value === 'both') {
        // Restore defaults if switching back to both
        if (!newValues.start_time_am || !newValues.end_time_am) {
          newValues.start_time_am = '08:00';
          newValues.end_time_am = '12:00';
        }
        if (!newValues.start_time_pm || !newValues.end_time_pm) {
          newValues.start_time_pm = '13:00';
          newValues.end_time_pm = '17:00';
        }
      }
    }
    
    setFormValues(newValues);
    // Auto-save changes to parent component
    setCriteria(newValues);
  };

  const toggleDay = (day) => {
    setFormValues(prev => {
      const current = new Set(prev.scheduling_days);
      if (current.has(day)) current.delete(day);
      else current.add(day);
      const newValues = { ...prev, scheduling_days: Array.from(current) };
      // Auto-save changes to parent component
      setCriteria(newValues);
      return newValues;
    });
  };

  // Handle functional area selection
  const handleFunctionalAreaChange = (area, checked) => {
    let newAreas;
    if (area === 'all') {
      newAreas = checked ? [...availableFunctionalAreas] : [];
    } else {
      const current = new Set(formValues.selected_functional_areas);
      if (checked) {
        current.add(area);
      } else {
        current.delete(area);
      }
      newAreas = Array.from(current);
    }
    
    const newValues = { ...formValues, selected_functional_areas: newAreas };
    setFormValues(newValues);
    setCriteria(newValues);
    updateSelectionPreview(newValues);
    
    // Validate selections in real-time if validation is already visible
    if (showValidation) {
      validateSelections(newValues);
    }
  };

  // Handle training location selection
  const handleTrainingLocationChange = (location, checked) => {
    let newLocations;
    if (location === 'all') {
      newLocations = checked ? [...availableTrainingLocations] : [];
    } else {
      const current = new Set(formValues.selected_training_locations);
      if (checked) {
        current.add(location);
      } else {
        current.delete(location);
      }
      newLocations = Array.from(current);
    }
    
    const newValues = { ...formValues, selected_training_locations: newLocations };
    setFormValues(newValues);
    setCriteria(newValues);
    updateSelectionPreview(newValues);
    
    // Validate selections in real-time if validation is already visible
    if (showValidation) {
      validateSelections(newValues);
    }
  };

  // Build filtered dataset and update preview
  const updateSelectionPreview = async (values) => {
    try {
      // If no selections made, show empty preview
      if (values.selected_functional_areas.length === 0 || values.selected_training_locations.length === 0) {
        setSelectionPreview({ users: 0, courses: 0 });
        if (setEndUsers) setEndUsers([]);
        if (setGroupingKeys) setGroupingKeys(['training_location', 'functional_area']);
        return;
      }

      // Fetch filtered data for current project
      const { data: users } = await supabase.from('end_users').select('*').eq('project_id', currentProject?.id);
      const { data: roles } = await supabase.from('project_roles').select('*').eq('project_id', currentProject?.id);
      const { data: mappings } = await supabase.from('role_course_mappings').select('*').eq('project_id', currentProject?.id);
      const { data: courses } = await supabase.from('courses').select('*').eq('project_id', currentProject?.id);

      // Filter users by selected training locations
      const filteredUsers = users.filter(user => 
        values.selected_training_locations.includes(user.training_location)
      );

      // Filter courses by selected functional areas
      const filteredCourses = courses.filter(course => 
        values.selected_functional_areas.includes(course.functional_area)
      );

      // Build user-course combinations using role mappings
      const combinedData = filteredUsers.flatMap(user => {
        const userMappings = mappings.filter(m => m.project_role_name === user.project_role);
        return userMappings.map(mapping => {
          const course = filteredCourses.find(c => c.course_id === mapping.course_id);
          if (course) {
            return {
              ...user,
              ...course,
              course_id: course.course_id,
              course_name: course.course_name,
              mapping_status: mapping.status,
              unique_key: `${user.id}-${mapping.course_id}`
            };
          }
          return null;
        }).filter(Boolean);
      });

      // Remove duplicates
      const uniqueData = combinedData.filter((item, index, self) =>
        index === self.findIndex(t => t.unique_key === item.unique_key)
      );

      // Calculate classroom requirements by training location
      const locationGrouped = {};
      uniqueData.forEach(item => {
        const key = item.training_location;
        if (!locationGrouped[key]) {
          locationGrouped[key] = {
            users: new Set(),
            totalTrainingHours: 0
          };
        }
        locationGrouped[key].users.add(item.id);
        locationGrouped[key].totalTrainingHours += Number(item.duration_hrs) || 0;
      });

      // Calculate classroom requirements for each location
      const requirements = Object.entries(locationGrouped).map(([location, data]) => {
        const classroomReq = calculateClassroomsNeeded(data.totalTrainingHours, values);
        const validation = validateClassroomCapacity(classroomReq.numberOfClassrooms);
        
        return {
          location,
          users: data.users.size,
          totalTrainingHours: data.totalTrainingHours,
          ...classroomReq,
          validation
        };
      });

      setClassroomRequirements(requirements);

      // Update preview and pass data to parent components
      setSelectionPreview({ 
        users: filteredUsers.length, 
        courses: filteredCourses.length 
      });

      if (setEndUsers) setEndUsers(uniqueData);
      if (setGroupingKeys) setGroupingKeys(['training_location', 'functional_area']);

      console.log('✅ Selection preview updated:', { 
        users: filteredUsers.length, 
        courses: filteredCourses.length,
        combinations: uniqueData.length,
        classroomRequirements: requirements
      });

    } catch (error) {
      console.error('❌ Error updating selection preview:', error);
    }
  };

  // Update preview when form values change
  useEffect(() => {
    if (!loading && availableFunctionalAreas.length > 0 && availableTrainingLocations.length > 0) {
      updateSelectionPreview(formValues);
    }
  }, [formValues.selected_functional_areas, formValues.selected_training_locations, 
      formValues.max_attendees, formValues.total_weeks, formValues.daily_hours, 
      formValues.days_per_week, formValues.contingency, loading]);

  const handleSubmit = () => {
    // Show validation and check if valid
    setShowValidation(true);
    const isValid = validateSelections();
    
    if (!isValid) {
      console.warn('⚠️ Cannot proceed: Missing required selections');
      // Scroll to top to show validation errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    console.log('✅ Validation passed, proceeding to next stage');
    setCriteria(formValues);
    onNextStage();
  };

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (loading) {
    return (
      <div>
        <h3>Stage 1: Define Training Criteria</h3>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          📊 Loading selection data...
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3>Stage 1: Define Training Criteria</h3>

      {/* Create Mode - Simple message */}
      <fieldset style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        border: '2px solid #28a745', 
        borderRadius: '8px' 
      }}>
        <legend style={{ padding: '0 10px', fontWeight: 'bold', color: '#28a745' }}>
          📋 Create New Schedule
        </legend>
        <div style={{ 
          padding: '15px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b8daff',
          borderRadius: '6px'
        }}>
          <p style={{ margin: 0, color: '#0c5460' }}>
            <strong>🆕 Creating New Schedule</strong><br/>
            Define your training criteria below, then name and save your schedule on the next screen.
          </p>
        </div>
      </fieldset>

      {/* Validation Error Summary */}
      {showValidation && (validationErrors.functional_areas || validationErrors.training_locations) && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          border: '1px solid #f5c6cb', 
          borderRadius: '8px',
          color: '#721c24'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#721c24' }}>❌ Please Complete Required Selections:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.functional_areas && <li>At least one Functional Area must be selected</li>}
            {validationErrors.training_locations && <li>At least one Training Location must be selected</li>}
          </ul>
        </div>
      )}

      {/* Scope Selection Section */}
      <fieldset style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        border: `2px solid ${showValidation && (validationErrors.functional_areas || validationErrors.training_locations) ? '#dc3545' : '#007bff'}`, 
        borderRadius: '8px' 
      }}>
        <legend style={{ 
          fontWeight: 'bold', 
          color: showValidation && (validationErrors.functional_areas || validationErrors.training_locations) ? '#dc3545' : '#007bff', 
          fontSize: '16px' 
        }}>🎯 SCOPE SELECTION (Required)</legend>
        
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#e7f3ff', 
          borderRadius: '5px',
          fontSize: '14px',
          color: '#0c5460'
        }}>
          <strong>ℹ️ Important:</strong> Both Training Location and Functional Area selections are required. 
          This ensures proper context for all training schedules and prevents assignment conflicts across locations.
        </div>
        
        {/* Functional Areas Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ 
            marginBottom: '10px', 
            color: showValidation && validationErrors.functional_areas ? '#dc3545' : '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#dc3545' }}>*</span>
            Functional Areas (from courses):
            {showValidation && validationErrors.functional_areas && (
              <span style={{ fontSize: '14px', color: '#dc3545', fontWeight: 'normal' }}>⚠️ Required</span>
            )}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={formValues.selected_functional_areas.length === availableFunctionalAreas.length}
                onChange={(e) => handleFunctionalAreaChange('all', e.target.checked)}
              />
              All Functional Areas
            </label>
            {availableFunctionalAreas.map(area => (
              <label key={area} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={formValues.selected_functional_areas.includes(area)}
                  onChange={(e) => handleFunctionalAreaChange(area, e.target.checked)}
                />
                {area}
              </label>
            ))}
          </div>
        </div>

        {/* Training Locations Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ 
            marginBottom: '10px', 
            color: showValidation && validationErrors.training_locations ? '#dc3545' : '#333',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#dc3545' }}>*</span>
            Training Locations (from users):
            {showValidation && validationErrors.training_locations && (
              <span style={{ fontSize: '14px', color: '#dc3545', fontWeight: 'normal' }}>⚠️ Required</span>
            )}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={formValues.selected_training_locations.length === availableTrainingLocations.length}
                onChange={(e) => handleTrainingLocationChange('all', e.target.checked)}
              />
              All Training Locations
            </label>
            {availableTrainingLocations.map(location => (
              <label key={location} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={formValues.selected_training_locations.includes(location)}
                  onChange={(e) => handleTrainingLocationChange(location, e.target.checked)}
                />
                {location}
              </label>
            ))}
          </div>
        </div>

        {/* Selection Preview */}
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <strong>📊 Selection Preview:</strong> {selectionPreview.users} users across {selectionPreview.courses} courses
        </div>

        {/* Classroom Requirements Preview */}
        {classroomRequirements.length > 0 && (
          <div style={{ 
            marginTop: '10px',
            padding: '15px', 
            backgroundColor: '#e7f3ff', 
            border: '1px solid #b8daff', 
            borderRadius: '5px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#004085', fontSize: '16px' }}>
              🏫 Estimated Classroom Requirements
            </h4>
            {classroomRequirements.map((req, index) => (
              <div key={index} style={{ 
                marginBottom: '8px',
                fontSize: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{req.location}:</strong> {req.users} users, {req.totalTrainingHours.toFixed(1)} training hours
                </div>
                <div style={{ 
                  fontWeight: 'bold',
                  color: req.validation.severity === 'warning' ? '#856404' : 
                         req.validation.severity === 'error' ? '#721c24' : '#155724'
                }}>
                  {req.numberOfClassrooms} {req.numberOfClassrooms === 1 ? 'classroom' : 'classrooms'}
                  {req.numberOfClassrooms > 5 && ' ⚠️'}
                </div>
              </div>
            ))}
            
            {/* Classroom Warnings */}
            {classroomRequirements.some(req => req.validation.severity === 'warning' || req.validation.severity === 'error') && (
              <div style={{ 
                marginTop: '10px',
                padding: '10px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#856404'
              }}>
                <strong>⚠️ Classroom Capacity Warnings:</strong>
                <ul style={{ margin: '5px 0 0 20px', paddingLeft: 0 }}>
                  {classroomRequirements
                    .filter(req => req.validation.severity === 'warning' || req.validation.severity === 'error')
                    .map((req, index) => (
                      <li key={index} style={{ marginBottom: '3px' }}>
                        <strong>{req.location}:</strong> {req.validation.message}
                      </li>
                    ))}
                </ul>
                <div style={{ marginTop: '8px', fontSize: '13px', fontStyle: 'italic' }}>
                  💡 <strong>Suggestions:</strong> 
                  {classroomRequirements.some(req => req.numberOfClassrooms > 5) && ' Increase training duration or reduce group sizes.'}
                  {classroomRequirements.some(req => req.numberOfClassrooms > 10) && ' Consider staggered start dates or additional training locations.'}
                </div>
              </div>
            )}

            {/* Classroom calculation explanation */}
            <div style={{ 
              marginTop: '10px',
              padding: '8px',
              backgroundColor: '#ffffff',
              border: '1px solid #d1ecf1',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#0c5460'
            }}>
              <strong>ℹ️ Calculation:</strong> Based on {formValues.max_attendees} max attendees, {formValues.total_weeks} weeks, 
              {formValues.days_per_week} days/week, {formValues.daily_hours} hours/day
              {formValues.contingency > 1 && `, with ${((formValues.contingency - 1) * 100).toFixed(0)}% contingency`}
            </div>
          </div>
        )}
      </fieldset>

      {/* Scheduling Parameters Section */}
      <fieldset style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <legend style={{ fontWeight: 'bold', color: '#333' }}>⏰ SCHEDULING PARAMETERS</legend>

        <label>
          Max Attendees:
          <input type="number" value={formValues.max_attendees} onChange={e => handleChange('max_attendees', Number(e.target.value))} />
        </label>

        <label>
          Total Weeks:
        <input type="number" value={formValues.total_weeks} onChange={e => handleChange('total_weeks', Number(e.target.value))} />
      </label>

      <label>
        Daily Hours:
        <input type="number" value={formValues.daily_hours} onChange={e => handleChange('daily_hours', Number(e.target.value))} />
      </label>

      <label>
        Days Per Week:
        <input type="number" value={formValues.days_per_week} onChange={e => handleChange('days_per_week', Number(e.target.value))} />
      </label>

      <label>
        Contingency Factor:
        <input type="number" step="0.1" value={formValues.contingency} onChange={e => handleChange('contingency', Number(e.target.value))} />
      </label>

      <label>
        Start Date:
        <input type="date" value={formValues.start_date} onChange={e => handleChange('start_date', e.target.value)} />
      </label>

      <fieldset style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <legend style={{ fontWeight: 'bold', color: '#333' }}>Scheduling Preference:</legend>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input 
              type="radio" 
              name="scheduling_preference" 
              value="both"
              checked={formValues.scheduling_preference === 'both'}
              onChange={e => handleChange('scheduling_preference', e.target.value)}
            />
            Both AM & PM Sessions
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input 
              type="radio" 
              name="scheduling_preference" 
              value="am_only"
              checked={formValues.scheduling_preference === 'am_only'}
              onChange={e => handleChange('scheduling_preference', e.target.value)}
            />
            Morning Only
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input 
              type="radio" 
              name="scheduling_preference" 
              value="pm_only"
              checked={formValues.scheduling_preference === 'pm_only'}
              onChange={e => handleChange('scheduling_preference', e.target.value)}
            />
            Afternoon Only
          </label>
        </div>
        
        {/* Helpful text */}
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
          {formValues.scheduling_preference === 'both' && "Schedule training sessions in both morning and afternoon time slots."}
          {formValues.scheduling_preference === 'am_only' && "Schedule training sessions only in the morning hours."}
          {formValues.scheduling_preference === 'pm_only' && "Schedule training sessions only in the afternoon hours."}
        </div>
      </fieldset>

      {/* Scheduling Mode */}
      <fieldset style={{ marginBottom: '20px', padding: '15px', border: '2px solid #007bff', borderRadius: '8px' }}>
        <legend style={{ fontWeight: 'bold', color: '#333' }}>Classroom Scheduling Mode:</legend>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input 
              type="radio" 
              name="scheduling_mode" 
              value="group_complete"
              checked={formValues.scheduling_mode === 'group_complete'}
              onChange={e => handleChange('scheduling_mode', e.target.value)}
            />
            Complete by Group (Independent Classrooms)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input 
              type="radio" 
              name="scheduling_mode" 
              value="course_complete"
              checked={formValues.scheduling_mode === 'course_complete'}
              onChange={e => handleChange('scheduling_mode', e.target.value)}
            />
            Complete by Course (Synchronized Classrooms)
          </label>
        </div>
        
        {/* Helpful text */}
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
          {formValues.scheduling_mode === 'group_complete' && "Each classroom operates independently. Groups complete all courses before moving to the next group. Maximum concurrency: 2 classrooms = 2 groups trained simultaneously."}
          {formValues.scheduling_mode === 'course_complete' && "All classrooms work on the same course simultaneously. Complete one course across all groups before moving to the next course. All groups progress together."}
        </div>
      </fieldset>

      {/* Morning Time - Show if preference is 'both' or 'am_only' */}
      {(formValues.scheduling_preference === 'both' || formValues.scheduling_preference === 'am_only') && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #e9ecef', 
          borderRadius: '5px' 
        }}>
          <label style={{ fontWeight: 'bold', color: '#495057' }}>Morning Time:</label>
          <div style={{ marginTop: '5px' }}>
            <input 
              type="time" 
              value={formValues.start_time_am} 
              onChange={e => handleChange('start_time_am', e.target.value)} 
              style={{ marginRight: '10px' }}
            />
            to
            <input 
              type="time" 
              value={formValues.end_time_am} 
              onChange={e => handleChange('end_time_am', e.target.value)} 
              style={{ marginLeft: '10px' }}
            />
          </div>
        </div>
      )}

      {/* Afternoon Time - Show if preference is 'both' or 'pm_only' */}
      {(formValues.scheduling_preference === 'both' || formValues.scheduling_preference === 'pm_only') && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '10px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #e9ecef', 
          borderRadius: '5px' 
        }}>
          <label style={{ fontWeight: 'bold', color: '#495057' }}>Afternoon Time:</label>
          <div style={{ marginTop: '5px' }}>
            <input 
              type="time" 
              value={formValues.start_time_pm} 
              onChange={e => handleChange('start_time_pm', e.target.value)} 
              style={{ marginRight: '10px' }}
            />
            to
            <input 
              type="time" 
              value={formValues.end_time_pm} 
              onChange={e => handleChange('end_time_pm', e.target.value)} 
              style={{ marginLeft: '10px' }}
            />
          </div>
        </div>
      )}

        <fieldset>
          <legend>Scheduling Days:</legend>
          {allDays.map(day => (
            <label key={day} style={{ marginRight: '10px' }}>
              <input
                type="checkbox"
                checked={formValues.scheduling_days.includes(day)}
                onChange={() => toggleDay(day)}
              /> {day}
            </label>
          ))}
        </fieldset>
      </fieldset>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button onClick={handleSubmit}>Next</button>
      </div>
    </div>
  );
};

export default TSCDefineCriteriaStage;
