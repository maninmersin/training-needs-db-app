import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import PivotTableUI from 'react-pivottable/PivotTableUI';
import TableRenderers from 'react-pivottable/TableRenderers';
import * as PivotUtilities from 'react-pivottable/Utilities';
import 'react-pivottable/pivottable.css';
import './PivotReport.css';

const { aggregators } = PivotUtilities;

const TSCPivotGroupStage = ({ setFilteredData, setGroupingKeys, pivotState, setPivotState, onNextStage, setEndUsers }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: users } = await supabase.from('end_users').select('*');
        const { data: roles } = await supabase.from('project_roles_tbl').select('*');
        const { data: mappings } = await supabase.from('role_course_mappings').select('*');
        const { data: courses } = await supabase.from('courses_tbl').select('*');

        const combinedData = users.flatMap(user => {
          const userMappings = mappings.filter(m => m.project_role_name === user.project_role);
          return userMappings.map(mapping => {
            const course = courses.find(c => c.course_id === mapping.course_id);
            return {
              ...user,
              ...course,
              course_id: course?.course_id,
              course_name: course?.course_name,
              mapping_status: mapping.status,
              unique_key: `${user.id}-${mapping.course_id}`
            };
          });
        });

        const uniqueData = combinedData.filter((item, index, self) =>
          index === self.findIndex(t => t.unique_key === item.unique_key)
        );

        setData(uniqueData);
        setFilteredData(uniqueData);
        setEndUsers(uniqueData);
      } catch (error) {
        console.error('❌ Pivot stage error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [setFilteredData, setEndUsers]);

  const [localPivotState, setLocalPivotState] = useState({
    rows: [],
    cols: [],
    aggregatorName: 'Count',
    vals: ['id'],
    rendererName: 'Table'
  });

  const groupingFields = [
    ...(localPivotState.rows || []),
    ...(localPivotState.cols || [])
  ];

  const handleContinue = () => {
    if (data.length > 0 && groupingFields.length > 0) {
      setGroupingKeys(groupingFields);
      onNextStage();
    } else {
      alert('Please select at least one grouping field.');
    }
  };

  console.log('✅ Grouping keys set:', groupingFields);

  if (loading) return <div className="pivot-container">Loading pivot data...</div>;
  if (error) return <div className="pivot-container error-container">Error: {error}</div>;

  return (
    <div className="pivot-container">
      <h2>Step 1: Define Grouping & Filter</h2>
      <p>Use the pivot table to select how you want to group your training sessions. You can filter the users and group by location, course, role, etc.</p>

      {data.length > 0 && (
        <PivotTableUI
          data={data}
          onChange={s => setLocalPivotState(s)}
          {...localPivotState}
          aggregators={aggregators}
          renderers={TableRenderers}
        />
      )}

      <div className="grouping-preview">
        <strong>Grouping By:</strong> {groupingFields.join(' → ') || 'None'}
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleContinue}>Continue</button>
      </div>
    </div>
  );
};

export default TSCPivotGroupStage;
