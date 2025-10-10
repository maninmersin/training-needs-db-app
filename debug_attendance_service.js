// Debug version of attendance service for testing
import { supabase } from '@core/services/supabaseClient';

// Test basic connectivity
export const testDatabaseConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test 1: Check if attendance_statuses table exists and has data
    const { data: statuses, error: statusError } = await supabase
      .from('attendance_statuses')
      .select('*')
      .limit(5);
    
    console.log('✅ Attendance Statuses:', statuses, statusError);
    
    // Test 2: Check if we can query training_sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('id, course_name, start_datetime, project_id')
      .limit(3);
      
    console.log('✅ Training Sessions:', sessions, sessionsError);
    
    // Test 3: Check if we can query session_attendees (should be empty initially)
    const { data: attendees, error: attendeesError } = await supabase
      .from('session_attendees')
      .select('*')
      .limit(5);
      
    console.log('✅ Session Attendees:', attendees, attendeesError);
    
    return { statuses, sessions, attendees };
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    throw error;
  }
};

// Simplified version of getSessionAttendees without complex joins
export const getSessionAttendeesSimple = async (sessionId, projectId) => {
  try {
    console.log('🔍 Getting session attendees for:', { sessionId, projectId });
    
    const { data, error } = await supabase
      .from('session_attendees')
      .select('*')
      .eq('session_id', sessionId)
      .eq('project_id', projectId);

    if (error) {
      console.error('❌ Error fetching session attendees:', error);
      throw error;
    }

    console.log('✅ Session attendees (simple):', data);
    return data || [];
    
  } catch (error) {
    console.error('❌ Error in getSessionAttendeesSimple:', error);
    throw error;
  }
};

// Simplified version of getSessionAttendanceRecords
export const getSessionAttendanceRecordsSimple = async (sessionId, projectId) => {
  try {
    console.log('🔍 Getting attendance records for:', { sessionId, projectId });
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('session_id', sessionId)
      .eq('project_id', projectId);

    if (error) {
      console.error('❌ Error fetching attendance records:', error);
      throw error;
    }

    console.log('✅ Attendance records (simple):', data);
    return data || [];
    
  } catch (error) {
    console.error('❌ Error in getSessionAttendanceRecordsSimple:', error);
    throw error;
  }
};

// Test the RPC function
export const testAttendanceSummary = async (sessionId, projectId) => {
  try {
    console.log('🔍 Testing attendance summary RPC for:', { sessionId, projectId });
    
    const { data, error } = await supabase.rpc('get_session_attendance_summary', {
      p_session_id: sessionId,
      p_project_id: projectId
    });

    if (error) {
      console.error('❌ RPC function error:', error);
      throw error;
    }

    console.log('✅ Attendance summary RPC result:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Error testing attendance summary:', error);
    throw error;
  }
};