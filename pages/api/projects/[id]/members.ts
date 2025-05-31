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
  handleUnhandledError,
  validateRequiredParams,
  checkProjectAccess
} from '@/utils/apiUtils';
import { ProjectMemberRole } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId } = req.query;
  const traceId = generateTraceId();
  
  logRequest(traceId, method || 'UNKNOWN', `/api/projects/${projectId}/members`);

  // Authenticate user
  const authContext = await withAuth(req, res, traceId);
  if (!authContext) return; // Response already sent by withAuth

  const { user, supabase } = authContext;

  try {
    // Check if project exists and user has permission (RLS will handle this)
    const projectAccess = await checkProjectAccess(supabase, projectId as string, user.id, traceId);
    if (!projectAccess.hasAccess) {
      return sendApiResponse(res, 404, createApiResponse(traceId, 404, undefined, 'Project not found or you do not have permission'));
    }

    // Handle GET request - List members
    if (method === 'GET') {
      const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('role', { ascending: true });
      
      if (membersError) {
        logError(traceId, `Error fetching members: ${membersError.message}`);
        return sendApiResponse(res, 500, createApiResponse(traceId, 500, undefined, 'Failed to fetch project members'));
      }
      
      // Format the response to handle both real users and dummy users
      const formattedMembers = members.map((member: any) => {
        // For now, we'll treat all members as potentially dummy users
        // until we add the proper is_dummy and dummy_name columns
        return {
          project_id: member.project_id,
          user_id: member.user_id,
          role: member.role,
          created_at: member.created_at,
          updated_at: member.updated_at,
          email: null, // Will be populated when we have proper user lookup
          name: `User ${member.user_id.slice(-8)}`, // Temporary display name
          avatar_url: null,
          is_dummy: member.is_dummy ?? false // Use actual value or default to false
        };
      });
      
      logSuccess(traceId, `GET /api/projects/${projectId}/members - Success, returned ${members.length} members`);
      return sendApiResponse(res, 200, createApiResponse(traceId, 200, formattedMembers));
    }
    
    // Handle POST request - Add a dummy member (not tied to real account)
    if (method === 'POST') {
      const { name, role } = req.body;
      
      console.log(`[${traceId}] POST body:`, req.body);
      
      // Validate input
      const validation = validateRequiredParams({ name: name?.trim() }, traceId);
      if (validation) {
        return sendApiResponse(res, 400, createApiResponse(traceId, 400, undefined, 'Name is required'));
      }
      
      if (!role || !['admin', 'member'].includes(role)) {
        return sendApiResponse(res, 400, createApiResponse(traceId, 400, undefined, 'Valid role is required (admin or member)'));
      }
      
      // Generate a dummy user ID
      const dummyUserId = uuidv4();
      
      // Create the dummy member (temporarily without is_dummy and dummy_name columns)
      const { data: member, error: memberError } = await supabase
        .from('project_members')
        .insert([{
          project_id: projectId as string,
          user_id: dummyUserId,
          role: role as ProjectMemberRole,
          is_dummy: true,
          dummy_name: name.trim()
        }])
        .select()
        .single();
      
      if (memberError) {
        console.error(`[${traceId}] Error creating dummy member: ${memberError.message}`);
        return res.status(500).json({
          error: 'Failed to add dummy member',
          traceId
        });
      }
      
      console.log(`[${traceId}] POST /api/projects/${projectId}/members - Success (dummy user added)`);
      return res.status(200).json({
        data: {
          ...member,
          name: name.trim(),
          email: null,
          avatar_url: null
        },
        traceId
      });
    }
    
    // Handle PUT request - Update member role
    if (method === 'PUT') {
      const { userId, role } = req.body;
      
      console.log(`[${traceId}] PUT body:`, req.body);
      
      // Validate input
      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          traceId
        });
      }
      
      if (!role || !['owner', 'admin', 'member'].includes(role)) {
        return res.status(400).json({
          error: 'Valid role is required',
          traceId
        });
      }
      
      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
      
      if (checkError) {
        console.error(`[${traceId}] Error checking member: ${checkError.message}`);
        return res.status(404).json({
          error: 'Member not found',
          traceId
        });
      }
      
      // Check if updating self
      const selfUpdate = userId === user.id;
      
      // Check if this is the last owner
      if (existingMember.role === 'owner' && role !== 'owner') {
        // Count how many owners the project has
        const { data: ownerCount, error: countError } = await supabase
          .from('project_members')
          .select('user_id', { count: 'exact' })
          .eq('project_id', projectId)
          .eq('role', 'owner');
        
        if (countError) {
          console.error(`[${traceId}] Error counting owners: ${countError.message}`);
          return res.status(500).json({
            error: 'Failed to verify project ownership',
            traceId
          });
        }
        
        if (ownerCount.length <= 1) {
          return res.status(400).json({
            error: 'Cannot change role of the only owner. Transfer ownership to someone else first.',
            traceId
          });
        }
      }
      
      // Update the member's role
      const { data: updatedMember, error: updateError } = await supabase
        .from('project_members')
        .update({ role })
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (updateError) {
        console.error(`[${traceId}] Error updating member: ${updateError.message}`);
        return res.status(500).json({
          error: 'Failed to update member role',
          traceId
        });
      }
      
      console.log(`[${traceId}] PUT /api/projects/${projectId}/members - Success (role updated to ${role})`);
      return res.status(200).json({
        data: updatedMember,
        message: selfUpdate ? 'Your role has been updated' : 'Member role updated successfully',
        traceId
      });
    }
    
    // Handle DELETE request - Remove a member
    if (method === 'DELETE') {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          traceId
        });
      }
      
      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
      
      if (checkError) {
        console.error(`[${traceId}] Error checking member: ${checkError.message}`);
        return res.status(404).json({
          error: 'Member not found',
          traceId
        });
      }
      
      // Check if removing self
      const selfRemoval = userId === user.id;
      
      // Check if this is the last owner
      if (existingMember.role === 'owner') {
        // Count how many owners the project has
        const { data: ownerCount, error: countError } = await supabase
          .from('project_members')
          .select('user_id', { count: 'exact' })
          .eq('project_id', projectId)
          .eq('role', 'owner');
        
        if (countError) {
          console.error(`[${traceId}] Error counting owners: ${countError.message}`);
          return res.status(500).json({
            error: 'Failed to verify project ownership',
            traceId
          });
        }
        
        if (ownerCount.length <= 1) {
          return res.status(400).json({
            error: 'Cannot remove the only owner. Transfer ownership to someone else first.',
            traceId
          });
        }
      }
      
      // Remove the member
      const { error: deleteError } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error(`[${traceId}] Error removing member: ${deleteError.message}`);
        return res.status(500).json({
          error: 'Failed to remove member',
          traceId
        });
      }
      
      logSuccess(traceId, `DELETE /api/projects/${projectId}/members - Success`);
      return sendApiResponse(res, 200, createApiResponse(
        traceId, 
        200, 
        undefined, 
        undefined, 
        undefined,
        selfRemoval ? 'You have left the project' : 'Member removed successfully'
      ));
    }
    
    // Method not allowed
    return handleMethodNotAllowed(res, traceId, method || 'UNKNOWN', ['GET', 'POST', 'PUT', 'DELETE']);

  } catch (err: any) {
    return handleUnhandledError(res, traceId, err);
  }
};

export default handler;
