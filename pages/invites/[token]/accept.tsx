'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { ProjectInvite } from '@/types/database';

const InviteAcceptPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<ProjectInvite & { project_name?: string }>();
  const [message, setMessage] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      // Store the invite URL in local storage to redirect back after login
      if (token) {
        localStorage.setItem('inviteRedirect', `/invites/${token}/accept`);
      }
      router.replace('/login?returnUrl=' + encodeURIComponent(`/invites/${token}/accept`));
    }
  }, [loading, user, token, router]);

  // Fetch invitation details
  useEffect(() => {
    const fetchInvite = async () => {
      if (!user || !token) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log('[' + traceId + '] Fetching invitation details for token: ${token}');
        
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch(`/api/invites/${token}/accept`, {
          headers: {
            'Authorization': `******` }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Invitation not found or has expired');
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch invitation details');
        }
        
        const { data } = await response.json();
        setInvite(data);
        
        // If the invite is already accepted or declined, show a message
        if (data.status !== 'pending') {
          setMessage('This invitation has already been ' + data.status);
        }
        
        console.log('[' + traceId + '] Invitation details fetched successfully');
      } catch (err: any) {
        console.error('Error fetching invitation:', err.message);
        setError(err.message || 'Failed to load invitation details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [user, token]);

  // Handle accepting the invitation
  const handleAccept = async () => {
    if (!user || !token || !invite) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Accepting invitation: ${token}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `******` }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }
      
      const { data, message } = await response.json();
      console.log(`[${traceId}] Invitation accepted successfully:`, data);
      
      setMessage(message || 'You have successfully joined the project');
      
      // Redirect to the project page after a brief delay
      setTimeout(() => {
        router.replace(`/projects/${data.project_id}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error accepting invitation:', err.message);
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle declining the invitation
  const handleDecline = async () => {
    if (!user || !token || !invite) return;
    
    setIsActionLoading(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log('[' + traceId + '] Declining invitation: ${token}');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `******` },
        body: JSON.stringify({ action: 'decline' })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to decline invitation');
      }
      
      const { message } = await response.json();
      console.log('[' + traceId + '] Invitation declined successfully');
      
      setMessage(message || 'You have declined the invitation');
      
      // Redirect to the projects page after a brief delay
      setTimeout(() => {
        router.replace('/projects');
      }, 2000);
    } catch (err: any) {
      console.error('Error declining invitation:', err.message);
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Project Invitation">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading invitation details...</p>
          </div>
        </Section>
      </Page>
    );
  }

  // Error state
  if (error) {
    return (
      <Page title="Invitation Error">
        <Section>
          <div className="text-center py-10 max-w-md mx-auto">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                Invitation Error
              </h2>
              <p className="text-red-600 dark:text-red-400 mb-4">
                {error}
              </p>
              <Link
                href="/projects"
                className="inline-block px-4 py-2 bg-zinc-600 text-white rounded-md hover:bg-zinc-700"
              >
                Go to Projects
              </Link>
            </div>
          </div>
        </Section>
      </Page>
    );
  }

  // Not logged in state (should redirect automatically)
  if (!user) {
    return null;
  }

  // No invite found or invalid token
  if (!invite) {
    return (
      <Page title="Invalid Invitation">
        <Section>
          <div className="text-center py-10 max-w-md mx-auto">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                Invalid Invitation
              </h2>
              <p className="text-red-600 dark:text-red-400 mb-4">
                The invitation link is invalid or has expired.
              </p>
              <Link
                href="/projects"
                className="inline-block px-4 py-2 bg-zinc-600 text-white rounded-md hover:bg-zinc-700"
              >
                Go to Projects
              </Link>
            </div>
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title="Project Invitation">
      <Section>
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm">
            {message ? (
              // Success or already processed message
              <div className="text-center">
                <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                  {message}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  You will be redirected shortly...
                </p>
                {invite.status === 'accepted' && (
                  <Link
                    href={`/projects/${invite.project_id}`}
                    className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Go to Project
                  </Link>
                )}
                {invite.status === 'declined' && (
                  <Link
                    href="/projects"
                    className="inline-block px-4 py-2 bg-zinc-600 text-white rounded-md hover:bg-zinc-700"
                  >
                    Go to Projects
                  </Link>
                )}
              </div>
            ) : (
              // Invitation details and action buttons
              <>
                <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                  Project Invitation
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  You have been invited to join <strong>{invite.project_name}</strong> with the role of <strong>{invite.role}</strong>.
                </p>
                
                <div className="flex space-x-4 mt-6">
                  <button
                    onClick={handleAccept}
                    disabled={isActionLoading}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isActionLoading ? 'Processing...' : 'Accept Invitation'}
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={isActionLoading}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default InviteAcceptPage;