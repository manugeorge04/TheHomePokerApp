import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function ensureProfile(u: User): Promise<Profile | null> {
    try {
      // Try to fetch existing profile
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
        return data as Profile;
      }

      // Profile doesn't exist — create it client-side
      const displayName =
        (u.user_metadata?.display_name as string | undefined) ??
        u.email?.split('@')[0] ??
        'Player';

      // Generate a unique username
      let baseUsername = (u.email?.split('@')[0] ?? 'player').replace(/[^a-zA-Z0-9_]/g, '');
      if (!baseUsername) baseUsername = 'player';

      let finalUsername = baseUsername;
      let counter = 0;

      // Try to insert, incrementing counter if username exists
      let inserted = null;
      let insertError = null;

      for (let i = 0; i < 10; i++) {
        const { data: result, error: err } = await supabase
          .from('profiles')
          .insert({
            id: u.id,
            display_name: displayName,
            username: finalUsername,
          })
          .select()
          .maybeSingle();

        if (result) {
          inserted = result;
          break;
        }

        if (err) {
          insertError = err;
          // If it's a unique constraint error, try with a suffix
          if (err.message?.includes('unique') || err.code === '23505') {
            counter++;
            finalUsername = baseUsername + counter;
            continue;
          } else {
            // Other error — bail out
            break;
          }
        }
      }

      if (inserted) {
        setProfile(inserted as Profile);
        return inserted as Profile;
      }

      // If we couldn't create a profile, still proceed but without profile data
      console.warn('Could not ensure profile for user', u.id, insertError);
      return null;
    } catch (err) {
      console.error('Error ensuring profile:', err);
      return null;
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfile(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) ensureProfile(session.user);
      else setProfile(null);
    });

    return () => listener.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signUp(email: string, password: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, username: email.split('@')[0] } },
    });
    if (error) throw error;
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user) await ensureProfile(user);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
