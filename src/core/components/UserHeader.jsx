import { useState, useEffect } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import './UserHeader.css';

const UserHeader = ({ handleLogout }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentProject } = useProject();

  useEffect(() => {
    getCurrentUser();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        getCurrentUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        
        // Get user role
        const { data: roleData } = await supabase
          .from('auth_user_roles')
          .select(`
            auth_roles (name, description)
          `)
          .eq('user_id', session.user.id)
          .single();
        
        if (roleData?.auth_roles) {
          setUserRole(roleData.auth_roles.name);
        }
      }
    } catch (error) {
      console.warn('Could not fetch user details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="user-header">
        <div className="user-info">
          <span className="loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="user-header">
      <div className="user-info">
        <div className="user-details">
          <span className="user-email">{user.email}</span>
          {userRole && <span className="user-role">({userRole})</span>}
          {currentProject && <span className="current-project">| {currentProject.title}</span>}
        </div>
        <button 
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default UserHeader;