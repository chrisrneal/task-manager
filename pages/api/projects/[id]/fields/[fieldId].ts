/**
 * @fileoverview Individual Field Management API
 * 
 * This API endpoint manages individual custom field operations within a project:
 * - Retrieving a specific field with task type assignments
 * - Updating field properties (name, type, requirements)
 * - Safely deleting fields with usage validation
 * - Ensuring field operations maintain data integrity
 * 
 * Field deletion includes safety checks to prevent deletion of fields that
 * are currently used by tasks, preserving existing data.
 * 
 * @route GET    /api/projects/[id]/fields/[fieldId] - Get a specific field
 * @route PUT    /api/projects/[id]/fields/[fieldId] - Update field properties
 * @route DELETE /api/projects/[id]/fields/[fieldId] - Delete field if safe
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { FieldInputType } from '@/types/database';
import { isValidFieldInputType, validateFieldName, canDeleteField } from '../../../../../utils/customFieldUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Individual Field API Handler - Manages single field operations
 * 
 * Handles GET, PUT, and DELETE operations for individual field resources
 * with comprehensive validation and safety checks for field deletion.
 * 
 * @param req - Next.js API request object
 * @param req.query.id - Project ID (UUID) containing the field
 * @param req.query.fieldId - Field ID (UUID) to operate on
 * @param req.body.name - New field name (for PUT requests)
 * @param req.body.input_type - New input type (for PUT requests)
 * @param req.body.is_required - New required status (for PUT requests)
 * @param res - Next.js API response object
 * @returns JSON response with field data, validation errors, or operation status
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: projectId, fieldId } = req.query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/projects/${projectId}/fields/${fieldId} - Request received`);

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

  if (!projectId || typeof projectId !== 'string' || !fieldId || typeof fieldId !== 'string') {
    console.log(`[${traceId}] Error: Invalid project ID or field ID`);
    return res.status(400).json({ 
      error: 'Project ID and field ID are required',
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
    // Handle GET request - Get a specific field
    if (method === 'GET') {
      const { data: field, error } = await supabase
        .from('fields')
        .select(`
          *,
          task_type_fields (
            task_type_id
          )
        `)
        .eq('id', fieldId)
        .eq('project_id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found - ${fieldId}`);
          return res.status(404).json({ 
            error: 'Field not found',
            traceId
          });
        }
        throw error;
      }

      // Transform the data to include task_type_ids array
      const fieldWithAssignments = {
        ...field,
        task_type_ids: field.task_type_fields?.map((ttf: any) => ttf.task_type_id) || []
      };

      console.log(`[${traceId}] GET /api/projects/${projectId}/fields/${fieldId} - Success`);
      return res.status(200).json({ 
        data: fieldWithAssignments,
        traceId
      });
    }

    // Handle PUT request - Update a field
    if (method === 'PUT') {
      const { name, input_type, is_required, options, default_value } = req.body;

      if (!name && !input_type && is_required === undefined) {
        console.log(`[${traceId}] Error: No fields to update`);
        return res.status(400).json({ 
          error: 'At least one field must be provided for update',
          traceId
        });
      }

      // Validate input_type if provided
      if (input_type) {
        if (!isValidFieldInputType(input_type)) {
          console.log(`[${traceId}] Error: Invalid input_type - ${input_type}`);
          return res.status(400).json({ 
            error: 'Invalid input_type. Must be one of: text, textarea, number, date, select, checkbox, radio',
            traceId
          });
        }
      }

      // First check if field exists and belongs to the project
      const { data: existingField, error: findError } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .eq('project_id', projectId)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found - ${fieldId}`);
          return res.status(404).json({ 
            error: 'Field not found',
            traceId
          });
        }
        throw findError;
      }

      // Update the field
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) {
        const nameValidationError = validateFieldName(name);
        if (nameValidationError) {
          console.log(`[${traceId}] Error: Invalid field name - ${nameValidationError}`);
          return res.status(400).json({ 
            error: nameValidationError,
            traceId
          });
        }
        updateData.name = name.trim();
      }
      if (input_type !== undefined) updateData.input_type = input_type;
      if (is_required !== undefined) updateData.is_required = Boolean(is_required);

      const { data: field, error } = await supabase
        .from('fields')
        .update(updateData)
        .eq('id', fieldId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) {
        console.error(`[${traceId}] Error updating field: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to update field',
          traceId
        });
      }

      console.log(`[${traceId}] PUT /api/projects/${projectId}/fields/${fieldId} - Success`);
      return res.status(200).json({ 
        data: field,
        traceId
      });
    }

    // Handle DELETE request - Delete a field
    if (method === 'DELETE') {
      // First check if field exists and belongs to the project
      const { data: existingField, error: findError } = await supabase
        .from('fields')
        .select('*')
        .eq('id', fieldId)
        .eq('project_id', projectId)
        .single();

      if (findError) {
        if (findError.code === 'PGRST116') {
          console.log(`[${traceId}] Error: Field not found - ${fieldId}`);
          return res.status(404).json({ 
            error: 'Field not found',
            traceId
          });
        }
        throw findError;
      }

      // Check if field is used in any task field values using utility function
      const canDelete = await canDeleteField(supabase, fieldId);
      
      if (!canDelete) {
        console.log(`[${traceId}] Error: Field is in use - ${fieldId}`);
        return res.status(409).json({ 
          error: 'Cannot delete field: it is currently used by tasks',
          traceId
        });
      }

      // Delete the field (CASCADE will handle task_type_fields deletion)
      const { error } = await supabase
        .from('fields')
        .delete()
        .eq('id', fieldId)
        .eq('project_id', projectId);

      if (error) {
        console.error(`[${traceId}] Error deleting field: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to delete field',
          traceId
        });
      }

      console.log(`[${traceId}] DELETE /api/projects/${projectId}/fields/${fieldId} - Success`);
      return res.status(200).json({ 
        message: 'Field deleted successfully',
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
