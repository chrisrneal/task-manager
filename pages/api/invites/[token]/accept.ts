import { NextApiRequest, NextApiResponse } from 'next';
import { 
  generateTraceId,
  logRequest,
  logError,
  logSuccess,
  createApiResponse,
  sendApiResponse,
  withAuth,
  handleMethodNotAllowed,
  handleUnhandledError
} from '@/utils/apiUtils';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { token } = req.query;
  const traceId = generateTraceId();
  
  logRequest(traceId, method || 'UNKNOWN', `/api/invites/${token}/accept`);

  // Authenticate user
  const authContext = await withAuth(req, res, traceId);
  if (!authContext) return; // Response already sent by withAuth

  const { user, supabase } = authContext;

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
        logError(traceId, `Error fetching invite: ${inviteError.message}`);
        return sendApiResponse(res, 404, createApiResponse(traceId, 404, undefined, 'Invitation not found or already processed'));
      }
      
      // Get user email
      const { data: userData, error: userDataError } = await supabase.auth.getUser();
      if (userDataError) {
        logError(traceId, `Error fetching user data: ${userDataError.message}`);
        return sendApiResponse(res, 500, createApiResponse(traceId, 500, undefined, 'Failed to verify user'));
      }
      
      // Check if the invitation is for this user
      const userEmail = userData.user?.email?.toLowerCase();
      if (!userEmail || invite.email.toLowerCase() !== userEmail) {
        logError(traceId, `Email mismatch: ${invite.email} vs ${userEmail}`);
        return sendApiResponse(res, 403, createApiResponse(traceId, 403, undefined, 'This invitation is for a different email address'));
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
      
      logSuccess(traceId, `POST /api/invites/${token}/accept - Success`);
      return sendApiResponse(res, 200, createApiResponse(
        traceId, 
        200, 
        {
          project_id: invite.project_id,
          project_name: projectData.name
        },
        undefined,
        undefined,
        `You have successfully joined ${projectData.name}`
      ));
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
      
      logSuccess(traceId, `PUT /api/invites/${token}/accept - Success (declined)`);
      return sendApiResponse(res, 200, createApiResponse(traceId, 200, undefined, undefined, undefined, 'Invitation declined'));
    }
    
    // Method not allowed
    return handleMethodNotAllowed(res, traceId, method || 'UNKNOWN', ['POST']);

  } catch (err: any) {
    return handleUnhandledError(res, traceId, err);
  }
};

export default handler;
