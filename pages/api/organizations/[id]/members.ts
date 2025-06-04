/**
 * @fileoverview Organization Members API Endpoint
 * 
 * This API endpoint handles user membership operations for organizations,
 * providing secure membership management functionality.
 * 
 * Supported Operations:
 * - GET: List organization members
 * - POST: Add user to organization
 * - PUT: Update user role in organization
 * - DELETE: Remove user from organization
 * 
 * Key Features:
 * - Member listing with user details
 * - User invitation and role assignment
 * - Role updates with validation
 * - Member removal with ownership protection
 * - Enforcement of "at most one organization per user" constraint
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Row Level Security policies enforced
 * - Owner/admin role required for member management
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { 
  addUserToOrganization, 
  removeUserFromOrganization, 
  updateUserRole
} from '@/services/organizationService';
import { UserOrganizationRole } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method, query } = req;
  const { id } = query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/organizations/${id}/members - Request received`);

  if (!id || typeof id !== 'string') {
    console.log(`[${traceId}] Error: Invalid organization ID`);
    return res.status(400).json({ 
      error: 'Organization ID is required',
      traceId
    });
  }

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
    // Handle GET request - List organization members
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          *,
          user:users (
            id,
            email,
            display_name,
            first_name,
            last_name,
            avatar_url,
            is_active
          )
        `)
        .eq('organization_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`[${traceId}] Error fetching organization members: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/organizations/${id}/members - Success, returned ${data.length} members`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Add user to organization
    if (method === 'POST') {
      const { user_id, email, role = 'member' } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);

      // Validate role
      const validRoles: UserOrganizationRole[] = ['owner', 'admin', 'member', 'billing', 'readonly'];
      if (!validRoles.includes(role)) {
        console.log(`[${traceId}] Error: Invalid role`);
        return res.status(400).json({ 
          error: 'Invalid role. Must be one of: owner, admin, member, billing, readonly',
          traceId
        });
      }

      let targetUserId = user_id;

      // If user_id is not provided, try to find user by email
      if (!targetUserId && email) {
        const { data: userData, error: userFindError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .eq('is_active', true)
          .single();

        if (userFindError || !userData) {
          console.log(`[${traceId}] User not found with email: ${email}`);
          return res.status(404).json({ 
            error: 'User not found',
            traceId
          });
        }

        targetUserId = userData.id;
      }

      if (!targetUserId) {
        console.log(`[${traceId}] Error: Missing user_id or email`);
        return res.status(400).json({ 
          error: 'User ID or email is required',
          traceId
        });
      }

      const result = await addUserToOrganization(supabase, targetUserId, id, role, user.id, traceId);

      if (!result.success) {
        const statusCode = result.error?.includes('already belongs') ? 409 : 
                          result.error?.includes('not found') ? 404 : 500;
        console.error(`[${traceId}] Error adding user to organization: ${result.error}`);
        return res.status(statusCode).json({ 
          error: result.error, 
          details: result.details, 
          traceId 
        });
      }

      console.log(`[${traceId}] POST /api/organizations/${id}/members - Success`);
      return res.status(201).json({ data: result.data, traceId });
    }
    
    // Handle PUT request - Update user role
    if (method === 'PUT') {
      const { user_id, role } = req.body;

      console.log(`[${traceId}] PUT body:`, req.body);

      if (!user_id) {
        console.log(`[${traceId}] Error: Missing user_id`);
        return res.status(400).json({ 
          error: 'User ID is required',
          traceId
        });
      }

      if (!role) {
        console.log(`[${traceId}] Error: Missing role`);
        return res.status(400).json({ 
          error: 'Role is required',
          traceId
        });
      }

      // Validate role
      const validRoles: UserOrganizationRole[] = ['owner', 'admin', 'member', 'billing', 'readonly'];
      if (!validRoles.includes(role)) {
        console.log(`[${traceId}] Error: Invalid role`);
        return res.status(400).json({ 
          error: 'Invalid role. Must be one of: owner, admin, member, billing, readonly',
          traceId
        });
      }

      const result = await updateUserRole(supabase, user_id, id, role, traceId);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 
                          result.error?.includes('last owner') ? 400 : 500;
        console.error(`[${traceId}] Error updating user role: ${result.error}`);
        return res.status(statusCode).json({ 
          error: result.error, 
          details: result.details, 
          traceId 
        });
      }

      console.log(`[${traceId}] PUT /api/organizations/${id}/members - Success`);
      return res.status(200).json({ data: result.data, traceId });
    }
    
    // Handle DELETE request - Remove user from organization
    if (method === 'DELETE') {
      const { user_id } = req.body;

      console.log(`[${traceId}] DELETE body:`, req.body);

      if (!user_id) {
        console.log(`[${traceId}] Error: Missing user_id`);
        return res.status(400).json({ 
          error: 'User ID is required',
          traceId
        });
      }

      const result = await removeUserFromOrganization(supabase, user_id, id, traceId);

      if (!result.success) {
        const statusCode = result.error?.includes('not a member') ? 404 : 
                          result.error?.includes('last owner') ? 400 : 500;
        console.error(`[${traceId}] Error removing user from organization: ${result.error}`);
        return res.status(statusCode).json({ 
          error: result.error, 
          details: result.details, 
          traceId 
        });
      }

      console.log(`[${traceId}] DELETE /api/organizations/${id}/members - Success`);
      return res.status(200).json({ 
        message: 'User removed from organization successfully', 
        traceId 
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  } catch (error: any) {
    console.error(`[${traceId}] Error: ${error.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      traceId
    });
  }
};

export default handler;