import React, { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { ProjectMember, ProjectInvite } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/components/AuthContext';

interface MemberListProps {
  projectId: string;
  currentUserRole: string;
  members: Array<ProjectMember & { auth: { users: { email: string, created_at: string } } }>;
  pendingInvites: ProjectInvite[];
  onMemberChange: () => void;
}

const MemberList: React.FC<MemberListProps> = ({ 
  projectId, 
  currentUserRole, 
  members, 
  pendingInvites, 
  onMemberChange 
}) => {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  
  const isOwnerOrAdmin = ['owner', 'admin'].includes(currentUserRole);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!isOwnerOrAdmin) return;
    
    setIsUpdating(memberId);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating member role: ${memberId} to ${newRole}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Update the member's role
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ role: newRole })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update member role');
      }
      
      // Notify parent component to refresh the members list
      onMemberChange();
      
      console.log(`[${traceId}] Successfully updated member role`);
    } catch (err: any) {
      console.error('Error updating member role:', err.message);
      setError(err.message || 'Failed to update member role. Please try again.');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setIsUpdating(memberId);
    setError(null);
    setConfirmRemove(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Removing member: ${memberId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Remove the member
      const response = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member');
      }
      
      // Notify parent component to refresh the members list
      onMemberChange();
      
      console.log(`[${traceId}] Successfully removed member`);
      
      // If the current user removed themselves, they'll be redirected by the API response
    } catch (err: any) {
      console.error('Error removing member:', err.message);
      setError(err.message || 'Failed to remove member. Please try again.');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!isOwnerOrAdmin) return;
    
    setIsUpdating(inviteId);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Canceling invitation: ${inviteId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Delete the invitation directly from Supabase
      const { error: deleteError } = await supabase
        .from('project_invites')
        .delete()
        .eq('id', inviteId)
        .eq('project_id', projectId);
        
      if (deleteError) {
        throw new Error(deleteError.message || 'Failed to cancel invitation');
      }
      
      // Notify parent component to refresh the invites list
      onMemberChange();
      
      console.log(`[${traceId}] Successfully canceled invitation`);
    } catch (err: any) {
      console.error('Error canceling invitation:', err.message);
      setError(err.message || 'Failed to cancel invitation. Please try again.');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <div>
        <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">Members</h3>
        
        <div className="bg-white dark:bg-zinc-800 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-700">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Role
                </th>
                {isOwnerOrAdmin && (
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
              {members.map((member) => (
                <tr key={member.user_id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                        <span className="text-gray-500 dark:text-zinc-400 text-sm font-medium">
                          {member.auth?.users?.email.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-zinc-200">
                          {member.auth?.users?.email || 'Unknown User'}
                        </div>
                        {member.user_id === user?.id && (
                          <div className="text-xs text-gray-500 dark:text-zinc-400">
                            (You)
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isOwnerOrAdmin && member.user_id !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                        disabled={isUpdating === member.user_id}
                        className="text-sm border rounded p-1 dark:bg-zinc-700 dark:border-zinc-600"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {member.role}
                      </span>
                    )}
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {confirmRemove === member.user_id ? (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="text-red-600 hover:text-red-800 text-xs bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded"
                            disabled={isUpdating === member.user_id}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            className="text-gray-600 hover:text-gray-800 text-xs bg-gray-100 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(member.user_id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                          disabled={
                            isUpdating === member.user_id || 
                            (member.role === 'owner' && currentUserRole !== 'owner') ||
                            (member.user_id === user?.id && member.role === 'owner') // Can't remove yourself if you're the only owner
                          }
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {isOwnerOrAdmin && pendingInvites.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">Pending Invitations</h3>
          
          <div className="bg-white dark:bg-zinc-800 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-zinc-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-800 divide-y divide-gray-200 dark:divide-zinc-700">
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-zinc-200">
                        {invite.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-zinc-400">
                        Invited {new Date(invite.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {invite.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invite.dummy_user ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          Dummy User
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Real User
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={isUpdating === invite.id}
                      >
                        {isUpdating === invite.id ? 'Canceling...' : 'Cancel Invite'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberList;
