/**
 * @fileoverview Project Fields Management API
 * 
 * This API endpoint manages custom field definitions for a project, enabling:
 * - Creating new custom fields with validation
 * - Retrieving all fields defined for a project
 * - Validating field names and input types
 * - Preventing duplicate field names within a project
 * 
 * Custom fields define the structure and validation rules for additional
 * data that can be captured on tasks within the project.
 * 
 * @route GET  /api/projects/[id]/fields - List all fields for a project
 * @route POST /api/projects/[id]/fields - Create a new field definition
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Field, FieldInputType } from '@/types/database';
import { isValidFieldInputType, validateFieldName } from '../../../../utils/customFieldUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Project Fields API Handler - Manages custom field definitions
 * 
 * Handles GET and POST operations for project-level custom field definitions.
 * Includes comprehensive validation for field names, types, and project access.
 * 
 * @param req - Next.js API request object
 * @param req.query.id - Project ID (UUID) for which to manage fields
 * @param req.body.name - Field name (for POST requests, required)
 * @param req.body.input_type - Field input type (text, number, date, etc.)
 * @param req.body.is_required - Whether the field is required (boolean)
 * @param req.body.options - Field options for select/radio types (future use)
 * @param req.body.default_value - Default value for the field (future use)
 * @param res - Next.js API response object
 * @returns JSON response with field data, validation errors, or operation status
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId } = req.query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/fields - Request received`);

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

  if (!projectId || typeof projectId !== 'string') {
    console.log(`[${traceId}] Error: Invalid project ID`);
    return res.status(400).json({ 
      error: 'Project ID is required',
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
    // Handle GET request - List all custom fields for the project
    if (method === 'GET') {
      // First verify user has access to the project
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

      // Retrieve all fields for the project with task type assignment information
      // The join with task_type_fields shows which task types use each field
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

      // Transform the data to include task_type_ids array for easier client consumption
      // This flattens the join result into a more usable format
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

    // Handle POST request - Create a new custom field for the project
    if (method === 'POST') {
      const { name, input_type, is_required, options, default_value } = req.body;

      if (!name || !input_type) {
        console.log(`[${traceId}] Error: Missing required fields`);
        return res.status(400).json({ 
          error: 'Name and input_type are required',
          traceId
        });
      }

      // Validate field name using utility function
      // Checks for length, allowed characters, and basic format
      const nameValidationError = validateFieldName(name);
      if (nameValidationError) {
        console.log(`[${traceId}] Error: Invalid field name - ${nameValidationError}`);
        return res.status(400).json({ 
          error: nameValidationError,
          traceId
        });
      }

      // Validate input type against allowed field types
      // Ensures only supported field types can be created
      if (!isValidFieldInputType(input_type)) {
        console.log(`[${traceId}] Error: Invalid input_type - ${input_type}`);
        return res.status(400).json({ 
          error: 'Invalid input_type. Must be one of: text, textarea, number, date, select, checkbox, radio',
          traceId
        });
      }

      // Verify user has access to the project before creating fields
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

      // Check for duplicate field names within the project
      // Field names must be unique within each project to avoid confusion
      const { data: existingFields, error: duplicateError } = await supabase
        .from('fields')
        .select('id, name')
        .eq('project_id', projectId)
        .ilike('name', name.trim()); // Case-insensitive comparison

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

      // Create the new field in the database
      const { data: field, error } = await supabase
        .from('fields')
        .insert([{
          project_id: projectId,
          name: name.trim(),
          input_type,
          is_required: Boolean(is_required),
          // Note: options and default_value would need additional columns in the DB schema
          // For now, these are placeholders for future enhancement
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

    // Method not allowed
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
