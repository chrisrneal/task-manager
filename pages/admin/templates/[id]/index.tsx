/**
 * @fileoverview Template Settings Interface
 * 
 * This page provides admin users with tools to configure individual template settings,
 * mirroring the project settings interface structure.
 * 
 * Features:
 * - Template details management (name, description, icon)
 * - Navigation to different configuration areas
 * - Template deletion (danger zone)
 * - Consistent with project settings UI
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
import { ProjectTemplate } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const TemplateSettings = () => {
  const router = useRouter();
  const { id: templateId } = router.query;
  const { user, loading } = useAuth();
  
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedTemplateName, setEditedTemplateName] = useState('');
  const [editedTemplateDescription, setEditedTemplateDescription] = useState('');
  const [editedTemplateIcon, setEditedTemplateIcon] = useState('');
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState(false);

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

  // Fetch template data
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !templateId || !isAdmin) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching template data: ${templateId}`);
        
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
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
        setEditedTemplateName(templateData.name);
        setEditedTemplateDescription(templateData.description || '');
        setEditedTemplateIcon(templateData.icon || '');
        
        console.log(`[${traceId}] Fetched template data successfully`);
      } catch (err: any) {
        console.error('Error fetching template data:', err.message);
        setError('Failed to load template data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, templateId, isAdmin, router]);
  
  // Handler to update template details (name, description, and icon)
  const handleUpdateTemplateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editedTemplateName.trim()) {
      setError('Template name cannot be empty');
      return;
    }

    const hasNameChanged = editedTemplateName !== template?.name;
    const hasDescriptionChanged = editedTemplateDescription !== (template?.description || '');
    const hasIconChanged = editedTemplateIcon !== (template?.icon || '');
    
    if (!hasNameChanged && !hasDescriptionChanged && !hasIconChanged) {
      return; // No changes, don't submit
    }
    
    setIsSubmittingName(true);
    setError(null);
    setNameUpdateSuccess(false);
    
    // Store original values for rollback if needed
    const originalName = template?.name || '';
    const originalDescription = template?.description || '';
    const originalIcon = template?.icon || '';
    
    // Optimistic update
    setTemplate(prev => prev ? { 
      ...prev, 
      name: editedTemplateName,
      description: editedTemplateDescription || null,
      icon: editedTemplateIcon || null
    } : null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating template details for template: ${templateId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to update template details
      const response = await fetch(`/api/templates?id=${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: editedTemplateName,
          description: editedTemplateDescription || null,
          icon: editedTemplateIcon || null
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update template details');
      }
      
      // Show success message
      setNameUpdateSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setNameUpdateSuccess(false);
      }, 3000);
      
      console.log(`[${traceId}] Template details updated successfully`);
    } catch (err: any) {
      console.error('Error updating template details:', err.message);
      setError('Failed to update template details. Please try again.');
      
      // Rollback optimistic update
      setTemplate(prev => prev ? { 
        ...prev, 
        name: originalName,
        description: originalDescription || null,
        icon: originalIcon || null
      } : null);
      setEditedTemplateName(originalName);
      setEditedTemplateDescription(originalDescription);
      setEditedTemplateIcon(originalIcon);
    } finally {
      setIsSubmittingName(false);
    }
  };

  // Handler to delete the template
  const handleDeleteTemplate = async () => {
    if (!templateId || !template) return;
    
    const confirmMessage = `Are you sure you want to delete "${template.name}"? This will permanently delete the template and all its configuration. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting template: ${templateId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to delete template
      const response = await fetch(`/api/templates?id=${templateId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }
      
      console.log(`[${traceId}] Template deleted successfully`);
      
      // Redirect to templates list with success message
      router.push('/admin/templates?deleted=true');
    } catch (err: any) {
      console.error('Error deleting template:', err.message);
      setError('Failed to delete template. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Template Settings">
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
    <Page title={`${template?.name} - Template Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Template Settings
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Configure states, workflows, and task types for {template?.name}
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
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
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
            className="px-4 py-2 text-sm font-medium whitespace-nowrap text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Fields
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Settings sections */}
        <div className="space-y-8">
          {/* Template Details Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Template Details</h3>
            <form onSubmit={handleUpdateTemplateDetails} className="mb-4">
              <div className="mb-3">
                <label htmlFor="templateName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Template Name
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="templateName"
                    value={editedTemplateName}
                    onChange={(e) => setEditedTemplateName(e.target.value)}
                    className="flex-grow p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600 mr-2"
                    placeholder="Enter template name"
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="templateDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Template Description
                </label>
                <textarea
                  id="templateDescription"
                  value={editedTemplateDescription}
                  onChange={(e) => setEditedTemplateDescription(e.target.value)}
                  className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  placeholder="Enter template description (optional)"
                  rows={3}
                />
              </div>
              <div className="mb-3">
                <label htmlFor="templateIcon" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Template Icon (emoji)
                </label>
                <input
                  type="text"
                  id="templateIcon"
                  value={editedTemplateIcon}
                  onChange={(e) => setEditedTemplateIcon(e.target.value)}
                  className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  placeholder="📋"
                />
              </div>
              <div className="flex items-center">
                <button
                  type="submit"
                  disabled={
                    isSubmittingName || 
                    !editedTemplateName.trim() || 
                    (editedTemplateName === template?.name && 
                     editedTemplateDescription === (template?.description || '') &&
                     editedTemplateIcon === (template?.icon || ''))
                  }
                  className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingName ? "Saving..." : "Save Changes"}
                </button>
              </div>
              {nameUpdateSuccess && (
                <p className="text-green-500 text-sm my-2">
                  Template details updated successfully
                </p>
              )}
            </form>
          </div>

          {/* Delete Template Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-red-200 dark:border-red-800">
            <h3 className="font-medium mb-2 text-red-800 dark:text-red-300">Danger Zone</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Deleting a template is permanent and cannot be undone. This will delete all template configuration including states, workflows, task types, and fields.
            </p>
            <button
              onClick={handleDeleteTemplate}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? "Deleting..." : "Delete Template"}
            </button>
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default TemplateSettings;