import { useState, useEffect, useRef } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './CoursesForm.css';

// Excel-style dropdown filter component with checkboxes
const ExcelStyleFilter = ({ columnName, uniqueValues, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position when opening
  const handleToggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 200)
      });
    }
    setIsOpen(!isOpen);
  };

  // Filter values based on search term
  const filteredValues = uniqueValues.filter(value =>
    String(value || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle individual checkbox change
  const handleCheckboxChange = (value, checked) => {
    let newSelectedValues;
    if (checked) {
      newSelectedValues = [...selectedValues, value];
    } else {
      newSelectedValues = selectedValues.filter(v => v !== value);
    }
    onChange(newSelectedValues);
  };

  // Handle "Select All" functionality
  const handleSelectAll = (checked) => {
    if (checked) {
      const allValues = [...new Set([...selectedValues, '__BLANK__', '__NOT_BLANK__', ...filteredValues])];
      onChange(allValues);
    } else {
      const newSelectedValues = selectedValues.filter(value =>
        !filteredValues.includes(value) && value !== '__BLANK__' && value !== '__NOT_BLANK__'
      );
      onChange(newSelectedValues);
    }
  };

  // Check if all visible items are selected
  const allVisibleSelected = filteredValues.length > 0 &&
    filteredValues.every(value => selectedValues.includes(value)) &&
    selectedValues.includes('__BLANK__') &&
    selectedValues.includes('__NOT_BLANK__');

  const selectedCount = selectedValues.length;
  const displayText = selectedCount === 0 ? 'All' :
                     selectedCount === 1 ? selectedValues[0] === '__BLANK__' ? '(blank)' :
                                         selectedValues[0] === '__NOT_BLANK__' ? '(not blank)' :
                                         selectedValues[0] :
                     `${selectedCount} selected`;

  return (
    <div className="excel-filter-container" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`excel-filter-button ${selectedCount > 0 ? 'has-selection' : ''}`}
        onClick={handleToggleDropdown}
        title={selectedCount > 0 ? `${selectedCount} filter(s) applied` : 'Click to filter'}
      >
        <span className="filter-text">{displayText}</span>
        <span className="filter-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          className="excel-filter-dropdown"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
        >
          <div className="filter-search">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-search-input"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="filter-options">
            <div className="filter-option select-all">
              <label>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                <span className="checkmark"></span>
                Select All
              </label>
            </div>

            <div className="filter-divider"></div>

            {/* Special options */}
            <div className="filter-option">
              <label>
                <input
                  type="checkbox"
                  checked={selectedValues.includes('__BLANK__')}
                  onChange={(e) => handleCheckboxChange('__BLANK__', e.target.checked)}
                />
                <span className="checkmark"></span>
                <span className="special-option">(blank)</span>
              </label>
            </div>

            <div className="filter-option">
              <label>
                <input
                  type="checkbox"
                  checked={selectedValues.includes('__NOT_BLANK__')}
                  onChange={(e) => handleCheckboxChange('__NOT_BLANK__', e.target.checked)}
                />
                <span className="checkmark"></span>
                <span className="special-option">(not blank)</span>
              </label>
            </div>

            {filteredValues.length > 0 && <div className="filter-divider"></div>}

            {/* Regular values */}
            <div className="filter-values-container">
              {filteredValues.length === 0 ? (
                <div className="filter-option">
                  <div style={{padding: '6px 12px', fontStyle: 'italic', color: '#6c757d'}}>
                    {uniqueValues.length === 0 ? 'Loading values...' : 'No values found'}
                  </div>
                </div>
              ) : (
                filteredValues.map(value => (
                  <div key={value} className="filter-option">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedValues.includes(value)}
                        onChange={(e) => handleCheckboxChange(value, e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      <span className="filter-value" title={value}>{value}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="filter-actions">
            <button
              type="button"
              className="filter-action-btn clear-btn"
              onClick={() => {
                onChange([]);
                setIsOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="filter-action-btn apply-btn"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CoursesForm = () => {
  const { currentProject } = useProject();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('tablesDensity') || 'normal';
  });
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  const [uniqueValues, setUniqueValues] = useState({});

  // Filter courses based on search term and column filters
  const filteredCourses = courses.filter(course => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        course.course_id.toLowerCase().includes(searchLower) ||
        (course.course_name && course.course_name.toLowerCase().includes(searchLower)) ||
        course.functional_area.toLowerCase().includes(searchLower) ||
        course.duration_hrs.toString().includes(searchLower) ||
        (course.application && course.application.toLowerCase().includes(searchLower)) ||
        (course.priority && course.priority.toString().includes(searchLower))
      );
      if (!matchesSearch) return false;
    }

    // Column filters (multi-select)
    for (const [columnName, filterValues] of Object.entries(columnFilters)) {
      if (filterValues && filterValues.length > 0) {
        const courseValue = String(course[columnName] || '');

        const matchesAnyFilter = filterValues.some(filterValue => {
          if (filterValue === '__BLANK__') {
            return courseValue.trim() === '';
          } else if (filterValue === '__NOT_BLANK__') {
            return courseValue.trim() !== '';
          } else {
            return courseValue === filterValue;
          }
        });

        if (!matchesAnyFilter) {
          return false;
        }
      }
    }

    return true;
  });

  // Fetch courses and functional areas from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentProject) {
          setCourses([]);
          setFunctionalAreas([]);
          setLoading(false);
          return;
        }

        console.log('CoursesForm: Loading courses for project:', currentProject.name);

        // Fetch courses filtered by project_id
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('course_id', { ascending: true });

        if (coursesError) throw coursesError;
        setCourses(coursesData);

        // Fetch functional areas from reference table
        const { data: areasData, error: areasError } = await supabase
          .from('functional_areas')
          .select('name')
          .eq('project_id', currentProject.id)
          .eq('active', true)
          .order('display_order');
        
        if (areasError) {
          console.warn('Reference table not available, using fallback');
          // Fallback: extract from existing courses if reference table doesn't exist
          const uniqueAreas = [...new Set(coursesData?.map(c => c.functional_area).filter(Boolean))];
          setFunctionalAreas(uniqueAreas.map(area => ({ name: area })));
        } else {
          setFunctionalAreas(areasData || []);
        }
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProject]);

  // Fetch unique values for column filters
  useEffect(() => {
    if (courses.length > 0) {
      const columns = ['course_id', 'course_name', 'functional_area', 'duration_hrs', 'priority', 'application'];
      const uniqueVals = {};

      columns.forEach(columnName => {
        const values = [...new Set(
          courses
            .map(course => course[columnName])
            .filter(val => val !== null && val !== undefined && val !== '')
            .map(val => String(val))
        )].sort();
        uniqueVals[columnName] = values;
      });

      setUniqueValues(uniqueVals);
    }
  }, [courses]);

  // Handle course updates
  const handleUpdate = async (courseId, updatedData) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update(updatedData)
        .eq('course_id', courseId);

      if (error) throw error;
      
      // Update local state
      setCourses(courses.map(course => 
        course.course_id === courseId ? { ...course, ...updatedData } : course
      ));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle course deletion
  const handleDelete = async (courseId) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('course_id', courseId);

      if (error) throw error;
      
      // Update local state
      setCourses(courses.filter(course => course.course_id !== courseId));
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle new course creation
  const handleCreate = async (newCourse) => {
    try {
      if (!currentProject) {
        setError('Please select a project first');
        return;
      }

      // Add project_id to the new course
      const courseWithProject = {
        ...newCourse,
        project_id: currentProject.id
      };

      const { data, error } = await supabase
        .from('courses')
        .insert([courseWithProject])
        .select();

      if (error) throw error;
      
      // Update local state
      setCourses([...courses, data[0]]);
    } catch (error) {
      setError(error.message);
    }
  };

  // Handle density change
  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('tablesDensity', newDensity);
  };

  if (loading) return (
    <div className="courses-form">
      <div className="loading-state">
        <h3>Loading courses...</h3>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="courses-form">
      <div className="error-state">
        <h3>Error loading courses</h3>
        <p>{error}</p>
      </div>
    </div>
  );

  if (!currentProject) return (
    <div className="courses-form">
      <div className="no-project-state">
        <h3>No Project Selected</h3>
        <p>Please select a project from the Projects page to manage courses.</p>
        <p>Each project has its own isolated set of courses and data.</p>
      </div>
    </div>
  );

  return (
    <div className={`courses-form ${density}`}>
      <div className="courses-form-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <h2>Courses Management</h2>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#2c3e50' }}>
              {filteredCourses.length} of {courses.length} courses
            </div>
            {Object.values(columnFilters).some(filter => filter && filter.length > 0) && (
              <div style={{ fontSize: '0.9rem', color: '#28a745', fontWeight: '500' }}>
                {Object.values(columnFilters).filter(filter => filter && filter.length > 0)
                    .reduce((total, filterArray) => total + filterArray.length, 0)} filter(s) active
              </div>
            )}
          </div>
        </div>
        {currentProject && (
          <div className="project-indicator">
            <strong>Project:</strong> {currentProject.title}
          </div>
        )}
        <p className="courses-form-description">
          Manage your training courses, including course details, duration, and functional areas. Use the Priority field to sequence the courses, the lower the number the higher the priority
        </p>
      </div>
      
      <div className="courses-controls">
        <div className="search-container">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search courses by ID, name, functional area, or priority..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="action-section">
            <div className="density-control">
              <label htmlFor="density-select">Density:</label>
              <select 
                id="density-select"
                className="density-select"
                value={density}
                onChange={(e) => handleDensityChange(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="compact">Compact</option>
                <option value="dense">Dense</option>
              </select>
            </div>
            <button 
              onClick={() => {
                const newId = prompt('Enter new course ID:');
                if (newId) {
                  handleCreate({
                    course_name: '',
                    functional_area: functionalAreas[0]?.name || '',
                    duration_hrs: 0,
                    application: '',
                    course_id: newId
                  });
                }
              }}
              className="add-course-btn"
            >
              Add New Course
            </button>
            <button 
              onClick={() => {
                Object.entries(edits).forEach(([courseId, updatedData]) => {
                  handleUpdate(courseId, updatedData);
                });
                setEdits({});
              }}
              disabled={Object.keys(edits).length === 0}
              className="add-course-btn"
              style={{ background: Object.keys(edits).length > 0 ? '#007bff' : '#6c757d' }}
            >
              Save All Changes {Object.keys(edits).length > 0 && `(${Object.keys(edits).length})`}
            </button>
          </div>
        </div>
      </div>
      
      <div className="courses-table-container">
        <table>
        <thead className="table-header">
          <tr>
            <th style={{width: '15%'}}>Course ID</th>
            <th style={{width: '20%'}}>Course Name</th>
            <th style={{width: '15%'}}>Functional Area</th>
            <th style={{width: '10%'}}>Duration (hrs)</th>
            <th style={{width: '10%'}}>Priority</th>
            <th style={{width: '15%'}}>Application</th>
            <th style={{width: '15%'}}>Actions</th>
          </tr>
          <tr className="filter-row">
            <th className="filter-cell">
              <ExcelStyleFilter
                columnName="course_id"
                uniqueValues={uniqueValues['course_id'] || []}
                selectedValues={columnFilters['course_id'] || []}
                onChange={(selectedValues) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    course_id: selectedValues
                  }));
                }}
              />
            </th>
            <th className="filter-cell">
              <ExcelStyleFilter
                columnName="course_name"
                uniqueValues={uniqueValues['course_name'] || []}
                selectedValues={columnFilters['course_name'] || []}
                onChange={(selectedValues) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    course_name: selectedValues
                  }));
                }}
              />
            </th>
            <th className="filter-cell">
              <ExcelStyleFilter
                columnName="functional_area"
                uniqueValues={uniqueValues['functional_area'] || []}
                selectedValues={columnFilters['functional_area'] || []}
                onChange={(selectedValues) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    functional_area: selectedValues
                  }));
                }}
              />
            </th>
            <th className="filter-cell">
              <ExcelStyleFilter
                columnName="duration_hrs"
                uniqueValues={uniqueValues['duration_hrs'] || []}
                selectedValues={columnFilters['duration_hrs'] || []}
                onChange={(selectedValues) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    duration_hrs: selectedValues
                  }));
                }}
              />
            </th>
            <th className="filter-cell">
              <ExcelStyleFilter
                columnName="priority"
                uniqueValues={uniqueValues['priority'] || []}
                selectedValues={columnFilters['priority'] || []}
                onChange={(selectedValues) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    priority: selectedValues
                  }));
                }}
              />
            </th>
            <th className="filter-cell">
              <ExcelStyleFilter
                columnName="application"
                uniqueValues={uniqueValues['application'] || []}
                selectedValues={columnFilters['application'] || []}
                onChange={(selectedValues) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    application: selectedValues
                  }));
                }}
              />
            </th>
            <th className="filter-cell">
              <button
                onClick={() => setColumnFilters({})}
                className="clear-filters-btn"
                title="Clear all filters"
              >
                Clear
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredCourses.map(course => (
            <tr key={course.course_id}>
              <td>
                <input
                  type="text"
                  value={edits[course.course_id]?.course_id ?? course.course_id}
                  onChange={e => setEdits(prev => ({
                    ...prev,
                    [course.course_id]: {
                      ...prev[course.course_id],
                      course_id: e.target.value
                    }
                  }))}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={edits[course.course_id]?.course_name ?? course.course_name ?? ''}
                  onChange={e => setEdits(prev => ({
                    ...prev,
                    [course.course_id]: {
                      ...prev[course.course_id],
                      course_name: e.target.value
                    }
                  }))}
                />
              </td>
              <td>
                <select
                  value={edits[course.course_id]?.functional_area ?? course.functional_area}
                  onChange={e => setEdits(prev => ({
                    ...prev,
                    [course.course_id]: {
                      ...prev[course.course_id],
                      functional_area: e.target.value
                    }
                  }))}
                >
                  <option value="">Select functional area</option>
                  {functionalAreas.map((area, index) => (
                    <option key={index} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={edits[course.course_id]?.duration_hrs ?? course.duration_hrs}
                  onChange={e => setEdits(prev => ({
                    ...prev,
                    [course.course_id]: {
                      ...prev[course.course_id],
                      duration_hrs: e.target.value
                    }
                  }))}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={edits[course.course_id]?.priority ?? course.priority ?? 1}
                  onChange={e => setEdits(prev => ({
                    ...prev,
                    [course.course_id]: {
                      ...prev[course.course_id],
                      priority: parseInt(e.target.value) || 1
                    }
                  }))}
                  title="Priority (1 = highest priority)"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={edits[course.course_id]?.application ?? course.application ?? ''}
                  onChange={e => setEdits(prev => ({
                    ...prev,
                    [course.course_id]: {
                      ...prev[course.course_id],
                      application: e.target.value
                    }
                  }))}
                />
              </td>
              <td>
                <button 
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete course ${course.course_id}?`)) {
                      handleDelete(course.course_id);
                    }
                  }}
                  className="delete-btn"
                  title="Delete course"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-footer">
        Showing {filteredCourses.length} of {courses.length} courses
        {Object.keys(edits).length > 0 && (
          <span style={{marginLeft: '20px', color: '#007bff', fontWeight: '500'}}>
            • {Object.keys(edits).length} unsaved changes
          </span>
        )}
      </div>
      </div>
    </div>
  );
};

export default CoursesForm;
