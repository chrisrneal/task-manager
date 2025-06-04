/**
 * @fileoverview Individual Organization API Endpoint
 * 
 * This API endpoint handles operations for individual organizations,
 * providing secure organization management functionality.
 * 
 * Supported Operations:
 * - GET: Get organization details with members
 * - PUT: Update organization details
 * - DELETE: Delete organization (soft delete)
 * 
 * Key Features:
 * - Organization detail retrieval with member information
 * - Organization update with validation
 * - Soft delete with proper authorization
 * - RLS-based access control
 * - Comprehensive error handling
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Row Level Security policies enforced
 * - Owner/admin role required for updates and deletes
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { 
  updateOrganization, 
  deleteOrganization, 
  getOrganizationWithMembers,
  UpdateOrganizationInput 
} from '@/services/organizationService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method, query } = req;
  const { id } = query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/organizations/${id} - Request received`);

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
    // Handle GET request - Get organization details with members
    if (method === 'GET') {
      const organization = await getOrganizationWithMembers(supabase, id, traceId);

      if (!organization) {
        console.log(`[${traceId}] Organization not found: ${id}`);
        return res.status(404).json({ 
          error: 'Organization not found',
          traceId
        });
      }

      console.log(`[${traceId}] GET /api/organizations/${id} - Success`);
      return res.status(200).json({ data: organization, traceId });
    }
    
    // Handle PUT request - Update organization
    if (method === 'PUT') {
      const { 
        name, 
        slug, 
        description, 
        domain,
        logo_url,
        website_url,
        billing_email,
        phone,
        address_line1,
        address_line2,
        city,
        state_province,
        postal_code,
        country,
        timezone
      } = req.body;

      console.log(`[${traceId}] PUT body:`, req.body);

      // Validate slug format if provided
      if (slug) {
        const slugRegex = /^[a-zA-Z0-9-_]+$/;
        if (!slugRegex.test(slug)) {
          console.log(`[${traceId}] Error: Invalid slug format`);
          return res.status(400).json({ 
            error: 'Organization slug can only contain letters, numbers, hyphens, and underscores',
            traceId
          });
        }
      }

      const updateData: UpdateOrganizationInput = {};
      
      // Only include fields that are provided
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (description !== undefined) updateData.description = description;
      if (domain !== undefined) updateData.domain = domain;
      if (logo_url !== undefined) updateData.logo_url = logo_url;
      if (website_url !== undefined) updateData.website_url = website_url;
      if (billing_email !== undefined) updateData.billing_email = billing_email;
      if (phone !== undefined) updateData.phone = phone;
      if (address_line1 !== undefined) updateData.address_line1 = address_line1;
      if (address_line2 !== undefined) updateData.address_line2 = address_line2;
      if (city !== undefined) updateData.city = city;
      if (state_province !== undefined) updateData.state_province = state_province;
      if (postal_code !== undefined) updateData.postal_code = postal_code;
      if (country !== undefined) updateData.country = country;
      if (timezone !== undefined) updateData.timezone = timezone;

      const result = await updateOrganization(supabase, id, updateData, traceId);

      if (!result.success) {
        const statusCode = result.error?.includes('already taken') ? 409 : 500;
        console.error(`[${traceId}] Error updating organization: ${result.error}`);
        return res.status(statusCode).json({ 
          error: result.error, 
          details: result.details, 
          traceId 
        });
      }

      console.log(`[${traceId}] PUT /api/organizations/${id} - Success`);
      return res.status(200).json({ data: result.data, traceId });
    }
    
    // Handle DELETE request - Delete organization (soft delete)
    if (method === 'DELETE') {
      const result = await deleteOrganization(supabase, id, traceId);

      if (!result.success) {
        console.error(`[${traceId}] Error deleting organization: ${result.error}`);
        return res.status(500).json({ 
          error: result.error, 
          details: result.details, 
          traceId 
        });
      }

      console.log(`[${traceId}] DELETE /api/organizations/${id} - Success`);
      return res.status(200).json({ 
        message: 'Organization deleted successfully', 
        traceId 
      });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
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