import React, { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

interface InviteFormProps {
  projectId: string;
  onInviteSuccess: () => void;
}

const InviteForm: React.FC<InviteFormProps> = ({ projectId, onInviteSuccess }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [isDummyUser, setIsDummyUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Inviting user to project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Send the invitation
      const response = await fetch(`/api/projects/${projectId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          email,
          role,
          isDummyUser
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }
      
      setSuccess(`Successfully invited ${email} to the project.`);
      setEmail('');
      
      // Notify parent component to refresh the invites list
      onInviteSuccess();
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      console.log(`[${traceId}] Invitation sent successfully`);
    } catch (err: any) {
      console.error('Error sending invitation:', err.message);
      setError(err.message || 'Failed to send invitation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-3 rounded-md text-sm">
          {success}
        </div>
      )}
      
      <div>
        <label 
          htmlFor="email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
          placeholder="Enter email address"
          required={!isDummyUser}
          disabled={isSubmitting}
        />
      </div>
      
      <div>
        <label 
          htmlFor="role"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Role
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'member')}
          className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
          disabled={isSubmitting}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Members can view and update project tasks. Admins can also invite others and manage project settings.
        </p>
      </div>
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="dummyUser"
          checked={isDummyUser}
          onChange={(e) => setIsDummyUser(e.target.checked)}
          className="h-4 w-4 border-gray-300 rounded text-indigo-600 focus:ring-indigo-500"
          disabled={isSubmitting}
        />
        <label 
          htmlFor="dummyUser"
          className="ml-2 block text-sm text-zinc-700 dark:text-zinc-300"
        >
          Create as dummy user (not tied to an account)
        </label>
      </div>
      
      <div>
        <button
          type="submit"
          disabled={isSubmitting || (!isDummyUser && !email.trim())}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Sending Invite...' : 'Send Invitation'}
        </button>
      </div>
    </form>
  );
};

export default InviteForm;
