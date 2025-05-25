import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Project, Field, TaskType } from '@/types/database';

// Environment variables should be set in test environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe('Task Type Fields API Tests', () => {
  let client: SupabaseClient;
  let testProject: Project;
  let testTaskType: TaskType;
  let testField1: Field;
  let testField2: Field;
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
          description: 'Test project for task type fields API tests',
          user_id: userId
        }
      ])
      .select()
      .single();
      
    if (projectError) throw projectError;
    testProject = projectData;
    
    // Create a test task type
    const { data: taskTypeData, error: taskTypeError } = await client
      .from('task_types')
      .insert([
        {
          name: `Test Task Type ${uuidv4()}`,
          project_id: testProject.id,
          workflow_id: null
        }
      ])
      .select()
      .single();
      
    if (taskTypeError) throw taskTypeError;
    testTaskType = taskTypeData;
    
    // Create test fields
    const { data: fieldData, error: fieldError } = await client
      .from('fields')
      .insert([
        {
          name: `Test Field 1 ${uuidv4()}`,
          project_id: testProject.id,
          input_type: 'text',
          is_required: false
        },
        {
          name: `Test Field 2 ${uuidv4()}`,
          project_id: testProject.id,
          input_type: 'number',
          is_required: true
        }
      ])
      .select();
      
    if (fieldError) throw fieldError;
    testField1 = fieldData[0];
    testField2 = fieldData[1];
    
    // Attach the first field to the task type
    const { error: attachError } = await client
      .from('task_type_fields')
      .insert([
        {
          task_type_id: testTaskType.id,
          field_id: testField1.id
        }
      ]);
      
    if (attachError) throw attachError;
  });

  afterEach(async () => {
    // Clean up by deleting the test project
    // This should cascade delete all related data
    if (testProject) {
      await client
        .from('projects')
        .delete()
        .eq('id', testProject.id);
    }
  });

  it('should get all fields for a task type', async () => {
    const { data, error } = await client
      .from('task_type_fields')
      .select('field_id, fields(*)')
      .eq('task_type_id', testTaskType.id);
      
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].field_id).toBe(testField1.id);
  });

  it('should attach a field to a task type', async () => {
    // Attach the second field
    const { error } = await client
      .from('task_type_fields')
      .insert([
        {
          task_type_id: testTaskType.id,
          field_id: testField2.id
        }
      ]);
      
    expect(error).toBeNull();
    
    // Verify both fields are now attached
    const { data, error: fetchError } = await client
      .from('task_type_fields')
      .select('field_id')
      .eq('task_type_id', testTaskType.id);
      
    expect(fetchError).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
    expect(data!.some(tf => tf.field_id === testField1.id)).toBe(true);
    expect(data!.some(tf => tf.field_id === testField2.id)).toBe(true);
  });

  it('should detach a field from a task type', async () => {
    // Delete the association
    const { error } = await client
      .from('task_type_fields')
      .delete()
      .eq('task_type_id', testTaskType.id)
      .eq('field_id', testField1.id);
      
    expect(error).toBeNull();
    
    // Verify it's gone
    const { data, error: fetchError } = await client
      .from('task_type_fields')
      .select('*')
      .eq('task_type_id', testTaskType.id)
      .eq('field_id', testField1.id);
      
    expect(fetchError).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('should prevent attaching a field from another project', async () => {
    // Create another project
    const { data: otherProject, error: projectError } = await client
      .from('projects')
      .insert([
        {
          name: `Other Project ${uuidv4()}`,
          description: 'Another test project',
          user_id: userId
        }
      ])
      .select()
      .single();
      
    if (projectError) throw projectError;
    
    // Create a field in the other project
    const { data: otherField, error: fieldError } = await client
      .from('fields')
      .insert([
        {
          name: `Other Field ${uuidv4()}`,
          project_id: otherProject.id,
          input_type: 'text',
          is_required: false
        }
      ])
      .select()
      .single();
      
    if (fieldError) throw fieldError;
    
    // Try to attach the field from the other project to our task type
    const { error } = await client
      .from('task_type_fields')
      .insert([
        {
          task_type_id: testTaskType.id,
          field_id: otherField.id
        }
      ]);
      
    // This should fail due to RLS policies
    expect(error).not.toBeNull();
    
    // Clean up the other project
    await client
      .from('projects')
      .delete()
      .eq('id', otherProject.id);
  });
});