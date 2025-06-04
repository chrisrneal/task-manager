/**
 * @fileoverview Template Workflows Configuration Interface
 * 
 * This page provides admin users with tools to configure template workflows,
 * mirroring the project workflows management interface.
 * 
 * Features:
 * - View and manage template workflows
 * - Add, edit, delete workflows
 * - Basic workflow configuration
 * - Consistent with project workflows UI
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
import { ProjectTemplate, TemplateWorkflow } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const TemplateWorkflowsSettings = () => {
  const router = useRouter();
  const { id: templateId } = router.query;
  const { user, loading } = useAuth();
  
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [workflows, setWorkflows] = useState<TemplateWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Workflow management
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editWorkflowName, setEditWorkflowName] = useState('');

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

  // Fetch template and workflows data
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !templateId || !isAdmin) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching template and workflows data: ${templateId}`);
        
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
        
        // Fetch template workflows
        const { data: workflowsData, error: workflowsError } = await supabase
          .from('template_workflows')
          .select('*')
          .eq('template_id', templateId)
          .order('name', { ascending: true });
          
        if (workflowsError) throw workflowsError;
        setWorkflows(workflowsData || []);
        
        console.log(`[${traceId}] Fetched template and ${workflowsData?.length || 0} workflows successfully`);
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

  // Handle adding a new workflow
  const handleAddWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding new template workflow: ${newWorkflowName}`);
      
      // Add to database
      const { data, error: insertError } = await supabase
        .from('template_workflows')
        .insert([{
          template_id: templateId,
          name: newWorkflowName
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Add to UI
      setWorkflows(prev => [...prev, data]);
      setNewWorkflowName('');
      setSuccess('Workflow added successfully!');
      console.log(`[${traceId}] Template workflow added successfully: ${data.id}`);
    } catch (err: any) {
      setError('Failed to add workflow. Please try again.');
      console.error('Error adding template workflow:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle renaming a workflow
  const handleStartEdit = (workflow: TemplateWorkflow) => {
    setEditingWorkflowId(workflow.id);
    setEditWorkflowName(workflow.name);
  };

  const handleCancelEdit = () => {
    setEditingWorkflowId(null);
    setEditWorkflowName('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editWorkflowName.trim()) {
      handleCancelEdit();
      return;
    }
    
    setIsSubmitting(true);
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating template workflow name: ${id}`);
      
      // Update in database
      const { error: updateError } = await supabase
        .from('template_workflows')
        .update({ name: editWorkflowName })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Update UI
      setWorkflows(prev => prev.map(workflow => 
        workflow.id === id ? { ...workflow, name: editWorkflowName } : workflow
      ));
      
      setEditingWorkflowId(null);
      setEditWorkflowName('');
      setSuccess('Workflow updated successfully!');
      console.log(`[${traceId}] Template workflow updated successfully`);
    } catch (err: any) {
      setError('Failed to update workflow. Please try again.');
      console.error('Error updating template workflow:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a workflow
  const handleDeleteWorkflow = async (id: string) => {
    const workflow = workflows.find(w => w.id === id);
    if (!workflow) return;
    
    if (!confirm(`Are you sure you want to delete the workflow "${workflow.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting template workflow: ${id}`);
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('template_workflows')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      // Remove from UI
      setWorkflows(prev => prev.filter(w => w.id !== id));
      setSuccess('Workflow deleted successfully!');
      console.log(`[${traceId}] Template workflow deleted successfully`);
    } catch (err: any) {
      setError('Failed to delete workflow. Please try again.');
      console.error('Error deleting template workflow:', err.message);
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Template Workflows">
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
    <Page title={`${template?.name} - Workflows Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Template Workflows
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Manage workflows for {template?.name}
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
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
          >
            Workflows
          </Link>
          <Link
            href={`/admin/templates/${templateId}/fields`}
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Fields
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4">{success}</p>}

        {/* Workflows Management */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Template Workflows</h3>
            
            {/* Add New Workflow Form */}
            <form onSubmit={handleAddWorkflow} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="Enter workflow name"
                  className="flex-1 p-2 border border-zinc-300 dark:border-zinc-600 rounded-md dark:bg-zinc-700 dark:text-zinc-200"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newWorkflowName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Workflow'}
                </button>
              </div>
            </form>

            {/* Workflows List */}
            {workflows.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-600 dark:text-zinc-400">No workflows defined for this template.</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
                  Add your first workflow to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-750"
                  >
                    <div className="flex items-center space-x-3">
                      {editingWorkflowId === workflow.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editWorkflowName}
                            onChange={(e) => setEditWorkflowName(e.target.value)}
                            className="p-1 border border-zinc-300 dark:border-zinc-600 rounded dark:bg-zinc-700 dark:text-zinc-200"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(workflow.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(workflow.id)}
                            className="text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-zinc-500 hover:text-zinc-700"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {workflow.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleStartEdit(workflow)}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="text-zinc-500 hover:text-red-500"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
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

export default TemplateWorkflowsSettings;