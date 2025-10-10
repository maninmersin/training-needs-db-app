import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import DragDropAssignmentPanel from './DragDropAssignmentPanel';
import ScheduleSelector from '../schedule-manager/ScheduleSelector';
import { loadTrainingSessionsForSchedule } from '@core/services/scheduleService';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import { debugLog, debugWarn, debugError } from '@core/utils/consoleUtils';
import './DragDropAssignmentPage.css';

const DragDropAssignmentPage = () => {
  const [searchParams] = useSearchParams();
  const { currentProject } = useProject();
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScheduleSelector, setShowScheduleSelector] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  debugLog('🎯 DragDropAssignmentPage loaded');

  useEffect(() => {
    // Only initialize once when the component first mounts or project changes
    if (currentProject && !hasInitialized) {
      initializePage();
      setHasInitialized(true);
    }
  }, [currentProject, hasInitialized]);

  const initializePage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if a specific schedule was passed via URL params
      const scheduleId = searchParams.get('scheduleId');
      const scheduleName = searchParams.get('scheduleName');
      
      debugLog('🔍 URL params:', { scheduleId, scheduleName });
      
      // Fetch available schedules
      await fetchSchedules();
      
      // If schedule ID provided, try to load it directly
      if (scheduleId) {
        await loadScheduleById(scheduleId);
      } else if (scheduleName) {
        await loadScheduleByName(scheduleName);
      }
      
    } catch (err) {
      debugError('❌ Error initializing page:', err);
      setError(`Failed to initialize: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      if (!currentProject) {
        debugLog('No current project selected');
        setSchedules([]);
        return;
      }

      debugLog('Fetching schedules for project:', currentProject.name);

      // Get all schedules for the project first
      const { data: allSchedules, error } = await supabase
        .from('training_schedules')
        .select('id, name, created_at, criteria, status, functional_areas, training_locations, project_id')
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      debugLog('📋 Found schedules:', allSchedules?.length || 0);

      // Filter schedules to only show those with sessions the user can access
      const accessibleSchedules = [];
      
      for (const schedule of allSchedules || []) {
        try {
          // Check if this schedule has any sessions the user can see
          const userSessions = await SimpleAuthService.getFilteredTrainingSessions(schedule.id);
          
          if (userSessions && userSessions.length > 0) {
            accessibleSchedules.push({
              ...schedule,
              _sessionCount: userSessions.length
            });
            debugLog(`✅ Schedule "${schedule.name}" - ${userSessions.length} accessible sessions`);
          } else {
            debugLog(`🔒 Schedule "${schedule.name}" - no accessible sessions`);
          }
        } catch (err) {
          debugWarn(`⚠️ Error checking access for schedule "${schedule.name}":`, err);
          // If there's an error checking access, exclude this schedule
        }
      }

      debugLog(`📋 Accessible schedules: ${accessibleSchedules.length} of ${allSchedules?.length || 0}`);
      setSchedules(accessibleSchedules);
      
    } catch (err) {
      debugError('❌ Error fetching schedules:', err);
      throw err;
    }
  };

  const loadScheduleById = async (scheduleId) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        debugLog('✅ Found schedule by ID:', schedule.name);
        
        // Get the project_id from the schedule (if not already present)
        let projectId = schedule.project_id;
        if (!projectId) {
          debugLog('🔍 Project ID not in schedule object, fetching from database...');
          const { data: scheduleData, error: scheduleError } = await supabase
            .from('training_schedules')
            .select('project_id')
            .eq('id', scheduleId)
            .single();
          
          if (scheduleError) {
            throw new Error(`Failed to get project ID: ${scheduleError.message}`);
          }
          
          projectId = scheduleData.project_id;
        }
        
        if (!projectId) {
          throw new Error('Unable to determine project ID for this schedule');
        }
        
        debugLog('🏢 Using project ID:', projectId);
        
        // Load training sessions for this schedule
        debugLog('🔄 Loading training sessions for schedule...');
        const sessions = await loadTrainingSessionsForSchedule(scheduleId, projectId);
        
        // Combine schedule metadata with sessions
        const fullSchedule = {
          ...schedule,
          sessions: sessions
        };
        
        debugLog('✅ Loaded complete schedule with sessions:', {
          scheduleId,
          scheduleName: schedule.name,
          sessionsCount: Object.keys(sessions || {}).length,
          sessionsStructure: sessions
        });
        
        console.log('🔄 DragDropAssignmentPage - Full schedule data:', fullSchedule);
        
        setCurrentSchedule(fullSchedule);
        setShowScheduleSelector(false);
      } else {
        debugWarn('⚠️ Schedule not found by ID:', scheduleId);
      }
    } catch (err) {
      debugError('❌ Error loading schedule by ID:', err);
      throw err;
    }
  };

  const loadScheduleByName = async (scheduleName) => {
    try {
      const schedule = schedules.find(s => 
        s.name.toLowerCase().includes(scheduleName.toLowerCase())
      );
      if (schedule) {
        debugLog('✅ Found schedule by name:', schedule.name);
        
        // Get the project_id from the schedule (if not already present)
        let projectId = schedule.project_id;
        if (!projectId) {
          debugLog('🔍 Project ID not in schedule object, fetching from database...');
          const { data: scheduleData, error: scheduleError } = await supabase
            .from('training_schedules')
            .select('project_id')
            .eq('id', schedule.id)
            .single();
          
          if (scheduleError) {
            throw new Error(`Failed to get project ID: ${scheduleError.message}`);
          }
          
          projectId = scheduleData.project_id;
        }
        
        if (!projectId) {
          throw new Error('Unable to determine project ID for this schedule');
        }
        
        debugLog('🏢 Using project ID:', projectId);
        
        // Load training sessions for this schedule
        debugLog('🔄 Loading training sessions for schedule...');
        const sessions = await loadTrainingSessionsForSchedule(schedule.id, projectId);
        
        // Combine schedule metadata with sessions
        const fullSchedule = {
          ...schedule,
          sessions: sessions
        };
        
        debugLog('✅ Loaded complete schedule with sessions:', {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          sessionsCount: Object.keys(sessions || {}).length
        });
        
        setCurrentSchedule(fullSchedule);
        setShowScheduleSelector(false);
      } else {
        debugWarn('⚠️ Schedule not found by name:', scheduleName);
      }
    } catch (err) {
      debugError('❌ Error loading schedule by name:', err);
      throw err;
    }
  };

  const handleScheduleSelect = async (schedule) => {
    try {
      debugLog('📋 Schedule selected:', schedule.name);
      setLoading(true);
      
      // Get the project_id from the schedule (if not already present)
      let projectId = schedule.project_id;
      if (!projectId) {
        debugLog('🔍 Project ID not in schedule object, fetching from database...');
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('training_schedules')
          .select('project_id')
          .eq('id', schedule.id)
          .single();
        
        if (scheduleError) {
          throw new Error(`Failed to get project ID: ${scheduleError.message}`);
        }
        
        projectId = scheduleData.project_id;
      }
      
      if (!projectId) {
        throw new Error('Unable to determine project ID for this schedule');
      }
      
      debugLog('🏢 Using project ID:', projectId);
      
      // Load training sessions for this schedule
      debugLog('🔄 Loading training sessions for selected schedule...');
      const sessions = await loadTrainingSessionsForSchedule(schedule.id, projectId);
      
      // Combine schedule metadata with sessions
      const fullSchedule = {
        ...schedule,
        sessions: sessions
      };
      
      debugLog('✅ Loaded complete schedule with sessions:', {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        sessionsCount: Object.keys(sessions || {}).length
      });
      
      setCurrentSchedule(fullSchedule);
      setShowScheduleSelector(false);
    } catch (err) {
      debugError('❌ Error loading selected schedule:', err);
      setError(`Failed to load schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSelector = () => {
    debugLog('🔙 Returning to schedule selector');
    setCurrentSchedule(null);
    setShowScheduleSelector(true);
  };

  const handleScheduleChange = (schedule) => {
    debugLog('🔄 Schedule changed:', schedule?.name || 'none');
    setCurrentSchedule(schedule);
  };


  const handleAssignmentUpdate = async () => {
    debugLog('🔄 Assignment update triggered - forcing refresh');

    // Force a re-render by updating the current schedule timestamp
    if (currentSchedule) {
      setCurrentSchedule(prev => ({
        ...prev,
        _lastUpdated: Date.now()
      }));
    }

    // Also trigger a reload of the current schedule to pick up new assignment data
    if (currentSchedule?.id) {
      try {
        debugLog('🔄 Reloading schedule data to pick up assignment changes...');

        // Get the project_id from current schedule (if not already present)
        let projectId = currentSchedule.project_id;
        if (!projectId) {
          debugLog('🔍 Project ID not in current schedule, fetching from database...');
          const { data: scheduleData, error: scheduleError } = await supabase
            .from('training_schedules')
            .select('project_id')
            .eq('id', currentSchedule.id)
            .single();

          if (scheduleError) {
            throw new Error(`Failed to get project ID: ${scheduleError.message}`);
          }

          projectId = scheduleData.project_id;
        }

        if (!projectId) {
          throw new Error('Unable to determine project ID for current schedule');
        }

        const sessions = await loadTrainingSessionsForSchedule(currentSchedule.id, projectId);

        setCurrentSchedule(prev => ({
          ...prev,
          sessions: sessions,
          _lastUpdated: Date.now()
        }));

        debugLog('✅ Schedule data reloaded successfully');
      } catch (err) {
        debugError('❌ Error reloading schedule data:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="drag-drop-assignment-page loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>🎯 Loading Drag & Drop Assignments</h2>
          <p>Preparing your assignment interface...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drag-drop-assignment-page error">
        <div className="error-content">
          <h2>❌ Error Loading Assignment Interface</h2>
          <p>{error}</p>
          <button 
            onClick={initializePage}
            className="retry-btn"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  // Show schedule selector if no schedule is selected
  if (showScheduleSelector && !currentSchedule) {
    return (
      <div className="drag-drop-assignment-page selector">
        <div className="schedule-selector-container">
          <div className="selector-card">
            <div className="selector-header">
              <h2>🎯 Select Training Schedule</h2>
            </div>

            <ScheduleSelector
              schedules={schedules}
              onScheduleSelect={handleScheduleSelect}
              onRefresh={fetchSchedules}
            />
            
            {schedules.length === 0 && (
              <div className="no-schedules-message">
                <h3>📝 No Schedules Available</h3>
                <p>You need to create a training schedule first.</p>
                <p>Visit the <strong>Schedule Manager</strong> to create or import schedules.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    );
  }

  // Show the main drag-drop interface
  return (
    <DragDropAssignmentPanel
      schedule={currentSchedule}
      currentSchedule={currentSchedule}
      onScheduleChange={handleScheduleChange}
      onAssignmentUpdate={handleAssignmentUpdate}
      onClose={handleBackToSelector}
    />
  );
};

export default DragDropAssignmentPage;