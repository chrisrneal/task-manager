import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Project, Field } from '@/types/database';

// Environment variables should be set in test environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe('Fields API Tests', () => {
  let client: SupabaseClient;
  let testProject: Project;
  let testField: Field;
  let userId: string;

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
    
    return { 
      client: createClient(supabaseUrl!, supabaseAnonKey!),
      id: data.user!.id
    };
  };

  beforeEach(async () => {
    // Create test user
    const userData = await createTestUser();
    client = userData.client;
    userId = userData.id;
    
    // Create a test project
    const { data: projectData, error: projectError } = await client
      .from('projects')
      .insert([
        {
          name: `Test Project ${uuidv4()}`,
          description: 'Test project for field API tests',
          user_id: userId
        }
      ])
      .select()
      .single();
      
    if (projectError) throw projectError;
    testProject = projectData;
    
    // Create a test field
    const { data: fieldData, error: fieldError } = await client
      .from('fields')
      .insert([
        {
          name: `Test Field ${uuidv4()}`,
          project_id: testProject.id,
          input_type: 'text',
          is_required: false
        }
      ])
      .select()
      .single();
      
    if (fieldError) throw fieldError;
    testField = fieldData;
  });

  afterEach(async () => {
    // Clean up by deleting the test project
    // This should cascade delete all fields
    if (testProject) {
      await client
        .from('projects')
        .delete()
        .eq('id', testProject.id);
    }
  });

  it('should get all fields for a project', async () => {
    const { data, error } = await client
      .from('fields')
      .select('*')
      .eq('project_id', testProject.id);
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.find(f => f.id === testField.id)).toBeDefined();
  });

  it('should get a specific field by ID', async () => {
    const { data, error } = await client
      .from('fields')
      .select('*')
      .eq('id', testField.id)
      .single();
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(testField.id);
    expect(data!.name).toBe(testField.name);
  });

  it('should create a new field', async () => {
    const newFieldName = `New Test Field ${uuidv4()}`;
    
    const { data, error } = await client
      .from('fields')
      .insert([
        {
          name: newFieldName,
          project_id: testProject.id,
          input_type: 'number',
          is_required: true
        }
      ])
      .select()
      .single();
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe(newFieldName);
    expect(data!.input_type).toBe('number');
    expect(data!.is_required).toBe(true);
  });

  it('should update a field', async () => {
    const updatedName = `Updated Field ${uuidv4()}`;
    
    const { data, error } = await client
      .from('fields')
      .update({ 
        name: updatedName,
        is_required: true 
      })
      .eq('id', testField.id)
      .select()
      .single();
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(testField.id);
    expect(data!.name).toBe(updatedName);
    expect(data!.is_required).toBe(true);
  });

  it('should delete a field', async () => {
    // First create a field we'll delete
    const { data: tempField, error: createError } = await client
      .from('fields')
      .insert([
        {
          name: `Temp Field ${uuidv4()}`,
          project_id: testProject.id,
          input_type: 'text',
          is_required: false
        }
      ])
      .select()
      .single();
      
    expect(createError).toBeNull();
    
    // Delete the field
    const { error: deleteError } = await client
      .from('fields')
      .delete()
      .eq('id', tempField!.id);
      
    expect(deleteError).toBeNull();
    
    // Verify it's gone
    const { data, error } = await client
      .from('fields')
      .select('*')
      .eq('id', tempField!.id);
      
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});