import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/database.types';

interface AuthContextValue {
  /** true tant qu'on n'a pas encore su si une session existe (évite un flash de l'écran de login). */
  initializing: boolean;
  session: Session | null;
  /** Profil applicatif (rôle coach/coaché). Null si l'utilisateur est authentifié
   * mais n'a pas encore terminé l'onboarding (choix du rôle). */
  profile: Profile | null;
  /** true pendant le (re)chargement du profil après un changement de session. */
  loadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  async function loadProfile(userId: string) {
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[auth] Erreur de chargement du profil :', error.message);
      setProfile(null);
    } else {
      setProfile(data as Profile | null);
    }
    setLoadingProfile(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
      if (data.session) void loadProfile(data.session.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      profile,
      loadingProfile,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [initializing, session, profile, loadingProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  return ctx;
}
