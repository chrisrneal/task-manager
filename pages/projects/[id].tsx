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

// Placeholder UUID for "any state" transitions
const ANY_STATE_UUID = '00000000-0000-0000-0000-000000000000';

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
    
    const workflowStates = getWorkflowStates(workflow.id);
    const workflowStatesMap = workflowStates.reduce((map, state) => {
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

    // Get the transitions for this workflow
    const transitions = workflowTransitions.filter(t => t.workflow_id === workflow.id);

    // Find valid transitions from current state
    const validTransitions = transitions.filter(t => 
      // From the current state
      t.from_state === task.state_id || 
      // Or from "any state" (using placeholder UUID or NULL)
      t.from_state === ANY_STATE_UUID || t.from_state === null
    );

    // Always allow staying in the current state
    const currentState = workflowStates.find(s => s.id === task.state_id);
    const validStates = currentState ? [currentState] : [];

    // Add all allowed destination states
    validTransitions.forEach(transition => {
      const destinationState = workflowStates.find(s => s.id === transition.to_state);
      if (destinationState && !validStates.some(s => s.id === destinationState.id)) {
        validStates.push(destinationState);
      }
    });

    // If no transitions found (including ANY state transitions), 
    // fallback to allowing the next sequential state
    if (validStates.length === 1 && currentState) {
      const currentStateIndex = workflowStates.findIndex(s => s.id === task.state_id);
      if (currentStateIndex !== -1 && currentStateIndex < workflowStates.length - 1) {
        validStates.push(workflowStates[currentStateIndex + 1]);
      }
    }

    return validStates;
  };

  // ...rest of the code unchanged...
  // (The rest of the code after getNextValidStates stays as in your provided file)

  // ⬆️ Leave all code after this point as is (from your original file) ⬆️

  // (for brevity, not duplicating the rest, as only the conflict was resolved above)
};

export default ProjectDetail;