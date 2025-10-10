// Debug script to test stakeholder data access
// Run this in the browser console when logged in as stakeholder

import { SimpleAuthService } from './src/auth/services/simpleAuthService.js';
import { supabase } from './src/core/services/supabaseClient.js';

console.log('🔍 Debug: Starting stakeholder data access test');

// Test current user
const debugCurrentUser = async () => {
  try {
    const user = await SimpleAuthService.getCurrentUser();
    console.log('👤 Current user:', user);
    return user;
  } catch (error) {
    console.error('❌ Error getting current user:', error);
    return null;
  }
};

// Test user permissions
const debugUserPermissions = async () => {
  try {
    const permissions = await SimpleAuthService.getUserPermissions('assignments');
    console.log('🔐 User permissions for assignments:', permissions);
    return permissions;
  } catch (error) {
    console.error('❌ Error getting permissions:', error);
    return null;
  }
};

// Test what schedules exist
const debugSchedules = async (projectId) => {
  try {
    const { data: schedules, error } = await supabase
      .from('training_schedules')
      .select('id, name, functional_areas, training_locations')
      .eq('project_id', projectId)
      .limit(5);
      
    if (error) throw error;
    console.log('📋 Available schedules:', schedules);
    return schedules;
  } catch (error) {
    console.error('❌ Error getting schedules:', error);
    return [];
  }
};

// Test what training sessions exist
const debugTrainingSessions = async () => {
  try {
    const { data: sessions, error } = await supabase
      .from('training_sessions')
      .select('id, course_name, functional_area, training_location, schedule_id')
      .limit(10);
      
    if (error) throw error;
    console.log('📚 Available training sessions (sample):', sessions);
    
    // Group by functional area and training location
    const groupedSessions = {};
    sessions.forEach(session => {
      const key = `${session.functional_area} | ${session.training_location}`;
      if (!groupedSessions[key]) groupedSessions[key] = [];
      groupedSessions[key].push(session);
    });
    
    console.log('📊 Sessions by functional area | training location:', groupedSessions);
    return sessions;
  } catch (error) {
    console.error('❌ Error getting sessions:', error);
    return [];
  }
};

// Test filtered sessions for a specific schedule
const debugFilteredSessions = async (scheduleId) => {
  try {
    console.log(`🔍 Testing filtered sessions for schedule: ${scheduleId}`);
    const sessions = await SimpleAuthService.getFilteredTrainingSessions(scheduleId);
    console.log('✅ Filtered sessions result:', sessions);
    return sessions;
  } catch (error) {
    console.error('❌ Error getting filtered sessions:', error);
    return [];
  }
};

// Run all debug tests
const runDebugTests = async () => {
  console.log('🚀 Starting comprehensive debug test...');
  
  const user = await debugCurrentUser();
  const permissions = await debugUserPermissions();
  const sessions = await debugTrainingSessions();
  
  if (user?.projects && user.projects.length > 0) {
    const projectId = user.projects[0].project_id;
    console.log(`🏢 Using project ID: ${projectId}`);
    
    const schedules = await debugSchedules(projectId);
    
    if (schedules && schedules.length > 0) {
      const firstScheduleId = schedules[0].id;
      await debugFilteredSessions(firstScheduleId);
    }
  }
  
  console.log('✅ Debug test complete');
};

// Export for browser console
window.debugStakeholder = {
  runDebugTests,
  debugCurrentUser,
  debugUserPermissions,
  debugSchedules,
  debugTrainingSessions,
  debugFilteredSessions
};

console.log('🔧 Debug functions available: window.debugStakeholder');
console.log('📝 To run full test: window.debugStakeholder.runDebugTests()');