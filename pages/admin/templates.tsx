/**
 * @fileoverview Admin Template Management Interface
 * 
 * This page provides admin users with tools to create, edit, and delete
 * project templates. It includes template structure validation and
 * comprehensive management capabilities.
 * 
 * Features:
 * - View all existing templates
 * - Create new templates with validation
 * - Navigate to template configuration pages
 * - Delete templates with confirmation
 * - Template structure validation
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
import { ProjectTemplateWithDetails } from '../../types/database';
import { Organization, UserOrganization } from '../../types/database';
import { useAuth } from '../../components/AuthContext';
import { supabase } from '../../utils/supabaseClient';

interface TemplateFormData {
  name: string;
  description: string;
  icon: string;
}

const defaultFormData: TemplateFormData = {
  name: '',
  description: '',
  icon: ''
};

export default function AdminTemplates() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProjectTemplateWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (!authLoading && user && !isAdmin) {
      router.replace('/projects');
      return;
    }
  }, [user, authLoading, isAdmin, router]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchTemplates();
    }
  }, [user, isAdmin]);

  // Fetch admin's primary organization
  useEffect(() => {
    const fetchPrimaryOrg = async () => {
      if (!user) return;
      setOrgLoading(true);
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .single();
      if (data && data.organization_id) {
        setOrganizationId(data.organization_id);
      } else {
        setOrganizationId(null);
      }
      setOrgLoading(false);
    };
    if (user) fetchPrimaryOrg();
  }, [user]);

  const fetchTemplates = async () => {
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

      const response = await fetch('/api/templates', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (templateData: TemplateFormData) => {
    setSubmitting(true);
    try {
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Authentication required');
      }
      if (!organizationId) {
        throw new Error('No primary organization found.');
      }
      // Create basic template structure with default states, workflows, and task types
      const basicTemplateData = {
        name: templateData.name,
        description: templateData.description,
        icon: templateData.icon,
        organization_id: organizationId, // <-- include org
        states: [
          { name: 'To Do', position: 0 },
          { name: 'In Progress', position: 1 },
          { name: 'Done', position: 2 }
        ],
        workflows: [{ name: 'Default Workflow' }],
        task_types: [{ name: 'Task', workflow_id: 'Default Workflow' }],
        fields: []
      };
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(basicTemplateData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      await fetchTemplates();
      setShowForm(false);
      setFormData(defaultFormData);
      alert('Template created successfully!');
    } catch (err: any) {
      alert(`Error creating template: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the template "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/templates?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      await fetchTemplates();
      alert('Template deleted successfully!');
    } catch (err: any) {
      alert(`Error deleting template: ${err.message}`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateTemplate(formData);
  };

  if (authLoading || loading) {
    return (
      <Page title="Template Management">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading templates...</p>
          </div>
        </Section>
      </Page>
    );
  }

  if (orgLoading) {
    return (
      <Page title="Template Management">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading organization...</p>
          </div>
        </Section>
      </Page>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  if (!isAdmin) {
    return null; // Will redirect to projects
  }

  if (error) {
    return (
      <Page title="Template Management">
        <Section>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error: {error}
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title="Template Management">
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Template Management
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Create and manage project templates for the organization
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create New Template
          </button>
        </div>

        {/* Templates Grid */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Available Templates</h3>
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-600 dark:text-zinc-400">No templates available.</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                  Create your first template to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <div key={template.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors">
                    <div className="flex items-center mb-3">
                      <span className="text-2xl mr-3">{template.icon || '📋'}</span>
                      <div className="flex-1">
                        <h4 className="font-medium text-zinc-800 dark:text-zinc-200">{template.name}</h4>
                        {template.description && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-1">
                      <div>States: {template.states?.length || 0}</div>
                      <div>Workflows: {template.workflows?.length || 0}</div>
                      <div>Task Types: {template.task_types?.length || 0}</div>
                      <div>Fields: {template.fields?.length || 0}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/templates/${template.id}`}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 text-center"
                      >
                        Configure
                      </Link>
                      <button
                        onClick={() => handleDeleteTemplate(template.id, template.name)}
                        className="px-3 py-2 text-red-600 hover:text-red-700 text-sm border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create Template Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-lg w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Create New Template</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="Enter template name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    rows={3}
                    placeholder="Enter template description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="📋"
                  />
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
                    {submitting ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Section>
    </Page>
  );
}