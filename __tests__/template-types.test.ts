import { test, expect } from '@playwright/test';
import { 
  ProjectTemplate, 
  TemplateState, 
  TemplateWorkflow, 
  TemplateTaskType, 
  TemplateField,
  ProjectTemplateWithDetails 
} from '../types/database';

test.describe('Project Template Types', () => {
  test('ProjectTemplate interface has required properties', () => {
    const template: ProjectTemplate = {
      id: 'test-id',
      name: 'Test Template',
      description: 'A test template',
      icon: '📋',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(template.id).toBe('test-id');
    expect(template.name).toBe('Test Template');
    expect(template.description).toBe('A test template');
    expect(template.icon).toBe('📋');
  });

  test('TemplateState interface has required properties', () => {
    const state: TemplateState = {
      id: 'state-id',
      template_id: 'template-id',
      name: 'To Do',
      position: 1,
    };

    expect(state.id).toBe('state-id');
    expect(state.template_id).toBe('template-id');
    expect(state.name).toBe('To Do');
    expect(state.position).toBe(1);
  });

  test('TemplateWorkflow interface has required properties', () => {
    const workflow: TemplateWorkflow = {
      id: 'workflow-id',
      template_id: 'template-id',
      name: 'Standard Workflow',
    };

    expect(workflow.id).toBe('workflow-id');
    expect(workflow.template_id).toBe('template-id');
    expect(workflow.name).toBe('Standard Workflow');
  });

  test('TemplateTaskType interface has required properties', () => {
    const taskType: TemplateTaskType = {
      id: 'task-type-id',
      template_id: 'template-id',
      name: 'User Story',
      workflow_id: 'workflow-id',
    };

    expect(taskType.id).toBe('task-type-id');
    expect(taskType.template_id).toBe('template-id');
    expect(taskType.name).toBe('User Story');
    expect(taskType.workflow_id).toBe('workflow-id');
  });

  test('TemplateField interface has required properties', () => {
    const field: TemplateField = {
      id: 'field-id',
      template_id: 'template-id',
      name: 'Story Points',
      input_type: 'select',
      is_required: false,
      options: ['1', '2', '3', '5', '8'],
      default_value: '3',
    };

    expect(field.id).toBe('field-id');
    expect(field.template_id).toBe('template-id');
    expect(field.name).toBe('Story Points');
    expect(field.input_type).toBe('select');
    expect(field.is_required).toBe(false);
    expect(field.options).toEqual(['1', '2', '3', '5', '8']);
    expect(field.default_value).toBe('3');
  });

  test('ProjectTemplateWithDetails interface compiles correctly', () => {
    const templateWithDetails: ProjectTemplateWithDetails = {
      id: 'template-id',
      name: 'Basic Scrum',
      description: 'A basic scrum template',
      icon: '🏃‍♂️',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      states: [],
      workflows: [],
      task_types: [],
      fields: [],
    };

    expect(templateWithDetails.name).toBe('Basic Scrum');
    expect(Array.isArray(templateWithDetails.states)).toBe(true);
    expect(Array.isArray(templateWithDetails.workflows)).toBe(true);
    expect(Array.isArray(templateWithDetails.task_types)).toBe(true);
    expect(Array.isArray(templateWithDetails.fields)).toBe(true);
  });
});