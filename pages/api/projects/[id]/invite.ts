import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/invite - Request received`);

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
    // Handle POST request - Send an invitation
    if (method === 'POST') {
      const { email, role } = req.body;
      
      console.log(`[${traceId}] POST body:`, req.body);
      
      // Validate input
      if (!email || !email.trim()) {
        return res.status(400).json({
          error: 'Email is required',
          traceId
        });
      }
      
      if (!role || !['owner', 'admin', 'member'].includes(role)) {
        return res.status(400).json({
          error: 'Valid role is required',
          traceId
        });
      }
      
      // Check if project exists and user has permission (RLS will handle this)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();
      
      if (projectError) {
        console.error(`[${traceId}] Error fetching project: ${projectError.message}`);
        return res.status(404).json({
          error: 'Project not found or you do not have permission',
          traceId
        });
      }
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('email', email)
        .maybeSingle();
      
      if (existingMember) {
        return res.status(400).json({
          error: 'User is already a member of this project',
          traceId
        });
      }
      
      // Check if there's already a pending invite
      const { data: existingInvite } = await supabase
        .from('project_invites')
        .select('id, status')
        .eq('project_id', projectId)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (existingInvite) {
        return res.status(400).json({
          error: 'There is already a pending invitation for this email',
          traceId
        });
      }
      
      // Create the invitation
      const newInvite = {
        project_id: projectId as string,
        email: email.trim().toLowerCase(),
        role,
        invited_by: user.id,
        token: uuidv4() // Generate unique token for the invite
      };
      
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .insert([newInvite])
        .select()
        .single();
      
      if (inviteError) {
        console.error(`[${traceId}] Error creating invitation: ${inviteError.message}`);
        return res.status(500).json({
          error: 'Failed to create invitation',
          traceId
        });
      }
      
      // Send invitation email via Resend (or your preferred email service)
      if (resendApiKey) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(resendApiKey);
          
          const acceptUrl = `${appUrl}/invites/${invite.token}/accept`;
          
          await resend.emails.send({
            from: 'Task Manager <no-reply@taskmanager.com>',
            to: email,
            subject: `Invitation to join ${project.name}`,
            html: `
              <h1>You've been invited to join ${project.name}</h1>
              <p>You have been invited to collaborate on ${project.name} with the role of <strong>${role}</strong>.</p>
              <p>Click the button below to accept the invitation:</p>
              <p>
                <a href="${acceptUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 4px;">
                  Accept Invitation
                </a>
              </p>
              <p>Or copy and paste this URL into your browser: ${acceptUrl}</p>
              <p>This invitation will expire in 7 days.</p>
            `
          });
          
          console.log(`[${traceId}] Invitation email sent to ${email}`);
        } catch (emailError: any) {
          console.error(`[${traceId}] Error sending email: ${emailError.message}`);
          // Continue even if email fails - we'll still create the invite
        }
      } else {
        console.log(`[${traceId}] Email not sent - RESEND_API_KEY not configured`);
      }
      
      console.log(`[${traceId}] POST /api/projects/${projectId}/invite - Success`);
      return res.status(200).json({
        data: invite,
        message: 'Invitation sent successfully',
        traceId
      });
    }
    
    // Handle GET request - List invitations for a project
    if (method === 'GET') {
      const { data: invites, error: invitesError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (invitesError) {
        console.error(`[${traceId}] Error fetching invites: ${invitesError.message}`);
        return res.status(500).json({
          error: 'Failed to fetch invitations',
          traceId
        });
      }
      
      console.log(`[${traceId}] GET /api/projects/${projectId}/invite - Success, returned ${invites.length} invites`);
      return res.status(200).json({
        data: invites,
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
