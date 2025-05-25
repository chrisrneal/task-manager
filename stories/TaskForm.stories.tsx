import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import TaskForm from '@/components/TaskForm';
import { TaskWithFieldValues } from '@/types/database';

// Mock the useProjectFields hook
// Use module.exports instead of jest.mock for Storybook compatibility
const mockUseProjectFields = () => ({
  fields: [
    {
      id: '1',
      name: 'Text Field',
      input_type: 'text',
      is_required: true,
      project_id: 'project-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '2',
      name: 'Text Area',
      input_type: 'textarea',
      is_required: false,
      project_id: 'project-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '3',
      name: 'Number Field',
      input_type: 'number',
      is_required: false,
      project_id: 'project-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '4',
      name: 'Date Field',
      input_type: 'date',
      is_required: false,
      project_id: 'project-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '5',
      name: 'Select Field',
      input_type: 'select',
      is_required: false,
      project_id: 'project-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      options: ['Option 1', 'Option 2', 'Option 3']
    }
  ],
  loading: false,
  error: null
});

// Override the imported hook with our mock
import * as useProjectFieldsModule from '@/hooks/useProjectFields';
(useProjectFieldsModule as any).useProjectFields = mockUseProjectFields;

// Mock the supabase client
import * as supabaseModule from '@/utils/supabaseClient';
(supabaseModule as any).supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: { access_token: 'mock-token' } } })
  }
};

const meta: Meta<typeof TaskForm> = {
  title: 'Components/TaskForm',
  component: TaskForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TaskForm>;

export const Create: Story = {
  args: {
    mode: 'create',
    projectId: 'project-1',
    taskTypeId: 'task-type-1',
    stateId: 'state-1',
    taskTypes: [
      { id: 'task-type-1', name: 'Bug', project_id: 'project-1', workflow_id: 'workflow-1' },
      { id: 'task-type-2', name: 'Feature', project_id: 'project-1', workflow_id: 'workflow-1' }
    ],
    workflowStates: [
      { id: 'state-1', name: 'To Do' },
      { id: 'state-2', name: 'In Progress' },
      { id: 'state-3', name: 'Done' }
    ],
    validNextStates: ['state-1', 'state-2'],
    onSubmit: (task: TaskWithFieldValues) => console.log('Submit:', task),
    onCancel: () => console.log('Cancel clicked'),
  },
};

export const Edit: Story = {
  args: {
    mode: 'edit',
    projectId: 'project-1',
    taskTypeId: 'task-type-1',
    stateId: 'state-1',
    taskTypes: [
      { id: 'task-type-1', name: 'Bug', project_id: 'project-1', workflow_id: 'workflow-1' },
      { id: 'task-type-2', name: 'Feature', project_id: 'project-1', workflow_id: 'workflow-1' }
    ],
    workflowStates: [
      { id: 'state-1', name: 'To Do' },
      { id: 'state-2', name: 'In Progress' },
      { id: 'state-3', name: 'Done' }
    ],
    validNextStates: ['state-1', 'state-2', 'state-3'],
    initialValues: {
      id: 'task-1',
      name: 'Sample Task',
      description: 'This is a sample task description',
      status: 'in_progress',
      priority: 'high',
      due_date: '2023-12-31',
      task_type_id: 'task-type-1',
      state_id: 'state-1',
      project_id: 'project-1',
      owner_id: 'user-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      field_values: [
        { task_id: 'task-1', field_id: '1', value: 'Sample text' },
        { task_id: 'task-1', field_id: '2', value: 'Sample textarea content' },
        { task_id: 'task-1', field_id: '3', value: '42' },
        { task_id: 'task-1', field_id: '4', value: '2023-05-15' },
        { task_id: 'task-1', field_id: '5', value: 'Option 2' }
      ]
    },
    onSubmit: (task: TaskWithFieldValues) => console.log('Submit:', task),
    onCancel: () => console.log('Cancel clicked'),
  },
};

export const ViewOnly: Story = {
  args: {
    mode: 'view',
    projectId: 'project-1',
    taskTypeId: 'task-type-1',
    stateId: 'state-1',
    taskTypes: [
      { id: 'task-type-1', name: 'Bug', project_id: 'project-1', workflow_id: 'workflow-1' },
      { id: 'task-type-2', name: 'Feature', project_id: 'project-1', workflow_id: 'workflow-1' }
    ],
    workflowStates: [
      { id: 'state-1', name: 'To Do' },
      { id: 'state-2', name: 'In Progress' },
      { id: 'state-3', name: 'Done' }
    ],
    validNextStates: ['state-1'],
    initialValues: {
      id: 'task-1',
      name: 'Sample Task',
      description: 'This is a sample task description',
      status: 'done',
      priority: 'high',
      due_date: '2023-12-31',
      task_type_id: 'task-type-1',
      state_id: 'state-1',
      project_id: 'project-1',
      owner_id: 'user-1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      field_values: [
        { task_id: 'task-1', field_id: '1', value: 'Sample text' },
        { task_id: 'task-1', field_id: '2', value: 'Sample textarea content' },
        { task_id: 'task-1', field_id: '3', value: '42' },
        { task_id: 'task-1', field_id: '4', value: '2023-05-15' },
        { task_id: 'task-1', field_id: '5', value: 'Option 2' }
      ]
    },
    onSubmit: (task: TaskWithFieldValues) => console.log('Submit:', task),
    onCancel: () => console.log('Cancel clicked'),
  },
};