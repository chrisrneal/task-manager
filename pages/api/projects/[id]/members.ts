import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { ProjectMemberRole } from '@/types/database';

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

    // Handle GET request - List members
    if (method === 'GET') {
      const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('role', { ascending: true });
      
      if (membersError) {
        console.error(`[${traceId}] Error fetching members: ${membersError.message}`);
        return res.status(500).json({
          error: 'Failed to fetch project members',
          traceId
        });
      }
      
      // Format the response to include user details
      const formattedMembers = members.map(member => ({
        project_id: member.project_id,
        user_id: member.user_id,
        role: member.role,
        created_at: member.created_at,
        updated_at: member.updated_at,
        email: member.profiles?.email || null,
        name: member.profiles?.full_name || null,
        avatar_url: member.profiles?.avatar_url || null
      }));
      
      console.log(`[${traceId}] GET /api/projects/${projectId}/members - Success, returned ${members.length} members`);
      return res.status(200).json({
        data: formattedMembers,
        traceId
      });
    }
    
    // Handle POST request - Add a dummy member (not tied to real account)
    if (method === 'POST') {
      const { name, role } = req.body;
      
      console.log(`[${traceId}] POST body:`, req.body);
      
      // Validate input
      if (!name || !name.trim()) {
        return res.status(400).json({
          error: 'Name is required',
          traceId
        });
      }
      
      if (!role || !['admin', 'member'].includes(role)) {
        return res.status(400).json({
          error: 'Valid role is required (admin or member)',
          traceId
        });
      }
      
      // Generate a dummy user ID
      const dummyUserId = `dummy-${uuidv4()}`;
      
      // Create the dummy member
      const { data: member, error: memberError } = await supabase
        .from('project_members')
        .insert([{
          project_id: projectId as string,
          user_id: dummyUserId,
          role: role as ProjectMemberRole,
          is_dummy: true, // Flag to identify dummy users
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
      
      console.log(`[${traceId}] DELETE /api/projects/${projectId}/members - Success`);
      return res.status(200).json({
        message: selfRemoval ? 'You have left the project' : 'Member removed successfully',
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
