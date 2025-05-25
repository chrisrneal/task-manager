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
  console.log(`[${traceId}] ${method} /api/tasks/${taskId}/fields - Request received`);

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
    global: { headers: { Authorization: `****** } }
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
    // First check if task exists and belongs to user
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*, task_type:task_type_id(*)')
      .eq('id', taskId)
      .single();

    if (taskError) {
      if (taskError.code === 'PGRST116') {
        console.log(`[${traceId}] Error: Task not found or access denied - ${taskId}`);
        return res.status(404).json({ 
          error: 'Task not found or access denied',
          traceId
        });
      }
      throw taskError;
    }

    // Handle GET request - Get all field values for a task
    if (method === 'GET') {
      // Get all fields associated with this task's type
      const { data: taskTypeFields, error: fieldsError } = await supabase
        .from('task_type_fields')
        .select('field_id, fields(*)')
        .eq('task_type_id', task.task_type_id);

      if (fieldsError) {
        console.error(`[${traceId}] Error fetching task type fields: ${fieldsError.message}`);
        return res.status(500).json({ error: fieldsError.message, traceId });
      }

      // Get the values for these fields for this task
      const { data: fieldValues, error: valuesError } = await supabase
        .from('task_field_values')
        .select('field_id, value')
        .eq('task_id', taskId);

      if (valuesError) {
        console.error(`[${traceId}] Error fetching task field values: ${valuesError.message}`);
        return res.status(500).json({ error: valuesError.message, traceId });
      }

      // Create a map of field_id to value
      const valueMap = {};
      fieldValues.forEach(item => {
        valueMap[item.field_id] = item.value;
      });

      // Combine field definitions with values
      const result = taskTypeFields.map(item => ({
        ...item.fields,
        value: valueMap[item.field_id] || null
      }));

      console.log(`[${traceId}] GET /api/tasks/${taskId}/fields - Success, returned ${result.length} fields`);
      return res.status(200).json({ data: result, traceId });
    }
    
    // Handle PUT request - Update field values for a task
    if (method === 'PUT') {
      const { values } = req.body;

      console.log(`[${traceId}] PUT body:`, req.body);
      
      if (!values || !Array.isArray(values)) {
        console.log(`[${traceId}] Error: Missing or invalid 'values' array`);
        return res.status(400).json({ 
          error: 'Values must be provided as an array of {field_id, value} objects',
          traceId
        });
      }

      // Get all fields associated with this task's type for validation
      const { data: taskTypeFields, error: fieldsError } = await supabase
        .from('task_type_fields')
        .select('field_id, fields(*)')
        .eq('task_type_id', task.task_type_id);

      if (fieldsError) {
        console.error(`[${traceId}] Error fetching task type fields: ${fieldsError.message}`);
        return res.status(500).json({ error: fieldsError.message, traceId });
      }

      // Create a map of field_id to field definition for validation
      const fieldMap = {};
      taskTypeFields.forEach(item => {
        fieldMap[item.field_id] = item.fields;
      });

      // Validate that all fields exist and required fields have values
      for (const item of values) {
        if (!item.field_id) {
          console.log(`[${traceId}] Error: Missing field_id in values array`);
          return res.status(400).json({ 
            error: 'Each value object must contain a field_id',
            traceId
          });
        }

        const field = fieldMap[item.field_id];
        if (!field) {
          console.log(`[${traceId}] Error: Field ${item.field_id} is not associated with this task's type`);
          return res.status(400).json({ 
            error: `Field ${item.field_id} is not associated with this task's type`,
            traceId
          });
        }

        if (field.is_required && (item.value === null || item.value === undefined || item.value === '')) {
          console.log(`[${traceId}] Error: Required field ${field.name} (${item.field_id}) has no value`);
          return res.status(400).json({ 
            error: `Required field ${field.name} must have a value`,
            traceId
          });
        }
      }

      // Prepare for batch upsert
      const upsertValues = values.map(item => ({
        task_id: taskId,
        field_id: item.field_id,
        value: item.value
      }));

      // Delete existing values for fields we're updating
      const fieldIds = values.map(item => item.field_id);
      const { error: deleteError } = await supabase
        .from('task_field_values')
        .delete()
        .eq('task_id', taskId)
        .in('field_id', fieldIds);

      if (deleteError) {
        console.error(`[${traceId}] Error deleting existing field values: ${deleteError.message}`);
        return res.status(500).json({ error: deleteError.message, traceId });
      }

      // Insert the new values
      const { data, error } = await supabase
        .from('task_field_values')
        .insert(upsertValues)
        .select();

      if (error) {
        console.error(`[${traceId}] Error updating task field values: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] PUT /api/tasks/${taskId}/fields - Success, updated ${upsertValues.length} field values`);
      return res.status(200).json({ 
        message: `Updated ${upsertValues.length} field values`,
        data,
        traceId
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'PUT']);
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