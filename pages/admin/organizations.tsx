/**
 * @fileoverview Admin Organizations Management Interface
 * 
 * This page provides admin users with tools to create, edit, and delete
 * organizations and manage user memberships.
 * 
 * Features:
 * - View all existing organizations
 * - Create new organizations with validation
 * - Navigate to organization details pages
 * - Delete organizations with confirmation
 * - Organization structure validation
 * - Audit logging
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
import { Organization } from '../../types/database';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../utils/supabaseClient';

interface OrganizationFormData {
  name: string;
  slug: string;
  description: string;
  domain: string;
  website_url: string;
  billing_email: string;
  phone: string;
  address_line1: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
}

const defaultFormData: OrganizationFormData = {
  name: '',
  slug: '',
  description: '',
  domain: '',
  website_url: '',
  billing_email: '',
  phone: '',
  address_line1: '',
  city: '',
  state_province: '',
  postal_code: '',
  country: ''
};

interface OrganizationWithMemberCount extends Organization {
  member_count: number;
}

export default function AdminOrganizations() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<OrganizationFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user && !isAdmin) {
      router.push('/projects');
    }
  }, [user, isAdmin, authLoading, router]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/organizations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchOrganizations();
    }
  }, [user, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Auto-generate slug from name if not provided
      const slugToUse = formData.slug || formData.name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim();

      const organizationData = {
        ...formData,
        slug: slugToUse,
      };

      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(organizationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('Organization created:', data);
      
      // Reset form and refresh list
      setFormData(defaultFormData);
      setShowForm(false);
      await fetchOrganizations();
    } catch (err) {
      console.error('Error creating organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (organizationId: string) => {
    if (deleteConfirm !== organizationId) {
      setDeleteConfirm(organizationId);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`/api/organizations?id=${organizationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      setDeleteConfirm(null);
      await fetchOrganizations();
    } catch (err) {
      console.error('Error deleting organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
    }
  };

  if (!user) {
    return null; // Will redirect to login
  }

  if (!isAdmin) {
    return null; // Will redirect to projects
  }

  if (error) {
    return (
      <Page title="Organization Management">
        <Section>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error: {error}
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title="Organization Management">
      <Section>
        {/* Admin Navigation */}
        <div className="mb-6">
          <AdminNav />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Organization Management
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Create and manage organizations for the system
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Organization
          </button>
        </div>

        {/* Create Organization Form */}
        {showForm && (
          <div className="mb-6 p-4 border border-zinc-300 dark:border-zinc-600 rounded-md bg-zinc-50 dark:bg-zinc-800">
            <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-4">
              Create New Organization
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="acme-corp"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="Organization description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Domain
                  </label>
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="https://acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.billing_email}
                    onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="billing@acme.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Organizations List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-zinc-500 dark:text-zinc-400">Loading organizations...</div>
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-zinc-500 dark:text-zinc-400">No organizations found</div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              Create your first organization to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="p-4 border border-zinc-300 dark:border-zinc-600 rounded-md hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
                        {org.name}
                      </h3>
                      <span className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded">
                        {org.slug}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
                        {org.member_count} members
                      </span>
                    </div>
                    {org.description && (
                      <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                        {org.description}
                      </p>
                    )}
                    <div className="flex gap-4 text-sm text-zinc-500 dark:text-zinc-500">
                      {org.domain && (
                        <span>Domain: {org.domain}</span>
                      )}
                      {org.website_url && (
                        <a 
                          href={org.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Website
                        </a>
                      )}
                      <span>Created: {new Date(org.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Link 
                      href={`/admin/organizations/${org.id}`}
                      className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Manage
                    </Link>
                    <button
                      onClick={() => handleDelete(org.id)}
                      className={`px-3 py-1 text-sm rounded-md ${
                        deleteConfirm === org.id
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800'
                      }`}
                    >
                      {deleteConfirm === org.id ? 'Confirm Delete' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}