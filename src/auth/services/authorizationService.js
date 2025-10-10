import { supabase } from '@core/services/supabaseClient';
import { AuthService } from './authService';

/**
 * Enterprise Authorization Service - Policy Decision Point (PDP)
 * 
 * This service provides centralized authorization decisions for all resources
 * and actions in the application, implementing the Policy-Based Access Control (PBAC) pattern.
 */
export class AuthorizationService {
  
  // Cache for user permissions to improve performance
  static permissionCache = new Map();
  static cacheExpiry = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Main authorization decision method - can user perform action on resource?
   */
  static async canUserAccessResource(userId, resource, action, context = {}) {
    try {
      // Get user permissions for this resource type
      const permissions = await this.getUserPermissions(userId, resource.type, context);
      
      // Check if user has required permission for this action
      return this.evaluatePermission(permissions, resource, action, context);
    } catch (error) {
      console.error('Authorization check failed:', error);
      // Fail secure - deny access on error
      return false;
    }
  }
  
  /**
   * Filter a collection of resources based on user permissions
   */
  static async filterResourcesByPermission(userId, resources, action, context = {}) {
    if (!resources || resources.length === 0) {
      return [];
    }
    
    // Get user permissions once for efficiency
    const resourceType = resources[0]?.type || this.inferResourceType(resources[0]);
    const permissions = await this.getUserPermissions(userId, resourceType, context);
    
    // Filter resources based on permissions
    return resources.filter(resource => {
      return this.evaluatePermission(permissions, resource, action, context);
    });
  }
  
  /**
   * Get comprehensive user permissions for a specific resource type
   */
  static async getUserPermissions(userId, resourceType, context = {}) {
    const cacheKey = `${userId}-${resourceType}-${JSON.stringify(context)}`;
    const cached = this.permissionCache.get(cacheKey);
    
    // Return cached permissions if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.permissions;
    }
    
    try {
      // Verify user session exists
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId) {
        console.warn('Invalid or missing user session');
        return { roles: [], isAdmin: false, isStakeholderEditor: false, userId };
      }
      
      // Get user roles with error handling
      let roles = [];
      let functionalAreas = [];
      
      try {
        roles = await AuthService.getCurrentUserRoles();
      } catch (error) {
        console.warn('Could not fetch user roles:', error);
        // Fallback to basic session info
        roles = [];
      }
      
      const roleNames = roles.map(role => role.name);
      
      // Get user's functional area and training location assignments with error handling
      try {
        if (roleNames.includes('stakeholder_assignment_editor')) {
          functionalAreas = await AuthService.getUserFunctionalAreas();
        }
      } catch (error) {
        console.warn('Could not fetch user functional areas:', error);
        // Fallback to empty arrays
        functionalAreas = [];
      }
      
      // Build comprehensive permission object with safe defaults
      const permissions = {
        roles: roleNames,
        isAdmin: roleNames.includes('admin') || roleNames.includes('super_admin'),
        isStakeholderEditor: roleNames.includes('stakeholder_assignment_editor'),
        assignedFunctionalAreas: functionalAreas.map(fa => fa.functional_areas?.name).filter(Boolean) || [],
        assignedTrainingLocations: functionalAreas.map(fa => fa.training_locations?.name).filter(Boolean) || [],
        userId,
        context
      };
      
      // Cache permissions
      this.permissionCache.set(cacheKey, {
        permissions,
        timestamp: Date.now()
      });
      
      return permissions;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      // Return safe defaults that deny access
      return { 
        roles: [], 
        isAdmin: false, 
        isStakeholderEditor: false,
        assignedFunctionalAreas: [],
        assignedTrainingLocations: [],
        userId
      };
    }
  }
  
  /**
   * Evaluate if permissions allow the requested action on resource
   */
  static evaluatePermission(permissions, resource, action, context = {}) {
    // Admin users have full access
    if (permissions.isAdmin) {
      return true;
    }
    
    // Apply resource-specific permission logic
    switch (resource.type) {
      case 'user_assignment':
        return this.evaluateUserAssignmentPermission(permissions, resource, action, context);
      
      case 'end_user':
        return this.evaluateEndUserPermission(permissions, resource, action, context);
      
      case 'training_session':
        return this.evaluateTrainingSessionPermission(permissions, resource, action, context);
      
      case 'reference_data':
        return this.evaluateReferenceDataPermission(permissions, resource, action, context);
      
      case 'route':
        return this.evaluateRoutePermission(permissions, resource, action, context);
      
      default:
        console.warn(`Unknown resource type: ${resource.type}`);
        return false;
    }
  }
  
  /**
   * Permission evaluators for specific resource types
   */
  
  static evaluateUserAssignmentPermission(permissions, resource, action, context) {
    // Stakeholder editors can manage assignments within their scope
    if (permissions.isStakeholderEditor) {
      switch (action) {
        case 'view':
        case 'assign':
        case 'unassign':
          // Check if the assignment involves users/sessions in their assigned areas
          return this.isWithinStakeholderScope(permissions, resource);
        default:
          return false;
      }
    }
    
    return false;
  }
  
  static evaluateEndUserPermission(permissions, resource, action, context) {
    // Stakeholder editors can view/modify users in their assigned areas
    if (permissions.isStakeholderEditor) {
      switch (action) {
        case 'view':
        case 'modify':
          return this.isUserInAssignedScope(permissions, resource);
        default:
          return false;
      }
    }
    
    return false;
  }
  
  static evaluateTrainingSessionPermission(permissions, resource, action, context) {
    // Stakeholder editors can view all sessions but only modify assignments in their scope
    if (permissions.isStakeholderEditor) {
      switch (action) {
        case 'view':
          return true; // Can view all sessions for context
        case 'assign_users':
        case 'unassign_users':
          return this.isSessionInAssignedScope(permissions, resource);
        default:
          return false;
      }
    }
    
    return false;
  }
  
  static evaluateReferenceDataPermission(permissions, resource, action, context) {
    // Only admins can access reference data
    return permissions.isAdmin;
  }
  
  static evaluateRoutePermission(permissions, resource, action, context) {
    // Define allowed routes per role
    const allowedRoutes = {
      'stakeholder_assignment_editor': ['/drag-drop-assignments'],
      'admin': ['*'],
      'super_admin': ['*']
    };
    
    // If no roles found but this appears to be an admin user, allow access
    if (permissions.roles.length === 0) {
      // Fallback: Allow access to home routes for authenticated users
      const publicRoutes = ['/', '/drag-drop-assignments'];
      if (publicRoutes.includes(resource.path)) {
        console.log('🛡️ Fallback: Allowing access to public route for authenticated user');
        return true;
      }
    }
    
    for (const roleName of permissions.roles) {
      const routes = allowedRoutes[roleName] || [];
      if (routes.includes('*') || routes.includes(resource.path)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Helper methods for scope checking
   */
  
  static isWithinStakeholderScope(permissions, resource) {
    // Check if user and session are within stakeholder's assigned areas
    const user = resource.user;
    const session = resource.session;
    
    const userInScope = this.isUserInAssignedScope(permissions, { type: 'end_user', ...user });
    const sessionInScope = this.isSessionInAssignedScope(permissions, { type: 'training_session', ...session });
    
    return userInScope && sessionInScope;
  }
  
  static isUserInAssignedScope(permissions, user) {
    const userLocation = user.training_location;
    const userFunctionalArea = user.functional_area;
    
    const locationMatch = permissions.assignedTrainingLocations.length === 0 || 
                         permissions.assignedTrainingLocations.includes(userLocation);
    const functionalAreaMatch = permissions.assignedFunctionalAreas.length === 0 || 
                               permissions.assignedFunctionalAreas.includes(userFunctionalArea);
    
    return locationMatch && functionalAreaMatch;
  }
  
  static isSessionInAssignedScope(permissions, session) {
    const sessionLocation = session._location || session.training_location;
    const sessionFunctionalArea = session._functionalArea || session.functional_area;
    
    const locationMatch = permissions.assignedTrainingLocations.length === 0 || 
                         permissions.assignedTrainingLocations.includes(sessionLocation);
    const functionalAreaMatch = permissions.assignedFunctionalAreas.length === 0 || 
                               permissions.assignedFunctionalAreas.includes(sessionFunctionalArea);
    
    return locationMatch && functionalAreaMatch;
  }
  
  /**
   * Utility methods
   */
  
  static inferResourceType(resource) {
    if (resource.training_location && resource.name) return 'end_user';
    if (resource.course_id && resource.title) return 'training_session';
    if (resource.user_id && resource.session_id) return 'user_assignment';
    return 'unknown';
  }
  
  /**
   * Clear permission cache (useful for testing or after role changes)
   */
  static clearCache(userId = null) {
    if (userId) {
      // Clear cache for specific user
      for (const [key] of this.permissionCache.entries()) {
        if (key.startsWith(`${userId}-`)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.permissionCache.clear();
    }
  }
  
  /**
   * Convenience methods for common authorization checks
   */
  
  static async canRemoveUserFromSession(userId, targetUser, session) {
    return this.canUserAccessResource(userId, {
      type: 'user_assignment',
      user: targetUser,
      session: session
    }, 'unassign');
  }
  
  static async canAssignUserToSession(userId, targetUser, session) {
    return this.canUserAccessResource(userId, {
      type: 'user_assignment',
      user: targetUser,
      session: session
    }, 'assign');
  }
  
  static async canViewUser(userId, targetUser) {
    return this.canUserAccessResource(userId, {
      type: 'end_user',
      ...targetUser
    }, 'view');
  }
  
  static async canAccessRoute(userId, routePath) {
    return this.canUserAccessResource(userId, {
      type: 'route',
      path: routePath
    }, 'navigate');
  }
}

export default AuthorizationService;