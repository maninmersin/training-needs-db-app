import { useEffect, useState } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { SimpleAuthService } from '@auth/services/simpleAuthService';

const ProtectedRoute = () => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      try {
        // Simple access check - just verify user is active and has access
        const canAccess = await SimpleAuthService.canAccess();
        
        if (!canAccess) {
          console.log('🔒 Access denied - redirecting to login');
          navigate('/login');
          return;
        }

        // Check route-specific access for stakeholder roles
        const currentPath = location.pathname;
        const user = await SimpleAuthService.getCurrentUser();
        
        // If user is stakeholder_assignment_editor, restrict to specific routes
        if (user && !user.is_super_admin) {
          const userPermissions = await SimpleAuthService.getUserPermissions('assignments');
          
          // Check if user has stakeholder_assignment_editor role (limited routes)
          const { data: userRoles } = await supabase
            .from('auth_user_roles')
            .select(`
              auth_roles (
                name
              )
            `)
            .eq('user_id', user.id);
          
          const roleNames = userRoles?.map(ur => ur.auth_roles.name) || [];
          
          if (roleNames.includes('stakeholder_assignment_editor')) {
            const allowedRoutes = ['/', '/drag-drop-assignments'];
            
            if (!allowedRoutes.includes(currentPath)) {
              console.log('🔒 Stakeholder access denied to:', currentPath, 'redirecting to assignments');
              navigate('/drag-drop-assignments');
              return;
            }
          }
        }

        console.log('✅ User access granted:', session.user.email, 'to:', currentPath);
        
        setAuthenticated(true);
      } catch (error) {
        console.error('Error checking permissions:', error);
        // On error, still allow access but log the issue
        console.log('🛡️ Fallback: Allowing access for authenticated user due to system error');
        setAuthenticated(true);
      }
      
      setLoading(false);
    };

    checkAuth();
  }, [navigate, location.pathname]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return authenticated ? <Outlet /> : null;
};

export default ProtectedRoute;
