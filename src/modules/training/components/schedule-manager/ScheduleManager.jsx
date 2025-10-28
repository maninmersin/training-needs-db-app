import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import ScheduleList from './ScheduleList';
import ExcelExportDialog from '@shared/components/ExcelExportDialog';
import ExcelImportWizard from '@shared/components/ExcelImportWizard';
import ScheduleEditor from './ScheduleEditor';
import './ScheduleManager.css';

const ScheduleManager = () => {
  const location = useLocation();
  const { currentProject } = useProject();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'edit', 'export', 'import'
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Reset to main view when restart parameter is present
  const resetToMainView = () => {
    setCurrentView('list');
    setCurrentSchedule(null);
    setSelectedSchedules([]);
    setSearchTerm('');
    setFilterDate('');
  };

  // Check for restart parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('restart') === 'true') {
      resetToMainView();
      // Clean up URL without triggering a re-render
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  // Fetch all schedules for the current project
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!currentProject) {
        console.log('No current project selected');
        setSchedules([]);
        setLoading(false);
        return;
      }

      console.log('Fetching schedules for project:', currentProject.name);

      const { data, error } = await supabase
        .from('training_schedules')
        .select(`
          id, 
          name, 
          created_at, 
          updated_at, 
          criteria, 
          status, 
          functional_areas, 
          training_locations,
          session_count:training_sessions(count)
        `)
        .eq('project_id', currentProject.id)
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

  useEffect(() => {
    fetchSchedules();
  }, [currentProject]);

  // Load full schedule data for editing
  const loadScheduleForEdit = async (scheduleId) => {
    try {
      // Fetch schedule metadata
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('training_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError) throw scheduleError;

      // Fetch associated sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('start_datetime');

      if (sessionsError) throw sessionsError;
      
      // DEBUG: Check what sessions were found
      console.log('🔍 DEBUG: Loading sessions for schedule:', scheduleId);
      console.log('🔍 DEBUG: Sessions found in database:', sessionsData?.length || 0);
      console.log('🔍 DEBUG: First few sessions:', sessionsData?.slice(0, 3));
      
      if (!sessionsData || sessionsData.length === 0) {
        console.warn('⚠️ No sessions found in database for schedule:', scheduleId);
        alert(`⚠️ Debug Info: No sessions found in database for this schedule (ID: ${scheduleId}). This indicates the schedule metadata exists but sessions were deleted or not saved properly.`);
      }

      // Transform sessions to match TSC Wizard structure: functional_area -> training_location -> classroom -> [sessions]
      const sessionsGroupedByStructure = {};
      
      (sessionsData || []).forEach(session => {
        const functionalArea = session.functional_area;
        const trainingLocation = session.training_location;
        const classroomKey = `Classroom ${session.classroom_number}`;
        
        // Initialize nested structure
        if (!sessionsGroupedByStructure[functionalArea]) {
          sessionsGroupedByStructure[functionalArea] = {};
        }
        if (!sessionsGroupedByStructure[functionalArea][trainingLocation]) {
          sessionsGroupedByStructure[functionalArea][trainingLocation] = {};
        }
        if (!sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey]) {
          sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey] = [];
        }
        
        // Transform session to match calendar format
        const startDate = new Date(session.start_datetime);
        const endDate = new Date(session.end_datetime);
        
        const calendarSession = {
          course_id: session.course_id,
          course_name: session.course_name,
          sessionNumber: session.session_number,
          group_type: [], // Will be populated based on criteria
          groupName: `${session.training_location} - Classroom ${session.classroom_number}`,
          start: startDate,
          end: endDate,
          duration: session.duration_hours || 1,
          functional_area: session.functional_area,
          location: session.training_location,
          title: session.session_title || `${session.course_name} - Group ${session.session_number}`,
          custom_title: session.session_title || '',
          trainer_id: session.instructor_id || '',
          trainer_name: session.instructor_name || '',
          color: null, // Let ScheduleCalendar handle color assignment
          text_color: null,
          background_color: null,
          notes: session.notes || '',
          max_participants: session.max_attendees,
          current_participants: session.current_attendees,
          event_id: session.id, // Use session ID as event ID
          eventId: `${session.course_id}-session${session.session_number}-${trainingLocation.replace(/\s+/g, '-').toLowerCase()}-${session.functional_area.replace(/\s+/g, '-').toLowerCase()}`,
          calendarInstance: `${trainingLocation} - Classroom ${session.classroom_number}-${session.functional_area}`,
          
          // Multi-day session fields from new database structure
          totalParts: session.total_parts || 1,
          totalDays: session.course_day_sequence || 1,
          daySequence: session.course_day_sequence || 1,
          isMultiDay: session.is_multi_day_course || false,
          course: {
            id: session.course_id,
            course_id: session.course_id,
            course_name: session.course_name,
            duration_hrs: session.duration_hours || 1
          }
        };
        
        sessionsGroupedByStructure[functionalArea][trainingLocation][classroomKey].push(calendarSession);
      });

      // Combine schedule with sessions in TSC Wizard format
      const scheduleWithSessions = {
        ...scheduleData,
        sessions: sessionsGroupedByStructure // Use TSC Wizard structure
      };

      console.log('✅ Loaded schedule with sessions in TSC Wizard format:', {
        schedule: scheduleData.name,
        sessionCount: (sessionsData || []).length,
        structuredSessions: sessionsGroupedByStructure
      });

      setCurrentSchedule(scheduleWithSessions);
      setCurrentView('edit');
    } catch (err) {
      console.error('❌ Error loading schedule:', err);
      alert(`Failed to load schedule: ${err.message}`);
    }
  };

  // Delete schedules
  const deleteSchedules = async (scheduleIds) => {
    try {
      const { error } = await supabase
        .from('training_schedules')
        .delete()
        .in('id', scheduleIds);

      if (error) throw error;

      setSelectedSchedules([]);
      fetchSchedules();
      alert(`✅ Successfully deleted ${scheduleIds.length} schedule(s)`);
    } catch (err) {
      console.error('❌ Error deleting schedules:', err);
      alert(`Failed to delete schedules: ${err.message}`);
    }
  };

  // Filter schedules based on search and date
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || schedule.created_at.startsWith(filterDate);
    return matchesSearch && matchesDate;
  });

  const handleBack = () => {
    setCurrentView('list');
    setCurrentSchedule(null);
  };

  if (loading) {
    return (
      <div className="schedule-manager">
        <div className="loading-state">
          <div>📅 Loading schedules...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="schedule-manager">
        <div className="error-state">
          <h3>❌ Error Loading Schedules</h3>
          <p>{error}</p>
          <button onClick={fetchSchedules}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-manager">
      <div className="schedule-manager-header">
        <h1>📅 Schedule Manager</h1>
        <p>Manage, edit, and export your training schedules</p>
        <div className="workflow-helper">
          <p>💡 <strong>Need to assign users to sessions?</strong> Use <a href="/drag-drop-assignments">User Assignments</a> for drag-and-drop user scheduling.</p>
        </div>
      </div>

      {currentView === 'list' && (
        <>
          {/* Search and Filter Controls */}
          <div className="schedule-controls">
            <div className="search-controls">
              <input
                type="text"
                placeholder="Search schedules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="date-filter"
              />
              {(searchTerm || filterDate) && (
                <button 
                  onClick={() => { setSearchTerm(''); setFilterDate(''); }}
                  className="clear-filters-btn"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="action-controls">
              <button
                onClick={() => setCurrentView('export')}
                disabled={selectedSchedules.length === 0}
                className="export-btn"
              >
                📊 Export ({selectedSchedules.length})
              </button>
              <button
                onClick={() => setCurrentView('import')}
                className="import-btn"
              >
                📥 Import
              </button>
              <button
                onClick={() => deleteSchedules(selectedSchedules)}
                disabled={selectedSchedules.length === 0}
                className="delete-btn"
              >
                🗑 Delete ({selectedSchedules.length})
              </button>
            </div>
          </div>

          {/* Schedule List */}
          <ScheduleList
            schedules={filteredSchedules}
            selectedSchedules={selectedSchedules}
            onSelectionChange={setSelectedSchedules}
            onEdit={loadScheduleForEdit}
            onRefresh={fetchSchedules}
          />
        </>
      )}

      {currentView === 'edit' && currentSchedule && (
        <ScheduleEditor
          key={`schedule-editor-${currentSchedule.id}`}
          schedule={currentSchedule}
          onSave={() => {
            // Don't refresh schedules immediately to avoid resetting editor state
            // The schedule list will be refreshed when user goes back
            console.log('✅ Schedule saved, keeping editor state intact');
          }}
          onBack={() => {
            // Refresh schedules when going back to list
            fetchSchedules();
            handleBack();
          }}
        />
      )}

      {currentView === 'export' && (
        <ExcelExportDialog
          selectedSchedules={selectedSchedules.map(id => 
            schedules.find(s => s.id === id)
          )}
          onBack={handleBack}
        />
      )}

      {currentView === 'import' && (
        <ExcelImportWizard
          onComplete={() => {
            fetchSchedules();
            handleBack();
          }}
          onBack={handleBack}
        />
      )}
    </div>
  );
};

export default ScheduleManager;