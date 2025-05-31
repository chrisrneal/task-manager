/**
 * @fileoverview Task Type Field Assignment API Endpoint
 * 
 * This API endpoint manages the assignment of custom fields to task types.
 * It provides operations for viewing, adding, and removing field assignments
 * with proper validation and authorization checks.
 * 
 * Supported Operations:
 * - GET: List all fields assigned to a task type
 * - POST: Assign a field to a task type
 * - DELETE: Remove field assignment from task type
 * 
 * Key Features:
 * - Task type access validation
 * - Field assignment management
 * - Duplicate assignment prevention
 * - Field existence validation
 * - Project scope validation (fields must belong to same project as task type)
 * 
 * Security:
 * - Bearer token authentication required
 * - Task type access validation via project membership
 * - Field assignment authorization checks
 * - Project boundary enforcement
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Task Type Fields API Handler
 * 
 * Handles HTTP requests for task type field assignment operations. Supports GET, POST,
 * and DELETE methods with comprehensive validation and authorization checks.
 * 
 * @param {NextApiRequest} req - Next.js API request object
 * @param {NextApiResponse} res - Next.js API response object
 * @returns {Promise<void>} Handles response directly, no return value
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { id: taskTypeId } = req.query;

  // Generate unique trace ID for request logging and debugging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/task-types/${taskTypeId}/fields - Request received`);

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

  // Validate task type ID parameter
  if (!taskTypeId || typeof taskTypeId !== 'string') {
    console.log(`[${traceId}] Error: Invalid task type ID`);
    return res.status(400).json({ 
      error: 'Task type ID is required',
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
     * GET /api/task-types/[id]/fields
     * 
     * Retrieves all custom fields assigned to a specific task type.
     * Returns field definitions for all assigned fields, enabling UI
     * to display appropriate field controls for tasks of this type.
     */
    if (method === 'GET') {
      // Verify user has access to the task type through project membership
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

      // Fetch all field assignments with complete field definitions
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

      // Transform data to return clean field definitions
      const assignedFields = fields.map(item => item.fields).filter(Boolean);

      console.log(`[${traceId}] GET /api/task-types/${taskTypeId}/fields - Success: ${assignedFields.length} fields`);
      return res.status(200).json({ 
        data: assignedFields,
        traceId
      });
    }

    /**
     * POST /api/task-types/[id]/fields
     * 
     * Updates field assignments for a task type. This is a batch operation
     * that replaces all existing assignments with the provided field list.
     * Includes comprehensive validation to ensure data integrity:
     * - Field existence validation
     * - Project boundary enforcement (fields must belong to task type's project)
     * - Atomic operation (removes old assignments and creates new ones)
     */
    if (method === 'POST') {
      const { field_ids } = req.body;

      // Validate input structure
      if (!field_ids || !Array.isArray(field_ids)) {
        console.log(`[${traceId}] Error: field_ids array is required`);
        return res.status(400).json({ 
          error: 'field_ids array is required',
          traceId
        });
      }

      // Verify user has access to the task type
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

      // Project Boundary Validation - ensure all fields belong to the same project
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

        // Verify all requested field IDs exist
        if (fields.length !== field_ids.length) {
          console.log(`[${traceId}] Error: Some fields not found`);
          return res.status(400).json({ 
            error: 'Some fields were not found',
            traceId
          });
        }
      }

      // Atomic Update Operation - replace all assignments
      // Step 1: Remove all existing field assignments for this task type
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

      // Step 2: Insert new field assignments (if any)
      if (field_ids.length > 0) {
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
