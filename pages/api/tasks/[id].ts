import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/tasks/${id} - Request received`);

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
    // Handle GET request - Get a single task
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .eq('owner_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Task not found - ${id}`);
          return res.status(404).json({ 
            error: 'Task not found',
            traceId
          });
        }
        throw error;
      }
      
      console.log(`[${traceId}] GET /api/tasks/${id} - Success`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle PUT request - Update a task
    if (method === 'PUT') {
      const { name, description, status, priority, due_date } = req.body;
      
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
        .eq('id', id)
        .eq('owner_id', user.id)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Task not found or access denied - ${id}`);
          return res.status(404).json({ 
            error: 'Task not found or access denied',
            traceId
          });
        }
        throw findError;
      }

      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          name, 
          description: description || null,
          status: status || existingTask.status,
          priority: priority || existingTask.priority,
          due_date: due_date || existingTask.due_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('owner_id', user.id)
        .select();

      if (error) throw error;
      
      console.log(`[${traceId}] PUT /api/tasks/${id} - Success, updated task`);
      return res.status(200).json({ data: data[0], traceId });
    }
    
    // Handle DELETE request - Delete a task
    if (method === 'DELETE') {
      // First check if task exists and belongs to user
      const { data: existingTask, error: findError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .eq('owner_id', user.id)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Task not found or access denied - ${id}`);
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
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) throw error;
      
      console.log(`[${traceId}] DELETE /api/tasks/${id} - Success, deleted task`);
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