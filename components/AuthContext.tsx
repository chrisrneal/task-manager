import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const checkAdminRole = (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    
    // Check for admin role in app_metadata or user_metadata
    const appRole = user.app_metadata?.role;
    const userRole = user.user_metadata?.role;
    
    setIsAdmin(appRole === 'admin' || userRole === 'admin');
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      checkAdminRole(currentUser);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      checkAdminRole(currentUser);
      setLoading(false);
      
      // Redirect to projects page when user signs in
      // This ensures the user is automatically redirected after successful authentication
      // The window check ensures this only runs client-side after hydration
      if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
        router.push('/projects');
      }
    });

    // Cleanup subscription on unmount
    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]); // Include router in dependency array to avoid lint warnings

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
