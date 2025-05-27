'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { ProjectMember, ProjectMemberRole, ProjectInvite } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import MemberList from '@/components/members/MemberList';
import InviteForm from '@/components/members/InviteForm';
import InviteList from '@/components/members/InviteList';
import DummyUserForm from '@/components/members/DummyUserForm';

interface ExtendedProjectMember extends ProjectMember {
  email?: string;
  name?: string;
  avatar_url?: string;
}

const ProjectMembersSettings = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, loading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<ExtendedProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [userRole, setUserRole] = useState<ProjectMemberRole | null>(null);
  const [projectName, setProjectName] = useState<string>('');

  // Check if current user is owner or admin
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  // Auth protection and role check
  useEffect(() => {
    const checkAuth = async () => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
          return;
        }
        
        // Check if user is a member of the project
        if (projectId) {
          try {
            const { data: memberData, error: memberError } = await supabase
              .from('project_members')
              .select('role')
              .eq('project_id', projectId)
              .eq('user_id', user.id)
              .single();
              
            if (memberError || !memberData) {
              router.replace(`/projects/${projectId}`);
              return;
            }
            
            setUserRole(memberData.role);
            
            // Only owners and admins can access this page
            if (memberData.role !== 'owner' && memberData.role !== 'admin' && user.app_metadata?.role !== 'admin') {
              router.replace(`/projects/${projectId}`);
              return;
            }
            
            // Get project name
            const { data: projectData } = await supabase
              .from('projects')
              .select('name')
              .eq('id', projectId)
              .single();
              
            if (projectData) {
              setProjectName(projectData.name);
            }
          } catch (err) {
            router.replace('/projects');
          }
        }
      }
    };
    
    checkAuth();
  }, [user, loading, projectId, router]);

  // Fetch members and invites
  const fetchData = async () => {
    if (!user || !projectId || !isAdmin) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Fetching project members and invites: ${projectId}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Fetch members
      const membersResponse = await fetch(`/api/projects/${projectId}/members`, {
        headers: {
          'Authorization': 'Bearer ' + token }
      });
      
      if (!membersResponse.ok) {
        throw new Error('Failed to fetch members: ' + membersResponse.statusText);
      }
      
      const membersData = await membersResponse.json();
      setMembers(membersData.data || []);
      
      // Fetch invites
      const invitesResponse = await fetch(`/api/projects/${projectId}/invite`, {
        headers: {
          'Authorization': 'Bearer ' + token }
      });
      
      if (!invitesResponse.ok) {
        throw new Error('Failed to fetch invites: ' + invitesResponse.statusText + '');
      }
      
      const invitesData = await invitesResponse.json();
      setInvites(invitesData.data || []);
      
      console.log('[' + traceId + '] Fetched ${membersData.data?.length || 0} members and ${invitesData.data?.length || 0} invites');
    } catch (err: any) {
      console.error('Error fetching project data:', err.message);
      setError('Failed to load project members data');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on mount
  useEffect(() => {
    if (user && projectId && isAdmin !== null) {
      fetchData();
    }
  }, [user, projectId, isAdmin]);

  // Set up realtime subscription for members
  useEffect(() => {
    if (!user || !projectId) return;
    
    console.log('Setting up realtime subscription for project members...');
    
    // Subscribe to member changes
    const subscription = supabase
      .channel(`project_members:project_id=eq.${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'project_members',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        console.log('Realtime member update:', payload);
        
        // Handle different events
        switch (payload.eventType) {
          case 'INSERT':
            fetchData(); // Refresh all data to get complete user info
            break;
          case 'UPDATE':
            setMembers(prev => prev.map(m => 
              m.user_id === payload.new.user_id ? { ...m, ...payload.new } : m
            ));
            break;
          case 'DELETE':
            setMembers(prev => prev.filter(m => m.user_id !== payload.old.user_id));
            break;
        }
      })
      .subscribe();
    
    // Subscribe to invite changes
    const inviteSubscription = supabase
      .channel(`project_invites:project_id=eq.${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'project_invites',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        console.log('Realtime invite update:', payload);
        
        // Handle different events
        switch (payload.eventType) {
          case 'INSERT':
            setInvites(prev => [payload.new as ProjectInvite, ...prev]);
            break;
          case 'UPDATE':
            setInvites(prev => prev.map(i => 
              i.id === payload.new.id ? payload.new as ProjectInvite : i
            ));
            break;
          case 'DELETE':
            setInvites(prev => prev.filter(i => i.id !== payload.old.id));
            break;
        }
      })
      .subscribe();
    
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(inviteSubscription);
    };
  }, [user, projectId]);

  // Handle invite submission
  const handleInvite = async (email: string, role: ProjectMemberRole) => {
    if (!user || !projectId) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Sending invitation to ${email} with role ${role}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/projects/${projectId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ email, role })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }
      
      const data = await response.json();
      console.log(`[${traceId}] Invitation sent successfully:`, data);
      
      // The new invite will be added via realtime subscription
    } catch (err: any) {
      console.error('Error sending invitation:', err.message);
      setError(err.message);
      throw err; // Rethrow to be handled by the form
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle adding a dummy user
  const handleAddDummyUser = async (name: string, role: ProjectMemberRole) => {
    if (!user || !projectId) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Adding dummy user ${name} with role ${role}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ name, role })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add dummy user');
      }
      
      const data = await response.json();
      console.log(`[${traceId}] Dummy user added successfully:`, data);
      
      // The new member will be added via realtime subscription
    } catch (err: any) {
      console.error('Error adding dummy user:', err.message);
      setError(err.message);
      throw err; // Rethrow to be handled by the form
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: ProjectMemberRole) => {
    if (!user || !projectId) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Updating role for user ${userId} to ${newRole}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ userId, role: newRole })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }
      
      const data = await response.json();
      console.log(`[${traceId}] Role updated successfully:`, data);
      
      // If current user is updating their own role, update userRole state
      if (userId === user.id) {
        setUserRole(newRole);
      }
      
      // The member update will be reflected via realtime subscription
    } catch (err: any) {
      console.error('Error updating role:', err.message);
      setError(err.message);
      
      // Refresh to get the current state
      fetchData();
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle member removal
  const handleRemoveMember = async (userId: string) => {
    if (!user || !projectId) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Removing member ${userId}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/projects/${projectId}/members?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }
      
      const data = await response.json();
      console.log(`[${traceId}] Member removed successfully:`, data);
      
      // If current user is removing themselves, redirect to projects page
      if (userId === user.id) {
        router.replace('/projects');
      }
      
      // The member removal will be reflected via realtime subscription
    } catch (err: any) {
      console.error('Error removing member:', err.message);
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle canceling an invitation
  const handleCancelInvite = async (inviteId: string) => {
    if (!user || !projectId) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Canceling invitation ${inviteId}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Use Supabase directly to delete the invitation
      const { error } = await supabase
        .from('project_invites')
        .delete()
        .eq('id', inviteId)
        .eq('project_id', projectId);
      
      if (error) {
        throw new Error(error.message || 'Failed to cancel invitation');
      }
      
      console.log('[' + traceId + '] Invitation canceled successfully');
      
      // The invite removal will be reflected via realtime subscription
    } catch (err: any) {
      console.error('Error canceling invitation:', err.message);
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle resending an invitation
  const handleResendInvite = async (inviteId: string) => {
    if (!user || !projectId) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Resending invitation ${inviteId}');
      
      // Get the invite details
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('id', inviteId)
        .single();
      
      if (inviteError) {
        throw new Error('Invitation not found');
      }
      
      // Re-use the invitation endpoint to send a new email
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/projects/${projectId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ 
          email: invite.email, 
          role: invite.role,
          resend: true
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resend invitation');
      }
      
      console.log('[' + traceId + '] Invitation resent successfully');
    } catch (err: any) {
      console.error('Error resending invitation:', err.message);
      setError(err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

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
  if (!isAdmin) {
    return null; // Already redirected in useEffect
  }

  return (
    <Page title={`${projectName} - Project Members`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Project Members
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage team members and collaborators for {projectName}
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
          >
            Back to Project
          </Link>
        </div>
        
        {/* Settings Navigation */}
        <div className="flex space-x-4 mb-6">
          <Link
            href={`/projects/${projectId}/settings`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            General
          </Link>
          <Link
            href={`/projects/${projectId}/settings/members`}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Members
          </Link>
          <Link
            href={`/projects/${projectId}/settings/fields`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Fields
          </Link>
          <Link
            href={`/projects/${projectId}/settings/workflows`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Workflows
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Settings sections */}
        <div className="space-y-8">
          {/* Members list */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-3">Project Members</h3>
            
            <MemberList
              members={members}
              currentUserId={user!.id}
              isOwner={isOwner}
              isAdmin={isAdmin}
              onRoleChange={handleRoleChange}
              onRemoveMember={handleRemoveMember}
            />
          </div>
          
          {/* Pending invitations */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <InviteList
              invites={invites}
              onCancelInvite={handleCancelInvite}
              onResendInvite={handleResendInvite}
              isLoading={isActionLoading}
            />
          </div>
          
          {/* Invite form */}
          {isAdmin && (
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
              <InviteForm
                projectId={projectId as string}
                onInvite={handleInvite}
                isLoading={isActionLoading}
              />
            </div>
          )}
          
          {/* Dummy user form */}
          {isAdmin && (
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
              <DummyUserForm
                projectId={projectId as string}
                onAddDummyUser={handleAddDummyUser}
                isLoading={isActionLoading}
              />
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
};

export default ProjectMembersSettings;