import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import 'react-pivottable/pivottable.css';
import './PivotReport.css';

const PivotReport = () => {
  const [data, setData] = useState([]);
  const [pivotState, setPivotState] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all required data
        const { data: users } = await supabase
          .from('end_users')
          .select('*');

        const { data: roles } = await supabase
          .from('project_roles_tbl')
          .select('*');

        const { data: mappings } = await supabase
          .from('role_course_mappings')
          .select('*');

        const { data: courses } = await supabase
          .from('courses_tbl')
          .select('*');

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
  }, []);

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