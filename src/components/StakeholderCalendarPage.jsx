import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StakeholderCalendarEditor from './StakeholderCalendarEditor';
import ScheduleSelector from './ScheduleSelector';
import { loadTrainingSessionsForSchedule } from '../services/scheduleService';
import { debugLog, debugWarn, debugError } from '../utils/consoleUtils';
import './StakeholderCalendarPage.css';

/**
 * Stakeholder Calendar Page - Entry point for stakeholder calendar access
 * 
 * Handles:
 * - Schedule selection interface
 * - Loading schedule data for stakeholder editor
 * - Navigation between schedule selection and editing
 */
const StakeholderCalendarPage = () => {
  const [searchParams] = useSearchParams();
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScheduleSelector, setShowScheduleSelector] = useState(true);

  debugLog('🎯 StakeholderCalendarPage loaded');

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
      debugError('❌ Error initializing stakeholder calendar page:', err);
      setError(`Failed to initialize: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('training_schedules')
        .select('*')
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
        await loadFullSchedule(schedule);
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
        await loadFullSchedule(schedule);
      } else {
        debugWarn('⚠️ Schedule not found by name:', scheduleName);
      }
    } catch (err) {
      debugError('❌ Error loading schedule by name:', err);
      throw err;
    }
  };

  const loadFullSchedule = async (schedule) => {
    try {
      debugLog('✅ Loading full schedule:', schedule.name);
      
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
        sessionsCount: Object.keys(sessions || {}).length,
        sessionsStructure: sessions
      });
      
      setCurrentSchedule(fullSchedule);
      setShowScheduleSelector(false);
    } catch (err) {
      debugError('❌ Error loading full schedule:', err);
      throw err;
    }
  };

  const handleScheduleSelect = async (schedule) => {
    try {
      debugLog('📋 Schedule selected for stakeholder editing:', schedule.name);
      setLoading(true);
      await loadFullSchedule(schedule);
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

  const handleAssignmentUpdate = () => {
    debugLog('🔄 Assignment update triggered in stakeholder mode');
    // Force a re-render by updating the current schedule timestamp
    if (currentSchedule) {
      setCurrentSchedule(prev => ({
        ...prev,
        _lastUpdated: Date.now()
      }));
    }
  };

  if (loading) {
    return (
      <div className="stakeholder-calendar-page loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>📅 Loading Stakeholder Calendar</h2>
          <p>Preparing your schedule interface...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stakeholder-calendar-page error">
        <div className="error-content">
          <h2>❌ Error Loading Calendar Interface</h2>
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
      <div className="stakeholder-calendar-page selector">
        <div className="page-header">
          <h1>📅 Stakeholder Calendar Editor</h1>
          <p className="page-description">
            Professional calendar interface for reviewing and editing training assignments.
            Select a schedule below to begin.
          </p>
        </div>
        
        <div className="schedule-selector-container">
          <div className="selector-card">
            <ScheduleSelector
              schedules={schedules}
              onScheduleSelect={handleScheduleSelect}
              onRefresh={fetchSchedules}
            />
            
            {schedules.length === 0 && (
              <div className="no-schedules-message">
                <h3>📝 No Schedules Available</h3>
                <p>No training schedules are currently available for editing.</p>
                <p>Contact your administrator to create or import schedules.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show the stakeholder calendar editor
  return (
    <StakeholderCalendarEditor
      schedule={currentSchedule}
      onClose={handleBackToSelector}
      onAssignmentUpdate={handleAssignmentUpdate}
      readOnlyMode={false} // Set to true if you want read-only stakeholder access
    />
  );
};

export default StakeholderCalendarPage;