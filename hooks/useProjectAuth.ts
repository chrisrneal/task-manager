import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';

export interface ProjectAuthResult {
  isLoading: boolean;
  isAuthorized: boolean;
  userRole: string | null;
  project: any | null;
  error: string | null;
}

export interface AdminAuthResult {
  isLoading: boolean;
  isAdmin: boolean;
  project: any | null;
  error: string | null;
}

/**
 * Hook for protecting pages that require authentication
 * Redirects to login if user is not authenticated
 */
export function useAuthProtection() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  return { user, loading, isAuthenticated: !loading && !!user };
}

/**
 * Hook for checking project membership and role
 * Redirects to login if not authenticated, or to projects if not a member
 */
export function useProjectAuth(projectId: string | string[] | undefined): ProjectAuthResult {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [project, setProject] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkProjectAuth = async () => {
      if (loading) return;

      if (!user) {
        router.replace('/login');
        return;
      }

      if (!projectId || typeof projectId !== 'string') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get project data
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) {
          console.error('Project not found:', projectError.message);
          router.replace('/projects');
          return;
        }

        setProject(projectData);

        // Check if user is project owner
        if (projectData.user_id === user.id) {
          setUserRole('owner');
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Check if user is admin (global admin)
        if (user.app_metadata?.role === 'admin') {
          setUserRole('admin');
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }

        // Check if user is project member
        const { data: memberData, error: memberError } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .single();

        if (!memberError && memberData) {
          setUserRole(memberData.role);
          setIsAuthorized(true);
        } else {
          // User is not a member, redirect to project page
          router.replace(`/projects/${projectId}`);
          return;
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error checking project auth:', err.message);
        setError(err.message);
        setIsLoading(false);
      }
    };

    checkProjectAuth();
  }, [user, loading, projectId, router]);

  return {
    isLoading,
    isAuthorized,
    userRole,
    project,
    error
  };
}

/**
 * Hook for checking admin access to a project
 * Requires user to be either project owner or admin
 * Redirects if not authorized
 */
export function useProjectAdminAuth(projectId: string | string[] | undefined): AdminAuthResult {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [project, setProject] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAuth = async () => {
      if (loading) return;

      if (!user) {
        router.replace('/login');
        return;
      }

      if (!projectId || typeof projectId !== 'string') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Get session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          router.replace('/projects');
          return;
        }

        // Get project data
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) {
          console.error('Project not found:', projectError.message);
          router.replace('/projects');
          return;
        }

        setProject(projectData);

        // Check if user is project owner
        const userIsOwner = projectData.user_id === user.id;
        const userIsGlobalAdmin = user.app_metadata?.role === 'admin';

        if (!userIsOwner && !userIsGlobalAdmin) {
          router.replace(`/projects/${projectId}`);
          return;
        }

        setIsAdmin(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error checking admin auth:', err.message);
        setError(err.message);
        router.replace('/projects');
      }
    };

    checkAdminAuth();
  }, [user, loading, projectId, router]);

  return {
    isLoading,
    isAdmin,
    project,
    error
  };
}

/**
 * Utility for checking if user has specific project permissions
 */
export async function checkProjectPermission(
  projectId: string,
  userId: string,
  requiredRole: 'owner' | 'admin' | 'member' = 'member'
): Promise<{ hasPermission: boolean; userRole: string | null }> {
  try {
    // Get project data
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      return { hasPermission: false, userRole: null };
    }

    // Check if user is project owner
    if (projectData.user_id === userId) {
      return { hasPermission: true, userRole: 'owner' };
    }

    // Check if user is project member
    const { data: memberData, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (memberError || !memberData) {
      return { hasPermission: false, userRole: null };
    }

    const userRole = memberData.role;
    
    // Check role hierarchy
    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    const requiredLevel = roleHierarchy[requiredRole];
    const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;

    return {
      hasPermission: userLevel >= requiredLevel,
      userRole
    };
  } catch (error) {
    console.error('Error checking project permission:', error);
    return { hasPermission: false, userRole: null };
  }
}