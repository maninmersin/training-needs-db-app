import React, { useState, useEffect, useMemo } from 'react';
import UserActionControls from '../assignments/UserActionControls';
import { debugLog, debugWarn, debugError } from '@core/utils/consoleUtils';
import './SessionEditPanel.css';

/**
 * Session Edit Panel - Slides in from right when user clicks a calendar session
 * 
 * Provides guided editing interface for session assignments:
 * - Shows current users assigned to session
 * - Provides clear action buttons (Keep/Remove/Move)
 * - Handles capacity validation
 * - Manages pending changes
 */
const SessionEditPanel = ({
  session,
  assignments,
  availableUsers,
  allSessions,
  onClose,
  onAddPendingChange,
  readOnlyMode = false
}) => {
  const [localPendingChanges, setLocalPendingChanges] = useState([]);
  const [capacityInfo, setCapacityInfo] = useState({});
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedNewUser, setSelectedNewUser] = useState('');

  debugLog('📝 SessionEditPanel opened for session:', session?.title);

  useEffect(() => {
    calculateCapacityInfo();
  }, [session, assignments, localPendingChanges]);

  const calculateCapacityInfo = () => {
    if (!session) return;

    const currentAssignments = assignments.length;
    const maxCapacity = session.max_attendees || session.max_participants || 25;
    
    // Account for pending changes
    const pendingAdds = localPendingChanges.filter(c => c.action === 'add').length;
    const pendingRemoves = localPendingChanges.filter(c => c.action === 'remove').length;
    const pendingMoves = localPendingChanges.filter(c => c.action === 'move');
    
    const projectedCount = currentAssignments + pendingAdds - pendingRemoves;
    const available = Math.max(0, maxCapacity - projectedCount);
    
    setCapacityInfo({
      current: currentAssignments,
      pending: pendingAdds - pendingRemoves,
      projected: projectedCount,
      maximum: maxCapacity,
      available,
      isOverCapacity: projectedCount > maxCapacity
    });

    debugLog('📊 Capacity calculated:', {
      current: currentAssignments,
      projected: projectedCount,
      maximum: maxCapacity,
      available
    });
  };

  // Get alternative sessions user could be moved to
  const getAlternativeSessionsForUser = (assignment) => {
    if (!allSessions || !assignment) return [];

    const alternatives = [];
    const currentCourseId = assignment.course_id;

    // Flatten sessions from nested structure
    const flatSessions = [];
    Object.values(allSessions).forEach(functionalArea => {
      Object.values(functionalArea).forEach(location => {
        Object.values(location).forEach(classroom => {
          if (Array.isArray(classroom)) {
            flatSessions.push(...classroom);
          }
        });
      });
    });

    // Find alternative sessions for same course
    const courseAlternatives = flatSessions.filter(s => 
      s.course_id === currentCourseId && 
      s.session_identifier !== session.session_identifier
    );

    // Find alternative courses (different course entirely)
    const courseAlternativeMap = new Map();
    flatSessions
      .filter(s => s.course_id !== currentCourseId)
      .forEach(s => {
        const key = `${s.course_id}-${s.course_name}`;
        if (!courseAlternativeMap.has(key)) {
          courseAlternativeMap.set(key, {
            course_id: s.course_id,
            course_name: s.course_name,
            sessions: []
          });
        }
        courseAlternativeMap.get(key).sessions.push(s);
      });

    return {
      sameCourseSessions: courseAlternatives,
      otherCourses: Array.from(courseAlternativeMap.values())
    };
  };

  // Handle user action selection
  const handleUserAction = (assignment, action, destination = null) => {
    debugLog('🎯 User action selected:', { 
      user: assignment.end_users?.name,
      action, 
      destination 
    });

    const changeId = `${Date.now()}-${Math.random()}`;
    let change = {
      id: changeId,
      action,
      userId: assignment.end_user_id,
      userName: assignment.end_users?.name || 'Unknown User',
      sessionId: session.session_identifier,
      sessionTitle: session.title,
      assignmentId: assignment.id
    };

    switch (action) {
      case 'remove':
        change = {
          ...change,
          description: `Remove ${assignment.end_users?.name} from ${session.title}`
        };
        break;

      case 'move':
        if (destination) {
          change = {
            ...change,
            newSessionId: destination.session_identifier,
            newSessionTitle: destination.title,
            newSessionIdentifier: destination.session_identifier,
            newGroupIdentifier: destination.group_identifier || destination.groupName,
            newTrainingLocation: destination.training_location || destination.location,
            newFunctionalArea: destination.functional_area,
            description: `Move ${assignment.end_users?.name} from ${session.title} to ${destination.title}`
          };
        }
        break;

      case 'add':
        // Handled separately in handleAddUser
        break;

      default:
        debugWarn('⚠️ Unknown action type:', action);
        return;
    }

    // Add to local pending changes for immediate UI feedback
    setLocalPendingChanges(prev => [...prev, change]);

    // Send to parent component
    onAddPendingChange(change);
  };

  // Handle adding new user to session
  const handleAddUser = () => {
    if (!selectedNewUser) return;

    const user = availableUsers.find(u => u.id === parseInt(selectedNewUser));
    if (!user) return;

    debugLog('➕ Adding user to session:', { 
      user: user.name, 
      session: session.title 
    });

    const changeId = `${Date.now()}-${Math.random()}`;
    const change = {
      id: changeId,
      action: 'add',
      userId: user.id,
      userName: user.name,
      sessionId: session.session_identifier,
      sessionTitle: session.title,
      sessionIdentifier: session.session_identifier,
      groupIdentifier: session.group_identifier || session.groupName,
      trainingLocation: session.training_location || session.location,
      functionalArea: session.functional_area,
      courseId: session.course_id,
      description: `Add ${user.name} to ${session.title}`
    };

    setLocalPendingChanges(prev => [...prev, change]);
    onAddPendingChange(change);

    // Reset add user controls
    setSelectedNewUser('');
    setShowAddUser(false);
  };

  // Get users with pending actions applied
  const getDisplayAssignments = () => {
    let displayAssignments = [...assignments];

    // Apply pending changes for display purposes
    localPendingChanges.forEach(change => {
      if (change.action === 'remove') {
        displayAssignments = displayAssignments.filter(a => a.id !== change.assignmentId);
      } else if (change.action === 'move') {
        displayAssignments = displayAssignments.filter(a => a.id !== change.assignmentId);
      } else if (change.action === 'add') {
        // Add a mock assignment for display
        const user = availableUsers.find(u => u.id === change.userId);
        if (user) {
          displayAssignments.push({
            id: `pending-${change.id}`,
            end_user_id: user.id,
            end_users: user,
            isPending: true,
            pendingAction: 'add'
          });
        }
      }
    });

    return displayAssignments;
  };

  const displayAssignments = getDisplayAssignments();

  return (
    <div className="session-edit-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="session-info">
          <h3>📝 Edit Session</h3>
          <h4>{session.title}</h4>
          <div className="session-details">
            <span className="session-time">
              🕐 {new Date(session.start).toLocaleDateString('en-GB')} {' '}
              {new Date(session.start).toLocaleTimeString('en-GB', {
                hour: '2-digit', 
                minute: '2-digit'
              })}
            </span>
            <span className="session-location">
              📍 {session.training_location || session.location}
            </span>
          </div>
        </div>

        <button className="close-panel-btn" onClick={onClose}>
          ❌
        </button>
      </div>

      {/* Capacity Info */}
      <div className={`capacity-info ${capacityInfo.isOverCapacity ? 'over-capacity' : ''}`}>
        <div className="capacity-bar">
          <div 
            className="capacity-fill"
            style={{ 
              width: `${Math.min(100, (capacityInfo.projected / capacityInfo.maximum) * 100)}%` 
            }}
          />
        </div>
        <div className="capacity-text">
          <span className="current-count">
            {capacityInfo.projected} / {capacityInfo.maximum} assigned
          </span>
          {capacityInfo.pending !== 0 && (
            <span className="pending-changes">
              ({capacityInfo.pending > 0 ? '+' : ''}{capacityInfo.pending} pending)
            </span>
          )}
          {capacityInfo.isOverCapacity && (
            <span className="over-capacity-warning">
              ⚠️ Over capacity
            </span>
          )}
        </div>
      </div>

      {/* Current Assignments */}
      <div className="current-assignments">
        <h4>👥 Currently Assigned ({displayAssignments.length})</h4>
        
        {displayAssignments.length === 0 ? (
          <div className="no-assignments">
            <p>No users currently assigned to this session.</p>
          </div>
        ) : (
          <div className="assignment-list">
            {displayAssignments.map(assignment => {
              const isPending = assignment.isPending;
              const alternatives = isPending ? {} : getAlternativeSessionsForUser(assignment);

              return (
                <div 
                  key={assignment.id}
                  className={`assignment-item ${isPending ? 'pending' : ''}`}
                >
                  <div className="user-info">
                    <span className="user-name">
                      {assignment.end_users?.name || 'Unknown User'}
                    </span>
                    <span className="user-details">
                      {assignment.end_users?.project_role} • {assignment.end_users?.training_location}
                    </span>
                    {isPending && (
                      <span className="pending-badge">
                        ➕ Pending Addition
                      </span>
                    )}
                  </div>

                  {!readOnlyMode && !isPending && (
                    <UserActionControls
                      assignment={assignment}
                      alternatives={alternatives}
                      onAction={(action, destination) => 
                        handleUserAction(assignment, action, destination)
                      }
                      capacityInfo={capacityInfo}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New User */}
      {!readOnlyMode && (
        <div className="add-user-section">
          <h4>➕ Add User to Session</h4>
          
          {capacityInfo.available <= 0 ? (
            <div className="no-capacity-warning">
              <p>⚠️ This session is at full capacity. Remove users first or increase capacity.</p>
            </div>
          ) : !showAddUser ? (
            <button 
              className="show-add-user-btn"
              onClick={() => setShowAddUser(true)}
              disabled={availableUsers.length === 0}
            >
              ➕ Add Available User ({availableUsers.length} available)
            </button>
          ) : (
            <div className="add-user-controls">
              <select 
                value={selectedNewUser}
                onChange={(e) => setSelectedNewUser(e.target.value)}
                className="user-select"
              >
                <option value="">Select a user...</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.project_role} ({user.training_location})
                  </option>
                ))}
              </select>
              
              <div className="add-user-actions">
                <button 
                  className="add-user-btn"
                  onClick={handleAddUser}
                  disabled={!selectedNewUser}
                >
                  ✅ Add User
                </button>
                <button 
                  className="cancel-add-btn"
                  onClick={() => {
                    setShowAddUser(false);
                    setSelectedNewUser('');
                  }}
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Panel Footer */}
      <div className="panel-footer">
        <div className="pending-changes-info">
          {localPendingChanges.length > 0 ? (
            <span className="changes-count">
              📝 {localPendingChanges.length} change(s) pending for this session
            </span>
          ) : (
            <span className="no-changes">
              No pending changes for this session
            </span>
          )}
        </div>
        
        <button className="close-panel-btn" onClick={onClose}>
          Close Panel
        </button>
      </div>
    </div>
  );
};

export default SessionEditPanel;