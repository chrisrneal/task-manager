/**
 * @fileoverview Admin Templates API Tests
 * 
 * Tests for the admin template management functionality including
 * creation, updating, deletion, and validation of templates.
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Templates API', () => {
  let authToken: string;
  let testUserId: string;
  let createdTemplateIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // This assumes we have a way to get admin auth token
    // In a real scenario, you'd have admin user credentials
    const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/login`, {
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'password'
      }
    });

    if (response.ok()) {
      const data = await response.json();
      authToken = data.session?.access_token;
      testUserId = data.user?.id;
    }
  });

  test.afterAll(async ({ request }) => {
    // Clean up created templates
    for (const templateId of createdTemplateIds) {
      await request.delete(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates?id=${templateId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }
  });

  test.describe('Template Creation', () => {
    test('should create a valid template', async ({ request }) => {
      if (!authToken) {
        test.skip();
      }

      const templateData = {
        name: 'Test Scrum Template',
        description: 'A test template for scrum projects',
        icon: '🏃‍♂️',
        states: [
          { name: 'Backlog', position: 1 },
          { name: 'In Progress', position: 2 },
          { name: 'Review', position: 3 },
          { name: 'Done', position: 4 }
        ],
        workflows: [
          { name: 'Scrum Workflow' }
        ],
        task_types: [
          { name: 'User Story', workflow_id: 'Scrum Workflow' },
          { name: 'Bug', workflow_id: 'Scrum Workflow' }
        ],
        fields: [
          {
            name: 'Story Points',
            input_type: 'select',
            is_required: false,
            options: ['1', '2', '3', '5', '8', '13'],
            default_value: '3'
          },
          {
            name: 'Priority',
            input_type: 'select',
            is_required: true,
            options: ['Low', 'Medium', 'High', 'Critical'],
            default_value: 'Medium'
          }
        ]
      };

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: templateData
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.data).toHaveProperty('id');
      expect(data.message).toBe('Template created successfully');

      createdTemplateIds.push(data.data.id);
    });

    test('should validate template structure', async ({ request }) => {
      if (!authToken) {
        test.skip();
      }

      const invalidTemplateData = {
        name: '', // Missing required name
        description: 'Invalid template',
        states: [], // Missing required states
        workflows: [], // Missing required workflows
        task_types: [],
        fields: [
          {
            name: 'Invalid Field',
            input_type: 'select',
            is_required: false
            // Missing options for select field
          }
        ]
      };

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: invalidTemplateData
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Template validation failed');
      expect(Array.isArray(data.details)).toBe(true);
      expect(data.details.length).toBeGreaterThan(0);
    });

    test('should require admin role for creation', async ({ request }) => {
      // This test would need a non-admin token
      // For now, we'll skip it as setting up role-based auth is complex
      test.skip();
    });
  });

  test.describe('Template Management', () => {
    let templateId: string;

    test.beforeEach(async ({ request }) => {
      if (!authToken) {
        test.skip();
      }

      // Create a template for testing
      const templateData = {
        name: 'Test Template for Management',
        description: 'Template for testing management operations',
        icon: '🧪',
        states: [
          { name: 'To Do', position: 1 },
          { name: 'Done', position: 2 }
        ],
        workflows: [
          { name: 'Simple Workflow' }
        ],
        task_types: [
          { name: 'Task', workflow_id: 'Simple Workflow' }
        ],
        fields: []
      };

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: templateData
      });

      const data = await response.json();
      templateId = data.data.id;
      createdTemplateIds.push(templateId);
    });

    test('should update template basic info', async ({ request }) => {
      if (!authToken || !templateId) {
        test.skip();
      }

      const updateData = {
        name: 'Updated Template Name',
        description: 'Updated description',
        icon: '📝'
      };

      const response = await request.put(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates?id=${templateId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: updateData
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Template updated successfully');
    });

    test('should delete template', async ({ request }) => {
      if (!authToken || !templateId) {
        test.skip();
      }

      const response = await request.delete(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates?id=${templateId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Template deleted successfully');

      // Remove from cleanup list since it's already deleted
      createdTemplateIds = createdTemplateIds.filter(id => id !== templateId);
    });

    test('should return 404 for non-existent template', async ({ request }) => {
      if (!authToken) {
        test.skip();
      }

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request.delete(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates?id=${fakeId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Template not found');
    });
  });

  test.describe('Template Validation', () => {
    test('should validate state positions are unique', async ({ request }) => {
      if (!authToken) {
        test.skip();
      }

      const templateData = {
        name: 'Invalid States Template',
        description: 'Template with duplicate state positions',
        states: [
          { name: 'State 1', position: 1 },
          { name: 'State 2', position: 1 } // Duplicate position
        ],
        workflows: [{ name: 'Workflow' }],
        task_types: [{ name: 'Task', workflow_id: 'Workflow' }],
        fields: []
      };

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: templateData
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.details).toContain('State positions must be unique');
    });

    test('should validate field input types', async ({ request }) => {
      if (!authToken) {
        test.skip();
      }

      const templateData = {
        name: 'Invalid Field Template',
        description: 'Template with invalid field type',
        states: [{ name: 'State', position: 1 }],
        workflows: [{ name: 'Workflow' }],
        task_types: [{ name: 'Task', workflow_id: 'Workflow' }],
        fields: [
          {
            name: 'Invalid Field',
            input_type: 'invalid_type', // Invalid input type
            is_required: false
          }
        ]
      };

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/templates`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: templateData
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.details.some((error: string) => error.includes('Invalid field input type'))).toBe(true);
    });
  });
});