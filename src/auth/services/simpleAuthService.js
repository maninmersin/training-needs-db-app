import { supabase } from '@core/services/supabaseClient';

/**
 * Simple, robust authentication service
 * No complex role hierarchies - just simple user flags
 */
export class SimpleAuthService {
  /**
   * Get current user with access information
   */
  static async getCurrentUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      // Get user info from our custom table
      const { data: user, error } = await supabase
        .from('auth_users')
        .select('id, email, user_type, is_super_admin, is_active')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return null;
      }

      return {
        ...user,
        session
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Check if current user can access the system
   * Simple logic: must be active, super admins can access everything
   */
  static async canAccess() {
    try {
      const user = await this.getCurrentUser();
      
      if (!user) {
        console.log('🔒 No user found - access denied');
        return false;
      }

      if (!user.is_active) {
        console.log('🔒 User inactive - access denied');
        return false;
      }

      console.log('✅ User access granted:', user.email, {
        type: user.user_type,
        superAdmin: user.is_super_admin,
        active: user.is_active
      });

      return true;
    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  }

  /**
   * Check if current user is super admin
   */
  static async isSuperAdmin() {
    try {
      const user = await this.getCurrentUser();
      return user?.is_super_admin === true;
    } catch (error) {
      console.error('Error checking super admin status:', error);
      return false;
    }
  }

  /**
   * Check if user has access to a specific project
   */
  static async canAccessProject(projectId) {
    try {
      const user = await this.getCurrentUser();
      if (!user) return false;

      // Super admins can access all projects
      if (user.is_super_admin) {
        console.log('✅ Super admin - can access all projects');
        return true;
      }

      // Check project membership
      const { data: membership, error } = await supabase
        .from('project_users')
        .select('id, role, is_active')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking project access:', error);
        return false;
      }

      const hasAccess = !!membership;
      console.log(hasAccess ? '✅' : '🔒', 'Project access:', projectId, hasAccess ? membership.role : 'no access');
      
      return hasAccess;
    } catch (error) {
      console.error('Error checking project access:', error);
      return false;
    }
  }

  /**
   * Get user's permissions for a specific resource type
   */
  static async getUserPermissions(resourceType) {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      // Super admins have all permissions
      if (user.is_super_admin) {
        return {
          resource_type: resourceType,
          can_view: true,
          can_edit: true,
          can_delete: true,
          can_export: true,
          functional_area_names: null, // null = all areas
          training_location_names: null, // null = all locations
          project_ids: null // null = all projects
        };
      }

      const { data: permissions, error } = await supabase
        .from('auth_user_permissions')
        .select('*')
        .eq('user_id', user.id)
        .eq('resource_type', resourceType)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user permissions:', error);
        return null;
      }

      return permissions;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return null;
    }
  }

  /**
   * Build filtered query for user's data access
   */
  static async buildFilteredQuery(baseQuery, resourceType, additionalFilters = {}) {
    try {
      console.log('🔍 buildFilteredQuery called with resourceType:', resourceType);
      
      const permissions = await this.getUserPermissions(resourceType);
      console.log('🔐 Retrieved permissions:', permissions);
      
      if (!permissions) {
        console.warn(`❌ No permissions found for resource: ${resourceType}`);
        
        // Check if user is super admin - if so, allow access to all data
        const isSuperAdmin = await this.isSuperAdmin();
        if (isSuperAdmin) {
          console.log('✅ User is super admin - allowing access to all data');
          return baseQuery;
        }
        
        console.warn(`🔒 Non-super-admin user has no permissions for: ${resourceType}`);
        return baseQuery.limit(0); // Return empty result
      }

      let query = baseQuery;

      // Apply project filtering if specified
      if (permissions.project_ids && permissions.project_ids.length > 0) {
        query = query.in('project_id', permissions.project_ids);
      }

      // Apply functional area filtering if specified
      if (permissions.functional_area_names && permissions.functional_area_names.length > 0) {
        // Different tables use different column names for functional area
        if (resourceType === 'users') {
          // end_users table uses 'division' for functional area
          query = query.in('division', permissions.functional_area_names);
        } else if (resourceType === 'assignments') {
          // training_sessions table uses 'functional_area'
          query = query.in('functional_area', permissions.functional_area_names);
        }
      }

      // Apply training location filtering if specified
      if (permissions.training_location_names && permissions.training_location_names.length > 0) {
        query = query.in('training_location', permissions.training_location_names);
      }

      // Apply any additional filters
      Object.keys(additionalFilters).forEach(key => {
        const value = additionalFilters[key];
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });

      console.log('✅ Applied data filters for', resourceType, {
        table_type: resourceType === 'users' ? 'end_users' : 'training_sessions',
        functional_area_column: resourceType === 'users' ? 'division' : 'functional_area',
        functional_areas: permissions.functional_area_names,
        training_locations: permissions.training_location_names,
        projects: permissions.project_ids,
        permissions: permissions
      });
      
      console.log('🔍 Filter details:', {
        'has_functional_area_filter': permissions.functional_area_names && permissions.functional_area_names.length > 0,
        'has_location_filter': permissions.training_location_names && permissions.training_location_names.length > 0,
        'has_project_filter': permissions.project_ids && permissions.project_ids.length > 0,
        'filtering_table': resourceType === 'users' ? 'end_users' : 'training_sessions'
      });

      return query;
    } catch (error) {
      console.error('Error building filtered query:', error);
      return baseQuery.limit(0); // Return empty result on error
    }
  }

  /**
   * Get filtered end users based on user permissions
   */
  static async getFilteredEndUsers(projectId, options = {}) {
    try {
      const { page = 1, pageSize = 50, includeTotalCount = true } = options;
      
      // First, let's get the total count if requested
      let totalCount = 0;
      if (includeTotalCount) {
        const { count, error: countError } = await supabase
          .from('end_users')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        if (countError) {
          console.error('Error getting user count:', countError);
        } else {
          totalCount = count || 0;
          console.log(`📊 Total end users in project ${projectId}:`, totalCount);
        }
      }

      // Calculate pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const baseQuery = supabase
        .from('end_users')
        .select('*')
        .eq('project_id', projectId)
        .order('id', { ascending: true })
        .range(from, to);

      const filteredQuery = await this.buildFilteredQuery(baseQuery, 'users');
      const { data, error } = await filteredQuery;

      if (error) {
        console.error('Error fetching filtered end users:', error);
        return { users: [], totalCount: 0 };
      }

      console.log(`📊 Retrieved ${data?.length || 0} end users for project ${projectId} (page ${page})`);
      
      return { 
        users: data || [], 
        totalCount,
        currentPage: page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      };
    } catch (error) {
      console.error('Error fetching filtered end users:', error);
      return { users: [], totalCount: 0 };
    }
  }

  /**
   * Get filtered training sessions based on user permissions
   * This is the core method for User Assignment filtering
   */
  static async getFilteredTrainingSessions(scheduleId) {
    try {
      console.log('🔍 getFilteredTrainingSessions called with scheduleId:', scheduleId);
      
      const baseQuery = supabase
        .from('training_sessions')
        .select('*')
        .eq('schedule_id', scheduleId);

      console.log('🔍 Building filtered query for resource type: assignments');
      const filteredQuery = await this.buildFilteredQuery(baseQuery, 'assignments');
      
      console.log('🔍 Executing filtered query...');
      const { data, error } = await filteredQuery;

      if (error) {
        console.error('❌ Error fetching filtered training sessions:', error);
        
        // Also try the unfiltered query for comparison
        console.log('🔍 Trying unfiltered query for comparison...');
        const { data: unfilteredData, error: unfilteredError } = await supabase
          .from('training_sessions')
          .select('id, course_name, functional_area, training_location')
          .eq('schedule_id', scheduleId)
          .limit(5);
          
        if (unfilteredError) {
          console.error('❌ Even unfiltered query failed:', unfilteredError);
        } else {
          console.log('📊 Unfiltered sessions exist:', unfilteredData);
        }
        
        return [];
      }

      console.log('✅ Filtered training sessions result:', {
        scheduleId,
        count: data?.length || 0,
        sampleSessions: data?.slice(0, 3).map(s => ({
          id: s.id,
          course_name: s.course_name,
          functional_area: s.functional_area,
          training_location: s.training_location
        }))
      });

      return data || [];
    } catch (error) {
      console.error('❌ Exception in getFilteredTrainingSessions:', error);
      return [];
    }
  }

  /**
   * Get user's project memberships
   */
  static async getUserProjects() {
    try {
      const user = await this.getCurrentUser();
      if (!user) return [];

      const { data: projects, error } = await supabase
        .from('project_users')
        .select(`
          project_id,
          role,
          is_active,
          projects (
            id,
            name,
            title,
            description
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching user projects:', error);
        return [];
      }

      return projects || [];
    } catch (error) {
      console.error('Error fetching user projects:', error);
      return [];
    }
  }
}

export default SimpleAuthService;