import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId, userId } = req.query;
  
  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/members/${userId} - Request received`);

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
    // Check if user has access to this project and permissions
    const { data: currentUserRole, error: currentUserError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();
      
    if (currentUserError || !currentUserRole) {
      console.log(`[${traceId}] Error: User does not have access to this project`);
      return res.status(403).json({ 
        error: 'You do not have access to this project',
        traceId
      });
    }

    // For PUT and DELETE requests, ensure the user is an owner or admin
    // Exception: users can remove themselves
    if ((method === 'PUT' || (method === 'DELETE' && userId !== user.id)) && 
        !['owner', 'admin'].includes(currentUserRole.role)) {
      console.log(`[${traceId}] Error: User lacks permission to modify members`);
      return res.status(403).json({ 
        error: 'You must be a project owner or admin to modify members',
        traceId
      });
    }
    
    // Handle PUT request - Update member role
    if (method === 'PUT') {
      const { role } = req.body;
      
      // Validate role
      if (!role || !['admin', 'member', 'owner'].includes(role)) {
        console.log(`[${traceId}] Error: Invalid role '${role}'`);
        return res.status(400).json({ 
          error: 'Role must be one of: owner, admin, member',
          traceId
        });
      }
      
      // Check if this action would remove the only owner
      if (role !== 'owner') {
        const { data: targetMember, error: targetError } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .single();
          
        if (targetError) {
          console.error(`[${traceId}] Error fetching target member:`, targetError);
          return res.status(404).json({ 
            error: 'Member not found',
            traceId
          });
        }
        
        // If we're changing an owner to something else, make sure there's at least one other owner
        if (targetMember.role === 'owner') {
          const { data: owners, error: ownersError } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId)
            .eq('role', 'owner');
            
          if (ownersError) {
            console.error(`[${traceId}] Error checking owners:`, ownersError);
            return res.status(500).json({ 
              error: 'Failed to verify project owners',
              traceId
            });
          }
          
          if (owners.length <= 1) {
            console.log(`[${traceId}] Error: Cannot remove the only project owner`);
            return res.status(400).json({ 
              error: 'Cannot remove the only project owner. Assign a new owner first.',
              traceId
            });
          }
        }
      }
      
      // If changing to owner, change the current owner to admin
      if (role === 'owner' && currentUserRole.role === 'owner' && userId !== user.id) {
        const { error: demoteError } = await supabase
          .from('project_members')
          .update({ role: 'admin' })
          .eq('project_id', projectId)
          .eq('user_id', user.id);
          
        if (demoteError) {
          console.error(`[${traceId}] Error changing current owner:`, demoteError);
          return res.status(500).json({ 
            error: 'Failed to change ownership',
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
        console.error(`[${traceId}] Error updating member:`, updateError);
        return res.status(500).json({ 
          error: 'Failed to update member',
          details: updateError.message,
          traceId
        });
      }
      
      console.log(`[${traceId}] Successfully updated member role to ${role}`);
      return res.status(200).json({ 
        data: updatedMember,
        traceId
      });
    }
    
    // Handle DELETE request - Remove member
    if (method === 'DELETE') {
      // Check if this is the only owner
      const { data: targetMember, error: targetError } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();
        
      if (targetError) {
        console.error(`[${traceId}] Error fetching target member:`, targetError);
        return res.status(404).json({ 
          error: 'Member not found',
          traceId
        });
      }
      
      // If we're removing an owner, make sure there's at least one other owner
      if (targetMember.role === 'owner') {
        const { data: owners, error: ownersError } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('role', 'owner');
          
        if (ownersError) {
          console.error(`[${traceId}] Error checking owners:`, ownersError);
          return res.status(500).json({ 
            error: 'Failed to verify project owners',
            traceId
          });
        }
        
        if (owners.length <= 1) {
          console.log(`[${traceId}] Error: Cannot remove the only project owner`);
          return res.status(400).json({ 
            error: 'Cannot remove the only project owner. Assign a new owner first.',
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
        console.error(`[${traceId}] Error removing member:`, deleteError);
        return res.status(500).json({ 
          error: 'Failed to remove member',
          details: deleteError.message,
          traceId
        });
      }
      
      console.log(`[${traceId}] Successfully removed member from project`);
      return res.status(200).json({ 
        success: true,
        message: 'Member removed successfully',
        traceId
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['PUT', 'DELETE']);
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
