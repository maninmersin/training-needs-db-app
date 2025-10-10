import { supabase } from '@core/services/supabaseClient';

/**
 * Attendance Service Layer
 * Handles all CRUD operations for attendance tracking
 * Follows the same patterns as scheduleService.js for consistency
 */

/**
 * Get all attendance statuses
 * @returns {Promise<Array>} Array of attendance status options
 */
export const getAttendanceStatuses = async () => {
  try {
    const { data, error } = await supabase
      .from('attendance_statuses')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('❌ Error fetching attendance statuses:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getAttendanceStatuses:', error);
    throw error;
  }
};

/**
 * Get sessions available for attendance tracking
 * @param {string} projectId - The project ID to filter sessions
 * @returns {Promise<Array>} Array of training sessions
 */
export const getSessionsForAttendance = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required to load sessions');
  }
  
  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select(`
        id,
        course_id,
        course_name,
        session_number,
        session_title,
        start_datetime,
        end_datetime,
        training_location,
        functional_area,
        classroom_number,
        max_attendees,
        instructor_id,
        instructor_name,
        session_status
      `)
      .eq('project_id', projectId)
      .order('start_datetime', { ascending: true });

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error in getSessionsForAttendance:', error);
    throw error;
  }
};

/**
 * Get session attendees (registered participants)
 * @param {string} sessionId - The session ID
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Array>} Array of registered attendees with user details
 */
export const getSessionAttendees = async (sessionId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    // Get users assigned to this session from user_assignments table
    const { data, error } = await supabase
      .from('user_assignments')
      .select(`
        id,
        end_user_id,
        created_at,
        assignment_type,
        end_users!end_user_id (
          id,
          name,
          email
        )
      `)
      .eq('session_id', sessionId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching session attendees from assignments:', error);
      throw error;
    }

    // Transform the data to match the expected format
    const attendees = (data || []).map(assignment => ({
      id: assignment.id,
      attendee_id: assignment.end_user_id,
      registered_at: assignment.created_at,
      is_confirmed: true, // Assignments are considered confirmed
      waitlist_position: null,
      notes: assignment.assignment_type,
      user: assignment.end_users
    }));

    console.log(`✅ Loaded ${attendees.length} assigned attendees for session ${sessionId}`);
    return attendees;
  } catch (error) {
    console.error('❌ Error in getSessionAttendees:', error);
    throw error;
  }
};

/**
 * Register attendees for a session
 * @param {string} sessionId - The session ID
 * @param {string} projectId - The project ID
 * @param {Array} attendeeIds - Array of end_user IDs to register
 * @param {string} registeredBy - User ID of person registering attendees
 * @returns {Promise<number>} Number of attendees successfully registered
 */
export const registerAttendeesForSession = async (sessionId, projectId, attendeeIds, registeredBy) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    const { data, error } = await supabase.rpc('bulk_register_attendees', {
      p_session_id: sessionId,
      p_project_id: projectId,
      p_attendee_ids: attendeeIds,
      p_registered_by: registeredBy
    });

    if (error) {
      console.error('❌ Error registering attendees:', error);
      throw error;
    }

    console.log(`✅ Successfully registered ${data} attendees for session`);
    return data;
  } catch (error) {
    console.error('❌ Error in registerAttendeesForSession:', error);
    throw error;
  }
};

/**
 * Get attendance records for a session
 * @param {string} sessionId - The session ID
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Array>} Array of attendance records with attendee details
 */
export const getSessionAttendanceRecords = async (sessionId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        attendee_id,
        attendance_status_id,
        check_in_time,
        check_out_time,
        actual_duration_minutes,
        notes,
        marked_at,
        marked_by,
        attendance_statuses (
          id,
          status_name,
          is_present,
          color_code
        ),
        end_users (
          id,
          name,
          email
        )
      `)
      .eq('session_id', sessionId)
      .eq('project_id', projectId)
      .order('marked_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching attendance records:', error);
      throw error;
    }

    // Transform the data
    const records = (data || []).map(record => ({
      id: record.id,
      attendee_id: record.attendee_id,
      attendance_status_id: record.attendance_status_id,
      check_in_time: record.check_in_time,
      check_out_time: record.check_out_time,
      actual_duration_minutes: record.actual_duration_minutes,
      notes: record.notes,
      marked_at: record.marked_at,
      marked_by: record.marked_by,
      status: record.attendance_statuses,
      user: record.end_users
    }));

    return records;
  } catch (error) {
    console.error('❌ Error in getSessionAttendanceRecords:', error);
    throw error;
  }
};

/**
 * Mark attendance for multiple attendees
 * @param {string} sessionId - The session ID
 * @param {string} projectId - The project ID
 * @param {Array} attendanceRecords - Array of attendance data
 * @param {string} markedBy - User ID of person marking attendance
 * @returns {Promise<number>} Number of attendance records processed
 */
export const markBulkAttendance = async (sessionId, projectId, attendanceRecords, markedBy) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    const { data, error } = await supabase.rpc('bulk_mark_attendance', {
      p_session_id: sessionId,
      p_project_id: projectId,
      p_attendance_records: JSON.stringify(attendanceRecords),
      p_marked_by: markedBy
    });

    if (error) {
      console.error('❌ Error marking bulk attendance:', error);
      throw error;
    }

    console.log(`✅ Successfully processed ${data} attendance records`);
    return data;
  } catch (error) {
    console.error('❌ Error in markBulkAttendance:', error);
    throw error;
  }
};

/**
 * Mark attendance for a single attendee
 * @param {string} sessionId - The session ID
 * @param {string} projectId - The project ID
 * @param {Object} attendanceData - Attendance record data
 * @returns {Promise<Object>} The created/updated attendance record
 */
export const markSingleAttendance = async (sessionId, projectId, attendanceData) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    const recordData = {
      project_id: projectId,
      session_id: sessionId,
      attendee_id: attendanceData.attendee_id,
      attendance_status_id: attendanceData.attendance_status_id,
      check_in_time: attendanceData.check_in_time || new Date().toISOString(),
      check_out_time: attendanceData.check_out_time,
      actual_duration_minutes: attendanceData.actual_duration_minutes,
      notes: attendanceData.notes,
      marked_by: attendanceData.marked_by,
      marked_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(recordData, {
        onConflict: 'session_id,attendee_id',
        returning: 'representation'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error marking single attendance:', error);
      throw error;
    }

    console.log(`✅ Marked attendance for attendee ${attendanceData.attendee_id}`);
    return data;
  } catch (error) {
    console.error('❌ Error in markSingleAttendance:', error);
    throw error;
  }
};

/**
 * Get session attendance summary
 * @param {string} sessionId - The session ID
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<Object>} Attendance statistics summary
 */
export const getSessionAttendanceSummary = async (sessionId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    // Get all assigned attendees for the session
    const { data: attendees, error: attendeesError } = await supabase
      .from('user_assignments')
      .select('end_user_id')
      .eq('session_id', sessionId)
      .eq('project_id', projectId);

    if (attendeesError) throw attendeesError;

    const totalRegistered = attendees?.length || 0;

    // Get attendance records for this session
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select(`
        attendee_id,
        attendance_status_id,
        attendance_statuses (
          status_name,
          is_present
        )
      `)
      .eq('session_id', sessionId)
      .eq('project_id', projectId);

    if (recordsError) throw recordsError;

    // Calculate statistics
    let totalAttended = 0;
    let totalAbsent = 0;
    const statusBreakdown = {};

    if (records && records.length > 0) {
      records.forEach(record => {
        const status = record.attendance_statuses;
        if (status) {
          if (status.is_present) {
            totalAttended++;
          } else {
            totalAbsent++;
          }
          
          const statusName = status.status_name;
          statusBreakdown[statusName] = (statusBreakdown[statusName] || 0) + 1;
        }
      });
    }

    // Calculate attendance rate
    const attendanceRate = totalRegistered > 0 
      ? Math.round((totalAttended / totalRegistered) * 100) 
      : 0;

    return {
      total_registered: totalRegistered,
      total_attended: totalAttended,
      total_absent: totalAbsent,
      attendance_rate: attendanceRate,
      status_breakdown: statusBreakdown
    };
  } catch (error) {
    console.error('❌ Error in getSessionAttendanceSummary:', error);
    throw error;
  }
};

/**
 * Get attendance history for a user
 * @param {number} attendeeId - The end_user ID
 * @param {string} projectId - The project ID for validation
 * @param {Object} filters - Optional filters (date range, course, etc.)
 * @returns {Promise<Array>} Array of attendance records
 */
export const getAttendeeHistory = async (attendeeId, projectId, filters = {}) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        session_id,
        attendance_status_id,
        check_in_time,
        check_out_time,
        notes,
        marked_at,
        attendance_statuses!fk_attendance_records_status (
          status_name,
          is_present,
          color_code
        ),
        training_sessions!inner (
          course_name,
          session_title,
          start_datetime,
          end_datetime,
          training_location,
          functional_area
        )
      `)
      .eq('attendee_id', attendeeId)
      .eq('project_id', projectId);

    // Apply date range filter if provided
    if (filters.startDate) {
      query = query.gte('marked_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('marked_at', filters.endDate);
    }

    // Apply course filter if provided
    if (filters.courseId) {
      query = query.eq('training_sessions.course_id', filters.courseId);
    }

    const { data, error } = await query.order('marked_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching attendee history:', error);
      throw error;
    }

    // Transform the data
    const history = (data || []).map(record => ({
      id: record.id,
      session_id: record.session_id,
      check_in_time: record.check_in_time,
      check_out_time: record.check_out_time,
      notes: record.notes,
      marked_at: record.marked_at,
      status: record.attendance_statuses,
      session: record.training_sessions
    }));

    return history;
  } catch (error) {
    console.error('❌ Error in getAttendeeHistory:', error);
    throw error;
  }
};

/**
 * Get attendance statistics for reporting
 * @param {string} projectId - The project ID
 * @param {Object} filters - Filters (date range, functional area, etc.)
 * @returns {Promise<Object>} Attendance statistics
 */
export const getAttendanceStatistics = async (projectId, filters = {}) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    // First get attendance records with status information
    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        attendance_status_id,
        marked_at,
        session_id,
        attendance_statuses!fk_attendance_records_status (
          status_name,
          is_present
        )
      `)
      .eq('project_id', projectId);

    const { data: attendanceData, error: attendanceError } = await query;

    if (attendanceError) {
      console.error('❌ Error fetching attendance records:', attendanceError);
      throw attendanceError;
    }

    if (!attendanceData || attendanceData.length === 0) {
      return {
        totalRecords: 0,
        totalPresent: 0,
        totalAbsent: 0,
        overallAttendanceRate: 0,
        functionalAreaStats: [],
        locationStats: [],
        timeSeriesData: []
      };
    }

    // Get unique session IDs to fetch session details
    const sessionIds = [...new Set(attendanceData.map(record => record.session_id))];
    
    // Fetch training session details
    let sessionsQuery = supabase
      .from('training_sessions')
      .select('id, course_name, functional_area, training_location, start_datetime')
      .eq('project_id', projectId)
      .in('id', sessionIds);

    // Apply filters to sessions
    if (filters.startDate) {
      sessionsQuery = sessionsQuery.gte('start_datetime', filters.startDate);
    }
    if (filters.endDate) {
      sessionsQuery = sessionsQuery.lte('start_datetime', filters.endDate);
    }
    if (filters.functionalArea) {
      sessionsQuery = sessionsQuery.eq('functional_area', filters.functionalArea);
    }
    if (filters.trainingLocation) {
      sessionsQuery = sessionsQuery.eq('training_location', filters.trainingLocation);
    }

    const { data: sessionsData, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error('❌ Error fetching training sessions:', sessionsError);
      throw sessionsError;
    }

    // Join the data manually
    const joinedData = attendanceData
      .map(record => {
        const session = sessionsData.find(s => s.id === record.session_id);
        if (session) {
          return {
            ...record,
            training_sessions: {
              course_name: session.course_name,
              functional_area: session.functional_area,
              training_location: session.training_location,
              start_datetime: session.start_datetime
            }
          };
        }
        return null;
      })
      .filter(record => record !== null);

    const data = joinedData;

    // Calculate statistics
    const totalRecords = data?.length || 0;
    const totalPresent = data?.filter(record => record.attendance_statuses.is_present).length || 0;
    const totalAbsent = totalRecords - totalPresent;
    const overallAttendanceRate = totalRecords > 0 ? (totalPresent / totalRecords) * 100 : 0;

    // Group by functional area
    const byFunctionalArea = {};
    data?.forEach(record => {
      const area = record.training_sessions.functional_area;
      if (!byFunctionalArea[area]) {
        byFunctionalArea[area] = { total: 0, present: 0 };
      }
      byFunctionalArea[area].total++;
      if (record.attendance_statuses.is_present) {
        byFunctionalArea[area].present++;
      }
    });

    // Calculate rates for each area
    Object.keys(byFunctionalArea).forEach(area => {
      const stats = byFunctionalArea[area];
      stats.attendance_rate = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
    });

    return {
      overall: {
        total_records: totalRecords,
        total_present: totalPresent,
        total_absent: totalAbsent,
        attendance_rate: Math.round(overallAttendanceRate * 100) / 100
      },
      by_functional_area: byFunctionalArea
    };
  } catch (error) {
    console.error('❌ Error in getAttendanceStatistics:', error);
    throw error;
  }
};

/**
 * Export attendance data for reporting
 * @param {string} projectId - The project ID
 * @param {Object} filters - Export filters
 * @returns {Promise<Array>} Array of attendance data for export
 */
export const exportAttendanceData = async (projectId, filters = {}) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    let query = supabase
      .from('attendance_records')
      .select(`
        attendance_statuses!fk_attendance_records_status (
          status_name
        ),
        end_users!fk_attendance_records_attendee (
          name,
          email,
          job_title,
          division,
          organisation
        ),
        training_sessions!inner (
          course_name,
          session_title,
          start_datetime,
          end_datetime,
          training_location,
          functional_area
        ),
        check_in_time,
        check_out_time,
        notes,
        marked_at
      `)
      .eq('project_id', projectId);

    // Apply filters
    if (filters.startDate) {
      query = query.gte('training_sessions.start_datetime', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('training_sessions.start_datetime', filters.endDate);
    }
    if (filters.functionalArea) {
      query = query.eq('training_sessions.functional_area', filters.functionalArea);
    }

    const { data, error } = await query.order('training_sessions.start_datetime', { ascending: true });

    if (error) {
      console.error('❌ Error exporting attendance data:', error);
      throw error;
    }

    // Transform data for export
    const exportData = (data || []).map(record => ({
      'Attendee Name': record.end_users.name,
      'Email': record.end_users.email,
      'Job Title': record.end_users.job_title,
      'Division': record.end_users.division,
      'Organisation': record.end_users.organisation,
      'Course Name': record.training_sessions.course_name,
      'Session Title': record.training_sessions.session_title,
      'Training Location': record.training_sessions.training_location,
      'Functional Area': record.training_sessions.functional_area,
      'Session Date': new Date(record.training_sessions.start_datetime).toLocaleDateString('en-GB'),
      'Session Time': `${new Date(record.training_sessions.start_datetime).toLocaleTimeString('en-GB')} - ${new Date(record.training_sessions.end_datetime).toLocaleTimeString('en-GB')}`,
      'Attendance Status': record.attendance_statuses.status_name,
      'Check In Time': record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('en-GB') : '',
      'Check Out Time': record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('en-GB') : '',
      'Notes': record.notes || '',
      'Marked At': new Date(record.marked_at).toLocaleString('en-GB')
    }));

    return exportData;
  } catch (error) {
    console.error('❌ Error in exportAttendanceData:', error);
    throw error;
  }
};

/**
 * Remove attendee from session
 * @param {string} sessionId - The session ID
 * @param {number} attendeeId - The attendee ID
 * @param {string} projectId - The project ID for validation
 * @returns {Promise<boolean>} Success status
 */
export const removeAttendeeFromSession = async (sessionId, attendeeId, projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    // Remove from session attendees
    const { error: attendeeError } = await supabase
      .from('session_attendees')
      .delete()
      .eq('session_id', sessionId)
      .eq('attendee_id', attendeeId)
      .eq('project_id', projectId);

    if (attendeeError) {
      console.error('❌ Error removing attendee:', attendeeError);
      throw attendeeError;
    }

    // Also remove any attendance records
    const { error: recordError } = await supabase
      .from('attendance_records')
      .delete()
      .eq('session_id', sessionId)
      .eq('attendee_id', attendeeId)
      .eq('project_id', projectId);

    if (recordError) {
      console.error('❌ Error removing attendance record:', recordError);
      throw recordError;
    }

    console.log(`✅ Removed attendee ${attendeeId} from session ${sessionId}`);
    return true;
  } catch (error) {
    console.error('❌ Error in removeAttendeeFromSession:', error);
    throw error;
  }
};

/**
 * Get assignment vs attendance compliance statistics
 * Compare users assigned to sessions vs actual attendance records
 * @param {string} projectId - The project ID
 * @param {Object} filters - Date range and other filters
 * @returns {Promise<Object>} Compliance statistics with drill-down data
 */
export const getAssignmentVsAttendanceStats = async (projectId, filters = {}) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {

    // Build date filter for sessions
    let sessionQuery = supabase
      .from('training_sessions')
      .select(`
        id,
        course_name,
        start_datetime,
        end_datetime,
        training_location,
        functional_area,
        classroom_number,
        session_status
      `)
      .eq('project_id', projectId)
      .in('session_status', ['scheduled', 'completed', 'in_progress', 'active']); // Analyze sessions that can have attendance

    // Apply date filters
    if (filters.startDate) {
      sessionQuery = sessionQuery.gte('start_datetime', filters.startDate);
    }
    if (filters.endDate) {
      sessionQuery = sessionQuery.lte('start_datetime', filters.endDate);
    }
    if (filters.functionalArea) {
      sessionQuery = sessionQuery.eq('functional_area', filters.functionalArea);
    }
    if (filters.trainingLocation) {
      sessionQuery = sessionQuery.eq('training_location', filters.trainingLocation);
    }

    const { data: sessions, error: sessionsError } = await sessionQuery;
    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return {
        overall: {
          total_assigned: 0,
          total_attended: 0,
          compliance_rate: 0,
          missing_attendance_records: 0
        },
        by_functional_area: {},
        by_training_location: {},
        by_session: [],
        issue_sessions: []
      };
    }

    const sessionIds = sessions.map(s => s.id);

    // Get all assignments for these sessions
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_assignments')
      .select(`
        id,
        session_id,
        end_user_id,
        assignment_status
      `)
      .eq('project_id', projectId)
      .in('session_id', sessionIds)
      .in('assignment_status', ['enrolled', 'completed']); // Only count valid assignments

    if (assignmentsError) throw assignmentsError;

    // Get all attendance records for these sessions
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        id,
        session_id,
        attendee_id,
        attendance_status_id,
        attendance_statuses!fk_attendance_records_status (
          status_name,
          is_present
        )
      `)
      .eq('project_id', projectId)
      .in('session_id', sessionIds);

    if (attendanceError) throw attendanceError;

    // Process the data
    const sessionStats = {};
    const functionalAreaStats = {};
    const trainingLocationStats = {};
    let totalAssigned = 0;
    let totalAttended = 0;
    let totalMissingRecords = 0;

    // Initialize session stats
    sessions.forEach(session => {
      sessionStats[session.id] = {
        session: session,
        assigned: 0,
        attended: 0,
        missing_records: 0,
        compliance_rate: 0,
        attendance_records: []
      };
    });

    // Count assignments
    (assignments || []).forEach(assignment => {
      if (sessionStats[assignment.session_id]) {
        sessionStats[assignment.session_id].assigned++;
        totalAssigned++;
      }
    });

    // Count attendance
    (attendanceRecords || []).forEach(record => {
      if (sessionStats[record.session_id]) {
        sessionStats[record.session_id].attendance_records.push(record);
        if (record.attendance_statuses && record.attendance_statuses.is_present) {
          sessionStats[record.session_id].attended++;
          totalAttended++;
        }
      }
    });

    // Calculate session-level statistics
    const issueSessions = [];
    Object.values(sessionStats).forEach(stats => {
      const session = stats.session;
      
      // Calculate missing attendance records
      stats.missing_records = Math.max(0, stats.assigned - stats.attendance_records.length);
      totalMissingRecords += stats.missing_records;
      
      // Calculate compliance rate
      stats.compliance_rate = stats.assigned > 0 ? (stats.attended / stats.assigned) * 100 : 0;
      
      // Identify problem sessions
      if (stats.compliance_rate < 80 || stats.missing_records > 0) {
        issueSessions.push({
          ...stats,
          issues: []
        });
        
        if (stats.compliance_rate < 80) {
          issueSessions[issueSessions.length - 1].issues.push(`Low compliance: ${Math.round(stats.compliance_rate)}%`);
        }
        if (stats.missing_records > 0) {
          issueSessions[issueSessions.length - 1].issues.push(`Missing ${stats.missing_records} attendance records`);
        }
      }

      // Aggregate by functional area
      const area = session.functional_area;
      if (!functionalAreaStats[area]) {
        functionalAreaStats[area] = { assigned: 0, attended: 0, missing_records: 0 };
      }
      functionalAreaStats[area].assigned += stats.assigned;
      functionalAreaStats[area].attended += stats.attended;
      functionalAreaStats[area].missing_records += stats.missing_records;

      // Aggregate by training location
      const location = session.training_location;
      if (!trainingLocationStats[location]) {
        trainingLocationStats[location] = { assigned: 0, attended: 0, missing_records: 0 };
      }
      trainingLocationStats[location].assigned += stats.assigned;
      trainingLocationStats[location].attended += stats.attended;
      trainingLocationStats[location].missing_records += stats.missing_records;
    });

    // Calculate rates for functional areas and locations
    Object.keys(functionalAreaStats).forEach(area => {
      const stats = functionalAreaStats[area];
      stats.compliance_rate = stats.assigned > 0 ? (stats.attended / stats.assigned) * 100 : 0;
    });

    Object.keys(trainingLocationStats).forEach(location => {
      const stats = trainingLocationStats[location];
      stats.compliance_rate = stats.assigned > 0 ? (stats.attended / stats.assigned) * 100 : 0;
    });

    const overallComplianceRate = totalAssigned > 0 ? (totalAttended / totalAssigned) * 100 : 0;

    return {
      overall: {
        total_assigned: totalAssigned,
        total_attended: totalAttended,
        compliance_rate: Math.round(overallComplianceRate * 100) / 100,
        missing_attendance_records: totalMissingRecords
      },
      by_functional_area: functionalAreaStats,
      by_training_location: trainingLocationStats,
      by_session: Object.values(sessionStats),
      issue_sessions: issueSessions
    };

  } catch (error) {
    console.error('❌ Error in getAssignmentVsAttendanceStats:', error);
    throw error;
  }
};

/**
 * Get drill-down compliance data for a specific filter path
 * @param {string} projectId - The project ID
 * @param {Object} filterPath - The current drill-down path
 * @param {Object} dateRange - Date range filters
 * @returns {Promise<Object>} Drill-down specific data
 */
export const getDrillDownStats = async (projectId, filterPath = {}, dateRange = {}) => {
  const filters = {
    ...dateRange,
    ...filterPath
  };

  // Get the base stats with current filters
  const stats = await getAssignmentVsAttendanceStats(projectId, filters);

  // Determine what level we're drilling into
  let drillDownData = {};
  let breadcrumb = [];

  if (!filterPath.functionalArea) {
    // Top level - show functional areas
    drillDownData = stats.by_functional_area;
    breadcrumb = [{ level: 'project', label: 'Project Overview' }];
  } else if (!filterPath.trainingLocation) {
    // Functional area level - show training locations within this area
    const areaStats = await getAssignmentVsAttendanceStats(projectId, filters);
    drillDownData = areaStats.by_training_location;
    breadcrumb = [
      { level: 'project', label: 'Project Overview' },
      { level: 'functionalArea', label: filterPath.functionalArea, value: filterPath.functionalArea }
    ];
  } else {
    // Training location level - show individual sessions
    const sessionStats = stats.by_session.filter(s => 
      s.session.training_location === filterPath.trainingLocation
    );
    drillDownData = sessionStats.reduce((acc, sessionStat) => {
      acc[sessionStat.session.id] = {
        ...sessionStat,
        session_name: `${sessionStat.session.course_name} - ${new Date(sessionStat.session.start_datetime).toLocaleDateString()}`
      };
      return acc;
    }, {});
    
    breadcrumb = [
      { level: 'project', label: 'Project Overview' },
      { level: 'functionalArea', label: filterPath.functionalArea, value: filterPath.functionalArea },
      { level: 'trainingLocation', label: filterPath.trainingLocation, value: filterPath.trainingLocation }
    ];
  }

  return {
    drillDownData,
    breadcrumb,
    summary: stats.overall
  };
};

/**
 * Get attendance compliance gaps and issues
 * @param {string} projectId - The project ID
 * @param {Object} dateRange - Date range filters
 * @returns {Promise<Object>} List of compliance issues and gaps
 */
export const getAttendanceGaps = async (projectId, dateRange = {}) => {
  if (!projectId) {
    throw new Error('Project ID is required for all attendance operations');
  }

  try {
    const stats = await getAssignmentVsAttendanceStats(projectId, dateRange);
    
    const gaps = {
      missing_attendance_records: [],
      low_compliance_sessions: [],
      unassigned_attendees: [],
      summary: {
        total_issues: 0,
        missing_records_count: stats.overall.missing_attendance_records,
        low_compliance_count: stats.issue_sessions.filter(s => s.compliance_rate < 80).length
      }
    };

    // Sessions with missing attendance records
    gaps.missing_attendance_records = stats.by_session
      .filter(s => s.missing_records > 0)
      .map(s => ({
        session_id: s.session.id,
        session_name: `${s.session.course_name} - ${new Date(s.session.start_datetime).toLocaleDateString()}`,
        training_location: s.session.training_location,
        functional_area: s.session.functional_area,
        missing_count: s.missing_records,
        assigned_count: s.assigned
      }));

    // Sessions with low compliance
    gaps.low_compliance_sessions = stats.by_session
      .filter(s => s.compliance_rate < 80 && s.assigned > 0)
      .map(s => ({
        session_id: s.session.id,
        session_name: `${s.session.course_name} - ${new Date(s.session.start_datetime).toLocaleDateString()}`,
        training_location: s.session.training_location,
        functional_area: s.session.functional_area,
        compliance_rate: Math.round(s.compliance_rate),
        assigned: s.assigned,
        attended: s.attended
      }));

    gaps.summary.total_issues = gaps.missing_attendance_records.length + gaps.low_compliance_sessions.length;

    return gaps;
  } catch (error) {
    console.error('❌ Error in getAttendanceGaps:', error);
    throw error;
  }
};