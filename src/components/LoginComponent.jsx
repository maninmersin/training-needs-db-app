import { useState } from 'react';
import { supabase } from '../supabaseClient';
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

      // Ensure user exists in users table
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (userError || !existingUser) {
        throw new Error("Your account is not registered in the application. Please contact the administrator.");
      }

      // Get user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      const roleIds = roles.map(r => r.role_id);

      // Log login (optional)
      await supabase
        .from('login_audit')
        .insert({
          user_id: userId,
          user_agent: navigator.userAgent,
          success: true
        });

      // Save session + roles
      localStorage.setItem('authToken', data.session.access_token);
      localStorage.setItem('userRoles', JSON.stringify(roleIds));

      // Role-based redirect
      if (roleIds.includes(1)) {
        navigate('/admin-dashboard');
      } else if (roleIds.includes(2)) {
        navigate('/user-dashboard');
      } else {
        navigate('/unauthorized');
      }

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
