import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';

const TSCFetchDataStage = ({ setSchedulesList, setLoadingSchedules, onNextStage, onPreviousStage }) => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadFlag, setReloadFlag] = useState(false); // used to re-trigger fetch

  useEffect(() => {
    const fetchTrainingData = async () => {
      if (!currentProject?.id) {
        setError('No project selected');
        setLoading(false);
        setLoadingSchedules(false);
        return;
      }

      setLoading(true);
      setLoadingSchedules(true);
      setError(null);

      try {
        // ✅ CRITICAL FIX: Fetch ALL training data (bypass Supabase 1000-row default limit)
        // The training_data table can have 1000+ rows (one per user-course assignment)
        console.log('📥 Fetching ALL training data for project...');

        const { data: trainingData, error: trainingError, count } = await supabase
          .from('training_data')
          .select('*', { count: 'exact' })
          .eq('project_id', currentProject.id)
          .limit(100000); // Set high limit to fetch all rows (Supabase supports up to 100k)

        // ✅ Handle response
        if (trainingError) {
          console.error('❌ Training Data Error:', trainingError?.message);
          setError('Failed to load training data. See console for details.');
        } else {
          console.log('✅ Training data fetched:', trainingData);
          console.log(`\n\n🚨🚨🚨 PAGINATION FIX APPLIED 🚨🚨🚨`);
          console.log(`   Rows fetched: ${trainingData?.length}`);
          console.log(`   Total in database: ${count}`);
          console.log(`   Missing rows: ${count - trainingData?.length}`);
          if (count > trainingData?.length) {
            console.error(`   ⚠️ WARNING: Still missing ${count - trainingData?.length} rows!`);
          } else {
            console.log(`   ✅ SUCCESS: All rows fetched!`);
          }
          console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n\n`);

          // Extract unique courses from training data
          const coursesMap = new Map();
          const endUsersData = [];

          trainingData.forEach(row => {
            // Build courses list (unique by course_id)
            if (!coursesMap.has(row.course_id)) {
              coursesMap.set(row.course_id, {
                course_id: row.course_id,
                course_name: row.course_name,
                duration_hrs: row.duration_hrs,
                functional_area: row.functional_area,
                location: row.user_location || 'TBD',
                topic: row.course_topic,
                sub_topic: row.course_sub_topic,
                application: row.course_application,
                priority: row.course_priority
              });
            }

            // Build end_users data (one row per user-course assignment)
            // This is exactly what TrainingCalculations expects!
            endUsersData.push({
              id: row.user_id,
              name: row.user_name,
              email: row.user_email,
              training_location: row.training_location, // CRITICAL for grouping
              project_role: row.user_project_role,
              course_id: row.course_id, // CRITICAL for matching
              // Additional fields for reference
              business_unit: row.business_unit,
              organization: row.organization,
              country: row.user_country,
              department: row.user_department,
              job_title: row.user_job_title,
              location: row.user_location,
              functional_area: row.functional_area
            });
          });

          const courses = Array.from(coursesMap.values());

          console.log('✅ Extracted courses:', courses);
          console.log('✅ Prepared end users data:', endUsersData);

          setSchedulesList({
            courses,
            end_users: endUsersData
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
  }, [reloadFlag, setSchedulesList, setLoadingSchedules, onNextStage, currentProject]);

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
