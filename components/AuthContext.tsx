import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Redirect to projects page when user signs in
      if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
        router.push('/projects');
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
