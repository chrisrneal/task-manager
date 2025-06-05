/**
 * @fileoverview Users API Endpoint
 * 
 * This API endpoint handles user management operations for admin users,
 * providing tools to list and manage platform users.
 * 
 * Supported Operations:
 * - GET: List all users (admin only)
 * 
 * Key Features:
 * - User listing with filtering options
 * - Admin-only access control
 * - RLS bypass for admin operations
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Admin role verification for all operations
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { AppUser } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if user is admin
const checkAdminRole = async (supabase: any): Promise<boolean> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  
  return user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/users - Request received`);

  // Only allow GET requests
  if (method !== 'GET') {
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      error: `Method ${method} not allowed`,
      traceId
    });
  }

  // Initialize Supabase client
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log(`[${traceId}] Error: Missing Supabase configuration`);
    return res.status(500).json({ 
      error: 'Server configuration error',
      traceId
    });
  }

  // Get auth header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[${traceId}] Error: Missing or invalid authorization header`);
    return res.status(401).json({ 
      error: 'Authorization header required',
      traceId
    });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Verify user session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.log(`[${traceId}] Error: Invalid user session:`, authError?.message);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  // Check admin role
  const isAdmin = await checkAdminRole(supabase);
  if (!isAdmin) {
    console.log(`[${traceId}] Error: Admin role required for ${method} operation`);
    return res.status(403).json({ 
      error: 'Admin role required for this operation',
      traceId
    });
  }

  try {
    return await handleGetUsers(req, res, supabase, traceId);
  } catch (error) {
    console.error(`[${traceId}] Unhandled error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleGetUsers = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string) => {
  console.log(`[${traceId}] Getting users`);

  try {
    const { active_only = 'true', exclude_organization_members = 'false', organization_id } = req.query;

    // Build base query
    let query = supabase
      .from('users')
      .select('id, email, display_name, first_name, last_name, avatar_url, is_active, created_at');

    // Filter by active status
    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    // Order by display name
    query = query.order('display_name', { ascending: true });

    const { data: users, error } = await query;

    if (error) {
      console.log(`[${traceId}] Error fetching users:`, error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch users',
        details: error.message,
        traceId
      });
    }

    let filteredUsers = users || [];

    // If excluding organization members, filter out users who already belong to organizations
    if (exclude_organization_members === 'true' || organization_id) {
      const { data: memberships, error: membershipError } = await supabase
        .from('user_organizations')
        .select('user_id, organization_id');

      if (membershipError) {
        console.log(`[${traceId}] Error fetching memberships:`, membershipError.message);
        return res.status(500).json({ 
          error: 'Failed to fetch user memberships',
          details: membershipError.message,
          traceId
        });
      }

      if (exclude_organization_members === 'true') {
        // Exclude all users who have any organization membership
        const userIdsWithOrgs = new Set((memberships || []).map((m: any) => m.user_id));
        filteredUsers = filteredUsers.filter((user: any) => !userIdsWithOrgs.has(user.id));
      } else if (organization_id) {
        // Exclude users who belong to the specific organization
        const userIdsInOrg = new Set(
          (memberships || []).filter((m: any) => m.organization_id === organization_id).map((m: any) => m.user_id)
        );
        filteredUsers = filteredUsers.filter((user: any) => !userIdsInOrg.has(user.id));
      }
    }

    console.log(`[${traceId}] Successfully fetched ${filteredUsers.length} users`);
    
    return res.status(200).json({
      users: filteredUsers,
      total: filteredUsers.length,
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleGetUsers:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

export default handler;