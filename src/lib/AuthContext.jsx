import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext({ session: null });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// 供各页面在写操作前调用：未登录则提示并中止
export function requireAuth(session) {
  if (!session) {
    alert('Please sign in (top of the page) to make changes. Anyone with the link can view, but only signed-in editors can edit.');
    return false;
  }
  return true;
}
