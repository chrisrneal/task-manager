import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/utils/supabaseClient';
import { supabaseAdmin } from '@/utils/supabaseAdmin';
import { v4 as uuidv4 } from 'uuid';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects - Request received`);

  // Extract user token from request
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  // Verify the user session
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    console.log(`[${traceId}] Error: Invalid authentication - ${userError?.message}`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    // Handle GET request - List all projects
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log(`[${traceId}] GET /api/projects - Success, returned ${data.length} projects`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new project
    if (method === 'POST') {
      const { name, description } = req.body;
      
      if (!name) {
        console.log(`[${traceId}] Error: Missing required field 'name'`);
        return res.status(400).json({ 
          error: 'Name is required',
          traceId
        });
      }

      console.log(`[${traceId}] Creating project with user_id: ${user.id}`);
      
      // Use admin client to bypass RLS policies
      const { data, error } = await supabaseAdmin
        .from('projects')
        .insert([
          { 
            name, 
            description: description || null, 
            user_id: user.id 
          }
        ])
        .select();

      if (error) {
        console.error(`[${traceId}] Supabase error: ${error.message}, ${error.code}, ${error.details}`);
        
        // Special handling for RLS policy violation
        if (error.code === '42501' || error.message.includes('policy')) {
          return res.status(403).json({
            error: 'Permission denied. Cannot create project due to security policy.',
            details: error.message,
            traceId
          });
        }
        
        throw error;
      }
      
      console.log(`[${traceId}] POST /api/projects - Success, created project: ${data[0].id}`);
      return res.status(201).json({ data: data[0], traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  } catch (error: any) {
    console.error(`[${traceId}] Error: ${error.message}`);
    console.error(`[${traceId}] Stack trace: ${error.stack}`);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};

export default handler;