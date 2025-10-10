import React, { useState } from 'react';
import { supabase } from '@core/services/supabaseClient';
import './AssignmentStatsModal.css';

const AssignmentStatsModal = ({ isOpen, onClose, schedule, selectedTrainingLocation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailedView, setDetailedView] = useState(false);

  const calculateAssignmentStats = async () => {
    if (!schedule?.id) {
      console.error('❌ No schedule provided or schedule missing ID');
      setError('No schedule data available');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📊 Calculating assignment stats for schedule:', schedule.id);
      console.log('🔍 Schedule object:', schedule);
      console.log('🔍 Selected training location:', selectedTrainingLocation);
      console.log('🔍 This will count assignments at COURSE level, not session level');
      
      // Get all users (filtered by training location if specified)
      let usersQuery = supabase.from('end_users').select('id, name, training_location, project_role');
      if (selectedTrainingLocation) {
        usersQuery = usersQuery.eq('training_location', selectedTrainingLocation);
      }
      
      console.log('🔍 Fetching users...');
      const { data: allUsers, error: usersError } = await usersQuery;
      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        throw usersError;
      }
      console.log('✅ Found', allUsers?.length || 0, 'users');
      
      // Get role-course mappings
      console.log('🔍 Fetching role-course mappings...');
      const { data: roleMappings, error: roleMappingsError } = await supabase
        .from('role_course_mappings')
        .select('*');
      if (roleMappingsError) {
        console.error('❌ Error fetching role mappings:', roleMappingsError);
        throw roleMappingsError;
      }
      console.log('✅ Found', roleMappings?.length || 0, 'role mappings');
      
      // Get actual assignments for this schedule
      console.log('🔍 Fetching schedule assignments...');
      const { data: scheduleAssignments, error: assignmentsError } = await supabase
        .from('user_assignments')
        .select('end_user_id, course_id')
        .eq('schedule_id', schedule.id);
      if (assignmentsError) {
        console.error('❌ Error fetching assignments:', assignmentsError);
        throw assignmentsError;
      }
      console.log('✅ Found', scheduleAssignments?.length || 0, 'schedule assignments');
      
      // Group assignments by user and course to count at course level, not session level
      const uniqueAssignments = [];
      const assignmentSet = new Set();
      
      scheduleAssignments.forEach(assignment => {
        const key = `${assignment.end_user_id}-${assignment.course_id}`;
        if (!assignmentSet.has(key)) {
          assignmentSet.add(key);
          uniqueAssignments.push(assignment);
        }
      });
      
      // Get courses in this schedule
      console.log('🔍 Parsing schedule sessions...');
      console.log('🔍 Schedule.sessions structure:', schedule.sessions);
      
      let scheduleCourses = [];
      
      if (schedule.sessions) {
        if (Array.isArray(schedule.sessions)) {
          scheduleCourses = schedule.sessions;
          console.log('✅ Schedule sessions is array with', scheduleCourses.length, 'items');
        } else if (typeof schedule.sessions === 'object') {
          // Handle nested object structure: location -> day -> sessions
          scheduleCourses = Object.values(schedule.sessions).flatMap(locationOrDay => {
            if (Array.isArray(locationOrDay)) {
              return locationOrDay;
            } else if (typeof locationOrDay === 'object') {
              return Object.values(locationOrDay).flatMap(dayOrSessions => {
                if (Array.isArray(dayOrSessions)) {
                  return dayOrSessions;
                } else if (typeof dayOrSessions === 'object') {
                  return Object.values(dayOrSessions).flat();
                }
                return [];
              });
            }
            return [];
          });
          console.log('✅ Flattened nested sessions structure, found', scheduleCourses.length, 'sessions');
        }
      } else {
        console.log('⚠️ No sessions found in schedule');
      }
      
      console.log('🔍 Sample sessions (first 3):', scheduleCourses.slice(0, 3));
      
      const scheduleCourseIds = [...new Set(scheduleCourses.map(s => {
        const courseId = s.course_id || s.courseId || s.course?.course_id || s.course?.id;
        return courseId ? String(courseId) : null;
      }).filter(Boolean))];
      
      console.log('✅ Extracted course IDs:', scheduleCourseIds);
      
      console.log('📈 Data summary:', {
        totalSessionAssignments: scheduleAssignments.length,
        uniqueCourseAssignments: uniqueAssignments.length,
        coursesInSchedule: scheduleCourseIds.length,
        usersCount: allUsers.length
      });
      
      let fullyAssigned = 0;
      let partiallyAssigned = 0;
      let unassigned = 0;
      let usersNeedingAssignment = 0;
      
      const detailedUsers = {
        fullyAssigned: [],
        partiallyAssigned: [],
        unassigned: []
      };
      
      // Analyze each user
      allUsers.forEach(user => {
        // Find what courses this user's role requires
        const userRequiredCourses = roleMappings
          .filter(mapping => mapping.project_role_name === user.project_role)
          .map(mapping => String(mapping.course_id));
        
        // Find which required courses are in this schedule
        const relevantRequiredCourses = userRequiredCourses.filter(courseId => 
          scheduleCourseIds.includes(courseId)
        );
        
        if (relevantRequiredCourses.length === 0) {
          // User doesn't need any courses from this schedule
          return;
        }
        
        usersNeedingAssignment++;
        
        // Find assignments for this user (using unique course assignments)
        const userAssignments = uniqueAssignments.filter(assignment => 
          assignment.end_user_id === user.id
        );
        const assignedCourseIds = [...new Set(userAssignments.map(a => String(a.course_id)))];
        
        // Check assignment status
        const assignedRelevantCourses = assignedCourseIds.filter(courseId => 
          relevantRequiredCourses.includes(courseId)
        );
        
        const userStats = {
          id: user.id,
          name: user.name,
          role: user.project_role,
          location: user.training_location,
          requiredCourses: relevantRequiredCourses.length,
          assignedCourses: assignedRelevantCourses.length,
          missingCourses: relevantRequiredCourses.length - assignedRelevantCourses.length
        };
        
        if (assignedRelevantCourses.length === relevantRequiredCourses.length) {
          fullyAssigned++;
          detailedUsers.fullyAssigned.push(userStats);
        } else if (assignedRelevantCourses.length > 0) {
          partiallyAssigned++;
          detailedUsers.partiallyAssigned.push(userStats);
        } else {
          unassigned++;
          detailedUsers.unassigned.push(userStats);
        }
      });
      
      const totalAssigned = uniqueAssignments.length;
      const completionRate = usersNeedingAssignment > 0 ? 
        Math.round((fullyAssigned / usersNeedingAssignment) * 100) : 0;
      
      console.log('📊 Final statistics:', {
        usersNeedingAssignment,
        fullyAssigned,
        partiallyAssigned,
        unassigned,
        totalAssigned,
        completionRate
      });
      
      setStats({
        usersNeedingAssignment,
        fullyAssigned,
        partiallyAssigned,
        unassigned,
        totalAssigned,
        completionRate,
        detailedUsers,
        scheduleCourseIds,
        selectedLocation: selectedTrainingLocation || 'All Locations'
      });
      
    } catch (err) {
      console.error('❌ Error calculating assignment stats:', err);
      console.error('❌ Full error object:', err);
      
      let errorMessage = 'Failed to calculate assignment statistics';
      if (err.message) {
        errorMessage += ': ' + err.message;
      }
      if (err.details) {
        errorMessage += ' (' + err.details + ')';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats when modal opens
  React.useEffect(() => {
    if (isOpen && schedule) {
      calculateAssignmentStats();
    }
  }, [isOpen, schedule?.id, selectedTrainingLocation]);

  if (!isOpen) return null;

  return (
    <div className="assignment-stats-modal-overlay">
      <div className="assignment-stats-modal">
        <div className="modal-header">
          <h3>📊 Assignment Statistics</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        
        <div className="modal-content">
          {loading && (
            <div className="loading-state">
              <div>🔄 Calculating assignment statistics...</div>
            </div>
          )}
          
          {error && (
            <div className="error-state">
              <div>❌ Error: {error}</div>
              <button onClick={calculateAssignmentStats}>🔄 Retry</button>
            </div>
          )}
          
          {stats && (
            <div className="stats-content">
              {/* Summary Section */}
              <div className="stats-summary">
                <h4>📋 Summary for {stats.selectedLocation}</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <div className="summary-value">{stats.usersNeedingAssignment}</div>
                    <div className="summary-label">Users Requiring Assignment</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value">{stats.totalAssigned}</div>
                    <div className="summary-label">Total Course Assignments Made</div>
                  </div>
                  <div className="summary-item">
                    <div className="summary-value">{stats.completionRate}%</div>
                    <div className="summary-label">Completion Rate</div>
                  </div>
                </div>
              </div>
              
              {/* Status Breakdown */}
              <div className="status-breakdown">
                <h4>👥 Assignment Status</h4>
                <div className="status-grid">
                  <div className="status-item fully-assigned">
                    <div className="status-icon">✅</div>
                    <div className="status-info">
                      <div className="status-count">{stats.fullyAssigned}</div>
                      <div className="status-label">Fully Assigned</div>
                      <div className="status-description">All required courses assigned</div>
                    </div>
                  </div>
                  
                  <div className="status-item partially-assigned">
                    <div className="status-icon">⚠️</div>
                    <div className="status-info">
                      <div className="status-count">{stats.partiallyAssigned}</div>
                      <div className="status-label">Partially Assigned</div>
                      <div className="status-description">Some courses missing</div>
                    </div>
                  </div>
                  
                  <div className="status-item unassigned">
                    <div className="status-icon">❌</div>
                    <div className="status-info">
                      <div className="status-count">{stats.unassigned}</div>
                      <div className="status-label">Unassigned</div>
                      <div className="status-description">No courses assigned</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="progress-section">
                <div className="progress-label">Overall Progress</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill fully-assigned"
                    style={{ width: `${(stats.fullyAssigned / stats.usersNeedingAssignment) * 100}%` }}
                  ></div>
                  <div 
                    className="progress-fill partially-assigned"
                    style={{ 
                      width: `${(stats.partiallyAssigned / stats.usersNeedingAssignment) * 100}%`,
                      left: `${(stats.fullyAssigned / stats.usersNeedingAssignment) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="progress-text">
                  {Math.round((stats.fullyAssigned / stats.usersNeedingAssignment) * 100)}% Complete
                </div>
              </div>
              
              {/* Course Information Section */}
              <div className="course-info-section">
                <h4>📚 Schedule Information</h4>
                <div className="course-info-grid">
                  <div className="course-info-item">
                    <div className="course-info-icon">📖</div>
                    <div className="course-info-data">
                      <div className="course-info-count">{stats.scheduleCourseIds.length}</div>
                      <div className="course-info-label">Courses in Schedule</div>
                    </div>
                  </div>
                  
                  <div className="course-info-item">
                    <div className="course-info-icon">📍</div>
                    <div className="course-info-data">
                      <div className="course-info-text">{stats.selectedLocation}</div>
                      <div className="course-info-label">Training Location</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Toggle Detailed View */}
              <div className="detailed-toggle">
                <button 
                  onClick={() => setDetailedView(!detailedView)}
                  className="toggle-btn"
                >
                  {detailedView ? '📋 Hide Details' : '📋 Show Details'}
                </button>
              </div>
              
              {/* Detailed View */}
              {detailedView && (
                <div className="detailed-view">
                  {stats.detailedUsers.unassigned.length > 0 && (
                    <div className="user-list">
                      <h5>❌ Unassigned Users ({stats.detailedUsers.unassigned.length})</h5>
                      <div className="user-table">
                        {stats.detailedUsers.unassigned.map(user => (
                          <div key={user.id} className="user-row unassigned">
                            <span className="user-name">{user.name}</span>
                            <span className="user-role">{user.role}</span>
                            <span className="user-status">Needs {user.requiredCourses} courses</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {stats.detailedUsers.partiallyAssigned.length > 0 && (
                    <div className="user-list">
                      <h5>⚠️ Partially Assigned Users ({stats.detailedUsers.partiallyAssigned.length})</h5>
                      <div className="user-table">
                        {stats.detailedUsers.partiallyAssigned.map(user => (
                          <div key={user.id} className="user-row partially-assigned">
                            <span className="user-name">{user.name}</span>
                            <span className="user-role">{user.role}</span>
                            <span className="user-status">
                              {user.assignedCourses}/{user.requiredCourses} courses 
                              ({user.missingCourses} missing)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {stats.detailedUsers.fullyAssigned.length > 0 && (
                    <div className="user-list">
                      <h5>✅ Fully Assigned Users ({stats.detailedUsers.fullyAssigned.length})</h5>
                      <div className="user-table">
                        {stats.detailedUsers.fullyAssigned.slice(0, 10).map(user => (
                          <div key={user.id} className="user-row fully-assigned">
                            <span className="user-name">{user.name}</span>
                            <span className="user-role">{user.role}</span>
                            <span className="user-status">Complete ({user.assignedCourses} courses)</span>
                          </div>
                        ))}
                        {stats.detailedUsers.fullyAssigned.length > 10 && (
                          <div className="user-row">
                            <span className="more-users">
                              ... and {stats.detailedUsers.fullyAssigned.length - 10} more fully assigned users
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={() => calculateAssignmentStats()} className="refresh-btn">
            🔄 Refresh Stats
          </button>
          <button onClick={onClose} className="close-footer-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentStatsModal;