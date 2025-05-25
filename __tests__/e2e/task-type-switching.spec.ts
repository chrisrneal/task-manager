import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Task Type Switching E2E Tests', () => {
  let testUserId: string;
  let testProjectId: string;
  let testTaskTypeWithFieldId: string;
  let testTaskTypeWithoutFieldId: string;
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
        description: 'E2E Test Project for Task Type Switching',
        owner_id: testUserId
      }])
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    testProjectId = project.id;

    // Create task type with field
    const { data: taskTypeWithField, error: taskTypeWithFieldError } = await supabase
      .from('task_types')
      .insert([{
        name: `Type With Field ${uuidv4()}`,
        description: 'Task type with custom field',
        project_id: testProjectId,
        created_by: testUserId
      }])
      .select()
      .single();

    if (taskTypeWithFieldError || !taskTypeWithField) {
      throw new Error(`Failed to create task type with field: ${taskTypeWithFieldError?.message}`);
    }

    testTaskTypeWithFieldId = taskTypeWithField.id;

    // Create task type without field
    const { data: taskTypeWithoutField, error: taskTypeWithoutFieldError } = await supabase
      .from('task_types')
      .insert([{
        name: `Type Without Field ${uuidv4()}`,
        description: 'Task type without custom field',
        project_id: testProjectId,
        created_by: testUserId
      }])
      .select()
      .single();

    if (taskTypeWithoutFieldError || !taskTypeWithoutField) {
      throw new Error(`Failed to create task type without field: ${taskTypeWithoutFieldError?.message}`);
    }

    testTaskTypeWithoutFieldId = taskTypeWithoutField.id;

    // Create custom field
    const { data: field, error: fieldError } = await supabase
      .from('fields')
      .insert([{
        name: `Test Field ${uuidv4()}`,
        description: 'E2E Test Field for Type Switching',
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

    // Assign field to task type with field
    const { error: assignError } = await supabase
      .from('task_type_fields')
      .insert([{
        task_type_id: testTaskTypeWithFieldId,
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
        name: `Test Task for Switching ${uuidv4()}`,
        description: 'E2E Test Task for type switching',
        project_id: testProjectId,
        task_type_id: testTaskTypeWithFieldId,
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
        value: 'Field value that might be lost',
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
    await supabase.from('task_types').delete().match({ id: testTaskTypeWithFieldId });
    await supabase.from('task_types').delete().match({ id: testTaskTypeWithoutFieldId });
    await supabase.from('projects').delete().match({ id: testProjectId });
    await supabase.auth.admin.deleteUser(testUserId);
  });

  test('Switching task type hides fields and warns about data loss', async ({ page }) => {
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
    
    // Go to the task edit page
    await page.goto(`/tasks/${testTaskId}/edit`);
    
    // Wait for the edit form to load
    await page.waitForSelector('form h2:has-text("Edit Task")');
    
    // Verify the custom field is visible
    await expect(page.locator('h4:has-text("Custom Fields")')).toBeVisible();
    await expect(page.locator(`input[id^="field_"]`)).toBeVisible();
    
    // Get the current field value
    const fieldValue = await page.inputValue(`input[id^="field_"]`);
    expect(fieldValue).toBe('Field value that might be lost');
    
    // Change task type to one without the field
    await page.selectOption('select#taskType', { label: new RegExp('Type Without Field') });
    
    // Check for data loss warning
    const warningDialog = page.locator('div.modal', { hasText: 'Data Loss Warning' });
    await expect(warningDialog).toBeVisible();
    await expect(page.locator('div.modal', { hasText: 'custom field data will be lost' })).toBeVisible();
    
    // Confirm the change
    await page.click('button:has-text("Continue")');
    
    // Verify the custom fields section is now hidden
    await expect(page.locator('h4:has-text("Custom Fields")')).not.toBeVisible();
    
    // Save the task
    await page.click('button[type="submit"]');
    
    // Wait for save to complete
    await page.waitForLoadState('networkidle');
    
    // Go back to edit page to verify changes persisted
    await page.goto(`/tasks/${testTaskId}/edit`);
    
    // Verify task type is changed and field is still hidden
    await expect(page.locator('select#taskType')).toHaveValue(testTaskTypeWithoutFieldId);
    await expect(page.locator('h4:has-text("Custom Fields")')).not.toBeVisible();
    
    // Change back to task type with field
    await page.selectOption('select#taskType', { label: new RegExp('Type With Field') });
    
    // Verify custom field section is visible again but value is cleared
    await expect(page.locator('h4:has-text("Custom Fields")')).toBeVisible();
    const newFieldValue = await page.inputValue(`input[id^="field_"]`);
    expect(newFieldValue).toBe(''); // Value should be cleared after type switching
  });
});