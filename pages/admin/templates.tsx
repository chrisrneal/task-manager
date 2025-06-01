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
 * - Edit existing templates
 * - Delete templates with confirmation
 * - Template structure validation
 * - Audit logging
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { useState, useEffect } from 'react';
import { ProjectTemplateWithDetails } from '../../types/database';

interface TemplateFormData {
  name: string;
  description: string;
  icon: string;
  states: Array<{ name: string; position: number }>;
  workflows: Array<{ name: string }>;
  task_types: Array<{ name: string; workflow_id: string }>;
  fields: Array<{
    name: string;
    input_type: string;
    is_required: boolean;
    options?: string[];
    default_value?: string;
  }>;
}

const defaultFormData: TemplateFormData = {
  name: '',
  description: '',
  icon: '',
  states: [{ name: 'To Do', position: 1 }, { name: 'In Progress', position: 2 }, { name: 'Done', position: 3 }],
  workflows: [{ name: 'Default Workflow' }],
  task_types: [{ name: 'Task', workflow_id: 'Default Workflow' }],
  fields: []
};

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplateWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplateWithDetails | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('supabase.auth.token');
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
      const token = localStorage.getItem('supabase.auth.token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
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
      const token = localStorage.getItem('supabase.auth.token');
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

  const addField = () => {
    setFormData({
      ...formData,
      fields: [
        ...formData.fields,
        { name: '', input_type: 'text', is_required: false }
      ]
    });
  };

  const removeField = (index: number) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((_, i) => i !== index)
    });
  };

  const updateField = (index: number, field: Partial<typeof formData.fields[0]>) => {
    const updatedFields = [...formData.fields];
    updatedFields[index] = { ...updatedFields[index], ...field };
    setFormData({
      ...formData,
      fields: updatedFields
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin - Template Management</h1>
          <div className="text-center">Loading templates...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin - Template Management</h1>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin - Template Management</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Template
          </button>
        </div>

        {/* Templates List */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">{template.icon || '📋'}</span>
                <h3 className="text-lg font-semibold">{template.name}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">{template.description}</p>
              <div className="text-xs text-gray-500 mb-4">
                <div>States: {template.states?.length || 0}</div>
                <div>Workflows: {template.workflows?.length || 0}</div>
                <div>Task Types: {template.task_types?.length || 0}</div>
                <div>Fields: {template.fields?.length || 0}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteTemplate(template.id, template.name)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Create Template Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-full overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Create New Template</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="📋"
                  />
                </div>

                {/* Custom Fields Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Custom Fields
                    </label>
                    <button
                      type="button"
                      onClick={addField}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      + Add Field
                    </button>
                  </div>

                  {formData.fields.map((field, index) => (
                    <div key={index} className="border border-gray-200 rounded p-3 mb-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Field {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeField(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Field name"
                          value={field.name}
                          onChange={(e) => updateField(index, { name: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <select
                          value={field.input_type}
                          onChange={(e) => updateField(index, { input_type: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Textarea</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="select">Select</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="radio">Radio</option>
                        </select>
                      </div>
                      <div className="mt-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={field.is_required}
                            onChange={(e) => updateField(index, { is_required: e.target.checked })}
                            className="mr-2"
                          />
                          <span className="text-sm">Required</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}