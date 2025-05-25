'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const InviteAcceptPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const { user, loading } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Fetch invite details
  useEffect(() => {
    const getInviteDetails = async () => {
      if (!token || loading) return;
      
      try {
        // Get invite details from Supabase
        const { data: invite, error: inviteError } = await supabase
          .from('project_invites')
          .select(`
            id,
            project_id,
            email,
            role,
            status,
            dummy_user,
            projects:project_id (name)
          `)
          .eq('token', token)
          .single();
          
        if (inviteError || !invite) {
          setError('Invalid or expired invitation link');
          return;
        }
        
        if (invite.status !== 'pending') {
          setError(`This invitation has already been ${invite.status}`);
          return;
        }
        
        // For non-dummy users, check if the current user matches the invited email
        if (!invite.dummy_user && user && invite.email !== user.email) {
          setError(`This invitation was sent to ${invite.email}, but you are logged in as a different user`);
          return;
        }
        
        setInviteDetails(invite);
      } catch (err: any) {
        console.error('Error fetching invite details:', err.message);
        setError('Failed to load invitation details');
      }
    };
    
    getInviteDetails();
  }, [token, loading, user]);
  
  // Auto-accept logic for logged-in users
  useEffect(() => {
    const autoAccept = async () => {
      if (loading || !inviteDetails || !user || isProcessing || error || success) return;
      
      // Auto-accept the invitation if the user is already logged in and the email matches
      if (inviteDetails.email === user.email || inviteDetails.dummy_user) {
        handleAcceptInvite();
      }
    };
    
    autoAccept();
  }, [loading, inviteDetails, user]);

  const handleAcceptInvite = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Accepting invitation for token: ${token}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const userToken = sessionData.session?.access_token;
      
      if (!userToken) {
        // Redirect to login if not authenticated
        router.push(`/login?returnUrl=/invites/${token}/accept`);
        return;
      }
      
      // Call API to accept invitation
      const response = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + userToken
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
      setSuccess(true);
      
      // Redirect to the project after a short delay
      setTimeout(() => {
        router.push(`/projects/${inviteDetails.project_id}`);
      }, 2000);
      
      console.log(`[${traceId}] Successfully accepted invitation`);
    } catch (err: any) {
      console.error('Error accepting invitation:', err.message);
      setError(err.message || 'Failed to accept invitation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDeclineInvite = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Declining invitation for token: ${token}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const userToken = sessionData.session?.access_token;
      
      // For declining, we'll update directly in Supabase
      const { error: declineError } = await supabase
        .from('project_invites')
        .update({ status: 'declined' })
        .eq('token', token);
        
      if (declineError) {
        throw new Error(declineError.message || 'Failed to decline invitation');
      }
      
      setSuccess(true);
      setInviteDetails(prev => ({ ...prev, status: 'declined' }));
      
      // Redirect to projects page after a short delay
      setTimeout(() => {
        router.push('/projects');
      }, 2000);
      
      console.log(`[${traceId}] Successfully declined invitation`);
    } catch (err: any) {
      console.error('Error declining invitation:', err.message);
      setError(err.message || 'Failed to decline invitation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (loading || (!inviteDetails && !error)) {
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
      <Page title="Invalid Invitation">
        <Section>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 max-w-md mx-auto text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              Invalid Invitation
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {error}
            </p>
            <Link
              href="/projects"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 inline-block"
            >
              Go to Projects
            </Link>
          </div>
        </Section>
      </Page>
    );
  }

  // Success state
  if (success) {
    return (
      <Page title="Invitation Accepted">
        <Section>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 max-w-md mx-auto text-center">
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              {inviteDetails?.status === 'declined' 
                ? 'Invitation Declined' 
                : 'Invitation Accepted'}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {inviteDetails?.status === 'declined' 
                ? 'You have declined the invitation. Redirecting...' 
                : `You are now a member of ${inviteDetails?.projects?.name || 'the project'}. Redirecting...`}
            </p>
          </div>
        </Section>
      </Page>
    );
  }

  // User needs to log in or sign up
  if (!user) {
    return (
      <Page title="Project Invitation">
        <Section>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 max-w-md mx-auto text-center">
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
              You've Been Invited
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              You've been invited to join <strong>{inviteDetails?.projects?.name || 'a project'}</strong> as a <strong>{inviteDetails?.role}</strong>.
              Please log in or sign up to accept this invitation.
            </p>
            <div className="flex flex-col space-y-2">
              <Link
                href={`/login?returnUrl=/invites/${token}/accept`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Log In
              </Link>
              <Link
                href={`/signup?returnUrl=/invites/${token}/accept`}
                className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </Section>
      </Page>
    );
  }

  // Normal display for authenticated user
  return (
    <Page title="Project Invitation">
      <Section>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-4 text-center">
            Project Invitation
          </h2>
          
          <div className="mb-6">
            <p className="text-zinc-600 dark:text-zinc-400 mb-2">
              You've been invited to join <strong>{inviteDetails?.projects?.name || 'a project'}</strong> as a <strong>{inviteDetails?.role}</strong>.
            </p>
            
            {inviteDetails?.email !== user.email && !inviteDetails?.dummy_user && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-3 rounded-md text-sm mt-2">
                <p>This invitation was sent to <strong>{inviteDetails?.email}</strong> but you are currently logged in as <strong>{user.email}</strong>.</p>
              </div>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleAcceptInvite}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Accept Invitation'}
            </button>
            
            <button
              onClick={handleDeclineInvite}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default InviteAcceptPage;
