'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { Project, Task, ProjectState, TaskType, Workflow, WorkflowStep, WorkflowTransition } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

// Task statuses for organization (legacy, kept for fallback)
const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done'
};

const ProjectDetail = () => {
  const router = useRouter();
  const { id: projectId } = router.query;
  const { user, loading } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Workflow related state
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [states, setStates] = useState<ProjectState[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowTransition[]>([]);
  
  // Task form state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState<'create' | 'edit'>('create');
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState(TASK_STATUSES.TODO);
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null);
  const [taskStateId, setTaskStateId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth protection
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch project workflow data (task types, workflows, states)
  const fetchProjectWorkflowData = React.useCallback(async () => {
    if (!user || !projectId) return;

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Fetching workflow data for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Fetch task types for this project
      const { data: taskTypesData, error: taskTypesError } = await supabase
        .from('task_types')
        .select('*')
        .eq('project_id', projectId);

      if (taskTypesError) throw taskTypesError;
      
      setTaskTypes(taskTypesData || []);
      
      // Fetch workflows for this project
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('workflows')
        .select('*')
        .eq('project_id', projectId);

      if (workflowsError) throw workflowsError;
      
      setWorkflows(workflowsData || []);
      
      // Fetch project states
      const { data: statesData, error: statesError } = await supabase
        .from('project_states')
        .select('*')
        .eq('project_id', projectId)
        .order('position');

      if (statesError) throw statesError;
      
      setStates(statesData || []);
      
      // Fetch workflow steps
      if (workflowsData && workflowsData.length > 0) {
        const workflowIds = workflowsData.map(w => w.id);
        
        const { data: stepsData, error: stepsError } = await supabase
          .from('workflow_steps')
          .select('*')
          .in('workflow_id', workflowIds)
          .order('step_order');
          
        if (stepsError) throw stepsError;
        
        setWorkflowSteps(stepsData || []);

        // Fetch workflow transitions
        const { data: transitionsData, error: transitionsError } = await supabase
          .from('workflow_transitions')
          .select('*')
          .in('workflow_id', workflowIds);

        if (transitionsError) throw transitionsError;
        
        setWorkflowTransitions(transitionsData || []);
      }
      
      console.log(`[${traceId}] Workflow data fetched successfully`);
    } catch (err: any) {
      console.error('Error fetching workflow data:', err.message);
      setError('Failed to load workflow data');
    }
  }, [user, projectId]);

  // Get states for a specific workflow
  const getWorkflowStates = (workflowId: string): ProjectState[] => {
    const steps = workflowSteps.filter(step => step.workflow_id === workflowId)
      .sort((a, b) => a.step_order - b.step_order);
    
    return steps.map(step => {
      const state = states.find(s => s.id === step.state_id);
      return state!;
    }).filter(Boolean);
  };

  // Get the workflow for a specific task type
  const getTaskTypeWorkflow = (taskTypeId: string | null): Workflow | null => {
    if (!taskTypeId) return null;
    
    const taskType = taskTypes.find(tt => tt.id === taskTypeId);
    if (!taskType) return null;
    
    return workflows.find(w => w.id === taskType.workflow_id) || null;
  };

  // Get the first state for a workflow
  const getFirstWorkflowState = (workflowId: string): ProjectState | null => {
    const workflowStates = getWorkflowStates(workflowId);
    return workflowStates.length > 0 ? workflowStates[0] : null;
  };

  // Get the next valid states for a task
  const getNextValidStates = (task: Task, forDragAndDrop: boolean = false): ProjectState[] => {
    if (!task.task_type_id) return states;
    
    const taskType = taskTypes.find(tt => tt.id === task.task_type_id);
    if (!taskType) return states;
    
    const workflow = workflows.find(w => w.id === taskType.workflow_id);
    if (!workflow) return states;
    
    const workflowStatesMap = getWorkflowStates(workflow.id)
      .reduce((map, state) => {
        map[state.id] = state;
        return map;
      }, {} as Record<string, ProjectState>);
    
    // If task doesn't have a state, first state is valid
    if (!task.state_id) {
      const firstState = Object.values(workflowStatesMap).length > 0 
        ? [Object.values(workflowStatesMap)[0]] 
        : [];
      return firstState;
    }
    
    // For drag and drop, use workflow transitions to determine valid target states
    const validStates: ProjectState[] = [];
    
    // Always include the current state
    if (workflowStatesMap[task.state_id]) {
      validStates.push(workflowStatesMap[task.state_id]);
    }
    
    // Get all valid transitions for this workflow
    const relevantTransitions = workflowTransitions.filter(t => 
      t.workflow_id === workflow.id && 
      (t.from_state === task.state_id || t.from_state === null)
    );
    
    // Add all valid transition target states
    relevantTransitions.forEach(transition => {
      if (workflowStatesMap[transition.to_state] && 
          !validStates.some(s => s.id === transition.to_state)) {
        validStates.push(workflowStatesMap[transition.to_state]);
      }
    });
    
    return validStates;
  };

  // Fetch tasks for the project
  const fetchTasks = React.useCallback(async () => {
    if (!user || !projectId) return;

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Fetching tasks for project: ${projectId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/tasks?projectId=${projectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[${traceId}] Fetched ${result.data.length} tasks successfully`);
      setTasks(result.data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err.message);
      setError('Failed to load tasks');
    }
  }, [user, projectId]);

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      if (!user || !projectId) return;

      setIsLoading(true);
      setError(null);
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching project details for: ${projectId}`);
        
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setProject(null);
            setError('Project not found');
            throw new Error('Project not found');
          }
          throw new Error(`Error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[${traceId}] Fetched project successfully`);
        setProject(result.data);

        // Now fetch tasks for this project
        await fetchTasks();
      } catch (err: any) {
        console.error('Error fetching project:', err.message);
        if (err.message !== 'Project not found') {
          setError('Failed to load project');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (user && projectId) {
      fetchProject();
    }
  }, [user, projectId, fetchTasks]);

  // Subscribe to realtime updates for tasks
  useEffect(() => {
    if (!user || !projectId) return;
    
    console.log('Setting up realtime subscription for tasks...');
    
    // Subscribe to task changes
    const subscription = supabase
      .channel(`tasks:project_id=eq.${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        console.log('Realtime task update:', payload);
        
        // Handle different events
        switch (payload.eventType) {
          case 'INSERT':
            // Only add if it's not already in the list (prevent duplication with optimistic updates)
            if (!tasks.some(t => t.id === payload.new.id)) {
              setTasks(prev => [payload.new as Task, ...prev]);
            }
            break;
          case 'UPDATE':
            setTasks(prev => prev.map(t => 
              t.id === payload.new.id ? payload.new as Task : t
            ));
            break;
          case 'DELETE':
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
            break;
        }
      })
      .subscribe();
    
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, projectId, tasks]);

  // Fetch workflow data when the project is loaded
  useEffect(() => {
    if (user && projectId && project) {
      fetchProjectWorkflowData();
    }
  }, [user, projectId, project, fetchProjectWorkflowData]);

  // Handle opening the task modal for creating a new task
  const handleAddTask = () => {
    setTaskFormMode('create');
    setCurrentTask(null);
    setTaskName('');
    setTaskDescription('');
    setTaskStatus(TASK_STATUSES.TODO);
    setTaskPriority('medium');
    setTaskDueDate('');
    setTaskTypeId(null);
    setTaskStateId(null);
    setIsTaskModalOpen(true);
  };

  // Handle opening the task modal for editing a task
  const handleEditTask = (task: Task) => {
    setTaskFormMode('edit');
    setCurrentTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || '');
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskDueDate(task.due_date || '');
    setTaskTypeId(task.task_type_id);
    setTaskStateId(task.state_id);
    setIsTaskModalOpen(true);
  };

  // Handle change of task type
  const handleTaskTypeChange = (newTaskTypeId: string) => {
    setTaskTypeId(newTaskTypeId);
    
    // When task type changes, reset the state to the first state of the workflow
    const taskType = taskTypes.find(tt => tt.id === newTaskTypeId);
    if (taskType) {
      const firstState = getFirstWorkflowState(taskType.workflow_id);
      setTaskStateId(firstState?.id || null);
    } else {
      setTaskStateId(null);
    }
  };

  // Handle form submission for creating/editing a task
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !projectId) return;
    if (!taskName.trim()) {
      setError('Task name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      const isEditing = taskFormMode === 'edit' && currentTask;
      console.log(`[${traceId}] ${isEditing ? 'Updating' : 'Creating'} task: ${taskName}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // First add optimistically to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticTask: Task = {
        id: isEditing ? currentTask!.id : tempId,
        name: taskName,
        description: taskDescription || null,
        project_id: projectId as string,
        owner_id: user.id,
        status: taskStatus,
        priority: taskPriority,
        due_date: taskDueDate || null,
        created_at: isEditing ? currentTask!.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task_type_id: taskTypeId,
        state_id: taskStateId
      };
      
      if (isEditing) {
        // Replace the existing task in the list
        setTasks(prev => prev.map(t => t.id === currentTask!.id ? optimisticTask : t));
      } else {
        // Add the new task to the list
        setTasks(prev => [optimisticTask, ...prev]);
      }
      
      // Then save to the database via API
      const endpoint = isEditing ? `/api/tasks/${currentTask!.id}` : '/api/tasks';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: taskName,
          description: taskDescription || null,
          project_id: projectId,
          status: taskStatus,
          priority: taskPriority,
          due_date: taskDueDate || null,
          task_type_id: taskTypeId,
          state_id: taskStateId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[${traceId}] Task ${isEditing ? 'updated' : 'created'} successfully: ${result.data.id}`);
      
      if (!isEditing) {
        // Replace the temporary item with the real one
        setTasks(prev => prev.map(t => t.id === tempId ? result.data : t));
      }
      
      // Close the modal and reset form
      setIsTaskModalOpen(false);
      setTaskName('');
      setTaskDescription('');
      setTaskStatus(TASK_STATUSES.TODO);
      setTaskPriority('medium');
      setTaskDueDate('');
      setTaskTypeId(null);
      setTaskStateId(null);
      setCurrentTask(null);
    } catch (err: any) {
      // Revert the optimistic update
      if (taskFormMode === 'edit' && currentTask) {
        setTasks(prev => prev.map(t => t.id === currentTask.id ? currentTask : t));
      } else {
        setTasks(prev => prev.filter(t => !t.id.toString().startsWith('temp-')));
      }
      
      setError('Failed to save task. Please try again.');
      console.error('Error saving task:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a task
  const handleDeleteTask = async (taskId: string) => {
    if (!user || !projectId) return;

    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting task: ${taskId}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Remove optimistically from the UI
      const taskToDelete = tasks.find(t => t.id === taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Then delete from the database
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      console.log(`[${traceId}] Task deleted successfully`);
    } catch (err: any) {
      // Restore the deleted task if there was an error
      setTasks(prev => [...prev, tasks.find(t => t.id === taskId)!].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      
      setError('Failed to delete task. Please try again.');
      console.error('Error deleting task:', err.message);
    }
  };

  // Handle marking a task as done/undone
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user || !projectId) return;

    const newStatus = currentStatus === TASK_STATUSES.DONE ? TASK_STATUSES.TODO : TASK_STATUSES.DONE;

    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Toggling task ${taskId} status from ${currentStatus} to ${newStatus}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Get the task to update
      const taskToUpdate = tasks.find(t => t.id === taskId);
      if (!taskToUpdate) {
        throw new Error('Task not found');
      }

      // Update optimistically in the UI
      const updatedTask = { ...taskToUpdate, status: newStatus, updated_at: new Date().toISOString() };
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      // Then update in the database
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: taskToUpdate.name,
          description: taskToUpdate.description,
          status: newStatus,
          priority: taskToUpdate.priority,
          due_date: taskToUpdate.due_date
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      console.log(`[${traceId}] Task status updated successfully`);
    } catch (err: any) {
      // Revert the optimistic update if there was an error
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return { ...t, status: currentStatus };
        }
        return t;
      }));
      
      setError('Failed to update task status. Please try again.');
      console.error('Error updating task status:', err.message);
    }
  };

  // Group tasks by state
  const groupTasksByState = () => {
    // If no workflow data is available yet, use legacy status grouping
    if (states.length === 0) {
      return {
        [TASK_STATUSES.TODO]: tasks.filter(task => task.status === TASK_STATUSES.TODO),
        [TASK_STATUSES.IN_PROGRESS]: tasks.filter(task => task.status === TASK_STATUSES.IN_PROGRESS),
        [TASK_STATUSES.DONE]: tasks.filter(task => task.status === TASK_STATUSES.DONE)
      };
    }
    
    // Group by state_id
    const grouped: Record<string, Task[]> = {};
    
    // Initialize all states with empty arrays
    states.forEach(state => {
      grouped[state.id] = [];
    });
    
    // Add tasks to their respective state groups
    tasks.forEach(task => {
      if (task.state_id && grouped[task.state_id]) {
        grouped[task.state_id].push(task);
      } else {
        // For tasks without a state, add to first state of its workflow
        // or keep in a separate group for tasks without a workflow
        if (task.task_type_id) {
          const taskType = taskTypes.find(tt => tt.id === task.task_type_id);
          if (taskType) {
            const firstState = getFirstWorkflowState(taskType.workflow_id);
            if (firstState) {
              if (!grouped[firstState.id]) {
                grouped[firstState.id] = [];
              }
              grouped[firstState.id].push(task);
            }
          }
        }
      }
    });
    
    return grouped;
  };

  // State for drag and drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [validDropStates, setValidDropStates] = useState<string[]>([]);
  
  // Handle drag start event
  const handleDragStart = (e: React.DragEvent, taskId: string, stateId: string, taskTypeId: string | null) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      taskId,
      sourceStateId: stateId,
      taskTypeId
    }));
    setDraggedTaskId(taskId);
    
    // Find the task being dragged
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      // Get valid next states for this task using workflow transitions
      const nextStates = getNextValidStates(task, true);
      setValidDropStates(nextStates.map(s => s.id));
    }
    
    e.currentTarget.classList.add('opacity-50');
  };
  
  // Handle drag end event
  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
    setDraggedTaskId(null);
    setValidDropStates([]);
  };
  
  // Handle drag over event
  const handleDragOver = (e: React.DragEvent, stateId: string) => {
    e.preventDefault();
    if (validDropStates.includes(stateId)) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };
  
  // Handle drop event
  const handleDrop = async (e: React.DragEvent, targetStateId: string) => {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { taskId, sourceStateId, taskTypeId } = data;
      
      if (sourceStateId === targetStateId) {
        return; // No change needed
      }
      
      // Find the task being moved
      const taskToMove = tasks.find(t => t.id === taskId);
      if (!taskToMove) return;
      
      // Verify this is a valid transition using workflow transitions
      const validStates = getNextValidStates(taskToMove, true);
      if (!validStates.some(s => s.id === targetStateId)) {
        console.warn('Invalid state transition attempted');
        return;
      }
      
      // Update optimistically in the UI
      const updatedTask = { 
        ...taskToMove,
        state_id: targetStateId,
        updated_at: new Date().toISOString()
      };
      
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      // Then update in the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          name: taskToMove.name,
          description: taskToMove.description,
          status: taskToMove.status,
          priority: taskToMove.priority,
          due_date: taskToMove.due_date,
          state_id: targetStateId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      console.log(`Task ${taskId} moved from state ${sourceStateId} to ${targetStateId}`);
      
    } catch (err: any) {
      console.error('Error moving task:', err.message);
      setError('Failed to move task. Please try again.');
      // Revert the optimistic update
      fetchTasks();
    }
  };

  // Task groups by state
  const groupedTasks = groupTasksByState();

  // Loading and not found states
  if (loading || !user) return null;
  
  if (isLoading) {
    return (
      <Page title="Project Details">
        <Section>
          <div className="text-center py-10">
            <p className="text-zinc-600 dark:text-zinc-400">Loading project...</p>
          </div>
        </Section>
      </Page>
    );
  }

  if (!project && !isLoading) {
    return (
      <Page title="Project Not Found">
        <Section>
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
              Project Not Found
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <button
              onClick={() => router.push('/projects')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Back to Projects
            </button>
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page title={project?.name}>
      <Section>
        {/* Project Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              {project?.name}
            </h2>
            {project?.description && (
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">{project.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <Link
              href={`/projects/${projectId}/settings`}
              className="px-3 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-800/30 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800/50 text-sm"
            >
              Project Settings
            </Link>
            <button
              onClick={() => router.push('/projects')}
              className="px-3 py-1 bg-gray-200 text-gray-800 dark:bg-zinc-700 dark:text-zinc-300 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600 text-sm"
            >
              Back to Projects
            </button>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Tasks</h3>
            <button
              onClick={handleAddTask}
              className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
            >
              Add Task
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Task List */}
          <div className="space-y-6">
            {states.length > 0 ? (
              // Render columns based on workflow states
              <>
                {states.map(state => (
                  <div key={state.id}>
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      {state.name} ({(groupedTasks[state.id] || []).length})
                    </h4>
                    {(groupedTasks[state.id] || []).length === 0 ? (
                      <p 
                        className={`text-zinc-500 dark:text-zinc-500 text-sm italic p-4 border-2 border-dashed rounded-md ${
                          validDropStates.includes(state.id) ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20' : 'border-transparent'
                        }`}
                        onDragOver={(e) => handleDragOver(e, state.id)}
                        onDrop={(e) => handleDrop(e, state.id)}
                      >
                        No tasks in this state
                      </p>
                    ) : (
                      <div 
                        className={`space-y-2 p-2 rounded-md ${
                          validDropStates.includes(state.id) ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-300 dark:border-indigo-700' : ''
                        }`}
                        onDragOver={(e) => handleDragOver(e, state.id)}
                        onDrop={(e) => handleDrop(e, state.id)}
                      >
                        {(groupedTasks[state.id] || []).map(task => (
                          <div
                            key={task.id}
                            className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start cursor-move"
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, task.id, state.id, task.task_type_id)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="flex-grow">
                              <h5 className="font-medium">
                                <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                                  {task.name}
                                </Link>
                              </h5>
                              {task.description && (
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center mt-2 text-xs text-zinc-500">
                                <span className="mr-3">Priority: {task.priority}</span>
                                {task.due_date && (
                                  <span className="mr-3">Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                )}
                                {task.task_type_id && (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded-full text-xs">
                                    {taskTypes.find(tt => tt.id === task.task_type_id)?.name || 'Unknown Type'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center ml-2">
                              <Link href={`/tasks/${task.id}`} className="text-zinc-500 hover:text-blue-500 mr-2" aria-label={`View details for ${task.name}`}>
                                👁️
                              </Link>
                              <button
                                onClick={() => handleEditTask(task)}
                                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mr-2"
                                aria-label={`Edit ${task.name}`}
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-zinc-500 hover:text-red-500"
                                aria-label={`Delete ${task.name}`}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              // Fallback to legacy status columns if no workflow states are defined
              <>
                {/* To Do Tasks */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    To Do ({groupedTasks[TASK_STATUSES.TODO]?.length || 0})
                  </h4>
                  {!groupedTasks[TASK_STATUSES.TODO] || groupedTasks[TASK_STATUSES.TODO].length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No tasks to do</p>
                  ) : (
                    <div 
                      className="space-y-2 todo-drop-zone p-2 rounded-md"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                          const { taskId } = data;
                          const taskToMove = tasks.find(t => t.id === taskId);
                          if (taskToMove && taskToMove.status !== TASK_STATUSES.TODO) {
                            // Check if this transition is valid according to workflow rules
                            const validStates = getNextValidStates(taskToMove, true);
                            const todoState = states.find(s => s.name.toLowerCase().includes('todo') || s.name.toLowerCase().includes('backlog'));
                            
                            // Only allow transition if it's valid in the workflow or if no workflow states defined
                            if (!todoState || validStates.some(s => s.id === todoState.id) || validStates.length === states.length) {
                              handleToggleTaskStatus(taskId, taskToMove.status);
                            } else {
                              console.warn('Invalid workflow transition attempted');
                            }
                          }
                        } catch (err) {
                          console.error('Error in drop handling:', err);
                        }
                      }}
                    >
                      {groupedTasks[TASK_STATUSES.TODO].map(task => (
                        <div
                          key={task.id}
                          className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start cursor-move"
                        >
                          <div className="flex-grow">
                            <h5 className="font-medium">
                              <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                                {task.name}
                              </Link>
                            </h5>
                            {task.description && (
                              <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center mt-2 text-xs text-zinc-500">
                              <span className="mr-3">Priority: {task.priority}</span>
                              {task.due_date && (
                                <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center ml-2">
                            <Link href={`/tasks/${task.id}`} className="text-zinc-500 hover:text-blue-500 mr-2" aria-label={`View details for ${task.name}`}>
                              👁️
                            </Link>
                            <button
                              onClick={() => handleEditTask(task)}
                              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mr-2"
                              aria-label={`Edit ${task.name}`}
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-zinc-500 hover:text-red-500"
                              aria-label={`Delete ${task.name}`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* In Progress Tasks */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    In Progress ({groupedTasks[TASK_STATUSES.IN_PROGRESS]?.length || 0})
                  </h4>
                  {!groupedTasks[TASK_STATUSES.IN_PROGRESS] || groupedTasks[TASK_STATUSES.IN_PROGRESS].length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No tasks in progress</p>
                  ) : (
                    <div 
                      className="space-y-2 inprogress-drop-zone p-2 rounded-md"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                          const { taskId } = data;
                          const taskToMove = tasks.find(t => t.id === taskId);
                          if (taskToMove && taskToMove.status !== TASK_STATUSES.IN_PROGRESS) {
                            // Check if this transition is valid according to workflow rules
                            const validStates = getNextValidStates(taskToMove, true);
                            const inProgressState = states.find(s => s.name.toLowerCase().includes('progress') || s.name.toLowerCase().includes('doing'));
                            
                            // Only allow transition if it's valid in the workflow or if no workflow states defined
                            if (!inProgressState || validStates.some(s => s.id === inProgressState.id) || validStates.length === states.length) {
                              // Update the task to "in progress"
                              const newStatus = TASK_STATUSES.IN_PROGRESS;
                              const updatedTask = { ...taskToMove, status: newStatus, updated_at: new Date().toISOString() };
                              setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
                              
                              // Call API to update
                              // Get the current session token
                              supabase.auth.getSession().then(({ data: sessionData }) => {
                                fetch(`/api/tasks/${taskId}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': 'Bearer ' + sessionData.session?.access_token
                                  },
                                  body: JSON.stringify({
                                  name: taskToMove.name,
                                  description: taskToMove.description,
                                  status: newStatus,
                                  priority: taskToMove.priority,
                                  due_date: taskToMove.due_date
                                })
                              }).catch(err => {
                                console.error('Error updating task status:', err);
                                fetchTasks(); // Revert on error
                              });
                            }).catch(err => {
                              console.error('Error getting session:', err);
                            });
                            } else {
                              console.warn('Invalid workflow transition attempted');
                            }
                          }
                        } catch (err) {
                          console.error('Error in drop handling:', err);
                        }
                      }}
                    >
                      {groupedTasks[TASK_STATUSES.IN_PROGRESS].map(task => (
                        <div
                          key={task.id}
                          className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start cursor-move"
                        >
                          <div className="flex-grow">
                            <h5 className="font-medium">
                              <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                                {task.name}
                              </Link>
                            </h5>
                            {task.description && (
                              <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center mt-2 text-xs text-zinc-500">
                              <span className="mr-3">Priority: {task.priority}</span>
                              {task.due_date && (
                                <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center ml-2">
                            <Link href={`/tasks/${task.id}`} className="text-zinc-500 hover:text-blue-500 mr-2" aria-label={`View details for ${task.name}`}>
                              👁️
                            </Link>
                            <button
                              onClick={() => handleEditTask(task)}
                              className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mr-2"
                              aria-label={`Edit ${task.name}`}
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-zinc-500 hover:text-red-500"
                              aria-label={`Delete ${task.name}`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Done Tasks */}
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Done ({groupedTasks[TASK_STATUSES.DONE]?.length || 0})
                  </h4>
                  {!groupedTasks[TASK_STATUSES.DONE] || groupedTasks[TASK_STATUSES.DONE].length === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-500 text-sm italic">No completed tasks</p>
                  ) : (
                    <div 
                      className="space-y-2 done-drop-zone p-2 rounded-md"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                          const { taskId } = data;
                          const taskToMove = tasks.find(t => t.id === taskId);
                          if (taskToMove && taskToMove.status !== TASK_STATUSES.DONE) {
                            // Check if this transition is valid according to workflow rules
                            const validStates = getNextValidStates(taskToMove, true);
                            const doneState = states.find(s => s.name.toLowerCase().includes('done') || s.name.toLowerCase().includes('complete'));
                            
                            // Only allow transition if it's valid in the workflow or if no workflow states defined
                            if (!doneState || validStates.some(s => s.id === doneState.id) || validStates.length === states.length) {
                              handleToggleTaskStatus(taskId, taskToMove.status);
                            } else {
                              console.warn('Invalid workflow transition attempted');
                            }
                          }
                        } catch (err) {
                          console.error('Error in drop handling:', err);
                        }
                      }}
                    >
                      {groupedTasks[TASK_STATUSES.DONE].map(task => (
                        <div
                          key={task.id}
                          className="border rounded-md p-3 bg-white dark:bg-zinc-800 dark:border-zinc-700 flex items-start cursor-move opacity-70"
                        >
                          <div className="flex-grow">
                            <h5 className="font-medium line-through">
                              <Link href={`/tasks/${task.id}`} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                                {task.name}
                              </Link>
                            </h5>
                            {task.description && (
                              <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1 line-through">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center mt-2 text-xs text-zinc-500">
                              <span className="mr-3">Priority: {task.priority}</span>
                              {task.due_date && (
                                <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center ml-2">
                            <Link href={`/tasks/${task.id}`} className="text-zinc-500 hover:text-blue-500 mr-2" aria-label={`View details for ${task.name}`}>
                              👁️
                            </Link>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-zinc-500 hover:text-red-500"
                              aria-label={`Delete ${task.name}`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Task Modal */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg w-full max-w-md p-6">
              <h3 className="text-lg font-medium mb-4">
                {taskFormMode === 'create' ? 'Add New Task' : 'Edit Task'}
              </h3>
              
              <form onSubmit={handleTaskSubmit}>
                <div className="mb-4">
                  <label htmlFor="taskName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Task Name*
                  </label>
                  <input
                    type="text"
                    id="taskName"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                    placeholder="Enter task name"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="taskDescription" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    id="taskDescription"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="taskStatus" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Status
                  </label>
                  <select
                    id="taskStatus"
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  >
                    <option value={TASK_STATUSES.TODO}>To Do</option>
                    <option value={TASK_STATUSES.IN_PROGRESS}>In Progress</option>
                    <option value={TASK_STATUSES.DONE}>Done</option>
                  </select>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="taskType" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Task Type
                  </label>
                  <select
                    id="taskType"
                    value={taskTypeId || ''}
                    onChange={(e) => handleTaskTypeChange(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  >
                    <option value="">No Type</option>
                    {taskTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {taskTypeId && (
                  <div className="mb-4">
                    <label htmlFor="taskState" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      State
                    </label>
                    <select
                      id="taskState"
                      value={taskStateId || ''}
                      onChange={(e) => setTaskStateId(e.target.value)}
                      className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                    >
                      <option value="">Select State</option>
                      {(() => {
                        // Determine valid states based on the workflow
                        let validStates: ProjectState[] = [];
                        
                        if (taskTypeId) {
                          const taskType = taskTypes.find(tt => tt.id === taskTypeId);
                          if (taskType) {
                            const workflowId = taskType.workflow_id;
                            validStates = getWorkflowStates(workflowId);
                            
                            // For existing task, only allow valid transitions
                            if (taskFormMode === 'edit' && currentTask) {
                              validStates = getNextValidStates(currentTask);
                            }
                          }
                        }
                        
                        return validStates.map(state => (
                          <option key={state.id} value={state.id}>{state.name}</option>
                        ));
                      })()}
                    </select>
                  </div>
                )}
                
                <div className="mb-4">
                  <label htmlFor="taskPriority" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    id="taskPriority"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                
                <div className="mb-6">
                  <label htmlFor="taskDueDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    id="taskDueDate"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full p-2 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                  />
                </div>
                
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md dark:border-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !taskName.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Section>
    </Page>
  );
};

export default ProjectDetail;