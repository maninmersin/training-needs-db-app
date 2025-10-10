import { useState, useEffect, useMemo } from 'react';
import { SimpleAuthService } from '@auth/services/simpleAuthService';
import { supabase } from '@core/services/supabaseClient';

/**
 * Policy Enforcement Point (PEP) utilities
 * 
 * These utilities provide React hooks and functions to enforce authorization
 * decisions throughout the application UI and business logic.
 */

/**
 * React hook for checking user permissions
 */
export function useAuthorization(resourceType, action, context = {}) {
  const [permissions, setPermissions] = useState({
    loading: true,
    canAccess: false,
    error: null
  });
  
  const [userId, setUserId] = useState(null);
  
  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    
    getCurrentUser();
  }, []);
  
  // Check permissions when user or context changes
  useEffect(() => {
    if (!userId) {
      setPermissions({ loading: false, canAccess: false, error: null });
      return;
    }
    
    const checkPermissions = async () => {
      try {
        setPermissions(prev => ({ ...prev, loading: true }));
        
        const userPermissions = await SimpleAuthService.getUserPermissions(resourceType);
        
        setPermissions({
          loading: false,
          canAccess: true,
          error: null,
          details: userPermissions
        });
      } catch (error) {
        console.error('Permission check failed:', error);
        setPermissions({
          loading: false,
          canAccess: false,
          error: error.message
        });
      }
    };
    
    checkPermissions();
  }, [userId, resourceType, action, JSON.stringify(context)]);
  
  return permissions;
}

/**
 * React hook for filtering resources based on user permissions
 */
export function useFilteredResources(resources, action, resourceType) {
  const [filteredResources, setFilteredResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  
  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    
    getCurrentUser();
  }, []);
  
  // Filter resources when user or resources change
  useEffect(() => {
    if (!userId || !resources) {
      setFilteredResources([]);
      setLoading(false);
      return;
    }
    
    const filterResources = async () => {
      try {
        setLoading(true);
        
        // Add resource type to each resource if not present
        const resourcesWithType = resources.map(resource => ({
          ...resource,
          type: resource.type || resourceType
        }));
        
        const filtered = await AuthorizationService.filterResourcesByPermission(
          userId,
          resourcesWithType,
          action
        );
        
        setFilteredResources(filtered);
      } catch (error) {
        console.error('Resource filtering failed:', error);
        setFilteredResources([]);
      } finally {
        setLoading(false);
      }
    };
    
    filterResources();
  }, [userId, resources, action, resourceType]);
  
  return { filteredResources, loading };
}

/**
 * Higher-order component for protecting components with authorization
 */
export function withAuthorization(WrappedComponent, requiredPermission) {
  return function AuthorizedComponent(props) {
    const { canAccess, loading } = useAuthorization(
      requiredPermission.resourceType,
      requiredPermission.action,
      requiredPermission.context
    );
    
    if (loading) {
      return <div>Checking permissions...</div>;
    }
    
    if (!canAccess) {
      return <div>Access denied</div>;
    }
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * Utility function for imperative permission checking
 */
export async function checkPermission(resource, action, context = {}) {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user?.id) {
      console.warn('No valid session for permission check');
      return false;
    }
    
    return await AuthorizationService.canUserAccessResource(
      session.user.id,
      resource,
      action,
      context
    );
  } catch (error) {
    console.warn('Permission check failed, denying access:', error.message);
    return false;
  }
}

/**
 * Utility function for filtering arrays based on permissions
 */
export async function filterByPermission(resources, action, resourceType) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return [];
    }
    
    // Add resource type to each resource if not present
    const resourcesWithType = resources.map(resource => ({
      ...resource,
      type: resource.type || resourceType
    }));
    
    return await AuthorizationService.filterResourcesByPermission(
      session.user.id,
      resourcesWithType,
      action
    );
  } catch (error) {
    console.error('Resource filtering failed:', error);
    return [];
  }
}

/**
 * Action validators - use these before executing sensitive operations
 */
export class ActionValidators {
  
  /**
   * Validate user removal from session
   */
  static async validateRemoveUserFromSession(userInfo, sessionInfo) {
    try {
      console.log('🔐 Validating user removal permission:', { userInfo, sessionInfo });
      
      // Check if user is authenticated
      const currentUser = await SimpleAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user permissions for assignments
      const permissions = await SimpleAuthService.getUserPermissions('assignments');
      if (!permissions) {
        // If no specific permissions, check if user is super admin
        const isSuperAdmin = await SimpleAuthService.isSuperAdmin();
        if (isSuperAdmin) {
          console.log('✅ Super admin - removal allowed');
          return true;
        }
        throw new Error('You do not have permission to remove users from sessions');
      }
      
      // Check if user can edit assignments (removal is an edit operation)
      if (!permissions.can_edit) {
        throw new Error('You do not have edit permission for assignments');
      }
      
      // Check functional area permission
      if (permissions.functional_area_names && permissions.functional_area_names.length > 0) {
        const sessionFunctionalArea = sessionInfo.functional_area || sessionInfo.session?.functional_area;
        if (!permissions.functional_area_names.includes(sessionFunctionalArea)) {
          throw new Error(`You can only remove users from sessions in: ${permissions.functional_area_names.join(', ')}`);
        }
      }
      
      // Check training location permission
      if (permissions.training_location_names && permissions.training_location_names.length > 0) {
        const sessionLocation = sessionInfo.training_location || sessionInfo.session?.training_location;
        if (!permissions.training_location_names.includes(sessionLocation)) {
          throw new Error(`You can only remove users from sessions at: ${permissions.training_location_names.join(', ')}`);
        }
      }
      
      console.log('✅ Removal permission validated');
      return true;
    } catch (error) {
      // Re-throw authorization errors but log system errors
      if (error.message.includes('not authenticated') || error.message.includes('permission')) {
        console.error('❌ Removal validation failed:', error);
        throw error;
      }
      console.error('❌ System error in validateRemoveUserFromSession:', error);
      throw new Error('Authorization system temporarily unavailable');
    }
  }
  
  /**
   * Validate user assignment to session
   */
  static async validateAssignUserToSession(userInfo, sessionInfo) {
    try {
      console.log('🔐 Validating user assignment permission:', { userInfo, sessionInfo });
      
      // Check if user is authenticated
      const currentUser = await SimpleAuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Get user permissions for assignments
      const permissions = await SimpleAuthService.getUserPermissions('assignments');
      if (!permissions) {
        // If no specific permissions, check if user is super admin
        const isSuperAdmin = await SimpleAuthService.isSuperAdmin();
        if (isSuperAdmin) {
          console.log('✅ Super admin - assignment allowed');
          return true;
        }
        throw new Error('You do not have permission to assign users to sessions');
      }
      
      // Check if user can edit assignments
      if (!permissions.can_edit) {
        throw new Error('You do not have edit permission for assignments');
      }
      
      // Check functional area permission
      if (permissions.functional_area_names && permissions.functional_area_names.length > 0) {
        const sessionFunctionalArea = sessionInfo.functional_area || sessionInfo.session?.functional_area;
        if (!permissions.functional_area_names.includes(sessionFunctionalArea)) {
          throw new Error(`You can only assign users to sessions in: ${permissions.functional_area_names.join(', ')}`);
        }
      }
      
      // Check training location permission
      if (permissions.training_location_names && permissions.training_location_names.length > 0) {
        const sessionLocation = sessionInfo.training_location || sessionInfo.session?.training_location;
        if (!permissions.training_location_names.includes(sessionLocation)) {
          throw new Error(`You can only assign users to sessions at: ${permissions.training_location_names.join(', ')}`);
        }
      }
      
      console.log('✅ Assignment permission validated');
      return true;
    } catch (error) {
      console.error('❌ Assignment validation failed:', error);
      throw error;
    }
  }
  
  /**
   * Validate route access
   */
  static async validateRouteAccess(routePath) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }
    
    const canAccess = await AuthorizationService.canAccessRoute(
      session.user.id,
      routePath
    );
    
    if (!canAccess) {
      throw new Error(`You do not have permission to access ${routePath}`);
    }
    
    return true;
  }
}

/**
 * React component for conditionally rendering content based on permissions
 */
export function AuthorizedContent({ 
  children, 
  resourceType, 
  action, 
  context = {}, 
  fallback = null,
  loading: LoadingComponent = () => <div>Loading...</div>
}) {
  const { canAccess, loading } = useAuthorization(resourceType, action, context);
  
  if (loading) {
    return <LoadingComponent />;
  }
  
  if (!canAccess) {
    return fallback;
  }
  
  return children;
}

export default {
  useAuthorization,
  useFilteredResources,
  withAuthorization,
  checkPermission,
  filterByPermission,
  ActionValidators,
  AuthorizedContent
};