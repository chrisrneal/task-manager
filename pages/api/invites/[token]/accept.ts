import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { token } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/invites/${token}/accept - Request received`);

  // Handle POST request - Accept invitation
  if (method === 'POST') {
    try {
      // Create an anonymous Supabase client
      const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
      
      // Check if the user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // If not authenticated, redirect to login page with return URL
        console.log(`[${traceId}] User not authenticated, redirecting to login`);
        return res.status(401).json({ 
          error: 'Authentication required',
          redirect: `/login?returnUrl=/invites/${token}/accept`,
          traceId
        });
      }
      
      // User is authenticated, get the invite details
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('token', token)
        .single();
        
      if (inviteError || !invite) {
        console.log(`[${traceId}] Error: Invalid or expired invitation token`);
        return res.status(404).json({ 
          error: 'Invalid or expired invitation token',
          traceId
        });
      }
      
      // Check if the invite is already accepted or declined
      if (invite.status !== 'pending') {
        console.log(`[${traceId}] Error: Invitation has already been ${invite.status}`);
        return res.status(400).json({ 
          error: `Invitation has already been ${invite.status}`,
          traceId
        });
      }
      
      // Check if the invite email matches the authenticated user's email
      if (invite.email !== session.user.email && !invite.dummy_user) {
        console.log(`[${traceId}] Error: This invitation is for a different email address`);
        return res.status(403).json({ 
          error: 'This invitation is for a different email address',
          traceId
        });
      }
      
      // Accept the invitation
      const { data: acceptedInvite, error: acceptError } = await supabase
        .from('project_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)
        .select()
        .single();
        
      if (acceptError) {
        console.error(`[${traceId}] Error accepting invitation:`, acceptError);
        return res.status(500).json({ 
          error: 'Failed to accept invitation',
          details: acceptError.message,
          traceId
        });
      }
      
      // For regular (non-dummy) users, project membership is handled by the database trigger
      // For dummy users, we don't create a real membership
      
      console.log(`[${traceId}] Successfully accepted invitation`);
      return res.status(200).json({ 
        data: acceptedInvite,
        redirect: `/projects/${invite.project_id}`,
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
  }
  
  // Handle unsupported methods
  console.log(`[${traceId}] Error: Method ${method} not allowed`);
  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ 
    error: `Method ${method} not allowed`,
    traceId
  });
};

export default handler;
