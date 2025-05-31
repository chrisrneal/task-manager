/**
 * @fileoverview Task Type Field Assignment API
 * 
 * This API endpoint manages the assignment of custom fields to task types, enabling:
 * - Retrieving all fields assigned to a specific task type
 * - Bulk assignment/reassignment of fields to task types
 * - Validation that fields belong to the same project as the task type
 * - Replacing existing field assignments with new configurations
 * 
 * Field assignments determine which custom fields are available for tasks
 * of a specific type, enabling flexible data capture based on task context.
 * 
 * @route GET  /api/task-types/[id]/fields - Get fields assigned to a task type
 * @route POST /api/task-types/[id]/fields - Assign fields to a task type
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Task Type Fields API Handler - Manages field assignments to task types
 * 
 * Handles GET and POST operations for assigning custom fields to task types.
 * Ensures field assignments maintain project scope integrity and provides
 * bulk assignment capabilities.
 * 
 * @param req - Next.js API request object
 * @param req.query.id - Task Type ID (UUID) for which to manage field assignments
 * @param req.body.field_ids - Array of field IDs to assign (for POST requests)
 * @param res - Next.js API response object
 * @returns JSON response with assigned fields, validation errors, or operation status
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: taskTypeId } = req.query;

  // Generate trace ID for request logging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/task-types/${taskTypeId}/fields - Request received`);

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

  if (!taskTypeId || typeof taskTypeId !== 'string') {
    console.log(`[${traceId}] Error: Invalid task type ID`);
    return res.status(400).json({ 
      error: 'Task type ID is required',
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
    // Handle GET request - Get all fields assigned to a task type
    if (method === 'GET') {
      // First verify user has access to the task type
      const { data: taskType, error: taskTypeError } = await supabase
        .from('task_types')
        .select('id, project_id')
        .eq('id', taskTypeId)
        .single();

      if (taskTypeError || !taskType) {
        console.log(`[${traceId}] Error: Task type not found or access denied - ${taskTypeId}`);
        return res.status(404).json({ 
          error: 'Task type not found or access denied',
          traceId
        });
      }

      // Retrieve all assigned fields with their full definitions
      // This join query gets field metadata through the task_type_fields relationship
      const { data: fields, error } = await supabase
        .from('task_type_fields')
        .select(`
          field_id,
          fields (
            id,
            project_id,
            name,
            input_type,
            is_required,
            created_at,
            updated_at
          )
        `)
        .eq('task_type_id', taskTypeId);

      if (error) {
        console.error(`[${traceId}] Error fetching task type fields: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to fetch task type fields',
          traceId
        });
      }

      // Transform the data to return just the fields (flatten the join result)
      // This provides a cleaner API response with field objects rather than nested structure
      const assignedFields = fields.map(item => item.fields).filter(Boolean);

      console.log(`[${traceId}] GET /api/task-types/${taskTypeId}/fields - Success: ${assignedFields.length} fields`);
      return res.status(200).json({ 
        data: assignedFields,
        traceId
      });
    }

    // Handle POST request - Assign fields to a task type (bulk operation)
    if (method === 'POST') {
      const { field_ids } = req.body;

      if (!field_ids || !Array.isArray(field_ids)) {
        console.log(`[${traceId}] Error: field_ids array is required`);
        return res.status(400).json({ 
          error: 'field_ids array is required',
          traceId
        });
      }

      // First verify user has access to the task type
      const { data: taskType, error: taskTypeError } = await supabase
        .from('task_types')
        .select('id, project_id')
        .eq('id', taskTypeId)
        .single();

      if (taskTypeError || !taskType) {
        console.log(`[${traceId}] Error: Task type not found or access denied - ${taskTypeId}`);
        return res.status(404).json({ 
          error: 'Task type not found or access denied',
          traceId
        });
      }

      // Verify all fields belong to the same project as the task type
      // This ensures project scope integrity - fields can only be assigned
      // to task types within the same project
      if (field_ids.length > 0) {
        const { data: fields, error: fieldsError } = await supabase
          .from('fields')
          .select('id, project_id')
          .in('id', field_ids);

        if (fieldsError) {
          console.error(`[${traceId}] Error validating fields: ${fieldsError.message}`);
          return res.status(500).json({ 
            error: 'Failed to validate fields',
            traceId
          });
        }

        // Check that all fields belong to the task type's project
        const invalidFields = fields.filter(field => field.project_id !== taskType.project_id);
        if (invalidFields.length > 0) {
          console.log(`[${traceId}] Error: Fields do not belong to task type project`);
          return res.status(400).json({ 
            error: 'Fields must belong to the same project as the task type',
            traceId
          });
        }

        // Ensure all provided field IDs were found in the database
        if (fields.length !== field_ids.length) {
          console.log(`[${traceId}] Error: Some fields not found`);
          return res.status(400).json({ 
            error: 'Some fields were not found',
            traceId
          });
        }
      }

      // Remove all existing field assignments for this task type
      // This allows for complete replacement of field assignments in a single operation
      const { error: deleteError } = await supabase
        .from('task_type_fields')
        .delete()
        .eq('task_type_id', taskTypeId);

      if (deleteError) {
        console.error(`[${traceId}] Error removing existing assignments: ${deleteError.message}`);
        return res.status(500).json({ 
          error: 'Failed to update field assignments',
          traceId
        });
      }

      // Create new field assignments if any fields were provided
      if (field_ids.length > 0) {
        // Map field IDs to assignment records
        const assignments = field_ids.map(field_id => ({
          task_type_id: taskTypeId,
          field_id
        }));

        const { error: insertError } = await supabase
          .from('task_type_fields')
          .insert(assignments);

        if (insertError) {
          console.error(`[${traceId}] Error creating field assignments: ${insertError.message}`);
          return res.status(500).json({ 
            error: 'Failed to create field assignments',
            traceId
          });
        }
      }

      console.log(`[${traceId}] POST /api/task-types/${taskTypeId}/fields - Success: ${field_ids.length} fields assigned`);
      return res.status(200).json({ 
        message: 'Field assignments updated successfully',
        assigned_count: field_ids.length,
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
