/**
 * @fileoverview Projects Collection API Endpoint
 * 
 * This API endpoint handles CRUD operations for the projects collection,
 * providing secure project management functionality with proper authentication
 * and authorization checks.
 * 
 * Supported Operations:
 * - GET: List all projects for the authenticated user
 * - POST: Create new projects with validation and optional template application
 * 
 * Key Features:
 * - User-scoped project listing (only user's projects)
 * - Project creation with validation
 * - Template-based project initialization
 * - Fallback to manual setup when no template provided
 * - Row Level Security enforcement
 * - Comprehensive error handling with trace IDs
 * - Proper authentication and session validation
 * 
 * Security:
 * - Bearer token authentication required
 * - User session validation via Supabase Auth
 * - Row Level Security policies enforced
 * - User ownership validation for all operations
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { applyTemplateToProject, getTemplateWithDetails } from '@/services/projectService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects - Request received`);

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
    // Handle GET request - List all projects
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching projects: ${error.message}`);
        return res.status(500).json({ error: error.message, traceId });
      }

      console.log(`[${traceId}] GET /api/projects - Success, returned ${data.length} projects`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new project
    if (method === 'POST') {
      const { name, description, template_id } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      console.log(`[${traceId}] Auth user id:`, user.id);

      if (!name) {
        console.log(`[${traceId}] Error: Missing required field 'name'`);
        return res.status(400).json({ 
          error: 'Project name is required',
          traceId
        });
      }

      const insertPayload = {
        name,
        description: description || null,
        user_id: user.id
      };
      console.log(`[${traceId}] Insert payload:`, insertPayload);

      const { data, error } = await supabase
        .from('projects')
        .insert([
          insertPayload
        ])
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error inserting project:`, error);
        return res.status(500).json({ error: error.message, details: error.details, traceId });
      }

      console.log(`[${traceId}] Created project: ${data.id}`);

      // Apply template if template_id is provided
      if (template_id) {
        console.log(`[${traceId}] Applying template ${template_id} to project ${data.id}`);
        
        try {
          // Fetch the template with details
          const template = await getTemplateWithDetails(supabase, template_id, traceId);
          
          if (!template) {
            console.error(`[${traceId}] Template not found: ${template_id}`);
            return res.status(400).json({ 
              error: 'Template not found',
              traceId
            });
          }

          // Apply the template to the project
          const templateResult = await applyTemplateToProject(supabase, data, template, traceId);
          
          if (!templateResult.success) {
            console.error(`[${traceId}] Error applying template: ${templateResult.error}`);
            return res.status(500).json({ 
              error: 'Failed to apply template to project',
              details: templateResult.details,
              traceId
            });
          }

          console.log(`[${traceId}] Successfully applied template to project`);
        } catch (templateError: any) {
          console.error(`[${traceId}] Error during template application: ${templateError.message}`);
          return res.status(500).json({ 
            error: 'Failed to apply template to project',
            details: templateError.message,
            traceId
          });
        }
      } else {
        console.log(`[${traceId}] No template specified, project created with manual setup`);
      }

      console.log(`[${traceId}] POST /api/projects - Success, created project: ${data.id}`);
      return res.status(201).json({ data, traceId });
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