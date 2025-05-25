'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { Project, ProjectMember, ProjectInvite } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// Import member components
import MemberList from '@/components/members/MemberList';
import InviteForm from '@/components/members/InviteForm';

const ProjectMembersSettings = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, loading } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Array<any>>([]);
  const [pendingInvites, setPendingInvites] = useState<ProjectInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Auth protection and access check
  useEffect(() => {
    const checkAuth = async () => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
          return;
        }
        
        if (projectId) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          
          if (!token) {
            router.replace('/projects');
            return;
          }
          
          try {
            // Check if user has access to this project
            const { data: memberData, error: memberError } = await supabase
              .from('project_members')
              .select('role')
              .eq('project_id', projectId)
              .eq('user_id', user.id)
              .single();
              
            if (memberError || !memberData) {
              router.replace('/projects');
              return;
            }
            
            // Check if user is owner or admin
            if (!['owner', 'admin'].includes(memberData.role)) {
              router.replace(`/projects/${projectId}`);
              return;
            }
            
            setCurrentUserRole(memberData.role);
            
            // Get project details
            const { data: projectData, error: projectError } = await supabase
              .from('projects')
              .select('*')
              .eq('id', projectId)
              .single();
              
            if (projectError || !projectData) {
              router.replace('/projects');
              return;
            }
            
            setProject(projectData);
          } catch (err) {
            router.replace('/projects');
          }
        }
      }
    };
    
    checkAuth();
  }, [user, loading, projectId, router]);

  // Fetch members and invites
  const fetchMembersAndInvites = useCallback(async () => {
    if (!user || !projectId || !currentUserRole) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Fetching members for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to get members and invites
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch members');
      }
      
      const { data } = await response.json();
      
      setMembers(data.members || []);
      setPendingInvites(data.pendingInvites || []);
      
      console.log(`[${traceId}] Successfully fetched ${data.members?.length || 0} members and ${data.pendingInvites?.length || 0} pending invites`);
    } catch (err: any) {
      console.error('Error fetching members:', err.message);
      setError('Failed to load members data');
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId, currentUserRole]);

  // Fetch data when the dependencies change
  useEffect(() => {
    if (user && projectId && currentUserRole) {
      fetchMembersAndInvites();
    }
  }, [user, projectId, currentUserRole, fetchMembersAndInvites]);

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Project Members">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </Section>
      </Page>
    );
  }

  // Not authorized state
  if (!currentUserRole || !['owner', 'admin'].includes(currentUserRole)) {
    return null; // Already redirected in useEffect
  }

  return (
    <Page title={`${project?.name} - Project Members`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Project Members
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Invite and manage project collaborators
            </p>
          </div>
          <div className="flex space-x-2">
            <Link
              href={`/projects/${projectId}/settings`}
              className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
            >
              Settings
            </Link>
            <Link
              href={`/projects/${projectId}`}
              className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
            >
              Back to Project
            </Link>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Main content */}
        <div className="space-y-8">
          {/* Invite Form Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Invite Collaborators</h3>
            <InviteForm 
              projectId={projectId as string} 
              onInviteSuccess={fetchMembersAndInvites}
            />
          </div>

          {/* Member List Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <MemberList
              projectId={projectId as string}
              currentUserRole={currentUserRole}
              members={members}
              pendingInvites={pendingInvites}
              onMemberChange={fetchMembersAndInvites}
            />
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default ProjectMembersSettings;
