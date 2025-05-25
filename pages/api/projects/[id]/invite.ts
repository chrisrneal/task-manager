import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

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
    // Verify user has permission to invite members to this project
    const { data: memberData, error: memberError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();
      
    if (memberError || !memberData || !['owner', 'admin'].includes(memberData.role)) {
      console.log(`[${traceId}] Error: User lacks permission to invite members`);
      return res.status(403).json({ 
        error: 'You must be a project owner or admin to invite members',
        traceId
      });
    }

    // Handle POST request - Send invitation
    if (method === 'POST') {
      const { email, role = 'member', isDummyUser = false } = req.body;

      // Validate required fields
      if (!email) {
        console.log(`[${traceId}] Error: Missing required field 'email'`);
        return res.status(400).json({ 
          error: 'Email is required',
          traceId
        });
      }

      // Validate role is valid
      if (!['admin', 'member'].includes(role)) {
        console.log(`[${traceId}] Error: Invalid role '${role}'`);
        return res.status(400).json({ 
          error: 'Role must be either "admin" or "member"',
          traceId
        });
      }

      // Check if user is already a member
      if (!isDummyUser) {
        const { data: existingMember, error: memberCheckError } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('user_id', user.id);

        if (existingMember && existingMember.length > 0) {
          console.log(`[${traceId}] Error: User is already a member of this project`);
          return res.status(400).json({ 
            error: 'User is already a member of this project',
            traceId
          });
        }
      }

      // Check if there's already a pending invite for this email
      const { data: existingInvite, error: inviteCheckError } = await supabase
        .from('project_invites')
        .select('*')
        .eq('project_id', projectId)
        .eq('email', email)
        .eq('status', 'pending');

      if (existingInvite && existingInvite.length > 0) {
        console.log(`[${traceId}] Error: There is already a pending invite for this email`);
        return res.status(400).json({ 
          error: 'There is already a pending invite for this email',
          traceId
        });
      }

      // Create the invitation
      const inviteToken = uuidv4();
      const { data: invite, error: inviteError } = await supabase
        .from('project_invites')
        .insert([
          {
            project_id: projectId,
            email,
            token: inviteToken,
            invited_by: user.id,
            role,
            status: 'pending',
            dummy_user: isDummyUser
          }
        ])
        .select()
        .single();

      if (inviteError) {
        console.error(`[${traceId}] Error creating invite:`, inviteError);
        return res.status(500).json({ 
          error: 'Failed to create invitation',
          details: inviteError.message,
          traceId
        });
      }

      // For non-dummy users, send invitation email if Resend API key is available
      if (!isDummyUser && resendApiKey) {
        try {
          // Get project name for the email
          const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('name')
            .eq('id', projectId)
            .single();

          if (projectError) {
            console.error(`[${traceId}] Error fetching project:`, projectError);
            // Continue even if we can't get the project name
          }

          // Create accept link
          const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/invites/${inviteToken}/accept`;
          
          // We would normally use Resend or another email service here
          // For now, we'll just log the invitation details
          console.log(`[${traceId}] Would send email to ${email} for project ${project?.name || 'Unknown'}`);
          console.log(`[${traceId}] Accept URL: ${acceptUrl}`);
          
          /* Uncomment when Resend is set up
          const { data: emailData } = await resend.emails.send({
            from: 'Task Manager <invites@task-manager-app.com>',
            to: [email],
            subject: `Invitation to join ${project?.name || 'a project'} on Task Manager`,
            html: `
              <p>You've been invited to join ${project?.name || 'a project'} on Task Manager.</p>
              <p>Click the link below to accept the invitation:</p>
              <p><a href="${acceptUrl}">Accept Invitation</a></p>
              <p>This link will expire in 7 days.</p>
            `,
          });
          */
        } catch (emailError: any) {
          console.error(`[${traceId}] Error sending invitation email:`, emailError);
          // We'll still return success even if email sending fails
        }
      }

      console.log(`[${traceId}] Successfully created invitation for ${email}`);
      return res.status(201).json({ 
        data: invite,
        traceId
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['POST']);
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
