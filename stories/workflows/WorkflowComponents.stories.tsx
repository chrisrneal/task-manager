import React, { useState } from 'react';
import { Meta, StoryObj } from '@storybook/react';
import StateListEditor from '@/components/workflows/StateListEditor';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import TaskTypeForm from '@/components/workflows/TaskTypeForm';
import WorkflowGraphEditor from '@/components/workflows/WorkflowGraphEditor';
import TransitionListSidebar from '@/components/workflows/TransitionListSidebar';

const meta: Meta = {
  title: 'Workflows/Workflow Components',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

// Mock data
const mockProjectId = '123e4567-e89b-12d3-a456-426614174000';

const mockStates = [
  { id: 's1', project_id: mockProjectId, name: 'Backlog', position: 0 },
  { id: 's2', project_id: mockProjectId, name: 'Todo', position: 1 },
  { id: 's3', project_id: mockProjectId, name: 'In Progress', position: 2 },
  { id: 's4', project_id: mockProjectId, name: 'Review', position: 3 },
  { id: 's5', project_id: mockProjectId, name: 'Done', position: 4 },
  { id: 's6', project_id: mockProjectId, name: 'Cancelled', position: 5 }
];

const mockWorkflows = [
  { id: 'w1', project_id: mockProjectId, name: 'Basic Workflow' },
  { id: 'w2', project_id: mockProjectId, name: 'Advanced Workflow' }
];

const mockTaskTypes = [
  { id: 't1', project_id: mockProjectId, name: 'Bug', workflow_id: 'w1' },
  { id: 't2', project_id: mockProjectId, name: 'Feature', workflow_id: 'w2' },
  { id: 't3', project_id: mockProjectId, name: 'Task', workflow_id: 'w1' }
];

// Example transitions for the story
const mockTransitions = [
  { workflow_id: 'w1', from_state: 's1', to_state: 's2' },
  { workflow_id: 'w1', from_state: 's2', to_state: 's3' },
  { workflow_id: 'w1', from_state: 's3', to_state: 's4' },
  { workflow_id: 'w1', from_state: 's4', to_state: 's5' },
  { workflow_id: 'w1', from_state: null, to_state: 's6' } // Example of "any state" transition to Cancelled
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
    const [transitions, setTransitions] = useState(mockTransitions);

    const handleCreateTransition = (fromStateId: string | null, toStateId: string) => {
      // Check for duplicates
      if (transitions.some(t => t.from_state === fromStateId && t.to_state === toStateId)) {
        alert('This transition already exists.');
        return;
      }
      
      const newTransition = {
        workflow_id: 'w1',
        from_state: fromStateId,
        to_state: toStateId
      };
      
      setTransitions([...transitions, newTransition]);
      console.log('Transition created:', newTransition);
    };

    const handleDeleteTransition = (fromStateId: string | null, toStateId: string) => {
      setTransitions(transitions.filter(t => 
        !(t.from_state === fromStateId && t.to_state === toStateId)
      ));
      console.log('Transition deleted:', { from: fromStateId, to: toStateId });
    };

    const handleToggleAnyStateTransition = (stateId: string, enabled: boolean) => {
      const existingAnyTransition = transitions.find(t => 
        t.from_state === null && t.to_state === stateId
      );
      
      if (enabled && !existingAnyTransition) {
        const newTransition = {
          workflow_id: 'w1',
          from_state: null,
          to_state: stateId
        };
        setTransitions([...transitions, newTransition]);
      } else if (!enabled && existingAnyTransition) {
        setTransitions(transitions.filter(t => 
          !(t.from_state === null && t.to_state === stateId)
        ));
      }
    };

    return (
      <div className="p-4 max-w-3xl">
        <h3 className="text-lg font-medium mb-3">Workflow Transition Editor</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Example workflow with states from Intake → In Progress → Warranty → Closed, plus Any → Cancelled.
          <br />
          Shift+drag from one state to another to create a transition. Check the "Any state" box to create global transitions.
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