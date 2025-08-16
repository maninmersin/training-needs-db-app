import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ScheduleSelector from './ScheduleSelector';
import AssignmentWorkspace from './AssignmentWorkspace';
import './CalendarSidebar.css';

const CalendarSidebar = ({ isOpen, onClose, currentSchedule, onScheduleChange, onAssignmentUpdate }) => {
  const [currentView, setCurrentView] = useState('selector'); // 'selector', 'workspace'
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Assignment level state
  const [assignmentLevel, setAssignmentLevel] = useState('training_location');
  
  // Data state
  const [schedules, setSchedules] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    if (currentSchedule) {
      console.log('🔄 useEffect triggered for currentSchedule:', currentSchedule.name);
      
      // Immediately set up workspace view to prevent flickering
      setSelectedSchedule(currentSchedule);
      setCurrentView('workspace');
      setError(null);
      
      // Clear existing assignments before fetching new ones
      setAssignments([]);
      
      fetchAssignments(currentSchedule.id);
    } else {
      // When no current schedule, ensure we're in selector mode
      console.log('🔄 No currentSchedule provided, showing selector');
      if (currentView !== 'selector') {
        setCurrentView('selector');
        setSelectedSchedule(null);
        setAssignments([]);
      }
    }
  }, [currentSchedule]);

  // Fetch available schedules
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('training_schedules')
        .select('id, name, created_at, criteria, status, functional_areas, training_locations')
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
    console.log('🔍 Starting fetchAssignments for schedule ID:', scheduleId);
    
    try {
      setError(null); // Clear any previous errors
      
      // First try with relationship query
      console.log('📊 Attempting relationship query...');
      const { data, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users (id, name, email, project_role, training_location)
        `)
        .eq('schedule_id', scheduleId);

      if (error) {
        console.warn('⚠️ Relationship query failed:', error.message);
        console.log('🔄 Trying basic query without joins...');
        
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .select('*')
          .eq('schedule_id', scheduleId);
        
        if (basicError) {
          console.error('❌ Basic query also failed:', basicError.message);
          throw new Error(`Failed to fetch assignments: ${basicError.message}`);
        }
        
        console.log('✅ Basic query successful. Found', basicData?.length || 0, 'assignments');
        console.log('📋 Assignment details:', basicData?.map(a => ({
          id: a.id,
          level: a.assignment_level,
          user_id: a.end_user_id,
          training_location: a.training_location,
          functional_area: a.functional_area,
          group_identifier: a.group_identifier
        })) || []);
        
        setAssignments(basicData || []);
        return;
      }

      console.log('✅ Relationship query successful. Found', data?.length || 0, 'assignments');
      console.log('📋 Assignment details with users:', data?.map(a => ({
        id: a.id,
        level: a.assignment_level,
        user_id: a.end_user_id,
        user_name: a.end_users?.name,
        training_location: a.training_location,
        functional_area: a.functional_area,
        group_identifier: a.group_identifier
      })) || []);
      
      setAssignments(data || []);
    } catch (err) {
      console.error('❌ Critical error in fetchAssignments:', err);
      const errorMessage = `Failed to load assignments: ${err.message}. Please try refreshing or contact support.`;
      setError(errorMessage);
      
      // Still set empty array to prevent UI issues
      setAssignments([]);
    }
  };

  useEffect(() => {
    if (isOpen && schedules.length === 0) {
      console.log('🔄 Sidebar opened, fetching schedules...');
      fetchSchedules();
    } else if (isOpen) {
      console.log('🔄 Sidebar opened with existing schedules:', schedules.length);
    }
  }, [isOpen]);
  
  // Clean up state when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      console.log('🔄 Sidebar closed, resetting state');
      
      // Only reset to selector if no currentSchedule is provided
      if (!currentSchedule) {
        setCurrentView('selector');
      }
      
      // Don't clear selectedSchedule if it matches currentSchedule
      if (!currentSchedule || selectedSchedule?.id !== currentSchedule?.id) {
        setSelectedSchedule(null);
        setAssignments([]);
      }
      
      setError(null);
      setLoading(false);
    }
  }, [isOpen, currentSchedule, selectedSchedule]);

  // Handle schedule selection
  const handleScheduleSelect = async (schedule) => {
    console.log('📋 Schedule selected:', schedule.name, 'ID:', schedule.id);
    
    try {
      setLoading(true);
      setError(null);
      
      // Clear existing assignments before loading new ones
      setAssignments([]);
      
      setSelectedSchedule(schedule);
      setCurrentView('workspace');
      
      // Explicitly fetch assignments with better logging
      console.log('🔄 Fetching assignments for schedule:', schedule.id);
      await fetchAssignments(schedule.id);
      
      console.log('✅ Schedule selection completed successfully');
      
      // Notify parent component about schedule change
      if (onScheduleChange) {
        onScheduleChange(schedule);
      }
    } catch (err) {
      console.error('❌ Error during schedule selection:', err);
      setError(`Failed to load schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle going back to schedule selector
  const handleBackToSelector = () => {
    console.log('🔙 Returning to schedule selector');
    
    // Clear all state when going back
    setCurrentView('selector');
    setSelectedSchedule(null);
    setAssignments([]);
    setError(null);
    setAssignmentLevel('training_location'); // Reset to default level
    
    // Notify parent that schedule selection is cleared
    if (onScheduleChange) {
      onScheduleChange(null);
    }
  };

  // Create assignment
  const createAssignment = async (assignmentData) => {
    console.log('🔥 CalendarSidebar.createAssignment called with:', {
      userId: assignmentData.userId,
      level: assignmentData.level,
      trainingLocation: assignmentData.trainingLocation,
      functionalArea: assignmentData.functionalArea,
      groupIdentifier: assignmentData.groupIdentifier
    });
    
    try {
      setLoading(true);
      setError(null);
      
      const insertData = {
        schedule_id: selectedSchedule.id,
        end_user_id: assignmentData.userId,
        assignment_level: assignmentData.level,
        course_id: assignmentData.courseId || null,
        group_identifier: assignmentData.groupIdentifier || null,
        session_identifier: assignmentData.sessionIdentifier || null,
        training_location: assignmentData.trainingLocation || null,
        functional_area: assignmentData.functionalArea || null,
        assignment_type: assignmentData.type || 'standard',
        exception_reason: assignmentData.exceptionReason || null,
        notes: assignmentData.notes || null
      };
      
      console.log('💾 Inserting assignment data:', insertData);
      
      const { data, error } = await supabase
        .from('user_assignments')
        .insert([insertData])
        .select(`
          *,
          end_users (id, name, email, project_role, training_location)
        `);

      if (error) {
        console.warn('⚠️ Insert with join failed, trying basic insert:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('user_assignments')
          .insert([insertData])
          .select('*');
        
        if (basicError) {
          console.error('❌ Basic insert also failed:', basicError.message);
          throw new Error(`Failed to create assignment: ${basicError.message}`);
        }
        
        console.log('✅ Assignment created with basic insert:', basicData[0]);
        
        // Update local state
        setAssignments(prev => {
          const updated = [...prev, ...basicData];
          console.log('🔄 Updated assignments count:', updated.length);
          return updated;
        });
        
        // Notify parent about assignment update
        if (onAssignmentUpdate) {
          console.log('📢 Notifying parent of assignment update');
          onAssignmentUpdate();
        }
        
        return basicData[0];
      }

      console.log('✅ Assignment created with join:', data[0]);
      
      // Update local state
      setAssignments(prev => {
        const updated = [...prev, ...data];
        console.log('🔄 Updated assignments count:', updated.length);
        return updated;
      });
      
      // Notify parent about assignment update
      if (onAssignmentUpdate) {
        console.log('📢 Notifying parent of assignment update');
        onAssignmentUpdate();
      }
      
      return data[0];
    } catch (err) {
      console.error('❌ Error creating assignment:', err);
      setError(`Failed to create assignment: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Remove assignment
  const removeAssignment = async (assignmentId) => {
    console.log('🗑️ Removing assignment:', assignmentId);
    
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase
        .from('user_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) {
        console.error('❌ Failed to delete assignment:', error.message);
        throw new Error(`Failed to remove assignment: ${error.message}`);
      }

      console.log('✅ Assignment removed successfully');
      
      // Update local state
      setAssignments(prev => {
        const updated = prev.filter(a => a.id !== assignmentId);
        console.log('🔄 Updated assignments count after removal:', updated.length);
        return updated;
      });
      
      // Notify parent about assignment update
      if (onAssignmentUpdate) {
        console.log('📢 Notifying parent of assignment removal');
        onAssignmentUpdate();
      }
      
    } catch (err) {
      console.error('❌ Error removing assignment:', err);
      setError(`Failed to remove assignment: ${err.message}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update existing NULL assignments with proper location data
  const fixNullAssignments = async () => {
    if (!selectedSchedule) {
      console.warn('⚠️ No schedule selected for fixing assignments');
      return;
    }
    
    const confirmFix = window.confirm(`Do you want to fix NULL assignments for schedule "${selectedSchedule.name}"? This will update assignments with missing location data.`);
    if (!confirmFix) {
      console.log('❌ User cancelled assignment fixing');
      return;
    }

    console.log('🔧 Fixing NULL assignments for schedule:', selectedSchedule.name, 'ID:', selectedSchedule.id);

    try {
      setLoading(true);
      setError(null);
      
      // First, get all assignments with NULL training_location for this schedule
      const { data: nullAssignments, error: fetchError } = await supabase
        .from('user_assignments')
        .select('*')
        .eq('schedule_id', selectedSchedule.id)
        .or('training_location.is.null,functional_area.is.null');
        
      if (fetchError) {
        throw new Error(`Failed to fetch NULL assignments: ${fetchError.message}`);
      }
      
      console.log('🔍 Found', nullAssignments?.length || 0, 'assignments with NULL location data');
      
      if (!nullAssignments || nullAssignments.length === 0) {
        alert('No assignments found with missing location data.');
        return;
      }
      
      // Get schedule criteria to determine default locations
      const scheduleData = selectedSchedule;
      const criteriaData = scheduleData.criteria?.default || scheduleData.criteria || {};
      const availableLocations = criteriaData.selected_training_locations || 
                                criteriaData.trainingLocations || 
                                criteriaData.training_locations || [];
      const availableAreas = criteriaData.selected_functional_areas || 
                            criteriaData.functionalAreas || 
                            criteriaData.functional_areas || ['General'];
      
      console.log('📍 Schedule context for fixing assignments:', {
        availableLocations,
        availableAreas
      });
      
      const defaultLocation = availableLocations.length > 0 && availableLocations[0] !== 'TBD' ? 
                             availableLocations[0] : null;
      const defaultArea = availableAreas.length > 0 ? availableAreas[0] : 'General';
      
      if (!defaultLocation) {
        throw new Error('Cannot determine default training location from schedule criteria');
      }
      
      // Update each NULL assignment
      let fixedCount = 0;
      for (const assignment of nullAssignments) {
        const updateData = {};
        
        if (!assignment.training_location) {
          updateData.training_location = defaultLocation;
        }
        if (!assignment.functional_area) {
          updateData.functional_area = defaultArea;
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('user_assignments')
            .update(updateData)
            .eq('id', assignment.id);
            
          if (updateError) {
            console.error('❌ Failed to update assignment:', assignment.id, updateError.message);
          } else {
            console.log('✅ Fixed assignment:', assignment.id, 'with:', updateData);
            fixedCount++;
          }
        }
      }
      
      console.log('✅ Fixed', fixedCount, 'assignments with NULL location data');
      alert(`Successfully fixed ${fixedCount} assignments with missing location data!`);
      
      // Refresh assignments to show updated data
      await fetchAssignments(selectedSchedule.id);
      
      // Refresh calendar to show newly visible users
      if (onAssignmentUpdate) {
        console.log('📢 Notifying parent of assignment fixes');
        onAssignmentUpdate();
      }
    } catch (err) {
      console.error('❌ Error fixing NULL assignments:', err);
      const errorMessage = `Failed to fix assignments: ${err.message}`;
      setError(errorMessage);
      alert('Error fixing assignments: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Clear all assignments for current schedule
  const clearAllAssignments = async () => {
    if (!selectedSchedule) {
      console.warn('⚠️ No schedule selected for clearing assignments');
      return;
    }
    
    const confirmClear = window.confirm(`Are you sure you want to clear ALL assignments for schedule "${selectedSchedule.name}"? This cannot be undone.`);
    if (!confirmClear) {
      console.log('❌ User cancelled assignment clearing');
      return;
    }

    console.log('🗑️ Clearing all assignments for schedule:', selectedSchedule.name, 'ID:', selectedSchedule.id);

    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase
        .from('user_assignments')
        .delete()
        .eq('schedule_id', selectedSchedule.id);

      if (error) {
        console.error('❌ Failed to clear assignments:', error.message);
        throw new Error(`Failed to clear assignments: ${error.message}`);
      }

      // Clear local assignments state
      setAssignments([]);
      
      console.log('✅ All assignments cleared for schedule:', selectedSchedule.id);
      alert('All assignments have been cleared successfully!');
      
      // Refresh calendar to remove users from events
      if (onAssignmentUpdate) {
        console.log('📢 Notifying parent of assignment clearing');
        onAssignmentUpdate();
      }
    } catch (err) {
      console.error('❌ Error clearing all assignments:', err);
      const errorMessage = `Failed to clear assignments: ${err.message}`;
      setError(errorMessage);
      alert('Error clearing assignments: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`calendar-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="header-content">
          <h2>👥 User Assignments</h2>
          {selectedSchedule && (
            <div className="schedule-context" style={{
              fontSize: '14px',
              color: '#666',
              marginTop: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span>📋 <strong>{selectedSchedule.name}</strong></span>
              {currentSchedule && (
                <span style={{ 
                  backgroundColor: '#e7f3ff', 
                  padding: '2px 8px', 
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#0066cc'
                }}>
                  Currently Open
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} className="sidebar-close-btn">
          ✕
        </button>
      </div>

      <div className="sidebar-content">
        {loading && (
          <div className="sidebar-loading">
            Loading...
          </div>
        )}

        {error && (
          <div className="sidebar-error">
            <h3>❌ Error</h3>
            <p>{error}</p>
            <button onClick={fetchSchedules}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Only show schedule selector if no schedule is currently selected */}
            {currentView === 'selector' && !currentSchedule && (
              <div className="sidebar-schedule-selector">
                <p>Select a schedule to assign users:</p>
                {loading ? (
                  <div className="loading-message">
                    🔄 Loading assignments...
                  </div>
                ) : (
                  <ScheduleSelector
                    schedules={schedules}
                    onScheduleSelect={handleScheduleSelect}
                    onRefresh={fetchSchedules}
                  />
                )}
              </div>
            )}
            
            {currentView === 'workspace' && selectedSchedule && (
              <div className="sidebar-assignment-workspace">
                {/* Assignment Loading State */}
                {loading && (
                  <div className="assignment-loading" style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    marginBottom: '20px'
                  }}>
                    🔄 Loading assignments for "{selectedSchedule.name}"...
                  </div>
                )}
                
                {/* Schedule Navigation & Assignment Count Info */}
                {!loading && (
                  <div className="assignment-info" style={{
                    padding: '10px',
                    backgroundColor: '#e7f3ff',
                    border: '1px solid #b3d9ff',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      📋 Schedule: "{selectedSchedule.name}" | Assignments: {assignments.length}
                    </div>
                    <button 
                      onClick={() => {
                        console.log('🔄 User wants to change schedule');
                        setCurrentView('selector');
                        setSelectedSchedule(null);
                        setAssignments([]);
                        
                        // Clear parent schedule reference
                        if (onScheduleChange) {
                          onScheduleChange(null);
                        }
                      }}
                      style={{
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      title="Switch to a different schedule"
                    >
                      🔄 Change Schedule
                    </button>
                  </div>
                )}
                
                {/* Assignment Management Buttons */}
                <div className="assignment-actions" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={fixNullAssignments}
                    className="fix-assignments-btn"
                    disabled={loading}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '🔄 Loading...' : '🔧 Fix NULL Assignments'}
                  </button>
                  
                  <button 
                    onClick={clearAllAssignments}
                    className="clear-all-btn"
                    disabled={loading || assignments.length === 0}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: assignments.length > 0 && !loading ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: '500',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '🔄 Loading...' : `🗑️ Clear All (${assignments.length})`}
                  </button>
                </div>

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
                        <strong>Training Location</strong>
                        <span>Entire schedule</span>
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
                        <span>Specific groups</span>
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
                        <span>Specific courses</span>
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
                        <span>Individual sessions</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Assignment Workspace */}
                {!loading && (
                  <AssignmentWorkspace
                    schedule={selectedSchedule}
                    assignmentLevel={assignmentLevel}
                    assignments={assignments}
                    onCreateAssignment={createAssignment}
                    onRemoveAssignment={removeAssignment}
                    onBack={handleBackToSelector}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CalendarSidebar;