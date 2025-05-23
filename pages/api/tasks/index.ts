import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/tasks - Request received`);

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
    // Handle GET request - List tasks for a project
    if (method === 'GET') {
      const { projectId } = req.query;
      
      if (!projectId) {
        console.log(`[${traceId}] Error: Missing required query parameter 'projectId'`);
        return res.status(400).json({ 
          error: 'Project ID is required',
          traceId
        });
      }

      // First check if project exists and belongs to user
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found or access denied - ${projectId}`);
          return res.status(404).json({ 
            error: 'Project not found or access denied',
            traceId
          });
        }
        throw projectError;
      }

      // Fetch tasks for this project
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching tasks: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/tasks - Success, returned ${data.length} tasks`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new task
    if (method === 'POST') {
      const { name, description, project_id, status, priority, due_date } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      if (!name || !project_id) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Task name and project ID are required',
          traceId
        });
      }

      // First check if project exists and belongs to user
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .eq('user_id', user.id)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found or access denied - ${project_id}`);
          return res.status(404).json({ 
            error: 'Project not found or access denied',
            traceId
          });
        }
        throw projectError;
      }

      const { task_type_id, state_id } = req.body;
      
      const insertPayload = {
        name,
        description: description || null,
        project_id,
        owner_id: user.id,
        status: status || 'todo',
        priority: priority || 'medium',
        due_date: due_date || null,
        task_type_id: task_type_id || null,
        state_id: state_id || null
      };
      
      console.log(`[${traceId}] Insert payload:`, insertPayload);

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          insertPayload
        ])
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error creating task: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/tasks - Success, created task ${data.id}`);
      return res.status(201).json({ data, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST']);
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