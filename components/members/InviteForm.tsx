import React, { useState } from 'react';
import { ProjectMemberRole } from '@/types/database';

interface InviteFormProps {
  projectId: string;
  onInvite: (email: string, role: ProjectMemberRole) => Promise<void>;
  isLoading: boolean;
}

const InviteForm: React.FC<InviteFormProps> = ({ projectId, onInvite, isLoading }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    // Simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    
    try {
      await onInvite(email.trim(), role);
      setSuccess(`Invitation sent to ${email}`);
      setEmail(''); // Clear the form
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    }
  };

  return (
    <div className="mt-4 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
      <h3 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">Invite Team Member</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {/* Email input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              disabled={isLoading}
            />
          </div>
          
          {/* Role select */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectMemberRole)}
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              disabled={isLoading}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">Owner:</span> Full control including deleting project and managing members
              <br />
              <span className="font-medium">Admin:</span> Can manage project content and settings
              <br />
              <span className="font-medium">Member:</span> Can view project and perform limited operations
            </p>
          </div>
          
          {/* Error/Success messages */}
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          
          {success && (
            <p className="text-green-500 text-sm">{success}</p>
          )}
          
          {/* Submit button */}
          <div>
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default InviteForm;