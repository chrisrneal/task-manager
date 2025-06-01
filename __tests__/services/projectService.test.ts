import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { applyTemplateToProject, getTemplateWithDetails } from '../../services/projectService';
import { Project, ProjectTemplateWithDetails } from '../../types/database';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Project Service', () => {
  let testUserId: string;
  let testProject: Project;
  let authToken: string;
  let authenticatedSupabase: any;

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

    // Sign in to get token and authenticated client
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testPassword
    });

    if (signInError || !signInData.session) {
      throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    authToken = signInData.session.access_token;

    // Create authenticated Supabase client
    authenticatedSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${authToken}` } }
    });

    // Create a test project
    const { data: project, error: projectError } = await authenticatedSupabase
      .from('projects')
      .insert([{
        name: 'Test Project for Service',
        description: 'Test project for service testing',
        user_id: testUserId
      }])
      .select()
      .single();

    if (projectError || !project) {
      throw new Error(`Failed to create test project: ${projectError?.message}`);
    }

    testProject = project;
  });

  test.afterAll(async () => {
    // Clean up test data
    if (testProject?.id) {
      await supabase.from('projects').delete().eq('id', testProject.id);
    }
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  test.describe('getTemplateWithDetails', () => {
    test('should fetch template with all details', async () => {
      // Get available templates first
      const { data: templates } = await authenticatedSupabase
        .from('project_templates')
        .select('id')
        .limit(1);

      if (!templates || templates.length === 0) {
        test.skip('No templates available for testing');
      }

      const templateId = templates[0].id;
      const traceId = uuidv4();

      const template = await getTemplateWithDetails(authenticatedSupabase, templateId, traceId);

      expect(template).not.toBeNull();
      if (template) {
        expect(template.id).toBe(templateId);
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('icon');
        expect(template).toHaveProperty('created_at');
        expect(template).toHaveProperty('updated_at');
        expect(Array.isArray(template.states)).toBe(true);
        expect(Array.isArray(template.workflows)).toBe(true);
        expect(Array.isArray(template.task_types)).toBe(true);
        expect(Array.isArray(template.fields)).toBe(true);
      }
    });

    test('should return null for non-existent template', async () => {
      const traceId = uuidv4();
      const fakeTemplateId = uuidv4();

      const template = await getTemplateWithDetails(authenticatedSupabase, fakeTemplateId, traceId);

      expect(template).toBeNull();
    });
  });

  test.describe('applyTemplateToProject', () => {
    test('should apply template to project successfully', async () => {
      // Get available templates first
      const { data: templates } = await authenticatedSupabase
        .from('project_templates')
        .select('id')
        .limit(1);

      if (!templates || templates.length === 0) {
        test.skip('No templates available for testing');
      }

      const templateId = templates[0].id;
      const traceId = uuidv4();

      // Get template details
      const template = await getTemplateWithDetails(authenticatedSupabase, templateId, traceId);
      
      if (!template) {
        test.skip('Failed to fetch template details');
      }

      // Apply template to project
      const result = await applyTemplateToProject(authenticatedSupabase, testProject, template!, traceId);

      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify that data was actually created in the database
      // Check states
      const { data: states } = await authenticatedSupabase
        .from('project_states')
        .select('*')
        .eq('project_id', testProject.id);

      if (template!.states.length > 0) {
        expect(states).not.toBeNull();
        expect(states!.length).toBe(template!.states.length);
        
        // Verify state names and positions match
        for (let i = 0; i < states!.length; i++) {
          const projectState = states!.find(s => s.position === template!.states[i].position);
          expect(projectState).toBeDefined();
          expect(projectState!.name).toBe(template!.states[i].name);
        }
      }

      // Check workflows
      const { data: workflows } = await authenticatedSupabase
        .from('workflows')
        .select('*')
        .eq('project_id', testProject.id);

      if (template!.workflows.length > 0) {
        expect(workflows).not.toBeNull();
        expect(workflows!.length).toBe(template!.workflows.length);
        
        // Verify workflow names match
        const workflowNames = workflows!.map(w => w.name).sort();
        const templateWorkflowNames = template!.workflows.map(w => w.name).sort();
        expect(workflowNames).toEqual(templateWorkflowNames);
      }

      // Check task types
      const { data: taskTypes } = await authenticatedSupabase
        .from('task_types')
        .select('*')
        .eq('project_id', testProject.id);

      if (template!.task_types.length > 0) {
        expect(taskTypes).not.toBeNull();
        expect(taskTypes!.length).toBe(template!.task_types.length);
        
        // Verify task type names match
        const taskTypeNames = taskTypes!.map(t => t.name).sort();
        const templateTaskTypeNames = template!.task_types.map(t => t.name).sort();
        expect(taskTypeNames).toEqual(templateTaskTypeNames);
      }

      // Check fields
      const { data: fields } = await authenticatedSupabase
        .from('fields')
        .select('*')
        .eq('project_id', testProject.id);

      if (template!.fields.length > 0) {
        expect(fields).not.toBeNull();
        expect(fields!.length).toBe(template!.fields.length);
        
        // Verify field names and types match
        for (const templateField of template!.fields) {
          const projectField = fields!.find(f => f.name === templateField.name);
          expect(projectField).toBeDefined();
          expect(projectField!.input_type).toBe(templateField.input_type);
          expect(projectField!.is_required).toBe(templateField.is_required);
        }
      }

      // Check workflow steps if workflows and states exist
      if (template!.workflows.length > 0 && template!.states.length > 0) {
        const { data: workflowSteps } = await authenticatedSupabase
          .from('workflow_steps')
          .select('*, workflows!inner(*)')
          .eq('workflows.project_id', testProject.id);

        expect(workflowSteps).not.toBeNull();
        if (workflowSteps && workflowSteps.length > 0) {
          expect(workflowSteps.length).toBeGreaterThan(0);
        }
      }

      // Check task type field associations if task types and fields exist
      if (template!.task_types.length > 0 && template!.fields.length > 0) {
        const { data: taskTypeFields } = await authenticatedSupabase
          .from('task_type_fields')
          .select('*, task_types!inner(*)')
          .eq('task_types.project_id', testProject.id);

        // May or may not have associations depending on the template
        if (taskTypeFields) {
          expect(Array.isArray(taskTypeFields)).toBe(true);
        }
      }
    });

    test('should handle empty template gracefully', async () => {
      const traceId = uuidv4();
      
      // Create a minimal empty template
      const emptyTemplate: ProjectTemplateWithDetails = {
        id: uuidv4(),
        name: 'Empty Template',
        description: 'Template with no content',
        icon: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        states: [],
        workflows: [],
        task_types: [],
        fields: []
      };

      const result = await applyTemplateToProject(authenticatedSupabase, testProject, emptyTemplate, traceId);

      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  test.describe('error handling', () => {
    test('should handle database errors gracefully', async () => {
      // Create an invalid supabase client to simulate database errors
      const invalidSupabase = createClient(supabaseUrl, 'invalid-key');
      
      const traceId = uuidv4();
      const fakeTemplateId = uuidv4();

      try {
        await getTemplateWithDetails(invalidSupabase, fakeTemplateId, traceId);
        // Should throw an error
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});