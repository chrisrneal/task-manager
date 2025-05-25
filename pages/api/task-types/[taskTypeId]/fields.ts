import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { taskTypeId } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/task-types/${taskTypeId}/fields - Request received`);

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
    // First check if task type exists and belongs to user's project
    const { data: taskType, error: taskTypeError } = await supabase
      .from('task_types')
      .select('*')
      .eq('id', taskTypeId)
      .single();

    if (taskTypeError) {
      if (taskTypeError.code === 'PGRST116') {
        console.log(`[${traceId}] Error: Task type not found or access denied - ${taskTypeId}`);
        return res.status(404).json({ 
          error: 'Task type not found or access denied',
          traceId
        });
      }
      throw taskTypeError;
    }

    // Handle GET request - List all fields for a task type
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('task_type_fields')
        .select('field_id, fields(*)')
        .eq('task_type_id', taskTypeId);

      if (error) {
        console.error(`[${traceId}] Error fetching task type fields: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/task-types/${taskTypeId}/fields - Success, returned ${data.length} fields`);
      return res.status(200).json({ 
        data: data.map(item => item.fields), 
        traceId 
      });
    }
    
    // Handle POST request - Attach a field to a task type
    if (method === 'POST') {
      const { field_id } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      if (!field_id) {
        console.log(`[${traceId}] Error: Missing required field 'field_id'`);
        return res.status(400).json({ 
          error: 'Field ID is required',
          traceId
        });
      }

      // Check if field exists and belongs to the same project as the task type
      const { data: field, error: fieldError } = await supabase
        .from('fields')
        .select('*')
        .eq('id', field_id)
        .eq('project_id', taskType.project_id)
        .single();

      if (fieldError) {
        if (fieldError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found or access denied - ${field_id}`);
          return res.status(404).json({ 
            error: 'Field not found or does not belong to the same project as the task type',
            traceId
          });
        }
        throw fieldError;
      }

      // Check if association already exists
      const { data: existingAssoc, error: existingAssocError } = await supabase
        .from('task_type_fields')
        .select('*')
        .eq('task_type_id', taskTypeId)
        .eq('field_id', field_id)
        .maybeSingle();

      if (existingAssocError) throw existingAssocError;

      // If association already exists, just return success
      if (existingAssoc) {
        console.log(`[${traceId}] POST /api/task-types/${taskTypeId}/fields - Field already attached`);
        return res.status(200).json({ 
          message: 'Field already attached to task type', 
          data: field,
          traceId
        });
      }

      // Create the association
      const { error } = await supabase
        .from('task_type_fields')
        .insert([{
          task_type_id: taskTypeId,
          field_id: field_id
        }]);

      if (error) {
        console.error(`[${traceId}] Error attaching field to task type: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/task-types/${taskTypeId}/fields - Success, attached field: ${field_id}`);
      return res.status(201).json({ 
        message: 'Field attached to task type successfully',
        data: field,
        traceId
      });
    }
    
    // Handle DELETE request - Detach a field from a task type
    if (method === 'DELETE') {
      const { field_id } = req.query;
      
      if (!field_id) {
        console.log(`[${traceId}] Error: Missing required query parameter 'field_id'`);
        return res.status(400).json({ 
          error: 'Field ID is required',
          traceId
        });
      }

      // Delete the association
      const { error } = await supabase
        .from('task_type_fields')
        .delete()
        .eq('task_type_id', taskTypeId)
        .eq('field_id', field_id);

      if (error) {
        console.error(`[${traceId}] Error detaching field from task type: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      console.log(`[${traceId}] DELETE /api/task-types/${taskTypeId}/fields - Success, detached field: ${field_id}`);
      return res.status(200).json({ 
        message: 'Field detached from task type successfully', 
        traceId
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
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