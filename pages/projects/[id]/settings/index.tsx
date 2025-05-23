'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { Project, ProjectState, Workflow, TaskType } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// Import workflow components
import StateListEditor from '@/components/workflows/StateListEditor';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import TaskTypeForm from '@/components/workflows/TaskTypeForm';

const ProjectSettings = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, loading } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [states, setStates] = useState<ProjectState[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState('');
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState('');
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
            const { data: projectData } = await supabase
              .from('projects')
              .select('*')
              .eq('id', projectId)
              .single();
              
            if (!projectData) {
              router.replace('/projects');
              return;
            }
            
            const userIsOwner = projectData.user_id === user.id;
            const userIsAdmin = user.app_metadata?.role === 'admin';
            
            if (!userIsOwner && !userIsAdmin) {
              router.replace(`/projects/${projectId}`);
              return;
            }
            
            setIsAdmin(true);
            setProject(projectData);
            setEditedProjectName(projectData.name);
            setEditedProjectName(projectData.name); // Initialize edited project name
          } catch (err) {
            router.replace('/projects');
          }
        }
      }
    };
    
    checkAuth();
  }, [user, loading, projectId, router]);

  // Fetch states, workflows, and task types for the project
  useEffect(() => {
    const fetchData = async () => {
      if (!user || !projectId || !isAdmin) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching workflow data for project: ${projectId}`);
        
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        // Fetch project states
        const { data: statesData, error: statesError } = await supabase
          .from('project_states')
          .select('*')
          .eq('project_id', projectId)
          .order('position');
          
        if (statesError) throw statesError;
        setStates(statesData || []);
        
        // Fetch workflows
        const { data: workflowsData, error: workflowsError } = await supabase
          .from('workflows')
          .select('*')
          .eq('project_id', projectId);
          
        if (workflowsError) throw workflowsError;
        setWorkflows(workflowsData || []);
        
        // Fetch task types
        const { data: taskTypesData, error: taskTypesError } = await supabase
          .from('task_types')
          .select('*')
          .eq('project_id', projectId);
          
        if (taskTypesError) throw taskTypesError;
        setTaskTypes(taskTypesData || []);
        
        console.log(`[${traceId}] Fetched workflow data successfully`);
      } catch (err: any) {
        console.error('Error fetching workflow data:', err.message);
        setError('Failed to load workflow data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, projectId, isAdmin]);

  // Handler to update states
  const handleStatesChange = (updatedStates: ProjectState[]) => {
    setStates(updatedStates);
  };

  // Handler to update workflows
  const handleWorkflowsChange = (updatedWorkflows: Workflow[]) => {
    setWorkflows(updatedWorkflows);
  };

  // Handler to update task types
  const handleTaskTypesChange = (updatedTaskTypes: TaskType[]) => {
    setTaskTypes(updatedTaskTypes);
  };
  
// Handler to update project name
const handleUpdateProjectName = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!editedProjectName.trim()) {
    setError('Project name cannot be empty');
    return;
  }

  if (editedProjectName === project?.name) {
    return; // No change, don't submit
  }
  
  setIsSubmittingName(true);
  setError(null);
  setNameUpdateSuccess(false);
  
  // Store original name for rollback if needed
  const originalName = project?.name;
  
  // Optimistic update
  setProject(prev => prev ? { ...prev, name: editedProjectName } : null);
  
  try {
    const traceId = uuidv4();
    console.log(`[${traceId}] Updating project name for project: ${projectId}`);
    
    // Get the session token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    // Call API to update project name
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        name: editedProjectName,
        description: project?.description
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update project name');
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
    
    console.log(`[${traceId}] Project name updated successfully`);
  } catch (err: any) {
    console.error('Error updating project name:', err.message);
    setError('Failed to update project name. Please try again.');
    
    // Rollback optimistic update
    setProject(prev => prev ? { ...prev, name: originalName } : null);
    setEditedProjectName(originalName || '');
  } finally {
    setIsSubmittingName(false);
  }
};
  
  // Handler to update project name
  const handleUpdateProjectName = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editedProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }

    if (editedProjectName === project?.name) {
      return; // No change, don't submit
    }
    
    setIsSubmittingName(true);
    setError(null);
    setNameUpdateSuccess(false);
    
    // Store original name for rollback if needed
    const originalName = project?.name;
    
    // Optimistic update
    setProject(prev => prev ? { ...prev, name: editedProjectName } : null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating project name for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to update project name
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `******        },
        body: JSON.stringify({
          name: editedProjectName,
          description: project?.description
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project name');
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
      
      console.log(`[${traceId}] Project name updated successfully`);
    } catch (err: any) {
      console.error('Error updating project name:', err.message);
      setError('Failed to update project name. Please try again.');
      
      // Rollback optimistic update
      setProject(prev => prev ? { ...prev, name: originalName } : null);
      setEditedProjectName(originalName || '');
    } finally {
      setIsSubmittingName(false);
    }
  };
  
  // Handler to update project name
  const handleUpdateProjectName = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editedProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }

    if (editedProjectName === project?.name) {
      return; // No change, don't submit
    }
    
    setIsSubmittingName(true);
    setError(null);
    setNameUpdateSuccess(false);
    
    // Store original name for rollback if needed
    const originalName = project?.name;
    
    // Optimistic update
    setProject(prev => prev ? { ...prev, name: editedProjectName } : null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating project name for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to update project name
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `******        },
        body: JSON.stringify({
          name: editedProjectName,
          description: project?.description
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project name');
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
      
      console.log(`[${traceId}] Project name updated successfully`);
    } catch (err: any) {
      console.error('Error updating project name:', err.message);
      setError('Failed to update project name. Please try again.');
      
      // Rollback optimistic update
      setProject(prev => prev ? { ...prev, name: originalName } : null);
      setEditedProjectName(originalName || '');
    } finally {
      setIsSubmittingName(false);
    }
  };

  // Handler to update project name
  const handleUpdateProjectName = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editedProjectName.trim()) {
      setError('Project name cannot be empty');
      return;
    }

    if (editedProjectName === project?.name) {
      return; // No change, don't submit
    }
    
    setIsSubmittingName(true);
    setError(null);
    setNameUpdateSuccess(false);
    
    // Store original name for rollback if needed
    const originalName = project?.name;
    
    // Optimistic update
    setProject(prev => prev ? { ...prev, name: editedProjectName } : null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Updating project name for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Call API to update project name
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `******        },
        body: JSON.stringify({
          name: editedProjectName,
          description: project?.description
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update project name');
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
      
      console.log(`[${traceId}] Project name updated successfully`);
    } catch (err: any) {
      console.error('Error updating project name:', err.message);
      setError('Failed to update project name. Please try again.');
      
      // Rollback optimistic update
      setProject(prev => prev ? { ...prev, name: originalName } : null);
      setEditedProjectName(originalName || '');
    } finally {
      setIsSubmittingName(false);
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
                  <button
                    type="submit"
                    disabled={isSubmittingName || !editedProjectName.trim() || editedProjectName === project?.name}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmittingName ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
              {nameUpdateSuccess && (
                <p className="text-green-500 text-sm my-2">
                  Project renamed to "{editedProjectName}"
                </p>
              )}
            </form>
          </div>

          {/* States Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">States</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
              Add, rename, or reorder the states that tasks can be in.
            </p>
            <StateListEditor 
              projectId={projectId as string} 
              states={states}
              onStatesChange={handleStatesChange}
            />
          </div>

          {/* Workflows Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Workflows</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
              Create workflows by dragging states into a sequence.
            </p>
            <WorkflowBuilder 
              projectId={projectId as string}
              states={states}
              workflows={workflows}
              onWorkflowsChange={handleWorkflowsChange}
            />
          </div>

          {/* Task Types Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow-sm">
            <h3 className="font-medium mb-4">Task Types</h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
              Define task types and assign each to a specific workflow.
            </p>
            <TaskTypeForm 
              projectId={projectId as string}
              workflows={workflows}
              taskTypes={taskTypes}
              onTaskTypesChange={handleTaskTypesChange}
            />
          </div>
        </div>
      </Section>
    </Page>
  );
};

export default ProjectSettings;