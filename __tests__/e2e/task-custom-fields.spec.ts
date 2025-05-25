import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Task Custom Fields E2E Tests', () => {
  let testUserId: string;
  let testProjectId: string;
  let testTaskTypeId: string;
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
        description: 'E2E Test Project for Custom Fields',
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
        description: 'E2E Test Task Type',
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
        description: 'E2E Test Field',
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
  });

  test.afterAll(async () => {
    // Clean up test data - delete in reverse order of creation
    await supabase.from('task_field_values').delete().match({ field_id: testFieldId });
    await supabase.from('task_type_fields').delete().match({ field_id: testFieldId });
    await supabase.from('fields').delete().match({ id: testFieldId });
    await supabase.from('tasks').delete().match({ project_id: testProjectId });
    await supabase.from('task_types').delete().match({ id: testTaskTypeId });
    await supabase.from('projects').delete().match({ id: testProjectId });
    await supabase.auth.admin.deleteUser(testUserId);
  });

  test('Create a task with custom fields', async ({ page }) => {
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
    
    // Click 'Add Task' button
    await page.click('button:has-text("Add Task")');
    
    // Wait for the task form to appear
    await page.waitForSelector('form h2:has-text("Create Task")');
    
    // Fill in the task details
    await page.fill('input[name="name"]', 'E2E Test Task with Custom Field');
    await page.fill('textarea[name="description"]', 'This is a test task created via E2E test');
    
    // Select the test task type
    await page.selectOption('select#taskType', { label: new RegExp(`Test Task Type`) });
    
    // Wait for custom fields to load
    await page.waitForSelector('h4:has-text("Custom Fields")');
    
    // Fill in the custom field
    await page.fill(`input[id^="field_"]`, 'Custom field value from E2E test');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to the task page (or project page depending on app flow)
    await page.waitForLoadState('networkidle');
    
    // Verify the task was created by checking for a success message or the task in the list
    await expect(page.locator('div.task-card', { hasText: 'E2E Test Task with Custom Field' })).toBeVisible();
  });
});