import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './CoursesForm.css';

const CoursesForm = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('tablesDensity') || 'normal';
  });
  const [functionalAreas, setFunctionalAreas] = useState([]);

  // Filter courses based on search term
  const filteredCourses = courses.filter(course => {
    const searchLower = searchTerm.toLowerCase();
    return (
      course.course_id.toLowerCase().includes(searchLower) ||
      (course.course_name && course.course_name.toLowerCase().includes(searchLower)) ||
      course.functional_area.toLowerCase().includes(searchLower) ||
      course.duration_hrs.toString().includes(searchLower) ||
      (course.application && course.application.toLowerCase().includes(searchLower)) ||
      (course.priority && course.priority.toString().includes(searchLower))
    );
  });

  // Fetch courses and functional areas from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch courses
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses_tbl')
          .select('*')
          .order('course_id', { ascending: true });

        if (coursesError) throw coursesError;
        setCourses(coursesData);

        // Fetch functional areas from reference table
        const { data: areasData, error: areasError } = await supabase
          .from('functional_areas_tbl')
          .select('name')
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
  }, []);

  // Handle course updates
  const handleUpdate = async (courseId, updatedData) => {
    try {
      const { error } = await supabase
        .from('courses_tbl')
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
        .from('courses_tbl')
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
      const { data, error } = await supabase
        .from('courses_tbl')
        .insert([newCourse])
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

  return (
    <div className={`courses-form ${density}`}>
      <div className="courses-form-header">
        <h2>Courses Management</h2>
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
