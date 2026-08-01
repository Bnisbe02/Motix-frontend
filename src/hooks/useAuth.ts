import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (mounted) {
        setAuthState({
          isAuthenticated: !!user,
          user: user ?? null,
          isLoading: false,
        });
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setAuthState({
          isAuthenticated: !!session,
          user: session?.user ?? null,
          isLoading: false,
        });

        if (event === 'SIGNED_IN' && session?.user) {
          void supabase
            .from('access_log')
            .insert({
              user_id: session.user.id,
              user_email: session.user.email ?? 'unknown',
              event_type: 'login',
              resource: 'auth',
              metadata: {
                provider: session.user.app_metadata?.provider ?? 'email',
              },
              ip_address: null,
              user_agent: navigator.userAgent,
            });
        }

        if (event === 'SIGNED_OUT') {
          void supabase
            .from('access_log')
            .insert({
              user_id: '00000000-0000-0000-0000-000000000000',
              user_email: 'signed_out',
              event_type: 'logout',
              resource: 'auth',
              metadata: {},
              ip_address: null,
              user_agent: navigator.userAgent,
            });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const loginWithGoogle = async (): Promise<void> => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  return {
    ...authState,
    loginWithEmail,
    loginWithGoogle,
    logout,
  };
}
