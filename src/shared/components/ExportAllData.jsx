import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { saveAs } from 'file-saver';

const ExportAllData = () => {
  const { currentProject } = useProject();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentProject) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 ExportAllData: Fetching courses for end users in project:', currentProject.name);
        
        // Fetch the data using separate queries and join manually
        console.log('🔍 Fetching end users...');
        const { data: endUsers, error: usersError } = await supabase
          .from('end_users')
          .select('*')
          .eq('project_id', currentProject.id)
          .order('name');

        if (usersError) throw usersError;

        console.log('🔍 Fetching project roles...');
        const { data: projectRoles, error: rolesError } = await supabase
          .from('project_roles')
          .select('*')
          .eq('project_id', currentProject.id);

        if (rolesError) throw rolesError;

        console.log('🔍 Fetching role course mappings...');
        const { data: roleMappings, error: mappingsError } = await supabase
          .from('role_course_mappings')
          .select('*')
          .eq('project_id', currentProject.id);

        if (mappingsError) throw mappingsError;

        console.log('🔍 Fetching courses...');
        const { data: courses, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('project_id', currentProject.id);

        if (coursesError) throw coursesError;

        // Create lookup maps for efficient joining
        const roleMap = new Map(projectRoles.map(role => [role.project_role_name, role]));
        const courseMap = new Map(courses.map(course => [course.course_id, course]));

        // Build the flattened data by joining manually
        const flattenedData = [];
        endUsers.forEach(user => {
          // Find role mappings for this user's project role
          const userRoleMappings = roleMappings.filter(mapping => 
            mapping.project_role_name === user.project_role
          );

          userRoleMappings.forEach(mapping => {
            const course = courseMap.get(mapping.course_id);
            if (course) {
              flattenedData.push({
                user_id: user.id,
                user_name: user.name,
                user_email: user.email,
                job_title: user.job_title,
                country: user.country,
                division: user.division,
                sub_division: user.sub_division,
                location_name: user.location_name,
                training_location: user.training_location,
                project_role: user.project_role,
                course_id: course.course_id,
                course_name: course.course_name,
                functional_area: course.functional_area,
                duration_hrs: course.duration_hrs
              });
            }
          });
        });

        console.log('✅ ExportAllData: Built', flattenedData.length, 'user-course assignments from', {
          users: endUsers.length,
          roles: projectRoles.length,
          mappings: roleMappings.length,
          courses: courses.length
        });
        
        setData(flattenedData);
      } catch (error) {
        setError(error.message);
        console.error('❌ ExportAllData: Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProject]);

  const convertToCSV = (objArray) => {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = `${Object.keys(array[0])
      .map((value) => `"${value}"`)
      .join(',')}\r\n`;

    return (
      str +
      array
        .map((obj) => {
          return Object.values(obj)
            .map((value) => `"${value}"`)
            .join(',');
        })
        .join('\r\n')
    );
  };

  const exportCSV = () => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }
    
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `${currentProject?.name || 'project'}_user_course_assignments_${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(blob, filename);
  };

  return (
    <div>
      <h1>Export User Course Assignments - {currentProject?.name || 'No Project Selected'}</h1>
      <button 
        onClick={exportCSV}
        disabled={!currentProject || data.length === 0}
      >
        Export to CSV ({data.length} assignments)
      </button>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table>
            <thead>
              <tr>
                {data.length > 0 && Object.keys(data[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index}>
                  {Object.keys(item).map((key) => (
                    <td key={key}>{item[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExportAllData;
