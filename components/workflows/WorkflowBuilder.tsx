import React, { useState, useEffect } from 'react';
import { ProjectState, Workflow, WorkflowStep, WorkflowTransition } from '@/types/database';
import { supabase } from '@/utils/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import WorkflowGraphEditor from './WorkflowGraphEditor';
import TransitionListSidebar from './TransitionListSidebar';

interface WorkflowBuilderProps {
  projectId: string;
  states: ProjectState[];
  workflows: Workflow[];
  onWorkflowsChange: (workflows: Workflow[]) => void;
}

interface WorkflowWithSteps extends Workflow {
  steps: WorkflowStep[];
}

const WorkflowBuilder = ({ projectId, states, workflows, onWorkflowsChange }: WorkflowBuilderProps) => {
  const [workflowsWithSteps, setWorkflowsWithSteps] = useState<WorkflowWithSteps[]>([]);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editWorkflowName, setEditWorkflowName] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [availableStates, setAvailableStates] = useState<ProjectState[]>([]);
  const [selectedStates, setSelectedStates] = useState<ProjectState[]>([]);
  const [workflowTransitions, setWorkflowTransitions] = useState<WorkflowTransition[]>([]);
  const [showTransitionEditor, setShowTransitionEditor] = useState(false);

  // Fetch workflow steps for each workflow
  useEffect(() => {
    const fetchWorkflowSteps = async () => {
      if (workflows.length === 0) {
        setWorkflowsWithSteps([]);
        return;
      }
      
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching workflow steps`);
        
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const workflowIds = workflows.map(w => w.id);
        
        const { data: stepsData, error: stepsError } = await supabase
          .from('workflow_steps')
          .select('*')
          .in('workflow_id', workflowIds)
          .order('step_order');
          
        if (stepsError) throw stepsError;
        
        // Group steps by workflow id
        const stepsMap = (stepsData || []).reduce<Record<string, WorkflowStep[]>>((acc, step) => {
          if (!acc[step.workflow_id]) {
            acc[step.workflow_id] = [];
          }
          acc[step.workflow_id].push(step);
          return acc;
        }, {});
        
        // Combine workflows with their steps
        const enrichedWorkflows = workflows.map(workflow => ({
          ...workflow,
          steps: stepsMap[workflow.id] || []
        }));
        
        setWorkflowsWithSteps(enrichedWorkflows);
        
        // If a workflow is selected, update the available and selected states
        if (selectedWorkflow) {
          const workflowSteps = stepsMap[selectedWorkflow] || [];
          const selectedStateIds = workflowSteps.map(step => step.state_id);
          const selected = states.filter(state => selectedStateIds.includes(state.id))
            .sort((a, b) => {
              const aIndex = workflowSteps.findIndex(step => step.state_id === a.id);
              const bIndex = workflowSteps.findIndex(step => step.state_id === b.id);
              return aIndex - bIndex;
            });
          const available = states.filter(state => !selectedStateIds.includes(state.id));
          
          setSelectedStates(selected);
          setAvailableStates(available);
        }
        
        console.log(`[${traceId}] Fetched workflow steps successfully`);
      } catch (err: any) {
        console.error('Error fetching workflow steps:', err.message);
        setError('Failed to load workflow steps');
      }
    };
    
    fetchWorkflowSteps();
  }, [workflows, states, selectedWorkflow]);

  // Fetch workflow transitions when a workflow is selected
  useEffect(() => {
    if (!selectedWorkflow) {
      setWorkflowTransitions([]);
      return;
    }

    const fetchWorkflowTransitions = async () => {
      try {
        const traceId = uuidv4();
        console.log(`[${traceId}] Fetching workflow transitions`);
        
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        
        if (!token) {
          throw new Error('No authentication token available');
        }
        
        const { data: transitionsData, error: transitionsError } = await supabase
          .from('workflow_transitions')
          .select('*')
          .eq('workflow_id', selectedWorkflow);
          
        if (transitionsError) throw transitionsError;
        
        setWorkflowTransitions(transitionsData || []);
        console.log(`[${traceId}] Fetched workflow transitions successfully: ${transitionsData?.length || 0} transitions`);
      } catch (err: any) {
        console.error('Error fetching workflow transitions:', err.message);
        setError('Failed to load workflow transitions');
      }
    };
    
    fetchWorkflowTransitions();
  }, [selectedWorkflow]);

  // Handle workflow selection for editing
  const handleSelectWorkflow = (workflowId: string) => {
    if (selectedWorkflow === workflowId) {
      // Deselect if already selected
      setSelectedWorkflow(null);
      setSelectedStates([]);
      setAvailableStates([...states]);
      setWorkflowTransitions([]);
      setShowTransitionEditor(false);
      return;
    }
    
    setSelectedWorkflow(workflowId);
    
    // Find the workflow and its steps
    const workflow = workflowsWithSteps.find(w => w.id === workflowId);
    if (!workflow) return;
    
    // Set up states for drag and drop
    const selectedStateIds = workflow.steps.map(step => step.state_id);
    const selected = states.filter(state => selectedStateIds.includes(state.id))
      .sort((a, b) => {
        const aIndex = workflow.steps.findIndex(step => step.state_id === a.id);
        const bIndex = workflow.steps.findIndex(step => step.state_id === b.id);
        return aIndex - bIndex;
      });
    const available = states.filter(state => !selectedStateIds.includes(state.id));
    
    setSelectedStates(selected);
    setAvailableStates(available);
  };

  // Toggle transition editor visibility
  const handleToggleTransitionEditor = () => {
    setShowTransitionEditor(!showTransitionEditor);
  };

  // Handle adding a state to the selected workflow
  const handleAddState = async (stateId: string) => {
    if (!selectedWorkflow) return;
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding state ${stateId} to workflow ${selectedWorkflow}`);
      
      // Update UI optimistically
      const stateToAdd = availableStates.find(s => s.id === stateId);
      if (!stateToAdd) return;
      
      const newSelectedStates = [...selectedStates, stateToAdd];
      const newAvailableStates = availableStates.filter(s => s.id !== stateId);
      
      setSelectedStates(newSelectedStates);
      setAvailableStates(newAvailableStates);
      
      // Create workflow step
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: insertError } = await supabase
        .from('workflow_steps')
        .insert([{
          workflow_id: selectedWorkflow,
          state_id: stateId,
          step_order: selectedStates.length // Add to the end
        }]);
      
      if (insertError) throw insertError;
      
      // Update workflowsWithSteps state
      setWorkflowsWithSteps(prev => prev.map(workflow => {
        if (workflow.id === selectedWorkflow) {
          return {
            ...workflow,
            steps: [
              ...workflow.steps,
              {
                workflow_id: selectedWorkflow,
                state_id: stateId,
                step_order: selectedStates.length
              }
            ]
          };
        }
        return workflow;
      }));
      
      console.log(`[${traceId}] State added to workflow successfully`);
    } catch (err: any) {
      // Revert optimistic update
      const stateToAdd = states.find(s => s.id === stateId);
      if (stateToAdd) {
        setSelectedStates(selectedStates.filter(s => s.id !== stateId));
        setAvailableStates([...availableStates, stateToAdd]);
      }
      
      setError('Failed to add state to workflow. Please try again.');
      console.error('Error adding state to workflow:', err.message);
    }
  };

  // Handle removing a state from the selected workflow
  const handleRemoveState = async (stateId: string) => {
    if (!selectedWorkflow) return;
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Removing state ${stateId} from workflow ${selectedWorkflow}`);
      
      // Update UI optimistically
      const stateToRemove = selectedStates.find(s => s.id === stateId);
      if (!stateToRemove) return;
      
      const newSelectedStates = selectedStates.filter(s => s.id !== stateId);
      const newAvailableStates = [...availableStates, stateToRemove];
      
      setSelectedStates(newSelectedStates);
      setAvailableStates(newAvailableStates);
      
      // Remove workflow step
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: deleteError } = await supabase
        .from('workflow_steps')
        .delete()
        .eq('workflow_id', selectedWorkflow)
        .eq('state_id', stateId);
      
      if (deleteError) throw deleteError;
      
      // Update steps order for remaining steps
      const workflow = workflowsWithSteps.find(w => w.id === selectedWorkflow);
      if (workflow) {
        const remainingSteps = workflow.steps.filter(step => step.state_id !== stateId);
        const updatedSteps = remainingSteps.map((step, idx) => ({
          ...step,
          step_order: idx
        }));
        
        const updatePromises = updatedSteps.map(step => 
          supabase
            .from('workflow_steps')
            .update({ step_order: step.step_order })
            .eq('workflow_id', step.workflow_id)
            .eq('state_id', step.state_id)
        );
        
        await Promise.all(updatePromises);
        
        // Update workflowsWithSteps state
        setWorkflowsWithSteps(prev => prev.map(w => {
          if (w.id === selectedWorkflow) {
            return {
              ...w,
              steps: updatedSteps
            };
          }
          return w;
        }));
      }

      // Also delete any transitions involving this state
      const transitions = workflowTransitions.filter(t => 
        t.from_state === stateId || t.to_state === stateId
      );

      if (transitions.length > 0) {
        // Delete transitions from UI optimistically
        setWorkflowTransitions(prev => prev.filter(t => 
          t.from_state !== stateId && t.to_state !== stateId
        ));

        // Delete from database
        const deleteFromPromise = supabase
          .from('workflow_transitions')
          .delete()
          .eq('workflow_id', selectedWorkflow)
          .eq('from_state', stateId);

        const deleteToPromise = supabase
          .from('workflow_transitions')
          .delete()
          .eq('workflow_id', selectedWorkflow)
          .eq('to_state', stateId);

        await Promise.all([deleteFromPromise, deleteToPromise]);
      }
      
      console.log(`[${traceId}] State removed from workflow successfully`);
    } catch (err: any) {
      // Revert optimistic update
      const stateToRemove = states.find(s => s.id === stateId);
      if (stateToRemove) {
        setSelectedStates([...selectedStates, stateToRemove]);
        setAvailableStates(availableStates.filter(s => s.id !== stateId));
      }
      
      setError('Failed to remove state from workflow. Please try again.');
      console.error('Error removing state from workflow:', err.message);
    }
  };

  // Handle reordering states in the selected workflow
  const handleReorderState = async (stateId: string, direction: 'up' | 'down') => {
    if (!selectedWorkflow) return;
    
    const currentIndex = selectedStates.findIndex(s => s.id === stateId);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === selectedStates.length - 1)
    ) {
      return; // Can't move further in this direction
    }
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const updatedStates = [...selectedStates];
    
    // Swap positions
    [updatedStates[currentIndex], updatedStates[newIndex]] = 
      [updatedStates[newIndex], updatedStates[currentIndex]];
    
    // Update UI optimistically
    setSelectedStates(updatedStates);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Reordering states in workflow ${selectedWorkflow}`);
      
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Update step_order for the two affected steps
      const workflow = workflowsWithSteps.find(w => w.id === selectedWorkflow);
      if (workflow) {
        const state1 = updatedStates[currentIndex];
        const state2 = updatedStates[newIndex];
        
        const step1 = workflow.steps.find(s => s.state_id === state1.id);
        const step2 = workflow.steps.find(s => s.state_id === state2.id);
        
        if (step1 && step2) {
          const step1Update = supabase
            .from('workflow_steps')
            .update({ step_order: newIndex })
            .eq('workflow_id', selectedWorkflow)
            .eq('state_id', state1.id);
            
          const step2Update = supabase
            .from('workflow_steps')
            .update({ step_order: currentIndex })
            .eq('workflow_id', selectedWorkflow)
            .eq('state_id', state2.id);
            
          await Promise.all([step1Update, step2Update]);
          
          // Update workflowsWithSteps state
          setWorkflowsWithSteps(prev => prev.map(w => {
            if (w.id === selectedWorkflow) {
              return {
                ...w,
                steps: w.steps.map(step => {
                  if (step.state_id === state1.id) {
                    return { ...step, step_order: newIndex };
                  }
                  if (step.state_id === state2.id) {
                    return { ...step, step_order: currentIndex };
                  }
                  return step;
                })
              };
            }
            return w;
          }));
        }
      }
      
      console.log(`[${traceId}] States reordered in workflow successfully`);
    } catch (err: any) {
      // Revert optimistic update
      const originalStates = [...selectedStates];
      [originalStates[newIndex], originalStates[currentIndex]] = 
        [originalStates[currentIndex], originalStates[newIndex]];
      setSelectedStates(originalStates);
      
      setError('Failed to reorder states in workflow. Please try again.');
      console.error('Error reordering states in workflow:', err.message);
    }
  };

  // Handle adding a new workflow
  const handleAddWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Adding new workflow: ${newWorkflowName}`);
      
      // Create new workflow in database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Add optimistically to the UI
      const tempId = `temp-${Date.now()}`;
      const optimisticWorkflow: WorkflowWithSteps = {
        id: tempId,
        project_id: projectId,
        name: newWorkflowName,
        steps: []
      };
      
      const updatedWorkflows = [...workflowsWithSteps, optimisticWorkflow];
      setWorkflowsWithSteps(updatedWorkflows);
      onWorkflowsChange(updatedWorkflows);
      
      // Then save to the database
      const { data, error: insertError } = await supabase
        .from('workflows')
        .insert([{
          project_id: projectId,
          name: newWorkflowName
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Replace the temporary item with the real one
      const createdWorkflow: WorkflowWithSteps = {
        ...data,
        steps: []
      };
      
      const finalWorkflows = updatedWorkflows.map(w => 
        w.id === tempId ? createdWorkflow : w
      );
      
      setWorkflowsWithSteps(finalWorkflows);
      onWorkflowsChange(finalWorkflows);
      setNewWorkflowName('');
      console.log(`[${traceId}] Workflow added successfully: ${data.id}`);
    } catch (err: any) {
      // Revert optimistic update
      setWorkflowsWithSteps(workflowsWithSteps);
      onWorkflowsChange(workflows);
      setError('Failed to add workflow. Please try again.');
      console.error('Error adding workflow:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle renaming a workflow
  const handleStartEdit = (workflow: WorkflowWithSteps) => {
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
    
    const workflow = workflowsWithSteps.find(w => w.id === id);
    if (!workflow || editWorkflowName === workflow.name) {
      handleCancelEdit();
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Renaming workflow ${id} to: ${editWorkflowName}`);
      
      // Update optimistically in the UI
      const updatedWorkflows = workflowsWithSteps.map(w => 
        w.id === id ? { ...w, name: editWorkflowName } : w
      );
      setWorkflowsWithSteps(updatedWorkflows);
      onWorkflowsChange(updatedWorkflows);
      
      // Then update in the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: updateError } = await supabase
        .from('workflows')
        .update({ name: editWorkflowName })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      console.log(`[${traceId}] Workflow renamed successfully`);
    } catch (err: any) {
      // Revert optimistic update
      setWorkflowsWithSteps(workflowsWithSteps);
      onWorkflowsChange(workflows);
      setError('Failed to rename workflow. Please try again.');
      console.error('Error renaming workflow:', err.message);
    } finally {
      handleCancelEdit();
    }
  };

  // Handle deleting a workflow
  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow? This may affect existing task types.')) {
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting workflow: ${id}`);
      
      // Remove optimistically from the UI
      const updatedWorkflows = workflowsWithSteps.filter(w => w.id !== id);
      setWorkflowsWithSteps(updatedWorkflows);
      onWorkflowsChange(updatedWorkflows);
      
      // If this was the selected workflow, clear selection
      if (selectedWorkflow === id) {
        setSelectedWorkflow(null);
        setSelectedStates([]);
        setAvailableStates([...states]);
        setWorkflowTransitions([]);
        setShowTransitionEditor(false);
      }
      
      // Then delete from the database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: deleteError } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        // Check if delete failed because of foreign key constraint
        if (deleteError.message.includes('violates foreign key constraint')) {
          throw new Error('This workflow is used by task types and cannot be deleted.');
        }
        throw deleteError;
      }
      
      console.log(`[${traceId}] Workflow deleted successfully`);
    } catch (err: any) {
      // Restore the deleted workflow if there was an error
      setWorkflowsWithSteps(workflowsWithSteps);
      onWorkflowsChange(workflows);
      setError(err.message || 'Failed to delete workflow. Please try again.');
      console.error('Error deleting workflow:', err.message);
    }
  };

  // Handle creating a new transition
  const handleCreateTransition = async (fromStateId: string | null, toStateId: string) => {
    if (!selectedWorkflow) return;
    
    // Validate: Don't create duplicate transitions
    const isDuplicate = workflowTransitions.some(t => 
      t.from_state === fromStateId && t.to_state === toStateId
    );
    
    if (isDuplicate) {
      setError('This transition already exists.');
      return;
    }
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Creating transition from ${fromStateId || 'any'} to ${toStateId}`);
      
      // Update UI optimistically
      const newTransition: WorkflowTransition = {
        workflow_id: selectedWorkflow,
        from_state: fromStateId,
        to_state: toStateId
      };
      
      setWorkflowTransitions([...workflowTransitions, newTransition]);
      
      // Create transition in database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const { error: insertError } = await supabase
        .from('workflow_transitions')
        .insert([{
          workflow_id: selectedWorkflow,
          from_state: fromStateId,
          to_state: toStateId
        }]);
      
      if (insertError) throw insertError;
      
      console.log(`[${traceId}] Transition created successfully`);
    } catch (err: any) {
      // Revert optimistic update
      setWorkflowTransitions(workflowTransitions);
      
      setError('Failed to create transition. Please try again.');
      console.error('Error creating transition:', err.message);
    }
  };

  // Handle deleting a transition
  const handleDeleteTransition = async (fromStateId: string | null, toStateId: string) => {
    if (!selectedWorkflow) return;
    
    try {
      const traceId = uuidv4();
      console.log(`[${traceId}] Deleting transition from ${fromStateId || 'any'} to ${toStateId}`);
      
      // Update UI optimistically
      setWorkflowTransitions(prev => prev.filter(t => 
        !(t.from_state === fromStateId && t.to_state === toStateId)
      ));
      
      // Delete from database
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      const query = supabase
        .from('workflow_transitions')
        .delete()
        .eq('workflow_id', selectedWorkflow)
        .eq('to_state', toStateId);
      
      // If from_state is null, we need to use 'is' instead of 'eq'
      if (fromStateId === null) {
        query.is('from_state', null);
      } else {
        query.eq('from_state', fromStateId);
      }
      
      const { error: deleteError } = await query;
      
      if (deleteError) throw deleteError;
      
      console.log(`[${traceId}] Transition deleted successfully`);
    } catch (err: any) {
      // Fetch transitions again to revert
      const { data } = await supabase
        .from('workflow_transitions')
        .select('*')
        .eq('workflow_id', selectedWorkflow);
      
      if (data) {
        setWorkflowTransitions(data);
      }
      
      setError('Failed to delete transition. Please try again.');
      console.error('Error deleting transition:', err.message);
    }
  };

  // Handle toggling "any state" transition
  const handleToggleAnyStateTransition = async (stateId: string, enabled: boolean) => {
    if (!selectedWorkflow) return;
    
    // Check if this transition already exists
    const existingTransition = workflowTransitions.find(t => 
      t.from_state === null && t.to_state === stateId
    );
    
    if (enabled && existingTransition) {
      // Transition already exists, no need to do anything
      return;
    }
    
    if (enabled) {
      // Create a new "any state" transition
      await handleCreateTransition(null, stateId);
    } else if (existingTransition) {
      // Delete the existing "any state" transition
      await handleDeleteTransition(null, stateId);
    }
  };

  return (
    <div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      
      {/* Workflow list */}
      <div className="space-y-3 mb-6">
        <h4 className="font-medium text-sm">Your Workflows</h4>
        
        {workflowsWithSteps.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm italic">No workflows defined yet. Add your first workflow below.</p>
        ) : (
          workflowsWithSteps.map((workflow) => (
            <div 
              key={workflow.id} 
              className={`border rounded-md p-3 ${
                selectedWorkflow === workflow.id 
                  ? 'border-indigo-500 dark:border-indigo-400' 
                  : 'border-gray-200 dark:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Workflow name (or edit input) */}
                <div className="flex-grow">
                  {editingWorkflowId === workflow.id ? (
                    <input
                      type="text"
                      value={editWorkflowName}
                      onChange={(e) => setEditWorkflowName(e.target.value)}
                      className="w-full p-1 border rounded-md dark:bg-zinc-700 dark:border-zinc-600"
                      autoFocus
                    />
                  ) : (
                    <div 
                      className="flex items-center cursor-pointer" 
                      onClick={() => handleSelectWorkflow(workflow.id)}
                    >
                      <span className={`font-medium ${selectedWorkflow === workflow.id ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                        {workflow.name}
                      </span>
                      <span className="text-zinc-500 text-sm ml-2">
                        ({workflow.steps.length} states)
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {editingWorkflowId === workflow.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(workflow.id)}
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStartEdit(workflow)}
                        className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        aria-label={`Edit ${workflow.name}`}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="text-zinc-500 hover:text-red-500"
                        aria-label={`Delete ${workflow.name}`}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Selected workflow editor */}
              {selectedWorkflow === workflow.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-700">
                  {/* Toggle between steps and transitions editors */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm">
                      {showTransitionEditor 
                        ? 'Define transitions between states in the canvas below.' 
                        : 'Drag states into this workflow to create a sequence. The order determines the flow of tasks.'}
                    </div>
                    <button
                      onClick={handleToggleTransitionEditor}
                      className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {showTransitionEditor ? 'Edit States' : 'Edit Transitions'}
                    </button>
                  </div>
                  
                  {/* State editor view */}
                  {!showTransitionEditor && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Available states */}
                      <div>
                        <h5 className="text-sm font-medium mb-2">Available States</h5>
                        {availableStates.length === 0 ? (
                          <p className="text-zinc-500 dark:text-zinc-400 text-sm italic p-2">All states are already in this workflow.</p>
                        ) : (
                          <div className="space-y-2 bg-gray-50 dark:bg-zinc-700 p-2 rounded-md min-h-[100px]">
                            {availableStates.map(state => (
                              <div 
                                key={state.id}
                                className="flex justify-between items-center bg-white dark:bg-zinc-800 p-2 rounded border border-gray-200 dark:border-zinc-600"
                              >
                                <span>{state.name}</span>
                                <button
                                  onClick={() => handleAddState(state.id)}
                                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                  Add →
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Selected states */}
                      <div>
                        <h5 className="text-sm font-medium mb-2">Workflow Sequence</h5>
                        {selectedStates.length === 0 ? (
                          <p className="text-zinc-500 dark:text-zinc-400 text-sm italic p-2">Add states from the available list to create a workflow.</p>
                        ) : (
                          <div className="space-y-2 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-md min-h-[100px]">
                            {selectedStates.map((state, index) => (
                              <div 
                                key={state.id}
                                className="flex justify-between items-center bg-white dark:bg-zinc-800 p-2 rounded border border-indigo-200 dark:border-indigo-700"
                              >
                                <div className="flex items-center">
                                  <span className="text-indigo-600 dark:text-indigo-400 mr-2">
                                    {index + 1}.
                                  </span>
                                  <span>{state.name}</span>
                                  {workflowTransitions.some(t => t.from_state === null && t.to_state === state.id) && (
                                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                                      Any →
                                    </span>
                                  )}
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleReorderState(state.id, 'up')}
                                    disabled={index === 0}
                                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                                    aria-label="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => handleReorderState(state.id, 'down')}
                                    disabled={index === selectedStates.length - 1}
                                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30"
                                    aria-label="Move down"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    onClick={() => handleRemoveState(state.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Transition editor view */}
                  {showTransitionEditor && selectedStates.length >= 2 && (
                    <div>
                      <WorkflowGraphEditor
                        states={selectedStates}
                        transitions={workflowTransitions}
                        onTransitionCreate={handleCreateTransition}
                        onTransitionDelete={handleDeleteTransition}
                        onToggleAnyStateTransition={handleToggleAnyStateTransition}
                      />
                      
                      {/* Transition list sidebar */}
                      <TransitionListSidebar
                        transitions={workflowTransitions}
                        states={selectedStates}
                        onTransitionDelete={handleDeleteTransition}
                      />
                    </div>
                  )}
                  
                  {/* Message when there are not enough states for transition editor */}
                  {showTransitionEditor && selectedStates.length < 2 && (
                    <div className="p-4 text-center text-zinc-500 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-md">
                      <p>Add at least two states to the workflow to enable the transition editor.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Form to add new workflow */}
      <form onSubmit={handleAddWorkflow} className="flex mt-4">
        <input
          type="text"
          value={newWorkflowName}
          onChange={(e) => setNewWorkflowName(e.target.value)}
          placeholder="New workflow name"
          className="flex-grow p-2 border rounded-l-md dark:bg-zinc-700 dark:border-zinc-600"
        />
        <button
          type="submit"
          disabled={isSubmitting || !newWorkflowName.trim()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-r-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add Workflow'}
        </button>
      </form>
    </div>
  );
};

export default WorkflowBuilder;