import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import DragDropAssignmentPanel from './DragDropAssignmentPanel';
import ScheduleSelector from './ScheduleSelector';
import { loadTrainingSessionsForSchedule } from '../services/scheduleService';
import { debugLog, debugWarn, debugError } from '../utils/consoleUtils';
import './DragDropAssignmentPage.css';

const DragDropAssignmentPage = () => {
  const [searchParams] = useSearchParams();
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScheduleSelector, setShowScheduleSelector] = useState(true);

  debugLog('🎯 DragDropAssignmentPage loaded');

  useEffect(() => {
    initializePage();
  }, []);

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
      const { data, error } = await supabase
        .from('training_schedules')
        .select('id, name, created_at, criteria, status, functional_areas, training_locations')
        .order('created_at', { ascending: false });

      if (error) throw error;

      debugLog('📋 Fetched schedules:', data?.length || 0);
      setSchedules(data || []);
      
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
        
        // Load training sessions for this schedule
        debugLog('🔄 Loading training sessions for schedule...');
        const sessions = await loadTrainingSessionsForSchedule(scheduleId);
        
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
        
        // Load training sessions for this schedule
        debugLog('🔄 Loading training sessions for schedule...');
        const sessions = await loadTrainingSessionsForSchedule(schedule.id);
        
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
      
      // Load training sessions for this schedule
      debugLog('🔄 Loading training sessions for selected schedule...');
      const sessions = await loadTrainingSessionsForSchedule(schedule.id);
      
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
        const sessions = await loadTrainingSessionsForSchedule(currentSchedule.id);
        
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
        <div className="page-header">
          <h1>🎯 Drag & Drop Assignments</h1>
          <p>Select a training schedule to begin assigning users with drag-and-drop functionality.</p>
        </div>
        
        <div className="schedule-selector-container">
          <div className="selector-card">
            <h2>📋 Choose a Schedule</h2>
            <p className="selector-description">
              Select from your existing training schedules to start the visual assignment process.
            </p>
            
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