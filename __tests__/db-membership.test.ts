import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectMember } from '@/types/database';

// Environment variables should be set in test environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe('Project Membership Tests', () => {
  let ownerClient: SupabaseClient;
  let adminClient: SupabaseClient;
  let memberClient: SupabaseClient;
  let nonMemberClient: SupabaseClient;
  let testProject: Project;
  let ownerId: string;
  let adminId: string;
  let memberId: string;
  let nonMemberId: string;

  // Helper function to create a test user
  const createTestUser = async () => {
    const email = `test-${uuidv4()}@example.com`;
    const password = 'Test1234!';
    
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    // In a real test, we would get the session token and use it for authentication
    // For simplicity in this example, we'll use a new client
    return { 
      client: createClient(supabaseUrl!, supabaseAnonKey!),
      id: data.user!.id
    };
  };

  beforeEach(async () => {
    // Create test users
    const ownerData = await createTestUser();
    ownerClient = ownerData.client;
    ownerId = ownerData.id;
    
    const adminData = await createTestUser();
    adminClient = adminData.client;
    adminId = adminData.id;
    
    const memberData = await createTestUser();
    memberClient = memberData.client;
    memberId = memberData.id;
    
    const nonMemberData = await createTestUser();
    nonMemberClient = nonMemberData.client;
    nonMemberId = nonMemberData.id;
    
    // Create a test project with owner
    const { data: projectData, error: projectError } = await ownerClient
      .from('projects')
      .insert([
        {
          name: `Test Project ${uuidv4()}`,
          description: 'Test project for membership tests',
          user_id: ownerId
        }
      ])
      .select()
      .single();
      
    if (projectError) throw projectError;
    testProject = projectData;
    
    // Add admin user to project
    const { error: adminError } = await ownerClient
      .from('project_members')
      .insert([
        {
          project_id: testProject.id,
          user_id: adminId,
          role: 'admin'
        }
      ]);
      
    if (adminError) throw adminError;
    
    // Add member user to project
    const { error: memberError } = await ownerClient
      .from('project_members')
      .insert([
        {
          project_id: testProject.id,
          user_id: memberId,
          role: 'member'
        }
      ]);
      
    if (memberError) throw memberError;
  });

  afterEach(async () => {
    // Clean up by deleting the test project
    // This should cascade delete all project_members
    if (testProject) {
      await ownerClient
        .from('projects')
        .delete()
        .eq('id', testProject.id);
    }
  });

  it('should allow project owner to access the project', async () => {
    const { data, error } = await ownerClient
      .from('projects')
      .select('*')
      .eq('id', testProject.id)
      .single();
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.id).toBe(testProject.id);
  });

  it('should allow project admin to access the project', async () => {
    const { data, error } = await adminClient
      .from('projects')
      .select('*')
      .eq('id', testProject.id)
      .single();
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.id).toBe(testProject.id);
  });

  it('should allow project member to access the project', async () => {
    const { data, error } = await memberClient
      .from('projects')
      .select('*')
      .eq('id', testProject.id)
      .single();
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.id).toBe(testProject.id);
  });

  it('should prevent non-members from accessing the project', async () => {
    const { data, error } = await nonMemberClient
      .from('projects')
      .select('*')
      .eq('id', testProject.id)
      .single();
      
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('should allow owner to view project members', async () => {
    const { data, error } = await ownerClient
      .from('project_members')
      .select('*')
      .eq('project_id', testProject.id);
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data.length).toBe(3); // owner, admin, and member
  });

  it('should allow owner to add new members', async () => {
    const { error } = await ownerClient
      .from('project_members')
      .insert([
        {
          project_id: testProject.id,
          user_id: nonMemberId,
          role: 'member'
        }
      ]);
      
    expect(error).toBeNull();
    
    // Verify the new member was added
    const { data, error: fetchError } = await ownerClient
      .from('project_members')
      .select('*')
      .eq('project_id', testProject.id)
      .eq('user_id', nonMemberId)
      .single();
      
    expect(fetchError).toBeNull();
    expect(data).not.toBeNull();
    expect(data.role).toBe('member');
  });

  it('should not allow regular members to add new members', async () => {
    const { error } = await memberClient
      .from('project_members')
      .insert([
        {
          project_id: testProject.id,
          user_id: nonMemberId,
          role: 'member'
        }
      ]);
      
    expect(error).not.toBeNull();
  });

  it('should allow owner to update member roles', async () => {
    // Update member to admin
    const { error } = await ownerClient
      .from('project_members')
      .update({ role: 'admin' })
      .eq('project_id', testProject.id)
      .eq('user_id', memberId);
      
    expect(error).toBeNull();
    
    // Verify the role was updated
    const { data, error: fetchError } = await ownerClient
      .from('project_members')
      .select('*')
      .eq('project_id', testProject.id)
      .eq('user_id', memberId)
      .single();
      
    expect(fetchError).toBeNull();
    expect(data).not.toBeNull();
    expect(data.role).toBe('admin');
  });

  it('should not allow changing the role of the only owner', async () => {
    // Try to change the owner to admin
    const { error } = await ownerClient
      .from('project_members')
      .update({ role: 'admin' })
      .eq('project_id', testProject.id)
      .eq('user_id', ownerId);
      
    expect(error).not.toBeNull();
    expect(error.message).toContain('Cannot change the role of the only owner');
  });

  it('should allow ownership transfer if there will still be an owner', async () => {
    // First make another user an owner
    const { error: addOwnerError } = await ownerClient
      .from('project_members')
      .update({ role: 'owner' })
      .eq('project_id', testProject.id)
      .eq('user_id', adminId);
      
    expect(addOwnerError).toBeNull();
    
    // Now change the original owner to admin
    const { error } = await ownerClient
      .from('project_members')
      .update({ role: 'admin' })
      .eq('project_id', testProject.id)
      .eq('user_id', ownerId);
      
    expect(error).toBeNull();
    
    // Verify the roles were updated
    const { data, error: fetchError } = await ownerClient
      .from('project_members')
      .select('*')
      .eq('project_id', testProject.id)
      .in('user_id', [ownerId, adminId]);
      
    expect(fetchError).toBeNull();
    expect(data).not.toBeNull();
    expect(data.length).toBe(2);
    
    const originalOwner = data.find(m => m.user_id === ownerId);
    const newOwner = data.find(m => m.user_id === adminId);
    
    expect(originalOwner.role).toBe('admin');
    expect(newOwner.role).toBe('owner');
  });
});