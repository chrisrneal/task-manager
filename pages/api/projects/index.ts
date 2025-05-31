/**
 * @fileoverview Projects Collection API Endpoint
 * 
 * This API endpoint handles CRUD operations for the projects collection,
 * providing secure project management functionality with proper authentication
 * and authorization checks.
 * 
 * Supported Operations:
 * - GET: List all projects for the authenticated user
 * - POST: Create new projects with validation
 * 
 * Key Features:
 * - User-scoped project listing (only user's projects)
 * - Project creation with validation
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
import { authenticateRequest, handleApiOperation, sendErrorResponse, validateRequiredParams } from '@/utils/apiMiddleware';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  // Authenticate request and get user context
  const context = await authenticateRequest(req, res, '/api/projects');
  if (!context) return; // Authentication failed, response already sent

  const { user, supabase, traceId } = context;

  await handleApiOperation(async () => {
    // Handle GET request - List all projects
    if (method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return sendErrorResponse(res, 500, error.message, traceId);
      }

      console.log(`[${traceId}] GET /api/projects - Success, returned ${data.length} projects`);
      return res.status(200).json({ data, traceId });
    }
    
    // Handle POST request - Create a new project
    if (method === 'POST') {
      const { name, description } = req.body;

      console.log(`[${traceId}] POST body:`, req.body);
      console.log(`[${traceId}] Auth user id:`, user.id);

      if (!validateRequiredParams({ name }, res, traceId)) {
        return;
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
        return sendErrorResponse(res, 500, error.message, traceId, error.details);
      }

      console.log(`[${traceId}] POST /api/projects - Success, created project: ${data.id}`);
      return res.status(201).json({ data, traceId });
    }
    
    // Handle unsupported methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    res.setHeader('Allow', ['GET', 'POST']);
    return sendErrorResponse(res, 405, `Method ${method} not allowed`, traceId);
  }, res, traceId, 'Internal server error');
};

export default handler;