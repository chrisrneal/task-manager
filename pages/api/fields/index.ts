import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/fields - Request received`);

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
    // Handle GET request - List all fields
    if (method === 'GET') {
      const { project_id } = req.query;
      
      if (!project_id) {
        console.log(`[${traceId}] Error: Missing required query parameter 'project_id'`);
        return res.status(400).json({ 
          error: 'Project ID is required',
          traceId
        });
      }

      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching fields: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/fields - Success, returned ${data.length} fields`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new field
    if (method === 'POST') {
      const { name, project_id, input_type, is_required } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      
      if (!name || !project_id || !input_type) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Field name, project ID, and input type are required',
          traceId
        });
      }

      // First check if project exists and user has access
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
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

      const insertPayload = {
        name,
        project_id,
        input_type,
        is_required: is_required ?? false,
      };
      
      console.log(`[${traceId}] Insert payload:`, insertPayload);

      const { data, error } = await supabase
        .from('fields')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error creating field: ${error.message}`);
        return res.status(500).json({ 
          error: error.message,
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/fields - Success, created field: ${data.id}`);
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