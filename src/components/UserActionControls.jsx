import React, { useState } from 'react';
import { debugLog, debugWarn } from '../utils/consoleUtils';
import './UserActionControls.css';

/**
 * User Action Controls - Guided action buttons for each assigned user
 * 
 * Provides simple, clear actions:
 * - Keep (default, no action)
 * - Remove from session
 * - Move to different group (same course)
 * - Transfer to different course
 */
const UserActionControls = ({
  assignment,
  alternatives,
  onAction,
  capacityInfo
}) => {
  const [actionMode, setActionMode] = useState('keep'); // keep, remove, move, transfer
  const [moveDestination, setMoveDestination] = useState('');
  const [showDestinations, setShowDestinations] = useState(false);

  const handleActionChange = (newAction) => {
    debugLog('🎯 Action changed for user:', assignment.end_users?.name, 'to:', newAction);
    
    setActionMode(newAction);
    setMoveDestination('');
    setShowDestinations(newAction === 'move' || newAction === 'transfer');

    // If removing, trigger immediately
    if (newAction === 'remove') {
      onAction('remove');
    }
  };

  const handleDestinationSelect = () => {
    if (!moveDestination) return;

    debugLog('🎯 Destination selected:', moveDestination);

    // Parse destination to find session data
    let destinationSession = null;

    // Check same-course sessions first
    if (alternatives.sameCourseSessions) {
      destinationSession = alternatives.sameCourseSessions.find(s => 
        s.session_identifier === moveDestination || s.eventId === moveDestination
      );
    }

    // Check other courses if not found
    if (!destinationSession && alternatives.otherCourses) {
      for (const course of alternatives.otherCourses) {
        destinationSession = course.sessions.find(s => 
          s.session_identifier === moveDestination || s.eventId === moveDestination
        );
        if (destinationSession) break;
      }
    }

    if (destinationSession) {
      onAction('move', destinationSession);
    } else {
      debugWarn('⚠️ Could not find destination session:', moveDestination);
    }
  };

  const hasAlternatives = 
    (alternatives.sameCourseSessions && alternatives.sameCourseSessions.length > 0) ||
    (alternatives.otherCourses && alternatives.otherCourses.length > 0);

  return (
    <div className="user-action-controls">
      {/* Action Selection Buttons */}
      <div className="action-buttons">
        <button
          className={`action-btn keep-btn ${actionMode === 'keep' ? 'active' : ''}`}
          onClick={() => handleActionChange('keep')}
        >
          ✅ Keep
        </button>

        <button
          className={`action-btn remove-btn ${actionMode === 'remove' ? 'active' : ''}`}
          onClick={() => handleActionChange('remove')}
        >
          🗑️ Remove
        </button>

        {hasAlternatives && (
          <button
            className={`action-btn move-btn ${actionMode === 'move' ? 'active' : ''}`}
            onClick={() => handleActionChange('move')}
          >
            🔄 Move
          </button>
        )}
      </div>

      {/* Destination Selection (shown when moving) */}
      {showDestinations && (
        <div className="destination-selection">
          <div className="destination-header">
            <h5>📍 Select Destination:</h5>
          </div>

          {/* Same Course Options */}
          {alternatives.sameCourseSessions && alternatives.sameCourseSessions.length > 0 && (
            <div className="destination-group">
              <h6>🎯 Same Course - Different Groups:</h6>
              <select
                value={moveDestination}
                onChange={(e) => setMoveDestination(e.target.value)}
                className="destination-select"
              >
                <option value="">Select group...</option>
                {alternatives.sameCourseSessions.map(session => (
                  <option 
                    key={session.session_identifier || session.eventId} 
                    value={session.session_identifier || session.eventId}
                  >
                    {session.title} - {session.training_location || session.location}
                    {session.start && ` (${new Date(session.start).toLocaleDateString('en-GB')})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Different Course Options */}
          {alternatives.otherCourses && alternatives.otherCourses.length > 0 && (
            <div className="destination-group">
              <h6>📚 Transfer to Different Course:</h6>
              
              {alternatives.otherCourses.map(course => (
                <div key={course.course_id} className="course-group">
                  <div className="course-header">
                    <strong>{course.course_name}</strong>
                  </div>
                  <select
                    value={moveDestination}
                    onChange={(e) => setMoveDestination(e.target.value)}
                    className="destination-select"
                  >
                    <option value="">Select session...</option>
                    {course.sessions.map(session => (
                      <option 
                        key={session.session_identifier || session.eventId} 
                        value={session.session_identifier || session.eventId}
                      >
                        {session.title} - {session.training_location || session.location}
                        {session.start && ` (${new Date(session.start).toLocaleDateString('en-GB')})`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="destination-actions">
            <button
              className="confirm-move-btn"
              onClick={handleDestinationSelect}
              disabled={!moveDestination}
            >
              ✅ Confirm Move
            </button>
            <button
              className="cancel-move-btn"
              onClick={() => {
                setActionMode('keep');
                setMoveDestination('');
                setShowDestinations(false);
              }}
            >
              ❌ Cancel
            </button>
          </div>

          {/* Capacity Warning */}
          {moveDestination && (
            <div className="capacity-warning">
              <p className="warning-text">
                ⚠️ Make sure destination session has available capacity
              </p>
            </div>
          )}
        </div>
      )}

      {/* No Alternatives Message */}
      {!hasAlternatives && actionMode === 'move' && (
        <div className="no-alternatives">
          <p>ℹ️ No alternative sessions available for this user</p>
          <button
            className="back-to-keep-btn"
            onClick={() => handleActionChange('keep')}
          >
            ← Back to Keep
          </button>
        </div>
      )}

      {/* Action Status */}
      <div className="action-status">
        {actionMode === 'keep' && (
          <span className="status-keep">✅ User will remain in this session</span>
        )}
        {actionMode === 'remove' && (
          <span className="status-remove">🗑️ User will be removed from this session</span>
        )}
        {actionMode === 'move' && moveDestination && (
          <span className="status-move">🔄 User will be moved to selected destination</span>
        )}
        {actionMode === 'move' && !moveDestination && (
          <span className="status-pending">📍 Select destination above</span>
        )}
      </div>
    </div>
  );
};

export default UserActionControls;