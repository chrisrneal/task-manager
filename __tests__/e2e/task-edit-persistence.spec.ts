import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Task Edit and Persistence E2E Tests', () => {
  let testUserId: string;
  let testProjectId: string;
  let testTaskTypeId: string;
  let testTaskId: string;
  let testFieldId: string;
  let authToken: string;
  
  test.beforeAll(async () => {
    // Create test user
    const testUserEmail = `test-${uuidv4()}@example.com`;
    const testPassword = 'test123456';

    // Create user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: testPassword,
      email_confirm: true
    });

    if (authError || !authData?.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Sign in to get auth token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testPassword
    });

    if (signInError || !signInData?.session) {
      throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    authToken = signInData.session.access_token;

    // Create test project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert([{
        name: `Test Project ${uuidv4()}`,
        description: 'E2E Test Project for Task Editing',
        owner_id: testUserId
      }])
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    testProjectId = project.id;

    // Create test task type
    const { data: taskType, error: taskTypeError } = await supabase
      .from('task_types')
      .insert([{
        name: `Test Task Type ${uuidv4()}`,
        description: 'E2E Test Task Type for Editing',
        project_id: testProjectId,
        created_by: testUserId
      }])
      .select()
      .single();

    if (taskTypeError || !taskType) {
      throw new Error(`Failed to create test task type: ${taskTypeError?.message}`);
    }

    testTaskTypeId = taskType.id;

    // Create custom field
    const { data: field, error: fieldError } = await supabase
      .from('fields')
      .insert([{
        name: `Test Field ${uuidv4()}`,
        description: 'E2E Test Field for Editing',
        project_id: testProjectId,
        input_type: 'text',
        is_required: true,
        created_by: testUserId
      }])
      .select()
      .single();

    if (fieldError || !field) {
      throw new Error(`Failed to create test field: ${fieldError?.message}`);
    }

    testFieldId = field.id;

    // Assign field to task type
    const { error: assignError } = await supabase
      .from('task_type_fields')
      .insert([{
        task_type_id: testTaskTypeId,
        field_id: testFieldId,
        created_by: testUserId
      }]);

    if (assignError) {
      throw new Error(`Failed to assign field to task type: ${assignError?.message}`);
    }

    // Create a test task with the custom field
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert([{
        name: `Test Task for Editing ${uuidv4()}`,
        description: 'E2E Test Task with custom field',
        project_id: testProjectId,
        task_type_id: testTaskTypeId,
        created_by: testUserId,
        status: 'todo',
        priority: 'medium'
      }])
      .select()
      .single();

    if (taskError || !task) {
      throw new Error(`Failed to create test task: ${taskError?.message}`);
    }

    testTaskId = task.id;

    // Add field value to the task
    const { error: fieldValueError } = await supabase
      .from('task_field_values')
      .insert([{
        task_id: testTaskId,
        field_id: testFieldId,
        value: 'Initial field value',
        created_by: testUserId
      }]);

    if (fieldValueError) {
      throw new Error(`Failed to create field value: ${fieldValueError?.message}`);
    }
  });

  test.afterAll(async () => {
    // Clean up test data - delete in reverse order of creation
    await supabase.from('task_field_values').delete().match({ task_id: testTaskId });
    await supabase.from('tasks').delete().match({ id: testTaskId });
    await supabase.from('task_type_fields').delete().match({ field_id: testFieldId });
    await supabase.from('fields').delete().match({ id: testFieldId });
    await supabase.from('task_types').delete().match({ id: testTaskTypeId });
    await supabase.from('projects').delete().match({ id: testProjectId });
    await supabase.auth.admin.deleteUser(testUserId);
  });

  test('Edit a task and persist field values', async ({ page }) => {
    // Login
    await page.goto('/login');
    
    // Store auth data in localStorage to bypass UI login
    await page.evaluate((token) => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        currentSession: {
          access_token: token
        }
      }));
    }, authToken);
    
    // Go to project page
    await page.goto(`/projects/${testProjectId}`);
    
    // Wait for tasks to load
    await page.waitForSelector('.task-card', { timeout: 10000 });
    
    // Click on the test task to open it
    await page.click(`.task-card:has-text("Test Task for Editing")`);
    
    // Wait for the task details page to load
    await page.waitForSelector('h1:has-text("Test Task for Editing")');
    
    // Click the Edit button
    await page.click('button:has-text("Edit")');
    
    // Wait for the edit form to appear
    await page.waitForSelector('form h2:has-text("Edit Task")');
    
    // Verify the custom field value is loaded correctly
    const fieldValue = await page.inputValue(`input[id^="field_"]`);
    expect(fieldValue).toBe('Initial field value');
    
    // Update the task name
    await page.fill('input[name="name"]', 'Updated Task Name via E2E');
    
    // Update the custom field value
    await page.fill(`input[id^="field_"]`, 'Updated field value via E2E');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for the task details page to reload
    await page.waitForSelector('h1:has-text("Updated Task Name via E2E")');
    
    // Verify the updated field value is displayed
    await expect(page.locator('div.field-value', { hasText: 'Updated field value via E2E' })).toBeVisible();
    
    // Navigate away and back to ensure persistence
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForSelector('.task-card', { timeout: 10000 });
    
    // Click on the updated task
    await page.click(`.task-card:has-text("Updated Task Name via E2E")`);
    
    // Wait for the task details to load
    await page.waitForSelector('h1:has-text("Updated Task Name via E2E")');
    
    // Verify the field value persisted
    await expect(page.locator('div.field-value', { hasText: 'Updated field value via E2E' })).toBeVisible();
  });
});