import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './BulkTrainerAssign.css';

const BulkTrainerAssign = ({ isOpen, onClose, selectedEvents, sessions, onApply }) => {
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTrainers();
      setShowPreview(false);
      setConflicts([]);
    }
  }, [isOpen]);

  const fetchTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from('trainers')
        .select('id, name, email, specializations, active')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setTrainers(data || []);
    } catch (error) {
      console.error('Error fetching trainers:', error);
      setError('Failed to load trainers');
    }
  };

  const getSelectedSessionsData = () => {
    const selectedSessionsData = [];
    Object.entries(sessions).forEach(([location, functionalAreas]) => {
      Object.entries(functionalAreas).forEach(([functionalArea, sessionList]) => {
        sessionList.forEach(session => {
          const eventId = session.eventId || `${session.title}-${session.start.getTime()}-${session.end.getTime()}`;
          if (selectedEvents.has(eventId)) {
            selectedSessionsData.push({
              ...session,
              eventId,
              location,
              functionalArea
            });
          }
        });
      });
    });
    return selectedSessionsData;
  };

  const checkForConflicts = (trainerId) => {
    if (!trainerId) return [];

    const selectedSessionsData = getSelectedSessionsData();
    const conflicts = [];

    // Sort sessions by start time
    selectedSessionsData.sort((a, b) => new Date(a.start) - new Date(b.start));

    // Check for overlapping time slots
    for (let i = 0; i < selectedSessionsData.length - 1; i++) {
      const current = selectedSessionsData[i];
      const next = selectedSessionsData[i + 1];
      
      if (new Date(current.end) > new Date(next.start)) {
        conflicts.push({
          type: 'time_overlap',
          sessions: [current, next],
          message: `Time conflict between "${current.title}" and "${next.title}"`
        });
      }
    }

    // Check trainer availability (if we had that data)
    // This is a placeholder for future implementation
    
    return conflicts;
  };

  const handleTrainerChange = (trainerId) => {
    setSelectedTrainer(trainerId);
    const conflictList = checkForConflicts(trainerId);
    setConflicts(conflictList);
  };

  const handlePreview = () => {
    if (!selectedTrainer) {
      setError('Please select a trainer');
      return;
    }
    setShowPreview(true);
  };

  const handleApply = async () => {
    if (!selectedTrainer) {
      setError('Please select a trainer');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedTrainerData = trainers.find(t => t.id === selectedTrainer);
      const selectedSessionsData = getSelectedSessionsData();

      // Apply trainer to all selected sessions
      const updatedSessions = { ...sessions };
      
      selectedSessionsData.forEach(sessionData => {
        const { location, functionalArea, eventId } = sessionData;
        
        if (updatedSessions[location] && updatedSessions[location][functionalArea]) {
          updatedSessions[location][functionalArea] = updatedSessions[location][functionalArea].map(session => {
            const currentEventId = session.eventId || `${session.title}-${session.start.getTime()}-${session.end.getTime()}`;
            if (currentEventId === eventId) {
              return {
                ...session,
                trainer_id: selectedTrainer,
                trainer_name: selectedTrainerData.name
              };
            }
            return session;
          });
        }
      });

      await onApply(updatedSessions);
      onClose();
    } catch (error) {
      console.error('Error applying trainer assignment:', error);
      setError('Failed to apply trainer assignment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedSessionsData = getSelectedSessionsData();
  const selectedTrainerData = trainers.find(t => t.id === selectedTrainer);

  return (
    <div className="bulk-trainer-overlay">
      <div className="bulk-trainer-modal">
        <div className="modal-header">
          <h3>Assign Trainer to {selectedEvents.size} Events</h3>
          <button onClick={onClose} className="close-btn" disabled={loading}>
            ×
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="modal-content">
          {!showPreview ? (
            <>
              <div className="trainer-selection">
                <label htmlFor="trainer-select">Select Trainer:</label>
                <select
                  id="trainer-select"
                  value={selectedTrainer}
                  onChange={(e) => handleTrainerChange(e.target.value)}
                  className="trainer-select"
                >
                  <option value="">Choose a trainer...</option>
                  {trainers.map(trainer => (
                    <option key={trainer.id} value={trainer.id}>
                      {trainer.name} {trainer.email && `(${trainer.email})`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTrainerData && (
                <div className="trainer-info">
                  <h4>{selectedTrainerData.name}</h4>
                  {selectedTrainerData.specializations && selectedTrainerData.specializations.length > 0 && (
                    <div className="specializations">
                      <strong>Specializations:</strong>
                      {selectedTrainerData.specializations.map((spec, index) => (
                        <span key={index} className="specialization-badge">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {conflicts.length > 0 && (
                <div className="conflicts-section">
                  <h4>⚠️ Conflicts Detected</h4>
                  {conflicts.map((conflict, index) => (
                    <div key={index} className="conflict-item">
                      <span className="conflict-message">{conflict.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="selected-events-preview">
                <h4>Selected Events ({selectedEvents.size}):</h4>
                <div className="events-list">
                  {selectedSessionsData.slice(0, 5).map((session, index) => (
                    <div key={index} className="event-item">
                      <div className="event-title">{session.title}</div>
                      <div className="event-time">
                        {session.start.toLocaleDateString('en-GB')} {session.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {selectedSessionsData.length > 5 && (
                    <div className="more-events">
                      ... and {selectedSessionsData.length - 5} more events
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="preview-section">
              <h4>Preview Changes</h4>
              <div className="preview-summary">
                <p><strong>Trainer:</strong> {selectedTrainerData?.name}</p>
                <p><strong>Events to update:</strong> {selectedEvents.size}</p>
                {conflicts.length > 0 && (
                  <p className="warning"><strong>Conflicts:</strong> {conflicts.length} time conflicts detected</p>
                )}
              </div>
              
              <div className="preview-events">
                {selectedSessionsData.map((session, index) => (
                  <div key={index} className="preview-event-item">
                    <div className="event-title">{session.title}</div>
                    <div className="event-change">
                      <span className="change-from">
                        From: {session.trainer_name || 'No trainer'}
                      </span>
                      <span className="change-arrow">→</span>
                      <span className="change-to">
                        To: {selectedTrainerData?.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn" disabled={loading}>
            Cancel
          </button>
          {!showPreview ? (
            <button onClick={handlePreview} className="preview-btn" disabled={!selectedTrainer}>
              Preview Changes
            </button>
          ) : (
            <>
              <button onClick={() => setShowPreview(false)} className="back-btn">
                Back to Edit
              </button>
              <button 
                onClick={handleApply} 
                className="apply-btn" 
                disabled={loading}
              >
                {loading ? 'Applying...' : 'Apply Changes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkTrainerAssign;