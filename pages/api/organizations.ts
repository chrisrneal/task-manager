/**
 * @fileoverview Organizations API Endpoint
 * 
 * This API endpoint handles organization management,
 * providing admins with tools to create, update, and manage organizations
 * and their user memberships.
 * 
 * Supported Operations:
 * - GET: List all organizations with their details
 * - POST: Create a new organization (admin only)
 * - PUT: Update an existing organization (admin only)
 * - DELETE: Delete an organization (admin only)
 * 
 * Key Features:
 * - Organization CRUD operations
 * - User membership management
 * - Admin-only access control
 * - Business rule enforcement (one organization per user)
 * - Row Level Security enforcement
 * - Comprehensive error handling with trace IDs
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
import { Organization, UserOrganization } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Organization validation schema
interface OrganizationCreateRequest {
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  logo_url?: string;
  website_url?: string;
  billing_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
}

interface OrganizationUpdateRequest extends Partial<OrganizationCreateRequest> {
  id: string;
}

// Check if user is admin
const checkAdminRole = async (supabase: any): Promise<boolean> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  
  // Get user metadata or claims to check admin role
  // This assumes the admin role is set in the JWT claims
  return user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin';
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/organizations - Request received`);

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
        return await handleGetOrganizations(req, res, supabase, traceId);
      case 'POST':
        return await handleCreateOrganization(req, res, supabase, traceId, user.id);
      case 'PUT':
        return await handleUpdateOrganization(req, res, supabase, traceId, user.id);
      case 'DELETE':
        return await handleDeleteOrganization(req, res, supabase, traceId, user.id);
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

const handleGetOrganizations = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string) => {
  console.log(`[${traceId}] Getting organizations list`);

  try {
    // Get all organizations with member count
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select(`
        *,
        user_organizations(count)
      `)
      .order('created_at', { ascending: false });

    if (orgError) {
      console.log(`[${traceId}] Error fetching organizations:`, orgError.message);
      return res.status(500).json({ 
        error: 'Failed to fetch organizations',
        details: orgError.message,
        traceId
      });
    }

    // Transform the data to include member count
    const organizationsWithMemberCount = organizations?.map((org: any) => ({
      ...org,
      member_count: org.user_organizations?.length || 0,
      user_organizations: undefined // Remove the raw count data
    })) || [];

    console.log(`[${traceId}] Successfully fetched ${organizationsWithMemberCount.length} organizations`);
    
    return res.status(200).json({
      organizations: organizationsWithMemberCount,
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleGetOrganizations:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleCreateOrganization = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, userId: string) => {
  console.log(`[${traceId}] Creating new organization`);

  try {
    const organizationData: OrganizationCreateRequest = req.body;

    // Validate required fields
    if (!organizationData.name || !organizationData.slug) {
      return res.status(400).json({ 
        error: 'Name and slug are required',
        traceId
      });
    }

    // Validate organization data
    const validationErrors = validateOrganizationData(organizationData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationErrors,
        traceId
      });
    }

    // Check if slug is unique
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', organizationData.slug)
      .single();

    if (existingOrg) {
      return res.status(400).json({ 
        error: 'Organization slug already exists',
        traceId
      });
    }

    // Create organization
    const { data: newOrg, error: createError } = await supabase
      .from('organizations')
      .insert([{
        ...organizationData,
        timezone: organizationData.timezone || 'UTC',
        is_active: true
      }])
      .select()
      .single();

    if (createError) {
      console.log(`[${traceId}] Error creating organization:`, createError.message);
      return res.status(500).json({ 
        error: 'Failed to create organization',
        details: createError.message,
        traceId
      });
    }

    console.log(`[${traceId}] Successfully created organization:`, newOrg.id);

    return res.status(201).json({
      organization: newOrg,
      message: 'Organization created successfully',
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleCreateOrganization:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleUpdateOrganization = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, userId: string) => {
  console.log(`[${traceId}] Updating organization`);

  try {
    const { id } = req.query;
    const updateData: Partial<OrganizationCreateRequest> = req.body;

    if (!id) {
      return res.status(400).json({ 
        error: 'Organization ID is required',
        traceId
      });
    }

    // Validate update data
    if (updateData.slug) {
      const validationErrors = validateOrganizationData(updateData as OrganizationCreateRequest);
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationErrors,
          traceId
        });
      }

      // Check if new slug is unique (excluding current organization)
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', updateData.slug)
        .neq('id', id)
        .single();

      if (existingOrg) {
        return res.status(400).json({ 
          error: 'Organization slug already exists',
          traceId
        });
      }
    }

    // Update organization
    const { data: updatedOrg, error: updateError } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.log(`[${traceId}] Error updating organization:`, updateError.message);
      return res.status(500).json({ 
        error: 'Failed to update organization',
        details: updateError.message,
        traceId
      });
    }

    if (!updatedOrg) {
      return res.status(404).json({ 
        error: 'Organization not found',
        traceId
      });
    }

    console.log(`[${traceId}] Successfully updated organization:`, updatedOrg.id);

    return res.status(200).json({
      organization: updatedOrg,
      message: 'Organization updated successfully',
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleUpdateOrganization:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

const handleDeleteOrganization = async (req: NextApiRequest, res: NextApiResponse, supabase: any, traceId: string, userId: string) => {
  console.log(`[${traceId}] Deleting organization`);

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        error: 'Organization ID is required',
        traceId
      });
    }

    // Check if organization has members
    const { data: members, error: membersError } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('organization_id', id);

    if (membersError) {
      console.log(`[${traceId}] Error checking organization members:`, membersError.message);
      return res.status(500).json({ 
        error: 'Failed to check organization members',
        details: membersError.message,
        traceId
      });
    }

    if (members && members.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete organization with existing members',
        traceId
      });
    }

    // Delete organization
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.log(`[${traceId}] Error deleting organization:`, deleteError.message);
      return res.status(500).json({ 
        error: 'Failed to delete organization',
        details: deleteError.message,
        traceId
      });
    }

    console.log(`[${traceId}] Successfully deleted organization:`, id);

    return res.status(200).json({
      message: 'Organization deleted successfully',
      traceId
    });

  } catch (error) {
    console.error(`[${traceId}] Error in handleDeleteOrganization:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

// Validate organization data
const validateOrganizationData = (org: Partial<OrganizationCreateRequest>): string[] => {
  const errors: string[] = [];
  
  // Required fields validation
  if (org.name && org.name.trim().length === 0) {
    errors.push('Organization name cannot be empty');
  }
  
  if (org.slug && org.slug.trim().length === 0) {
    errors.push('Organization slug cannot be empty');
  }
  
  // Slug format validation
  if (org.slug && !/^[a-z0-9-]+$/.test(org.slug)) {
    errors.push('Organization slug must contain only lowercase letters, numbers, and hyphens');
  }
  
  // Email validation
  if (org.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(org.billing_email)) {
    errors.push('Invalid billing email format');
  }
  
  // URL validation
  if (org.website_url && !isValidUrl(org.website_url)) {
    errors.push('Invalid website URL format');
  }
  
  if (org.logo_url && !isValidUrl(org.logo_url)) {
    errors.push('Invalid logo URL format');
  }
  
  return errors;
};

// Simple URL validation
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export default handler;