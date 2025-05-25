import React from 'react';
import { ProjectInvite } from '@/types/database';

interface InviteListProps {
  invites: ProjectInvite[];
  onCancelInvite: (inviteId: string) => void;
  onResendInvite: (inviteId: string) => void;
  isLoading: boolean;
}

const InviteList: React.FC<InviteListProps> = ({
  invites,
  onCancelInvite,
  onResendInvite,
  isLoading
}) => {
  // Filter to only show pending invites
  const pendingInvites = invites.filter(invite => invite.status === 'pending');

  if (pendingInvites.length === 0) {
    return null;
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="mt-6">
      <h3 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">Pending Invitations</h3>
      
      <div className="space-y-2">
        {pendingInvites.map(invite => (
          <div 
            key={invite.id}
            className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-zinc-700"
          >
            <div>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                {invite.email}
                <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">
                  {invite.role}
                </span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Invited on {formatDate(invite.created_at)}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onResendInvite(invite.id)}
                disabled={isLoading}
                className="text-sm px-2 py-1 rounded border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
              >
                Resend
              </button>
              <button
                onClick={() => onCancelInvite(invite.id)}
                disabled={isLoading}
                className="text-sm px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InviteList;