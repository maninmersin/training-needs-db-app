import { useState } from 'react';
import { supabase } from '@core/services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button, Card, FormField, Input } from '@/components/ui';

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
    <div className="grid min-h-screen place-content-center bg-background px-4 py-10">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <div className="grid size-8 place-content-center rounded-md bg-primary text-base font-bold text-primary-foreground" aria-hidden="true">T</div>
        <span className="text-lg font-semibold">Training Needs</span>
      </div>

      <Card className="w-full max-w-sm p-6">
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Admin Login</h2>
        <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
          <FormField label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </FormField>

          {error && (
            <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <Button type="submit" variant="default" size="lg" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <div className="mt-4 border-t border-border pt-3">
          <Button variant="link" className="h-auto p-0" onClick={() => setShowResetForm(true)} disabled={loading}>
            Forgot Password?
          </Button>

          {showResetForm && (
            <div className="mt-3 flex flex-col gap-2">
              {resetSent ? (
                <div role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
                  Password reset email sent! Check your inbox.
                </div>
              ) : (
                <>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    aria-label="Email for password reset"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    disabled={loading}
                  />
                  <Button onClick={handleResetPassword} disabled={!resetEmail || loading}>
                    {loading ? 'Sending...' : 'Reset Password'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default LoginComponent;
