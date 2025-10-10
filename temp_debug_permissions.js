// Temporary debug script - paste this in browser console when logged in as stakeholder
// This will help us understand what's happening with the permissions

// 1. Check current user
console.log('🔍 Checking current user...');
const { data: session } = await supabase.auth.getSession();
console.log('Session:', session);

if (session.session) {
    // 2. Check auth_users table
    console.log('🔍 Checking auth_users...');
    const { data: authUser, error: authError } = await supabase
        .from('auth_users')
        .select('*')
        .eq('id', session.session.user.id)
        .single();
    
    console.log('Auth user:', authUser, 'Error:', authError);
    
    if (authUser) {
        // 3. Check permissions
        console.log('🔍 Checking permissions...');
        const { data: permissions, error: permError } = await supabase
            .from('auth_user_permissions')
            .select('*')
            .eq('user_id', authUser.id);
            
        console.log('Permissions:', permissions, 'Error:', permError);
        
        // 4. Check available training sessions
        console.log('🔍 Checking available training sessions...');
        const { data: allSessions, error: sessionsError } = await supabase
            .from('training_sessions')
            .select('id, course_name, functional_area, training_location, schedule_id')
            .limit(10);
            
        console.log('Sample sessions:', allSessions, 'Error:', sessionsError);
        
        // 5. Check unique functional areas and locations
        if (allSessions) {
            const functionalAreas = [...new Set(allSessions.map(s => s.functional_area))];
            const trainingLocations = [...new Set(allSessions.map(s => s.training_location))];
            console.log('📊 Available functional areas:', functionalAreas);
            console.log('📊 Available training locations:', trainingLocations);
        }
        
        // 6. Check schedules
        console.log('🔍 Checking schedules...');
        const { data: schedules, error: schedError } = await supabase
            .from('training_schedules')
            .select('id, name, functional_areas, training_locations')
            .limit(5);
            
        console.log('Schedules:', schedules, 'Error:', schedError);
    }
}

console.log('✅ Debug complete - check the console output above');