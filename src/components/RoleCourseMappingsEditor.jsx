import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const RoleCourseMappingsEditor = () => {
  const [roles, setRoles] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [existingMappings, setExistingMappings] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState({
    roles: false,
    courses: false,
    mappings: false
  });

  useEffect(() => {
    fetchRoles();
    fetchCourses();
  }, []);

  const fetchRoles = async () => {
    setIsLoading(prev => ({ ...prev, roles: true }));
    try {
      const { data, error } = await supabase
        .from('project_roles_tbl')
        .select('*');
        
      if (error) throw error;
      setRoles(data || []);
    } catch (err) {
      setError(`Failed to load roles: ${err.message}`);
      setRoles([]);
    } finally {
      setIsLoading(prev => ({ ...prev, roles: false }));
    }
  };

  const fetchCourses = async () => {
    setIsLoading(prev => ({ ...prev, courses: true }));
    try {
      const { data, error } = await supabase
        .from('courses_tbl')
        .select('*');
        
      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      setError(`Failed to load courses: ${err.message}`);
      setCourses([]);
    } finally {
      setIsLoading(prev => ({ ...prev, courses: false }));
    }
  };

  const fetchExistingMappings = async (roleName) => {
    setIsLoading(prev => ({ ...prev, mappings: true }));
    try {
      const { data, error } = await supabase
        .from('role_course_mappings')
        .select('course_id')
        .eq('project_role_name', roleName);
        
      if (error) throw error;
      setExistingMappings(data.map(m => m.course_id));
      setSelectedCourses(data.map(m => m.course_id));
    } catch (err) {
      setError(`Failed to load existing mappings: ${err.message}`);
      setExistingMappings([]);
    } finally {
      setIsLoading(prev => ({ ...prev, mappings: false }));
    }
  };

  const handleRoleChange = async (e) => {
    const roleName = e.target.value;
    if (!roleName) {
      setSelectedRole(null);
      setSelectedCourses([]);
      return;
    }

    setIsLoading(prev => ({ ...prev, roles: true }));
    setError(null);
    
    try {
      const role = roles.find(r => r.project_role_name === roleName);
      if (!role) throw new Error('Selected role not found');
      
      setSelectedRole(role);
      await fetchExistingMappings(roleName);
    } catch (err) {
      setError(`Error loading role data: ${err.message}`);
      setSelectedRole(null);
      setSelectedCourses([]);
    } finally {
      setIsLoading(prev => ({ ...prev, roles: false }));
    }
  };

  const handleCourseSelection = (topicId) => {
    setSelectedCourses(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
  };

  const saveChanges = async () => {
    if (!selectedRole) return;
    
    setIsLoading(prev => ({ ...prev, mappings: true }));
    setError(null);
    
    try {
      // Get added and removed courses
      const added = selectedCourses.filter(id => !existingMappings.includes(id));
      const removed = existingMappings.filter(id => !selectedCourses.includes(id));

      // Add new mappings
      if (added.length > 0) {
        const { error: insertError } = await supabase
          .from('role_course_mappings')
          .insert(added.map(topicId => ({
            project_role_name: selectedRole.project_role_name,
            course_id: topicId
          })));
          
        if (insertError) throw insertError;
      }

      // Remove deleted mappings
      if (removed.length > 0) {
        const { error: deleteError } = await supabase
          .from('role_course_mappings')
          .delete()
          .eq('project_role_name', selectedRole.project_role_name)
          .in('course_id', removed);
          
        if (deleteError) throw deleteError;
      }

      alert('Changes saved successfully!');
      setExistingMappings(selectedCourses);
    } catch (err) {
      setError(`Error saving changes: ${err.message}`);
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, mappings: false }));
    }
  };

  const cancelChanges = () => {
    setSelectedCourses(existingMappings);
  };

  return (
    <div className="container">
      <h2>Edit Role Course Mappings</h2>
      
      <div className="role-selection">
        <label>Select Project Role:</label>
        <select onChange={handleRoleChange}>
          <option value="">Select a role</option>
          {roles.map((role, index) => (
            <option key={`role-${role.project_role_name}-${index}`} value={role.project_role_name}>
              {role.project_role_name}
            </option>
          ))}
        </select>
        {error && <div className="error-message">{error}</div>}
      </div>

      {selectedRole && (
        <div className="course-selection">
          <h4>Edit Courses for {selectedRole.project_role_name}</h4>
          <table className="course-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Functional Area</th>
                <th>Course ID</th>
                <th>Course Name</th>
                <th>Duration (Hrs)</th>
                <th>Application</th>
              </tr>
            </thead>
            <tbody>
              {isLoading.courses ? (
                <tr>
                  <td colSpan="6" className="loading-courses">Loading courses...</td>
                </tr>
              ) : courses.length > 0 ? (
                courses
                  .sort((a, b) => (a.course_id || '').localeCompare(b.course_id || '', undefined, { numeric: true }))
                  .map((course, index) => (
                    <tr key={`course-${course.course_id}-${index}`} className="course-item">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(course.course_id)}
                          onChange={() => handleCourseSelection(course.course_id)}
                          disabled={isLoading.mappings}
                        />
                      </td>
                      <td>{course.functional_area}</td>
                      <td>{course.course_id}</td>
                      <td>{course.course_name}</td>
                      <td>{course.duration_hrs}</td>
                      <td>{course.application}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="6" className="no-courses">
                    No courses available for this role
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="action-buttons">
            <button 
              className="save-button"
              onClick={saveChanges}
              disabled={!selectedRole || isLoading.mappings}
            >
              {isLoading.mappings ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              className="cancel-button"
              onClick={cancelChanges}
              disabled={!selectedRole || isLoading.mappings}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleCourseMappingsEditor;
