import { supabase } from '@core/services/supabaseClient';

/**
 * Service layer for project-related database operations
 * Handles all CRUD operations for projects and project membership
 */

/**
 * Get all projects the current user has access to
 * @returns {Promise<Array>} Array of projects with statistics
 */
export const getAllProjects = async () => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User authentication required');

    // Check if user has global admin role
    const { data: userRoles, error: rolesError } = await supabase
      .from('auth_user_roles')
      .select(`
        auth_roles (name)
      `)
      .eq('user_id', user.id);

    if (rolesError) {
      console.warn('Could not check user roles:', rolesError);
    }

    const hasGlobalAdminRole = userRoles?.some(ur => {
      const roleName = ur.auth_roles?.name?.toLowerCase();
      return ['admin', 'system_admin', 'global_admin', 'super_admin', 'administrator'].includes(roleName);
    });

    // If user has global admin role, return all projects
    if (hasGlobalAdminRole) {
      const { data, error } = await supabase
        .from('projects_with_stats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    // Otherwise, return only projects the user has explicit access to
    // This relies on RLS policies to filter based on project_users table
    const { data, error } = await supabase
      .from('projects_with_stats')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ Error in getAllProjects:', error);
    throw error;
  }
};

/**
 * Get a specific project by ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object>} Project data
 */
export const getProject = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('❌ Error in getProject:', error);
    throw error;
  }
};

/**
 * Create a new project
 * @param {Object} projectData - Project information
 * @returns {Promise<Object>} Created project data
 */
export const createProject = async (projectData) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User authentication required');

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([{
        name: projectData.name,
        title: projectData.title,
        description: projectData.description,
        project_code: projectData.project_code,
        start_date: projectData.start_date,
        target_end_date: projectData.target_end_date,
        settings: projectData.settings || {},
        branding: projectData.branding || {},
        owner_id: user.id,
        created_by: user.id
      }])
      .select()
      .single();

    if (projectError) throw projectError;

    // Add creator as project owner
    const { error: memberError } = await supabase
      .from('project_users')
      .insert([{
        project_id: project.id,
        user_id: user.id,
        role: 'owner',
        added_by: user.id
      }]);

    if (memberError) {
      console.warn('Warning: Could not add creator as project member:', memberError);
    }

    console.log('✅ Project created successfully:', project.name);
    return project;
  } catch (error) {
    console.error('❌ Error in createProject:', error);
    throw error;
  }
};

/**
 * Update an existing project
 * @param {string} projectId - Project ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated project data
 */
export const updateProject = async (projectId, updates) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Project updated successfully:', data.name);
    return data;
  } catch (error) {
    console.error('❌ Error in updateProject:', error);
    throw error;
  }
};

/**
 * Delete a project and all its associated data
 * This function performs cascade deletion of all related data in the correct order
 * @param {string} projectId - Project ID to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteProject = async (projectId) => {
  try {
    console.log(`🗑️ Starting cascade deletion of project: ${projectId}`);
    
    // Check if project exists and get basic info
    const { data: project, error: projectCheckError } = await supabase
      .from('projects')
      .select('name, title')
      .eq('id', projectId)
      .single();
      
    if (projectCheckError) {
      if (projectCheckError.code === 'PGRST116') {
        throw new Error('Project not found');
      }
      throw projectCheckError;
    }

    const deletionSteps = [
      // Step 1: Delete user assignments (depends on training_sessions)
      { table: 'user_assignments', description: 'user assignments' },
      
      // Step 2: Delete training sessions (depends on training_schedules)
      { table: 'training_sessions', description: 'training sessions' },
      
      // Step 3: Delete training schedules
      { table: 'training_schedules', description: 'training schedules' },
      
      // Step 4: Delete edited training schedules  
      { table: 'edited_training_schedules', description: 'edited training schedules' },
      
      // Step 5: Delete role course mappings
      { table: 'role_course_mappings', description: 'role course mappings' },
      
      // Step 6: Delete project roles
      { table: 'project_roles', description: 'project roles' },
      
      // Step 7: Delete courses
      { table: 'courses', description: 'courses' },
      
      // Step 8: Delete end users  
      { table: 'end_users', description: 'end users' },
      
      // Step 9: Delete trainers
      { table: 'trainers', description: 'trainers' },
      
      // Step 10: Delete user functional areas
      { table: 'auth_user_functional_areas', description: 'user functional areas' },
      
      // Step 11: Delete functional areas
      { table: 'functional_areas', description: 'functional areas' },
      
      // Step 12: Delete training locations
      { table: 'training_locations', description: 'training locations' },
      
      // Step 13: Delete user roles for this project
      { table: 'auth_user_roles', description: 'user roles', condition: 'project_id' },
      
      // Step 14: Delete project users
      { table: 'project_users', description: 'project users' }
    ];

    let deletedCounts = {};
    
    // Perform cascade deletion
    for (const step of deletionSteps) {
      const { data, error } = await supabase
        .from(step.table)
        .delete()
        .eq('project_id', projectId)
        .select('id');
        
      if (error) {
        console.warn(`⚠️  Warning: Could not delete from ${step.table}:`, error.message);
        // Continue with deletion even if some steps fail
      } else {
        const count = data?.length || 0;
        deletedCounts[step.table] = count;
        if (count > 0) {
          console.log(`🗑️ Deleted ${count} ${step.description}`);
        }
      }
    }

    // Finally, delete the project itself
    const { error: projectDeleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (projectDeleteError) throw projectDeleteError;

    // Log summary
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);
    console.log(`✅ Project "${project.title}" deleted successfully`);
    console.log(`📊 Deletion summary: Removed ${totalDeleted} associated records across ${Object.keys(deletedCounts).length} tables`);
    
    return true;
  } catch (error) {
    console.error('❌ Error in deleteProject:', error);
    throw error;
  }
};

/**
 * Get all members of a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of project members
 */
export const getProjectMembers = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('project_users')
      .select(`
        *,
        user:auth.users(id, email)
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('joined_at');

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('❌ Error in getProjectMembers:', error);
    throw error;
  }
};

/**
 * Add a user to a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID to add
 * @param {string} role - User role (owner, admin, member, viewer)
 * @returns {Promise<Object>} Created project membership
 */
export const addProjectMember = async (projectId, userId, role = 'member') => {
  try {
    // Get current user for added_by field
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User authentication required');

    const { data, error } = await supabase
      .from('project_users')
      .insert([{
        project_id: projectId,
        user_id: userId,
        role,
        added_by: user.id
      }])
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ User added to project: ${userId} as ${role}`);
    return data;
  } catch (error) {
    console.error('❌ Error in addProjectMember:', error);
    throw error;
  }
};

/**
 * Update a project member's role
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @param {string} newRole - New role to assign
 * @returns {Promise<Object>} Updated project membership
 */
export const updateProjectMember = async (projectId, userId, newRole) => {
  try {
    const { data, error } = await supabase
      .from('project_users')
      .update({ role: newRole })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ User role updated: ${userId} -> ${newRole}`);
    return data;
  } catch (error) {
    console.error('❌ Error in updateProjectMember:', error);
    throw error;
  }
};

/**
 * Remove a user from a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID to remove
 * @returns {Promise<boolean>} Success status
 */
export const removeProjectMember = async (projectId, userId) => {
  try {
    const { error } = await supabase
      .from('project_users')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;

    console.log(`✅ User removed from project: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error in removeProjectMember:', error);
    throw error;
  }
};

/**
 * Get current user's role in a project
 * @param {string} projectId - Project ID
 * @returns {Promise<string|null>} User's role or null if not a member
 */
export const getUserProjectRole = async (projectId) => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return null;

    // Check if user is project owner
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (!projectError && project && project.owner_id === user.id) {
      return 'owner';
    }

    // Check project membership
    const { data: membership, error: memberError } = await supabase
      .from('project_users')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (memberError || !membership) return null;

    return membership.role;
  } catch (error) {
    console.error('❌ Error in getUserProjectRole:', error);
    return null;
  }
};

/**
 * Check if current user has permission for an action in a project
 * @param {string} projectId - Project ID
 * @param {string} action - Action to check (read, write, delete, admin, invite)
 * @returns {Promise<boolean>} Whether user has permission
 */
export const hasProjectPermission = async (projectId, action) => {
  try {
    const role = await getUserProjectRole(projectId);
    if (!role) return false;

    const permissions = {
      owner: ['read', 'write', 'delete', 'admin', 'invite'],
      admin: ['read', 'write', 'admin', 'invite'],
      member: ['read', 'write'],
      viewer: ['read']
    };

    return permissions[role]?.includes(action) || false;
  } catch (error) {
    console.error('❌ Error in hasProjectPermission:', error);
    return false;
  }
};

/**
 * Get project statistics
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project statistics
 */
export const getProjectStats = async (projectId) => {
  try {
    const { data, error } = await supabase
      .from('projects_with_stats')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) throw error;

    return {
      memberCount: data.member_count || 0,
      activeMemberCount: data.active_member_count || 0,
      scheduleCount: data.schedule_count || 0,
      endUserCount: data.end_user_count || 0,
      courseCount: data.course_count || 0
    };
  } catch (error) {
    console.error('❌ Error in getProjectStats:', error);
    throw error;
  }
};

/**
 * Check if project name is available
 * @param {string} name - Project name to check
 * @param {string|null} excludeProjectId - Project ID to exclude from check (for updates)
 * @returns {Promise<boolean>} Whether name is available
 */
export const isProjectNameAvailable = async (name, excludeProjectId = null) => {
  try {
    let query = supabase
      .from('projects')
      .select('id')
      .eq('name', name.trim())
      .limit(1);

    if (excludeProjectId) {
      query = query.neq('id', excludeProjectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return !data || data.length === 0;
  } catch (error) {
    console.error('❌ Error in isProjectNameAvailable:', error);
    return false;
  }
};