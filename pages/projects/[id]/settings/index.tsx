'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { Project } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const ProjectSettings = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, loading } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState('');
  const [editedProjectDescription, setEditedProjectDescription] = useState('');
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
        
        // Check if user is admin or project owner
        if (projectId) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          
          if (!token) {
            router.replace('/projects');
            return;
          }
          
          try {
            // First check if user is a member of the project
            const { data: memberData, error: memberError } = await supabase
              .from('project_members')
              .select('role')
              .eq('project_id', projectId)
              .eq('user_id', user.id)
              .single();
              
            if (memberError || !memberData) {
              // Check if user is a system admin
              if (user.app_metadata?.role !== 'admin') {
                router.replace(`/projects/${projectId}`);
                return;
              }
              setUserRole('admin');
            } else {
              setUserRole(memberData.role);
              
              // Only owners and admins can access settings
              if (memberData.role !== 'owner' && memberData.role !== 'admin' && user.app_metadata?.role !== 'admin') {
                router.replace(`/projects/${projectId}`);
                return;
              }
            }
            
            // Get project data
            const { data: projectData } = await supabase
              .from('projects')
              .select('*')
              .eq('id', projectId)
              .single();
              
            if (!projectData) {
              router.replace('/projects');
              return;
            }
            
            setIsAdmin(true);
            setProject(projectData);
            setEditedProjectName(projectData.name);
            setEditedProjectDescription(projectData.description || '');
          } catch (err) {
            router.replace('/projects');
          }
        }
      }
    };
    
    checkAuth();
  }, [user, loading, projectId, router]);

  // Fetch project data
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !projectId || !isAdmin) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching project data: ${projectId}`);
        
        // Project data already loaded in checkAuth
        
        console.log(`[${traceId}] Fetched project data successfully`);
      } catch (err: any) {
        console.error('Error fetching project data:', err.message);
        setError('Failed to load project data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, projectId, isAdmin]);
  
  // Handler to update project details (name and description)
  const handleUpdateProjectName = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editedProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }

    const hasNameChanged = editedProjectName !== project?.name;
    const hasDescriptionChanged = editedProjectDescription !== (project?.description || '');
    
    if (!hasNameChanged && !hasDescriptionChanged) {
      return; // No changes, don't submit
    }
    
    setIsSubmittingName(true);
    setError(null);
    setNameUpdateSuccess(false);
    
    // Store original values for rollback if needed
    const originalName = project?.name || '';
    const originalDescription = project?.description || '';
    
    // Optimistic update
    setProject(prev => prev ? { 
      ...prev, 
      name: editedProjectName,
      description: editedProjectDescription || null
    } : null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating project details for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to update project details
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: editedProjectName,
          description: editedProjectDescription || null
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project details');
      }
      
      const { data } = await response.json();
      
      // Update project state with server response
      setProject(data);
      
      // Show success message
      setNameUpdateSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setNameUpdateSuccess(false);
      }, 3000);
      
      console.log(`[${traceId}] Project details updated successfully`);
    } catch (err: any) {
      console.error('Error updating project details:', err.message);
      setError('Failed to update project details. Please try again.');
      
      // Rollback optimistic update
      setProject(prev => prev ? { 
        ...prev, 
        name: originalName,
        description: originalDescription || null
      } : null);
      setEditedProjectName(originalName);
      setEditedProjectDescription(originalDescription);
    } finally {
      setIsSubmittingName(false);
    }
  };

  // Handler to delete the project
  const handleDeleteProject = async () => {
    if (!projectId || !project) return;
    
    const confirmMessage = `Are you sure you want to delete "${project.name}"? This will permanently delete all tasks, states, workflows, and other project data. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to delete project
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete project');
      }
      
      console.log(`[${traceId}] Project deleted successfully`);
      
      // Redirect to projects list with success message
      router.push('/projects?deleted=true');
    } catch (err: any) {
      console.error('Error deleting project:', err.message);
      setError('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (loading || isLoading) {
    return (
      <Page title="Project Settings">
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
    <Page title={`${project?.name} - Project Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Project Settings
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Configure states, workflows, and task types for {project?.name}
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
          >
            Back to Project
          </Link>
        </div>
        
        {/* Settings Navigation */}
        <div className="flex space-x-4 mb-6">
          <Link
            href={`/projects/${projectId}/settings`}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            General
          </Link>
          <Link
            href={`/projects/${projectId}/settings/members`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Members
          </Link>
          <Link
            href={`/projects/${projectId}/settings/fields`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Fields
          </Link>
          <Link
            href={`/projects/${projectId}/settings/workflows`}
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Workflows
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Settings sections */}
        <div className="space-y-8">
          {/* Project Details Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Project Details</h3>
            <form onSubmit={handleUpdateProjectName} className="mb-4">
              <div className="mb-3">
                <label htmlFor="projectName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Name
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    id="projectName"
                    value={editedProjectName}
                    onChange={(e) => setEditedProjectName(e.target.value)}
                    className="flex-grow p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600 mr-2"
                    placeholder="Enter project name"
                    required
                  />
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="projectDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Description
                </label>
                <textarea
                  id="projectDescription"
                  value={editedProjectDescription}
                  onChange={(e) => setEditedProjectDescription(e.target.value)}
                  className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  placeholder="Enter project description (optional)"
                  rows={3}
                />
              </div>
              <div className="flex items-center">
                <button
                  type="submit"
                  disabled={
                    isSubmittingName || 
                    !editedProjectName.trim() || 
                    (editedProjectName === project?.name && editedProjectDescription === (project?.description || ''))
                  }
                  className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmittingName ? "Saving..." : "Save Changes"}
                </button>
              </div>
              {nameUpdateSuccess && (
                <p className="text-green-500 text-sm my-2">
                  Project details updated successfully
                </p>
              )}
            </form>
          </div>

          {/* Delete Project Section - Only show to project owners */}
          {(userRole === 'owner' || user?.app_metadata?.role === 'admin') && (
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm border border-red-200 dark:border-red-800">
              <h3 className="font-medium mb-2 text-red-800 dark:text-red-300">Danger Zone</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Deleting a project is permanent and cannot be undone. This will delete all tasks, states, workflows, members, and other project data.
              </p>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          )}
        </div>
      </Section>
    </Page>
  );
};

export default ProjectSettings;