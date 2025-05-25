import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/members - Request received`);

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
    // Check if user has access to this project
    const { data: memberData, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();
      
    if (memberError) {
      console.log(`[${traceId}] Error: User does not have access to this project`);
      return res.status(403).json({ 
        error: 'You do not have access to this project',
        traceId
      });
    }

    // Handle GET request - Get all project members
    if (method === 'GET') {
      // Get all project members
      const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select(`
          project_id,
          user_id,
          role,
          created_at,
          updated_at,
          auth.users!user_id(email, created_at)
        `)
        .eq('project_id', projectId);

      if (membersError) {
        console.error(`[${traceId}] Error fetching members:`, membersError);
        return res.status(500).json({ 
          error: 'Failed to fetch project members',
          details: membersError.message,
          traceId
        });
      }

      // Get pending invitations if user is owner/admin
      let pendingInvites = [];
      if (['owner', 'admin'].includes(memberData.role)) {
        const { data: invites, error: invitesError } = await supabase
          .from('project_invites')
          .select('*')
          .eq('project_id', projectId)
          .eq('status', 'pending');

        if (!invitesError) {
          pendingInvites = invites;
        } else {
          console.error(`[${traceId}] Error fetching invites:`, invitesError);
          // Continue anyway, just without invites
        }
      }

      console.log(`[${traceId}] Successfully fetched ${members.length} members and ${pendingInvites.length} pending invites`);
      return res.status(200).json({ 
        data: {
          members,
          pendingInvites
        },
        traceId
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  } catch (error: any) {
    console.error(`[${traceId}] Error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};

export default handler;
