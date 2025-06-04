import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { 
  createOrganization, 
  updateOrganization, 
  deleteOrganization,
  getOrganizationWithMembers,
  addUserToOrganization,
  removeUserFromOrganization,
  updateUserRole,
  CreateOrganizationInput 
} from '@/services/organizationService';

// Import Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Organization Service', () => {
  let testUserId: string;
  let testUser2Id: string;
  let testOrgId: string;
  let authToken: string;
  let authToken2: string;

  test.beforeAll(async () => {
    // Create test users
    const testUserEmail = `test-org-${uuidv4()}@example.com`;
    const testUser2Email = `test-org-2-${uuidv4()}@example.com`;
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
    // Clean up organization if created
    if (testOrgId) {
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
    
    // Clean up test users
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
    if (testUser2Id) {
      await supabase.auth.admin.deleteUser(testUser2Id);
    }
  });

  test.describe('createOrganization', () => {
    test('should create organization successfully', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const orgData: CreateOrganizationInput = {
        name: 'Test Organization',
        slug: 'test-org-' + uuidv4().substring(0, 8),
        description: 'A test organization',
        timezone: 'UTC'
      };

      const result = await createOrganization(supabaseClient, orgData, testUserId, 'test-trace');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe(orgData.name);
      expect(result.data!.slug).toBe(orgData.slug);
      
      testOrgId = result.data!.id;

      // Verify membership was created
      const { data: membership } = await supabase
        .from('user_organizations')
        .select('*')
        .eq('user_id', testUserId)
        .eq('organization_id', testOrgId)
        .single();

      expect(membership).toBeDefined();
      expect(membership.role).toBe('owner');
      expect(membership.is_primary).toBe(true);
    });

    test('should prevent creating second organization for same user', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const orgData: CreateOrganizationInput = {
        name: 'Second Organization',
        slug: 'second-org-' + uuidv4().substring(0, 8),
        description: 'A second test organization',
        timezone: 'UTC'
      };

      const result = await createOrganization(supabaseClient, orgData, testUserId, 'test-trace');

      expect(result.success).toBe(false);
      expect(result.error).toContain('only belong to one organization');
    });

    test('should prevent duplicate slug', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken2}` } }
      });

      // Try to create organization with same slug as existing one
      const orgData: CreateOrganizationInput = {
        name: 'Duplicate Slug Organization',
        slug: 'test-org-' + testOrgId.substring(0, 8), // Use part of existing org ID as slug
        description: 'Organization with duplicate slug',
        timezone: 'UTC'
      };

      // First get the actual slug from the created organization
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', testOrgId)
        .single();

      orgData.slug = existingOrg.slug;

      const result = await createOrganization(supabaseClient, orgData, testUser2Id, 'test-trace');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already taken');
    });
  });

  test.describe('updateOrganization', () => {
    test('should update organization successfully', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const updateData = {
        name: 'Updated Test Organization',
        description: 'Updated description'
      };

      const result = await updateOrganization(supabaseClient, testOrgId, updateData, 'test-trace');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe(updateData.name);
      expect(result.data!.description).toBe(updateData.description);
    });
  });

  test.describe('getOrganizationWithMembers', () => {
    test('should get organization with members', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const result = await getOrganizationWithMembers(supabaseClient, testOrgId, 'test-trace');

      expect(result).toBeDefined();
      expect(result!.id).toBe(testOrgId);
      expect(result!.members).toBeDefined();
      expect(result!.members.length).toBe(1);
      expect(result!.member_count).toBe(1);
      expect(result!.members[0].user_id).toBe(testUserId);
      expect(result!.members[0].role).toBe('owner');
    });
  });

  test.describe('addUserToOrganization', () => {
    test('should prevent adding user who already belongs to organization', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const result = await addUserToOrganization(supabaseClient, testUser2Id, testOrgId, 'member', testUserId, 'test-trace');

      expect(result.success).toBe(false);
      expect(result.error).toContain('only belong to one organization');
    });
  });

  test.describe('updateUserRole', () => {
    test('should prevent changing last owner role', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const result = await updateUserRole(supabaseClient, testUserId, testOrgId, 'admin', 'test-trace');

      expect(result.success).toBe(false);
      expect(result.error).toContain('last owner');
    });
  });

  test.describe('removeUserFromOrganization', () => {
    test('should prevent removing last owner', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const result = await removeUserFromOrganization(supabaseClient, testUserId, testOrgId, 'test-trace');

      expect(result.success).toBe(false);
      expect(result.error).toContain('last owner');
    });
  });

  test.describe('deleteOrganization', () => {
    test('should delete organization successfully', async () => {
      const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      });

      const result = await deleteOrganization(supabaseClient, testOrgId, 'test-trace');

      expect(result.success).toBe(true);

      // Verify organization is soft deleted
      const { data: deletedOrg } = await supabase
        .from('organizations')
        .select('is_active')
        .eq('id', testOrgId)
        .single();

      expect(deletedOrg.is_active).toBe(false);
    });
  });
});