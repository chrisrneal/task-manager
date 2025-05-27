'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Page from '@/components/page';
import Section from '@/components/section';
import TaskForm from '@/components/TaskForm';
import { KanbanView } from '@/components/kanban';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { Project, Task, TaskWithFieldValues, ProjectState, TaskType, Workflow, WorkflowStep, WorkflowTransition, TaskFieldValue } from '@/types/database';
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
  const [workflowStates, setWorkflowStates] = useState<{ id: string, name: string }[]>([]);
  
  // View state
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'gantt'>('kanban');
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);
  
  // List view state
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  
  // Handle view transition with animation
  const handleViewChange = (view: 'kanban' | 'list' | 'gantt') => {
    if (view === activeView) return;
    
    setIsViewTransitioning(true);
    setTimeout(() => {
      setActiveView(view);
      setIsViewTransitioning(false);
    }, 150); // Short timeout for the fade-out effect
  };
  
  // Handle sorting in list view
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if the same field is clicked
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Task form state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState<'create' | 'edit'>('create');
  const [currentTask, setCurrentTask] = useState<TaskWithFieldValues | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState(TASK_STATUSES.TODO);
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null);
  const [taskStateId, setTaskStateId] = useState<string | null>(null);
  const [validNextStates, setValidNextStates] = useState<string[]>([]);
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

  // Update workflow states whenever states change
  useEffect(() => {
    if (states.length > 0) {
      setWorkflowStates(states.map(state => ({
        id: state.id,
        name: state.name
      })));
    }
  }, [states]);
  
  // Update valid next states when task type changes (for create mode)
  useEffect(() => {
    if (taskFormMode === 'create' && taskTypeId) {
      // For a new task with a selected type, get the first state of the workflow
      const taskType = taskTypes.find(tt => tt.id === taskTypeId);
      if (taskType) {
        const firstState = getFirstWorkflowState(taskType.workflow_id);
        if (firstState) {
          setValidNextStates([firstState.id]);
          // Auto-select the first state
          setTaskStateId(firstState.id);
        } else {
          setValidNextStates([]);
        }
      }
    }
  }, [taskFormMode, taskTypeId, taskTypes]);

  // Handle opening the task modal for creating a new task
  const handleAddTask = () => {
    setTaskFormMode('create');
    setCurrentTask(null);
    setTaskTypeId(null);
    setTaskStateId(null);
    // For new tasks, we'll set valid states later when a task type is selected
    setValidNextStates([]);
    setIsTaskModalOpen(true);
  };

  // Handle opening the task modal for editing a task
  const handleEditTask = async (task: Task) => {
    setTaskFormMode('edit');
    setCurrentTask({...task, field_values: []});
    setTaskTypeId(task.task_type_id);
    setTaskStateId(task.state_id);
    
    // Calculate valid next states for this task based on workflow transitions
    const nextStates = getNextValidStates(task);
    setValidNextStates(nextStates.map(state => state.id));
    
    // If task has a type, fetch its field values
    if (task.task_type_id) {
      try {
        // Get the session token
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const response = await fetch(`/api/tasks/${task.id}/field-values`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error fetching field values: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update the current task with the field values
        setCurrentTask({
          ...task,
          field_values: result.data || []
        });

        // Ensure task type and state are set correctly for the task form
        console.log('Editing task with type:', task.task_type_id, 'and state:', task.state_id);
      } catch (err: any) {
        console.error('Error fetching task field values:', err.message);
        // Continue with the modal even if field values can't be fetched
      }
    }
    
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

  // Get sorted and filtered tasks for list view
  const getSortedFilteredTasks = () => {
    // Apply text filter
    let filteredTasks = tasks;
    
    if (filterText.trim()) {
      filteredTasks = filteredTasks.filter(task => 
        task.name.toLowerCase().includes(filterText.toLowerCase()) || 
        (task.description && task.description.toLowerCase().includes(filterText.toLowerCase()))
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      filteredTasks = filteredTasks.filter(task => {
        if (task.state_id) {
          const state = states.find(s => s.id === task.state_id);
          return state && state.id === statusFilter;
        } else {
          // For tasks without a state_id, match against legacy status
          return task.status === statusFilter;
        }
      });
    }
    
    // Apply type filter
    if (typeFilter) {
      filteredTasks = filteredTasks.filter(task => task.task_type_id === typeFilter);
    }
    
    // Sort filtered tasks
    return [...filteredTasks].sort((a, b) => {
      let valueA, valueB;
      
      // Extract the values based on the sort field
      switch (sortField) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'status':
          // Use the state name if available, otherwise use the status
          valueA = a.state_id 
            ? (states.find(s => s.id === a.state_id)?.name || '').toLowerCase() 
            : a.status.toLowerCase();
          valueB = b.state_id 
            ? (states.find(s => s.id === b.state_id)?.name || '').toLowerCase() 
            : b.status.toLowerCase();
          break;
        case 'priority':
          // Convert priority to numeric value for sorting
          const priorityMap: { [key: string]: number } = {
            'low': 1,
            'medium': 2, 
            'high': 3
          };
          valueA = priorityMap[a.priority] || 0;
          valueB = priorityMap[b.priority] || 0;
          break;
        case 'due_date':
          // Handle null dates
          valueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          valueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          break;
        case 'type':
          // Get task type names
          valueA = a.task_type_id 
            ? (taskTypes.find(tt => tt.id === a.task_type_id)?.name || '').toLowerCase() 
            : '';
          valueB = b.task_type_id 
            ? (taskTypes.find(tt => tt.id === b.task_type_id)?.name || '').toLowerCase() 
            : '';
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }
      
      // Sort based on direction
      const result = sortField === 'priority' || sortField === 'due_date'
        ? (valueA as number) - (valueB as number)  // Numeric comparison
        : String(valueA).localeCompare(String(valueB)); // String comparison
      
      return sortDirection === 'asc' ? result : -result;
    });
  };

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

          {/* View Tabs */}
          <div className="flex border-b border-gray-200 dark:border-zinc-700 mb-4 overflow-x-auto">
            <button
              onClick={() => handleViewChange('kanban')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeView === 'kanban'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => handleViewChange('list')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeView === 'list'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              List
            </button>
            <button
              onClick={() => handleViewChange('gantt')}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                activeView === 'gantt'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Gantt
            </button>
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Task List with Transition Effect */}
          <div className={`space-y-6 transition-opacity duration-150 ${isViewTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            {/* Kanban View */}
            {activeView === 'kanban' && (
              <KanbanView
                states={states}
                tasks={tasks}
                taskTypes={taskTypes}
                groupedTasks={groupedTasks}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleDragOver={handleDragOver}
                handleDrop={handleDrop}
                validDropStates={validDropStates}
                draggedTaskId={draggedTaskId}
                handleDeleteTask={handleDeleteTask}
                handleToggleTaskStatus={handleToggleTaskStatus}
                getNextValidStates={getNextValidStates}
                TASK_STATUSES={TASK_STATUSES}
              />
            )}

            {/* List View */}
            {activeView === 'list' && (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                {/* Filter inputs */}
                <div className="mb-4 px-4 sm:px-0">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Text filter */}
                    <div className="relative sm:w-64">
                      <input
                        type="text"
                        placeholder="Filter tasks..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-zinc-200"
                        aria-label="Filter tasks by text"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400 dark:text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      {filterText && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <button 
                            onClick={() => setFilterText('')}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            aria-label="Clear filter"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status filter */}
                    <div className="sm:w-48">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full py-2 px-3 border border-gray-300 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-zinc-200"
                        aria-label="Filter by status"
                      >
                        <option value="">All Statuses</option>
                        {states.map(state => (
                          <option key={state.id} value={state.id}>{state.name}</option>
                        ))}
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>

                    {/* Type filter */}
                    <div className="sm:w-48">
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="w-full py-2 px-3 border border-gray-300 dark:border-zinc-700 rounded-md dark:bg-zinc-800 dark:text-zinc-200"
                        aria-label="Filter by type"
                      >
                        <option value="">All Types</option>
                        {taskTypes.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reset filters button */}
                    {(filterText || statusFilter || typeFilter) && (
                      <button
                        onClick={() => {
                          setFilterText('');
                          setStatusFilter('');
                          setTypeFilter('');
                        }}
                        className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded-md text-gray-700 dark:text-zinc-300"
                        aria-label="Reset all filters"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                    <thead className="bg-gray-50 dark:bg-zinc-800">
                      <tr>
                        <th 
                          scope="col" 
                          className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                          onClick={() => handleSort('name')}
                          aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <div className="flex items-center">
                            <span>Task</span>
                            {sortField === 'name' && (
                              <span className="ml-1" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                          onClick={() => handleSort('status')}
                          aria-sort={sortField === 'status' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <div className="flex items-center">
                            <span>Status</span>
                            {sortField === 'status' && (
                              <span className="ml-1" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                          onClick={() => handleSort('priority')}
                          aria-sort={sortField === 'priority' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <div className="flex items-center">
                            <span>Priority</span>
                            {sortField === 'priority' && (
                              <span className="ml-1" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="hidden sm:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                          onClick={() => handleSort('due_date')}
                          aria-sort={sortField === 'due_date' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <div className="flex items-center">
                            <span>Due Date</span>
                            {sortField === 'due_date' && (
                              <span className="ml-1" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="hidden md:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700"
                          onClick={() => handleSort('type')}
                          aria-sort={sortField === 'type' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <div className="flex items-center">
                            <span>Type</span>
                            {sortField === 'type' && (
                              <span className="ml-1" aria-hidden="true">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th scope="col" className="relative px-3 sm:px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-800">
                      {getSortedFilteredTasks().length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-zinc-400">
                            {filterText || statusFilter || typeFilter ? 
                              'No tasks match your filters' : 
                              'No tasks found'}
                          </td>
                        </tr>
                      ) : (
                        getSortedFilteredTasks().map(task => {
                          // Get the state name for this task
                          let statusName = task.status;
                          if (task.state_id) {
                            const state = states.find(s => s.id === task.state_id);
                            if (state) {
                              statusName = state.name;
                            }
                          }
                          
                          // Get the task type
                          let typeName = '';
                          if (task.task_type_id) {
                            const taskType = taskTypes.find(tt => tt.id === task.task_type_id);
                            if (taskType) {
                              typeName = taskType.name;
                            }
                          }
                          
                          return (
                            <tr key={task.id}>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  <Link href={`/tasks/${task.id}`}>
                                    {task.name}
                                  </Link>
                                </div>
                                {task.description && (
                                  <div className="text-sm text-gray-500 dark:text-zinc-400 truncate max-w-xs">
                                    {task.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-zinc-300">
                                  {statusName}
                                </span>
                              </td>
                              <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                                <span className={`capitalize ${
                                  task.priority === 'high' 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : task.priority === 'medium'
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-green-600 dark:text-green-400'
                                }`}>
                                  {task.priority}
                                </span>
                              </td>
                              <td className="hidden sm:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">
                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                              </td>
                              <td className="hidden md:table-cell px-3 sm:px-6 py-4 whitespace-nowrap">
                                {typeName ? (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300">
                                    {typeName}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-500 dark:text-zinc-400">-</span>
                                )}
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleEditTask(task)}
                                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gantt View (Placeholder) */}
            {activeView === 'gantt' && (
              <div className="bg-white dark:bg-zinc-800 rounded-md p-8 text-center">
                <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">Gantt View Coming Soon</h3>
                <p className="text-zinc-500 dark:text-zinc-400">
                  We&apos;re working on a timeline view to help you visualize task schedules and dependencies.
                </p>
                <div className="mt-6 p-4 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md">
                  <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                    The Gantt view will include:
                  </p>
                  <ul className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm text-left list-disc pl-5">
                    <li>Timeline visualization of tasks</li>
                    <li>Task dependencies and relationships</li>
                    <li>Critical path identification</li>
                    <li>Resource allocation overview</li>
                    <li>Drag-and-drop scheduling</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Task Modal */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium mb-4">
                {taskFormMode === 'create' ? 'Add New Task' : 'Edit Task'}
              </h3>
              
              <TaskForm
                mode={taskFormMode}
                projectId={projectId as string}
                taskTypeId={taskTypeId}
                stateId={taskStateId}
                initialValues={currentTask || undefined}
                taskTypes={taskTypes}
                workflowStates={workflowStates}
                validNextStates={validNextStates}
                allowEditing={true}
                onSubmit={async (task) => {
                  try {
                    // Start submission
                    setIsSubmitting(true);
                    setError(null);
                    
                    const traceId = uuidv4();
                    const isEditing = taskFormMode === 'edit' && currentTask;
                    console.log(`[${traceId}] ${isEditing ? 'Updating' : 'Creating'} task: ${task.name}`);
                    
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
                      name: task.name,
                      description: task.description || null,
                      project_id: projectId as string,
                      owner_id: user.id,
                      status: task.status,
                      priority: task.priority,
                      due_date: task.due_date || null,
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
                        name: task.name,
                        description: task.description || null,
                        project_id: projectId,
                        status: task.status,
                        priority: task.priority,
                        due_date: task.due_date || null,
                        task_type_id: task.task_type_id,
                        state_id: task.state_id,
                        field_values: task.field_values
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
                }}
                onCancel={() => setIsTaskModalOpen(false)}
              />
            </div>
          </div>
        )}
      </Section>
    </Page>
  );
};

export default ProjectDetail;