import { supabase } from '@core/services/supabaseClient';

// Privileged user management goes through the auth server (server/auth), which
// holds any service credentials. Nothing privileged is ever shipped to the browser.
const AUTH_URL = (import.meta.env.VITE_AUTH_URL || 'http://localhost:4000').replace(/\/$/, '');

const request = async (method, path, body) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { data: null, error: new Error('You must be signed in to manage users') };
  }

  try {
    const res = await fetch(`${AUTH_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: new Error(json.error || json.msg || `Request failed (${res.status})`) };
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: new Error(`Auth server unreachable at ${AUTH_URL}: ${err.message}`) };
  }
};

// Returns { data: { user: { id, email } }, error }
export const createUser = ({ email, password }) =>
  request('POST', '/admin/users', { email, password });

export const updateUser = (id, { email, password }) =>
  request('PUT', `/admin/users/${encodeURIComponent(id)}`, { email, password });

export const deleteUser = (id) =>
  request('DELETE', `/admin/users/${encodeURIComponent(id)}`);

export const inviteUser = (email) =>
  request('POST', '/admin/invite', { email });
