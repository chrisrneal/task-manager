import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Project, Field, TaskType, Task } from '@/types/database';

// Environment variables should be set in test environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe('Task Field Values API Tests', () => {
  let client: SupabaseClient;
  let testProject: Project;
  let testTaskType: TaskType;
  let testTask: Task;
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
          description: 'Test project for task field values API tests',
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
    
    // Attach the fields to the task type
    const { error: attachError } = await client
      .from('task_type_fields')
      .insert([
        {
          task_type_id: testTaskType.id,
          field_id: testField1.id
        },
        {
          task_type_id: testTaskType.id,
          field_id: testField2.id
        }
      ]);
      
    if (attachError) throw attachError;
    
    // Create a test task
    const { data: taskData, error: taskError } = await client
      .from('tasks')
      .insert([
        {
          name: `Test Task ${uuidv4()}`,
          description: 'Test task for field values API tests',
          project_id: testProject.id,
          owner_id: userId,
          status: 'todo',
          priority: 'medium',
          task_type_id: testTaskType.id
        }
      ])
      .select()
      .single();
      
    if (taskError) throw taskError;
    testTask = taskData;
    
    // Add a value for the first field
    const { error: valueError } = await client
      .from('task_field_values')
      .insert([
        {
          task_id: testTask.id,
          field_id: testField1.id,
          value: 'Test Value'
        }
      ]);
      
    if (valueError) throw valueError;
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

  it('should get all field values for a task', async () => {
    // Get the task type fields
    const { data: fields, error: fieldsError } = await client
      .from('task_type_fields')
      .select('field_id, fields(*)')
      .eq('task_type_id', testTaskType.id);
      
    expect(fieldsError).toBeNull();
    
    // Get the values
    const { data: values, error: valuesError } = await client
      .from('task_field_values')
      .select('field_id, value')
      .eq('task_id', testTask.id);
      
    expect(valuesError).toBeNull();
    
    // There should be one value for the first field
    expect(values).not.toBeNull();
    expect(values!.length).toBe(1);
    expect(values![0].field_id).toBe(testField1.id);
    expect(values![0].value).toBe('Test Value');
    
    // There should be two fields defined for the task type
    expect(fields).not.toBeNull();
    expect(fields!.length).toBe(2);
  });

  it('should update field values for a task', async () => {
    // Update both field values
    const { error } = await client
      .from('task_field_values')
      .upsert([
        {
          task_id: testTask.id,
          field_id: testField1.id,
          value: 'Updated Value'
        },
        {
          task_id: testTask.id,
          field_id: testField2.id,
          value: '42'
        }
      ]);
      
    expect(error).toBeNull();
    
    // Verify the values were updated
    const { data, error: fetchError } = await client
      .from('task_field_values')
      .select('field_id, value')
      .eq('task_id', testTask.id)
      .order('field_id');
      
    expect(fetchError).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBe(2);
    
    const field1Value = data!.find(v => v.field_id === testField1.id);
    const field2Value = data!.find(v => v.field_id === testField2.id);
    
    expect(field1Value).toBeDefined();
    expect(field1Value!.value).toBe('Updated Value');
    
    expect(field2Value).toBeDefined();
    expect(field2Value!.value).toBe('42');
  });

  it('should enforce required fields when updating values', async () => {
    // Try to set a required field to null (should fail)
    const { error } = await client
      .from('task_field_values')
      .upsert([
        {
          task_id: testTask.id,
          field_id: testField2.id,
          value: null
        }
      ]);
      
    // This should fail due to validation in the RLS policy
    expect(error).not.toBeNull();
  });

  it('should reject values for fields not associated with the task type', async () => {
    // Create another field not associated with the task type
    const { data: otherField, error: fieldError } = await client
      .from('fields')
      .insert([
        {
          name: `Other Field ${uuidv4()}`,
          project_id: testProject.id,
          input_type: 'text',
          is_required: false
        }
      ])
      .select()
      .single();
      
    if (fieldError) throw fieldError;
    
    // Try to set a value for the field not associated with the task type
    const { error } = await client
      .from('task_field_values')
      .insert([
        {
          task_id: testTask.id,
          field_id: otherField.id,
          value: 'Invalid Value'
        }
      ]);
      
    // This should fail due to validation in the RLS policy
    expect(error).not.toBeNull();
  });
});