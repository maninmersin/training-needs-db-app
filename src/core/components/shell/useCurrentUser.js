import { useEffect, useState } from 'react';
import { supabase } from '@core/services/supabaseClient';

/** The signed-in user and their role name, kept up to date as the session changes. */
export function useCurrentUser() {
  const [state, setState] = useState({ user: null, role: null, loading: true });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        if (!session?.user) {
          setState({ user: null, role: null, loading: false });
          return;
        }
        let role = null;
        try {
          const { data } = await supabase
            .from('auth_user_roles')
            .select('auth_roles (name, description)')
            .eq('user_id', session.user.id)
            .single();
          role = data?.auth_roles?.name ?? null;
        } catch {
          // no role row: show the user without a role
        }
        if (active) setState({ user: session.user, role, loading: false });
      } catch (error) {
        console.warn('Could not fetch user details:', error);
        if (active) setState((previous) => ({ ...previous, loading: false }));
      }
    };

    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') load();
      else if (event === 'SIGNED_OUT') setState({ user: null, role: null, loading: false });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
