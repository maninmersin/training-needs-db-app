import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      // Verify user exists in our users table
      const { data: userData, error: userError } = await supabase
        .from('a_users')
        .select('id')
        .eq('email', session.user.email)
        .single();

      if (userError) {
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      // Check if user has any roles
      const storedRoles = localStorage.getItem('userRoles');
      if (!storedRoles) {
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      // Verify roles are still valid
      const { data: rolesData } = await supabase
        .from('a_user_roles')
        .select('role_id')
        .eq('user_id', userData.id);

      if (!rolesData || rolesData.length === 0) {
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      setAuthenticated(true);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return authenticated ? <Outlet /> : null;
};

export default ProtectedRoute;
