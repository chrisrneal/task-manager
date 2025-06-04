/**
 * @fileoverview Organizations Collection API Endpoint
 * 
 * This API endpoint handles CRUD operations for the organizations collection,
 * providing secure organization management functionality with proper authentication
 * and authorization checks.
 * 
 * Supported Operations:
 * - GET: List all organizations for the authenticated user
 * - POST: Create new organizations with validation
 * 
 * Key Features:
 * - User-scoped organization access via RLS
 * - Organization creation with automatic owner assignment
 * - Comprehensive validation and error handling
 * - Trace ID logging for debugging
 * - Enforcement of "at most one organization per user" constraint
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Row Level Security policies enforced
 * - User ownership and membership validation
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { createOrganization, CreateOrganizationInput } from '@/services/organizationService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/organizations - Request received`);

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
    // Handle GET request - List organizations user belongs to
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          *,
          user_organizations!inner (
            id,
            role,
            is_primary,
            joined_at
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching organizations: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/organizations - Success, returned ${data.length} organizations`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new organization
    if (method === 'POST') {
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

      console.log(`[${traceId}] POST body:`, req.body);
      console.log(`[${traceId}] Auth user id:`, user.id);

      if (!name) {
        console.log(`[${traceId}] Error: Missing required field 'name'`);
        return res.status(400).json({ 
          error: 'Organization name is required',
          traceId
        });
      }

      if (!slug) {
        console.log(`[${traceId}] Error: Missing required field 'slug'`);
        return res.status(400).json({ 
          error: 'Organization slug is required',
          traceId
        });
      }

      // Validate slug format (alphanumeric, hyphens, underscores only)
      const slugRegex = /^[a-zA-Z0-9-_]+$/;
      if (!slugRegex.test(slug)) {
        console.log(`[${traceId}] Error: Invalid slug format`);
        return res.status(400).json({ 
          error: 'Organization slug can only contain letters, numbers, hyphens, and underscores',
          traceId
        });
      }

      const organizationData: CreateOrganizationInput = {
        name,
        slug,
        description: description || null,
        domain: domain || null,
        logo_url: logo_url || null,
        website_url: website_url || null,
        billing_email: billing_email || null,
        phone: phone || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state_province: state_province || null,
        postal_code: postal_code || null,
        country: country || null,
        timezone: timezone || 'UTC'
      };

      console.log(`[${traceId}] Creating organization with data:`, organizationData);

      const result = await createOrganization(supabase, organizationData, user.id, traceId);

      if (!result.success) {
        const statusCode = result.error?.includes('already') ? 409 : 
                          result.error?.includes('only belong to one') ? 409 : 500;
        console.error(`[${traceId}] Error creating organization: ${result.error}`);
        return res.status(statusCode).json({ 
          error: result.error, 
          details: result.details, 
          traceId 
        });
      }

      console.log(`[${traceId}] POST /api/organizations - Success, created organization: ${result.data!.id}`);
      return res.status(201).json({ data: result.data, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST']);
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