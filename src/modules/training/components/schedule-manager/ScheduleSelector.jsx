import React, { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { format } from 'date-fns';
import './ScheduleSelector.css';

const ScheduleSelector = ({ schedules, onScheduleSelect, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [scheduleStats, setScheduleStats] = useState({});
  const [cssLoaded, setCssLoaded] = useState(false);

  // Ensure CSS is loaded before rendering table
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready and CSS is applied
    const rafId = requestAnimationFrame(() => {
      // Additional small delay to ensure CSS classes are fully applied
      const timer = setTimeout(() => {
        setCssLoaded(true);
      }, 100); // Increased delay to 100ms
      
      return timer;
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Fetch schedule statistics when schedules change
  useEffect(() => {
    if (schedules.length > 0) {
      fetchScheduleStatistics();
    }
  }, [schedules]);

  const fetchScheduleStatistics = async () => {
    try {
      const stats = {};
      
      // Fetch statistics for all schedules in parallel
      const statsPromises = schedules.map(async (schedule) => {
        const { data: sessions, error } = await supabase
          .from('training_sessions')
          .select('id, course_id, course_name, training_location, functional_area')
          .eq('schedule_id', schedule.id);

        if (error) {
          console.error('Error fetching sessions for schedule:', schedule.id, error);
          return {
            scheduleId: schedule.id,
            uniqueCourses: 0,
            totalSessions: 0,
            locations: 0,
            functionalAreas: 0,
            assignedSessions: 0,
            assignmentPercentage: 0
          };
        }

        // Fetch assignment data for this schedule
        const { data: assignments, error: assignmentError } = await supabase
          .from('user_assignments')
          .select('session_identifier')
          .eq('schedule_id', schedule.id)
          .eq('assignment_level', 'session')
          .not('session_identifier', 'is', null);

        if (assignmentError) {
          console.error('Error fetching assignments for schedule:', schedule.id, assignmentError);
        }

        // Count unique sessions with assignments
        const assignedSessionIdentifiers = new Set(
          (assignments || []).map(a => a.session_identifier)
        );
        const assignedSessions = assignedSessionIdentifiers.size;

        const uniqueCourses = new Set(sessions.map(s => s.course_name || s.course_id)).size;
        const uniqueLocations = new Set(sessions.map(s => s.training_location)).size;
        const uniqueFunctionalAreas = new Set(sessions.map(s => s.functional_area)).size;
        const totalSessions = sessions.length;
        
        // Calculate assignment percentage
        const assignmentPercentage = totalSessions > 0 ? Math.round((assignedSessions / totalSessions) * 100) : 0;

        return {
          scheduleId: schedule.id,
          uniqueCourses,
          totalSessions,
          locations: uniqueLocations,
          functionalAreas: uniqueFunctionalAreas,
          locationNames: [...new Set(sessions.map(s => s.training_location))],
          functionalAreaNames: [...new Set(sessions.map(s => s.functional_area))],
          assignedSessions,
          assignmentPercentage
        };
      });

      const results = await Promise.all(statsPromises);
      
      // Convert array to object keyed by schedule ID
      results.forEach(result => {
        stats[result.scheduleId] = result;
      });

      setScheduleStats(stats);
    } catch (error) {
      console.error('Error fetching schedule statistics:', error);
    }
  };

  // Filter schedules based on search and date
  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || schedule.created_at.startsWith(filterDate);
    return matchesSearch && matchesDate;
  });

  // Format date helper
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  // Get schedule summary info
  const getScheduleSummary = (schedule) => {
    const stats = scheduleStats[schedule.id];
    
    if (!stats) {
      // Return loading state
      return {
        uniqueCourses: '...',
        totalSessions: '...',
        locations: '...',
        functionalAreas: '...',
        locationNames: 'Loading...',
        functionalAreaNames: 'Loading...',
        assignedSessions: '...',
        assignmentPercentage: '...'
      };
    }

    return {
      uniqueCourses: stats.uniqueCourses,
      totalSessions: stats.totalSessions,
      locations: stats.locations,
      functionalAreas: stats.functionalAreas,
      locationNames: stats.locationNames.slice(0, 2).join(', ') + (stats.locationNames.length > 2 ? '...' : ''),
      functionalAreaNames: stats.functionalAreaNames.slice(0, 2).join(', ') + (stats.functionalAreaNames.length > 2 ? '...' : ''),
      assignedSessions: stats.assignedSessions,
      assignmentPercentage: stats.assignmentPercentage
    };
  };

  // Show loading state while CSS loads
  if (!cssLoaded) {
    return (
      <div className="schedule-selector">
        <div className="selector-header">
          <h2>📅 Select Training Schedule</h2>
          <p>Choose an approved schedule to assign users to courses and sessions</p>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '40px',
          color: '#6c757d' 
        }}>
          <div>Loading schedule list...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-selector">
      <div className="selector-header">
        <h2>📅 Select Training Schedule</h2>
        <p>Choose an approved schedule to assign users to courses and sessions</p>
      </div>

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

        <button
          onClick={onRefresh}
          className="refresh-btn"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Schedule Table */}
      <div className="schedule-list">
        {filteredSchedules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-content">
              <h3>📅 No Schedules Found</h3>
              <p>
                {schedules.length === 0 
                  ? "No training schedules available. Create a schedule using the Training Scheduler Wizard first."
                  : "No schedules match your search criteria. Try adjusting your filters."
                }
              </p>
              <button onClick={onRefresh} className="refresh-btn">
                🔄 Refresh
              </button>
            </div>
          </div>
        ) : (
          <div className="schedule-table" key={`table-${cssLoaded ? 'loaded' : 'loading'}`}>
            <div className="table-header">
              <div className="header-row" style={{ 
                display: 'grid',
                gridTemplateColumns: '4fr minmax(120px, 140px) minmax(120px, 140px) minmax(60px, 80px) minmax(60px, 80px) minmax(60px, 80px) minmax(60px, 80px) minmax(80px, 100px) minmax(120px, 140px)',
                alignItems: 'center',
                padding: 0,
                gap: '6px'
              }}>
                <div className="header-cell name-cell">Schedule Name</div>
                <div className="header-cell date-cell">Created</div>
                <div className="header-cell date-cell">Modified</div>
                <div className="header-cell count-cell">Courses</div>
                <div className="header-cell count-cell">Sessions</div>
                <div className="header-cell count-cell">Locations</div>
                <div className="header-cell count-cell">Areas</div>
                <div className="header-cell progress-cell">Progress</div>
                <div className="header-cell actions-cell">Actions</div>
              </div>
            </div>

            <div className="table-body">
              {filteredSchedules.map(schedule => {
                const summary = getScheduleSummary(schedule);
                return (
                  <div key={schedule.id} className="table-row" style={{ 
                    display: 'grid',
                    gridTemplateColumns: '4fr minmax(120px, 140px) minmax(120px, 140px) minmax(60px, 80px) minmax(60px, 80px) minmax(60px, 80px) minmax(60px, 80px) minmax(80px, 100px) minmax(120px, 140px)',
                    alignItems: 'center',
                    padding: 0,
                    gap: '6px'
                  }}>
                    <div className="table-cell name-cell">
                      <div className="schedule-name">{schedule.name}</div>
                    </div>
                    
                    <div className="table-cell date-cell">
                      {formatDate(schedule.created_at)}
                    </div>
                    
                    <div className="table-cell date-cell">
                      {schedule.updated_at ? formatDate(schedule.updated_at) : formatDate(schedule.created_at)}
                    </div>
                    
                    <div className="table-cell count-cell">
                      <span className="count-value">{summary.uniqueCourses}</span>
                    </div>
                    
                    <div className="table-cell count-cell">
                      <span className="count-value">{summary.totalSessions}</span>
                    </div>
                    
                    <div className="table-cell count-cell">
                      <span className="count-value">{summary.locations}</span>
                    </div>
                    
                    <div className="table-cell count-cell">
                      <span className="count-value">{summary.functionalAreas}</span>
                    </div>
                    
                    <div className="table-cell progress-cell">
                      <span className={`progress-value ${summary.assignmentPercentage === 100 ? 'complete' : summary.assignmentPercentage > 0 ? 'partial' : 'empty'}`}>
                        {summary.assignmentPercentage}%
                      </span>
                    </div>
                    
                    <div className="table-cell actions-cell">
                      <button
                        className="assign-btn"
                        onClick={() => onScheduleSelect(schedule)}
                        title="Assign Users to Schedule"
                      >
                        👥 Assign Users
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="list-footer">
          <div className="list-stats">
            Showing {filteredSchedules.length} schedule(s)
          </div>
          
          <button onClick={onRefresh} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSelector;