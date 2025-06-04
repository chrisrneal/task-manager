/**
 * @fileoverview Template Fields Configuration Interface
 * 
 * This page provides admin users with tools to configure template fields,
 * mirroring the project fields management interface.
 * 
 * Features:
 * - View and manage template fields
 * - Add, edit, delete fields
 * - Field type configuration (text, number, select, etc.)
 * - Required field settings
 * - Consistent with project fields UI
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { ProjectTemplate, TemplateField, FieldInputType } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const TemplateFieldsSettings = () => {
  const router = useRouter();
  const { id: templateId } = router.query;
  const { user, loading } = useAuth();
  
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Form state for adding a new field
  const [newField, setNewField] = useState({
    name: '',
    input_type: 'text' as FieldInputType,
    is_required: false,
    default_value: '',
    options: [] as string[]
  });
  
  // State for editing a field
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    input_type: 'text' as FieldInputType,
    is_required: false,
    default_value: '',
    options: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth protection and admin role check
  useEffect(() => {
    const checkAuth = async () => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
          return;
        }
        
        // Check if user is admin
        if (user.app_metadata?.role !== 'admin') {
          router.replace('/projects');
          return;
        }
        
        setIsAdmin(true);
      }
    };
    
    checkAuth();
  }, [user, loading, router]);

  // Fetch template and fields data
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !templateId || !isAdmin) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching template and fields data: ${templateId}`);
        
        // Fetch template data
        const { data: templateData, error: templateError } = await supabase
          .from('project_templates')
          .select('*')
          .eq('id', templateId)
          .single();
          
        if (templateError) throw templateError;
        
        if (!templateData) {
          router.replace('/admin/templates');
          return;
        }
        
        setTemplate(templateData);
        
        // Fetch template fields
        const { data: fieldsData, error: fieldsError } = await supabase
          .from('template_fields')
          .select('*')
          .eq('template_id', templateId)
          .order('name', { ascending: true });
          
        if (fieldsError) throw fieldsError;
        setFields(fieldsData || []);
        
        console.log(`[${traceId}] Fetched template and ${fieldsData?.length || 0} fields successfully`);
      } catch (err: any) {
        console.error('Error fetching template data:', err.message);
        setError('Failed to load template data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, templateId, isAdmin, router]);

  // Clear success message after a delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handle adding a new field
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.name.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding new template field: ${newField.name}`);
      
      // Add to database
      const { data, error: insertError } = await supabase
        .from('template_fields')
        .insert([{
          template_id: templateId,
          name: newField.name,
          input_type: newField.input_type,
          is_required: newField.is_required,
          default_value: newField.default_value || null,
          options: newField.options.length > 0 ? newField.options : null
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Add to UI
      setFields(prev => [...prev, data]);
      
      // Reset form
      setNewField({
        name: '',
        input_type: 'text',
        is_required: false,
        default_value: '',
        options: []
      });
      
      setSuccess('Field added successfully!');
      console.log(`[${traceId}] Template field added successfully: ${data.id}`);
    } catch (err: any) {
      setError('Failed to add field. Please try again.');
      console.error('Error adding template field:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle editing a field
  const handleStartEdit = (field: TemplateField) => {
    setEditingField(field.id);
    setEditForm({
      name: field.name,
      input_type: field.input_type,
      is_required: field.is_required,
      default_value: field.default_value || '',
      options: field.options || []
    });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditForm({
      name: '',
      input_type: 'text',
      is_required: false,
      default_value: '',
      options: []
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.name.trim()) {
      handleCancelEdit();
      return;
    }
    
    setIsSubmitting(true);
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating template field: ${id}`);
      
      // Update in database
      const { error: updateError } = await supabase
        .from('template_fields')
        .update({
          name: editForm.name,
          input_type: editForm.input_type,
          is_required: editForm.is_required,
          default_value: editForm.default_value || null,
          options: editForm.options.length > 0 ? editForm.options : null
        })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Update UI
      setFields(prev => prev.map(field => 
        field.id === id 
          ? { 
              ...field, 
              name: editForm.name,
              input_type: editForm.input_type,
              is_required: editForm.is_required,
              default_value: editForm.default_value || null,
              options: editForm.options.length > 0 ? editForm.options : null
            }
          : field
      ));
      
      setEditingField(null);
      setSuccess('Field updated successfully!');
      console.log(`[${traceId}] Template field updated successfully`);
    } catch (err: any) {
      setError('Failed to update field. Please try again.');
      console.error('Error updating template field:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a field
  const handleDeleteField = async (id: string) => {
    const field = fields.find(f => f.id === id);
    if (!field) return;
    
    if (!confirm(`Are you sure you want to delete the field "${field.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting template field: ${id}`);
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('template_fields')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      // Remove from UI
      setFields(prev => prev.filter(f => f.id !== id));
      setSuccess('Field deleted successfully!');
      console.log(`[${traceId}] Template field deleted successfully`);
    } catch (err: any) {
      setError('Failed to delete field. Please try again.');
      console.error('Error deleting template field:', err.message);
    }
  };

  // Helper function to manage options for select/radio fields
  const handleOptionsChange = (value: string, isEdit: boolean = false) => {
    const options = value.split('\n').filter(opt => opt.trim() !== '');
    if (isEdit) {
      setEditForm(prev => ({ ...prev, options }));
    } else {
      setNewField(prev => ({ ...prev, options }));
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Template Fields">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </Section>
      </Page>
    );
  }

  // Not authorized state
  if (!isAdmin) {
    return null; // Already redirected in useEffect
  }

  return (
    <Page title={`${template?.name} - Fields Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Template Fields
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage custom fields for {template?.name}
            </p>
          </div>
          <Link
            href="/admin/templates"
            className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
          >
            Back to Templates
          </Link>
        </div>
        
        {/* Settings Navigation */}
        <div className="flex border-b border-gray-200 dark:border-zinc-700 mb-6 overflow-x-auto">
          <Link
            href={`/admin/templates/${templateId}`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            General
          </Link>
          <Link
            href={`/admin/templates/${templateId}/states`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            States
          </Link>
          <Link
            href={`/admin/templates/${templateId}/workflows`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Workflows
          </Link>
          <Link
            href={`/admin/templates/${templateId}/fields`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
          >
            Fields
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4">{success}</p>}

        {/* Fields Management */}
        <div className="space-y-8">
          {/* Add New Field Form */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Add New Field</h3>
            
            <form onSubmit={handleAddField} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    value={newField.name}
                    onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    placeholder="Enter field name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newField.input_type}
                    onChange={(e) => setNewField(prev => ({ ...prev, input_type: e.target.value as FieldInputType }))}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
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
              </div>

              {(newField.input_type === 'select' || newField.input_type === 'radio') && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Options (one per line)
                  </label>
                  <textarea
                    value={newField.options.join('\n')}
                    onChange={(e) => handleOptionsChange(e.target.value)}
                    className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                    rows={3}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newField.is_required}
                    onChange={(e) => setNewField(prev => ({ ...prev, is_required: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">Required field</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || !newField.name.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Field'}
                </button>
              </div>
            </form>
          </div>

          {/* Fields List */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Template Fields</h3>
            
            {fields.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-600 dark:text-zinc-400">No fields defined for this template.</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                  Add your first field to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4"
                  >
                    {editingField === field.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Field Name
                            </label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Field Type
                            </label>
                            <select
                              value={editForm.input_type}
                              onChange={(e) => setEditForm(prev => ({ ...prev, input_type: e.target.value as FieldInputType }))}
                              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
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
                        </div>

                        {(editForm.input_type === 'select' || editForm.input_type === 'radio') && (
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                              Options (one per line)
                            </label>
                            <textarea
                              value={editForm.options.join('\n')}
                              onChange={(e) => handleOptionsChange(e.target.value, true)}
                              className="w-full p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                              rows={3}
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={editForm.is_required}
                              onChange={(e) => setEditForm(prev => ({ ...prev, is_required: e.target.checked }))}
                              className="mr-2"
                            />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">Required field</span>
                          </label>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(field.id)}
                              disabled={isSubmitting}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1 bg-zinc-600 text-white text-sm rounded-md hover:bg-zinc-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-zinc-800 dark:text-zinc-200">
                            {field.name}
                            {field.is_required && <span className="text-red-500 ml-1">*</span>}
                          </h4>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Type: {field.input_type}
                            {field.options && field.options.length > 0 && (
                              <span> • Options: {field.options.join(', ')}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartEdit(field)}
                            className="px-3 py-1 text-indigo-600 hover:text-indigo-700 text-sm border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="px-3 py-1 text-red-600 hover:text-red-700 text-sm border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default TemplateFieldsSettings;