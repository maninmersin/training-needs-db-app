import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import ScheduleList from './ScheduleList';
import AssignmentWorkspace from './AssignmentWorkspace';
import './UserAssignmentManager.css';

const UserAssignmentManager = () => {
  const [currentView, setCurrentView] = useState('selector'); // 'selector', 'workspace'
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Assignment level state
  const [assignmentLevel, setAssignmentLevel] = useState('training_location'); // 'training_location', 'course', 'group', 'session'
  
  // Data state
  const [schedules, setSchedules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSchedules, setSelectedSchedules] = useState([]); // For ScheduleList compatibility

  // Fetch available schedules
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('training_schedules')
        .select('id, name, created_at, updated_at, criteria, status, functional_areas, training_locations')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSchedules(data || []);
    } catch (err) {
      console.error('❌ Error fetching schedules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch existing assignments for selected schedule
  const fetchAssignments = async (scheduleId) => {
    try {
      const { data, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users (id, name, email, project_role, training_location)
        `)
        .eq('schedule_id', scheduleId);

      if (error) {
        // If relationship fails, try without the join first
        console.warn('Relationship query failed, trying without join:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .select('*')
          .eq('schedule_id', scheduleId);
        
        if (basicError) throw basicError;
        
        setAssignments(basicData || []);
        console.log('✅ Loaded assignments (basic):', basicData?.length || 0);
        return;
      }

      setAssignments(data || []);
      console.log('✅ Loaded assignments:', data?.length || 0);
    } catch (err) {
      console.error('❌ Error fetching assignments:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  // Handle schedule selection
  const handleScheduleSelect = async (schedule) => {
    setSelectedSchedule(schedule);
    setCurrentView('workspace');
    await fetchAssignments(schedule.id);
  };

  // Handle schedule edit (for ScheduleList compatibility - redirects to assignments)
  const handleScheduleEdit = async (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) {
      await handleScheduleSelect(schedule);
    }
  };

  // Handle going back to schedule selector
  const handleBackToSelector = () => {
    setCurrentView('selector');
    setSelectedSchedule(null);
    setAssignments([]);
  };

  // Create assignment
  const createAssignment = async (assignmentData) => {
    try {
      const { data, error } = await supabase
        .from('user_assignments')
        .insert([{
          schedule_id: selectedSchedule.id,
          end_user_id: assignmentData.userId,
          assignment_level: assignmentData.level,
          course_id: assignmentData.courseId || null,
          group_identifier: assignmentData.groupIdentifier || null,
          session_identifier: assignmentData.sessionIdentifier || null,
          assignment_type: assignmentData.type || 'standard',
          exception_reason: assignmentData.exceptionReason || null,
          notes: assignmentData.notes || null
        }])
        .select(`
          *,
          end_users (id, name, email, project_role, training_location)
        `);

      if (error) {
        // If relationship fails, try basic insert and fetch user data separately
        console.warn('Insert with join failed, trying basic insert:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .insert([{
            schedule_id: selectedSchedule.id,
            end_user_id: assignmentData.userId,
            assignment_level: assignmentData.level,
            course_id: assignmentData.courseId || null,
            group_identifier: assignmentData.groupIdentifier || null,
            session_identifier: assignmentData.sessionIdentifier || null,
            assignment_type: assignmentData.type || 'standard',
            exception_reason: assignmentData.exceptionReason || null,
            notes: assignmentData.notes || null
          }])
          .select('*');
        
        if (basicError) throw basicError;
        
        // Update local assignments state
        setAssignments(prev => [...prev, ...basicData]);
        console.log('✅ Assignment created (basic):', basicData[0]);
        return basicData[0];
      }

      // Update local assignments state
      setAssignments(prev => [...prev, ...data]);
      
      console.log('✅ Assignment created:', data[0]);
      return data[0];
    } catch (err) {
      console.error('❌ Error creating assignment:', err);
      throw err;
    }
  };

  // Remove assignment
  const removeAssignment = async (assignmentId) => {
    try {
      const { error } = await supabase
        .from('user_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      // Update local assignments state
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      
      console.log('✅ Assignment removed:', assignmentId);
    } catch (err) {
      console.error('❌ Error removing assignment:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="user-assignment-manager">
        <div className="loading-state">
          <div>👥 Loading user assignment tool...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-assignment-manager">
        <div className="error-state">
          <h3>❌ Error Loading User Assignment Tool</h3>
          <p>{error}</p>
          <button onClick={fetchSchedules}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-assignment-manager">
      <div className="assignment-manager-header">
        <h1>👥 User Assignment Tool</h1>
        <p>Assign users to training schedules at Training Location, Course, or Session level</p>
      </div>

      {currentView === 'selector' && (
        <ScheduleSelector
          schedules={schedules}
          onScheduleSelect={handleScheduleSelect}
          onRefresh={fetchSchedules}
        />
      )}

      {currentView === 'workspace' && selectedSchedule && (
        <div className="assignment-workspace-container">
          {/* Assignment Level Selection */}
          <div className="assignment-level-selector">
            <h3>Assignment Level</h3>
            <div className="level-options">
              <label className={assignmentLevel === 'training_location' ? 'active' : ''}>
                <input
                  type="radio"
                  name="assignmentLevel"
                  value="training_location"
                  checked={assignmentLevel === 'training_location'}
                  onChange={(e) => setAssignmentLevel(e.target.value)}
                />
                <div className="level-option">
                  <strong>Training Location Level</strong>
                  <span>Assign users to entire training location schedule</span>
                </div>
              </label>
              
              <label className={assignmentLevel === 'group' ? 'active' : ''}>
                <input
                  type="radio"
                  name="assignmentLevel"
                  value="group"
                  checked={assignmentLevel === 'group'}
                  onChange={(e) => setAssignmentLevel(e.target.value)}
                />
                <div className="level-option">
                  <strong>Group Level</strong>
                  <span>Assign users to specific groups (Group 1, Group 2, etc.) which may contain multiple courses</span>
                </div>
              </label>
              
              <label className={assignmentLevel === 'course' ? 'active' : ''}>
                <input
                  type="radio"
                  name="assignmentLevel"
                  value="course"
                  checked={assignmentLevel === 'course'}
                  onChange={(e) => setAssignmentLevel(e.target.value)}
                />
                <div className="level-option">
                  <strong>Course Level</strong>
                  <span>Assign users to specific courses within a group</span>
                </div>
              </label>
              
              <label className={assignmentLevel === 'session' ? 'active' : ''}>
                <input
                  type="radio"
                  name="assignmentLevel"
                  value="session"
                  checked={assignmentLevel === 'session'}
                  onChange={(e) => setAssignmentLevel(e.target.value)}
                />
                <div className="level-option">
                  <strong>Session Level</strong>
                  <span>Assign users to individual session events</span>
                </div>
              </label>
            </div>
          </div>

          {/* Assignment Workspace */}
          <AssignmentWorkspace
            schedule={selectedSchedule}
            assignmentLevel={assignmentLevel}
            assignments={assignments}
            onCreateAssignment={createAssignment}
            onRemoveAssignment={removeAssignment}
            onBack={handleBackToSelector}
          />
        </div>
      )}
    </div>
  );
};

export default UserAssignmentManager;