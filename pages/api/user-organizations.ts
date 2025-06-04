/**
 * @fileoverview User Organizations API Endpoint
 * 
 * This API endpoint handles user-organization membership management,
 * providing admins with tools to assign and remove users from organizations.
 * 
 * Supported Operations:
 * - GET: List memberships for an organization or user
 * - POST: Add a user to an organization (admin only)
 * - PUT: Update user membership role (admin only)
 * - DELETE: Remove user from organization (admin only)
 * 
 * Key Features:
 * - User membership CRUD operations
 * - Business rule enforcement (one organization per user)
 * - Role management
 * - Admin-only access control
 * - Row Level Security enforcement
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Admin role verification for all operations
 * - Row Level Security policies enforced
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { UserOrganization, UserOrganizationRole } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// User organization validation schema
interface UserOrganizationCreateRequest {
  user_id: string;
  organization_id: string;
  role: UserOrganizationRole;
  is_primary?: boolean;
}

interface UserOrganizationUpdateRequest {
  role?: UserOrganizationRole;
  is_primary?: boolean;
}

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
  console.log(`[${traceId}] ${method} /api/user-organizations - Request received`);

  // Only allow GET, POST, PUT, DELETE requests
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method!)) {
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
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

  // For all operations, check admin role
  const isAdmin = await checkAdminRole(supabase);
  if (!isAdmin) {
    console.log(`[${traceId}] Error: Admin role required for ${method} operation`);
    return res.status(403).json({ 
      error: 'Admin role required for this operation',
      traceId
    });
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGetMemberships(req, res, supabase, traceId);
      case 'POST':
        return await handleCreateMembership(req, res, supabase, traceId, user.id);
      case 'PUT':
        return await handleUpdateMembership(req, res, supabase, traceId, user.id);
      case 'DELETE':
        return await handleDeleteMembership(req, res, supabase, traceId, user.id);
      default:
        return res.status(405).json({ 
          error: `Method ${method} not allowed`,
          traceId
        });
    }
  } catch (error) {
    console.error(`[${traceId}] Unhandled error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleGetMemberships = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string) => {
  console.log(`[${traceId}] Getting memberships`);

  try {
    const { organization_id, user_id } = req.query;

    let query = supabase
      .from('user_organizations')
      .select(`
        *,
        users(id, email, display_name, first_name, last_name, avatar_url),
        organizations(id, name, slug, logo_url)
      `);

    // Filter by organization or user if specified
    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    query = query.order('joined_at', { ascending: false });

    const { data: memberships, error } = await query;

    if (error) {
      console.log(`[${traceId}] Error fetching memberships:`, error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch memberships',
        details: error.message,
        traceId
      });
    }

    console.log(`[${traceId}] Successfully fetched ${memberships?.length || 0} memberships`);
    
    return res.status(200).json({
      memberships: memberships || [],
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleGetMemberships:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleCreateMembership = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, adminUserId: string) => {
  console.log(`[${traceId}] Creating new membership`);

  try {
    const membershipData: UserOrganizationCreateRequest = req.body;

    // Validate required fields
    if (!membershipData.user_id || !membershipData.organization_id || !membershipData.role) {
      return res.status(400).json({ 
        error: 'User ID, organization ID, and role are required',
        traceId
      });
    }

    // Validate role
    const validRoles: UserOrganizationRole[] = ['owner', 'admin', 'member', 'billing', 'readonly'];
    if (!validRoles.includes(membershipData.role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', '),
        traceId
      });
    }

    // Check if user already belongs to an organization (business rule: one org per user)
    const { data: existingMembership } = await supabase
      .from('user_organizations')
      .select('id, organization_id, organizations(name)')
      .eq('user_id', membershipData.user_id)
      .single();

    if (existingMembership) {
      return res.status(400).json({ 
        error: `User is already a member of organization: ${existingMembership.organizations?.name}`,
        traceId
      });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', membershipData.user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        error: 'User not found',
        traceId
      });
    }

    // Verify organization exists
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', membershipData.organization_id)
      .single();

    if (orgError || !organization) {
      return res.status(404).json({ 
        error: 'Organization not found',
        traceId
      });
    }

    // Create membership
    const { data: newMembership, error: createError } = await supabase
      .from('user_organizations')
      .insert([{
        user_id: membershipData.user_id,
        organization_id: membershipData.organization_id,
        role: membershipData.role,
        is_primary: membershipData.is_primary || true, // First org is primary by default
        joined_at: new Date().toISOString()
      }])
      .select(`
        *,
        users(id, email, display_name),
        organizations(id, name, slug)
      `)
      .single();

    if (createError) {
      console.log(`[${traceId}] Error creating membership:`, createError.message);
      return res.status(500).json({ 
        error: 'Failed to create membership',
        details: createError.message,
        traceId
      });
    }

    console.log(`[${traceId}] Successfully created membership:`, newMembership.id);

    return res.status(201).json({
      membership: newMembership,
      message: 'User added to organization successfully',
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleCreateMembership:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleUpdateMembership = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, adminUserId: string) => {
  console.log(`[${traceId}] Updating membership`);

  try {
    const { id } = req.query;
    const updateData: UserOrganizationUpdateRequest = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Membership ID is required',
        traceId
      });
    }

    // Validate role if provided
    if (updateData.role) {
      const validRoles: UserOrganizationRole[] = ['owner', 'admin', 'member', 'billing', 'readonly'];
      if (!validRoles.includes(updateData.role)) {
        return res.status(400).json({ 
          error: 'Invalid role. Must be one of: ' + validRoles.join(', '),
          traceId
        });
      }
    }

    // Update membership
    const { data: updatedMembership, error: updateError } = await supabase
      .from('user_organizations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        users(id, email, display_name),
        organizations(id, name, slug)
      `)
      .single();

    if (updateError) {
      console.log(`[${traceId}] Error updating membership:`, updateError.message);
      return res.status(500).json({ 
        error: 'Failed to update membership',
        details: updateError.message,
        traceId
      });
    }

    if (!updatedMembership) {
      return res.status(404).json({ 
        error: 'Membership not found',
        traceId
      });
    }

    console.log(`[${traceId}] Successfully updated membership:`, updatedMembership.id);

    return res.status(200).json({
      membership: updatedMembership,
      message: 'Membership updated successfully',
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleUpdateMembership:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleDeleteMembership = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, adminUserId: string) => {
  console.log(`[${traceId}] Deleting membership`);

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: 'Membership ID is required',
        traceId
      });
    }

    // Delete membership
    const { error: deleteError } = await supabase
      .from('user_organizations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.log(`[${traceId}] Error deleting membership:`, deleteError.message);
      return res.status(500).json({ 
        error: 'Failed to delete membership',
        details: deleteError.message,
        traceId
      });
    }

    console.log(`[${traceId}] Successfully deleted membership:`, id);

    return res.status(200).json({
      message: 'User removed from organization successfully',
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleDeleteMembership:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

export default handler;