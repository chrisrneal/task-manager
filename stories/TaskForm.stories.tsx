import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import TaskForm from '@/components/TaskForm';

// Mock the useProjectFields hook
jest.mock('@/hooks/useProjectFields', () => ({
  useProjectFields: () => ({
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
  })
}));

// Mock the supabase client
jest.mock('@/utils/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'mock-token' } } })
    }
  }
}));

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
    onSubmit: (task, fieldValues) => console.log('Submit:', { task, fieldValues }),
    onCancel: () => console.log('Cancel clicked'),
  },
};

export const Edit: Story = {
  args: {
    mode: 'edit',
    projectId: 'project-1',
    taskTypeId: 'task-type-1',
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
    onSubmit: (task, fieldValues) => console.log('Submit:', { task, fieldValues }),
    onCancel: () => console.log('Cancel clicked'),
  },
};

export const ViewOnly: Story = {
  args: {
    mode: 'view',
    projectId: 'project-1',
    taskTypeId: 'task-type-1',
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
    onSubmit: (task, fieldValues) => console.log('Submit:', { task, fieldValues }),
    onCancel: () => console.log('Cancel clicked'),
  },
};