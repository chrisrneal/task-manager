/**
 * @fileoverview Project Custom Fields API Endpoint
 * 
 * This API endpoint manages custom field definitions for projects. It provides
 * secure CRUD operations for field definitions with comprehensive validation,
 * duplicate prevention, and proper authorization checks.
 * 
 * Supported Operations:
 * - GET: List all custom fields for a project with task type assignments
 * - POST: Create new custom field with validation and duplicate checking
 * 
 * Key Features:
 * - Field name validation with character restrictions
 * - Input type validation against supported types
 * - Duplicate field name prevention within projects
 * - Project membership validation
 * - Comprehensive error handling with trace IDs
 * - Task type assignment tracking for fields
 * 
 * Security:
 * - Bearer token authentication required
 * - Project access validation via RLS
 * - Field name sanitization to prevent injection
 * - Input type whitelist validation
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Field, FieldInputType } from '@/types/database';
import { isValidFieldInputType, validateFieldName } from '../../../../utils/customFieldUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Project Fields API Handler
 * 
 * Handles HTTP requests for project custom field management. Supports GET and POST
 * methods with comprehensive validation, security checks, and error handling.
 * 
 * @param {NextApiRequest} req - Next.js API request object
 * @param {NextApiResponse} res - Next.js API response object
 * @returns {Promise<void>} Handles response directly, no return value
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId } = req.query;

  // Generate unique trace ID for request logging and debugging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/fields - Request received`);

  // Extract and validate Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  if (!token) {
    console.log(`[${traceId}] Error: No authorization token provided`);
    return res.status(401).json({ 
      error: 'Authentication required',
      traceId
    });
  }

  // Validate project ID parameter
  if (!projectId || typeof projectId !== 'string') {
    console.log(`[${traceId}] Error: Invalid project ID`);
    return res.status(400).json({ 
      error: 'Project ID is required',
      traceId
    });
  }

  // Create Supabase client with user token for Row Level Security (RLS)
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Verify user session and extract user information
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log(`[${traceId}] Error: Invalid authentication - ${userError?.message}`);
    return res.status(401).json({ 
      error: 'Invalid authentication',
      traceId
    });
  }

  try {
    /**
     * GET /api/projects/[id]/fields
     * 
     * Retrieves all custom fields for a project with their task type assignments.
     * Includes field definitions and which task types each field is assigned to.
     * Requires project access via RLS.
     */
    if (method === 'GET') {
      // Verify user has access to the project (RLS will enforce permissions)
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.log(`[${traceId}] Error: Project not found or access denied - ${projectId}`);
        return res.status(404).json({ 
          error: 'Project not found or access denied',
          traceId
        });
      }

      // Fetch all fields for the project with their task type assignments
      const { data: fields, error } = await supabase
        .from('fields')
        .select(`
          *,
          task_type_fields (
            task_type_id
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`[${traceId}] Error fetching fields: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to fetch fields',
          traceId
        });
      }

      // Transform data to include task_type_ids array for easier UI consumption
      const fieldsWithAssignments = fields.map(field => ({
        ...field,
        task_type_ids: field.task_type_fields?.map((ttf: any) => ttf.task_type_id) || []
      }));

      console.log(`[${traceId}] GET /api/projects/${projectId}/fields - Success: ${fields.length} fields`);
      return res.status(200).json({ 
        data: fieldsWithAssignments,
        traceId
      });
    }

    /**
     * POST /api/projects/[id]/fields
     * 
     * Creates a new custom field for a project with comprehensive validation:
     * - Field name validation and sanitization
     * - Input type validation against supported types
     * - Duplicate name checking within the project
     * - Project access verification
     */
    if (method === 'POST') {
      const { name, input_type, is_required, options, default_value } = req.body;

      // Validate required fields
      if (!name || !input_type) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Name and input_type are required',
          traceId
        });
      }

      // Validate field name using utility function (length, characters, etc.)
      const nameValidationError = validateFieldName(name);
      if (nameValidationError) {
        console.log(`[${traceId}] Error: Invalid field name - ${nameValidationError}`);
        return res.status(400).json({ 
          error: nameValidationError,
          traceId
        });
      }

      // Validate input type against supported types whitelist
      if (!isValidFieldInputType(input_type)) {
        console.log(`[${traceId}] Error: Invalid input_type - ${input_type}`);
        return res.status(400).json({ 
          error: 'Invalid input_type. Must be one of: text, textarea, number, date, select, checkbox, radio',
          traceId
        });
      }

      // Verify user has access to the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.log(`[${traceId}] Error: Project not found or access denied - ${projectId}`);
        return res.status(404).json({ 
          error: 'Project not found or access denied',
          traceId
        });
      }

      // Check for duplicate field names within the project (case-insensitive)
      const { data: existingFields, error: duplicateError } = await supabase
        .from('fields')
        .select('id, name')
        .eq('project_id', projectId)
        .ilike('name', name.trim());

      if (duplicateError) {
        console.error(`[${traceId}] Error checking for duplicate fields: ${duplicateError.message}`);
        return res.status(500).json({ 
          error: 'Failed to validate field name',
          traceId
        });
      }

      if (existingFields && existingFields.length > 0) {
        console.log(`[${traceId}] Error: Field name already exists - ${name}`);
        return res.status(409).json({ 
          error: 'A field with this name already exists in the project',
          traceId
        });
      }

      // Create the new field with validated data
      const { data: field, error } = await supabase
        .from('fields')
        .insert([{
          project_id: projectId,
          name: name.trim(), // Sanitize whitespace
          input_type,
          is_required: Boolean(is_required),
          // Note: options and default_value would need additional columns in the DB schema
          // For now, they're documented but not stored (future enhancement)
        }])
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error creating field: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to create field',
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/projects/${projectId}/fields - Success: ${field.id}`);
      return res.status(201).json({ 
        data: field,
        traceId
      });
    }

    // Handle unsupported HTTP methods
    console.log(`[${traceId}] Error: Method ${method} not allowed`);
    return res.status(405).json({ 
      error: 'Method not allowed',
      traceId
    });

  } catch (err: any) {
    console.error(`[${traceId}] Unexpected error: ${err.message}`);
    return res.status(500).json({ 
      error: 'Internal server error',
      traceId
    });
  }
};

export default handler;
