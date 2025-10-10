import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';

const TSCFetchDataStage = ({ setSchedulesList, setLoadingSchedules, onNextStage, onPreviousStage }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadFlag, setReloadFlag] = useState(false); // used to re-trigger fetch

  useEffect(() => {
    const fetchTrainingData = async () => {
      setLoading(true);
      setLoadingSchedules(true);
      setError(null);

      try {
        // ✅ Fetch both datasets FIRST
        const { data: courses, error: coursesError } = await supabase
          .from('courses')
          .select('*');

        const { data: projectRoles, error: rolesError } = await supabase
          .from('project_roles')
          .select('*');

        // ✅ Now safely handle both responses
        if (coursesError || rolesError) {
          console.error('❌ Courses Error:', coursesError?.message);
          console.error('❌ Roles Error:', rolesError?.message);
          setError('One or more datasets failed to load. See console for details.');
        } else {
          console.log('✅ Courses fetched:', courses);
          console.log('✅ Project roles fetched:', projectRoles);

          setSchedulesList({
            courses,
            end_users: projectRoles
          });
          
          // Auto-proceed to next stage when data is successfully fetched
          if (onNextStage) {
            setTimeout(onNextStage, 100); // Small delay to ensure state is updated
          }
        }

      } catch (generalError) {
        console.error('🔥 Unexpected error:', generalError.message);
        setError(`Unexpected error: ${generalError.message}`);
      } finally {
        setLoading(false);
        setLoadingSchedules(false);
      }
    };

    fetchTrainingData();
  }, [reloadFlag, setSchedulesList, setLoadingSchedules, onNextStage]);

  const retryFetch = () => {
    setReloadFlag(prev => !prev); // triggers useEffect to refetch
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>🔄 Loading training data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error" style={{ marginBottom: '20px', textAlign: 'center', padding: '40px' }}>
        <strong>Error:</strong> {error}
        <br />
        <button onClick={retryFetch} style={{ marginTop: '10px' }}>
          Retry
        </button>
      </div>
    );
  }

  // This should normally not be reached due to auto-proceed
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div>✅ Data loaded successfully...</div>
    </div>
  );
};

export default TSCFetchDataStage;
