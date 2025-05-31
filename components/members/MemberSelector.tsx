import React from 'react';
import { ProjectMemberWithUser } from '../../types/database';

interface MemberSelectorProps {
  projectId: string;
  members: ProjectMemberWithUser[];
  selectedMemberId: string | null;
  onMemberSelect: (memberId: string | null) => void;
  disabled?: boolean;
}

const MemberSelector: React.FC<MemberSelectorProps> = ({
  projectId,
  members,
  selectedMemberId,
  onMemberSelect,
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onMemberSelect(value === '' ? null : value);
  };

  return (
    <div>
      <label 
        htmlFor={`assignee-${projectId}`} 
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
      >
        Assignee
      </label>
      <select
        id={`assignee-${projectId}`}
        value={selectedMemberId || ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600 dark:text-zinc-100"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.name} {member.role !== 'member' && `(${member.role})`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MemberSelector;