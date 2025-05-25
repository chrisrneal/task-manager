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

  // Extract user token from request
  const authHeader = req.headers.authorization;
  const authToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;
  if (!authToken) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  // Create a Supabase client with the user's token for RLS
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `******` } }
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
    // Handle POST request - Accept an invitation
    if (method === 'POST') {
      // Look up the invitation by token
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();
        
      if (inviteError) {
        console.error(`[${traceId}] Error fetching invite: ${inviteError.message}`);
        return res.status(404).json({
          error: 'Invitation not found or already processed',
          traceId
        });
      }
      
      // Get user email
      const { data: userData, error: userDataError } = await supabase.auth.getUser();
      if (userDataError) {
        console.error(`[${traceId}] Error fetching user data: ${userDataError.message}`);
        return res.status(500).json({
          error: 'Failed to verify user',
          traceId
        });
      }
      
      // Check if the invitation is for this user
      const userEmail = userData.user?.email?.toLowerCase();
      if (!userEmail || invite.email.toLowerCase() !== userEmail) {
        console.log(`[${traceId}] Email mismatch: ${invite.email} vs ${userEmail}`);
        return res.status(403).json({
          error: 'This invitation is for a different email address',
          traceId
        });
      }
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', invite.project_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existingMember) {
        // User is already a member, just update the invite status
        const { error: updateError } = await supabase
          .from('project_invites')
          .update({ status: 'accepted' })
          .eq('id', invite.id);
        
        if (updateError) {
          console.error(`[${traceId}] Error updating invite: ${updateError.message}`);
          return res.status(500).json({
            error: 'Failed to update invitation status',
            traceId
          });
        }
        
        return res.status(200).json({
          message: 'You are already a member of this project',
          data: { project_id: invite.project_id },
          traceId
        });
      }
      
      // Start a transaction to add the user to project_members and update the invite
      // Begin transaction
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', invite.project_id)
        .single();
      
      if (projectError) {
        console.error(`[${traceId}] Error fetching project: ${projectError.message}`);
        return res.status(404).json({
          error: 'Project not found',
          traceId
        });
      }
      
      // Add user to project_members
      const { error: memberError } = await supabase
        .from('project_members')
        .insert([{
          project_id: invite.project_id,
          user_id: user.id,
          role: invite.role
        }]);
      
      if (memberError) {
        console.error(`[${traceId}] Error adding member: ${memberError.message}`);
        return res.status(500).json({
          error: 'Failed to add you as a project member',
          traceId
        });
      }
      
      // Update invitation status
      const { error: updateError } = await supabase
        .from('project_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);
      
      if (updateError) {
        console.error(`[${traceId}] Error updating invite: ${updateError.message}`);
        // We won't return an error here since the member was already added
      }
      
      console.log(`[${traceId}] POST /api/invites/${token}/accept - Success`);
      return res.status(200).json({
        message: `You have successfully joined ${projectData.name}`,
        data: {
          project_id: invite.project_id,
          project_name: projectData.name
        },
        traceId
      });
    }
    
    // Handle GET request - Get invitation details
    if (method === 'GET') {
      // Look up the invitation by token
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('token', token)
        .single();
        
      if (inviteError) {
        console.error(`[${traceId}] Error fetching invite: ${inviteError.message}`);
        return res.status(404).json({
          error: 'Invitation not found',
          traceId
        });
      }
      
      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', invite.project_id)
        .single();
      
      if (projectError) {
        console.error(`[${traceId}] Error fetching project: ${projectError.message}`);
        return res.status(404).json({
          error: 'Project not found',
          traceId
        });
      }
      
      console.log(`[${traceId}] GET /api/invites/${token}/accept - Success`);
      return res.status(200).json({
        data: {
          ...invite,
          project_name: project.name
        },
        traceId
      });
    }
    
    // Handle PUT request - Decline an invitation
    if (method === 'PUT') {
      // Check if this is a decline request
      const { action } = req.body;
      if (action !== 'decline') {
        return res.status(400).json({
          error: 'Invalid action',
          traceId
        });
      }
      
      // Look up the invitation by token
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();
        
      if (inviteError) {
        console.error(`[${traceId}] Error fetching invite: ${inviteError.message}`);
        return res.status(404).json({
          error: 'Invitation not found or already processed',
          traceId
        });
      }
      
      // Update invitation status to declined
      const { error: updateError } = await supabase
        .from('project_invites')
        .update({ status: 'declined' })
        .eq('id', invite.id);
      
      if (updateError) {
        console.error(`[${traceId}] Error updating invite: ${updateError.message}`);
        return res.status(500).json({
          error: 'Failed to decline invitation',
          traceId
        });
      }
      
      console.log(`[${traceId}] PUT /api/invites/${token}/accept - Success (declined)`);
      return res.status(200).json({
        message: 'Invitation declined',
        traceId
      });
    }
    
    // Method not allowed
    return res.status(405).json({
      error: `Method ${method} not allowed`,
      traceId
    });

  } catch (err: any) {
    console.error(`[${traceId}] Unhandled error:`, err.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      traceId
    });
  }
};

export default handler;