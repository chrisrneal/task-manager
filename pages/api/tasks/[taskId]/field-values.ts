/**
 * @fileoverview Task Field Values API Endpoint
 * 
 * This API endpoint manages custom field values for individual tasks. It provides
 * secure operations for creating, reading, updating, and deleting field values
 * with comprehensive validation using the custom field utilities.
 * 
 * Supported Operations:
 * - GET: Retrieve all field values for a task with field definitions
 * - POST: Batch create/update field values with comprehensive validation
 * - DELETE: Remove all field values for a task
 * 
 * Key Features:
 * - Custom field validation using utility functions
 * - Batch operations for efficient field value management
 * - Task type field assignment validation
 * - Required field enforcement
 * - Type-specific value validation
 * - Project scope validation
 * - Comprehensive error handling with detailed error reporting
 * 
 * Security:
 * - Bearer token authentication required
 * - Task ownership verification
 * - Field assignment validation for task types
 * - Project membership validation through task association
 * 
 * @author Task Manager Team
 * @since 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { TaskFieldValue } from '@/types/database';
import { validateFieldValues } from '../../../../utils/customFieldUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Task Field Values API Handler
 * 
 * Handles HTTP requests for task field value management. Supports GET, POST, and DELETE
 * methods with comprehensive validation using custom field utilities and proper
 * authorization checks.
 * 
 * @param {NextApiRequest} req - Next.js API request object
 * @param {NextApiResponse} res - Next.js API response object
 * @returns {Promise<void>} Handles response directly, no return value
 */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { taskId } = req.query;

  // Generate unique trace ID for request logging and debugging
  const traceId = uuidv4();
  console.log(`[${traceId}] ${method} /api/tasks/${taskId}/field-values - Request received`);

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

  // Validate task ID parameter
  if (!taskId || typeof taskId !== 'string') {
    console.log(`[${traceId}] Error: Invalid task ID`);
    return res.status(400).json({ 
      error: 'Task ID is required',
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
    // Verify user has access to the task and get task context for validation
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, project_id, task_type_id, owner_id')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.log(`[${traceId}] Error: Task not found or access denied - ${taskId}`);
      return res.status(404).json({ 
        error: 'Task not found or access denied',
        traceId
      });
    }

    /**
     * GET /api/tasks/[taskId]/field-values
     * 
     * Retrieves all field values for a task along with field definitions.
     * Includes complete field information needed for UI rendering.
     */
    if (method === 'GET') {
      const { data: fieldValues, error } = await supabase
        .from('task_field_values')
        .select(`
          *,
          fields (
            id,
            name,
            input_type,
            is_required,
            project_id
          )
        `)
        .eq('task_id', taskId);

      if (error) {
        console.error(`[${traceId}] Error fetching task field values: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to fetch task field values',
          traceId
        });
      }

      console.log(`[${traceId}] GET /api/tasks/${taskId}/field-values - Success: ${fieldValues.length} field values`);
      return res.status(200).json({ 
        data: fieldValues,
        traceId
      });
    }

    /**
     * POST /api/tasks/[taskId]/field-values
     * 
     * Batch create/update field values for a task with comprehensive validation.
     * Uses the custom field validation utility to ensure all values are valid,
     * required fields are provided, and fields are properly assigned to task types.
     */
    if (method === 'POST') {
      const { field_values } = req.body;

      // Validate request structure
      if (!field_values || !Array.isArray(field_values)) {
        console.log(`[${traceId}] Error: field_values array is required`);
        return res.status(400).json({ 
          error: 'field_values array is required',
          traceId
        });
      }

      // Validate each field value has required field_id
      for (const fieldValue of field_values) {
        if (!fieldValue.field_id) {
          console.log(`[${traceId}] Error: field_id is required for all field values`);
          return res.status(400).json({ 
            error: 'field_id is required for all field values',
            traceId
          });
        }
      }

      // Use comprehensive validation utility for all field value validation
      // This includes type validation, required field checking, field assignment validation, etc.
      try {
        const validationResult = await validateFieldValues(
          supabase,
          task.task_type_id,
          task.project_id,
          field_values
        );

        if (!validationResult.isValid) {
          // Format validation errors for client consumption
          const errorMessages = validationResult.errors.map((e: any) => 
            `${e.field_name}: ${e.error}`
          ).join('; ');
          
          console.log(`[${traceId}] Error: Field validation failed - ${errorMessages}`);
          return res.status(400).json({ 
            error: 'Field validation failed',
            details: validationResult.errors,
            traceId
          });
        }
      } catch (validationError: any) {
        console.error(`[${traceId}] Error during field validation: ${validationError.message}`);
        return res.status(500).json({ 
          error: 'Failed to validate field values',
          traceId
        });
      }

      // Prepare field values for database upsert operation
      const fieldValuesToUpsert = field_values.map(fv => ({
        task_id: taskId,
        field_id: fv.field_id,
        value: fv.value || null
      }));

      // Use upsert to handle both creation and updates efficiently
      const { data: upsertedValues, error: upsertError } = await supabase
        .from('task_field_values')
        .upsert(fieldValuesToUpsert, {
          onConflict: 'task_id,field_id' // Handle duplicate task/field combinations
        })
        .select();

      if (upsertError) {
        console.error(`[${traceId}] Error upserting field values: ${upsertError.message}`);
        return res.status(500).json({ 
          error: 'Failed to update field values',
          traceId
        });
      }

      console.log(`[${traceId}] POST /api/tasks/${taskId}/field-values - Success: ${upsertedValues.length} field values updated`);
      return res.status(200).json({ 
        data: upsertedValues,
        message: 'Field values updated successfully',
        traceId
      });
    }

    /**
     * DELETE /api/tasks/[taskId]/field-values
     * 
     * Removes all field values for a task. This is typically used when
     * removing a task type assignment or clearing all custom field data.
     */
    if (method === 'DELETE') {
      const { error } = await supabase
        .from('task_field_values')
        .delete()
        .eq('task_id', taskId);

      if (error) {
        console.error(`[${traceId}] Error deleting field values: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to delete field values',
          traceId
        });
      }

      console.log(`[${traceId}] DELETE /api/tasks/${taskId}/field-values - Success`);
      return res.status(200).json({ 
        message: 'Field values deleted successfully',
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
