import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Organizations API', () => {
  let testUserId: string;
  let testUser2Id: string;
  let authToken: string;
  let authToken2: string;
  let createdOrganizationIds: string[] = [];

  test.beforeAll(async () => {
    // Create test users
    const testUserEmail = `test-org-api-${uuidv4()}@example.com`;
    const testUser2Email = `test-org-api-2-${uuidv4()}@example.com`;
    const testPassword = 'test123456';

    // Create first user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: testPassword,
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    testUserId = authData.user.id;

    // Create second user
    const { data: authData2, error: authError2 } = await supabase.auth.admin.createUser({
      email: testUser2Email,
      password: testPassword,
      email_confirm: true
    });

    if (authError2 || !authData2.user) {
      throw new Error(`Failed to create test user 2: ${authError2?.message}`);
    }

    testUser2Id = authData2.user.id;

    // Sign in to get tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testPassword
    });

    if (signInError || !signInData.session) {
      throw new Error(`Failed to sign in test user: ${signInError?.message}`);
    }

    authToken = signInData.session.access_token;

    const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword({
      email: testUser2Email,
      password: testPassword
    });

    if (signInError2 || !signInData2.session) {
      throw new Error(`Failed to sign in test user 2: ${signInError2?.message}`);
    }

    authToken2 = signInData2.session.access_token;
  });

  test.afterAll(async () => {
    // Clean up created organizations
    for (const orgId of createdOrganizationIds) {
      await supabase.from('organizations').delete().eq('id', orgId);
    }
    
    // Clean up test users
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
    if (testUser2Id) {
      await supabase.auth.admin.deleteUser(testUser2Id);
    }
  });

  test.describe('GET /api/organizations', () => {
    test('should list organizations for authenticated user', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.traceId).toBeDefined();
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`);

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });
  });

  test.describe('POST /api/organizations', () => {
    test('should create organization successfully', async ({ request }) => {
      const organizationData = {
        name: 'Test API Organization',
        slug: 'test-api-org-' + uuidv4().substring(0, 8),
        description: 'Organization created via API test',
        timezone: 'UTC'
      };

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: organizationData
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.data).toHaveProperty('id');
      expect(data.data.name).toBe(organizationData.name);
      expect(data.data.slug).toBe(organizationData.slug);
      expect(data.data.description).toBe(organizationData.description);
      expect(data.traceId).toBeDefined();
      
      createdOrganizationIds.push(data.data.id);

      // Verify membership was created
      const { data: membership } = await supabase
        .from('user_organizations')
        .select('*')
        .eq('user_id', testUserId)
        .eq('organization_id', data.data.id)
        .single();

      expect(membership).toBeDefined();
      expect(membership.role).toBe('owner');
      expect(membership.is_primary).toBe(true);
    });

    test('should require organization name', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          slug: 'no-name-org'
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Organization name is required');
    });

    test('should require organization slug', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'No Slug Organization'
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Organization slug is required');
    });

    test('should validate slug format', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Invalid Slug Organization',
          slug: 'invalid slug with spaces!'
        }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('slug can only contain');
    });

    test('should prevent duplicate slugs', async ({ request }) => {
      // Get existing organization slug
      const existingSlug = 'test-api-org-' + uuidv4().substring(0, 8);
      
      // Create first organization
      await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken2}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'First Organization',
          slug: existingSlug
        }
      });

      // Try to create second organization with same slug
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Duplicate Slug Organization',
          slug: existingSlug
        }
      });

      expect(response.status()).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already taken');
    });

    test('should prevent user from creating second organization', async ({ request }) => {
      // User already has an organization from previous test
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Second Organization',
          slug: 'second-org-' + uuidv4().substring(0, 8)
        }
      });

      expect(response.status()).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('only belong to one organization');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Unauthorized Organization',
          slug: 'unauthorized-org'
        }
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });
  });

  test.describe('Individual organization endpoints', () => {
    let organizationId: string;

    test.beforeAll(async ({ request }) => {
      // Create an organization for testing individual endpoints
      // Use a fresh user token to ensure we can create
      const testUser3Email = `test-org-api-3-${uuidv4()}@example.com`;
      const testPassword = 'test123456';

      const { data: authData3, error: authError3 } = await supabase.auth.admin.createUser({
        email: testUser3Email,
        password: testPassword,
        email_confirm: true
      });

      if (authError3 || !authData3.user) {
        throw new Error(`Failed to create test user 3: ${authError3?.message}`);
      }

      const { data: signInData3, error: signInError3 } = await supabase.auth.signInWithPassword({
        email: testUser3Email,
        password: testPassword
      });

      if (signInError3 || !signInData3.session) {
        throw new Error(`Failed to sign in test user 3: ${signInError3?.message}`);
      }

      const authToken3 = signInData3.session.access_token;

      const response = await request.post(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
        headers: {
          'Authorization': `Bearer ${authToken3}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: 'Individual Test Organization',
          slug: 'individual-test-org-' + uuidv4().substring(0, 8),
          description: 'Organization for individual endpoint testing'
        }
      });

      const data = await response.json();
      organizationId = data.data.id;
      createdOrganizationIds.push(organizationId);
    });

    test.describe('GET /api/organizations/[id]', () => {
      test('should get organization details with members', async ({ request }) => {
        const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations/${organizationId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.data).toHaveProperty('id');
        expect(data.data.id).toBe(organizationId);
        expect(data.data).toHaveProperty('members');
        expect(Array.isArray(data.data.members)).toBe(true);
        expect(data.data).toHaveProperty('member_count');
        expect(data.traceId).toBeDefined();
      });

      test('should return 404 for non-existent organization', async ({ request }) => {
        const fakeId = uuidv4();
        const response = await request.get(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations/${fakeId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        expect(response.status()).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Organization not found');
      });
    });
  });

  test.describe('Method validation', () => {
    test('should only allow GET and POST for /api/organizations', async ({ request }) => {
      const response = await request.patch(`${process.env.NEXT_PUBLIC_APP_URL}/api/organizations`, {
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