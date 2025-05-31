import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useProjectAdminAuth } from '@/hooks/useProjectAuth';
import { supabase } from '@/utils/supabaseClient';
import { Project, ProjectState, Workflow, TaskType } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// Import workflow components
import StateListEditor from '@/components/workflows/StateListEditor';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import TaskTypeForm from '@/components/workflows/TaskTypeForm';

const WorkflowSettings = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  
  // Use the new auth hook for admin access
  const { isLoading, isAdmin, project, error: authError } = useProjectAdminAuth(projectId);
  
  const [states, setStates] = useState<ProjectState[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch states, workflows, and task types for the project
  useEffect(() => {
    const fetchData = async () => {
      if (!isAdmin || !projectId) return;

      setDataLoading(true);
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
        setDataLoading(false);
      }
    };

    fetchData();
  }, [projectId, isAdmin]);

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

  // Loading state
  if (isLoading || dataLoading) {
    return (
      <Page title="Workflow Settings">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        </Section>
      </Page>
    );
  }

  // Error state
  if (authError || error) {
    return (
      <Page title="Workflow Settings">
        <Section>
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">
              {authError || error}
            </p>
          </div>
        </Section>
      </Page>
    );
  }

  // Not authorized state
  if (!isAdmin) {
    return null; // Already redirected by useProjectAdminAuth
  }

  return (
    <Page title={`${project?.name} - Workflow Settings`}>
      <Section>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Workflow Settings
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
            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
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
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Workflows
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Settings sections */}
        <div className="space-y-8">
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

export default WorkflowSettings;