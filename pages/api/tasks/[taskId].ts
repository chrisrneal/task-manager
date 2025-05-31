import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { taskId } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/tasks/${taskId} - Request received`);

  // Extract user token from request
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  // Create a Supabase client with the user's token for RLS
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Verify the user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log(`[${traceId}] Error: Invalid authentication - ${userError?.message}`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    // Handle GET request - Get a single task with field values
    if (method === 'GET') {
      const { data: task, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('owner_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Task not found - ${taskId}`);
          return res.status(404).json({ 
            error: 'Task not found',
            traceId
          });
        }
        throw error;
      }

      // Fetch task field values
      const { data: fieldValues, error: fieldValuesError } = await supabase
        .from('task_field_values')
        .select(`
          *,
          fields (
            id,
            name,
            input_type,
            is_required
          )
        `)
        .eq('task_id', taskId);

      if (fieldValuesError) {
        console.error(`[${traceId}] Error fetching field values: ${fieldValuesError.message}`);
        // Continue without field values rather than failing
      }

      const taskWithFieldValues = {
        ...task,
        field_values: fieldValues || []
      };
      
      console.log(`[${traceId}] GET /api/tasks/${taskId} - Success`);
      return res.status(200).json({ data: taskWithFieldValues, traceId });
    }
    
    // Handle PUT request - Update a task
    if (method === 'PUT') {
      const { name, description, task_type_id, state_id, field_values } = req.body;
      
      if (!name) {
        console.log(`[${traceId}] Error: Missing required field 'name'`);
        return res.status(400).json({ 
          error: 'Name is required',
          traceId
        });
      }

      // First check if task exists and belongs to user
      const { data: existingTask, error: findError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('owner_id', user.id)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Task not found or access denied - ${taskId}`);
          return res.status(404).json({ 
            error: 'Task not found or access denied',
            traceId
          });
        }
        throw findError;
      }

      // Validate custom fields if provided
      const finalTaskTypeId = task_type_id !== undefined ? task_type_id : existingTask.task_type_id;
      
      if (finalTaskTypeId && field_values && Array.isArray(field_values)) {
        // Get required fields for this task type
        const { data: taskTypeFields, error: ttfError } = await supabase
          .from('task_type_fields')
          .select(`
            field_id,
            fields (
              id,
              name,
              is_required,
              project_id
            )
          `)
          .eq('task_type_id', finalTaskTypeId);

        if (ttfError) {
          console.error(`[${traceId}] Error fetching task type fields: ${ttfError.message}`);
          return res.status(500).json({ 
            error: 'Failed to validate task type fields',
            traceId
          });
        }

        // Check required fields
        const requiredFields = taskTypeFields
          .map((ttf: any) => ttf.fields)
          .filter((field: any) => field && field.is_required);

        for (const requiredField of requiredFields) {
          const fieldValue = field_values.find(fv => fv.field_id === requiredField.id);
          if (!fieldValue || !fieldValue.value || fieldValue.value.trim() === '') {
            console.log(`[${traceId}] Error: Required field missing value - ${requiredField.name}`);
            return res.status(400).json({ 
              error: `Required field '${requiredField.name}' must have a value`,
              traceId
            });
          }
        }

        // Validate that all provided fields belong to the task type
        const assignedFieldIds = taskTypeFields.map((ttf: any) => ttf.field_id);
        const invalidFields = field_values.filter(fv => !assignedFieldIds.includes(fv.field_id));
        
        if (invalidFields.length > 0) {
          console.log(`[${traceId}] Error: Fields not assigned to task type`);
          return res.status(400).json({ 
            error: 'All fields must be assigned to the task type',
            traceId
          });
        }
      }

      // Update the task
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          name, 
          description: description || null,
          task_type_id: finalTaskTypeId,
          state_id: state_id !== undefined ? state_id : existingTask.state_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('owner_id', user.id)
        .select();

      if (error) throw error;

      // Validate state transition if state has changed
      if (state_id && state_id !== existingTask.state_id && finalTaskTypeId) {
        // Get the task type to find its workflow
        const { data: taskType, error: taskTypeError } = await supabase
          .from('task_types')
          .select('workflow_id')
          .eq('id', finalTaskTypeId)
          .single();

        if (taskTypeError) throw taskTypeError;
        
        if (taskType?.workflow_id) {
          // Get transitions for this workflow
          const { data: transitions, error: transitionsError } = await supabase
            .from('workflow_transitions')
            .select('*')
            .eq('workflow_id', taskType.workflow_id);
            
          if (transitionsError) throw transitionsError;
          
          // Check if the transition is valid
          const isValidTransition = transitions.some(t => 
            // Valid if it's a direct transition from current state to new state
            (t.from_state === existingTask.state_id && t.to_state === state_id) ||
            // Or if it's an "any state" transition to the new state
            (t.from_state === '00000000-0000-0000-0000-000000000000' && t.to_state === state_id)
          );
          
          if (!isValidTransition) {
            console.log(`[${traceId}] Error: Invalid state transition from ${existingTask.state_id} to ${state_id}`);
            
            // Revert the task update
            await supabase
              .from('tasks')
              .update({ state_id: existingTask.state_id })
              .eq('id', taskId)
              .eq('owner_id', user.id);
              
            return res.status(400).json({
              error: 'Invalid state transition according to workflow rules',
              traceId
            });
          }
        }
      }

      // Update field values if provided
      if (field_values && Array.isArray(field_values) && field_values.length > 0) {
        const fieldValuesToUpsert = field_values.map(fv => ({
          task_id: taskId,
          field_id: fv.field_id,
          value: fv.value || null
        }));

        const { error: fieldValuesError } = await supabase
          .from('task_field_values')
          .upsert(fieldValuesToUpsert, {
            onConflict: 'task_id,field_id'
          });

        if (fieldValuesError) {
          console.error(`[${traceId}] Error updating field values: ${fieldValuesError.message}`);
          // Continue despite field values error for now
        }
      }
      
      console.log(`[${traceId}] PUT /api/tasks/${taskId} - Success, updated task`);
      return res.status(200).json({ data: data[0], traceId });
    }
    
    // Handle DELETE request - Delete a task
    if (method === 'DELETE') {
      // First check if task exists and belongs to user
      const { data: existingTask, error: findError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('owner_id', user.id)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Task not found or access denied - ${taskId}`);
          return res.status(404).json({ 
            error: 'Task not found or access denied',
            traceId
          });
        }
        throw findError;
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('owner_id', user.id);

      if (error) throw error;
      
      console.log(`[${traceId}] DELETE /api/tasks/${taskId} - Success, deleted task`);
      return res.status(200).json({ success: true, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  } catch (error: any) {
    console.error(`[${traceId}] Error: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};

export default handler;
