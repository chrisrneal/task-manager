import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import StateListEditor from '@/components/workflows/StateListEditor';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import TaskTypeForm from '@/components/workflows/TaskTypeForm';

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
  { id: 's5', project_id: mockProjectId, name: 'Done', position: 4 }
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