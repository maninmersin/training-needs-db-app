import React, { useState, useEffect } from 'react';
import { useProject } from '@core/contexts/ProjectContext';
import { supabase } from '@core/services/supabaseClient';
import {
  getAttendanceStatistics,
  exportAttendanceData,
  getSessionsForAttendance,
  getAttendeeHistory
} from '../../services/attendanceService';
import * as XLSX from 'xlsx';
import './AttendanceReports.css';

const AttendanceReports = () => {
  const { currentProject } = useProject();
  
  // State management
  const [statistics, setStatistics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [attendeeHistory, setAttendeeHistory] = useState([]);
  
  // Modal state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionAttendees, setSessionAttendees] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    functionalArea: '',
    trainingLocation: ''
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('overview'); // overview, sessions, individual

  // Available filter options
  const [functionalAreas, setFunctionalAreas] = useState([]);
  const [trainingLocations, setTrainingLocations] = useState([]);

  // Load initial data
  useEffect(() => {
    if (currentProject) {
      loadReportsData();
    }
  }, [currentProject, filters]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statsData, sessionsData] = await Promise.all([
        getAttendanceStatistics(currentProject.id, filters),
        getSessionsForAttendance(currentProject.id)
      ]);
      
      setStatistics(statsData);
      setSessions(sessionsData);
      
      // Extract unique functional areas and training locations for filters
      const uniqueFunctionalAreas = [...new Set(sessionsData.map(s => s.functional_area))];
      const uniqueTrainingLocations = [...new Set(sessionsData.map(s => s.training_location))];
      
      setFunctionalAreas(uniqueFunctionalAreas);
      setTrainingLocations(uniqueTrainingLocations);
      
    } catch (error) {
      console.error('Error loading reports data:', error);
      setError('Failed to load attendance reports');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      functionalArea: '',
      trainingLocation: ''
    });
  };

  const handleExportData = async (format = 'excel') => {
    try {
      setExporting(true);
      
      const exportData = await exportAttendanceData(currentProject.id, filters);
      
      if (exportData.length === 0) {
        alert('No attendance data found for the selected filters.');
        return;
      }

      const filename = `attendance-report-${new Date().toISOString().split('T')[0]}`;
      
      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else {
        // CSV format
        const csvData = [
          Object.keys(exportData[0]),
          ...exportData.map(row => Object.values(row))
        ];
        const csvContent = csvData.map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export attendance data');
    } finally {
      setExporting(false);
    }
  };

  const handleViewSessionDetails = async (session) => {
    try {
      setSelectedSession(session);
      setShowSessionModal(true);
      setSessionAttendees([]); // Reset while loading
      
      // Fetch attendance records for this session
      const attendees = await getSessionAttendees(currentProject.id, session.id);
      setSessionAttendees(attendees);
    } catch (error) {
      console.error('Error loading session attendees:', error);
      setError('Failed to load session attendees');
    }
  };

  const getSessionAttendees = async (projectId, sessionId) => {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        notes,
        marked_at,
        attendee_id,
        attendance_statuses!fk_attendance_records_status (
          status_name,
          is_present,
          color_code
        )
      `)
      .eq('project_id', projectId)
      .eq('session_id', sessionId);

    if (error) {
      throw error;
    }

    // If we have data, fetch the end user details separately
    if (data && data.length > 0) {
      const attendeeIds = [...new Set(data.map(record => record.attendee_id))];
      
      const { data: users, error: usersError } = await supabase
        .from('end_users')
        .select('id, name, email')
        .eq('project_id', projectId)
        .in('id', attendeeIds);

      if (usersError) {
        console.warn('Could not fetch user details:', usersError);
        return data.map(record => ({
          ...record,
          end_users: { name: 'Unknown User' }
        }));
      }

      // Join the data manually
      return data.map(record => ({
        ...record,
        end_users: users.find(user => user.id === record.attendee_id) || { name: 'Unknown User' }
      }));
    }

    return data || [];
  };

  const closeSessionModal = () => {
    setShowSessionModal(false);
    setSelectedSession(null);
    setSessionAttendees([]);
  };

  const formatPercentage = (value) => {
    return `${Math.round(value)}%`;
  };

  const getAttendanceRateColor = (rate) => {
    if (rate >= 90) return '#28a745';
    if (rate >= 75) return '#ffc107';
    if (rate >= 60) return '#fd7e14';
    return '#dc3545';
  };

  if (loading && !statistics) {
    return (
      <div className="attendance-reports">
        <div className="loading-state">
          <h3>Loading attendance reports...</h3>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="attendance-reports">
        <div className="no-project-state">
          <h3>No Project Selected</h3>
          <p>Please select a project to view attendance reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-reports">
      <div className="reports-header">
        <h2>Attendance Reports & Analytics</h2>
        {currentProject && (
          <div className="project-indicator">
            <strong>Project:</strong> {currentProject.title}
          </div>
        )}
        <p className="reports-description">
          Analyze attendance patterns, generate reports, and track training effectiveness.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="dismiss-error">×</button>
        </div>
      )}

      {/* View Navigation */}
      <div className="view-navigation">
        <button
          className={`nav-btn ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveView('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`nav-btn ${activeView === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveView('sessions')}
        >
          📅 By Session
        </button>
        <button
          className={`nav-btn ${activeView === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveView('individual')}
        >
          👤 Individual
        </button>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Functional Area</label>
            <select
              value={filters.functionalArea}
              onChange={(e) => handleFilterChange('functionalArea', e.target.value)}
            >
              <option value="">All Areas</option>
              {functionalAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Training Location</label>
            <select
              value={filters.trainingLocation}
              onChange={(e) => handleFilterChange('trainingLocation', e.target.value)}
            >
              <option value="">All Locations</option>
              {trainingLocations.map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <button onClick={resetFilters} className="reset-filters-btn">
            Reset Filters
          </button>
          <div className="export-buttons">
            <button
              onClick={() => handleExportData('excel')}
              disabled={exporting}
              className="export-btn excel"
            >
              📊 Export Excel
            </button>
            <button
              onClick={() => handleExportData('csv')}
              disabled={exporting}
              className="export-btn csv"
            >
              📄 Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <div className="overview-section">
          {statistics ? (
            <>
              {/* Overall Statistics */}
              <div className="stats-overview">
                <h3>Overall Statistics</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                      <span className="stat-value">{statistics.overall?.total_records || 0}</span>
                      <span className="stat-label">Total Records</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <span className="stat-value">{statistics.overall?.total_present || 0}</span>
                      <span className="stat-label">Present</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">❌</div>
                    <div className="stat-content">
                      <span className="stat-value">{statistics.overall?.total_absent || 0}</span>
                      <span className="stat-label">Absent</span>
                    </div>
                  </div>
                  <div className="stat-card attendance-rate">
                    <div className="stat-icon">📈</div>
                    <div className="stat-content">
                      <span 
                        className="stat-value"
                        style={{ color: getAttendanceRateColor(statistics.overall?.attendance_rate || 0) }}
                      >
                        {formatPercentage(statistics.overall?.attendance_rate || 0)}
                      </span>
                      <span className="stat-label">Attendance Rate</span>
                    </div>
                  </div>
            </div>
          </div>

              {/* By Functional Area */}
              <div className="functional-area-breakdown">
                <h3>Attendance by Functional Area</h3>
                <div className="area-cards">
                  {statistics.by_functional_area && Object.entries(statistics.by_functional_area).map(([area, stats]) => (
                <div key={area} className="area-card">
                  <div className="area-header">
                    <h4>{area}</h4>
                    <span 
                      className="area-rate"
                      style={{ color: getAttendanceRateColor(stats.attendance_rate) }}
                    >
                      {formatPercentage(stats.attendance_rate)}
                    </span>
                  </div>
                  <div className="area-stats">
                    <div className="area-stat">
                      <span className="area-stat-value">{stats.present}</span>
                      <span className="area-stat-label">Present</span>
                    </div>
                    <div className="area-stat">
                      <span className="area-stat-value">{stats.total - stats.present}</span>
                      <span className="area-stat-label">Absent</span>
                    </div>
                    <div className="area-stat">
                      <span className="area-stat-value">{stats.total}</span>
                      <span className="area-stat-label">Total</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${stats.attendance_rate}%`,
                        backgroundColor: getAttendanceRateColor(stats.attendance_rate)
                      }}
                    ></div>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="no-data-state">
              <h3>No Attendance Data Available</h3>
              <p>No attendance records found for the current filters. Try adjusting your date range or clearing filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Sessions View */}
      {activeView === 'sessions' && (
        <div className="sessions-section">
          <h3>Session-wise Attendance</h3>
          {loading ? (
            <div className="loading-sessions">Loading session data...</div>
          ) : (
            <div className="sessions-table">
              <div className="table-header">
                <span>Course</span>
                <span>Date & Time</span>
                <span>Location</span>
                <span>Functional Area</span>
                <span>Attendance</span>
              </div>
              {sessions.map(session => (
                <div key={session.id} className="table-row">
                  <span className="session-course">{session.course_name}</span>
                  <span className="session-datetime">
                    {new Date(session.start_datetime).toLocaleString('en-GB')}
                  </span>
                  <span className="session-location">
                    {session.training_location} - Room {session.classroom_number}
                  </span>
                  <span className="session-area">{session.functional_area}</span>
                  <span className="session-attendance">
                    <button 
                      className="attendance-badge view-details-btn"
                      onClick={() => handleViewSessionDetails(session)}
                    >
                      View Details
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Individual View */}
      {activeView === 'individual' && (
        <div className="individual-section">
          <h3>Individual Attendance History</h3>
          <div className="individual-search">
            <input
              type="text"
              placeholder="Search for an attendee..."
              className="attendee-search"
            />
            <button className="search-btn">Search</button>
          </div>
          
          {selectedAttendee && (
            <div className="attendee-details">
              <h4>{selectedAttendee.name}</h4>
              <div className="attendee-stats">
                <div className="attendee-stat">
                  <span className="stat-value">85%</span>
                  <span className="stat-label">Attendance Rate</span>
                </div>
                <div className="attendee-stat">
                  <span className="stat-value">12</span>
                  <span className="stat-label">Sessions Attended</span>
                </div>
                <div className="attendee-stat">
                  <span className="stat-value">2</span>
                  <span className="stat-label">Sessions Missed</span>
                </div>
              </div>
              
              <div className="attendance-history">
                <h5>Recent Attendance</h5>
                {/* Attendance history would go here */}
                <div className="history-placeholder">
                  <p>Select an attendee to view their attendance history</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {exporting && (
        <div className="export-overlay">
          <div className="export-message">
            <div className="loading-spinner"></div>
            <p>Exporting attendance data...</p>
          </div>
        </div>
      )}

      {/* Session Attendees Modal */}
      {showSessionModal && selectedSession && (
        <div className="modal-overlay" onClick={closeSessionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Session Attendees</h3>
              <button className="modal-close" onClick={closeSessionModal}>×</button>
            </div>
            
            <div className="modal-session-info">
              <div className="session-info-grid">
                <div><strong>Course:</strong> {selectedSession.course_name}</div>
                <div><strong>Date:</strong> {new Date(selectedSession.start_datetime).toLocaleDateString('en-GB')}</div>
                <div><strong>Time:</strong> {new Date(selectedSession.start_datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                <div><strong>Location:</strong> {selectedSession.training_location}</div>
                <div><strong>Area:</strong> {selectedSession.functional_area}</div>
              </div>
            </div>

            <div className="modal-body">
              {sessionAttendees.length === 0 ? (
                <div className="loading-attendees">
                  <div className="loading-spinner"></div>
                  <p>Loading attendees...</p>
                </div>
              ) : (
                <div className="attendees-table">
                  <div className="attendees-header">
                    <span>Name</span>
                    <span>Status</span>
                    <span>Notes</span>
                  </div>
                  {sessionAttendees.map(attendee => (
                    <div key={attendee.id} className="attendee-row">
                      <span className="attendee-name">
                        {attendee.end_users?.name || 'Unknown User'}
                      </span>
                      <span className="attendee-status">
                        <span 
                          className="status-badge"
                          style={{ 
                            backgroundColor: attendee.attendance_statuses?.color_code || '#6c757d',
                            color: 'white'
                          }}
                        >
                          {attendee.attendance_statuses?.status_name || 'Unknown'}
                        </span>
                      </span>
                      <span className="attendee-notes">
                        {attendee.notes || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReports;