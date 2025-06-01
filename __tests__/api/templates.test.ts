import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Templates API', () => {
  let testUserId: string;
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
  });

  test.afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test.describe('GET /api/templates', () => {
    test('should fetch available templates', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.traceId).toBeDefined();
      
      // If templates exist, check their structure
      if (data.data.length > 0) {
        const template = data.data[0];
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('icon');
        expect(template).toHaveProperty('created_at');
        expect(template).toHaveProperty('updated_at');
        expect(template).toHaveProperty('states');
        expect(template).toHaveProperty('workflows');
        expect(template).toHaveProperty('task_types');
        expect(template).toHaveProperty('fields');
        expect(Array.isArray(template.states)).toBe(true);
        expect(Array.isArray(template.workflows)).toBe(true);
        expect(Array.isArray(template.task_types)).toBe(true);
        expect(Array.isArray(template.fields)).toBe(true);
      }
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`);

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });

    test('should only allow GET method', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {}
      });

      expect(response.status()).toBe(405);
      const data = await response.json();
      expect(data.error).toContain('not allowed');
    });
  });
});

test.describe('Project Creation with Templates', () => {
  let testUserId: string;
  let authToken: string;
  let createdProjectIds: string[] = [];

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
  });

  test.afterAll(async () => {
    // Clean up created projects
    for (const projectId of createdProjectIds) {
      await supabase.from('projects').delete().eq('id', projectId);
    }
    
    // Clean up test user
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test.describe('POST /api/projects without template', () => {
    test('should create project without template (fallback to manual setup)', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Manual Setup Project',
          description: 'Project created without template'
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.data).toHaveProperty('id');
      expect(data.data.name).toBe('Manual Setup Project');
      expect(data.data.description).toBe('Project created without template');
      expect(data.data.user_id).toBe(testUserId);
      
      createdProjectIds.push(data.data.id);
    });
  });

  test.describe('POST /api/projects with template', () => {
    let availableTemplateId: string;

    test.beforeAll(async () => {
      // Fetch available templates to get a valid template ID
      const { data: templates, error } = await supabase
        .from('project_templates')
        .select('id')
        .limit(1);

      if (error || !templates || templates.length === 0) {
        // Skip template tests if no templates are available
        test.skip();
      } else {
        availableTemplateId = templates[0].id;
      }
    });

    test('should create project with template and apply template structure', async ({ request }) => {
      if (!availableTemplateId) {
        test.skip();
      }

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Template-Based Project',
          description: 'Project created with template',
          template_id: availableTemplateId
        }
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.data).toHaveProperty('id');
      expect(data.data.name).toBe('Template-Based Project');
      expect(data.data.description).toBe('Project created with template');
      expect(data.data.user_id).toBe(testUserId);
      
      const projectId = data.data.id;
      createdProjectIds.push(projectId);

      // Verify that template data was applied to the project
      // Check states
      const { data: states } = await supabase
        .from('project_states')
        .select('*')
        .eq('project_id', projectId);
      
      if (states) {
        expect(states.length).toBeGreaterThan(0);
      }

      // Check workflows
      const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('project_id', projectId);
      
      if (workflows) {
        expect(workflows.length).toBeGreaterThan(0);
      }

      // Check task types
      const { data: taskTypes } = await supabase
        .from('task_types')
        .select('*')
        .eq('project_id', projectId);
      
      if (taskTypes) {
        expect(taskTypes.length).toBeGreaterThan(0);
      }

      // Check fields
      const { data: fields } = await supabase
        .from('fields')
        .select('*')
        .eq('project_id', projectId);
      
      if (fields) {
        expect(fields.length).toBeGreaterThan(0);
      }
    });

    test('should handle invalid template ID', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Invalid Template Project',
          description: 'Project with invalid template',
          template_id: uuidv4() // Random UUID that doesn't exist
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Template not found');
    });

    test('should handle empty template ID gracefully', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Empty Template Project',
          description: 'Project with empty template ID',
          template_id: ''
        }
      });

      // Should either create successfully (empty template_id treated as null) or fail with validation error
      expect([201, 400]).toContain(response.status());
      
      if (response.status() === 201) {
        const data = await response.json();
        createdProjectIds.push(data.data.id);
      }
    });
  });

  test.describe('Project creation validation', () => {
    test('should require project name', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          description: 'Project without name'
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Project name is required');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/projects`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Unauthorized Project'
        }
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });
  });
});