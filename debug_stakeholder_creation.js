// Debug script for stakeholder creation issue
// Run this in browser console on the stakeholder page

async function debugStakeholderCreation() {
  console.log('=== STAKEHOLDER CREATION DEBUG ===');
  
  // 1. Check if Supabase client is available
  if (typeof supabase === 'undefined') {
    console.error('Supabase client not found');
    return;
  }
  
  // 2. Check current user
  const { data: user, error: userError } = await supabase.auth.getUser();
  console.log('Current user:', user?.user?.id, user?.user?.email);
  if (userError) {
    console.error('User error:', userError);
    return;
  }
  
  // 3. Check current project from context (if available)
  const projectElement = document.querySelector('[data-testid="current-project"], .project-selector');
  console.log('Project context element found:', !!projectElement);
  
  // 4. Check project membership
  const { data: projectUsers, error: puError } = await supabase
    .from('project_users')
    .select('*')
    .eq('user_id', user.user.id);
    
  console.log('User project memberships:', projectUsers);
  if (puError) {
    console.error('Project users error:', puError);
  }
  
  // 5. Check projects table access
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, title');
    
  console.log('Accessible projects:', projects);
  if (projectsError) {
    console.error('Projects error:', projectsError);
  }
  
  // 6. Check stakeholders table RLS
  const { data: stakeholders, error: stakeholdersError } = await supabase
    .from('stakeholders')
    .select('count')
    .limit(1);
    
  console.log('Can read stakeholders table:', !stakeholdersError);
  if (stakeholdersError) {
    console.error('Stakeholders read error:', stakeholdersError);
  }
  
  // 7. Test a simple insert with minimal data
  if (projectUsers && projectUsers.length > 0) {
    const testProjectId = projectUsers[0].project_id;
    console.log('Testing insert with project ID:', testProjectId);
    
    const { data: insertTest, error: insertError } = await supabase
      .from('stakeholders')
      .insert([{
        name: 'Test Stakeholder (Delete Me)',
        project_id: testProjectId,
        stakeholder_category: 'Internal',
        stakeholder_priority: 'Primary',
        stakeholder_type: 'General',
        power_level: 3,
        interest_level: 3,
        current_engagement_level: 0,
        target_engagement_level: 3,
        position_on_change: 'Neutral',
        engagement_status: 'A'
      }])
      .select()
      .single();
      
    if (insertError) {
      console.error('Insert test failed:', insertError);
      console.error('Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log('Insert test successful:', insertTest);
      
      // Clean up test record
      await supabase
        .from('stakeholders')
        .delete()
        .eq('id', insertTest.id);
      console.log('Test record cleaned up');
    }
  } else {
    console.warn('No project memberships found - cannot test insert');
  }
  
  console.log('=== DEBUG COMPLETE ===');
}

// Auto-run the debug function
debugStakeholderCreation();