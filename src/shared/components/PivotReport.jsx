import React, { useEffect, useState } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import './PivotReport.css';

const PivotReport = () => {
  const { currentProject } = useProject();
  const [data, setData] = useState([]);
  const [pivotState, setPivotState] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!currentProject) {
          setData([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);

        // Fetch all required data filtered by project
        const { data: users } = await supabase
          .from('end_users')
          .select('*')
          .eq('project_id', currentProject.id);

        const { data: roles } = await supabase
          .from('project_roles')
          .select('*')
          .eq('project_id', currentProject.id);

        const { data: mappings } = await supabase
          .from('role_course_mappings')
          .select('*')
          .eq('project_id', currentProject.id);

        const { data: courses } = await supabase
          .from('courses')
          .select('*')
          .eq('project_id', currentProject.id);

        console.log('Fetched data:', {
          users: users?.length,
          roles: roles?.length,
          mappings: mappings?.length,
          courses: courses?.length
        });

        // Combine data using role_course_mappings as join table
        const combinedData = users.map(user => {
          const userRole = roles.find(r => r.project_role_name === user.project_role);
          const roleMappings = mappings.filter(m => m.project_role_name === user.project_role);

          const userCourses = roleMappings.map(mapping => {
            const course = courses.find(c => c.course_id === mapping.course_id);
            const cleanedData = {
              ...Object.fromEntries(
                Object.entries(user).map(([key, value]) => 
                  [key, typeof value === 'string' ? value.trim() : value]
                )
              ),
              ...Object.fromEntries(
                Object.entries(course).map(([key, value]) => 
                  [key, typeof value === 'string' ? value.trim() : value]
                )
              ),
              mapping_status: mapping.status,
              unique_key: `${user.id}-${mapping.course_id}`
            };
            return cleanedData;
          });

          return userCourses;
        }).flat();

        const uniqueData = combinedData.filter((value, index, self) =>
          index === self.findIndex((t) => (
            t.unique_key === value.unique_key
          ))
        );

        console.log('Unique data:', uniqueData.length);
        console.log('Sample data:', uniqueData.slice(0, 3));
        console.log('Available columns:', Object.keys(uniqueData[0] || {}));
        setData(uniqueData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className="pivot-container">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project from the Projects page to view pivot reports.</p>
          <p>Each project has its own isolated training data for analysis.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pivot-container error-container">
        <h2>Error Loading Report</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pivot-container loading-container">
        <h2>Loading Training Data...</h2>
        <div className="loader"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="pivot-container">
        <h2>No Training Data Available</h2>
      </div>
    );
  }

  const isValidData = data.every(item => 
    typeof item === 'object' && 
    item !== null && 
    !Array.isArray(item)
  );

  if (!isValidData) {
    return (
      <div className="pivot-container error-container">
        <h2>Data Format Error</h2>
        <p>The data structure is invalid. Please check the console for details.</p>
      </div>
    );
  }

  const groupingFields = [
    ...(pivotState.rows || []),
    ...(pivotState.cols || [])
  ];

  console.log("🧩 Grouping fields selected in Pivot:", groupingFields);

  try {
    return (
      <div className="pivot-container">
        <h2>Training Needs Pivot Report</h2>
        <div className="project-indicator">
          <strong>Project:</strong> {currentProject.title}
        </div>
        <div className="pivot-table-wrapper">
          <PivotTableUI
            data={data}
            onChange={s => setPivotState(s)}
            {...pivotState}
            aggregatorName="Count"
            vals={["id"]}
          />
        </div>
        <div className="grouping-preview">
          <strong>Grouping By:</strong> {groupingFields.join(" → ") || 'None'}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Pivot table rendering error:', error);
    return (
      <div className="pivot-container error-container">
        <h2>Rendering Error</h2>
        <p>{error.message}</p>
      </div>
    );
  }
};

export default PivotReport;