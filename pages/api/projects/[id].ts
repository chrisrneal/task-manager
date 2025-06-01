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
  console.log(`[${traceId}] ${method} /api/projects/${id} - Request received`);

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
    global: { headers: { Authorization: 'Bearer ' + token } }
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
    // Handle GET request - Get a single project
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found - ${id}`);
          return res.status(404).json({ 
            error: 'Project not found',
            traceId
          });
        }
        throw error;
      }
      
      console.log(`[${traceId}] GET /api/projects/${id} - Success`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle PUT request - Update a project
    if (method === 'PUT') {
      const { name, description } = req.body;
      
      if (!name) {
        console.log(`[${traceId}] Error: Missing required field 'name'`);
        return res.status(400).json({ 
          error: 'Name is required',
          traceId
        });
      }

      // First check if project exists and belongs to user
      const { data: existingProject, error: findError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found or access denied - ${id}`);
          return res.status(404).json({ 
            error: 'Project not found or access denied',
            traceId
          });
        }
        throw findError;
      }

      const { data, error } = await supabase
        .from('projects')
        .update({ 
          name, 
          description: description || null
          // Removed updated_at field as it's likely managed by the database
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      
      console.log(`[${traceId}] PUT /api/projects/${id} - Success, updated project`);
      return res.status(200).json({ data: data[0], traceId });
    }
    
    // Handle DELETE request - Delete a project
    if (method === 'DELETE') {
      // Check if user is owner or admin of the project
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .single();

      if (memberError || !memberData || memberData.role !== 'owner') {
        // Check if user is a system admin
        if (user.app_metadata?.role !== 'admin') {
          console.log(`[${traceId}] Error: Project not found or access denied - ${id}`);
          return res.status(404).json({ 
            error: 'Project not found or access denied',
            traceId
          });
        }
      }

      // Verify project exists before deletion
      const { data: existingProject, error: findError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Project not found - ${id}`);
          return res.status(404).json({ 
            error: 'Project not found',
            traceId
          });
        }
        throw findError;
      }

      // Delete the project (RLS policy will handle the final authorization check)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      console.log(`[${traceId}] DELETE /api/projects/${id} - Success, deleted project`);
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