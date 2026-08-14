import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  session: Session | null;
  user: User | null;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  signInWithMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>(() => ({
  status: isSupabaseConfigured ? 'loading' : 'signed-out',
  session: null,
  user: null,

  signInWithPassword: async (email, password) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  },

  signUpWithPassword: async (email, password) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  },

  signInWithMagicLink: async (email) => {
    if (!supabase) return 'Cloud sync is not configured.';
    const { error } = await supabase.auth.signInWithOtp({ email });
    return error?.message ?? null;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));

// Module-level subscription (not inside the store creator) so it fires exactly once for
// the lifetime of the app, independent of how many components read useAuth.
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    useAuth.setState({
      session: data.session,
      user: data.session?.user ?? null,
      status: data.session ? 'signed-in' : 'signed-out',
    });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.setState({
      session,
      user: session?.user ?? null,
      status: session ? 'signed-in' : 'signed-out',
    });
  });
}
