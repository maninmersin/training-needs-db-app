import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import {
  getSessionsForAttendance,
  getAttendanceStatuses,
  getSessionAttendees,
  getSessionAttendanceRecords,
  markSingleAttendance,
  getSessionAttendanceSummary
} from '../../services/attendanceService';
import './AttendanceTracker.css';

const AttendanceTracker = () => {
  const { currentProject } = useProject();
  const [user, setUser] = useState(null);
  
  // State management
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // UI state
  const [attendeeSearchTerm, setAttendeeSearchTerm] = useState('');
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showSummary, setShowSummary] = useState(false);
  const [attendeeComments, setAttendeeComments] = useState({});

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await SimpleAuthService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  // Load initial data
  useEffect(() => {
    if (currentProject && user) {
      loadInitialData();
    }
  }, [currentProject, user]);

  // Load session details when session is selected
  useEffect(() => {
    if (selectedSession && currentProject) {
      loadSessionDetails();
    }
  }, [selectedSession, currentProject]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [sessionsData, statusesData] = await Promise.all([
        getSessionsForAttendance(currentProject.id),
        getAttendanceStatuses()
      ]);
      
      setSessions(sessionsData);
      setAttendanceStatuses(statusesData);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Failed to load sessions and attendance data');
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async () => {
    try {
      setLoading(true);
      
      const [attendeesData, recordsData, summaryData] = await Promise.all([
        getSessionAttendees(selectedSession.id, currentProject.id),
        getSessionAttendanceRecords(selectedSession.id, currentProject.id),
        getSessionAttendanceSummary(selectedSession.id, currentProject.id)
      ]);
      
      setAttendees(attendeesData);
      setAttendanceRecords(recordsData);
      setAttendanceSummary(summaryData);
    } catch (error) {
      console.error('Error loading session details:', error);
      setError('Failed to load session attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (attendeeId, statusId, notes = '') => {
    try {
      setSubmitting(true);
      
      const attendanceData = {
        attendee_id: attendeeId,
        attendance_status_id: statusId,
        check_in_time: new Date().toISOString(),
        notes: notes,
        marked_by: user.id
      };
      
      await markSingleAttendance(selectedSession.id, currentProject.id, attendanceData);
      
      // Reload session details to update the display
      await loadSessionDetails();
      
      // Clear the comment for this attendee after successful marking
      setAttendeeComments(prev => ({
        ...prev,
        [attendeeId]: ''
      }));
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      setError('Failed to mark attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getAttendanceRecordForAttendee = (attendeeId) => {
    return attendanceRecords.find(record => record.attendee_id === attendeeId);
  };

  const getStatusById = (statusId) => {
    return attendanceStatuses.find(status => status.id === statusId);
  };

  // Filter sessions based on search
  const filteredSessions = sessions.filter(session => {
    if (!sessionSearchTerm) return true;
    const searchLower = sessionSearchTerm.toLowerCase();
    return (
      session.course_name?.toLowerCase().includes(searchLower) ||
      session.training_location?.toLowerCase().includes(searchLower) ||
      session.functional_area?.toLowerCase().includes(searchLower)
    );
  });

  // Filter attendees based on search and status
  const filteredAttendees = attendees.filter(attendee => {
    if (!attendee.user) {
      return false;
    }
    
    const matchesSearch = !attendeeSearchTerm || 
      attendee.user.name?.toLowerCase().includes(attendeeSearchTerm.toLowerCase()) ||
      attendee.user.email?.toLowerCase().includes(attendeeSearchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterStatus === 'all') return true;
    
    const record = getAttendanceRecordForAttendee(attendee.attendee_id);
    if (filterStatus === 'unmarked') return !record;
    if (filterStatus === 'present') return record && getStatusById(record.attendance_status_id)?.is_present;
    if (filterStatus === 'absent') return record && !getStatusById(record.attendance_status_id)?.is_present;
    
    return true;
  });

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-GB', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !sessions.length) {
    return (
      <div className="attendance-tracker">
        <div className="loading-state">
          <h3>Loading attendance tracker...</h3>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="attendance-tracker">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project to track attendance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-tracker">
      <div className="attendance-header">
        <h2>Attendance Tracker</h2>
        {currentProject && (
          <div className="project-indicator">
            <strong>Project:</strong> {currentProject.title}
          </div>
        )}
        <p className="attendance-description">
          Track attendance for training sessions and manage attendee participation.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="dismiss-error">×</button>
        </div>
      )}

      {/* Session Selection */}
      <div className="session-selection">
        <div className="session-selector-row">
          <div className="session-dropdown-section">
            <h3>Select Training Session</h3>
            <select 
              value={selectedSession?.id || ''} 
              onChange={(e) => {
                const session = sessions.find(s => s.id === e.target.value);
                setSelectedSession(session || null);
              }}
              className="session-dropdown"
            >
              <option value="">Choose a session...</option>
              {filteredSessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.course_name} - {formatDateTime(session.start_datetime)} - {session.training_location}
                </option>
              ))}
            </select>
          </div>
          
          <div className="session-search-section">
            <label htmlFor="session-search">Filter Sessions:</label>
            <input
              id="session-search"
              type="text"
              placeholder="Search by course, location, or area..."
              value={sessionSearchTerm}
              onChange={(e) => setSessionSearchTerm(e.target.value)}
              className="session-search-input"
            />
          </div>
        </div>
      </div>

      {/* Session Attendance */}
      {selectedSession && (
        <div className="session-attendance">
          <div className="session-header">
            <h3>Attendance for {selectedSession.course_name}</h3>
            <div className="session-meta">
              <span>{formatDateTime(selectedSession.start_datetime)}</span>
              <span>{selectedSession.training_location} - Room {selectedSession.classroom_number}</span>
            </div>
            
            {attendanceSummary && (
              <button 
                onClick={() => setShowSummary(!showSummary)}
                className="summary-toggle"
              >
                {showSummary ? 'Hide' : 'Show'} Summary
              </button>
            )}
          </div>

          {/* Attendance Summary */}
          {showSummary && attendanceSummary && (
            <div className="attendance-summary">
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-number">{attendanceSummary.total_registered}</span>
                  <span className="stat-label">Registered</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{attendanceSummary.total_attended}</span>
                  <span className="stat-label">Present</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{attendanceSummary.total_absent}</span>
                  <span className="stat-label">Absent</span>
                </div>
                <div className="stat">
                  <span className="stat-number">{Math.round(attendanceSummary.attendance_rate)}%</span>
                  <span className="stat-label">Rate</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="attendance-controls">
            <div className="search-section">
              <input
                type="text"
                placeholder="Search attendees by name or email..."
                value={attendeeSearchTerm}
                onChange={(e) => setAttendeeSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-section">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="status-filter"
              >
                <option value="all">All Attendees</option>
                <option value="unmarked">Not Marked</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          {/* Attendees List */}
          <div className="attendees-list">
            {loading ? (
              <div className="loading-attendees">Loading attendees...</div>
            ) : filteredAttendees.length === 0 ? (
              <div className="no-attendees">
                {attendeeSearchTerm || filterStatus !== 'all' 
                  ? 'No attendees match your filters' 
                  : 'No attendees assigned to this session'
                }
              </div>
            ) : (
              <div className="attendees-grid">
                {filteredAttendees.map(attendee => {
                  const record = getAttendanceRecordForAttendee(attendee.attendee_id);
                  const currentStatus = record ? getStatusById(record.attendance_status_id) : null;
                  
                  return (
                    <div key={attendee.id} className="attendee-card">
                      <div className="attendee-info">
                        <h4>{attendee.user.name}</h4>
                        <p className="attendee-email">{attendee.user.email}</p>
                        {record && record.notes && (
                          <p className="attendance-notes">📝 {record.notes}</p>
                        )}
                      </div>
                      
                      <div className="attendee-comments">
                        <label htmlFor={`comments-${attendee.attendee_id}`} className="comments-label">
                          Comments:
                        </label>
                        <textarea
                          id={`comments-${attendee.attendee_id}`}
                          placeholder="Add notes about attendance..."
                          value={attendeeComments[attendee.attendee_id] || ''}
                          onChange={(e) => setAttendeeComments(prev => ({
                            ...prev,
                            [attendee.attendee_id]: e.target.value
                          }))}
                          className="comments-textarea"
                          rows={2}
                        />
                      </div>
                      
                      <div className="attendance-actions">
                        {currentStatus ? (
                          <div className="current-status">
                            <span 
                              className="status-badge current"
                              style={{ backgroundColor: currentStatus.color_code }}
                            >
                              {currentStatus.status_name}
                            </span>
                            <span className="marked-time">
                              {new Date(record.marked_at).toLocaleTimeString('en-GB')}
                            </span>
                          </div>
                        ) : (
                          <span className="status-badge unmarked">Not Marked</span>
                        )}
                        
                        <div className="status-buttons">
                          {attendanceStatuses.map(status => (
                            <button
                              key={status.id}
                              onClick={() => handleMarkAttendance(
                                attendee.attendee_id, 
                                status.id, 
                                attendeeComments[attendee.attendee_id] || ''
                              )}
                              disabled={submitting}
                              className={`status-button ${currentStatus?.id === status.id ? 'active' : ''}`}
                              style={{ 
                                backgroundColor: status.color_code,
                                opacity: currentStatus?.id === status.id ? 1 : 0.7
                              }}
                              title={`Mark as ${status.status_name}`}
                            >
                              {status.status_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;