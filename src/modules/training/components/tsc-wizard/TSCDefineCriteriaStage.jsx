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
    total_weeks: 5,
    daily_hours: 6,
    days_per_week: 5,
    contingency: 1,
    start_date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    scheduling_preference: 'both', // 'both', 'am_only', 'pm_only'
    scheduling_mode: 'group_complete', // 'group_complete', 'course_complete'
    start_time_am: '09:30',
    end_time_am: '12:30',
    start_time_pm: '13:30',
    end_time_pm: '16:30',
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
  // Re-fetch whenever project changes OR when component becomes visible (to catch new imports)
  useEffect(() => {
    const fetchSelectionData = async () => {
      try {
        setLoading(true);
        console.log('🔍 Fetching selection data for project:', currentProject?.id);

        // Distinct values come from RPCs: the API caps plain selects at 1000 rows, so
        // de-duplicating fetched rows in JS can miss values in larger projects
        const { data: functionalAreasData, error: functionalAreasError } = await supabase
          .rpc('get_distinct_functional_areas', { p_project_id: currentProject?.id });

        console.log('📊 training_data functional_area RPC result:', {
          count: functionalAreasData?.length,
          areas: functionalAreasData,
          error: functionalAreasError
        });

        if (functionalAreasError) throw functionalAreasError;
        const uniqueAreas = functionalAreasData.map(item => item.functional_area).filter(Boolean);
        console.log('📋 Unique functional areas extracted:', uniqueAreas);

        // Fetch distinct training locations using RPC call to avoid row limit issues
        // This is more efficient than fetching all rows and deduplicating in JavaScript
        const { data: trainingLocationsData, error: trainingLocationsError } = await supabase
          .rpc('get_distinct_training_locations', { p_project_id: currentProject?.id });

        console.log('📊 training_data training_location RPC result:', {
          count: trainingLocationsData?.length,
          locations: trainingLocationsData,
          error: trainingLocationsError
        });

        // If RPC function doesn't exist, fall back to fetching all rows with increased limit
        let uniqueLocations;
        if (trainingLocationsError) {
          console.warn('⚠️ RPC function not available, using fallback approach with increased row limit');
          const { data: allLocationRows, error: fallbackError } = await supabase
            .from('training_data_combined')
            .select('training_location')
            .eq('project_id', currentProject?.id)
            .limit(10000); // Increase limit to ensure we get all rows

          if (fallbackError) throw fallbackError;
          uniqueLocations = [...new Set(allLocationRows.map(u => u.training_location).filter(Boolean))];
          console.log('📋 Unique training locations extracted (fallback):', uniqueLocations);
        } else {
          // RPC returns array of objects like [{training_location: "Dubai"}, ...], extract values
          uniqueLocations = (trainingLocationsData || []).map(item => item.training_location).filter(Boolean);
          console.log('📋 Unique training locations from RPC:', uniqueLocations);
        }

        setAvailableFunctionalAreas(uniqueAreas);
        setAvailableTrainingLocations(uniqueLocations);

        console.log('✅ Loaded selection data:', {
          functionalAreas: uniqueAreas.length,
          trainingLocations: uniqueLocations.length,
          source: 'training_data (MS Access flat table)'
        });

      } catch (error) {
        console.error('❌ Error fetching selection data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentProject?.id) {
      fetchSelectionData();
    }
    // Note: We intentionally don't add dependencies here so it re-fetches every time component mounts
    // This ensures fresh data after imports
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);


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
          newValues.start_time_am = '09:30';
          newValues.end_time_am = '12:30';
        }
        if (!newValues.start_time_pm || !newValues.end_time_pm) {
          newValues.start_time_pm = '13:30';
          newValues.end_time_pm = '16:30';
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

      // Fetch training data from flat table for current project
      // CRITICAL FIX: Fetch in batches because Supabase has max page size of 1000
      console.log(`\n📥 FETCHING DATA FROM SUPABASE (with pagination)...`);
      console.log(`   Project ID: ${currentProject?.id}`);

      // First get the count
      const { count } = await supabase
        .from('training_data_combined')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', currentProject?.id);

      console.log(`   Total rows in DB: ${count}`);

      // Fetch ALL rows in batches of 1000 (Supabase max page size)
      const batchSize = 1000;
      const batches = Math.ceil(count / batchSize);
      let trainingData = [];
      let trainingError = null;

      console.log(`   Fetching ${batches} batches of ${batchSize} rows...`);

      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize - 1, count - 1);

        console.log(`   Batch ${i + 1}/${batches}: rows ${start}-${end}`);

        const { data, error } = await supabase
          .from('training_data_combined')
          .select('*')
          .eq('project_id', currentProject?.id)
          .order('id') // stable order so pages don't overlap or skip rows
          .range(start, end);

        if (error) {
          trainingError = error;
          break;
        }

        trainingData = trainingData.concat(data);
      }

      console.log(`\n🚨🚨🚨 SUPABASE RESPONSE (BATCHED):`);
      console.log(`   Rows returned: ${trainingData?.length}`);
      console.log(`   Total count in DB: ${count}`);
      console.log(`   Missing: ${count - (trainingData?.length || 0)}`);
      if (count === trainingData?.length) {
        console.log(`   ✅ SUCCESS: All rows fetched!`);
      } else {
        console.log(`   ⚠️ WARNING: Still missing ${count - trainingData?.length} rows!`);
      }
      console.log(`🚨🚨🚨\n`);

      if (trainingError) {
        console.error('Error fetching training data:', trainingError);
        return;
      }

      console.log('🔍 Debug - Training Data:', {
        totalRecords: trainingData?.length,
        sampleData: trainingData?.slice(0, 3)
      });

      // Filter by selected training locations and functional areas
      const filteredData = trainingData.filter(row =>
        values.selected_training_locations.includes(row.training_location) &&
        values.selected_functional_areas.includes(row.functional_area)
      );

      console.log('🔍 Debug - Filtered Data:', {
        totalRecords: trainingData?.length,
        filteredRecords: filteredData.length,
        selectedLocations: values.selected_training_locations,
        selectedAreas: values.selected_functional_areas
      });

      // CRITICAL DEBUG: Check General Ledger course specifically
      const glBeforeFilter = trainingData.filter(r => r.course_id === '27');
      const glAfterFilter = filteredData.filter(r => r.course_id === '27');
      console.log(`\n🚨 GENERAL LEDGER DEBUG:`);
      console.log(`   Before filter: ${glBeforeFilter.length} users with course_id='27'`);
      console.log(`   After filter: ${glAfterFilter.length} users with course_id='27'`);
      console.log(`   Missing: ${glBeforeFilter.length - glAfterFilter.length} users`);

      if (glBeforeFilter.length > glAfterFilter.length) {
        const missing = glBeforeFilter.filter(before =>
          !glAfterFilter.find(after => after.user_id === before.user_id)
        );
        console.log(`   Missing users sample:`, missing.slice(0, 3).map(u => ({
          user_id: u.user_id,
          user_name: u.user_name,
          functional_area: u.functional_area,
          training_location: u.training_location
        })));
      }

      // Transform to expected format
      const combinedData = filteredData.map(row => ({
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        training_location: row.training_location,
        project_role: row.user_project_role,
        course_id: row.course_id,
        course_name: row.course_name,
        functional_area: row.functional_area,
        duration_hrs: row.duration_hrs,
        business_unit: row.business_unit,
        organization: row.organization,
        country: row.user_country,
        department: row.user_department,
        job_title: row.user_job_title,
        location: row.user_location,
        unique_key: `${row.user_id}-${row.course_id}`
      }));

      console.log('🔍 Debug - Combined Data:', {
        combinedDataLength: combinedData.length,
        sampleRecords: combinedData.slice(0, 3)
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

      // Calculate unique users and courses from the filtered data
      const uniqueUserIds = new Set(filteredData.map(row => row.user_id));
      const uniqueCourseIds = new Set(filteredData.map(row => row.course_id));

      // Update preview and pass data to parent components
      setSelectionPreview({
        users: uniqueUserIds.size,
        courses: uniqueCourseIds.size
      });

      if (setEndUsers) setEndUsers(uniqueData);
      if (setGroupingKeys) setGroupingKeys(['training_location', 'functional_area']);

      console.log('✅ Selection preview updated:', {
        users: uniqueUserIds.size,
        courses: uniqueCourseIds.size,
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

    // Debug logging
    console.log('🔍 Validation Check - Form Values:', {
      selected_functional_areas: formValues.selected_functional_areas,
      selected_training_locations: formValues.selected_training_locations,
      functionalAreasLength: formValues.selected_functional_areas.length,
      trainingLocationsLength: formValues.selected_training_locations.length
    });

    const isValid = validateSelections();

    if (!isValid) {
      console.warn('⚠️ Cannot proceed: Missing required selections');
      console.warn('Validation Errors:', validationErrors);
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
// Force rebuild
