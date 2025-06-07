import type { Meta, StoryObj } from '@storybook/react';
import TaskProgressBar from '@/components/TaskProgressBar';
import { ProjectState, WorkflowTransition } from '@/types/database';

const meta: Meta<typeof TaskProgressBar> = {
  title: 'Components/TaskProgressBar',
  component: TaskProgressBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data
const mockProjectId = 'project-1';

const linearWorkflowStates: ProjectState[] = [
  { id: 'state-1', project_id: mockProjectId, name: 'To Do', position: 0 },
  { id: 'state-2', project_id: mockProjectId, name: 'In Progress', position: 1 },
  { id: 'state-3', project_id: mockProjectId, name: 'Review', position: 2 },
  { id: 'state-4', project_id: mockProjectId, name: 'Done', position: 3 },
];

const complexWorkflowStates: ProjectState[] = [
  { id: 'sa', project_id: mockProjectId, name: 'Backlog', position: 0 },
  { id: 'sb', project_id: mockProjectId, name: 'Analysis', position: 1 },
  { id: 'sc', project_id: mockProjectId, name: 'Development', position: 2 },
  { id: 'sd', project_id: mockProjectId, name: 'Testing', position: 3 },
  { id: 'se', project_id: mockProjectId, name: 'Review', position: 4 },
  { id: 'sf', project_id: mockProjectId, name: 'Deployment', position: 5 },
  { id: 'sg', project_id: mockProjectId, name: 'Completed', position: 6 },
];

const linearTransitions: WorkflowTransition[] = [
  { workflow_id: 'w1', from_state: 'state-1', to_state: 'state-2' },
  { workflow_id: 'w1', from_state: 'state-2', to_state: 'state-3' },
  { workflow_id: 'w1', from_state: 'state-3', to_state: 'state-4' },
];

export const FirstState: Story = {
  args: {
    currentStateId: 'state-1',
    workflowStates: linearWorkflowStates,
    workflowTransitions: linearTransitions,
  },
};

export const MiddleState: Story = {
  args: {
    currentStateId: 'state-2',
    workflowStates: linearWorkflowStates,
    workflowTransitions: linearTransitions,
  },
};

export const LastState: Story = {
  args: {
    currentStateId: 'state-4',
    workflowStates: linearWorkflowStates,
    workflowTransitions: linearTransitions,
  },
};

export const ComplexWorkflow: Story = {
  args: {
    currentStateId: 'sd',
    workflowStates: complexWorkflowStates,
    workflowTransitions: [
      { workflow_id: 'w2', from_state: 'sa', to_state: 'sb' },
      { workflow_id: 'w2', from_state: 'sb', to_state: 'sc' },
      { workflow_id: 'w2', from_state: 'sc', to_state: 'sd' },
      { workflow_id: 'w2', from_state: 'sd', to_state: 'se' },
      { workflow_id: 'w2', from_state: 'se', to_state: 'sf' },
      { workflow_id: 'w2', from_state: 'sf', to_state: 'sg' },
    ],
  },
};

export const TwoStepWorkflow: Story = {
  args: {
    currentStateId: 'state-1',
    workflowStates: [
      { id: 'state-1', project_id: mockProjectId, name: 'Open', position: 0 },
      { id: 'state-2', project_id: mockProjectId, name: 'Closed', position: 1 },
    ],
    workflowTransitions: [
      { workflow_id: 'w3', from_state: 'state-1', to_state: 'state-2' },
    ],
  },
};

export const LongStateNames: Story = {
  args: {
    currentStateId: 'state-2',
    workflowStates: [
      { id: 'state-1', project_id: mockProjectId, name: 'Waiting for Approval', position: 0 },
      { id: 'state-2', project_id: mockProjectId, name: 'Under Development Review', position: 1 },
      { id: 'state-3', project_id: mockProjectId, name: 'Ready for Production Deployment', position: 2 },
    ],
    workflowTransitions: [
      { workflow_id: 'w4', from_state: 'state-1', to_state: 'state-2' },
      { workflow_id: 'w4', from_state: 'state-2', to_state: 'state-3' },
    ],
  },
};

export const WithCustomStyling: Story = {
  args: {
    currentStateId: 'state-3',
    workflowStates: linearWorkflowStates,
    workflowTransitions: linearTransitions,
    className: 'bg-gray-100 dark:bg-gray-900 p-4 rounded-lg',
  },
};

// Responsive example
export const ResponsiveDemo: Story = {
  args: {
    currentStateId: 'sc',
    workflowStates: complexWorkflowStates,
    workflowTransitions: [
      { workflow_id: 'w2', from_state: 'sa', to_state: 'sb' },
      { workflow_id: 'w2', from_state: 'sb', to_state: 'sc' },
      { workflow_id: 'w2', from_state: 'sc', to_state: 'sd' },
      { workflow_id: 'w2', from_state: 'sd', to_state: 'se' },
      { workflow_id: 'w2', from_state: 'se', to_state: 'sf' },
      { workflow_id: 'w2', from_state: 'sf', to_state: 'sg' },
    ],
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};