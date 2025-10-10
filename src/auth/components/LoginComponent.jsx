import { useState } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import './LoginComponent.css';

const LoginComponent = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Authenticate user
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      const userId = data.user.id;

      // Check if user exists in auth_users table (optional for super admins)
      const { data: existingUser, error: userError } = await supabase
        .from('auth_users')
        .select('id')
        .eq('id', userId)
        .single();

      // Allow login if user doesn't exist in auth_users (they might be a super admin)
      if (userError && userError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is okay for super admins
        console.warn('Database error checking auth_users:', userError);
        throw new Error("Database error. Please try again.");
      }

      // Get user roles (optional for super admins)
      const { data: roles, error: rolesError } = await supabase
        .from('auth_user_roles')
        .select('role_id')
        .eq('user_id', userId);

      if (rolesError && rolesError.code !== 'PGRST116') {
        // Allow login even if no roles found (super admins might not have explicit roles)
        console.warn('Could not fetch user roles:', rolesError);
      }

      const roleIds = roles?.map(r => r.role_id) || [];

      // Log login (optional - ignore errors)
      try {
        await supabase
          .from('auth_login_audit')
          .insert({
            user_id: userId,
            user_agent: navigator.userAgent,
            success: true
          });
      } catch (auditError) {
        console.warn('Could not log login audit:', auditError);
        // Continue with login even if audit logging fails
      }

      // Save session + roles
      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('userRoles', JSON.stringify(roleIds));

      // Redirect to home page after successful login
      navigate('/');

    } catch (error) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/update-password'
      });

      if (error) throw error;

      setResetSent(true);
      setTimeout(() => {
        setShowResetForm(false);
        setResetSent(false);
      }, 5000);
    } catch (error) {
      setError(error.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Admin Login</h2>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="reset-password">
        <button
          className="reset-link"
          onClick={() => setShowResetForm(true)}
          disabled={loading}
        >
          Forgot Password?
        </button>

        {showResetForm && (
          <div className="reset-form">
            {resetSent ? (
              <div className="reset-success">
                Password reset email sent! Check your inbox.
              </div>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={loading}
                />
                <button
                  onClick={handleResetPassword}
                  disabled={!resetEmail || loading}
                >
                  {loading ? 'Sending...' : 'Reset Password'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginComponent;
