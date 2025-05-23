import React, { useState } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import StateListEditor from '@/components/workflows/StateListEditor';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import TaskTypeForm from '@/components/workflows/TaskTypeForm';
import WorkflowGraphEditor, { ANY_STATE_UUID } from '@/components/workflows/WorkflowGraphEditor';
import TransitionListSidebar from '@/components/workflows/TransitionListSidebar';
import { WorkflowTransition } from '@/types/database';

const meta: Meta = {
  title: 'Workflows/Workflow Components',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

// Mock data
const mockProjectId = '123e4567-e89b-12d3-a456-426614174000';

// Updated states to match the example in the requirements
const mockStates = [
  { id: 'sa', project_id: mockProjectId, name: 'State A', position: 0 },
  { id: 'sb', project_id: mockProjectId, name: 'State B', position: 1 },
  { id: 'sc', project_id: mockProjectId, name: 'State C', position: 2 },
  { id: 'sd', project_id: mockProjectId, name: 'State D', position: 3 },
  { id: 'se', project_id: mockProjectId, name: 'State E', position: 4 },
  { id: 'sf', project_id: mockProjectId, name: 'State F', position: 5 },
  { id: 'sg', project_id: mockProjectId, name: 'State G', position: 6 },
  { id: 'sh', project_id: mockProjectId, name: 'State H', position: 7 }
];

const mockWorkflows = [
  { id: 'w1', project_id: mockProjectId, name: 'Branching Workflow' },
  { id: 'w2', project_id: mockProjectId, name: 'Linear Workflow' }
];

const mockTaskTypes = [
  { id: 't1', project_id: mockProjectId, name: 'Bug', workflow_id: 'w1' },
  { id: 't2', project_id: mockProjectId, name: 'Feature', workflow_id: 'w2' },
  { id: 't3', project_id: mockProjectId, name: 'Task', workflow_id: 'w1' }
];

// Example transitions for the story, implementing branching and cyclical workflows
// Based on the requirement:
// state a -> state b -or- state c -or- state h
// state b -> state d -or- state h
// state c -> state e -or- state f -or- state h
// state e -> state g -or- state h
// state f -> state g -or- state h
const mockTransitions = [
  // State A branches to B, C, or H
  { workflow_id: 'w1', from_state: 'sa', to_state: 'sb' },
  { workflow_id: 'w1', from_state: 'sa', to_state: 'sc' },
  { workflow_id: 'w1', from_state: 'sa', to_state: 'sh' },
  
  // State B branches to D or H
  { workflow_id: 'w1', from_state: 'sb', to_state: 'sd' },
  { workflow_id: 'w1', from_state: 'sb', to_state: 'sh' },
  
  // State C branches to E, F, or H
  { workflow_id: 'w1', from_state: 'sc', to_state: 'se' },
  { workflow_id: 'w1', from_state: 'sc', to_state: 'sf' },
  { workflow_id: 'w1', from_state: 'sc', to_state: 'sh' },
  
  // State E branches to G or H
  { workflow_id: 'w1', from_state: 'se', to_state: 'sg' },
  { workflow_id: 'w1', from_state: 'se', to_state: 'sh' },
  
  // State F branches to G or H
  { workflow_id: 'w1', from_state: 'sf', to_state: 'sg' },
  { workflow_id: 'w1', from_state: 'sf', to_state: 'sh' },
  
  // Add a cyclical transition from H back to A to demonstrate cycles
  { workflow_id: 'w1', from_state: 'sh', to_state: 'sa' }
];

// Mock handlers
const handleStatesChange = (states: any) => {
  console.log('States changed:', states);
};

const handleWorkflowsChange = (workflows: any) => {
  console.log('Workflows changed:', workflows);
};

const handleTaskTypesChange = (taskTypes: any) => {
  console.log('Task types changed:', taskTypes);
};

// Stories
export const States: StoryObj = {
  render: () => (
    <div className="p-4 max-w-md">
      <h3 className="text-lg font-medium mb-3">States</h3>
      <StateListEditor 
        projectId={mockProjectId}
        states={mockStates}
        onStatesChange={handleStatesChange}
      />
    </div>
  )
};

export const Workflows: StoryObj = {
  render: () => (
    <div className="p-4 max-w-3xl">
      <h3 className="text-lg font-medium mb-3">Workflows</h3>
      <WorkflowBuilder 
        projectId={mockProjectId}
        states={mockStates}
        workflows={mockWorkflows}
        onWorkflowsChange={handleWorkflowsChange}
      />
    </div>
  )
};

export const TaskTypes: StoryObj = {
  render: () => (
    <div className="p-4 max-w-3xl">
      <h3 className="text-lg font-medium mb-3">Task Types</h3>
      <TaskTypeForm 
        projectId={mockProjectId}
        workflows={mockWorkflows}
        taskTypes={mockTaskTypes}
        onTaskTypesChange={handleTaskTypesChange}
      />
    </div>
  )
};

// Interactive WorkflowGraphEditor story
export const TransitionEditor: StoryObj = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [transitions, setTransitions] = useState<WorkflowTransition[]>(mockTransitions);

    const handleCreateTransition = (fromStateId: string | null, toStateId: string) => {
      // Use the placeholder UUID for null values
      const effectiveFromStateId = fromStateId === null ? ANY_STATE_UUID : fromStateId;
      
      // Check for duplicates
      if (transitions.some(t => 
        (t.from_state === effectiveFromStateId || 
         (t.from_state === null && effectiveFromStateId === ANY_STATE_UUID) ||
         (t.from_state === ANY_STATE_UUID && effectiveFromStateId === null)) && 
        t.to_state === toStateId)) {
        alert('This transition already exists.');
        return;
      }
      
      const newTransition: WorkflowTransition = {
        workflow_id: 'w1',
        from_state: effectiveFromStateId,
        to_state: toStateId
      };
      
      setTransitions([...transitions, newTransition]);
      console.log('Transition created:', newTransition);
    };

    const handleDeleteTransition = (fromStateId: string | null, toStateId: string) => {
      // Handle both null and placeholder UUID cases
      setTransitions(transitions.filter(t => {
        // If fromStateId is null, match both null and ANY_STATE_UUID
        if (fromStateId === null) {
          return !(
            (t.from_state === null || t.from_state === ANY_STATE_UUID) && 
            t.to_state === toStateId
          );
        } 
        // If fromStateId is ANY_STATE_UUID, match both null and ANY_STATE_UUID  
        else if (fromStateId === ANY_STATE_UUID) {
          return !(
            (t.from_state === null || t.from_state === ANY_STATE_UUID) && 
            t.to_state === toStateId
          );
        }
        // Otherwise, exact match
        else {
          return !(t.from_state === fromStateId && t.to_state === toStateId);
        }
      }));
      console.log('Transition deleted:', { from: fromStateId, to: toStateId });
    };

    const handleToggleAnyStateTransition = (stateId: string, enabled: boolean) => {
      const existingAnyTransition = transitions.find(t => 
        (t.from_state === null || t.from_state === ANY_STATE_UUID) && t.to_state === stateId
      );
      
      if (enabled && !existingAnyTransition) {
        const newTransition = {
          workflow_id: 'w1',
          from_state: ANY_STATE_UUID, // Use placeholder UUID instead of null
          to_state: stateId
        };
        setTransitions([...transitions, newTransition]);
      } else if (!enabled && existingAnyTransition) {
        setTransitions(transitions.filter(t => 
          !((t.from_state === null || t.from_state === ANY_STATE_UUID) && t.to_state === stateId)
        ));
      }
    };

    return (
      <div className="p-4 max-w-3xl">
        <h3 className="text-lg font-medium mb-3">Workflow Transition Editor</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Example of a branching and cyclical workflow with multiple paths:
          <br />
          • State A can transition to States B, C, or H (branching)
          <br />
          • State B can transition to States D or H
          <br />
          • State C can transition to States E, F, or H
          <br />
          • States E and F can transition to States G or H
          <br />
          • State H can transition back to State A (cyclical)
          <br />
          <br />
          Shift+drag from one state to another to create a transition. Each state can have multiple outgoing transitions.
        </p>
        
        <WorkflowGraphEditor
          states={mockStates}
          transitions={transitions}
          onTransitionCreate={handleCreateTransition}
          onTransitionDelete={handleDeleteTransition}
          onToggleAnyStateTransition={handleToggleAnyStateTransition}
        />
        
        <TransitionListSidebar
          transitions={transitions}
          states={mockStates}
          onTransitionDelete={handleDeleteTransition}
        />
      </div>
    );
  }
};