import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import EnhancedScheduleCalendar from './EnhancedScheduleCalendar';
import SessionEditPanel from './SessionEditPanel';
import ChangeSummaryPanel from './ChangeSummaryPanel';
import StakeholderCalendarExportDialog from './StakeholderCalendarExportDialog';
import { loadTrainingSessionsForSchedule } from '../services/scheduleService';
import { debugLog, debugWarn, debugError } from '../utils/consoleUtils';
import { generateTrainingCalendar, downloadCalendarFile } from '../utils/calendarInviteGenerator';
import './StakeholderCalendarEditor.css';

/**
 * Simplified Calendar Editor for Stakeholder Access
 * 
 * Provides visual calendar context with guided editing controls.
 * Designed for external stakeholders who need professional, reliable interface
 * without the complexity of full drag-drop functionality.
 */
const StakeholderCalendarEditor = ({ 
  schedule, 
  onClose, 
  onAssignmentUpdate,
  readOnlyMode = false 
}) => {
  // Core state
  const [currentSchedule, setCurrentSchedule] = useState(schedule);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit state
  const [selectedSession, setSelectedSession] = useState(null);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [showChangeSummary, setShowChangeSummary] = useState(false);

  // Calendar generation state
  const [generatingCalendar, setGeneratingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState(null);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);

  debugLog('🎯 StakeholderCalendarEditor initialized', { 
    scheduleId: schedule?.id, 
    readOnlyMode 
  });

  // Memoized flattened sessions to prevent infinite re-renders
  const flattenedSessions = useMemo(() => {
    if (!currentSchedule?.sessions || typeof currentSchedule.sessions !== 'object') {
      return [];
    }

    const flatSessions = [];
    const sessionStructure = currentSchedule.sessions;
    
    // Structure: functionalArea -> location -> classroom -> [sessions]
    Object.entries(sessionStructure).forEach(([functionalArea, locationData]) => {
      if (locationData && typeof locationData === 'object') {
        Object.entries(locationData).forEach(([location, classroomData]) => {
          if (classroomData && typeof classroomData === 'object') {
            Object.entries(classroomData).forEach(([classroom, sessionsList]) => {
              if (Array.isArray(sessionsList)) {
                // Add classroom information to each session
                const sessionsWithClassroom = sessionsList.map(session => ({
                  ...session,
                  _classroom: classroom,
                  classroom_name: classroom,
                  functional_area: functionalArea,
                  training_location: location
                }));
                flatSessions.push(...sessionsWithClassroom);
              }
            });
          }
        });
      }
    });

    debugLog('📊 Flattened sessions for calendar:', {
      inputStructure: Object.keys(sessionStructure),
      outputCount: flatSessions.length,
      sampleSession: flatSessions[0]
    });

    // Debug: Show classroom distribution
    const classroomDistribution = {};
    flatSessions.forEach(session => {
      const key = `${session.training_location} - ${session._classroom}`;
      classroomDistribution[key] = (classroomDistribution[key] || 0) + 1;
    });
    debugLog('🏫 Classroom distribution:', classroomDistribution);

    // Add detailed session debugging
    if (flatSessions.length > 0) {
      debugLog('📊 Session identifiers for matching:', flatSessions.map(s => ({
        title: s.title,
        id: s.id,
        eventId: s.eventId,
        sessionIdentifier: s.session_identifier,
        courseId: s.course_id
      })).slice(0, 3));
    }

    return flatSessions;
  }, [currentSchedule?.sessions]);

  useEffect(() => {
    if (schedule?.id) {
      initializeData();
    }
  }, [schedule?.id]);

  // Handle schedule prop changes
  useEffect(() => {
    if (schedule) {
      setCurrentSchedule(schedule);
    }
  }, [schedule]);

  const initializeData = async () => {
    try {
      setLoading(true);
      setError(null);

      debugLog('🔄 Loading stakeholder calendar data...');

      // Load schedule sessions if not already loaded
      let scheduleData = currentSchedule;
      if (!scheduleData?.sessions) {
        debugLog('🔄 Loading sessions from database...');
        const sessions = await loadTrainingSessionsForSchedule(schedule.id);
        debugLog('📊 Loaded sessions structure:', sessions);
        debugLog('📊 Sessions keys:', Object.keys(sessions || {}));
        
        if (sessions && Object.keys(sessions).length > 0) {
          // Log the structure in more detail
          Object.entries(sessions).forEach(([functionalArea, locationData]) => {
            debugLog(`📍 Functional Area: ${functionalArea}`, locationData);
            if (locationData && typeof locationData === 'object') {
              Object.entries(locationData).forEach(([location, classroomData]) => {
                debugLog(`  🏢 Location: ${location}`, classroomData);
                if (classroomData && typeof classroomData === 'object') {
                  Object.entries(classroomData).forEach(([classroom, sessionsList]) => {
                    debugLog(`    🏫 Classroom: ${classroom}`, sessionsList);
                    if (Array.isArray(sessionsList)) {
                      debugLog(`      📅 Sessions count: ${sessionsList.length}`);
                      sessionsList.slice(0, 2).forEach((session, idx) => {
                        debugLog(`      📝 Sample session ${idx}:`, {
                          title: session.title,
                          start: session.start,
                          end: session.end,
                          course_id: session.course_id,
                          session_identifier: session.session_identifier
                        });
                      });
                    }
                  });
                }
              });
            }
          });
        }
        
        scheduleData = { ...schedule, sessions };
        setCurrentSchedule(scheduleData);
      }

      // Load assignments
      await loadAssignments();

      // Load users
      await loadUsers();

      debugLog('✅ Stakeholder calendar data loaded successfully');

    } catch (err) {
      debugError('❌ Error initializing stakeholder calendar:', err);
      setError(`Failed to load calendar data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users!inner(
            id,
            name,
            email,
            project_role,
            training_location
          )
        `)
        .eq('schedule_id', schedule.id);

      if (error) throw error;

      debugLog('📋 Loaded assignments:', data?.length || 0);
      if (data && data.length > 0) {
        debugLog('📋 Assignment details:', data.map(a => ({
          id: a.id,
          userId: a.end_user_id,
          userName: a.end_users?.name,
          level: a.assignment_level,
          sessionId: a.session_identifier,
          courseId: a.course_id,
          groupId: a.group_identifier
        })));
      } else {
        debugLog('⚠️ No assignments found for schedule:', schedule.id);
      }
      setAssignments(data || []);

    } catch (err) {
      debugError('❌ Error loading assignments:', err);
      throw err;
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('end_users')
        .select('id, name, email, project_role, training_location')
        .order('name');

      if (error) throw error;

      debugLog('👥 Loaded users:', data?.length || 0);
      setUsers(data || []);

    } catch (err) {
      debugError('❌ Error loading users:', err);
      throw err;
    }
  };

  // Session click handler - opens edit panel
  const handleSessionClick = (sessionData) => {
    if (readOnlyMode) return;

    debugLog('📅 Session clicked:', sessionData.title);
    setSelectedSession(sessionData);
    setEditPanelOpen(true);
  };

  // Close edit panel
  const handleCloseEditPanel = () => {
    debugLog('❌ Closing session edit panel');
    setSelectedSession(null);
    setEditPanelOpen(false);
  };

  // Add pending change
  const addPendingChange = (change) => {
    debugLog('📝 Adding pending change:', change);
    
    setPendingChanges(prev => {
      // Remove any existing change for the same user/session to avoid duplicates
      const filtered = prev.filter(c => 
        !(c.userId === change.userId && c.sessionId === change.sessionId)
      );
      return [...filtered, change];
    });
  };

  // Remove pending change
  const removePendingChange = (changeId) => {
    debugLog('🗑️ Removing pending change:', changeId);
    setPendingChanges(prev => prev.filter(c => c.id !== changeId));
  };

  // Apply all pending changes
  const applyPendingChanges = async () => {
    if (pendingChanges.length === 0) return;

    try {
      setLoading(true);
      debugLog('🔄 Applying pending changes:', pendingChanges.length);

      // Process changes in batches by type
      const removeActions = pendingChanges.filter(c => c.action === 'remove');
      const moveActions = pendingChanges.filter(c => c.action === 'move');
      const addActions = pendingChanges.filter(c => c.action === 'add');

      // Process removes first
      for (const change of removeActions) {
        await processRemoveAction(change);
      }

      // Then moves  
      for (const change of moveActions) {
        await processMoveAction(change);
      }

      // Finally adds
      for (const change of addActions) {
        await processAddAction(change);
      }

      // Clear pending changes
      setPendingChanges([]);
      setShowChangeSummary(false);

      // Refresh data
      await loadAssignments();

      // Notify parent
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }

      debugLog('✅ All pending changes applied successfully');

    } catch (err) {
      debugError('❌ Error applying pending changes:', err);
      setError(`Failed to apply changes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processRemoveAction = async (change) => {
    const { data, error } = await supabase
      .from('user_assignments')
      .delete()
      .eq('id', change.assignmentId);

    if (error) throw error;
    debugLog('✅ Removed assignment:', change.assignmentId);
  };

  const processMoveAction = async (change) => {
    // Update existing assignment with new session details
    const { data, error } = await supabase
      .from('user_assignments')
      .update({
        session_identifier: change.newSessionIdentifier,
        session_id: change.newSessionId,
        group_identifier: change.newGroupIdentifier,
        training_location: change.newTrainingLocation,
        functional_area: change.newFunctionalArea,
        updated_at: new Date().toISOString()
      })
      .eq('id', change.assignmentId);

    if (error) throw error;
    debugLog('✅ Moved assignment:', change.assignmentId);
  };

  const processAddAction = async (change) => {
    const { data, error } = await supabase
      .from('user_assignments')
      .insert({
        schedule_id: schedule.id,
        end_user_id: change.userId,
        assignment_level: 'session',
        course_id: change.courseId,
        session_identifier: change.sessionIdentifier,
        session_id: change.sessionId,
        group_identifier: change.groupIdentifier,
        training_location: change.trainingLocation,
        functional_area: change.functionalArea,
        assignment_type: 'stakeholder_assigned'
      });

    if (error) throw error;
    debugLog('✅ Added assignment:', data);
  };

  // Get current assignments for a specific session - use fresh data
  const getSessionAssignments = async (sessionData) => {
    if (!sessionData || !currentSchedule?.id) return [];

    try {
      // Query fresh assignment data for this session
      const { data: allAssignments, error } = await supabase
        .from('user_assignments')
        .select(`
          *,
          end_users!inner(
            id,
            name,
            email,
            project_role,
            training_location
          )
        `)
        .eq('schedule_id', currentSchedule.id);

      if (error) {
        debugError('Error fetching session assignments:', error);
        return [];
      }

      if (!allAssignments) return [];

      // Filter for this specific session using the same logic as the calendar
      const sessionId = sessionData.eventId || sessionData.id || sessionData.session_identifier;
      
      return allAssignments.filter(assignment => {
        // Session Level
        if (assignment.assignment_level === 'session') {
          if (assignment.session_id && sessionData.id) {
            return assignment.session_id === sessionData.id;
          } else if (assignment.session_identifier) {
            return assignment.session_identifier === sessionId ||
                   assignment.session_identifier === sessionData.session_identifier ||
                   assignment.session_identifier === sessionData.eventId;
          }
        }
        // Training Location Level
        else if (assignment.assignment_level === 'training_location') {
          let sessionLocation = sessionData.training_location;
          if (!sessionLocation && sessionData.title && sessionData.title.includes('|')) {
            sessionLocation = sessionData.title.split('|')[0].trim();
          }
          const shouldInclude = !assignment.training_location || 
                               (assignment.training_location && sessionLocation && 
                                assignment.training_location === sessionLocation);
          return shouldInclude;
        }
        // Course Level
        else if (assignment.assignment_level === 'course' && 
                 assignment.course_id === (sessionData.course_id || sessionData.course?.course_id)) {
          return true;
        }
        // Group Level
        else if (assignment.assignment_level === 'group' && 
                 sessionData.title && assignment.group_identifier) {
          const groupMatch = sessionData.title.match(/Group (\d+)/);
          if (groupMatch) {
            const sessionGroupName = `Group${groupMatch[1]}`;
            
            if (assignment.group_identifier.endsWith(sessionGroupName)) {
              let sessionLocation = sessionData.training_location;
              if (!sessionLocation && sessionData.title && sessionData.title.includes('|')) {
                sessionLocation = sessionData.title.split('|')[0].trim();
              }
              
              if (!assignment.training_location || 
                  (sessionLocation && assignment.training_location === sessionLocation)) {
                return true;
              }
            }
          }
        }
        
        return false;
      });

    } catch (err) {
      debugError('Error in getSessionAssignments:', err);
      return [];
    }
  };

  // Get users not assigned to any session in the current schedule
  const getUnassignedUsers = () => {
    const assignedUserIds = new Set(assignments.map(a => a.end_user_id));
    return users.filter(user => !assignedUserIds.has(user.id));
  };

  // Generate and download training calendar
  const handleGenerateCalendar = async () => {
    try {
      setGeneratingCalendar(true);
      setCalendarError(null);
      
      debugLog('🗓️ Starting calendar generation for schedule:', currentSchedule?.name);
      
      // Validate required data
      if (!currentSchedule) {
        throw new Error('No schedule selected');
      }
      
      if (!currentSchedule.sessions || Object.keys(currentSchedule.sessions).length === 0) {
        throw new Error('No sessions found in schedule');
      }
      
      if (!assignments || assignments.length === 0) {
        throw new Error('No user assignments found. Please assign users to sessions first.');
      }
      
      // Generate calendar file
      const result = await generateTrainingCalendar(currentSchedule, currentSchedule.sessions, assignments);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Download the calendar file
      downloadCalendarFile(result.content, result.filename);
      
      debugLog('✅ Calendar generated and downloaded successfully:', {
        filename: result.filename,
        eventCount: result.eventCount,
        userCount: result.userCount
      });
      
      // Show success message briefly
      const originalError = calendarError;
      setCalendarError(`✅ Calendar downloaded: ${result.eventCount} sessions, ${result.userCount} users`);
      setTimeout(() => {
        setCalendarError(originalError);
      }, 3000);
      
    } catch (err) {
      debugError('❌ Error generating training calendar:', err);
      setCalendarError(err.message);
    } finally {
      setGeneratingCalendar(false);
    }
  };

  if (loading) {
    return (
      <div className="stakeholder-calendar-editor loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>📅 Loading Training Calendar</h2>
          <p>Preparing your schedule editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stakeholder-calendar-editor error">
        <div className="error-content">
          <h2>❌ Error Loading Calendar</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={initializeData} className="retry-btn">
              🔄 Retry
            </button>
            <button onClick={onClose} className="close-btn">
              ❌ Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stakeholder-calendar-editor">
      {/* Header */}
      <div className="editor-header">
        <div className="header-info">
          <h1>📅 Training Schedule Editor</h1>
          <h2>{currentSchedule?.name}</h2>
          <p className="schedule-description">
            Click any session to view assignments and make changes
          </p>
        </div>

        <div className="header-actions">
          {pendingChanges.length > 0 && (
            <button 
              className="changes-summary-btn"
              onClick={() => setShowChangeSummary(true)}
            >
              📝 Review Changes ({pendingChanges.length})
            </button>
          )}
          
          {!readOnlyMode && (
            <button 
              className="apply-changes-btn"
              onClick={applyPendingChanges}
              disabled={pendingChanges.length === 0}
            >
              ✅ Apply All Changes
            </button>
          )}

          <button 
            className="generate-calendar-btn"
            onClick={handleGenerateCalendar}
            disabled={generatingCalendar || !assignments || assignments.length === 0}
            title="Generate calendar file with all training sessions and attendees"
          >
            {generatingCalendar ? '⏳ Generating...' : '📧 Generate Training Calendar'}
          </button>

          <button 
            className="export-calendar-btn"
            onClick={() => setShowExportDialog(true)}
            disabled={!flattenedSessions || flattenedSessions.length === 0}
            title="Export filtered calendar data to Excel or PDF"
          >
            📊 Export Calendar Data
          </button>
          
          <button onClick={onClose} className="close-editor-btn">
            ❌ Close Editor
          </button>
        </div>
      </div>

      {/* Calendar Generation Messages */}
      {calendarError && (
        <div className={`calendar-message ${calendarError.startsWith('✅') ? 'success' : 'error'}`}>
          {calendarError}
        </div>
      )}

      {/* Main Content */}
      <div className="editor-content">
        {/* Calendar Display */}
        <div className="calendar-container">
          <EnhancedScheduleCalendar
            sessions={flattenedSessions}
            currentSchedule={currentSchedule}
            assignments={assignments}
            onSessionClick={handleSessionClick}
            readOnlyMode={readOnlyMode}
            stakeholderMode={true}
          />
        </div>

        {/* Session Edit Panel (slides in from right) */}
        {editPanelOpen && selectedSession && (
          <AsyncSessionEditPanel
            session={selectedSession}
            getSessionAssignments={getSessionAssignments}
            availableUsers={getUnassignedUsers()}
            allSessions={currentSchedule?.sessions || {}}
            onClose={handleCloseEditPanel}
            onAddPendingChange={addPendingChange}
            readOnlyMode={readOnlyMode}
          />
        )}

        {/* Change Summary Modal */}
        {showChangeSummary && (
          <ChangeSummaryPanel
            pendingChanges={pendingChanges}
            onClose={() => setShowChangeSummary(false)}
            onApplyChanges={applyPendingChanges}
            onRemoveChange={removePendingChange}
          />
        )}

        {/* Export Dialog */}
        {showExportDialog && (
          <StakeholderCalendarExportDialog
            schedule={currentSchedule}
            sessions={flattenedSessions}
            assignments={assignments}
            onClose={() => setShowExportDialog(false)}
          />
        )}
      </div>
    </div>
  );
};

// Wrapper component to handle async assignment loading for SessionEditPanel
const AsyncSessionEditPanel = ({ 
  session, 
  getSessionAssignments, 
  availableUsers, 
  allSessions, 
  onClose, 
  onAddPendingChange, 
  readOnlyMode 
}) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      try {
        const sessionAssignments = await getSessionAssignments(session);
        setAssignments(sessionAssignments);
      } catch (err) {
        debugError('Error loading session assignments:', err);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      loadAssignments();
    }
  }, [session, getSessionAssignments]);

  if (loading) {
    return (
      <div className="session-edit-panel">
        <div className="panel-header">
          <h3>Loading Session Details...</h3>
          <button onClick={onClose} className="close-btn">❌</button>
        </div>
        <div className="panel-content">
          <p>Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <SessionEditPanel
      session={session}
      assignments={assignments}
      availableUsers={availableUsers}
      allSessions={allSessions}
      onClose={onClose}
      onAddPendingChange={onAddPendingChange}
      readOnlyMode={readOnlyMode}
    />
  );
};

export default StakeholderCalendarEditor;