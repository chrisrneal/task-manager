/**
 * @fileoverview Organization Detail Management Page
 * 
 * This page provides detailed management for a specific organization,
 * including member management, settings, and organization details.
 * 
 * Features:
 * - View organization details
 * - Manage user memberships
 * - Add/remove users from organization
 * - Update user roles
 * - Edit organization settings
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import AdminNav from '@/components/AdminNav';
import { Organization, UserOrganization, AppUser } from '../../../types/database';
import { useAuth } from '../../../components/AuthContext';
import { supabase } from '../../../utils/supabaseClient';

interface MembershipWithUser extends UserOrganization {
  users: AppUser;
}

interface UserSelectOption {
  id: string;
  email: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

export default function OrganizationDetail() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberships, setMemberships] = useState<MembershipWithUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserSelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add user form state
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'member' | 'billing' | 'readonly'>('member');
  const [submitting, setSubmitting] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user && !isAdmin) {
      router.push('/projects');
    }
  }, [user, isAdmin, authLoading, router]);

  const fetchOrganizationData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Fetch organization details
      const orgResponse = await fetch(`/api/organizations?id=${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!orgResponse.ok) {
        throw new Error('Failed to fetch organization');
      }

      const orgData = await orgResponse.json();
      const org = orgData.organizations?.find((o: Organization) => o.id === id);
      
      if (!org) {
        setError('Organization not found');
        return;
      }
      
      setOrganization(org);

      // Fetch organization memberships
      const membersResponse = await fetch(`/api/user-organizations?organization_id=${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!membersResponse.ok) {
        throw new Error('Failed to fetch members');
      }

      const membersData = await membersResponse.json();
      setMemberships(membersData.memberships || []);

    } catch (err) {
      console.error('Error fetching organization data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch organization data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) return;

      // Fetch users who can be added to this organization (excluding current members)
      const response = await fetch(`/api/users?active_only=true&organization_id=${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch available users');
        return;
      }

      const userData = await response.json();
      setAvailableUsers(userData.users || []);
    } catch (err) {
      console.error('Error fetching available users:', err);
    }
  };

  useEffect(() => {
    if (user && isAdmin && id) {
      fetchOrganizationData();
    }
  }, [user, isAdmin, id]);

  useEffect(() => {
    if (showAddUserForm) {
      fetchAvailableUsers();
    }
  }, [showAddUserForm, memberships]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/user-organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          organization_id: id,
          role: selectedRole,
          is_primary: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }

      // Reset form and refresh data
      setSelectedUserId('');
      setSelectedRole('member');
      setShowAddUserForm(false);
      await fetchOrganizationData();
    } catch (err) {
      console.error('Error adding user:', err);
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveUser = async (membershipId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`/api/user-organizations?id=${membershipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove user');
      }

      await fetchOrganizationData();
    } catch (err) {
      console.error('Error removing user:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  // Log app_metadata for debugging
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line no-console
      console.log('User app_metadata:', user.app_metadata);
    }
  }, [user]);

  if (!user || !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Page title="Organization Management">
        <Section>
          <div className="text-center py-8">
            <div className="text-zinc-500 dark:text-zinc-400">Loading organization...</div>
          </div>
        </Section>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Organization Management">
        <Section>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error: {error}
          </div>
          <div className="mt-4">
            <Link 
              href="/admin/organizations"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Back to Organizations
            </Link>
          </div>
        </Section>
      </Page>
    );
  }

  if (!organization) {
    return (
      <Page title="Organization Management">
        <Section>
          <div className="text-center py-8">
            <div className="text-zinc-500 dark:text-zinc-400">Organization not found</div>
          </div>
          <div className="mt-4">
            <Link 
              href="/admin/organizations"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Back to Organizations
            </Link>
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title={`${organization.name} - Organization Management`}>
      <Section>
        {/* Admin Navigation */}
        <div className="mb-6">
          <AdminNav />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link 
              href="/admin/organizations"
              className="text-indigo-600 dark:text-indigo-400 hover:underline mb-2 inline-block"
            >
              ← Back to Organizations
            </Link>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              {organization.name}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage organization members and settings
            </p>
          </div>
          <button
            onClick={() => setShowAddUserForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Add User
          </button>
        </div>

        {/* Organization Info */}
        <div className="mb-6 p-4 border border-zinc-300 dark:border-zinc-600 rounded-md bg-zinc-50 dark:bg-zinc-800">
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
            Organization Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Slug:</span> {organization.slug}
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Domain:</span> {organization.domain || 'N/A'}
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Website:</span> 
              {organization.website_url ? (
                <a href={organization.website_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1">
                  {organization.website_url}
                </a>
              ) : 'N/A'}
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Billing Email:</span> {organization.billing_email || 'N/A'}
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Created:</span> {new Date(organization.created_at).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Active:</span> {organization.is_active ? 'Yes' : 'No'}
            </div>
          </div>
          {organization.description && (
            <div className="mt-3">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">Description:</span>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">{organization.description}</p>
            </div>
          )}
        </div>

        {/* Add User Form */}
        {showAddUserForm && (
          <div className="mb-6 p-4 border border-zinc-300 dark:border-zinc-600 rounded-md bg-zinc-50 dark:bg-zinc-800">
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-4">
              Add User to Organization
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    User *
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.display_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as any)}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                    <option value="billing">Billing</option>
                    <option value="readonly">Read Only</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserForm(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Members List */}
        <div>
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-4">
            Organization Members ({memberships.length})
          </h3>
          
          {memberships.length === 0 ? (
            <div className="text-center py-8 border border-zinc-300 dark:border-zinc-600 rounded-md">
              <div className="text-zinc-500 dark:text-zinc-400">No members found</div>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                Add users to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex justify-between items-center p-4 border border-zinc-300 dark:border-zinc-600 rounded-md hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">
                        {membership.users.display_name}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-500">
                        {membership.users.email}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        membership.role === 'owner' 
                          ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400'
                          : membership.role === 'admin'
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {membership.role}
                      </span>
                      {membership.is_primary && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-500">
                    <div>Joined: {new Date(membership.joined_at).toLocaleDateString()}</div>
                    <button
                      onClick={() => handleRemoveUser(membership.id)}
                      className="text-red-600 dark:text-red-400 hover:underline mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
}