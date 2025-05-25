import React, { useState } from 'react';
import { ProjectMemberRole } from '@/types/database';

interface DummyUserFormProps {
  projectId: string;
  onAddDummyUser: (name: string, role: ProjectMemberRole) => Promise<void>;
  isLoading: boolean;
}

const DummyUserForm: React.FC<DummyUserFormProps> = ({ projectId, onAddDummyUser, isLoading }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<ProjectMemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setError(null);
    
    try {
      await onAddDummyUser(name.trim(), role);
      setSuccess(`Added dummy user "${name}"`);
      setName(''); // Clear the form
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add dummy user');
    }
  };

  return (
    <div className="mt-4 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
      <h3 className="font-medium text-zinc-800 dark:text-zinc-200 mb-3">Add Dummy User</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
        Create placeholder users for planning purposes (not tied to real accounts).
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {/* Name input */}
          <div>
            <label htmlFor="dummy-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              id="dummy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              disabled={isLoading}
            />
          </div>
          
          {/* Role select */}
          <div>
            <label htmlFor="dummy-role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Role
            </label>
            <select
              id="dummy-role"
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectMemberRole)}
              className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
              disabled={isLoading}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
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
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add Dummy User'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DummyUserForm;