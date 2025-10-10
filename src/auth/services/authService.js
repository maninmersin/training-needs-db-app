import { supabase } from '@core/services/supabaseClient';

/**
 * Authentication service for role-based access control
 */
export class AuthService {
  /**
   * Get current user's roles
   */
  static async getCurrentUserRoles() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from('auth_user_roles')
        .select(`
          role_id,
          auth_roles (
            id,
            name,
            description
          )
        `)
        .eq('user_id', session.user.id);

      if (error) {
        // Handle database schema issues gracefully
        if (error.status === 406 || error.code === 'PGRST116' || error.code === '42P01') {
          console.warn('Role system not available, using fallback for super admin:', error.message);
          
          // Fallback: Check if this is a super admin by email or other means
          const adminEmails = [
            'stuart-lawson@hotmail.co.uk', // Current logged in user
            'stuart.smith@company.com', // Add known admin emails
            'admin@company.com'
          ];
          
          if (adminEmails.includes(session.user.email)) {
            console.log('🛡️ Fallback: Granting super_admin role based on email');
            return [{ id: 'fallback', name: 'super_admin', description: 'Fallback admin access' }];
          }
          
          return [];
        }
        throw error;
      }
      
      return data?.map(ur => ur.auth_roles) || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  }

  /**
   * Check if current user has a specific role
   */
  static async hasRole(roleName) {
    const roles = await this.getCurrentUserRoles();
    return roles.some(role => role.name === roleName);
  }

  /**
   * Check if current user has any of the specified roles
   */
  static async hasAnyRole(roleNames) {
    const roles = await this.getCurrentUserRoles();
    const userRoleNames = roles.map(role => role.name);
    return roleNames.some(roleName => userRoleNames.includes(roleName));
  }

  /**
   * Get user's functional area assignments
   */
  static async getUserFunctionalAreas() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      // Check if the auth_user_functional_areas table exists and is accessible
      const { data, error } = await supabase
        .from('auth_user_functional_areas')
        .select(`
          *,
          functional_areas (id, name),
          training_locations (id, name)
        `)
        .eq('user_id', session.user.id);

      if (error) {
        // If table doesn't exist or access is denied, log warning but don't crash
        if (error.code === 'PGRST116' || error.code === '42P01' || error.status === 406) {
          console.warn('auth_user_functional_areas table not available:', error.message);
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('Error fetching user functional areas:', error);
      return [];
    }
  }

  /**
   * Check if user is a stakeholder assignment editor
   */
  static async isStakeholderAssignmentEditor() {
    return await this.hasRole('stakeholder_assignment_editor');
  }

  /**
   * Check if user is an admin (any type)
   */
  static async isAdmin() {
    return await this.hasAnyRole(['admin', 'super_admin']);
  }

  /**
   * Get user's allowed routes based on role
   */
  static async getAllowedRoutes() {
    try {
      const roles = await this.getCurrentUserRoles();
      const roleNames = roles.map(role => role.name);

      // Define route permissions by role
      const routePermissions = {
        'super_admin': ['*'], // All routes
        'admin': ['*'], // All routes
        'stakeholder_assignment_editor': [
          '/drag-drop-assignments'
        ],
        'user': [
          '/',
          '/user-assignment'
        ]
      };

      // Get all allowed routes for user's roles
      const allowedRoutes = new Set();
      
      // If no roles found (database issues), allow basic routes for authenticated users
      if (roleNames.length === 0) {
        console.log('🛡️ No roles found, using fallback routes');
        
        // Check if this should be an admin user by email
        const { data: { session } } = await supabase.auth.getSession();
        const adminEmails = [
          'stuart-lawson@hotmail.co.uk',
          'stuart.smith@company.com', 
          'admin@company.com'
        ];
        
        if (session && adminEmails.includes(session.user.email)) {
          console.log('🛡️ Admin user detected, allowing all routes');
          return ['*']; // Full access for admin users
        }
        
        return ['/', '/drag-drop-assignments']; // Basic fallback routes for non-admin
      }
      
      for (const roleName of roleNames) {
        const routes = routePermissions[roleName] || [];
        routes.forEach(route => allowedRoutes.add(route));
      }

      return Array.from(allowedRoutes);
    } catch (error) {
      console.error('Error getting allowed routes:', error);
      // Fallback: Allow basic routes for authenticated users
      console.log('🛡️ Using fallback routes due to error');
      
      try {
        // Check if this should be an admin user by email
        const { data: { session } } = await supabase.auth.getSession();
        const adminEmails = [
          'stuart-lawson@hotmail.co.uk',
          'stuart.smith@company.com', 
          'admin@company.com'
        ];
        
        if (session && adminEmails.includes(session.user.email)) {
          console.log('🛡️ Admin user detected in error handler, allowing all routes');
          return ['*']; // Full access for admin users
        }
      } catch (sessionError) {
        console.error('Error checking session in fallback:', sessionError);
      }
      
      return ['/', '/drag-drop-assignments'];
    }
  }

  /**
   * Check if user can access a specific route
   */
  static async canAccessRoute(route) {
    const allowedRoutes = await this.getAllowedRoutes();
    return allowedRoutes.includes('*') || allowedRoutes.includes(route);
  }

  /**
   * Get default route for user based on role
   */
  static async getDefaultRoute() {
    try {
      const isStakeholder = await this.isStakeholderAssignmentEditor();
      const isAdmin = await this.isAdmin();

      if (isStakeholder) {
        return '/drag-drop-assignments';
      }
      
      if (isAdmin) {
        return '/';
      }

      return '/';
    } catch (error) {
      console.error('Error getting default route:', error);
      // Fallback to home page for authenticated users
      console.log('🛡️ Using fallback default route');
      return '/';
    }
  }
}

export default AuthService;