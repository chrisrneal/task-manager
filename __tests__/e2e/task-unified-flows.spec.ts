import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Unified Task Page Flows E2E Tests', () => {
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
        description: 'E2E Test Project for Unified Flows',
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
        description: 'E2E Test Task Type for Unified Flows',
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
        description: 'E2E Test Field for Unified Flows',
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
    await supabase.from('tasks').delete().match({ project_id: testProjectId });
    await supabase.from('task_type_fields').delete().match({ field_id: testFieldId });
    await supabase.from('fields').delete().match({ id: testFieldId });
    await supabase.from('task_types').delete().match({ id: testTaskTypeId });
    await supabase.from('projects').delete().match({ id: testProjectId });
    await supabase.auth.admin.deleteUser(testUserId);
  });

  test('Complete flow: create, view, and edit task with custom fields', async ({ page }) => {
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
    
    // STEP 1: CREATE TASK
    
    // Click 'Add Task' button
    await page.click('button:has-text("Add Task")');
    
    // Wait for the task form to appear
    await page.waitForSelector('form h2:has-text("Create Task")');
    
    const taskName = `Unified Flow Test Task ${uuidv4().slice(0, 8)}`;
    
    // Fill in the task details
    await page.fill('input[name="name"]', taskName);
    await page.fill('textarea[name="description"]', 'Testing unified create-view-edit flow');
    
    // Select the test task type
    await page.selectOption('select#taskType', { label: new RegExp(`Test Task Type`) });
    
    // Wait for custom fields to load
    await page.waitForSelector('h4:has-text("Custom Fields")');
    
    // Fill in the custom field
    await page.fill(`input[id^="field_"]`, 'Initial custom field value');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for redirect back to the project page
    await page.waitForSelector('.task-card', { timeout: 10000 });
    
    // STEP 2: VIEW TASK
    
    // Find and click on the newly created task
    await page.click(`.task-card:has-text("${taskName}")`);
    
    // Wait for the task view page to load
    await page.waitForSelector(`h1:has-text("${taskName}")`);
    
    // Verify the task details are displayed correctly
    await expect(page.locator('div', { hasText: 'Testing unified create-view-edit flow' })).toBeVisible();
    
    // Verify the custom field value is displayed
    await expect(page.locator('div.field-value', { hasText: 'Initial custom field value' })).toBeVisible();
    
    // STEP 3: EDIT TASK
    
    // Click the Edit button
    await page.click('button:has-text("Edit")');
    
    // Wait for the edit form to appear
    await page.waitForSelector('form h2:has-text("Edit Task")');
    
    // Verify the form is pre-populated with existing values
    await expect(page.locator('input[name="name"]')).toHaveValue(taskName);
    await expect(page.locator('textarea[name="description"]')).toHaveValue('Testing unified create-view-edit flow');
    await expect(page.locator(`input[id^="field_"]`)).toHaveValue('Initial custom field value');
    
    // Update the task values
    const updatedTaskName = `${taskName} (Updated)`;
    await page.fill('input[name="name"]', updatedTaskName);
    await page.fill('textarea[name="description"]', 'Updated description for unified flow test');
    await page.fill(`input[id^="field_"]`, 'Updated custom field value');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for redirect back to the task view page
    await page.waitForSelector(`h1:has-text("${updatedTaskName}")`);
    
    // Verify the updated task details are displayed correctly
    await expect(page.locator('div', { hasText: 'Updated description for unified flow test' })).toBeVisible();
    
    // Verify the updated custom field value is displayed
    await expect(page.locator('div.field-value', { hasText: 'Updated custom field value' })).toBeVisible();
    
    // STEP 4: NAVIGATE BACK TO PROJECT VIEW
    
    // Click back to project
    await page.click('a:has-text("Back to Project")');
    
    // Verify we're back at the project page
    await page.waitForSelector(`h1:has-text("Test Project")`);
    
    // Verify the updated task is in the list
    await expect(page.locator(`.task-card:has-text("${updatedTaskName}")`)).toBeVisible();
  });
});