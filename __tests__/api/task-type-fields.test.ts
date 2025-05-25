import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Custom Fields API', () => {
  let testUserId: string;
  let testProjectId: string;
  let testTaskTypeId: string;
  let testWorkflowId: string;
  let testFieldId: string;
  let testTaskId: string;
  let authToken: string;

  test.beforeAll(async () => {
    // Create test user and project setup
    const testUserEmail = `test-${uuidv4()}@example.com`;
    const testPassword = 'test123456';

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: testPassword,
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Sign in to get token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testPassword
    });

    if (signInError || !signInData.session) {
      throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    authToken = signInData.session.access_token;

    // Create test project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([{
        name: 'Test Project for Custom Fields',
        description: 'Test project for custom fields API testing',
        user_id: testUserId
      }])
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    testProjectId = project.id;

    // Create test workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .insert([{
        name: 'Test Workflow',
        project_id: testProjectId
      }])
      .select()
      .single();

    if (workflowError || !workflow) {
      throw new Error(`Failed to create test workflow: ${workflowError?.message}`);
    }

    testWorkflowId = workflow.id;

    // Create test task type
    const { data: taskType, error: taskTypeError } = await supabase
      .from('task_types')
      .insert([{
        name: 'Test Task Type',
        project_id: testProjectId,
        workflow_id: testWorkflowId
      }])
      .select()
      .single();

    if (taskTypeError || !taskType) {
      throw new Error(`Failed to create test task type: ${taskTypeError?.message}`);
    }

    testTaskTypeId = taskType.id;
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await supabase.from('projects').delete().eq('id', testProjectId);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test.describe('Field Definitions API', () => {
    test('should create a new field', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Test Text Field',
          input_type: 'text',
          is_required: false
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.data).toHaveProperty('id');
      expect(data.data.name).toBe('Test Text Field');
      expect(data.data.input_type).toBe('text');
      expect(data.data.is_required).toBe(false);
      
      testFieldId = data.data.id;
    });

    test('should get all fields for a project', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
      expect(data.data[0]).toHaveProperty('task_type_ids');
    });

    test('should get a specific field', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields/${testFieldId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.data.id).toBe(testFieldId);
      expect(data.data.name).toBe('Test Text Field');
    });

    test('should update a field', async ({ request }) => {
      const response = await request.put(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields/${testFieldId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Updated Text Field',
          is_required: true
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.data.name).toBe('Updated Text Field');
      expect(data.data.is_required).toBe(true);
    });

    test('should fail to create field with invalid input type', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Invalid Field',
          input_type: 'invalid_type',
          is_required: false
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid input_type');
    });

    test('should fail to access field from different project', async ({ request }) => {
      // Create another project with different user would be complex, so test with non-existent project
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${uuidv4()}/fields/${testFieldId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Task Type Field Assignments API', () => {
    test('should assign fields to task type', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/task-types/${testTaskTypeId}/fields`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          field_ids: [testFieldId]
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.assigned_count).toBe(1);
    });

    test('should get assigned fields for task type', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/task-types/${testTaskTypeId}/fields`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].id).toBe(testFieldId);
    });

    test('should fail to assign non-existent field', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/task-types/${testTaskTypeId}/fields`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          field_ids: [uuidv4()]
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Some fields were not found');
    });
  });

  test.describe('Task Field Values API', () => {
    test.beforeAll(async () => {
      // Create a test task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([{
          name: 'Test Task for Field Values',
          description: 'Test task for field values testing',
          project_id: testProjectId,
          owner_id: testUserId,
          task_type_id: testTaskTypeId,
          status: 'todo',
          priority: 'medium'
        }])
        .select()
        .single();

      if (taskError || !task) {
        throw new Error(`Failed to create test task: ${taskError?.message}`);
      }

      testTaskId = task.id;
    });

    test('should create field values for task', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}/field-values`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          field_values: [
            {
              field_id: testFieldId,
              value: 'Test field value'
            }
          ]
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].value).toBe('Test field value');
    });

    test('should get field values for task', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}/field-values`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].value).toBe('Test field value');
      expect(data.data[0].fields).toBeDefined();
    });

    test('should update field values for task', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}/field-values`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          field_values: [
            {
              field_id: testFieldId,
              value: 'Updated field value'
            }
          ]
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.data[0].value).toBe('Updated field value');
    });

    test('should fail to create field value for unassigned field', async ({ request }) => {
      // Create another field but don't assign it to the task type
      const { data: unassignedField } = await supabase
        .from('fields')
        .insert([{
          name: 'Unassigned Field',
          input_type: 'text',
          is_required: false,
          project_id: testProjectId
        }])
        .select()
        .single();

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}/field-values`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          field_values: [
            {
              field_id: unassignedField.id,
              value: 'Should fail'
            }
          ]
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('must be assigned to the task type');
    });
  });

  test.describe('Task API with Custom Fields', () => {
    test('should create task with field values', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Task with Custom Fields',
          description: 'Test task creation with custom field values',
          project_id: testProjectId,
          task_type_id: testTaskTypeId,
          field_values: [
            {
              field_id: testFieldId,
              value: 'Initial field value'
            }
          ]
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.data.name).toBe('Task with Custom Fields');
    });

    test('should get task with field values', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.data.field_values).toBeDefined();
      expect(Array.isArray(data.data.field_values)).toBe(true);
    });

    test('should update task with field values', async ({ request }) => {
      const response = await request.put(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Updated Task Name',
          field_values: [
            {
              field_id: testFieldId,
              value: 'Updated via task API'
            }
          ]
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.data.name).toBe('Updated Task Name');
    });
  });

  test.describe('Validation Tests', () => {
    let requiredFieldId: string;

    test.beforeAll(async () => {
      // Create a required field
      const { data: requiredField } = await supabase
        .from('fields')
        .insert([{
          name: 'Required Field',
          input_type: 'text',
          is_required: true,
          project_id: testProjectId
        }])
        .select()
        .single();

      requiredFieldId = requiredField.id;

      // Assign it to the task type
      await supabase
        .from('task_type_fields')
        .insert([{
          task_type_id: testTaskTypeId,
          field_id: requiredFieldId
        }]);
    });

    test('should fail to create task without required field value', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Task Missing Required Field',
          project_id: testProjectId,
          task_type_id: testTaskTypeId,
          field_values: [
            {
              field_id: testFieldId,
              value: 'Only optional field'
            }
          ]
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Required field');
      expect(data.error).toContain('must have a value');
    });

    test('should fail to update task removing required field value', async ({ request }) => {
      const response = await request.put(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks/${testTaskId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Task Name',
          field_values: [
            {
              field_id: requiredFieldId,
              value: '' // Empty value for required field
            }
          ]
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Required field');
      expect(data.error).toContain('must have a value');
    });
  });

  test.describe('Field Deletion Protection', () => {
    test('should prevent deletion of field in use', async ({ request }) => {
      const response = await request.delete(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields/${testFieldId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('Cannot delete field that is in use by tasks');
    });

    test('should allow deletion of unused field', async ({ request }) => {
      // Create a field that won't be used
      const { data: unusedField } = await supabase
        .from('fields')
        .insert([{
          name: 'Unused Field',
          input_type: 'text',
          is_required: false,
          project_id: testProjectId
        }])
        .select()
        .single();

      const response = await request.delete(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${testProjectId}/fields/${unusedField.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('Field deleted successfully');
    });
  });
});