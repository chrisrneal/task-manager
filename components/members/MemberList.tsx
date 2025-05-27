import React from 'react';
import { ProjectMember, ProjectMemberRole } from '@/types/database';
import Image from 'next/image';

interface MemberListProps {
  members: (ProjectMember & { email?: string; name?: string; avatar_url?: string; })[];
  currentUserId: string;
  isOwner: boolean;
  isAdmin: boolean;
  onRoleChange: (userId: string, newRole: ProjectMemberRole) => void;
  onRemoveMember: (userId: string) => void;
}

const MemberList: React.FC<MemberListProps> = ({
  members,
  currentUserId,
  isOwner,
  isAdmin,
  onRoleChange,
  onRemoveMember
}) => {
  // Sort members: owners first, then admins, then regular members
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  // Helper to check if role change is allowed
  const canChangeRole = (memberId: string, memberRole: ProjectMemberRole): boolean => {
    // Can't change own role if you're the owner
    if (memberId === currentUserId && memberRole === 'owner') {
      return false;
    }
    
    // Only owners can change roles (or admins, but not for owners)
    return isOwner || (isAdmin && memberRole !== 'owner');
  };

  // Helper to check if removal is allowed
  const canRemoveMember = (memberId: string, memberRole: ProjectMemberRole): boolean => {
    // Can't remove yourself if you're the owner
    if (memberId === currentUserId && memberRole === 'owner') {
      return false;
    }
    
    // Owner can remove anyone
    if (isOwner) {
      return true;
    }
    
    // Admin can remove members but not owners
    if (isAdmin && memberRole !== 'owner') {
      return true;
    }
    
    // Users can remove themselves (leave project)
    return memberId === currentUserId;
  };

  return (
    <div className="space-y-2 mt-2">
      {sortedMembers.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm italic">No members found</p>
      ) : (
        sortedMembers.map(member => (
          <div 
            key={member.user_id}
            className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-md border border-gray-200 dark:border-zinc-700"
          >
            <div className="flex items-center">
              {/* Avatar */}
              <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mr-3 flex items-center justify-center">
                {member.avatar_url ? (
                  <Image 
                    src={member.avatar_url} 
                    alt={member.name || 'User'} 
                    width={40} 
                    height={40} 
                    className="object-cover"
                  />
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 text-lg">
                    {(member.name || member.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              
              {/* User info */}
              <div>
                <p className="font-medium text-zinc-800 dark:text-zinc-200">
                  {member.name || member.email || `User ${member.user_id.slice(0, 8)}`}
                  {member.user_id === currentUserId && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                      You
                    </span>
                  )}
                </p>
                {member.email && member.name && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{member.email}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Role dropdown */}
              <select
                value={member.role}
                onChange={(e) => onRoleChange(member.user_id, e.target.value as ProjectMemberRole)}
                disabled={!canChangeRole(member.user_id, member.role)}
                className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 disabled:opacity-60"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              
              {/* Remove button */}
              <button
                onClick={() => onRemoveMember(member.user_id)}
                disabled={!canRemoveMember(member.user_id, member.role)}
                className="text-sm px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
                aria-label={member.user_id === currentUserId ? "Leave project" : "Remove member"}
              >
                {member.user_id === currentUserId ? "Leave" : "Remove"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MemberList;